import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_admin_user
from schemas.auth import UserResponse
from services.platform_settings import get_launch_at, set_launch_at
from services.audit import log_admin_action

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin/platform-settings", tags=["admin-platform-settings"])


class PlatformSettingsResponse(BaseModel):
    launch_at: Optional[datetime] = None


class SetLaunchAtRequest(BaseModel):
    launch_at: Optional[datetime] = None


@router.get("", response_model=PlatformSettingsResponse)
async def get_platform_settings(
    current_user: UserResponse = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Super-admin only: read the platform's real public launch date, used to
    correctly time raffle winners' free-access period."""
    launch_at = await get_launch_at(db)
    return PlatformSettingsResponse(launch_at=launch_at)


@router.put("", response_model=PlatformSettingsResponse)
async def update_platform_settings(
    payload: SetLaunchAtRequest,
    current_user: UserResponse = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Super-admin only: set (or clear) the platform's real public launch date.

    Setting it for the first time automatically activates any raffle winners
    who redeemed their invitation before launch — see services/platform_settings.py.
    """
    row = await set_launch_at(db, payload.launch_at, updated_by=current_user.id)

    await log_admin_action(
        db, current_user.id, current_user.email, "set_platform_launch_at",
        details=f"launch_at={payload.launch_at.isoformat() if payload.launch_at else None}",
    )

    return PlatformSettingsResponse(launch_at=row.launch_at)
