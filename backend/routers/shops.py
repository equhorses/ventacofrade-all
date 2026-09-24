"""Tienda propia del vendedor (plan Profesional).

- GET  /api/v1/shops/me             → ajustes de mi tienda (y si mi plan la permite)
- GET  /api/v1/shops/check-slug     → ¿está libre esta dirección?
- PUT  /api/v1/shops/me             → guardar dirección, logo, portada y descripción larga
- GET  /api/v1/shops/public/{slug}  → página pública /tienda/<slug>

Si el vendedor deja el plan Profesional, su dirección se conserva (nadie más
puede quedársela) pero la página pública devuelve active=false y el frontend
redirige a su perfil normal /vendedor/<id>. Al volver a Profesional, reaparece.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.products import Products
from models.seller_profiles import Seller_profiles
from schemas.auth import UserResponse
from services.seller_plans import TIER_PRO, seller_tier, tier_for_user
from services.shops import LONG_DESCRIPTION_MAX, slug_error, slugify
from services.storage import StorageNotConfiguredError, StorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/shops", tags=["shops"])

PRO_ONLY = "La tienda propia está incluida en el plan Profesional."


async def _my_profile(db: AsyncSession, user_id: str) -> Optional[Seller_profiles]:
    result = await db.execute(select(Seller_profiles).where(Seller_profiles.user_id == user_id).limit(1))
    return result.scalar_one_or_none()


async def _slug_taken(db: AsyncSession, slug: str, exclude_profile_id: Optional[int]) -> bool:
    query = select(Seller_profiles.id).where(func.lower(Seller_profiles.shop_slug) == slug)
    if exclude_profile_id:
        query = query.where(Seller_profiles.id != exclude_profile_id)
    return (await db.execute(query.limit(1))).scalar_one_or_none() is not None


def _settings_payload(profile: Optional[Seller_profiles], tier: str) -> dict:
    return {
        "can_use": tier == TIER_PRO,
        "tier": tier,
        "has_profile": profile is not None,
        "shop_slug": profile.shop_slug if profile else None,
        "shop_logo_url": profile.shop_logo_url if profile else None,
        "shop_cover_url": profile.shop_cover_url if profile else None,
        "shop_long_description": profile.shop_long_description if profile else None,
        "suggested_slug": slugify(profile.shop_name) if profile else None,
        "long_description_max": LONG_DESCRIPTION_MAX,
    }


@router.get("/me")
async def my_shop(current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from routers.seller_profiles import ensure_seller_profile

    profile = await ensure_seller_profile(db, current_user)
    return _settings_payload(profile, seller_tier(profile, role=current_user.role))


@router.get("/check-slug")
async def check_slug(
    slug: str = Query(..., max_length=100),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slug = slug.strip().lower()
    error = slug_error(slug)
    if error:
        return {"slug": slug, "available": False, "reason": error}
    profile = await _my_profile(db, str(current_user.id))
    if await _slug_taken(db, slug, profile.id if profile else None):
        return {"slug": slug, "available": False, "reason": "Esa dirección ya la usa otra tienda."}
    return {"slug": slug, "available": True, "reason": None}


class ShopUpdate(BaseModel):
    shop_slug: str
    shop_logo_url: Optional[str] = None
    shop_cover_url: Optional[str] = None
    shop_long_description: Optional[str] = None


def _check_image_url(url: Optional[str], label: str) -> Optional[str]:
    url = (url or "").strip()
    if not url:
        return None
    try:
        storage = StorageService()
        if not storage.is_own_url(url):
            raise HTTPException(status_code=400, detail=f"El {label} debe subirse desde VentaCofrade.")
    except StorageNotConfiguredError:
        if not url.startswith("https://"):
            raise HTTPException(status_code=400, detail=f"El {label} no es una imagen válida.")
    return url[:500]


@router.put("/me")
async def update_my_shop(
    payload: ShopUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from routers.seller_profiles import ensure_seller_profile

    profile = await ensure_seller_profile(db, current_user)
    tier = seller_tier(profile, role=current_user.role)
    if tier != TIER_PRO:
        raise HTTPException(status_code=403, detail=PRO_ONLY)

    slug = payload.shop_slug.strip().lower()
    error = slug_error(slug)
    if error:
        raise HTTPException(status_code=400, detail=error)
    if await _slug_taken(db, slug, profile.id):
        raise HTTPException(status_code=409, detail="Esa dirección ya la usa otra tienda.")

    description = (payload.shop_long_description or "").strip()
    if len(description) > LONG_DESCRIPTION_MAX:
        raise HTTPException(
            status_code=400, detail=f"La descripción no puede pasar de {LONG_DESCRIPTION_MAX} caracteres."
        )

    profile.shop_slug = slug
    profile.shop_logo_url = _check_image_url(payload.shop_logo_url, "logo")
    profile.shop_cover_url = _check_image_url(payload.shop_cover_url, "portada")
    profile.shop_long_description = description or None
    await db.commit()
    await db.refresh(profile)
    logger.info("Tienda actualizada: user=%s slug=%s", current_user.id, slug)
    return _settings_payload(profile, tier)


@router.get("/public/{slug}")
async def public_shop(slug: str, db: AsyncSession = Depends(get_db)):
    slug = slug.strip().lower()
    result = await db.execute(
        select(Seller_profiles).where(func.lower(Seller_profiles.shop_slug) == slug).limit(1)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Tienda no encontrada.")

    tier = await tier_for_user(db, profile.user_id, profile)
    if tier != TIER_PRO:
        # La dirección sigue siendo suya, pero la página vuelve a ser el perfil normal.
        return {"active": False, "seller_id": profile.id}

    now = datetime.now(timezone.utc)
    featured_first = case(
        (Products.featured_until.isnot(None) & (Products.featured_until > now), 0), else_=1
    )
    products = (
        await db.execute(
            select(Products)
            .where(Products.user_id == profile.user_id, Products.status == "active")
            .order_by(featured_first, func.coalesce(Products.bumped_at, Products.created_at).desc())
            .limit(500)
        )
    ).scalars().all()

    def _featured(p) -> bool:
        until = p.featured_until
        if until and until.tzinfo is None:
            until = until.replace(tzinfo=timezone.utc)
        return bool(until and until > now)

    return {
        "active": True,
        "seller": {
            "id": profile.id,
            "user_id": profile.user_id,
            "shop_name": profile.shop_name,
            "shop_slug": profile.shop_slug,
            "shop_description": profile.shop_description,
            "shop_long_description": profile.shop_long_description,
            "shop_logo_url": profile.shop_logo_url,
            "shop_cover_url": profile.shop_cover_url,
            "province": profile.province,
            "city": profile.city,
            "is_founder": bool(profile.is_founder),
            "whatsapp": profile.whatsapp,
            "website": profile.website,
            "instagram": profile.instagram,
            "facebook": profile.facebook,
            "tier": tier,
            "member_since": profile.created_at.isoformat() if profile.created_at else None,
        },
        "products": [
            {
                "id": p.id,
                "title": p.title,
                "price": p.price,
                "images": p.images,
                "category_id": p.category_id,
                "condition": p.condition,
                "is_featured": _featured(p),
                "seller_tier": tier,
            }
            for p in products
        ],
    }
