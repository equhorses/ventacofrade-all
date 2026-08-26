import hashlib
import logging
from typing import Optional

from core.auth import AccessTokenError, decode_access_token
from core.database import get_db
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from models.auth import User
from schemas.auth import UserResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


async def get_bearer_token(
    request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> str:
    """Extract bearer token from Authorization header."""
    if credentials and credentials.scheme.lower() == "bearer":
        return credentials.credentials

    logger.debug("Authentication required for request %s %s", request.method, request.url.path)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication credentials were not provided")


async def get_current_user(
    token: str = Depends(get_bearer_token),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Dependency to get the current authenticated user.

    The JWT only proves *who* the person is (via the 'sub' claim) — it's
    intentionally not the source of truth for mutable profile fields like
    name or avatar_url, since those can change between login sessions
    (which last up to an hour) and a stale JWT should never mask a fresh
    profile update. So this always re-reads the current row from the
    database rather than trusting whatever was baked into the token when
    it was issued.
    """
    try:
        payload = decode_access_token(token)
    except AccessTokenError as exc:
        # Log error type only, not the full exception which may contain sensitive token data
        logger.warning("Token validation failed: %s", type(exc).__name__)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=exc.message)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        # Token is otherwise valid but the account no longer exists (e.g. an
        # admin deleted it) — treat exactly like an invalid session.
        user_hash = hashlib.sha256(str(user_id).encode()).hexdigest()[:8]
        logger.warning("Valid token for a user that no longer exists (hash: %s)", user_hash)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")

    if user.account_status == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta ha sido suspendida por el equipo de VentaCofrade. Contacta con soporte.",
        )

    return UserResponse.model_validate(user)


async def get_admin_user(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    """Dependency to ensure current user is the super admin ('admin' role).
    Reserved for the most sensitive actions: assigning roles to other people,
    and anything not explicitly opened up to other staff roles."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


# All non-customer roles that can see the internal admin panel at all.
# "admin" here means super admin (top of the hierarchy, can assign roles).
STAFF_ROLES = {"admin", "marketing", "seguridad", "moderacion", "soporte"}

ROLE_LABELS = {
    "admin": "Super admin",
    "marketing": "Marketing",
    "seguridad": "Seguridad",
    "moderacion": "Moderación",
    "soporte": "Soporte",
    "user": "Usuario",
}


async def get_staff_user(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    """Dependency to ensure current user has ANY staff role (not just super admin)."""
    if current_user.role not in STAFF_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff access required")
    return current_user


def require_roles(*allowed_roles: str):
    """Dependency factory: restrict an endpoint to a specific subset of staff roles.
    Usage: Depends(require_roles("admin", "marketing"))"""

    async def _dependency(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para esta acción")
        return current_user

    return _dependency
