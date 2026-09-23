"""Páginas HTML para buscadores, asistentes de IA y previsualizaciones de enlaces.

La web (React en Vercel) pinta los anuncios con JavaScript, y la mayoría de
rastreadores no lo ejecutan. Vercel reenvía aquí las visitas de bots a
/producto/:id y /explorar, y este router devuelve el mismo contenido en HTML
plano: título, descripción, precio, fotos y datos estructurados.

Solo se muestran anuncios activos y datos que ya son públicos en la web.
No se incrementa el contador de visitas.
"""

import html
import json
import logging
from datetime import datetime
from typing import Iterable, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.categories import Categories
from models.products import Products

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/seo", tags=["seo"])

SITE_URL = "https://www.ventacofrade.com"
SITE_NAME = "VentaCofrade"
MAX_LIST = 100
MAX_SITEMAP = 5000
CACHE_HEADERS = {"Cache-Control": "public, max-age=600"}

CONDITION_LABELS = {"nuevo": "Nuevo", "usado": "Usado", "restaurado": "Restaurado"}
CONDITION_SCHEMA = {
    "nuevo": "https://schema.org/NewCondition",
    "usado": "https://schema.org/UsedCondition",
    "restaurado": "https://schema.org/RefurbishedCondition",
}


# ---------------------------------------------------------------------------
# Utilidades de presentación (funciones puras, fáciles de probar)
# ---------------------------------------------------------------------------

def esc(value: Optional[str]) -> str:
    return html.escape(value or "", quote=True)


def split_images(images: Optional[str]) -> list[str]:
    if not images:
        return []
    return [img.strip() for img in images.split(",") if img.strip().startswith(("http://", "https://"))]


def format_price(price: Optional[float]) -> str:
    if price is None:
        return ""
    text = f"{price:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if text.endswith(",00"):
        text = text[:-3]
    return f"{text} €"


def shorten(text: Optional[str], limit: int = 155) -> str:
    clean = " ".join((text or "").split())
    if len(clean) <= limit:
        return clean
    return clean[: limit - 1].rsplit(" ", 1)[0] + "…"


def json_ld(data: dict) -> str:
    # Evita que un texto de usuario pueda cerrar la etiqueta <script>.
    return (
        json.dumps(data, ensure_ascii=False)
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
    )


