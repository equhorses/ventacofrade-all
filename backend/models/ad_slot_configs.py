from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class AdSlotConfig(Base):
    """Per-slot self-service settings: price and whether external advertisers
    can currently buy it. Separate from HouseAds (the live ad content) so the
    admin can change price/availability without touching what's on screen."""

    __tablename__ = "ad_slot_configs"
    __table_args__ = {"extend_existing": True}

    slot = Column(String(50), primary_key=True)
    price_cents = Column(Integer, nullable=False, default=4999, server_default="4999")
    self_service_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
