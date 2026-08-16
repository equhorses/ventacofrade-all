import logging
import time
from typing import Optional

from models.auth import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class UserService:
    @staticmethod
    async def get_user_profile(db: AsyncSession, user_id: str) -> Optional[User]:
        """Get user profile by user ID."""
        start_time = time.time()
        logger.debug(f"[DB_OP] Starting get_user_profile - user_id: {user_id}")
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        logger.debug(
            f"[DB_OP] Get user profile completed in {time.time() - start_time:.4f}s - found: {user is not None}"
        )
        return user

    @staticmethod
    async def update_user_profile(
        db: AsyncSession, user_id: str, name: Optional[str] = None, avatar_url: Optional[str] = None
    ) -> Optional[User]:
        """Update user profile."""
        start_time = time.time()
        logger.debug(f"[DB_OP] Starting update_user_profile - user_id: {user_id}")
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        logger.debug(f"[DB_OP] User lookup completed in {time.time() - start_time:.4f}s - found: {user is not None}")

        if user:
            start_time_update = time.time()
            logger.debug("[DB_OP] Starting user profile update")
            if name is not None:
                user.name = name
            if avatar_url is not None:
                user.avatar_url = avatar_url
            await db.commit()
            await db.refresh(user)
            logger.debug(f"[DB_OP] User profile update completed in {time.time() - start_time_update:.4f}s")

        return user

    @staticmethod
    async def suspend_account(
        db: AsyncSession, user_id: str, reasons: Optional[str] = None, feedback: Optional[str] = None
    ) -> Optional[User]:
        """Suspend a user's account. Reactivated automatically on next login."""
        from datetime import datetime, timezone

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            user.account_status = "suspended"
            user.suspended_at = datetime.now(timezone.utc)
            if reasons is not None:
                user.deletion_reasons = reasons
            if feedback is not None:
                user.deletion_feedback = feedback
            await db.commit()
            await db.refresh(user)
        return user

    @staticmethod
    async def request_account_deletion(
        db: AsyncSession, user_id: str, reasons: Optional[str] = None, feedback: Optional[str] = None
    ) -> Optional[User]:
        """Mark a user's account for deletion. Data is retained for 5 years
        for tax/legal compliance before final purge (handled separately)."""
        from datetime import datetime, timedelta, timezone

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            now = datetime.now(timezone.utc)
            user.account_status = "pending_deletion"
            user.deletion_requested_at = now
            user.scheduled_purge_at = now + timedelta(days=365 * 5)
            if reasons is not None:
                user.deletion_reasons = reasons
            if feedback is not None:
                user.deletion_feedback = feedback
            await db.commit()
            await db.refresh(user)
        return user
