"""Subida masiva de anuncios por CSV o Excel (plan Profesional).

Flujo en el frontend (/cuenta/subida-masiva):
  1. GET  /template?format=xlsx|csv  → plantilla para rellenar
  2. POST /preview (archivo)         → cada fila validada, con sus errores y las fotos que pide
  3. El navegador sube a R2 las fotos adjuntadas que el archivo nombra (subida firmada de siempre)
  4. POST /confirm por tandas de 20  → crea los anuncios; las fotos por URL se copian al bucket
"""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.categories import Categories
from models.products import Products
from models.seller_profiles import Seller_profiles
from schemas.auth import UserResponse
from services import bulk_import as bi
from services.seller_plans import TIER_PRO, seller_tier
from services.storage import StorageNotConfiguredError, StorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/bulk-import", tags=["bulk-import"])

CONFIRM_BATCH_MAX = 25
DOWNLOAD_CONCURRENCY = 6


async def _require_pro(db: AsyncSession, user_id: str) -> Seller_profiles:
    result = await db.execute(select(Seller_profiles).where(Seller_profiles.user_id == user_id).limit(1))
    profile = result.scalar_one_or_none()
    if not profile or seller_tier(profile) != TIER_PRO:
        raise HTTPException(status_code=403, detail="La subida masiva está incluida en el plan Profesional.")
    return profile


async def _categories(db: AsyncSession) -> tuple[dict, list[str]]:
    rows = (await db.execute(select(Categories).order_by(Categories.order_index, Categories.id))).scalars().all()
    lookup = {}
    for c in rows:
        for key in (c.name, c.slug, str(c.id)):
            if key:
                lookup.setdefault(bi.norm(key), (c.id, c.name))
    return lookup, [c.name for c in rows]


@router.get("/template")
async def download_template(
    format: str = Query("xlsx", pattern="^(xlsx|csv)$"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _, names = await _categories(db)
    if format == "csv":
        return Response(
            content=bi.template_csv(names),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="plantilla-ventacofrade.csv"'},
        )
    return Response(
        content=bi.template_xlsx(names),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="plantilla-ventacofrade.xlsx"'},
    )


@router.post("/preview")
async def preview_import(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_pro(db, str(current_user.id))
    raw = await file.read(bi.MAX_FILE_BYTES + 1)
    try:
        rows = bi.read_rows(file.filename or "", raw)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    categories, _ = await _categories(db)
    items, local_files = [], set()
    for r in rows:
        data, errors = bi.validate_row(r["values"], categories)
        for token in data["photos"]:
            if not bi.is_url(token):
                local_files.add(bi.photo_filename(token))
        items.append({"row": r["row"], "data": data, "errors": errors})

    valid = sum(1 for i in items if not i["errors"])
    return {
        "total": len(items),
        "valid": valid,
        "invalid": len(items) - valid,
        "rows": items,
        "local_photos": sorted(local_files),
        "max_rows": bi.MAX_ROWS,
    }


class ConfirmRow(BaseModel):
    row: int
    title: Optional[str] = None
    price: Optional[float] = None
    category_id: Optional[int] = None
    condition: Optional[str] = None
    location_province: Optional[str] = None
    location_city: Optional[str] = None
    description: Optional[str] = None
    photos: list[str] = Field(default_factory=list)


class ConfirmRequest(BaseModel):
    rows: list[ConfirmRow]
    # nombre de archivo (en minúsculas) → URL pública ya subida a R2 desde el navegador
    photo_urls: dict[str, str] = Field(default_factory=dict)


@router.post("/confirm")
async def confirm_import(
    payload: ConfirmRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = str(current_user.id)
    profile = await _require_pro(db, user_id)
    if not payload.rows:
        raise HTTPException(status_code=400, detail="No hay anuncios que crear.")
    if len(payload.rows) > CONFIRM_BATCH_MAX:
        raise HTTPException(status_code=400, detail=f"Máximo {CONFIRM_BATCH_MAX} anuncios por tanda.")

    try:
        storage = StorageService()
    except StorageNotConfiguredError:
        raise HTTPException(status_code=503, detail="La subida de imágenes no está disponible ahora mismo.")

    categories, _ = await _categories(db)
    photo_urls = {k.lower(): v for k, v in payload.photo_urls.items() if storage.is_own_url(v)}

    # Se vuelve a validar todo en el servidor: no nos fiamos de lo que llega del navegador.
    prepared = []
    for r in payload.rows:
        values = {
            "title": r.title, "price": r.price, "category": r.category_id, "condition": r.condition,
            "province": r.location_province, "city": r.location_city, "description": r.description,
            "photos": "|".join(r.photos),
        }
        data, errors = bi.validate_row(values, categories)
        prepared.append((r.row, data, errors))

    # Fotos por URL: se descargan en paralelo (con límite) y se copian a nuestro bucket.
    remote = {t for _, d, e in prepared if not e for t in d["photos"] if bi.is_url(t) and not storage.is_own_url(t)}
    copied: dict[str, str] = {}
    failed: dict[str, str] = {}
    semaphore = asyncio.Semaphore(DOWNLOAD_CONCURRENCY)

    async def fetch(url: str, client):
        async with semaphore:
            try:
                data, content_type = await bi.download_image(client, url)
                copied[url] = await asyncio.to_thread(storage.put_bytes, data, content_type, "products", user_id)
            except Exception as exc:  # cualquier fallo de una foto no debe tumbar la tanda
                failed[url] = str(exc) if isinstance(exc, ValueError) else "no se pudo descargar"

    if remote:
        async with bi.http_client() as client:
            await asyncio.gather(*(fetch(u, client) for u in remote))

    vacation = bool(profile.vacation_mode)
    results = []
    for row, data, errors in prepared:
        if errors:
            results.append({"row": row, "ok": False, "errors": errors})
            continue
        images, warnings = [], []
        for token in data["photos"]:
            if bi.is_url(token):
                if storage.is_own_url(token):
                    images.append(token)
                elif token in copied:
                    images.append(copied[token])
                else:
                    warnings.append(f"Foto {token}: {failed.get(token, 'no se pudo descargar')}.")
            else:
                name = bi.photo_filename(token)
                if name in photo_urls:
                    images.append(photo_urls[name])
                else:
                    warnings.append(f"No has adjuntado la foto «{name}».")
        product = Products(
            user_id=user_id,
            title=data["title"],
            description=data["description"],
            price=data["price"],
            category_id=data["category_id"],
            condition=data["condition"],
            location_province=data["location_province"],
            location_city=data["location_city"],
            images=",".join(images) or None,
            status="paused" if vacation else "active",
            paused_by_vacation=vacation,
        )
        db.add(product)
        results.append({"row": row, "ok": True, "warnings": warnings, "_product": product})

    await db.commit()
    for r in results:
        product = r.pop("_product", None)
        if product is not None:
            r["product_id"] = product.id

    created = sum(1 for r in results if r["ok"])
    logger.info("Subida masiva: user=%s creados=%s de %s", user_id, created, len(results))
    return {"created": created, "vacation_mode": vacation, "results": results}
