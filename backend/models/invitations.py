from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Invitation(Base):
    __tablename__ = "invitations"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    email = Column(String(255), nullable=False, index=True)
    token = Column(String(64), nullable=False, unique=True, index=True)
    months = Column(Integer, nullable=False, default=1, server_default='1')
    status = Column(String(20), nullable=False, default='pending', server_default='pending')
    invited_by = Column(String, nullable=True)
    redeemed_by_user_id = Column(String, nullable=True)
    redeemed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
