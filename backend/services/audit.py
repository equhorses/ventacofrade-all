import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from models.audit import AuditLog, LoginAttempt
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# After this many failed password attempts for the same email within the
# window below, further attempts are blocked until the window passes —
# slows down brute-force guessing without permanently locking anyone out.
LOCKOUT_MAX_ATTEMPTS = 5
LOCKOUT_WINDOW_MINUTES = 15


async def log_admin_action(
    db: AsyncSession,
    actor_id: Optional[str],
    actor_email: Optional[str],
    action: str,
    target: Optional[str] = None,
    details: Optional[str] = None,
) -> None:
    """Record a staff action for the audit trail. Never raises — a logging
    failure should never block the actual action from completing."""
    try:
        db.add(
            AuditLog(
                actor_id=actor_id,
                actor_email=actor_email,
                action=action,
                target=target,
                details=details,
            )
        )
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to write audit log entry ({action}): {e}")


async def is_locked_out(db: AsyncSession, email: str) -> Optional[int]:
    """Check whether this email has too many recent failed password
    attempts. Returns the number of minutes left locked out, or None if
    it's fine to try. Fails open (returns None) on any DB error, so a
    logging problem never blocks a legitimate login."""
    try:
        since = datetime.now(timezone.utc) - timedelta(minutes=LOCKOUT_WINDOW_MINUTES)
        result = await db.execute(
            select(func.count()).select_from(LoginAttempt).where(
                LoginAttempt.email == (email or "").strip().lower(),
                LoginAttempt.method == "password",
                LoginAttempt.success.is_(False),
                LoginAttempt.created_at >= since,
            )
        )
        failed_count = result.scalar_one()
        if failed_count >= LOCKOUT_MAX_ATTEMPTS:
            return LOCKOUT_WINDOW_MINUTES
        return None
    except Exception as e:
        logger.error(f"Failed to check login lockout status: {e}")
        return None


async def log_login_attempt(
    db: AsyncSession,
    email: str,
    method: str,
    success: bool,
    reason: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    """Record a login attempt (password or Google), success or failure."""
    try:
        db.add(
            LoginAttempt(
                email=(email or "").strip().lower(),
                method=method,
                success=success,
                reason=reason,
                ip_address=ip_address,
                user_agent=user_agent,
            )
        )
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to write login attempt entry: {e}")
