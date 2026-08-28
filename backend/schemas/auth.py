from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserResponse(BaseModel):
    id: str  # Now a string UUID (platform sub)
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str = "user"  # user/admin
    last_login: Optional[datetime] = None
    account_status: str = "active"
    scheduled_purge_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PlatformTokenExchangeRequest(BaseModel):
    """Request body for exchanging Platform token for app token."""

    platform_token: str


class TokenExchangeResponse(BaseModel):
    """Response body for issued application token."""

    token: str


class RegisterRequest(BaseModel):
    """Request body to create a new account with email + password."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: Optional[str] = None
    captcha_token: Optional[str] = None


class LoginRequest(BaseModel):
    """Request body to log in with email + password."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AuthTokenResponse(BaseModel):
    """Response returned after successful register/login."""

    token: str
    token_type: str = "Bearer"
    user: UserResponse
