from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text


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
    plan = Column(String(20), nullable=True)
    cancel_at_period_end = Column(Boolean, nullable=True, default=False, server_default='false')
    activation_paid = Column(Boolean, nullable=True, default=False, server_default='false')
    free_listing_used = Column(Boolean, nullable=True, default=False, server_default='false')
    free_access_until = Column(DateTime(timezone=True), nullable=True)
    stripe_customer_id = Column(String(100), nullable=True)
    stripe_subscription_id = Column(String(100), nullable=True)
    rating = Column(Float, nullable=True, default=0, server_default='0')
    total_sales = Column(Integer, nullable=True, default=0, server_default='0')
    # True si el email de la cuenta ya estaba en la lista de espera antes del
    # lanzamiento — se calcula una vez, al crear el perfil (ver
    # routers/seller_profiles.py::create_seller_profiles), y da derecho a la
    # insignia pública "Fundador".
    is_founder = Column(Boolean, nullable=True, default=False, server_default='false')
    # Contacto directo (visible con plan Profesional).
    whatsapp = Column(String(20), nullable=True)
    website = Column(String(300), nullable=True)
    instagram = Column(String(300), nullable=True)
    facebook = Column(String(300), nullable=True)
    # Modo vacaciones: anuncios pausados temporalmente.
    vacation_mode = Column(Boolean, nullable=True, default=False, server_default='false')
    # Última vez que el vendedor subió un anuncio a mano (límite por plan).
    last_manual_bump_at = Column(DateTime(timezone=True), nullable=True)
    # Mes (AAAA-MM) del último informe mensual enviado, para no duplicarlo.
    last_report_month = Column(String(7), nullable=True)
    # Tienda propia (plan Profesional): /tienda/<shop_slug> con logo, portada y descripción larga.
    shop_slug = Column(String(50), nullable=True, unique=True, index=True)
    shop_logo_url = Column(String(500), nullable=True)
    shop_cover_url = Column(String(500), nullable=True)
    shop_long_description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)
