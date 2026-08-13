from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String


class Seller_profiles(Base):
    __tablename__ = "seller_profiles"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    shop_name = Column(String(200), nullable=False)
    shop_description = Column(String, nullable=True)
    province = Column(String(100), nullable=False)
    city = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, nullable=True, default=False, server_default='false')
    subscription_status = Column(String(20), nullable=True, default='inactive', server_default='inactive')
    subscription_end_date = Column(DateTime(timezone=True), nullable=True)
    activation_paid = Column(Boolean, nullable=True, default=False, server_default='false')
    stripe_customer_id = Column(String(100), nullable=True)
    stripe_subscription_id = Column(String(100), nullable=True)
    rating = Column(Float, nullable=True, default=0, server_default='0')
    total_sales = Column(Integer, nullable=True, default=0, server_default='0')
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
