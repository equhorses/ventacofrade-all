from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class AdBooking(Base):
    """One purchase/reservation of a house-ad slot by an external advertiser.

    Lifecycle: pending_payment -> pending_approval -> (active | queued) -> expired
    or pending_approval -> rejected.

    'queued' means paid + approved, but the slot is currently taken by
    another active booking; the daily scheduled job promotes the oldest
    queued booking to active once the current one expires.
    """

    __tablename__ = "ad_bookings"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    slot = Column(String(50), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    advertiser_name = Column(String(200), nullable=False)
    advertiser_email = Column(String(255), nullable=False)
    title = Column(String(200), nullable=False)
    image_url = Column(String, nullable=False)
    link_url = Column(String, nullable=False)
    amount_cents = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="pending_payment", server_default="pending_payment")
    stripe_session_id = Column(String(200), nullable=True)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(String, nullable=True)
    rejected_reason = Column(String, nullable=True)
