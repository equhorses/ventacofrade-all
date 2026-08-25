"""Daily background jobs, run in-process via APScheduler (see services/scheduler.py).

Two independent jobs live here:
  - check_raffle_deadlines: reminds / revokes raffle winners who haven't
    published a real listing within 15 days of their prize activating.
  - check_renewal_reminders: emails sellers 7 days before their subscription
    auto-renews.

Both are defensive: any single row failing (bad email config, etc.) is logged
and skipped rather than aborting the whole run.
"""
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func

from core.database import db_manager
from models.invitations import Invitation
from models.seller_profiles import Seller_profiles
from models.products import Products
from models.renewal_reminders import RenewalReminderSent
from services.email import (
    send_raffle_deadline_reminder_email,
    send_raffle_prize_revoked_email,
    send_subscription_renewal_reminder_email,
)
from services.audit import log_admin_action

logger = logging.getLogger(__name__)

RAFFLE_SOURCE = "sorteo_instagram"
PUBLISH_DEADLINE_DAYS = 15
REMINDER_BEFORE_DEADLINE_DAYS = 3
RENEWAL_REMINDER_DAYS_BEFORE = 7


async def _has_published_real_listing(db, user_id: str, since: datetime) -> bool:
    result = await db.execute(
        select(func.count()).select_from(Products).where(
            Products.user_id == user_id, Products.created_at >= since
        )
    )
    return (result.scalar() or 0) > 0


async def check_raffle_deadlines() -> None:
    """For every activated, unrevoked raffle invitation: send a reminder a few
    days before the 15-day publish deadline, and revoke the prize if the
    deadline passes with no real listing published."""
    if not db_manager.async_session_maker:
        await db_manager.ensure_initialized()
    async with db_manager.async_session_maker() as db:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(Invitation).where(
                Invitation.source == RAFFLE_SOURCE,
                Invitation.status == "redeemed",
                Invitation.activated_at.isnot(None),
                Invitation.revoked_at.is_(None),
            )
        )
        invitations = result.scalars().all()

        for invitation in invitations:
            activated_at = invitation.activated_at
            if activated_at.tzinfo is None:
                activated_at = activated_at.replace(tzinfo=timezone.utc)

            if not invitation.redeemed_by_user_id:
                continue

            try:
                published = await _has_published_real_listing(db, invitation.redeemed_by_user_id, activated_at)
            except Exception:
                logger.exception("Error comprobando anuncios publicados para invitacion %s", invitation.id)
                continue

            if published:
                continue

            deadline = activated_at + timedelta(days=PUBLISH_DEADLINE_DAYS)
            reminder_at = deadline - timedelta(days=REMINDER_BEFORE_DEADLINE_DAYS)

            if now >= deadline:
                seller_result = await db.execute(
                    select(Seller_profiles).where(Seller_profiles.user_id == invitation.redeemed_by_user_id)
                )
                seller = seller_result.scalar_one_or_none()
                if seller:
                    seller.free_access_until = now
                invitation.revoked_at = now
                await db.commit()

                sent = await send_raffle_prize_revoked_email(to_email=invitation.email)
                if not sent:
                    logger.warning("No se pudo enviar email de revocacion a %s", invitation.email)
                await log_admin_action(
                    db, None, "system", "revoke_raffle_prize",
                    target=invitation.email, details="15 dias sin publicar un anuncio real",
                )
                logger.info("Premio de sorteo revocado para %s (invitacion %s)", invitation.email, invitation.id)

            elif now >= reminder_at and invitation.deadline_reminder_sent_at is None:
                sent = await send_raffle_deadline_reminder_email(to_email=invitation.email, deadline=deadline)
                if sent:
                    invitation.deadline_reminder_sent_at = now
                    await db.commit()
                else:
                    logger.warning("No se pudo enviar recordatorio de plazo a %s", invitation.email)


async def check_renewal_reminders() -> None:
    """Emails sellers whose active, auto-renewing subscription will charge
    them again in exactly RENEWAL_REMINDER_DAYS_BEFORE days."""
    if not db_manager.async_session_maker:
        await db_manager.ensure_initialized()
    async with db_manager.async_session_maker() as db:
        target_date = (datetime.now(timezone.utc) + timedelta(days=RENEWAL_REMINDER_DAYS_BEFORE)).date()

        result = await db.execute(
            select(Seller_profiles).where(
                Seller_profiles.subscription_status == "active",
                Seller_profiles.cancel_at_period_end.is_(False),
                Seller_profiles.subscription_end_date.isnot(None),
            )
        )
        sellers = result.scalars().all()

        for seller in sellers:
            end_date = seller.subscription_end_date
            if end_date.tzinfo is None:
                end_date = end_date.replace(tzinfo=timezone.utc)

            if end_date.date() != target_date:
                continue

            already_sent = await db.execute(
                select(RenewalReminderSent).where(
                    RenewalReminderSent.seller_profile_id == seller.id,
                    RenewalReminderSent.subscription_end_date == seller.subscription_end_date,
                )
            )
            if already_sent.scalar_one_or_none():
                continue

            from models.auth import User
            user_result = await db.execute(select(User).where(User.id == seller.user_id))
            user = user_result.scalar_one_or_none()
            if not user or not user.email:
                continue

            sent = await send_subscription_renewal_reminder_email(
                to_email=user.email, plan=seller.plan or "basico", renewal_date=end_date
            )
            if sent:
                db.add(RenewalReminderSent(
                    seller_profile_id=seller.id, subscription_end_date=seller.subscription_end_date,
                ))
                await db.commit()
            else:
                logger.warning("No se pudo enviar recordatorio de renovacion a %s", user.email)


async def run_daily_jobs() -> None:
    """Entry point called by the scheduler once a day."""
    try:
        await check_raffle_deadlines()
    except Exception:
        logger.exception("Fallo en check_raffle_deadlines")

    try:
        await check_renewal_reminders()
    except Exception:
        logger.exception("Fallo en check_renewal_reminders")
