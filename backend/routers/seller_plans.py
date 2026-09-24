"""Ventajas del plan del vendedor: resumen, destacados incluidos y estadísticas."""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.favorites import Favorites
from models.feature_purchases import FeaturePurchases
from models.messages import Messages
from models.products import Products
from models.seller_profiles import Seller_profiles
from schemas.auth import UserResponse
from pydantic import BaseModel

from services.seller_plans import (
    ADMIN_ROLE,
    MANUAL_BUMP_INTERVAL,
    VACATION_TIERS,
    next_manual_bump_at,
    INCLUDED_FEATURE_DAYS,
    INCLUDED_FEATURES_PER_MONTH,
    TIER_FREE,
    TIER_PRO,
    included_features_used,
    next_month_start,
    seller_tier,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/seller-plans", tags=["seller-plans"])


async def _profile(db: AsyncSession, user_id: str):
    result = await db.execute(select(Seller_profiles).where(Seller_profiles.user_id == user_id).limit(1))
    return result.scalar_one_or_none()


@router.post("/ensure-profile")
async def ensure_profile(current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Crea el perfil de vendedor si aún no existe (p. ej. al entrar en Suscripción)."""
    from routers.seller_profiles import ensure_seller_profile

    profile = await ensure_seller_profile(db, current_user)
    return {"id": profile.id}


@router.get("/me")
async def my_plan(current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    profile = await _profile(db, str(current_user.id))
    tier = seller_tier(profile, now, current_user.role)
    total = INCLUDED_FEATURES_PER_MONTH.get(tier, 0)
    used = await included_features_used(db, str(current_user.id), now) if total else 0
    is_admin = current_user.role == ADMIN_ROLE
    next_bump = None if is_admin else next_manual_bump_at(profile, tier)
    return {
        "vacation_mode": bool(profile.vacation_mode) if profile else False,
        "can_use_vacation": tier in VACATION_TIERS,
        "can_bump": tier in MANUAL_BUMP_INTERVAL,
        "next_bump_at": next_bump.isoformat() if next_bump else None,
        "auto_bump": tier == TIER_PRO,
        "tier": tier,
        "included_features_total": total,
        "included_features_used": min(used, total),
        "included_features_left": total if is_admin else max(total - used, 0),
        "included_feature_days": INCLUDED_FEATURE_DAYS,
        "resets_at": next_month_start(now).isoformat(),
    }


@router.post("/feature/{product_id}")
async def use_included_feature(
    product_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Destaca un anuncio 7 días usando uno de los destacados incluidos en el plan."""
    now = datetime.now(timezone.utc)
    user_id = str(current_user.id)
    tier = seller_tier(await _profile(db, user_id), now, current_user.role)
    total = INCLUDED_FEATURES_PER_MONTH.get(tier, 0)
    if not total:
        raise HTTPException(status_code=403, detail="Tu plan no incluye destacados. Puedes destacar el anuncio pagando.")

    product = (await db.execute(select(Products).where(Products.id == product_id))).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Anuncio no encontrado.")
    if product.user_id != user_id:
        raise HTTPException(status_code=403, detail="Este anuncio no te pertenece.")
    if (product.status or "active") != "active":
        raise HTTPException(status_code=400, detail="Solo se pueden destacar anuncios activos.")

    is_admin = current_user.role == ADMIN_ROLE
    used = await included_features_used(db, user_id, now)
    if used >= total and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Ya has usado todos los destacados incluidos este mes. Puedes destacar el anuncio pagando.",
        )

    current_until = product.featured_until
    if current_until and current_until.tzinfo is None:
        current_until = current_until.replace(tzinfo=timezone.utc)
    base = current_until if (current_until and current_until > now) else now
    product.featured_until = base + timedelta(days=INCLUDED_FEATURE_DAYS)
    product.is_featured = True

    # Importe 0 = destacado incluido en el plan (no cuenta como ingreso).
    db.add(FeaturePurchases(product_id=product.id, seller_user_id=user_id, days=INCLUDED_FEATURE_DAYS, amount_cents=0))
    await db.commit()
    logger.info("Destacado incluido usado: user=%s product=%s hasta %s", user_id, product.id, product.featured_until)

    return {
        "product_id": product.id,
        "featured_until": product.featured_until.isoformat(),
        "included_features_left": total if is_admin else max(total - used - 1, 0),
    }


@router.get("/stats")
async def my_stats(current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Estadísticas por anuncio según el plan: Básico ve visitas y favoritos; Profesional, además, contactos."""
    user_id = str(current_user.id)
    tier = seller_tier(await _profile(db, user_id), role=current_user.role)
    if tier == TIER_FREE:
        return {"tier": tier, "items": []}

    products = (await db.execute(select(Products).where(Products.user_id == user_id))).scalars().all()
    ids = [p.id for p in products]
    favorites, messages = {}, {}
    if ids:
        fav_rows = await db.execute(
            select(Favorites.product_id, func.count(Favorites.id)).where(Favorites.product_id.in_(ids)).group_by(Favorites.product_id)
        )
        favorites = dict(fav_rows.all())
    if tier == TIER_PRO and ids:
        msg_rows = await db.execute(
            select(Messages.product_id, func.count(func.distinct(Messages.user_id)))
            .where(Messages.product_id.in_(ids), Messages.receiver_id == user_id)
            .group_by(Messages.product_id)
        )
        messages = dict(msg_rows.all())

    items = []
    for p in products:
        item = {"product_id": p.id, "views": p.views_count or 0, "favorites": int(favorites.get(p.id, 0))}
        if tier == TIER_PRO:
            item["contacts"] = int(messages.get(p.id, 0))  # compradores distintos que han escrito
        items.append(item)
    return {"tier": tier, "items": items}


class VacationRequest(BaseModel):
    enabled: bool


@router.post("/vacation")
async def set_vacation_mode(
    payload: VacationRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pausa (o reactiva) de golpe todos los anuncios activos del vendedor."""
    from routers.seller_profiles import ensure_seller_profile

    user_id = str(current_user.id)
    profile = await ensure_seller_profile(db, current_user)
    tier = seller_tier(profile, role=current_user.role)
    # Desactivarlo siempre está permitido (por ejemplo, si el plan caducó estando de vacaciones).
    if not profile or (payload.enabled and tier not in VACATION_TIERS):
        raise HTTPException(status_code=403, detail="El modo vacaciones está disponible con los planes Básico y Profesional.")

    products = (await db.execute(select(Products).where(Products.user_id == user_id))).scalars().all()
    changed = 0
    if payload.enabled:
        for p in products:
            if (p.status or "active") == "active":
                p.status = "paused"
                p.paused_by_vacation = True
                changed += 1
    else:
        # Solo se reactivan los que pausó el modo vacaciones, no los que el vendedor pausó a mano.
        for p in products:
            if p.paused_by_vacation:
                p.status = "active"
                p.paused_by_vacation = False
                changed += 1
    profile.vacation_mode = payload.enabled
    await db.commit()
    return {"vacation_mode": payload.enabled, "products_changed": changed}


@router.post("/bump/{product_id}")
async def bump_product(
    product_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Renueva un anuncio: vuelve arriba como recién publicado."""
    now = datetime.now(timezone.utc)
    from routers.seller_profiles import ensure_seller_profile

    user_id = str(current_user.id)
    profile = await ensure_seller_profile(db, current_user)
    tier = seller_tier(profile, now, current_user.role)
    if tier not in MANUAL_BUMP_INTERVAL:
        raise HTTPException(status_code=403, detail="Renovar anuncios está disponible con los planes Básico y Profesional.")

    product = (await db.execute(select(Products).where(Products.id == product_id))).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Anuncio no encontrado.")
    if product.user_id != user_id:
        raise HTTPException(status_code=403, detail="Este anuncio no te pertenece.")
    if (product.status or "active") != "active":
        raise HTTPException(status_code=400, detail="Solo se pueden renovar anuncios activos.")

    next_bump = next_manual_bump_at(profile, tier)
    if next_bump and current_user.role != ADMIN_ROLE:
        raise HTTPException(
            status_code=403,
            detail=f"Podrás volver a renovar un anuncio a partir del {next_bump.strftime('%d/%m/%Y')}.",
        )

    product.bumped_at = now
    profile.last_manual_bump_at = now
    await db.commit()
    next_bump = next_manual_bump_at(profile, tier)
    return {"product_id": product.id, "bumped_at": now.isoformat(), "next_bump_at": next_bump.isoformat() if next_bump else None}
