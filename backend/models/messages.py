from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class Messages(Base):
    __tablename__ = "messages"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    receiver_id = Column(String, nullable=False)
    product_id = Column(Integer, nullable=False)
    content = Column(String, nullable=False)
    is_read = Column(Boolean, nullable=True, default=False, server_default='false')
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)