from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class FeaturePurchases(Base):
    """A record of each successful one-time payment to feature a listing —
    kept separately from Products.featured_until (which only tracks the
    current expiry) so admin can see real revenue history over time."""
    __tablename__ = "feature_purchases"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    product_id = Column(Integer, nullable=False, index=True)
    seller_user_id = Column(String, nullable=False, index=True)
    days = Column(Integer, nullable=False)
    amount_cents = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
