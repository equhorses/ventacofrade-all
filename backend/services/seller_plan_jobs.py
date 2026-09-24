"""Tareas programadas de las ventajas de los planes:
  - Subida automática semanal de los anuncios de vendedores Profesional.
  - Informe mensual por email para vendedores con plan (día 1 de cada mes).
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, or_, select

from core.database import db_manager
from models.auth import User
from models.favorites import Favorites
from models.messages import Messages
from models.products import Products
from models.seller_profiles import Seller_profiles
from services.email import send_monthly_report_email
from services.seller_plans import (
    AUTO_BUMP_AFTER,
    INCLUDED_FEATURES_PER_MONTH,
    TIER_FREE,
    TIER_PRO,
    admin_user_ids,
    month_start,
    seller_tier,
)

logger = logging.getLogger(__name__)

MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
             "septiembre", "octubre", "noviembre", "diciembre"]


async def _session():
    if not db_manager.async_session_maker:
        await db_manager.ensure_initialized()
    return db_manager.async_session_maker()


async def auto_bump_pro_listings(now: Optional[datetime] = None) -> int:
    """Sube los anuncios activos de vendedores Profesional que llevan una semana sin subir."""
    now = now or datetime.now(timezone.utc)
    threshold = now - AUTO_BUMP_AFTER
    bumped = 0
    async with await _session() as db:
        profiles = (await db.execute(select(Seller_profiles))).scalars().all()
        admins = await admin_user_ids(db)
        pro_users = [p.user_id for p in profiles if p.user_id in admins or seller_tier(p, now) == TIER_PRO]
        if not pro_users:
            return 0
        products = (
            await db.execute(
                select(Products).where(
                    Products.user_id.in_(pro_users),
                    Products.status == "active",
                    func.coalesce(Products.bumped_at, Products.created_at) < threshold,
                )
            )
        ).scalars().all()
        for p in products:
            p.bumped_at = now
            bumped += 1
        await db.commit()
    logger.info("Subida automática semanal (Profesional): %d anuncios", bumped)
    return bumped


def _previous_month(now: datetime) -> tuple[datetime, datetime, str]:
    this_month = month_start(now)
    prev_end = this_month
    prev_start = this_month.replace(year=this_month.year - 1, month=12) if this_month.month == 1 else this_month.replace(month=this_month.month - 1)
    return prev_start, prev_end, MONTHS_ES[prev_start.month - 1]


async def send_monthly_reports(now: Optional[datetime] = None) -> int:
    """Envía el resumen del mes anterior a cada vendedor con plan. No duplica envíos."""
    now = now or datetime.now(timezone.utc)
    report_key = now.strftime("%Y-%m")
    prev_start, prev_end, month_label = _previous_month(now)
    sent = 0
    async with await _session() as db:
        profiles = (await db.execute(select(Seller_profiles))).scalars().all()
        admins = await admin_user_ids(db)
        for profile in profiles:
            tier = TIER_PRO if profile.user_id in admins else seller_tier(profile, now)
            if tier == TIER_FREE or profile.last_report_month == report_key:
                continue
            user = (await db.execute(select(User).where(User.id == profile.user_id))).scalar_one_or_none()
            if not user or user.account_status != "active":
                continue
            products = (await db.execute(select(Products).where(Products.user_id == profile.user_id))).scalars().all()
            if not products:
                continue
            ids = [p.id for p in products]
            new_favorites = (
                await db.execute(
                    select(func.count(Favorites.id)).where(
                        Favorites.product_id.in_(ids), Favorites.created_at >= prev_start, Favorites.created_at < prev_end
                    )
                )
            ).scalar() or 0
            new_contacts = None
            if tier == TIER_PRO:
                new_contacts = (
                    await db.execute(
                        select(func.count(func.distinct(Messages.user_id))).where(
                            Messages.product_id.in_(ids),
                            Messages.receiver_id == profile.user_id,
                            Messages.created_at >= prev_start,
                            Messages.created_at < prev_end,
                        )
                    )
                ).scalar() or 0
            top = max(products, key=lambda p: p.views_count or 0)
            ok = await send_monthly_report_email(
                to_email=user.email,
                name=user.name,
                plan=tier,
                month_label=month_label,
                active_listings=sum(1 for p in products if (p.status or "active") == "active"),
                total_views=sum(p.views_count or 0 for p in products),
                new_favorites=int(new_favorites),
                new_contacts=int(new_contacts) if new_contacts is not None else None,
                included_features=INCLUDED_FEATURES_PER_MONTH.get(tier, 0),
                top_listing=(top.title, top.views_count or 0) if (top.views_count or 0) > 0 else None,
            )
            if ok:
                profile.last_report_month = report_key
                await db.commit()
                sent += 1
            await asyncio.sleep(0.6)
    logger.info("Informes mensuales enviados: %d", sent)
    return sent
