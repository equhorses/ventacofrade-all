"""Ventajas de los planes de vendedor (Gratis, Básico y Profesional).

Publicar es gratis e ilimitado para todos. Los planes dan:
  - Posición en los listados públicos: destacados > Profesional > Básico > gratis.
  - Destacados incluidos cada mes (de 7 días cada uno).
  - Insignia en anuncios y perfil.
  - Estadísticas de sus anuncios.

Quien tiene acceso gratuito vigente (fundadores con pase y ganadores del
sorteo) recibe las ventajas de COMPLIMENTARY_TIER mientras le dure.
"""

from datetime import datetime, timezone
from typing import Iterable, Optional

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.feature_purchases import FeaturePurchases
from models.seller_profiles import Seller_profiles

TIER_FREE = "gratis"
TIER_BASIC = "basico"
TIER_PRO = "profesional"

# Plan que se aplica durante el acceso gratuito de fundadores y ganadores del sorteo.
COMPLIMENTARY_TIER = TIER_BASIC

# Destacados de 7 días incluidos cada mes natural.
INCLUDED_FEATURES_PER_MONTH = {TIER_BASIC: 4, TIER_PRO: 9}
INCLUDED_FEATURE_DAYS = 7

TIER_RANK = {TIER_PRO: 0, TIER_BASIC: 1, TIER_FREE: 2}


def _aware(value: Optional[datetime]) -> Optional[datetime]:
    if value and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def seller_tier(profile: Optional[Seller_profiles], now: Optional[datetime] = None) -> str:
    if not profile:
        return TIER_FREE
    now = now or datetime.now(timezone.utc)
    if profile.subscription_status == "active":
        return TIER_PRO if profile.plan == TIER_PRO else TIER_BASIC
    free_until = _aware(profile.free_access_until)
    if free_until and free_until > now:
        return COMPLIMENTARY_TIER
    return TIER_FREE


def tier_rank_expression(user_id_column, now: datetime):
    """Subconsulta SQL con el rango del plan del vendedor (0 = Profesional, 1 = Básico, 2 = gratis)."""
    sp = Seller_profiles
    pro_rank, basic_rank, free_rank = TIER_RANK[TIER_PRO], TIER_RANK[TIER_BASIC], TIER_RANK[TIER_FREE]
    complimentary_rank = TIER_RANK[COMPLIMENTARY_TIER]
    rank = (
        select(
            case(
                (and_(sp.subscription_status == "active", sp.plan == TIER_PRO), pro_rank),
                (sp.subscription_status == "active", basic_rank),
                (and_(sp.free_access_until.isnot(None), sp.free_access_until > now), complimentary_rank),
                else_=free_rank,
            )
        )
        .where(sp.user_id == user_id_column)
        .limit(1)
        .scalar_subquery()
    )
    return func.coalesce(rank, free_rank)


async def tiers_for_users(db: AsyncSession, user_ids: Iterable[str]) -> dict[str, str]:
    ids = {uid for uid in user_ids if uid}
    if not ids:
        return {}
    result = await db.execute(select(Seller_profiles).where(Seller_profiles.user_id.in_(ids)))
    now = datetime.now(timezone.utc)
    tiers = {uid: TIER_FREE for uid in ids}
    for profile in result.scalars().all():
        tiers[profile.user_id] = seller_tier(profile, now)
    return tiers


def month_start(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def next_month_start(now: datetime) -> datetime:
    start = month_start(now)
    return start.replace(year=start.year + 1, month=1) if start.month == 12 else start.replace(month=start.month + 1)


async def included_features_used(db: AsyncSession, user_id: str, now: datetime) -> int:
    """Destacados incluidos (importe 0) usados en el mes natural actual."""
    result = await db.execute(
        select(func.count(FeaturePurchases.id)).where(
            FeaturePurchases.seller_user_id == user_id,
            FeaturePurchases.amount_cents == 0,
            FeaturePurchases.created_at >= month_start(now),
        )
    )
    return int(result.scalar() or 0)
