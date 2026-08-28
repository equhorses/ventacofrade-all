from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Waitlist(Base):
    __tablename__ = "waitlist"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    # When we sent the "ya hemos abierto" launch announcement email. NULL
    # means "not sent yet" — set once by the daily job, see
    # services/scheduled_jobs.py::check_launch_announcement.
    launch_email_sent_at = Column(DateTime(timezone=True), nullable=True)
