import logging
from typing import Optional

from models.audit import AuditLog, LoginAttempt
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


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