def page(
    *,
    title: str,
    description: str,
    canonical: str,
    body: str,
    image: Optional[str] = None,
    og_type: str = "website",
    structured: Optional[Iterable[dict]] = None,
    noindex: bool = False,
) -> str:
    image_tags = ""
    if image:
        image_tags = (
            f'<meta property="og:image" content="{esc(image)}">\n'
            f'<meta name="twitter:image" content="{esc(image)}">\n'
        )
    ld = "".join(
        f'<script type="application/ld+json">{json_ld(item)}</script>\n' for item in (structured or [])
    )
    robots = '<meta name="robots" content="noindex">\n' if noindex else ""
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">
<link rel="canonical" href="{esc(canonical)}">
{robots}<meta property="og:site_name" content="{SITE_NAME}">
<meta property="og:type" content="{og_type}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:locale" content="es_ES">
<meta name="twitter:card" content="summary_large_image">
{image_tags}{ld}<style>
body{{margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f1330;background:#fafafa;line-height:1.6}}
header,footer{{background:#4C1D95;color:#fff;padding:16px 24px}}
header a,footer a{{color:#FACC15;text-decoration:none;margin-right:16px}}
main{{max-width:900px;margin:0 auto;padding:24px}}
h1{{color:#4C1D95;line-height:1.25}}
.price{{font-size:1.6rem;font-weight:700;color:#4C1D95}}
.gallery img{{max-width:100%;height:auto;border-radius:8px;margin:0 8px 8px 0}}
ul.list{{list-style:none;padding:0}}
ul.list li{{padding:12px 0;border-bottom:1px solid #e5e5e5}}
</style>
</head>
<body>
<header><strong>{SITE_NAME}</strong> · Marketplace cofrade<br>
<nav><a href="{SITE_URL}/">Inicio</a><a href="{SITE_URL}/explorar">Explorar anuncios</a><a href="{SITE_URL}/vender">Vender</a><a href="{SITE_URL}/blog/">Guías</a></nav></header>
<main>
{body}
</main>
<footer>{SITE_NAME}: el marketplace de artículos religiosos y cofrades. Publicar y comprar es gratis.</footer>
</body>
</html>"""


def not_found_page() -> str:
    return page(
        title=f"Anuncio no disponible | {SITE_NAME}",
        description="Este anuncio ya no está disponible en VentaCofrade.",
        canonical=f"{SITE_URL}/explorar",
        body=f'<h1>Anuncio no disponible</h1><p>Este anuncio ya no está publicado. '
        f'<a href="{SITE_URL}/explorar">Ver otros anuncios</a>.</p>',
        noindex=True,
    )


def product_page(product, category) -> str:
    url = f"{SITE_URL}/producto/{product.id}"
    images = split_images(product.images)
    condition = CONDITION_LABELS.get(product.condition or "", product.condition or "")
    location = ", ".join(p for p in [product.location_city, product.location_province] if p)
    category_name = category.name if category else ""
    description_meta = shorten(product.description) or (
        f"{product.title} en venta en {SITE_NAME}. {format_price(product.price)}."
    )

    gallery = "".join(
        f'<img src="{esc(img)}" alt="{esc(product.title)} - foto {i + 1}" loading="lazy">'
        for i, img in enumerate(images[:8])
    )
    details = [
        f"<li><strong>Precio:</strong> {esc(format_price(product.price))}</li>",
        f"<li><strong>Estado:</strong> {esc(condition)}</li>" if condition else "",
        f"<li><strong>Ubicación:</strong> {esc(location)}</li>" if location else "",
        (
            f'<li><strong>Categoría:</strong> <a href="{SITE_URL}/explorar?categoria={quote(category.slug)}">'
            f"{esc(category_name)}</a></li>"
            if category
            else ""
        ),
    ]
    description_html = "".join(
        f"<p>{esc(line)}</p>" for line in (product.description or "").splitlines() if line.strip()
    )
    body = (
        f"<h1>{esc(product.title)}</h1>"
        f'<p class="price">{esc(format_price(product.price))}</p>'
        f'<div class="gallery">{gallery}</div>'
        f'<ul>{"".join(details)}</ul>'
        f"<h2>Descripción</h2>{description_html or '<p>Sin descripción.</p>'}"
        f'<p><a href="{url}">Ver el anuncio y contactar con el vendedor en {SITE_NAME}</a></p>'
    )

    product_ld = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.title,
        "description": shorten(product.description, 5000) or product.title,
        "url": url,
        "offers": {
            "@type": "Offer",
            "url": url,
            "price": f"{product.price:.2f}",
            "priceCurrency": "EUR",
            "availability": "https://schema.org/InStock",
        },
    }
    if images:
        product_ld["image"] = images[:8]
    if category_name:
        product_ld["category"] = category_name
    if product.condition in CONDITION_SCHEMA:
        product_ld["offers"]["itemCondition"] = CONDITION_SCHEMA[product.condition]

    breadcrumb = [{"@type": "ListItem", "position": 1, "name": SITE_NAME, "item": f"{SITE_URL}/"}]
    if category:
        breadcrumb.append({
            "@type": "ListItem",
            "position": 2,
            "name": category_name,
            "item": f"{SITE_URL}/explorar?categoria={quote(category.slug)}",
        })
    breadcrumb.append({"@type": "ListItem", "position": len(breadcrumb) + 1, "name": product.title, "item": url})

    return page(
        title=f"{product.title} | {SITE_NAME}",
        description=description_meta,
        canonical=url,
        body=body,
        image=images[0] if images else None,
        og_type="product",
        structured=[product_ld, {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": breadcrumb}],
    )


def listing_page(products, category, categories) -> str:
    if category:
        url = f"{SITE_URL}/explorar?categoria={quote(category.slug)}"
        heading = f"{category.name} en venta"
        intro = category.description or f"Anuncios de {category.name.lower()} publicados por cofrades."
        title = f"{category.name} de segunda mano | {SITE_NAME}"
    else:
        url = f"{SITE_URL}/explorar"
        heading = "Artículos religiosos y cofrades en venta"
        intro = "Túnicas, orfebrería, bordados, imágenes, insignias y enseres cofrades publicados por cofrades de toda España."
        title = f"Anuncios de artículos cofrades | {SITE_NAME}"

    items = "".join(
        f'<li><a href="{SITE_URL}/producto/{p.id}">{esc(p.title)}</a> · {esc(format_price(p.price))}'
        f'{" · " + esc(p.location_province) if p.location_province else ""}</li>'
        for p in products
    )
    category_links = "".join(
        f'<li><a href="{SITE_URL}/explorar?categoria={quote(c.slug)}">{esc(c.name)}</a></li>' for c in categories
    )
    body = (
        f"<h1>{esc(heading)}</h1><p>{esc(intro)}</p>"
        + (f'<ul class="list">{items}</ul>' if items else "<p>Todavía no hay anuncios publicados en esta sección.</p>")
        + f"<h2>Categorías</h2><ul>{category_links}</ul>"
    )
    return page(title=title, description=shorten(intro), canonical=url, body=body)


def sitemap_xml(products, categories) -> str:
    def lastmod(value: Optional[datetime]) -> str:
        return f"<lastmod>{value.date().isoformat()}</lastmod>" if value else ""

    urls = [f"<url><loc>{SITE_URL}/explorar</loc></url>"]
    urls += [
        f"<url><loc>{esc(f'{SITE_URL}/explorar?categoria={quote(c.slug)}')}</loc></url>" for c in categories
    ]
    urls += [
        f"<url><loc>{SITE_URL}/producto/{p.id}</loc>{lastmod(p.updated_at or p.created_at)}</url>"
        for p in products
    ]
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

async def _categories(db: AsyncSession):
    result = await db.execute(select(Categories).order_by(Categories.order_index, Categories.id))
    return list(result.scalars().all())


@router.get("/producto/{product_id}", response_class=HTMLResponse, include_in_schema=False)
async def seo_product(product_id: int, db: AsyncSession = Depends(get_db)):
    product = await db.get(Products, product_id)
    if not product or (product.status or "active") != "active":
        return HTMLResponse(not_found_page(), status_code=404)
    category = await db.get(Categories, product.category_id) if product.category_id else None
    return HTMLResponse(product_page(product, category), headers=CACHE_HEADERS)


@router.get("/explorar", response_class=HTMLResponse, include_in_schema=False)
async def seo_listing(categoria: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    categories = await _categories(db)
    category = next((c for c in categories if c.slug == categoria), None) if categoria else None
    stmt = select(Products).where(Products.status == "active")
    if category:
        stmt = stmt.where(Products.category_id == category.id)
    stmt = stmt.order_by(Products.created_at.desc()).limit(MAX_LIST)
    products = list((await db.execute(stmt)).scalars().all())
    return HTMLResponse(listing_page(products, category, categories), headers=CACHE_HEADERS)


@router.get("/sitemap-productos.xml", include_in_schema=False)
async def seo_sitemap(db: AsyncSession = Depends(get_db)):
    categories = await _categories(db)
    stmt = (
        select(Products)
        .where(Products.status == "active")
        .order_by(Products.created_at.desc())
        .limit(MAX_SITEMAP)
    )
    products = list((await db.execute(stmt)).scalars().all())
    return Response(sitemap_xml(products, categories), media_type="application/xml", headers=CACHE_HEADERS)
