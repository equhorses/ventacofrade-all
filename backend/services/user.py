import logging
import time
from typing import Optional

from models.auth import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def purge_user_completely(db: AsyncSession, user_id: str) -> Optional[str]:
    """Permanently delete a user account and everything tied to it: seller
    profile, listings, professional profile, reviews, favorites, messages,
    and any redeemed invitation. Returns the deleted email, or None if the
    user didn't exist. Shared by the admin 'delete now' action and the daily
    purge job that enforces the 5-year retention window after a self-service
    deletion request."""
    from models.seller_profiles import Seller_profiles
    from models.products import Products
    from models.feature_purchases import FeaturePurchases
    from models.reviews import Reviews
    from models.professional_profiles import ProfessionalProfiles
    from models.favorites import Favorites
    from models.messages import Messages
    from models.invitations import Invitation

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None

    deleted_email = user.email

    seller_result = await db.execute(select(Seller_profiles).where(Seller_profiles.user_id == user_id))
    seller_profile = seller_result.scalar_one_or_none()
    if seller_profile:
        await db.execute(Products.__table__.delete().where(Products.user_id == user_id))
        await db.execute(FeaturePurchases.__table__.delete().where(FeaturePurchases.seller_user_id == user_id))
        await db.execute(Reviews.__table__.delete().where(Reviews.seller_profile_id == seller_profile.id))
        await db.delete(seller_profile)

    await db.execute(ProfessionalProfiles.__table__.delete().where(ProfessionalProfiles.user_id == user_id))
    await db.execute(Favorites.__table__.delete().where(Favorites.user_id == user_id))
    await db.execute(Messages.__table__.delete().where(Messages.user_id == user_id))
    await db.execute(Messages.__table__.delete().where(Messages.receiver_id == user_id))
    await db.execute(Reviews.__table__.delete().where(Reviews.reviewer_user_id == user_id))
    await db.execute(Invitation.__table__.delete().where(Invitation.redeemed_by_user_id == user_id))

    await db.delete(user)
    await db.commit()

    return deleted_email


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

    @staticmethod
    async def cancel_account_deletion(db: AsyncSession, user_id: str) -> Optional[User]:
        """Undo a pending self-service deletion request — the account goes
        straight back to 'active' and the scheduled purge is called off.
        Only makes sense while account_status is still 'pending_deletion';
        does nothing (returns the user as-is) otherwise."""
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user and user.account_status == "pending_deletion":
            user.account_status = "active"
            user.deletion_requested_at = None
            user.scheduled_purge_at = None
            await db.commit()
            await db.refresh(user)
        return user
