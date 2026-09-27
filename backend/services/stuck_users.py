"""Quién se ha atascado y por qué, para el panel de admin ("Atascados")."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.audit import AuditLog, LoginAttempt
from models.auth import User
from models.invitations import Invitation
from models.products import Products
from models.user_events import UserEvent
from models.waitlist import Waitlist

AGE_REASON = "Debes confirmar que eres mayor de 18 años para crear una cuenta"
WRONG_PASSWORD = "Email o contraseña incorrectos"
LOOKBACK = timedelta(days=30)

# motivo -> (texto para el panel, tipo de ayuda a enviar)
REASONS = {
    "publish_failed": "Le falló al publicar",
    "upload_failed": "Le falló subir una foto",
    "api_error": "Le dio un error la web",
    "publish_abandoned": "Empezó a publicar y no terminó",
    "no_listing": "Se registró y no ha publicado nada",
    "login_failed": "No consiguió entrar (contraseña)",
    "reset_unfinished": "Pidió cambiar la contraseña y no terminó",
    "google_age": "Se quedó fuera al registrarse con Google (casilla de edad)",
}
PRIORITY = [
    "publish_failed", "upload_failed", "api_error", "publish_abandoned",
    "login_failed", "reset_unfinished", "google_age", "no_listing",
]


def _aware(value: Optional[datetime]) -> Optional[datetime]:
    if value and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


async def find_stuck(db: AsyncSession, now: Optional[datetime] = None) -> list[dict]:
    now = now or datetime.now(timezone.utc)
    since = now - LOOKBACK

    users = (await db.execute(select(User))).scalars().all()
    by_email = {u.email.lower(): u for u in users}
    by_id = {u.id: u for u in users}
    first_product = dict(
        (await db.execute(select(Products.user_id, func.min(Products.created_at)).group_by(Products.user_id))).all()
    )
    last_product = dict(
        (await db.execute(select(Products.user_id, func.max(Products.created_at)).group_by(Products.user_id))).all()
    )
    waitlist = {e.lower() for e in (await db.execute(select(Waitlist.email))).scalars().all()}
    invited = {e.lower() for e in (await db.execute(select(Invitation.email))).scalars().all()}
    helped = {}
    for target, created in (
        await db.execute(select(AuditLog.target, AuditLog.created_at).where(AuditLog.action.in_(["help_email", "rescue_email"])))
    ).all():
        if target:
            key = target.lower()
            helped[key] = max(filter(None, [helped.get(key), _aware(created)]), default=None)

    found: dict[str, dict] = {}

    def add(email: str, reason: str, when: Optional[datetime], detail: Optional[str] = None) -> None:
        email = (email or "").lower()
        if not email:
            return
        user = by_email.get(email)
        if user and user.role != "user":
            return  # el equipo no cuenta
        current = found.get(email)
        if current and PRIORITY.index(current["reason"]) <= PRIORITY.index(reason):
            return
        found[email] = {
            "email": email,
            "name": user.name if user else None,
            "has_account": bool(user),
            "reason": reason,
            "reason_label": REASONS[reason],
            "when": _aware(when).isoformat() if when else None,
            "detail": detail,
            "origin": "lista de espera" if email in waitlist else ("invitado" if email in invited else "registro normal"),
            "last_help_at": helped[email].isoformat() if email in helped and helped[email] else None,
        }

    # 1) Eventos de la web (errores y publicaciones a medias).
    events = (
        await db.execute(select(UserEvent).where(UserEvent.created_at >= since).order_by(UserEvent.created_at))
    ).scalars().all()
    started: dict[str, datetime] = {}
    for ev in events:
        user = by_id.get(ev.user_id or "")
        email = (user.email if user else ev.email) or ""
        when = _aware(ev.created_at)
        published_after = _aware(last_product.get(ev.user_id))
        if published_after and when and published_after > when:
            continue  # luego consiguió publicar
        if ev.kind == "publish_started":
            started[email] = when
        elif ev.kind in ("publish_failed", "upload_failed", "api_error"):
            add(email, ev.kind, when, ev.detail)
    for email, when in started.items():
        if when and now - when > timedelta(hours=1):
            add(email, "publish_abandoned", when)

    # 2) Accesos fallidos sin un acceso correcto después.
    ok_after = dict(
        (await db.execute(
            select(func.lower(LoginAttempt.email), func.max(LoginAttempt.created_at))
            .where(LoginAttempt.success.is_(True)).group_by(func.lower(LoginAttempt.email))
        )).all()
    )
    failed = (await db.execute(
        select(func.lower(LoginAttempt.email), LoginAttempt.method, LoginAttempt.reason, func.max(LoginAttempt.created_at))
        .where(LoginAttempt.success.is_(False), LoginAttempt.created_at >= since)
        .group_by(func.lower(LoginAttempt.email), LoginAttempt.method, LoginAttempt.reason)
    )).all()
    for email, method, reason, when in failed:
        last_ok = _aware(ok_after.get(email))
        if last_ok and _aware(when) and last_ok > _aware(when):
            continue
        user = by_email.get(email)
        if method == "password" and reason == WRONG_PASSWORD and user and user.password_hash:
            add(email, "login_failed", when)
        elif method == "google" and reason == AGE_REASON and not user:
            add(email, "google_age", when)
        elif method == "reset" and reason and "enlace enviado" in reason:
            add(email, "reset_unfinished", when)

    # 3) Registrados hace más de un día sin ningún anuncio.
    for user in users:
        if user.role != "user" or user.account_status != "active" or user.id in first_product:
            continue
        created = _aware(user.created_at)
        if created and now - created > timedelta(days=1):
            add(user.email, "no_listing", _aware(user.last_login) or created)

    return sorted(found.values(), key=lambda r: (PRIORITY.index(r["reason"]), r["when"] or ""), reverse=False)
