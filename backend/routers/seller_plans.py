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
from services.seller_plans import (
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


@router.get("/me")
async def my_plan(current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    tier = seller_tier(await _profile(db, str(current_user.id)), now)
    total = INCLUDED_FEATURES_PER_MONTH.get(tier, 0)
    used = await included_features_used(db, str(current_user.id), now) if total else 0
    return {
        "tier": tier,
        "included_features_total": total,
        "included_features_used": min(used, total),
        "included_features_left": max(total - used, 0),
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
    tier = seller_tier(await _profile(db, user_id), now)
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

    used = await included_features_used(db, user_id, now)
    if used >= total:
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
        "included_features_left": max(total - used - 1, 0),
    }


@router.get("/stats")
async def my_stats(current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Estadísticas por anuncio según el plan: Básico ve visitas y favoritos; Profesional, además, contactos."""
    user_id = str(current_user.id)
    tier = seller_tier(await _profile(db, user_id))
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
