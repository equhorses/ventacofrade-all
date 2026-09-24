"""Subida con IA (plan Profesional, y acceso gratuito de fundadores y sorteo).

Flujo en el frontend (/cuenta/subida-masiva):
  1. El navegador sube las fotos a R2 (subida firmada de siempre, carpeta products).
  2. POST /analyze con las URLs → la IA agrupa y propone título, descripción, categoría y estado.
  3. El vendedor revisa, corrige y pone los precios.
  4. POST /publish → se crean todos los anuncios.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.categories import Categories
from models.products import Products
from models.seller_profiles import Seller_profiles
from schemas.auth import UserResponse
from services import ai_listings as ai
from services.seller_plans import TIER_PRO, seller_tier
from services.storage import StorageNotConfiguredError, StorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai-listings", tags=["ai-listings"])

PUBLISH_BATCH_MAX = 40
PROVINCES = {
    "Sevilla", "Málaga", "Cádiz", "Córdoba", "Granada", "Huelva", "Jaén", "Almería",
    "Madrid", "Barcelona", "Valencia", "Murcia", "Otra",
}
MADRID = ZoneInfo("Europe/Madrid")


async def _profile(db: AsyncSession, user_id: str) -> Optional[Seller_profiles]:
    result = await db.execute(select(Seller_profiles).where(Seller_profiles.user_id == user_id).limit(1))
    return result.scalar_one_or_none()


async def _require_pro(db: AsyncSession, user_id: str) -> Seller_profiles:
    profile = await _profile(db, user_id)
    if not profile or seller_tier(profile) != TIER_PRO:
        raise HTTPException(status_code=403, detail="La subida con IA está incluida en el plan Profesional.")
    return profile


def _today() -> str:
    return datetime.now(MADRID).date().isoformat()


def _used_today(profile: Seller_profiles) -> int:
    return (profile.ai_photos_used or 0) if profile.ai_usage_date == _today() else 0


def _storage() -> StorageService:
    try:
        return StorageService()
    except StorageNotConfiguredError:
        raise HTTPException(status_code=503, detail="La subida de imágenes no está disponible ahora mismo.")


async def _categories(db: AsyncSession) -> list[tuple[int, str]]:
    rows = (await db.execute(select(Categories).order_by(Categories.order_index, Categories.id))).scalars().all()
    return [(c.id, c.name) for c in rows]


@router.get("/status")
async def status(current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    profile = await _profile(db, str(current_user.id))
    limit = ai.daily_limit()
    used = _used_today(profile) if profile else 0
    return {
        "can_use": bool(profile) and seller_tier(profile) == TIER_PRO,
        "ai_configured": bool(ai.api_key()),
        "daily_limit": limit,
        "used_today": used,
        "left_today": max(limit - used, 0),
        "max_per_batch": ai.MAX_PHOTOS_PER_BATCH,
        "max_photos_per_item": ai.MAX_PHOTOS_PER_ITEM,
        "province": profile.province if profile else None,
        "city": profile.city if profile else None,
    }


class AnalyzeRequest(BaseModel):
    image_urls: list[str] = Field(min_length=1)


@router.post("/analyze")
async def analyze(
    payload: AnalyzeRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await _require_pro(db, str(current_user.id))
    if not ai.api_key():
        raise HTTPException(status_code=503, detail="La subida con IA no está activada todavía.")

    urls = list(dict.fromkeys(u.strip() for u in payload.image_urls if u and u.strip()))
    if len(urls) > ai.MAX_PHOTOS_PER_BATCH:
        raise HTTPException(status_code=400, detail=f"Máximo {ai.MAX_PHOTOS_PER_BATCH} fotos cada vez.")
    storage = _storage()
    if not all(storage.is_own_url(u) for u in urls):
        raise HTTPException(status_code=400, detail="Las fotos deben subirse desde VentaCofrade.")

    limit = ai.daily_limit()
    used = _used_today(profile)
    if used + len(urls) > limit:
        left = max(limit - used, 0)
        raise HTTPException(
            status_code=429,
            detail=f"Hoy puedes analizar {left} fotos más (límite diario de {limit}). Mañana se renueva.",
        )

    try:
        items = await ai.propose_listings(urls, await _categories(db))
    except ai.AINotConfiguredError:
        raise HTTPException(status_code=503, detail="La subida con IA no está activada todavía.")
    except ai.AIServiceError:
        raise HTTPException(status_code=502, detail="La IA no ha podido analizar las fotos. Inténtalo de nuevo en un momento.")

    # Solo se descuentan del límite si el análisis ha ido bien.
    profile.ai_usage_date = _today()
    profile.ai_photos_used = used + len(urls)
    await db.commit()
    return {"items": items, "left_today": max(limit - profile.ai_photos_used, 0)}


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
    profile = await _require_pro(db, user_id)
    if len(payload.items) > PUBLISH_BATCH_MAX:
        raise HTTPException(status_code=400, detail=f"Máximo {PUBLISH_BATCH_MAX} anuncios cada vez.")
    if payload.location_province not in PROVINCES:
        raise HTTPException(status_code=400, detail="Elige una provincia válida.")
    city = (payload.location_city or "").strip()[:100] or None

    storage = _storage()
    category_ids = {cid for cid, _ in await _categories(db)}

    # Primero se valida todo; si algo falla no se publica nada y se dice qué artículo es.
    for n, item in enumerate(payload.items, start=1):
        title = item.title.strip()
        if len(title) < 3:
            raise HTTPException(status_code=400, detail=f"Artículo {n}: falta el título.")
        if not (0 < item.price <= 1_000_000):
            raise HTTPException(status_code=400, detail=f"Artículo {n}: pon un precio válido.")
        if item.category_id not in category_ids:
            raise HTTPException(status_code=400, detail=f"Artículo {n}: elige una categoría.")
        if item.condition not in ai.CONDITIONS:
            raise HTTPException(status_code=400, detail=f"Artículo {n}: elige el estado.")
        if not item.images or len(item.images) > ai.MAX_PHOTOS_PER_ITEM:
            raise HTTPException(status_code=400, detail=f"Artículo {n}: debe tener entre 1 y {ai.MAX_PHOTOS_PER_ITEM} fotos.")
        if not all(storage.is_own_url(u) for u in item.images):
            raise HTTPException(status_code=400, detail=f"Artículo {n}: foto no válida.")

    vacation = bool(profile.vacation_mode)
    products = []
    for item in payload.items:
        product = Products(
            user_id=user_id,
            title=item.title.strip()[:ai.TITLE_MAX],
            description=(item.description or "").strip()[:ai.DESCRIPTION_MAX] or None,
            price=round(item.price, 2),
            category_id=item.category_id,
            condition=item.condition,
            location_province=payload.location_province,
            location_city=city,
            images=",".join(item.images),
            status="paused" if vacation else "active",
            paused_by_vacation=vacation,
        )
        db.add(product)
        products.append(product)
    await db.commit()
    logger.info("Subida con IA: user=%s publicados=%s", user_id, len(products))
    return {"created": len(products), "product_ids": [p.id for p in products], "vacation_mode": vacation}
