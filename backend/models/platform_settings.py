from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class PlatformSettings(Base):
    """Single-row table (id=1) holding site-wide settings that are edited by
    hand from the admin panel, not via env vars.

    launch_at: the real date VentaCofrade opened to the public. Used to make
    sure raffle winners' free-access period doesn't start counting before the
    platform is actually usable (see services/platform_settings.py).
    """

    __tablename__ = "platform_settings"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=False, nullable=False)
    launch_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)
    updated_by = Column(String, nullable=True)
