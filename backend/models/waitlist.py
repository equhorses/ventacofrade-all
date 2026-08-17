from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Waitlist(Base):
    __tablename__ = "waitlist"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
