from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer


class RenewalReminderSent(Base):
    """One row per (seller_profile, subscription_end_date) reminder already sent.

    Keying the dedup on subscription_end_date (not just seller_profile_id) means
    we never need to reset a flag when a subscription renews — the next period
    has a new end date, so it naturally gets its own reminder.
    """

    __tablename__ = "renewal_reminders_sent"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    seller_profile_id = Column(Integer, nullable=False, index=True)
    subscription_end_date = Column(DateTime(timezone=True), nullable=False)
    sent_at = Column(DateTime(timezone=True), default=datetime.now)
