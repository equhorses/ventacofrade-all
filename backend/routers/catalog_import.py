"""Importar catálogo desde la web propia del vendedor (plan Profesional).

  GET  /status   → si puede usarlo y qué web tiene en su perfil
  POST /fetch    → lee los productos de su web (Shopify, WooCommerce o cualquier web)
  POST /publish  → publica los elegidos (máx. 20 por tanda); las fotos se copian a nuestro bucket
"""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.categories import Categories
from models.products import Products
from models.seller_profiles import Seller_profiles
from schemas.auth import UserResponse
from services import catalog_import as ci
from services.seller_plans import TIER_PRO, seller_tier
from services.storage import StorageNotConfiguredError, StorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/catalog-import", tags=["catalog-import"])

PUBLISH_BATCH_MAX = 20
DOWNLOAD_CONCURRENCY = 6
CONDITIONS = {"nuevo", "usado", "restaurado"}
PROVINCES = {
    "Sevilla", "Málaga", "Cádiz", "Córdoba", "Granada", "Huelva", "Jaén", "Almería",
    "Madrid", "Barcelona", "Valencia", "Murcia", "Otra",
}


async def _profile(db: AsyncSession, user_id: str) -> Optional[Seller_profiles]:
    result = await db.execute(select(Seller_profiles).where(Seller_profiles.user_id == user_id).limit(1))
    return result.scalar_one_or_none()


async def _require_pro(db: AsyncSession, current_user: UserResponse) -> Seller_profiles:
    from routers.seller_profiles import ensure_seller_profile

    profile = await ensure_seller_profile(db, current_user)
    if seller_tier(profile, role=current_user.role) != TIER_PRO:
        raise HTTPException(status_code=403, detail="Importar tu catálogo está incluido en el plan Profesional.")
    return profile


@router.get("/status")
async def status(current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from routers.seller_profiles import ensure_seller_profile

    profile = await ensure_seller_profile(db, current_user)
    return {
        "can_use": seller_tier(profile, role=current_user.role) == TIER_PRO,
        "website": profile.website if profile else None,
        "is_admin": current_user.role == "admin",
        "province": profile.province if profile else None,
        "city": profile.city if profile else None,
        "max_items": ci.MAX_ITEMS,
    }


class FetchRequest(BaseModel):
    url: str
    confirm_owner: bool = False


@router.post("/fetch")
async def fetch_catalog(
    payload: FetchRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = str(current_user.id)
    profile = await _require_pro(db, current_user)
    if not payload.confirm_owner:
        raise HTTPException(status_code=400, detail="Confirma que el catálogo es tuyo.")
    is_admin = current_user.role == "admin"
    if not profile.website and not is_admin:
        raise HTTPException(status_code=400, detail="Primero añade tu página web en Mi perfil.")
    try:
        url = ci.normalize_url(payload.url)
        if ci.is_blocked(url):
            raise ci.ImportErrorForUser(
                "No se puede importar desde redes sociales ni otras plataformas de venta. Usa tu propia web."
            )
        if not is_admin and not ci.same_site(url, profile.website):
            raise ci.ImportErrorForUser(
                "Solo puedes importar desde la web que tienes en tu perfil. Si es otra, cámbiala primero en Mi perfil."
            )
        source, items = await ci.discover(url)
    except ci.ImportErrorForUser as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not items:
        raise HTTPException(
            status_code=404,
            detail="No hemos encontrado productos en esa página. Prueba con la dirección de tu tienda o de tu catálogo.",
        )

    # Marca los que ya tiene publicados (mismo título) para no duplicarlos.
    titles = (
        await db.execute(select(func.lower(Products.title)).where(Products.user_id == user_id))
    ).scalars().all()
    existing = set(titles)
    for it in items:
        it["already_published"] = it["title"].lower() in existing
    return {"source": source, "items": items}


class PublishItem(BaseModel):
    title: str
    description: Optional[str] = None
    price: float
    category_id: int
    condition: str
    images: list[str] = Field(default_factory=list)


class PublishRequest(BaseModel):
    location_province: str
    location_city: Optional[str] = None
    items: list[PublishItem] = Field(min_length=1)


@router.post("/publish")
async def publish(
    payload: PublishRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = str(current_user.id)
    profile = await _require_pro(db, current_user)
    if len(payload.items) > PUBLISH_BATCH_MAX:
        raise HTTPException(status_code=400, detail=f"Máximo {PUBLISH_BATCH_MAX} anuncios por tanda.")
    if payload.location_province not in PROVINCES:
        raise HTTPException(status_code=400, detail="Elige una provincia válida.")
    try:
        storage = StorageService()
    except StorageNotConfiguredError:
        raise HTTPException(status_code=503, detail="La subida de imágenes no está disponible ahora mismo.")

    category_ids = set((await db.execute(select(Categories.id))).scalars().all())
    for n, item in enumerate(payload.items, start=1):
        if len(item.title.strip()) < 3:
            raise HTTPException(status_code=400, detail=f"«{item.title[:40]}»: falta el título.")
        if not (0 < item.price <= 1_000_000):
            raise HTTPException(status_code=400, detail=f"«{item.title[:40]}»: pon un precio válido.")
        if item.category_id not in category_ids:
            raise HTTPException(status_code=400, detail=f"«{item.title[:40]}»: elige una categoría.")
        if item.condition not in CONDITIONS:
            raise HTTPException(status_code=400, detail=f"«{item.title[:40]}»: elige el estado.")

    # Copia las fotos a nuestro bucket (si la web del vendedor cambia, sus anuncios no se quedan sin fotos).
    wanted = {u for it in payload.items for u in it.images[:ci.MAX_PHOTOS] if not storage.is_own_url(u)}
    copied: dict[str, str] = {}
    semaphore = asyncio.Semaphore(DOWNLOAD_CONCURRENCY)

    async def copy(url: str, client):
        async with semaphore:
            try:
                data, content_type = await ci.download_image(client, url)
                copied[url] = await asyncio.to_thread(storage.put_bytes, data, content_type, "products", user_id)
            except Exception as exc:
                logger.info("Importar catálogo: foto no copiada %s (%s)", url, exc)

    if wanted:
        async with ci.http_client() as client:
            await asyncio.gather(*(copy(u, client) for u in wanted))

    vacation = bool(profile.vacation_mode)
    city = (payload.location_city or "").strip()[:100] or None
    created, without_photos = [], 0
    for item in payload.items:
        images = [u if storage.is_own_url(u) else copied.get(u) for u in item.images[:ci.MAX_PHOTOS]]
        images = [u for u in images if u]
        if item.images and not images:
            without_photos += 1
        product = Products(
            user_id=user_id,
            title=item.title.strip()[:ci.TITLE_MAX],
            description=(item.description or "").strip()[:ci.DESCRIPTION_MAX] or None,
            price=round(item.price, 2),
            category_id=item.category_id,
            condition=item.condition,
            location_province=payload.location_province,
            location_city=city,
            images=",".join(images) or None,
            status="paused" if vacation else "active",
            paused_by_vacation=vacation,
        )
        db.add(product)
        created.append(product)
    await db.commit()
    logger.info("Importar catálogo: user=%s publicados=%s", user_id, len(created))
    return {
        "created": len(created),
        "without_photos": without_photos,
        "vacation_mode": vacation,
        "product_ids": [p.id for p in created],
    }
