from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint


class Reviews(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint('seller_profile_id', 'reviewer_user_id', name='uq_review_seller_reviewer'),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    seller_profile_id = Column(Integer, nullable=False, index=True)
    reviewer_user_id = Column(String, nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
