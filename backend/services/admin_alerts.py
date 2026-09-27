"""Avisos al equipo (contacto@ventacofrade.com) cuando alguien se atasca.

- Al momento: si a alguien le falla publicar, subir una foto o la web le da un error
  (como mucho un aviso por persona y hora, para no llenar el correo).
- Cada mañana: resumen de quién se ha atascado en las últimas 24 horas.

Para mandar los avisos a otro correo, añade en Railway la variable ADMIN_ALERT_EMAIL.
"""

import html
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select

from core.config import settings
from core.database import db_manager
from models.audit import AuditLog
from services.audit import log_admin_action
from services.email import _email_shell, _send_via_resend
from services.stuck_users import REASONS, find_stuck

logger = logging.getLogger(__name__)

PANEL_URL = "https://www.ventacofrade.com/admin/atascados"
INSTANT_KINDS = {"publish_failed", "upload_failed", "api_error"}


def alert_email() -> str:
    try:
        value = getattr(settings, "admin_alert_email")
    except AttributeError:
        value = None
    return (value or "contacto@ventacofrade.com").strip()


async def alert_stuck_now(db, email: Optional[str], kind: str, detail: Optional[str]) -> bool:
    """Aviso inmediato de un error. Devuelve True si se ha enviado."""
    if kind not in INSTANT_KINDS or not email:
        return False
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    already = (
        await db.execute(
            select(AuditLog.id).where(
                AuditLog.action == "stuck_alert", AuditLog.target == email.lower(), AuditLog.created_at >= since
            ).limit(1)
        )
    ).scalar_one_or_none()
    if already:
        return False
    body = (
        f"<p><strong>{html.escape(email)}</strong> se acaba de atascar.</p>"
        f"<p><strong>Qué le ha pasado:</strong> {html.escape(REASONS.get(kind, kind))}</p>"
        + (f"<p style='color:#52525b;font-size:13px;'>Detalle: {html.escape(detail)}</p>" if detail else "")
        + "<p>Desde el panel puedes mandarle un mensaje de ayuda con un clic.</p>"
    )
    ok = await _send_via_resend(
        alert_email(),
        f"Atascado: {email} ({REASONS.get(kind, kind).lower()})",
        _email_shell("Alguien se ha atascado", body, "Ver en Atascados", PANEL_URL),
        "aviso atascado",
    )
    if ok:
        await log_admin_action(db, None, "system", "stuck_alert", target=email.lower(), details=kind)
    return ok


async def send_daily_stuck_summary() -> None:
    """Resumen de la mañana con los atascados de las últimas 24 horas (si hay alguno)."""
    if not db_manager.async_session_maker:
        await db_manager.ensure_initialized()
    async with db_manager.async_session_maker() as db:
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        items = [
            i for i in await find_stuck(db)
            if i["when"] and datetime.fromisoformat(i["when"]) >= since and not i["last_help_at"]
        ]
        if not items:
            logger.info("Resumen de atascados: nadie nuevo en 24 h")
            return
        rows = "".join(
            f"<tr><td style='padding:6px 8px;border-bottom:1px solid #e4e4e7;'>{html.escape(i['email'])}"
            f"<br><span style='color:#71717a;font-size:12px;'>{html.escape(i['origin'])}</span></td>"
            f"<td style='padding:6px 8px;border-bottom:1px solid #e4e4e7;'>{html.escape(i['reason_label'])}</td></tr>"
            for i in items
        )
        body = (
            f"<p>En las últimas 24 horas se han atascado <strong>{len(items)}</strong> "
            f"{'persona' if len(items) == 1 else 'personas'}:</p>"
            f"<table style='width:100%;border-collapse:collapse;font-size:14px;'>{rows}</table>"
        )
        await _send_via_resend(
            alert_email(),
            f"Resumen: {len(items)} {'atascado' if len(items) == 1 else 'atascados'} en VentaCofrade",
            _email_shell("Atascados de las últimas 24 horas", body, "Abrir Atascados", PANEL_URL),
            "resumen atascados",
        )
