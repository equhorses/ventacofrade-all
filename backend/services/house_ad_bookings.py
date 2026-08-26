"""
Self-service house-ad slot bookings: an external advertiser pays for a
30-day slot, then an admin approves the creative before it goes live. If the
slot is already occupied by another active booking, the paid+approved one
waits in a queue and is promoted automatically once the slot frees up.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import stripe
from core.config import settings
from models.ad_bookings import AdBooking
from models.ad_slot_configs import AdSlotConfig
from models.house_ads import HouseAds
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

BOOKING_DURATION_DAYS = 30


class AdBookingsNotConfiguredError(RuntimeError):
    pass


class AdBookingsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _ensure_stripe_configured(self):
        secret_key = getattr(settings, "stripe_secret_key", None)
        if not secret_key:
            raise AdBookingsNotConfiguredError("STRIPE_SECRET_KEY no está configurada.")
        stripe.api_key = secret_key

    async def get_slot_config(self, slot: str) -> Optional[AdSlotConfig]:
        result = await self.db.execute(select(AdSlotConfig).where(AdSlotConfig.slot == slot))
        return result.scalar_one_or_none()

    async def get_active_booking(self, slot: str) -> Optional[AdBooking]:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(AdBooking).where(
                AdBooking.slot == slot, AdBooking.status == "active", AdBooking.ends_at > now
            )
        )
        return result.scalar_one_or_none()

    async def get_queue_length(self, slot: str) -> int:
        result = await self.db.execute(
            select(AdBooking).where(AdBooking.slot == slot, AdBooking.status == "queued")
        )
        return len(result.scalars().all())

    async def create_booking_checkout(
        self,
        slot: str,
        user_id: str,
        advertiser_name: str,
        advertiser_email: str,
        title: str,
        image_url: str,
        link_url: str,
        success_url: str,
        cancel_url: str,
    ) -> str:
        config = await self.get_slot_config(slot)
        if not config:
            raise ValueError("Hueco publicitario no válido.")
        if not config.self_service_enabled:
            raise ValueError("Este hueco no está disponible para compra en este momento.")

        self._ensure_stripe_configured()

        booking = AdBooking(
            slot=slot,
            user_id=user_id,
            advertiser_name=advertiser_name.strip(),
            advertiser_email=advertiser_email.strip().lower(),
            title=title.strip(),
            image_url=image_url.strip(),
            link_url=link_url.strip(),
            amount_cents=config.price_cents,
            status="pending_payment",
        )
        self.db.add(booking)
        await self.db.commit()
        await self.db.refresh(booking)

        session = await stripe.checkout.Session.create_async(
            mode="payment",
            customer_email=advertiser_email,
            line_items=[
                {
                    "price_data": {
                        "currency": "eur",
                        "product_data": {"name": f"Hueco publicitario: {slot} (30 días)"},
                        "unit_amount": config.price_cents,
                    },
                    "quantity": 1,
                }
            ],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"purpose": "house_ad_booking", "booking_id": str(booking.id)},
        )
        booking.stripe_session_id = session.id
        await self.db.commit()
        return session.url

    async def handle_booking_payment_completed(self, session) -> None:
        metadata = getattr(session, "metadata", None)
        booking_id = getattr(metadata, "booking_id", None) if metadata else None
        if not booking_id:
            logger.warning("house_ad_booking checkout completed without booking_id metadata; ignoring.")
            return

        result = await self.db.execute(select(AdBooking).where(AdBooking.id == int(booking_id)))
        booking = result.scalar_one_or_none()
        if not booking:
            logger.warning(f"AdBooking {booking_id} not found for payment completion.")
            return
        if booking.status != "pending_payment":
            return  # already processed (webhook retry)

        booking.status = "pending_approval"
        await self.db.commit()
        logger.info(f"AdBooking {booking.id} paid, awaiting admin approval.")

    async def _activate_booking(self, booking: AdBooking) -> None:
        now = datetime.now(timezone.utc)
        booking.status = "active"
        booking.starts_at = now
        booking.ends_at = now + timedelta(days=BOOKING_DURATION_DAYS)

        result = await self.db.execute(select(HouseAds).where(HouseAds.slot == booking.slot))
        ad = result.scalar_one_or_none()
        if ad:
            ad.title = booking.title
            ad.image_url = booking.image_url
            ad.link_url = booking.link_url
            ad.active = True
        else:
            self.db.add(
                HouseAds(
                    slot=booking.slot, title=booking.title, image_url=booking.image_url,
                    link_url=booking.link_url, active=True,
                )
            )

    async def approve_booking(self, booking_id: int, admin_id: str) -> AdBooking:
        result = await self.db.execute(select(AdBooking).where(AdBooking.id == booking_id))
        booking = result.scalar_one_or_none()
        if not booking:
            raise ValueError("Reserva no encontrada.")
        if booking.status != "pending_approval":
            raise ValueError("Esta reserva no está pendiente de aprobación.")

        booking.approved_at = datetime.now(timezone.utc)
        booking.approved_by = admin_id

        active_booking = await self.get_active_booking(booking.slot)
        if active_booking:
            booking.status = "queued"
        else:
            await self._activate_booking(booking)

        await self.db.commit()
        await self.db.refresh(booking)
        return booking

    async def reject_booking(self, booking_id: int, admin_id: str, reason: str) -> AdBooking:
        result = await self.db.execute(select(AdBooking).where(AdBooking.id == booking_id))
        booking = result.scalar_one_or_none()
        if not booking:
            raise ValueError("Reserva no encontrada.")
        if booking.status != "pending_approval":
            raise ValueError("Esta reserva no está pendiente de aprobación.")

        booking.status = "rejected"
        booking.rejected_reason = reason
        booking.approved_by = admin_id
        booking.approved_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(booking)
        return booking

    async def expire_and_promote(self) -> None:
        """Daily job: expire active bookings past their end date, then
        promote the oldest queued booking (if any) for each freed-up slot."""
        now = datetime.now(timezone.utc)

        result = await self.db.execute(
            select(AdBooking).where(AdBooking.status == "active", AdBooking.ends_at <= now)
        )
        expired = result.scalars().all()

        freed_slots = set()
        for booking in expired:
            booking.status = "expired"
            freed_slots.add(booking.slot)

        if expired:
            await self.db.commit()

        for slot in freed_slots:
            still_active = await self.get_active_booking(slot)
            if still_active:
                continue

            queue_result = await self.db.execute(
                select(AdBooking)
                .where(AdBooking.slot == slot, AdBooking.status == "queued")
                .order_by(AdBooking.approved_at.asc())
            )
            next_booking = queue_result.scalars().first()
            if next_booking:
                await self._activate_booking(next_booking)
                await self.db.commit()
                logger.info(f"Promoted queued AdBooking {next_booking.id} to active for slot {slot}.")
            else:
                # Nobody waiting — turn off the slot instead of leaving stale content up.
                ad_result = await self.db.execute(select(HouseAds).where(HouseAds.slot == slot))
                ad = ad_result.scalar_one_or_none()
                if ad:
                    ad.active = False
                    await self.db.commit()
