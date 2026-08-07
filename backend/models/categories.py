from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Categories(Base):
    __tablename__ = "categories"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    icon = Column(String(50), nullable=True)
    order_index = Column(Integer, nullable=True, default=0, server_default='0')
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)