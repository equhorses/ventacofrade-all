from core.database import Base
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, String, Text


class UserEvent(Base):
    """Momentos en los que alguien se puede atascar (empezar a publicar, fallar una foto,
    un error del servidor...). Sirve para ver quién necesita ayuda desde el panel de admin."""
    __tablename__ = "user_events"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=True, index=True)
    email = Column(String(255), nullable=True, index=True)
    kind = Column(String(50), nullable=False, index=True)
    detail = Column(Text, nullable=True)
    path = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
