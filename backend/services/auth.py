import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from core.auth import create_access_token
from core.config import settings
from core.database import db_manager
from core.security import hash_password, verify_password
from fastapi import HTTPException, status
from models.auth import User
from services.email import send_welcome_email
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register_user(
        self, email: str, password: str, name: Optional[str] = None, age_confirmed: bool = False
    ) -> User:
        """Create a new user account with email + password.

        Requires an explicit self-declared 18+ confirmation, recorded with a
        timestamp. Enforced here (not just in the request schema/router) so
        this stays true even if a future caller forgets the frontend check.
        """
        if not age_confirmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debes confirmar que eres mayor de 18 años para crear una cuenta",
            )

        normalized_email = email.strip().lower()

        result = await self.db.execute(select(User).where(User.email == normalized_email))
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe una cuenta con ese email")

        user = User(
            id=str(uuid.uuid4()),
            email=normalized_email,
            password_hash=hash_password(password),
            name=name or normalized_email.split("@", 1)[0],
            role="user",
            last_login=datetime.now(timezone.utc),
            age_confirmed_at=datetime.now(timezone.utc),
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        await send_welcome_email(to_email=user.email, name=user.name)
        return user

    async def authenticate_user(self, email: str, password: str) -> User:
        """Verify email + password and return the matching user."""
        normalized_email = email.strip().lower()

        result = await self.db.execute(select(User).where(User.email == normalized_email))
        user = result.scalar_one_or_none()

        if not user or not user.password_hash:
            # Either the email doesn't exist, or it exists but was created via
            # Google (no password set) — give an honest, actionable message
            # instead of the generic "wrong credentials" in the latter case.
            if user and not user.password_hash:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Esta cuenta se creó con Google. Inicia sesión con el botón 'Continuar con Google'.",
                )
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email o contraseña incorrectos")

        if not verify_password(password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email o contraseña incorrectos")

        if user.account_status == "banned":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Esta cuenta ha sido suspendida por el equipo de VentaCofrade. Contacta con soporte.",
            )

        if user.account_status == "suspended":
            user.account_status = "active"
            user.suspended_at = None

        user.last_login = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_or_create_google_user(
        self, email: str, name: Optional[str] = None, age_confirmed: bool = False
    ) -> Tuple[User, bool]:
        """Find a user by email (created via Google or previously via password),
        or create a new one. Google-authenticated accounts have no password_hash,
        so they can only ever log in again via Google.

        `age_confirmed` is only required — and only recorded — when this is a
        genuinely new account. Google's own login doesn't expose the person's
        age to us, so this self-declaration (ticked before the OAuth redirect)
        is our only signal; existing users logging back in aren't asked again.

        Returns (user, is_new_user) so the caller can show a welcome message
        only to genuinely new accounts."""
        normalized_email = email.strip().lower()

        result = await self.db.execute(select(User).where(User.email == normalized_email))
        user = result.scalar_one_or_none()

        is_new_user = False
        if user:
            if user.account_status == "banned":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Esta cuenta ha sido suspendida por el equipo de VentaCofrade. Contacta con soporte.",
                )
            user.last_login = datetime.now(timezone.utc)
            if name and not user.name:
                user.name = name
        else:
            if not age_confirmed:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Debes confirmar que eres mayor de 18 años para crear una cuenta",
                )
            is_new_user = True
            user = User(
                id=str(uuid.uuid4()),
                email=normalized_email,
                password_hash=None,
                name=name or normalized_email.split("@", 1)[0],
                role="user",
                last_login=datetime.now(timezone.utc),
                age_confirmed_at=datetime.now(timezone.utc),
            )
            self.db.add(user)

        await self.db.commit()
        await self.db.refresh(user)
        if is_new_user:
            await send_welcome_email(to_email=user.email, name=user.name)
        return user, is_new_user

    async def issue_app_token(
        self,
        user: User,
    ) -> Tuple[str, datetime, Dict[str, Any]]:
        """Generate application JWT token for the authenticated user."""
        try:
            expires_minutes = int(getattr(settings, "jwt_expire_minutes", 60))
        except (TypeError, ValueError):
            logger.warning("Invalid JWT_EXPIRE_MINUTES value; fallback to 60 minutes")
            expires_minutes = 60
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)

        claims: Dict[str, Any] = {
            "sub": user.id,
            "email": user.email,
            "role": user.role,
        }

        if user.name:
            claims["name"] = user.name
        if user.last_login:
            claims["last_login"] = user.last_login.isoformat()
        token = create_access_token(claims, expires_minutes=expires_minutes)

        return token, expires_at, claims


async def initialize_admin_user():
    """Initialize admin user if not exists"""
    if "MGX_IGNORE_INIT_ADMIN" in os.environ:
        logger.info("Ignore initialize admin")
        return

    from services.database import initialize_database

    # Ensure database is initialized first
    await initialize_database()

    admin_user_id = getattr(settings, "admin_user_id", "")
    admin_user_email = getattr(settings, "admin_user_email", "")

    if not admin_user_id or not admin_user_email:
        logger.warning("Admin user ID or email not configured, skipping admin initialization")
        return

    async with db_manager.async_session_maker() as db:
        # Check if admin user already exists
        result = await db.execute(select(User).where(User.id == admin_user_id))
        user = result.scalar_one_or_none()

        if user:
            # Update existing user to admin if not already
            if user.role != "admin":
                user.role = "admin"
                user.email = admin_user_email  # Update email too
                await db.commit()
                logger.debug(f"Updated user {admin_user_id} to admin role")
            else:
                logger.debug(f"Admin user {admin_user_id} already exists")
        else:
            # Create new admin user
            admin_user = User(id=admin_user_id, email=admin_user_email, role="admin")
            db.add(admin_user)
            await db.commit()
            logger.debug(f"Created admin user: {admin_user_id} with email: {admin_user_email}")
