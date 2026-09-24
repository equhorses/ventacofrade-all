"""Tienda propia del vendedor (plan Profesional): dirección /tienda/<slug>."""

import re
import unicodedata
from typing import Optional

# 3 a 50 caracteres: minúsculas, números y guiones; sin guion al principio ni al final.
SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,48})[a-z0-9]$")
SLUG_MIN, SLUG_MAX = 3, 50
LONG_DESCRIPTION_MAX = 5000

# Nombres que no se pueden reservar como tienda (confusión o suplantación).
RESERVED_SLUGS = {
    "admin", "administrador", "api", "ayuda", "blog", "contacto", "cuenta", "explorar",
    "legal", "login", "nueva", "nuevo", "oficial", "producto", "profesional", "publicar",
    "publicidad", "red-profesional", "soporte", "tienda", "tiendas", "vendedor", "vender",
    "ventacofrade", "venta-cofrade", "www",
}


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    text = re.sub(r"-{2,}", "-", text)
    return text[:SLUG_MAX].strip("-")


def slug_error(slug: str) -> Optional[str]:
    """Mensaje de error para el usuario, o None si la dirección es válida."""
    if not (SLUG_MIN <= len(slug) <= SLUG_MAX):
        return f"La dirección debe tener entre {SLUG_MIN} y {SLUG_MAX} caracteres."
    if not SLUG_RE.match(slug) or "--" in slug:
        return "Usa solo minúsculas, números y guiones (sin guion al principio ni al final)."
    if slug in RESERVED_SLUGS:
        return "Esa dirección está reservada. Elige otra."
    return None
