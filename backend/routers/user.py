from typing import Optional

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from models.auth import User
from pydantic import BaseModel
from schemas.auth import UserResponse
from services.user import UserService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/users", tags=["users"])


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None


@router.get("/profile", response_model=UserResponse)
async def get_profile(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    profile = await UserService.get_user_profile(db, current_user.id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    return profile


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user profile"""
    profile = await UserService.update_user_profile(
        db, current_user.id, name=profile_data.name, avatar_url=profile_data.avatar_url
    )
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    return profile


class AccountActionRequest(BaseModel):
    reasons: Optional[str] = None
    feedback: Optional[str] = None


@router.post("/account/suspend", response_model=UserResponse)
async def suspend_account(
    payload: AccountActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Suspend the current user's account. It reactivates automatically on next login."""
    user = await UserService.suspend_account(
        db, current_user.id, reasons=payload.reasons, feedback=payload.feedback
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    return user


@router.post("/account/delete", response_model=UserResponse)
async def request_account_deletion(
    payload: AccountActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark the current user's account for permanent deletion. Data is kept
    for 5 years for legal/tax compliance before final purge."""
    user = await UserService.request_account_deletion(
        db, current_user.id, reasons=payload.reasons, feedback=payload.feedback
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    return user
