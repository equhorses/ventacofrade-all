import logging
import secrets
from urllib.parse import urlencode

import httpx
from core.config import settings
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from schemas.auth import (
    AuthTokenResponse,
    LoginRequest,
    RegisterRequest,
    UserResponse,
)
from services.auth import AuthService
from services.audit import log_login_attempt, is_locked_out
from services.hcaptcha import verify_hcaptcha_token
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_STATE_COOKIE = "google_oauth_state"


@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Create a new account with email + password and return a session token."""
    client_ip = request.client.host if request.client else None
    captcha_ok = await verify_hcaptcha_token(payload.captcha_token, remote_ip=client_ip)
    if not captcha_ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo verificar que eres una persona. Vuelve a intentarlo.",
        )

    auth_service = AuthService(db)
    user = await auth_service.register_user(email=payload.email, password=payload.password, name=payload.name)
    token, expires_at, _ = await auth_service.issue_app_token(user=user)
    return AuthTokenResponse(token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=AuthTokenResponse)
async def login_with_password(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Log in with email + password and return a session token."""
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")[:255]

    minutes_locked = await is_locked_out(db, payload.email)
    if minutes_locked is not None:
        await log_login_attempt(
            db, email=payload.email, method="password", success=False,
            reason="Cuenta bloqueada temporalmente por demasiados intentos fallidos",
            ip_address=client_ip, user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Demasiados intentos fallidos. Por seguridad, espera "
                f"{minutes_locked} minutos antes de volver a intentarlo."
            ),
        )

    auth_service = AuthService(db)
    try:
        user = await auth_service.authenticate_user(email=payload.email, password=payload.password)
    except HTTPException as exc:
        await log_login_attempt(
            db, email=payload.email, method="password", success=False,
            reason=str(exc.detail)[:255], ip_address=client_ip, user_agent=user_agent,
        )
        raise

    await log_login_attempt(
        db, email=payload.email, method="password", success=True,
        ip_address=client_ip, user_agent=user_agent,
    )
    token, expires_at, _ = await auth_service.issue_app_token(user=user)
    return AuthTokenResponse(token=token, user=UserResponse.model_validate(user))


@router.get("/google/login")
async def google_login(request: Request):
    """Redirect the browser to Google's consent screen to sign in/register."""
    google_client_id = getattr(settings, "google_client_id", None)
    if not google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El inicio de sesion con Google no esta configurado en el servidor",
        )

    backend_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{backend_url}/api/v1/auth/google/callback"
    state = secrets.token_urlsafe(24)

    params = {
        "client_id": google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    response = RedirectResponse(url=auth_url, status_code=status.HTTP_302_FOUND)
    # Short-lived cookie to protect against CSRF on the callback; the same
    # browser that started the flow is the one that will complete it.
    response.set_cookie(
        GOOGLE_STATE_COOKIE,
        state,
        max_age=600,
        httponly=True,
        secure=True,
        samesite="lax",
    )
    return response


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str = None,
    state: str = None,
    error: str = None,
    db: AsyncSession = Depends(get_db),
):
    """Handle Google's redirect back, exchange the code, and log the user in."""
    frontend_url = getattr(settings, "frontend_url", None) or "/"

    def redirect_with_error(message: str) -> RedirectResponse:
        fragment = urlencode({"error": message})
        return RedirectResponse(url=f"{frontend_url}/login?{fragment}", status_code=status.HTTP_302_FOUND)

    if error:
        return redirect_with_error(f"Google devolvio un error: {error}")
    if not code or not state:
        return redirect_with_error("Falta el codigo o el estado de Google")

    cookie_state = request.cookies.get(GOOGLE_STATE_COOKIE)
    if not cookie_state or cookie_state != state:
        return redirect_with_error("La sesion de inicio de sesion caduco, intentalo de nuevo")

    google_client_id = getattr(settings, "google_client_id", None)
    google_client_secret = getattr(settings, "google_client_secret", None)
    if not google_client_id or not google_client_secret:
        return redirect_with_error("El inicio de sesion con Google no esta configurado")

    backend_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{backend_url}/api/v1/auth/google/callback"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": google_client_id,
                    "client_secret": google_client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            token_response.raise_for_status()
            access_token = token_response.json().get("access_token")
            if not access_token:
                return redirect_with_error("Google no devolvio un token de acceso")

            userinfo_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            userinfo_response.raise_for_status()
            userinfo = userinfo_response.json()
    except httpx.HTTPError as exc:
        logger.error("Google OAuth exchange failed: %s", exc)
        return redirect_with_error("No se pudo verificar la cuenta de Google")

    email = userinfo.get("email")
    if not email:
        return redirect_with_error("Google no proporciono un email")

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")[:255]

    auth_service = AuthService(db)
    try:
        user, is_new_user = await auth_service.get_or_create_google_user(email=email, name=userinfo.get("name"))
    except HTTPException as exc:
        await log_login_attempt(
            db, email=email, method="google", success=False,
            reason=str(exc.detail)[:255], ip_address=client_ip, user_agent=user_agent,
        )
        return redirect_with_error(str(exc.detail))

    await log_login_attempt(
        db, email=email, method="google", success=True,
        ip_address=client_ip, user_agent=user_agent,
    )
    token, expires_at, _ = await auth_service.issue_app_token(user=user)

    callback_params = {"token": token}
    if is_new_user:
        callback_params["welcome"] = "1"

    redirect_response = RedirectResponse(
        url=f"{frontend_url}/auth/callback?{urlencode(callback_params)}",
        status_code=status.HTTP_302_FOUND,
    )
    redirect_response.delete_cookie(GOOGLE_STATE_COOKIE)
    return redirect_response


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """Get current user info."""
    return current_user


@router.get("/logout")
async def logout():
    """Logout user. The token is stateless (JWT), so logging out is handled
    client-side by discarding the stored token."""
    return {"success": True}
