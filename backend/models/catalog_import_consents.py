from core.database import Base
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, String, Text


class CatalogImportConsent(Base):
    """Autorización de un vendedor para que VentaCofrade traiga sus anuncios de otra plataforma.

    Se pide por el mensajero y el vendedor la acepta marcando una casilla. Queda guardado el texto
    exacto que aceptó, cuándo, desde qué IP y con qué navegador.
    """
    __tablename__ = "catalog_import_consents"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False, index=True)
    email = Column(String(255), nullable=False)
    source_key = Column(String(255), nullable=False, index=True)  # p. ej. "todocoleccion:minick"
    source_url = Column(String(500), nullable=False)
    consent_text = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending | accepted | revoked
    requested_by_email = Column(String(255), nullable=True)
    message_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    accepted_ip = Column(String(100), nullable=True)
    accepted_user_agent = Column(String(500), nullable=True)
