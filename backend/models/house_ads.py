from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class HouseAds(Base):
    """Ad banners VentaCofrade controls directly (not through AdSense) —
    one per named 'slot' (a spot reserved in the UI, e.g. 'home_top')."""
    __tablename__ = "house_ads"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    slot = Column(String(50), nullable=False, unique=True, index=True)
    title = Column(String(200), nullable=False)
    image_url = Column(String, nullable=False)
    link_url = Column(String, nullable=False)
    active = Column(Boolean, nullable=True, default=True, server_default='true')
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
