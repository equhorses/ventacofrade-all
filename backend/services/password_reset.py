"""Enlaces para restablecer la contraseña, sin tablas nuevas.

El token lleva el id del usuario, la fecha de caducidad y una "huella" de su
contraseña actual, firmado con JWT_SECRET_KEY. Al cambiar la contraseña la
huella cambia, así que cada enlace sirve una sola vez.
"""

import base64
import hashlib
import hmac
import time
from typing import Optional

from core.config import settings

RESET_TTL_SECONDS = 60 * 60  # 1 hora


def _secret() -> bytes:
    key = getattr(settings, "jwt_secret_key", None)
    if not key:
        raise RuntimeError("JWT_SECRET_KEY no configurado")
    return f"reset:{key}".encode()


def _fingerprint(password_hash: Optional[str]) -> str:
    return hashlib.sha256((password_hash or "sin-contrasena").encode()).hexdigest()[:16]


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def make_token(user_id: str, password_hash: Optional[str], now: Optional[float] = None) -> str:
    expires = int((now or time.time()) + RESET_TTL_SECONDS)
    payload = f"{user_id}|{expires}|{_fingerprint(password_hash)}".encode()
    signature = hmac.new(_secret(), payload, hashlib.sha256).digest()
    return f"{_b64(payload)}.{_b64(signature)}"


def read_token(token: str, now: Optional[float] = None) -> Optional[tuple[str, str]]:
    """Devuelve (user_id, huella) si el token es auténtico y no ha caducado."""
    try:
        payload_b64, signature_b64 = token.strip().split(".", 1)
        payload = _unb64(payload_b64)
        expected = hmac.new(_secret(), payload, hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _unb64(signature_b64)):
            return None
        user_id, expires, fingerprint = payload.decode().split("|")
        if int(expires) < (now or time.time()):
            return None
        return user_id, fingerprint
    except (ValueError, UnicodeDecodeError):
        return None


def matches_current_password(fingerprint: str, password_hash: Optional[str]) -> bool:
    return hmac.compare_digest(fingerprint, _fingerprint(password_hash))
