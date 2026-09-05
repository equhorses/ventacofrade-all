"""Daily background jobs, run in-process via APScheduler (see services/scheduler.py).

Jobs living here:
  - check_raffle_deadlines: reminds / revokes raffle winners who haven't
    published a real listing within 15 days of their prize activating.
  - check_renewal_reminders: emails sellers 7 days before their subscription
    auto-renews.
  - check_ad_bookings: expires ad slot bookings past their 30 days.
  - check_launch_announcement: emails everyone still on the waitlist once
    the platform's launch date is reached.
  - purge_scheduled_account_deletions: permanently erases accounts whose
    5-year retention window (after a self-service deletion request) is up.

All are defensive: any single row failing (bad email config, etc.) is logged
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
from models.waitlist import Waitlist
from services.email import (
    send_raffle_deadline_reminder_email,
    send_raffle_prize_revoked_email,
    send_subscription_renewal_reminder_email,
    send_launch_announcement_email,
)
from services.audit import log_admin_action
from services.house_ad_bookings import AdBookingsService
from services.platform_settings import get_launch_at
from services.user import purge_user_completely

logger = logging.getLogger(__name__)

RAFFLE_SOURCE = "sorteo_instagram"
WAITLIST_LAUNCH_SOURCE = "lista_espera_lanzamiento"
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
    """For every activated, unrevoked raffle OR waitlist-launch invitation:
    send a reminder a few days before the 15-day publish deadline, and revoke
    the free access if the deadline passes with no real listing published."""
    if not db_manager.async_session_maker:
        await db_manager.ensure_initialized()
    async with db_manager.async_session_maker() as db:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(Invitation).where(
                Invitation.source.in_([RAFFLE_SOURCE, WAITLIST_LAUNCH_SOURCE]),
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


async def check_ad_bookings() -> None:
    """Expire ad slot bookings past their 30 days, and promote the next
    queued advertiser (if any) into the freed-up slot."""
    if not db_manager.async_session_maker:
        await db_manager.ensure_initialized()
    async with db_manager.async_session_maker() as db:
        service = AdBookingsService(db)
        await service.expire_and_promote()


async def check_launch_announcement() -> None:
    """The day the platform's launch date is reached (or any day after, if
    this runs late), email everyone still on the waitlist to let them know
    it's open. Runs once per person — tracked via Waitlist.launch_email_sent_at
    so touching the launch date again later doesn't re-send anything."""
    if not db_manager.async_session_maker:
        await db_manager.ensure_initialized()
    async with db_manager.async_session_maker() as db:
        launch_at = await get_launch_at(db)
        if launch_at is None:
            return

        now = datetime.now(timezone.utc)
        if now < launch_at:
            return

        result = await db.execute(
            select(Waitlist).where(Waitlist.launch_email_sent_at.is_(None))
        )
        entries = result.scalars().all()

        for entry in entries:
            sent = await send_launch_announcement_email(to_email=entry.email)
            if sent:
                entry.launch_email_sent_at = now
                await db.commit()
            else:
                logger.warning("No se pudo enviar email de lanzamiento a %s", entry.email)


async def purge_scheduled_account_deletions() -> None:
    """Permanently erase accounts that requested self-service deletion once
    their retention window (scheduled_purge_at, set 5 years out at request
    time — see services/user.py) has passed. Runs daily; most days this finds
    nothing to do."""
    from models.auth import User

    if not db_manager.async_session_maker:
        await db_manager.ensure_initialized()
    async with db_manager.async_session_maker() as db:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(User).where(
                User.account_status == "pending_deletion",
                User.scheduled_purge_at.isnot(None),
                User.scheduled_purge_at <= now,
            )
        )
        users = result.scalars().all()

        for user in users:
            user_id = user.id
            try:
                deleted_email = await purge_user_completely(db, user_id)
            except Exception:
                logger.exception("Error purgando la cuenta %s tras cumplirse su plazo", user_id)
                continue

            if deleted_email:
                await log_admin_action(
                    db, None, "system", "purge_scheduled_deletion",
                    target=deleted_email,
                    details="Purga automatica tras 5 años desde la solicitud de baja",
                )
                logger.info("Cuenta %s purgada automaticamente (plazo de 5 anios cumplido)", deleted_email)


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

    try:
        await check_ad_bookings()
    except Exception:
        logger.exception("Fallo en check_ad_bookings")

    try:
        await check_launch_announcement()
    except Exception:
        logger.exception("Fallo en check_launch_announcement")

    try:
        await purge_scheduled_account_deletions()
    except Exception:
        logger.exception("Fallo en purge_scheduled_account_deletions")
