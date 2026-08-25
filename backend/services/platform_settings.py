import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.platform_settings import PlatformSettings
from models.invitations import Invitation
from models.seller_profiles import Seller_profiles
from services.email import send_raffle_prize_activated_email

logger = logging.getLogger(__name__)

RAFFLE_SOURCE = "sorteo_instagram"
RAFFLE_PUBLISH_DEADLINE_DAYS = 15


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


async def get_launch_at(db: AsyncSession) -> Optional[datetime]:
    """Returns the platform's real public launch date, or None if it hasn't
    been set yet (i.e. we're still pre-launch)."""
    result = await db.execute(select(PlatformSettings).where(PlatformSettings.id == 1))
    row = result.scalar_one_or_none()
    return _aware(row.launch_at) if row else None


async def set_launch_at(db: AsyncSession, launch_at: Optional[datetime], updated_by: str) -> PlatformSettings:
    """Sets the launch date. If this is the first time it's set (or it changes
    from unset to set), also activates any raffle winners who redeemed their
    invitation before launch and were waiting for their free-access clock to
    start."""
    result = await db.execute(select(PlatformSettings).where(PlatformSettings.id == 1))
    row = result.scalar_one_or_none()
    was_unset = row is None or row.launch_at is None

    if row is None:
        row = PlatformSettings(id=1)
        db.add(row)

    row.launch_at = launch_at
    row.updated_at = datetime.now(timezone.utc)
    row.updated_by = updated_by
    await db.commit()
    await db.refresh(row)

    if was_unset and launch_at is not None:
        await activate_pending_raffle_winners(db, launch_at)

    return row


async def activate_pending_raffle_winners(db: AsyncSession, launch_at: datetime) -> int:
    """Finds raffle invitations that were redeemed before the platform launched
    (activated_at still null) and starts their free-access clock from the real
    launch date, then emails them that their prize is now active.

    Returns how many winners were activated.
    """
    launch_at = _aware(launch_at)
    result = await db.execute(
        select(Invitation).where(
            Invitation.source == RAFFLE_SOURCE,
            Invitation.status == "redeemed",
            Invitation.activated_at.is_(None),
            Invitation.revoked_at.is_(None),
        )
    )
    invitations = result.scalars().all()

    activated = 0
    for invitation in invitations:
        invitation.activated_at = launch_at

        seller_result = await db.execute(
            select(Seller_profiles).where(Seller_profiles.user_id == invitation.redeemed_by_user_id)
        )
        seller = seller_result.scalar_one_or_none()
        if seller:
            seller.free_access_until = launch_at + timedelta(days=30 * invitation.months)

        deadline = launch_at + timedelta(days=RAFFLE_PUBLISH_DEADLINE_DAYS)
        sent = await send_raffle_prize_activated_email(to_email=invitation.email, deadline=deadline)
        if not sent:
            logger.warning("No se pudo enviar email de activacion de premio a %s", invitation.email)
        activated += 1

    if activated:
        await db.commit()
        logger.info("Activados %d ganadores del sorteo tras fijar fecha de lanzamiento", activated)

    return activated
