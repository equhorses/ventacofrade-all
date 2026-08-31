from models.base import Base
from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func


class User(Base):
    __tablename__ = "users"

    id = Column(String(255), primary_key=True, index=True)  # Use platform sub as primary key
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=True)  # Null for legacy OIDC-created accounts
    name = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    role = Column(String(50), default="user", nullable=False)  # user/admin
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    age_confirmed_at = Column(DateTime(timezone=True), nullable=True)  # self-declared 18+ at signup
    account_status = Column(String(20), default="active", nullable=False)  # active/suspended/pending_deletion
    deletion_reasons = Column(String(500), nullable=True)  # comma-separated survey options
    deletion_feedback = Column(Text, nullable=True)  # free-text feedback
    suspended_at = Column(DateTime(timezone=True), nullable=True)
    deletion_requested_at = Column(DateTime(timezone=True), nullable=True)
    scheduled_purge_at = Column(DateTime(timezone=True), nullable=True)
