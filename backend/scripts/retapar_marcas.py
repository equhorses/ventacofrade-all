"""Vuelve a tapar la marca de Todocolección en las fotos ya subidas de un vendedor (con el recuadro nuevo, más grande).

Pone el recuadro morado encima de cada foto de sus BORRADORES (el nuevo es mayor que el anterior y lo cubre
por completo, así que no hacen falta las fotos originales). Sube las fotos corregidas y actualiza los anuncios.

Uso (consola del BACKEND de Railway, no la de Postgres):
  python scripts/retapar_marcas.py --email vendedor@correo.com            -> solo cuenta qué haría
  python scripts/retapar_marcas.py --email vendedor@correo.com --aplicar  -> lo hace
"""

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx  # noqa: E402
from sqlalchemy import func, select  # noqa: E402

from core.database import db_manager  # noqa: E402
from models.auth import User  # noqa: E402
from models.products import Products  # noqa: E402
from services.storage import StorageService  # noqa: E402
from services.watermark import cover_todocoleccion_mark  # noqa: E402


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--aplicar", action="store_true")
    args = parser.parse_args()

    if not db_manager.async_session_maker:
        await db_manager.ensure_initialized()
    storage = StorageService()

    async with db_manager.async_session_maker() as db:
        user = (
            await db.execute(select(User).where(func.lower(User.email) == args.email.strip().lower()))
        ).scalar_one_or_none()
        if not user:
            print("No hay ninguna cuenta con ese email.")
            return
        products = (
            await db.execute(select(Products).where(Products.user_id == str(user.id), Products.status == "draft"))
        ).scalars().all()
        total_photos = sum(len([u for u in (p.images or "").split(",") if u]) for p in products)
        print(f"{user.email}: {len(products)} borradores, {total_photos} fotos.")
        if not args.aplicar:
            print("No se ha cambiado nada. Para hacerlo: añade --aplicar")
            return

        done = failed = 0
        async with httpx.AsyncClient(timeout=30) as client:
            for n, product in enumerate(products, start=1):
                new_urls = []
                for url in [u for u in (product.images or "").split(",") if u]:
                    if not storage.is_own_url(url):
                        new_urls.append(url)
                        continue
                    try:
                        response = await client.get(url)
                        response.raise_for_status()
                        data, ctype = await asyncio.to_thread(cover_todocoleccion_mark, response.content)
                        new_urls.append(await asyncio.to_thread(storage.put_bytes, data, ctype, "products", str(user.id)))
                        done += 1
                    except Exception as exc:  # si una foto falla, se deja la que había
                        print(f"   foto no corregida en «{product.title[:40]}»: {exc}")
                        new_urls.append(url)
                        failed += 1
                product.images = ",".join(new_urls)
                await db.commit()
                if n % 20 == 0:
                    print(f"   {n} de {len(products)} anuncios…")
        print(f"Terminado: {done} fotos corregidas, {failed} sin corregir.")


if __name__ == "__main__":
    asyncio.run(main())
