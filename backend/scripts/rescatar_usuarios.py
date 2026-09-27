"""Rescate de la gente que se atascó antes de estos arreglos.

Grupos:
  contrasena  -> falló la contraseña al entrar y no ha vuelto a entrar (antes no había "¿olvidaste tu contraseña?").
  google      -> intentó registrarse con Google sin marcar la casilla de mayor de edad y no tiene cuenta.
  publicar    -> invitado con cuenta pero sin ningún anuncio (sus emails llevaban a una página en blanco).
  registro    -> invitado al que se le mandó el email pero no llegó a crear cuenta (mismo enlace roto).

Uso (consola del BACKEND de Railway, no la de Postgres):
  python scripts/rescatar_usuarios.py                     -> solo enseña a quién escribiría (no envía nada)
  python scripts/rescatar_usuarios.py --enviar            -> envía a todos los grupos
  python scripts/rescatar_usuarios.py --enviar --grupo contrasena

Cada persona recibe como mucho un email por grupo: los envíos quedan en la auditoría
(acción "rescue_email") y el guion se salta a quien ya lo recibió.
"""

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func, select  # noqa: E402

from models.audit import AuditLog, LoginAttempt  # noqa: E402
from models.auth import User  # noqa: E402
from models.invitations import Invitation  # noqa: E402
from models.products import Products  # noqa: E402
from services.audit import log_admin_action  # noqa: E402
from core.database import db_manager  # noqa: E402
from services.email import (  # noqa: E402
    send_rescue_forgot_password_email,
    send_rescue_google_age_email,
    send_rescue_publish_email,
    send_rescue_signup_email,
)

AGE_REASON = "Debes confirmar que eres mayor de 18 años para crear una cuenta"
WRONG_PASSWORD = "Email o contraseña incorrectos"
GROUPS = ["contrasena", "google", "publicar", "registro"]
SENDERS = {
    "contrasena": send_rescue_forgot_password_email,
    "google": send_rescue_google_age_email,
    "publicar": send_rescue_publish_email,
    "registro": send_rescue_signup_email,
}


async def collect(db) -> dict[str, list[str]]:
    users = {u.email.lower(): u for u in (await db.execute(select(User))).scalars().all()}
    with_products = set((await db.execute(select(Products.user_id).distinct())).scalars().all())

    # Último acceso correcto de cada email (contraseña o Google).
    last_ok = dict(
        (await db.execute(
            select(func.lower(LoginAttempt.email), func.max(LoginAttempt.created_at))
            .where(LoginAttempt.success.is_(True))
            .group_by(func.lower(LoginAttempt.email))
        )).all()
    )
    failed = (await db.execute(
        select(func.lower(LoginAttempt.email), LoginAttempt.method, LoginAttempt.reason, func.max(LoginAttempt.created_at))
        .where(LoginAttempt.success.is_(False))
        .group_by(func.lower(LoginAttempt.email), LoginAttempt.method, LoginAttempt.reason)
    )).all()

    groups: dict[str, set[str]] = {g: set() for g in GROUPS}
    for email, method, reason, when in failed:
        user = users.get(email)
        ok_after = last_ok.get(email)
        if ok_after and when and ok_after > when:
            continue  # ya consiguió entrar después
        if method == "password" and reason == WRONG_PASSWORD and user and user.password_hash:
            groups["contrasena"].add(email)
        if method == "google" and reason == AGE_REASON and not user:
            groups["google"].add(email)

    invitations = (await db.execute(select(Invitation))).scalars().all()
    for inv in invitations:
        email = (inv.email or "").strip().lower()
        if not email or inv.revoked_at:
            continue
        user = users.get(email)
        if user:
            if user.role == "user" and user.account_status == "active" and user.id not in with_products:
                groups["publicar"].add(email)
        elif inv.status == "pending" and inv.invite_email_sent_at:
            groups["registro"].add(email)

    # Quien ya está en "contraseña" no necesita además el de "publicar".
    groups["publicar"] -= groups["contrasena"]

    already = set(
        (await db.execute(
            select(func.lower(AuditLog.target) + "|" + AuditLog.details).where(AuditLog.action == "rescue_email")
        )).scalars().all()
    )
    return {g: sorted(e for e in emails if f"{e}|{g}" not in already) for g, emails in groups.items()}


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--enviar", action="store_true", help="enviar de verdad (sin esto solo lista)")
    parser.add_argument("--grupo", choices=GROUPS, help="solo este grupo")
    args = parser.parse_args()

    if not db_manager.async_session_maker:
        await db_manager.ensure_initialized()
    async with db_manager.async_session_maker() as db:
        groups = await collect(db)
        chosen = [args.grupo] if args.grupo else GROUPS
        total = 0
        for group in chosen:
            emails = groups[group]
            print(f"\n== {group}: {len(emails)} persona(s)")
            for email in emails:
                if not args.enviar:
                    print(f"   (prueba) {email}")
                    continue
                ok = await SENDERS[group](email)
                print(f"   {'enviado ' if ok else 'FALLÓ   '} {email}")
                if ok:
                    total += 1
                    await log_admin_action(db, None, "system", "rescue_email", target=email, details=group)
                await asyncio.sleep(0.6)  # margen frente al límite de envíos por segundo de Resend
        if args.enviar:
            print(f"\nEnviados: {total}")
        else:
            print("\nNo se ha enviado nada. Para enviar: python scripts/rescatar_usuarios.py --enviar")


if __name__ == "__main__":
    asyncio.run(main())
