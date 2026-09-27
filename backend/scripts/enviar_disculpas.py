"""Email de disculpas por los fallos de la salida, a todo el mundo, una sola vez.

Cada persona recibe UN email con el botón que le sirve:
  contrasena    -> tiene cuenta, falló la contraseña y no ha vuelto a entrar
  con_anuncios  -> tiene cuenta y ya ha publicado
  publicar      -> tiene cuenta y no ha publicado
  google        -> se quedó fuera al registrarse con Google (casilla de edad)
  registro      -> invitado o de la lista de espera que no llegó a crear cuenta

Uso (consola del BACKEND de Railway, no la de Postgres):
  python scripts/enviar_disculpas.py                 -> solo lista a quién iría (no envía nada)
  python scripts/enviar_disculpas.py --prueba tu@email.com   -> te lo manda solo a ti para verlo
  python scripts/enviar_disculpas.py --enviar        -> envía a todos

Quien ya lo recibió no lo vuelve a recibir (queda en la auditoría como "rescue_email").
"""

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func, select  # noqa: E402

from core.database import db_manager  # noqa: E402
from models.audit import AuditLog, LoginAttempt  # noqa: E402
from models.auth import User  # noqa: E402
from models.invitations import Invitation  # noqa: E402
from models.products import Products  # noqa: E402
from models.waitlist import Waitlist  # noqa: E402
from services.audit import log_admin_action  # noqa: E402
from services.email import send_apology_email  # noqa: E402

AGE_REASON = "Debes confirmar que eres mayor de 18 años para crear una cuenta"
WRONG_PASSWORD = "Email o contraseña incorrectos"
ORDER = ["contrasena", "google", "publicar", "con_anuncios", "registro"]


async def collect(db) -> list[tuple[str, str, str]]:
    """Devuelve [(email, grupo, origen)] sin repetir a nadie."""
    users = {u.email.lower(): u for u in (await db.execute(select(User))).scalars().all()}
    with_products = set((await db.execute(select(Products.user_id).distinct())).scalars().all())
    waitlist = {e.lower() for e in (await db.execute(select(Waitlist.email))).scalars().all()}
    invitations = (await db.execute(select(Invitation))).scalars().all()
    invited = {(i.email or "").lower() for i in invitations}

    ok_after = dict(
        (await db.execute(
            select(func.lower(LoginAttempt.email), func.max(LoginAttempt.created_at))
            .where(LoginAttempt.success.is_(True)).group_by(func.lower(LoginAttempt.email))
        )).all()
    )
    failed = (await db.execute(
        select(func.lower(LoginAttempt.email), LoginAttempt.method, LoginAttempt.reason, func.max(LoginAttempt.created_at))
        .where(LoginAttempt.success.is_(False))
        .group_by(func.lower(LoginAttempt.email), LoginAttempt.method, LoginAttempt.reason)
    )).all()

    group: dict[str, str] = {}
    for email, method, reason, when in failed:
        last_ok = ok_after.get(email)
        if last_ok and when and last_ok > when:
            continue
        user = users.get(email)
        if method == "password" and reason == WRONG_PASSWORD and user and user.password_hash:
            group[email] = "contrasena"
        elif method == "google" and reason == AGE_REASON and not user:
            group[email] = "google"

    for email, user in users.items():
        if user.role != "user" or user.account_status == "banned" or email in group:
            continue
        group[email] = "con_anuncios" if user.id in with_products else "publicar"

    revoked = {(i.email or "").lower() for i in invitations if i.revoked_at}
    for email in (invited | waitlist) - set(users) - revoked:
        if email and email not in group:
            group[email] = "registro"

    already = {
        (t or "").lower()
        for t in (await db.execute(
            select(AuditLog.target).where(AuditLog.action == "rescue_email", AuditLog.details.like("disculpas%"))
        )).scalars().all()
    }

    def origin(email: str) -> str:
        if email in waitlist:
            return "lista de espera"
        if email in invited:
            return "invitado"
        return "registro normal"

    rows = [(e, g, origin(e)) for e, g in group.items() if e not in already]
    return sorted(rows, key=lambda r: (ORDER.index(r[1]), r[0]))


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--enviar", action="store_true")
    parser.add_argument("--prueba", metavar="EMAIL")
    args = parser.parse_args()

    if not db_manager.async_session_maker:
        await db_manager.ensure_initialized()

    if args.prueba:
        ok = await send_apology_email(args.prueba, "publicar")
        print("Prueba enviada" if ok else "La prueba ha fallado (revisa RESEND_API_KEY en Railway)")
        return

    async with db_manager.async_session_maker() as db:
        rows = await collect(db)
        for g in ORDER:
            subset = [r for r in rows if r[1] == g]
            print(f"\n== {g}: {len(subset)}")
            for email, _, origin in subset:
                print(f"   {email:45s} ({origin})")
        print(f"\nTotal: {len(rows)} personas")

        if not args.enviar:
            print("No se ha enviado nada. Para enviar: python scripts/enviar_disculpas.py --enviar")
            return

        sent = failed = 0
        for email, g, _ in rows:
            if await send_apology_email(email, g):
                sent += 1
                await log_admin_action(db, None, "system", "rescue_email", target=email, details=f"disculpas:{g}")
            else:
                failed += 1
                print(f"   FALLÓ {email}")
            await asyncio.sleep(0.6)  # margen frente al límite de Resend
        print(f"\nTerminado: {sent} enviados, {failed} fallidos.")


if __name__ == "__main__":
    asyncio.run(main())
