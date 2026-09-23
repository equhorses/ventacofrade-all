"""Envío manual del email "Ya puedes publicar" a la lista de espera.

Usa el mismo email y la misma marca (Waitlist.launch_email_sent_at) que el
envío automático del día de lanzamiento, así que nadie lo recibe dos veces:
el job diario del 1 de octubre ya no encontrará a quién enviarlo.

Uso, desde la consola del backend en Railway (carpeta /app):
  python -m scripts.send_launch_email_now                  -> solo cuenta, no envía nada
  python -m scripts.send_launch_email_now --test EMAIL     -> envía una prueba a EMAIL (no marca nada)
  python -m scripts.send_launch_email_now --send           -> envía a toda la lista pendiente
"""

import asyncio
import sys
from datetime import datetime, timezone

from sqlalchemy import select

from core.database import db_manager
from models.waitlist import Waitlist
from services.email import send_launch_announcement_email

PAUSE_SECONDS = 0.6  # margen frente al límite de envíos por segundo de Resend


async def main(argv: list[str]) -> None:
    if not db_manager.async_session_maker:
        await db_manager.ensure_initialized()

    if len(argv) >= 2 and argv[0] == "--test":
        ok = await send_launch_announcement_email(to_email=argv[1])
        print("Prueba enviada" if ok else "La prueba ha fallado (revisa los logs)")
        return

    async with db_manager.async_session_maker() as db:
        result = await db.execute(
            select(Waitlist).where(Waitlist.launch_email_sent_at.is_(None)).order_by(Waitlist.id)
        )
        entries = result.scalars().all()
        print(f"Pendientes de recibir el email: {len(entries)}")

        if "--send" not in argv:
            print("Modo prueba: no se ha enviado nada. Añade --send para enviar.")
            return

        sent = failed = 0
        for entry in entries:
            ok = await send_launch_announcement_email(to_email=entry.email)
            if ok:
                entry.launch_email_sent_at = datetime.now(timezone.utc)
                await db.commit()
                sent += 1
            else:
                failed += 1
            if (sent + failed) % 25 == 0:
                print(f"  ... {sent + failed}/{len(entries)}")
            await asyncio.sleep(PAUSE_SECONDS)

        print(f"Terminado: {sent} enviados, {failed} fallidos.")
        if failed:
            print("Los fallidos siguen pendientes; puedes volver a lanzar --send más tarde.")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
