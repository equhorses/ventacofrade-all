from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String


class Products(Base):
    __tablename__ = "products"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(String, nullable=True)
    price = Column(Float, nullable=False)
    category_id = Column(Integer, nullable=False)
    condition = Column(String(20), nullable=False)
    location_province = Column(String(100), nullable=False)
    location_city = Column(String(100), nullable=True)
    images = Column(String, nullable=True)
    status = Column(String(20), nullable=True, default='active', server_default='active')
    views_count = Column(Integer, nullable=True, default=0, server_default='0')
    is_featured = Column(Boolean, nullable=True, default=False, server_default='false')
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)