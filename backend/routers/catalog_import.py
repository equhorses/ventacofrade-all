"""Importar catálogo desde la web propia del vendedor (plan Profesional).

  GET  /status   → si puede usarlo y qué web tiene en su perfil
  POST /fetch    → lee los productos de su web (Shopify, WooCommerce o cualquier web)
  POST /publish  → publica los elegidos (máx. 20 por tanda); las fotos se copian a nuestro bucket

Solo admin:
  POST /parse-file → lee un Excel/CSV con el catálogo de un vendedor (sin web propia, p. ej. el de
                     Importamatic de Todocolección) para publicarlo en SU cuenta con /publish + seller_email.
  Todocolección / Wallapop, con autorización del vendedor por el mensajero:
  POST /platform/consent-request → le escribe por el mensajero pidiéndole permiso (con casilla)
  GET  /platform/consent         → estado de la autorización
  POST /platform/list            → lista rápida de sus anuncios (para marcar solo los cofrades)
  POST /platform/details         → descripción y fotos de los marcados

El vendedor:
  GET  /consents/{id}         → ver la autorización que se le pide
  POST /consents/{id}/accept  → aceptarla (queda registrado texto, fecha, IP y navegador)
"""

import asyncio
import logging
from typing import Optional

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.auth import User
from models.catalog_import_consents import CatalogImportConsent
from models.categories import Categories
from models.messages import Messages
from models.products import Products
from models.seller_profiles import Seller_profiles
from schemas.auth import UserResponse
from services import catalog_import as ci
from services.audit import log_admin_action
from services.catalog_file import MAX_FILE_BYTES, CatalogFileError, parse_catalog_file
from services import platform_import as pi
from services.watermark import cover_todocoleccion_mark, is_todocoleccion_image
from services.seller_plans import TIER_PRO, seller_tier
from services.storage import StorageNotConfiguredError, StorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/catalog-import", tags=["catalog-import"])

PUBLISH_BATCH_MAX = 20
DOWNLOAD_CONCURRENCY = 6
CONDITIONS = {"nuevo", "usado", "restaurado"}
PROVINCES = {
    "Sevilla", "Málaga", "Cádiz", "Córdoba", "Granada", "Huelva", "Jaén", "Almería",
    "Madrid", "Barcelona", "Valencia", "Murcia", "Otra",
}


async def _profile(db: AsyncSession, user_id: str) -> Optional[Seller_profiles]:
    result = await db.execute(select(Seller_profiles).where(Seller_profiles.user_id == user_id).limit(1))
    return result.scalar_one_or_none()


async def _require_pro(db: AsyncSession, current_user: UserResponse) -> Seller_profiles:
    from routers.seller_profiles import ensure_seller_profile

    profile = await ensure_seller_profile(db, current_user)
    if seller_tier(profile, role=current_user.role) != TIER_PRO:
        raise HTTPException(status_code=403, detail="Importar tu catálogo está incluido en el plan Profesional.")
    return profile


