import logging
import secrets
from urllib.parse import urlencode

import httpx
from core.config import settings
from core.database import get_db
from core.legal import TERMS_VERSION
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
from services import password_reset
from services.email import send_google_account_hint_email, send_password_reset_email
from core.security import hash_password
from models.auth import User
from models.audit import LoginAttempt
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])
logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GOOGLE_STATE_COOKIE = "google_oauth_state"
GOOGLE_AGE_CONFIRMED_COOKIE = "google_oauth_age_confirmed"
AGE_REQUIRED_DETAIL = "Debes confirmar que eres mayor de 18 años para crear una cuenta"
SITE_URL = "https://www.ventacofrade.com"
RESET_REQUESTS_PER_HOUR = 3


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
    user = await auth_service.register_user(
        email=payload.email,
        password=payload.password,
        name=payload.name,
        age_confirmed=payload.age_confirmed,
        client_ip=client_ip,
    )
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
async def google_login(request: Request, age_confirmed: bool = False):
    """Redirect the browser to Google's consent screen to sign in/register.

    `age_confirmed` reflects whether the person ticked the "soy mayor de 18
    años" checkbox before clicking "Continuar con Google" (the frontend only
    sends it as True when the checkbox was checked in register mode). Google
    doesn't tell us anyone's age, so this self-declaration — carried across
    the OAuth round-trip in a short-lived cookie — is what lets the callback
    below refuse to create a brand-new account without it.
    """
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
    if age_confirmed:
        response.set_cookie(
            GOOGLE_AGE_CONFIRMED_COOKIE,
            "1",
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
    age_confirmed = request.cookies.get(GOOGLE_AGE_CONFIRMED_COOKIE) == "1"

    auth_service = AuthService(db)
    try:
        user, is_new_user = await auth_service.get_or_create_google_user(
            email=email, name=userinfo.get("name"), age_confirmed=age_confirmed, client_ip=client_ip
        )
    except HTTPException as exc:
        await log_login_attempt(
            db, email=email, method="google", success=False,
            reason=str(exc.detail)[:255], ip_address=client_ip, user_agent=user_agent,
        )
        if exc.detail == AGE_REQUIRED_DETAIL:
            # Cuenta nueva sin marcar la casilla: en vez de echarle, le devolvemos al registro
            # con la casilla resaltada para que la marque y vuelva a pulsar Google.
            return RedirectResponse(
                url=f"{frontend_url}/login?{urlencode({'modo': 'registro', 'edad': 'google'})}",
                status_code=status.HTTP_302_FOUND,
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
    redirect_response.delete_cookie(GOOGLE_AGE_CONFIRMED_COOKIE)
    return redirect_response


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserResponse = Depends(get_current_user)):
    """Get current user info."""
    return current_user


@router.post("/accept-terms", response_model=UserResponse)
async def accept_terms(
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """La persona acepta la versión vigente de los Términos y el Aviso Legal (se guarda cuándo y desde qué IP)."""
    user = (await db.execute(select(User).where(User.id == current_user.id))).scalar_one()
    user.terms_version = TERMS_VERSION
    user.terms_accepted_at = datetime.now(timezone.utc)
    user.terms_accepted_ip = request.client.host if request.client else None
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.get("/logout")
async def logout():
    """Logout user. The token is stateless (JWT), so logging out is handled
    client-side by discarding the stored token."""
    return {"success": True}


# ---------------------------------------------------------------------------
# Recuperar contraseña
# ---------------------------------------------------------------------------
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10, max_length=500)
    password: str = Field(min_length=8, max_length=128)


FORGOT_OK = {
    "ok": True,
    "message": "Si hay una cuenta con ese email, te hemos enviado un enlace para crear una contraseña nueva.",
}


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Envía el enlace para restablecer la contraseña. Responde siempre lo mismo,
    exista o no la cuenta, para no revelar qué emails están registrados."""
    email = payload.email.strip().lower()
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")[:255]

    since = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = (
        await db.execute(
            select(func.count()).select_from(LoginAttempt).where(
                LoginAttempt.email == email, LoginAttempt.method == "reset", LoginAttempt.created_at >= since
            )
        )
    ).scalar_one()
    if recent >= RESET_REQUESTS_PER_HOUR:
        return FORGOT_OK

    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    reason = "sin cuenta"
    if user and user.account_status != "banned":
        if user.password_hash:
            token = password_reset.make_token(user.id, user.password_hash)
            sent = await send_password_reset_email(email, f"{SITE_URL}/restablecer-contrasena?token={token}")
            reason = "enlace enviado" if sent else "fallo al enviar email"
        else:
            sent = await send_google_account_hint_email(email)
            reason = "cuenta de Google: pista enviada" if sent else "fallo al enviar email"

    await log_login_attempt(
        db, email=email, method="reset", success=False, reason=f"Petición de nueva contraseña: {reason}",
        ip_address=client_ip, user_agent=user_agent,
    )
    return FORGOT_OK


@router.post("/reset-password", response_model=AuthTokenResponse)
async def reset_password(payload: ResetPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Guarda la contraseña nueva y deja la sesión iniciada."""
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="El enlace no es válido o ha caducado. Pide uno nuevo desde «¿Has olvidado tu contraseña?».",
    )
    data = password_reset.read_token(payload.token)
    if not data:
        raise invalid
    user_id, fingerprint = data
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user or user.account_status == "banned":
        raise invalid
    if not password_reset.matches_current_password(fingerprint, user.password_hash):
        raise invalid  # ya se usó (la contraseña cambió después de pedir el enlace)

    user.password_hash = hash_password(payload.password)
    user.last_login = datetime.now(timezone.utc)
    if user.account_status == "suspended":
        user.account_status = "active"
        user.suspended_at = None
    await db.commit()
    await db.refresh(user)

    await log_login_attempt(
        db, email=user.email, method="reset", success=True, reason="Contraseña cambiada",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:255],
    )
    token, _, _ = await AuthService(db).issue_app_token(user=user)
    return AuthTokenResponse(token=token, user=UserResponse.model_validate(user))
