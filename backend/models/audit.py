from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text


class AuditLog(Base):
    """One row per sensitive action taken by staff (ban, invite, role change...).
    This is the answer to 'who did what, and when'."""
    __tablename__ = "audit_log"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    actor_id = Column(String, nullable=True)
    actor_email = Column(String(255), nullable=True)
    action = Column(String(100), nullable=False)
    target = Column(String(255), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class LoginAttempt(Base):
    """One row per login attempt (password or Google), success or failure.
    This is the login history / security signal."""
    __tablename__ = "login_attempts"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    email = Column(String(255), nullable=False, index=True)
    method = Column(String(20), nullable=False)  # "password" | "google"
    success = Column(Boolean, nullable=False)
    reason = Column(String(255), nullable=True)  # e.g. "wrong_password", "banned"
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