@router.get("/status")
async def status(current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from routers.seller_profiles import ensure_seller_profile

    profile = await ensure_seller_profile(db, current_user)
    return {
        "can_use": seller_tier(profile, role=current_user.role) == TIER_PRO,
        "website": profile.website if profile else None,
        "is_admin": current_user.role == "admin",
        "province": profile.province if profile else None,
        "city": profile.city if profile else None,
        "max_items": ci.MAX_ITEMS,
    }


class FetchRequest(BaseModel):
    url: str
    confirm_owner: bool = False


@router.post("/fetch")
async def fetch_catalog(
    payload: FetchRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = str(current_user.id)
    profile = await _require_pro(db, current_user)
    if not payload.confirm_owner:
        raise HTTPException(status_code=400, detail="Confirma que el catálogo es tuyo.")
    is_admin = current_user.role == "admin"
    if not profile.website and not is_admin:
        raise HTTPException(status_code=400, detail="Primero añade tu página web en Mi perfil.")
    try:
        url = ci.normalize_url(payload.url)
        if ci.is_blocked(url):
            raise ci.ImportErrorForUser(
                "No se puede importar desde redes sociales ni otras plataformas de venta. Usa tu propia web."
            )
        if not is_admin and not ci.same_site(url, profile.website):
            raise ci.ImportErrorForUser(
                "Solo puedes importar desde la web que tienes en tu perfil. Si es otra, cámbiala primero en Mi perfil."
            )
        source, items = await ci.discover(url)
    except ci.ImportErrorForUser as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not items:
        raise HTTPException(
            status_code=404,
            detail="No hemos encontrado productos en esa página. Prueba con la dirección de tu tienda o de tu catálogo.",
        )

    # Marca los que ya tiene publicados (mismo título) para no duplicarlos.
    titles = (
        await db.execute(select(func.lower(Products.title)).where(Products.user_id == user_id))
    ).scalars().all()
    existing = set(titles)
    for it in items:
        it["already_published"] = it["title"].lower() in existing
    return {"source": source, "items": items}


class PublishItem(BaseModel):
    title: str
    description: Optional[str] = None
    price: float
    category_id: int
    condition: str
    images: list[str] = Field(default_factory=list)


class PublishRequest(BaseModel):
    location_province: str
    location_city: Optional[str] = None
    items: list[PublishItem] = Field(min_length=1)
    # Solo admin: publicar en la cuenta de otro vendedor (importación desde archivo o plataforma).
    seller_email: Optional[str] = None
    # Se guardan como borradores: el vendedor los revisa, cambia lo que quiera y los activa.
    as_draft: bool = False
    # Solo admin, fotos de Todocolección: tapar su marca de agua con un recuadro de VentaCofrade.
    cover_tc_watermark: bool = False


async def _target_user(db: AsyncSession, email: str) -> UserResponse:
    normalized = (email or "").strip().lower()
    if not normalized:
        raise HTTPException(status_code=400, detail="Escribe el email de la cuenta del vendedor.")
    user = (
        await db.execute(select(User).where(func.lower(User.email) == normalized).limit(1))
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="No hay ninguna cuenta con ese email. El vendedor tiene que registrarse primero (gratis).",
        )
    if user.account_status == "banned":
        raise HTTPException(status_code=400, detail="Esa cuenta está bloqueada.")
    return UserResponse.model_validate(user)


@router.post("/parse-file")
async def parse_file(
    file: UploadFile = File(...),
    seller_email: str = Form(...),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo el administrador puede importar para otro vendedor.")
    seller = await _target_user(db, seller_email)
    data = await file.read(MAX_FILE_BYTES + 1)
    try:
        parsed = parse_catalog_file(file.filename or "", data)
    except CatalogFileError as e:
        raise HTTPException(status_code=400, detail=str(e))

    titles = (
        await db.execute(select(func.lower(Products.title)).where(Products.user_id == str(seller.id)))
    ).scalars().all()
    existing = set(titles)
    for it in parsed["items"]:
        it["already_published"] = it["title"].lower() in existing
    profile = await _profile(db, str(seller.id))
    parsed["seller"] = {
        "email": seller.email,
        "name": seller.name,
        "shop_name": profile.shop_name if profile else None,
        "province": profile.province if profile else None,
        "city": profile.city if profile else None,
        "published": len(titles),
    }
    return parsed


@router.post("/publish")
async def publish(
    payload: PublishRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    on_behalf = bool(payload.seller_email)
    if on_behalf:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Solo el administrador puede publicar para otro vendedor.")
        from routers.seller_profiles import ensure_seller_profile

        seller = await _target_user(db, payload.seller_email)
        profile = await ensure_seller_profile(db, seller)
        user_id = str(seller.id)
    else:
        user_id = str(current_user.id)
        profile = await _require_pro(db, current_user)
    if len(payload.items) > PUBLISH_BATCH_MAX:
        raise HTTPException(status_code=400, detail=f"Máximo {PUBLISH_BATCH_MAX} anuncios por tanda.")
    if payload.location_province not in PROVINCES:
        raise HTTPException(status_code=400, detail="Elige una provincia válida.")
    try:
        storage = StorageService()
    except StorageNotConfiguredError:
        raise HTTPException(status_code=503, detail="La subida de imágenes no está disponible ahora mismo.")

    category_ids = set((await db.execute(select(Categories.id))).scalars().all())
    for n, item in enumerate(payload.items, start=1):
        if len(item.title.strip()) < 3:
            raise HTTPException(status_code=400, detail=f"«{item.title[:40]}»: falta el título.")
        if not (0 < item.price <= 1_000_000):
            raise HTTPException(status_code=400, detail=f"«{item.title[:40]}»: pon un precio válido.")
        if item.category_id not in category_ids:
            raise HTTPException(status_code=400, detail=f"«{item.title[:40]}»: elige una categoría.")
        if item.condition not in CONDITIONS:
            raise HTTPException(status_code=400, detail=f"«{item.title[:40]}»: elige el estado.")

    # Copia las fotos a nuestro bucket (si la web del vendedor cambia, sus anuncios no se quedan sin fotos).
    cover_mark = on_behalf and payload.cover_tc_watermark
    wanted = {u for it in payload.items for u in it.images[:ci.MAX_PHOTOS] if not storage.is_own_url(u)}
    copied: dict[str, str] = {}
    semaphore = asyncio.Semaphore(DOWNLOAD_CONCURRENCY)

    async def copy(url: str, client):
        async with semaphore:
            try:
                data, content_type = await ci.download_image(client, url)
                # Todas las fotos llevan el sello de VentaCofrade abajo a la derecha (en las de
                # Todocolección, además, tapa su marca de agua).
                if cover_mark or not is_todocoleccion_image(url):
                    try:
                        data, content_type = await asyncio.to_thread(cover_todocoleccion_mark, data)
                    except Exception as exc:
                        logger.info("No se pudo tapar la marca de %s (%s)", url, exc)
                copied[url] = await asyncio.to_thread(storage.put_bytes, data, content_type, "products", user_id)
            except Exception as exc:
                logger.info("Importar catálogo: foto no copiada %s (%s)", url, exc)

    if wanted:
        async with ci.http_client() as client:
            await asyncio.gather(*(copy(u, client) for u in wanted))

    vacation = bool(profile.vacation_mode) and not payload.as_draft
    city = (payload.location_city or "").strip()[:100] or None
    created, without_photos = [], 0
    for item in payload.items:
        images = [u if storage.is_own_url(u) else copied.get(u) for u in item.images[:ci.MAX_PHOTOS]]
        images = [u for u in images if u]
        if item.images and not images:
            without_photos += 1
        product = Products(
            user_id=user_id,
            title=item.title.strip()[:ci.TITLE_MAX],
            description=(item.description or "").strip()[:ci.DESCRIPTION_MAX] or None,
            price=round(item.price, 2),
            category_id=item.category_id,
            condition=item.condition,
            location_province=payload.location_province,
            location_city=city,
            images=",".join(images) or None,
            status="draft" if payload.as_draft else ("paused" if vacation else "active"),
            paused_by_vacation=vacation,
        )
        db.add(product)
        created.append(product)
    await db.commit()
    logger.info("Importar catálogo: user=%s publicados=%s", user_id, len(created))
    if on_behalf:
        await log_admin_action(
            db, current_user.id, current_user.email, "catalog_import_for_seller",
            target=payload.seller_email.strip().lower(), details=f"{len(created)} anuncios",
        )
    return {
        "created": len(created),
        "without_photos": without_photos,
        "vacation_mode": vacation,
        "product_ids": [p.id for p in created],
    }



# ---------- Todocolección / Wallapop con autorización del vendedor ----------
PLATFORM_NAMES = {"todocoleccion": "Todocolección", "wallapop": "Wallapop"}
CONSENT_MARKER = "[[autorizacion-catalogo:{id}]]"
SUPPORT_PRODUCT_ID = 0


def _consent_text(platform: str, url: str) -> str:
    name = PLATFORM_NAMES.get(platform, platform)
    return (
        f"Autorizo a VentaCofrade a copiar los anuncios de mi tienda en {name} ({url}) que elijamos, "
        "con sus títulos, descripciones, precios y fotos, y a publicarlos en mi cuenta de VentaCofrade. "
        "Declaro que esos anuncios, sus textos y sus fotos son míos. "
        "Puedo cambiar, pausar o borrar cualquiera de ellos cuando quiera desde «Mis anuncios»."
    )


def _require_admin(current_user: UserResponse):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo el administrador puede hacer esto.")


def _consent_out(c: Optional[CatalogImportConsent]) -> Optional[dict]:
    if not c:
        return None
    return {
        "id": c.id,
        "status": c.status,
        "source_url": c.source_url,
        "consent_text": c.consent_text,
        "created_at": c.created_at,
        "accepted_at": c.accepted_at,
    }


async def _latest_consent(db: AsyncSession, user_id: str, key: str) -> Optional[CatalogImportConsent]:
    return (
        await db.execute(
            select(CatalogImportConsent)
            .where(CatalogImportConsent.user_id == user_id, CatalogImportConsent.source_key == key)
            .order_by(CatalogImportConsent.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def _accepted_consent(db: AsyncSession, seller: UserResponse, url: str) -> tuple[str, CatalogImportConsent]:
    try:
        key = pi.source_key(ci.normalize_url(url))
    except ci.ImportErrorForUser as e:
        raise HTTPException(status_code=400, detail=str(e))
    consent = await _latest_consent(db, str(seller.id), key)
    if not consent or consent.status != "accepted":
        raise HTTPException(
            status_code=403,
            detail="El vendedor todavía no ha aceptado la autorización para esa tienda. Pídesela primero.",
        )
    return key, consent


class PlatformRequest(BaseModel):
    seller_email: str
    url: str
    keywords: Optional[str] = None  # solo lista los que coincidan (p. ej. "semana santa")


@router.post("/platform/consent-request")
async def platform_consent_request(
    payload: PlatformRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    seller = await _target_user(db, payload.seller_email)
    try:
        url = ci.normalize_url(payload.url)
        key = pi.source_key(url)
    except ci.ImportErrorForUser as e:
        raise HTTPException(status_code=400, detail=str(e))
    platform = key.split(":", 1)[0]

    existing = await _latest_consent(db, str(seller.id), key)
    if existing and existing.status in ("accepted", "pending"):
        return {"consent": _consent_out(existing), "already": True}

    consent = CatalogImportConsent(
        user_id=str(seller.id),
        email=seller.email.lower(),
        source_key=key,
        source_url=url,
        consent_text=_consent_text(platform, url),
        status="pending",
        requested_by_email=current_user.email,
    )
    db.add(consent)
    await db.flush()

    name = PLATFORM_NAMES[platform]
    # Sin nombre: el de la cuenta no siempre es como le llaman (p. ej. "Francisco Víctor").
    hello = "Hola"
    text = (
        f"{hello}, para que no tengas que subir tu catálogo a mano, podemos traer a VentaCofrade "
        f"tus anuncios de {name}, con sus fotos, descripciones y precios. "
        "Solo subiremos los artículos cofrades, y los podrás cambiar o quitar cuando quieras.\n\n"
        "Si te parece bien, marca la casilla de abajo y pulsa «Aceptar».\n\n"
        + CONSENT_MARKER.format(id=consent.id)
    )
    message = Messages(
        user_id=str(current_user.id),
        receiver_id=str(seller.id),
        product_id=SUPPORT_PRODUCT_ID,
        content=text,
        is_read=False,
    )
    db.add(message)
    await db.flush()
    consent.message_id = message.id
    await db.commit()
    await db.refresh(consent)

    await log_admin_action(
        db, current_user.id, current_user.email, "catalog_consent_requested", target=seller.email.lower(), details=key
    )
    try:
        from services.email import SITE_URL, send_new_support_message_email

        await send_new_support_message_email(
            seller.email,
            seller.name,
            f"Podemos traer tus anuncios de {name} a VentaCofrade. Solo necesitamos tu permiso.",
            f"{SITE_URL}/cuenta/mensajes/{SUPPORT_PRODUCT_ID}/{current_user.id}",
        )
    except Exception as exc:  # el aviso por email nunca debe impedir la petición
        logger.warning("No se pudo avisar por email de la autorización: %s", exc)
    return {"consent": _consent_out(consent), "already": False}


@router.get("/platform/consent")
async def platform_consent_status(
    seller_email: str,
    url: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    seller = await _target_user(db, seller_email)
    try:
        key = pi.source_key(ci.normalize_url(url))
    except ci.ImportErrorForUser as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"consent": _consent_out(await _latest_consent(db, str(seller.id), key))}


@router.post("/platform/list")
async def platform_list(
    payload: PlatformRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    seller = await _target_user(db, payload.seller_email)
    await _accepted_consent(db, seller, payload.url)
    try:
        platform, items = await pi.list_items(payload.url, payload.keywords)
    except ci.ImportErrorForUser as e:
        raise HTTPException(status_code=400, detail=str(e))
    titles = set(
        (await db.execute(select(func.lower(Products.title)).where(Products.user_id == str(seller.id)))).scalars().all()
    )
    for it in items:
        it["already_published"] = it["title"].lower() in titles
    profile = await _profile(db, str(seller.id))
    return {
        "platform": platform,
        "items": items,
        "seller": {
            "email": seller.email,
            "name": seller.name,
            "shop_name": profile.shop_name if profile else None,
            "province": profile.province if profile else None,
            "city": profile.city if profile else None,
            "published": len(titles),
        },
    }


class PlatformDetailsRequest(PlatformRequest):
    item_urls: list[str] = Field(min_length=1, max_length=pi.DETAIL_BATCH_MAX)


@router.post("/platform/details")
async def platform_details(
    payload: PlatformDetailsRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    seller = await _target_user(db, payload.seller_email)
    key, _ = await _accepted_consent(db, seller, payload.url)
    return {"items": await pi.item_details(payload.item_urls, key)}


@router.get("/consents/{consent_id}")
async def get_consent(
    consent_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    consent = await db.get(CatalogImportConsent, consent_id)
    if not consent or (consent.user_id != str(current_user.id) and current_user.role != "admin"):
        raise HTTPException(status_code=404, detail="Autorización no encontrada")
    return _consent_out(consent)


class AcceptConsentRequest(BaseModel):
    accept: bool


@router.post("/consents/{consent_id}/accept")
async def accept_consent(
    consent_id: int,
    payload: AcceptConsentRequest,
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    consent = await db.get(CatalogImportConsent, consent_id)
    if not consent or consent.user_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="Autorización no encontrada")
    if not payload.accept:
        raise HTTPException(status_code=400, detail="Marca la casilla para aceptar.")
    if consent.status == "accepted":
        return _consent_out(consent)
    if consent.status != "pending":
        raise HTTPException(status_code=400, detail="Esta autorización ya no está activa.")
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    consent.status = "accepted"
    consent.accepted_at = datetime.now(timezone.utc)
    consent.accepted_ip = (forwarded or (request.client.host if request.client else ""))[:100] or None
    consent.accepted_user_agent = (request.headers.get("user-agent") or "")[:500] or None
    await db.commit()
    await db.refresh(consent)
    await log_admin_action(
        db, current_user.id, current_user.email, "catalog_consent_accepted",
        target=consent.email, details=f"{consent.source_key} (ip {consent.accepted_ip})",
    )
    try:
        import html as htmllib

        from services.admin_alerts import alert_email
        from services.email import SITE_URL, _email_shell, _send_via_resend

        await _send_via_resend(
            alert_email(),
            f"Autorización aceptada: {consent.email}",
            _email_shell(
                "Autorización aceptada",
                f"<p><strong>{htmllib.escape(consent.email)}</strong> ha aceptado que importemos sus anuncios de "
                f"{htmllib.escape(consent.source_url)}.</p><p>Ya puedes traerlos desde Importar catálogo.</p>",
                "Ir a Importar catálogo",
                f"{SITE_URL}/cuenta/importar",
            ),
            "aviso autorización catálogo",
        )
    except Exception as exc:
        logger.warning("No se pudo avisar de la autorización aceptada: %s", exc)
    return _consent_out(consent)



class NotifyDraftsRequest(BaseModel):
    seller_email: str
    count: int = Field(ge=1)


@router.post("/notify-seller-drafts")
async def notify_seller_drafts(
    payload: NotifyDraftsRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Avisa al vendedor (mensajero + email) de que tiene anuncios en borrador para revisar y activar."""
    _require_admin(current_user)
    seller = await _target_user(db, payload.seller_email)
    n = payload.count
    text = (
        f"¡Hola! Ya tienes {n} {'anuncio preparado' if n == 1 else 'anuncios preparados'} en tu cuenta, "
        "en borrador: todavía no los ve nadie.\n\n"
        "Entra en «Mis anuncios», revísalos y pulsa «Activar» en los que estén bien (o «Activar todos»). "
        "Con «Editar» puedes cambiar lo que quieras. Te recomendamos poner tus fotos originales: "
        "las que vienen de otras plataformas pueden llevar su marca de agua."
    )
    db.add(Messages(
        user_id=str(current_user.id), receiver_id=str(seller.id), product_id=SUPPORT_PRODUCT_ID,
        content=text, is_read=False,
    ))
    await db.commit()
    await log_admin_action(
        db, current_user.id, current_user.email, "catalog_drafts_notified", target=seller.email.lower(), details=str(n)
    )
    try:
        from services.email import SITE_URL, send_new_support_message_email

        await send_new_support_message_email(
            seller.email,
            seller.name,
            f"Tienes {n} {'anuncio' if n == 1 else 'anuncios'} en borrador listos para revisar y activar.",
            f"{SITE_URL}/cuenta/anuncios",
        )
    except Exception as exc:
        logger.warning("No se pudo avisar por email de los borradores: %s", exc)
    return {"ok": True}
