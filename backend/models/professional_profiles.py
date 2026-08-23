from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text


class ProfessionalProfiles(Base):
    """A professional's profile in the 'Red Profesional' directory —
    bordadores, orfebres, restauradores, etc. offering services, distinct
    from the buy/sell seller_profiles. Free to activate for now (activation_paid
    defaults to true / unchecked), but the column is in place for a future
    paid activation without needing another migration."""
    __tablename__ = "professional_profiles"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False, index=True)
    business_name = Column(String(200), nullable=False)
    specialty = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    province = Column(String(100), nullable=False)
    city = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    whatsapp = Column(String(20), nullable=True)
    portfolio_images = Column(Text, nullable=True)
    activation_paid = Column(Boolean, nullable=True, default=True, server_default='true')
    is_active = Column(Boolean, nullable=True, default=True, server_default='true')
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
