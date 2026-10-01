"""Exporta en un ZIP las fotos de unos anuncios, SIN marca de agua, para usarlas en publicidad.

Si una foto lleva abajo a la derecha el recuadro morado de VentaCofrade (el que tapa la marca de Todocolección
en las importadas, o el sello que se pone al subir desde la web), se recorta esa franja de abajo entera,
así no queda ninguna marca. Las fotos sin recuadro van tal cual.
El ZIP se sube al almacenamiento y se imprime el enlace para descargarlo.

Uso (consola del BACKEND de Railway, no la de Postgres):
  python scripts/exportar_fotos.py --ids 120,119,91 --nombre fotos-victor
"""

import argparse
import asyncio
import io
import math
import os
import re
import sys
import time
import unicodedata
import zipfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx  # noqa: E402
from sqlalchemy import select  # noqa: E402

from core.database import db_manager  # noqa: E402
from models.products import Products  # noqa: E402
from services.storage import StorageService  # noqa: E402
from services.watermark import BOX_TOP, BRAND_COLOR, REF_H, REF_W  # noqa: E402

CROP_MARGIN = 4  # px de sobra (a escala de referencia) por encima del recuadro


def slug(text: str, max_len: int = 60) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text[:max_len].strip("-") or "anuncio"


def has_brand_box(img) -> bool:
    """True si abajo a la derecha está el recuadro morado de VentaCofrade (importación o subida desde la web)."""
    w, h = img.size
    scale = max(1.0, w / REF_W, h / REF_H)
    # Franja central del recuadro: entre el logo y el borde, a media altura.
    y = int(h - (BOX_TOP / 2) * scale)
    xs = [int(w - f * scale) for f in (30, 50, 70, 90, 110)]
    hits = 0
    for x in xs:
        if 0 <= x < w and 0 <= y < h:
            r, g, b = img.getpixel((x, y))
            if abs(r - BRAND_COLOR[0]) < 40 and abs(g - BRAND_COLOR[1]) < 40 and abs(b - BRAND_COLOR[2]) < 40:
                hits += 1
    return hits >= 2


def remove_mark(data: bytes) -> tuple[bytes, bool]:
    """Devuelve la foto en JPEG; si lleva el recuadro de VentaCofrade abajo, recorta esa franja entera."""
    from PIL import Image

    img = Image.open(io.BytesIO(data)).convert("RGB")
    w, h = img.size
    cropped = False
    if w >= 200 and h >= 150 and has_brand_box(img):
        scale = max(1.0, w / REF_W, h / REF_H)
        cut = math.ceil((BOX_TOP + CROP_MARGIN) * scale)
        img = img.crop((0, 0, w, max(1, h - cut)))
        cropped = True
    out = io.BytesIO()
    img.save(out, "JPEG", quality=95)
    return out.getvalue(), cropped


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ids", required=True, help="ids de los anuncios separados por comas")
    parser.add_argument("--nombre", default="fotos", help="nombre del ZIP")
    args = parser.parse_args()
    ids = [int(x) for x in re.findall(r"\d+", args.ids)]

    if not db_manager.async_session_maker:
        await db_manager.ensure_initialized()
    storage = StorageService()

    async with db_manager.async_session_maker() as db:
        products = (await db.execute(select(Products).where(Products.id.in_(ids)))).scalars().all()
    by_id = {p.id: p for p in products}

    buffer = io.BytesIO()
    total = 0
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_STORED) as zf:
            for pid in ids:
                product = by_id.get(pid)
                if not product:
                    print(f"{pid}: no existe")
                    continue
                folder = f"{pid}-{slug(product.title)}"
                urls = [u.strip() for u in (product.images or "").split(",") if u.strip()]
                n = 0
                for url in urls:
                    try:
                        response = await client.get(url)
                        response.raise_for_status()
                        data, _ = await asyncio.to_thread(remove_mark, response.content)
                        n += 1
                        zf.writestr(f"{folder}/{n:02d}.jpg", data)
                    except Exception as exc:
                        print(f"   {pid}: foto no descargada ({exc})")
                total += n
                print(f"{pid}  {product.title[:60]}  -> {n} fotos")

    key = f"exports/{slug(args.nombre)}-{int(time.time())}.zip"
    storage.client.put_object(Bucket=storage.bucket_name, Key=key, Body=buffer.getvalue(), ContentType="application/zip")
    print(f"\n{total} fotos. Descarga el ZIP aquí:\n{storage.public_url}/{key}")


if __name__ == "__main__":
    asyncio.run(main())
