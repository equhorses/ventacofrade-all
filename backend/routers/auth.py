import logging

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, status
from schemas.auth import (
    AuthTokenResponse,
    LoginRequest,
    RegisterRequest,
    UserResponse,
)
from services.auth import AuthService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
logger = logging.getLogger(__name__)


@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Create a new account with email + password and return a session token."""
    auth_service = AuthService(db)
    user = await auth_service.register_user(email=payload.email, password=payload.password, name=payload.name)
    token, expires_at, _ = await auth_service.issue_app_token(user=user)
    return AuthTokenResponse(token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=AuthTokenResponse)
async def login_with_password(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Log in with email + password and return a session token."""
    auth_service = AuthService(db)
    user = await auth_service.authenticate_user(email=payload.email, password=payload.password)
    token, expires_at, _ = await auth_service.issue_app_token(user=user)
    return AuthTokenResponse(token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """Get current user info."""
    return current_user


@router.get("/logout")
async def logout():
    """Logout user. The token is stateless (JWT), so logging out is handled
    client-side by discarding the stored token."""
    return {"success": True}
