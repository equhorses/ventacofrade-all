"""Traer los anuncios de un vendedor desde Todocolección o Wallapop (solo admin, con su autorización).

Cómo se usa:
  1. El admin pide autorización al vendedor por el mensajero; el vendedor marca la casilla y acepta
     (queda registrado en catalog_import_consents: texto exacto, fecha, IP y navegador).
  2. list_items(url)    → lista rápida de SUS anuncios (título, precio, miniatura, enlace), sin entrar en cada uno.
  3. El admin marca solo los que interesan (el vendedor puede tener cosas no cofrades).
  4. item_details(urls) → entra solo en los marcados para sacar descripción y todas las fotos.

Se hace despacio (una página cada vez, con pausa) y solo sobre la tienda del vendedor que lo ha autorizado.
Si la plataforma bloquea la lectura, se devuelve un error claro y se usa el Excel + fotos.
"""

import asyncio
import html as htmllib
import json
import logging
import re
from typing import Optional
from urllib.parse import parse_qs, urljoin, urlparse

from services import catalog_import as ci

logger = logging.getLogger(__name__)

LIST_MAX_PAGES = 60
LIST_MAX_ITEMS = 2000
PAGE_PAUSE = 0.6  # segundos entre páginas: sin prisas, para no cargar su web
DETAIL_CONCURRENCY = 2
DETAIL_BATCH_MAX = 20

TC_HOST = "www.todocoleccion.net"
TC_LOT_RE = re.compile(r"""href=["']((?:https?://www\.todocoleccion\.net)?/[a-z0-9-]+/[a-z0-9-]+~x(\d+))["']""", re.I)
TC_IMG_RE = re.compile(r"""https?://cloud\d*\.todocoleccion\.online/[^"'\s<>)]+?\.(?:jpe?g|png|webp)""", re.I)
PRICE_RE = re.compile(r"(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:€|&euro;|&#8364;|EUR)", re.I)
TITLE_ATTR_RE = re.compile(r"""(?:title|alt|aria-label)=["']([^"']{3,200})["']""", re.I)
NEXT_DATA_RE = re.compile(r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>', re.S | re.I)


class PlatformBlocked(ci.ImportErrorForUser):
    """La plataforma no nos deja leer la página (bloqueo, captcha...)."""


def platform_of(url: str) -> Optional[str]:
    host = (urlparse(url).hostname or "").lower()
    if host.endswith("todocoleccion.net"):
        return "todocoleccion"
    if host.endswith("wallapop.com"):
        return "wallapop"
    return None


def source_key(url: str) -> str:
    """Identificador estable de la tienda: 'todocoleccion:nick' o 'wallapop:usuario'."""
    platform = platform_of(url)
    parsed = urlparse(url)
    if platform == "todocoleccion":
        nick = _tc_nick(url)
        if nick:
            return f"todocoleccion:{nick.lower()}"
    if platform == "wallapop":
        m = re.search(r"/(?:app/)?user/([^/?#]+)", parsed.path)
        if m:
            return f"wallapop:{m.group(1).lower()}"
    raise ci.ImportErrorForUser(
        "Pega la dirección de la TIENDA del vendedor: en Todocolección, todocoleccion.net/tienda/SUNOMBRE; "
        "en Wallapop, la dirección de su perfil (es.wallapop.com/user/...)."
    )


def _tc_nick(url: str) -> Optional[str]:
    parsed = urlparse(url)
    m = re.match(r"^/tienda/([^/?#]+)", parsed.path)
    if m:
        return m.group(1)
    tienda = parse_qs(parsed.query).get("tienda")
    return tienda[0] if tienda else None


async def _get_html(client, url: str) -> str:
    try:
        status, ctype, body, _ = await ci.fetch(client, url, ci.MAX_PAGE_BYTES)
    except Exception as exc:
        raise PlatformBlocked("No hemos podido abrir la página de la plataforma ahora mismo.") from exc
    text = body.decode("utf-8", "ignore")
    if status in (403, 429, 503) or "cf-challenge" in text or "challenge-platform" in text:
        raise PlatformBlocked(
            "La plataforma no deja leer su tienda desde nuestro servidor (la protege contra programas). "
            "Usa la opción del Excel + fotos."
        )
    if status != 200:
        raise PlatformBlocked(f"La plataforma respondió con un error ({status}). Comprueba la dirección.")
    return text


def _slug_title(slug: str) -> str:
    words = slug.replace("-", " ").strip()
    return words[:1].upper() + words[1:]


def _clean_img(url: str) -> str:
    return url.split("?")[0]


# ---------- Todocolección ----------
def _tc_list_page(html: str, page_url: str) -> list[dict]:
    """Lotes de una página del catálogo de la tienda: título, precio y miniatura de la zona de cada lote.

    La "tarjeta" de un lote va desde su primer enlace hasta el primer enlace del lote siguiente.
    """
    matches = list(TC_LOT_RE.finditer(html))
    groups: list[tuple[str, str, int, int]] = []  # (lot_id, url, inicio, fin)
    for m in matches:
        if groups and groups[-1][0] == m.group(2):
            continue
        if groups:
            lot, url, begin, _ = groups[-1]
            groups[-1] = (lot, url, begin, m.start())
        groups.append((m.group(2), urljoin(page_url, m.group(1)), m.start(), len(html)))
    if groups:
        lot, url, begin, _ = groups[-1]
        groups[-1] = (lot, url, begin, min(len(html), begin + 4000))

    items: dict[str, dict] = {}
    for lot_id, url, begin, end in groups:
        if lot_id in items:
            continue
        card = html[begin:end]
        texts = [ci.strip_html(t) for t in re.findall(r"~x" + lot_id + r"""["'][^>]*>(.*?)</a>""", card, re.S)]
        texts += [
            htmllib.unescape(a)
            for a in TITLE_ATTR_RE.findall(card)
            if not a.lower().startswith(("ver ", "añadir", "seguir", "comprar"))
        ]
        texts = [t.strip() for t in texts if len(t.strip()) >= 3]
        title = max(texts, key=len) if texts else ""
        if not title:
            slug = re.search(r"/([a-z0-9-]+)~x\d+", url)
            title = _slug_title(slug.group(1)) if slug else f"Lote {lot_id}"
        price_match = PRICE_RE.search(card)
        price = None
        if price_match:
            raw = price_match.group(1)
            price = ci.parse_price(raw.replace(".", "") if "," in raw else raw)
        imgs = [_clean_img(u) for u in TC_IMG_RE.findall(card) if lot_id in u.rsplit("/", 1)[-1]]
        items[lot_id] = {"source_url": url, "title": title[: ci.TITLE_MAX], "price": price, "images": imgs[:1]}
    return list(items.values())


async def _tc_list(client, url: str) -> list[dict]:
    nick = _tc_nick(url)
    if not nick:
        source_key(url)  # lanza el error explicativo
    found: dict[str, dict] = {}
    for page in range(1, LIST_MAX_PAGES + 1):
        page_url = f"https://{TC_HOST}/s/catalogo?P={page}&tienda={nick}"
        html = await _get_html(client, page_url)
        new = 0
        for it in _tc_list_page(html, page_url):
            if it["source_url"] not in found:
                found[it["source_url"]] = it
                new += 1
        if not new or len(found) >= LIST_MAX_ITEMS:
            break
        await asyncio.sleep(PAGE_PAUSE)
    return list(found.values())


def _tc_detail(html: str, url: str) -> dict:
    lot_match = re.search(r"~x(\d+)", url)
    lot_id = lot_match.group(1) if lot_match else "~"
    items, _ = ci.parse_page(html, url)
    base = items[0] if items else {}
    meta = {k.lower(): v for k, v in ci.META_RE.findall(html)}
    meta.update({k.lower(): v for v, k in ci.META_RE_REV.findall(html)})

    title = base.get("title") or ci.strip_html(meta.get("og:title", ""))
    if not title:
        h1 = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S | re.I)
        title = ci.strip_html(h1.group(1)) if h1 else ""

    description = ""
    block = re.search(
        r"""<(div|section)[^>]+(?:id|class)=["'][^"']*descripci[oó]n[^"']*["'][^>]*>(.*?)</\1>""", html, re.S | re.I
    )
    if block:
        description = ci.strip_html(block.group(2))
    if len(description) < 20:
        description = base.get("description") or ci.strip_html(
            meta.get("og:description") or meta.get("description") or ""
        )

    price = base.get("price")
    if not price:
        itemprop = re.search(r"""itemprop=["']price["'][^>]*content=["']([\d.,]+)""", html, re.I)
        price = ci.parse_price(itemprop.group(1)) if itemprop else None
    if not price:
        shown = PRICE_RE.search(html)
        if shown:
            raw = shown.group(1)
            price = ci.parse_price(raw.replace(".", "") if "," in raw else raw)

    images = []
    for u in TC_IMG_RE.findall(html):
        u = _clean_img(u)
        name = u.rsplit("/", 1)[-1]
        if lot_id in name and u not in images:
            images.append(u)
    for u in base.get("images") or []:
        u = _clean_img(u)
        if u not in images:
            images.append(u)
    if not images and meta.get("og:image"):
        images.append(_clean_img(meta["og:image"]))
    return {
        "source_url": url,
        "title": (title or "")[: ci.TITLE_MAX],
        "description": (description or "")[: ci.DESCRIPTION_MAX] or None,
        "price": price,
        "images": images[: ci.MAX_PHOTOS],
    }


# ---------- Wallapop (lo que publica su web en __NEXT_DATA__) ----------
def _next_data(html: str):
    m = NEXT_DATA_RE.search(html)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except ValueError:
        return None


def _wp_price(value):
    if isinstance(value, dict):
        return ci.parse_price(value.get("amount") or value.get("cash", {}).get("amount"))
    return ci.parse_price(value)


def _wp_images(value) -> list[str]:
    out = []
    for img in value or []:
        if isinstance(img, dict):
            urls = img.get("urls") or img.get("urls_by_size") or {}
            u = urls.get("big") or urls.get("original") or urls.get("medium") or img.get("original") or img.get("url")
        else:
            u = img
        if isinstance(u, str) and u.startswith("http") and u not in out:
            out.append(u)
    return out


def _wp_walk(node, out: list):
    if isinstance(node, list):
        for n in node:
            _wp_walk(n, out)
    elif isinstance(node, dict):
        title = node.get("title")
        if isinstance(title, str) and ("price" in node or "sale_price" in node) and ("images" in node or "web_slug" in node):
            out.append(node)
        for v in node.values():
            if isinstance(v, (dict, list)):
                _wp_walk(v, out)


def _wp_item(node: dict) -> dict:
    slug = node.get("web_slug") or node.get("slug") or ""
    title = node.get("title")
    if isinstance(title, dict):
        title = title.get("original") or ""
    desc = node.get("description")
    if isinstance(desc, dict):
        desc = desc.get("original") or ""
    return {
        "source_url": f"https://es.wallapop.com/item/{slug}" if slug else "",
        "title": ci.strip_html(title or "")[: ci.TITLE_MAX],
        "description": ci.strip_html(desc or "")[: ci.DESCRIPTION_MAX] or None,
        "price": _wp_price(node.get("price") or node.get("sale_price")),
        "images": _wp_images(node.get("images"))[: ci.MAX_PHOTOS],
    }


async def _wp_list(client, url: str) -> list[dict]:
    html = await _get_html(client, url)
    data = _next_data(html)
    nodes: list = []
    if data:
        _wp_walk(data, nodes)
    items, seen = [], set()
    for node in nodes:
        it = _wp_item(node)
        if it["source_url"] and it["source_url"] not in seen and len(it["title"]) >= 3:
            seen.add(it["source_url"])
            it["images"] = it["images"][:1]
            items.append(it)
    if not items:
        raise PlatformBlocked(
            "Wallapop no muestra los anuncios de ese perfil a nuestro servidor. Usa la opción del Excel + fotos."
        )
    return items


def _wp_detail(html: str, url: str) -> dict:
    data = _next_data(html)
    nodes: list = []
    if data:
        _wp_walk(data, nodes)
    slug = url.rstrip("/").rsplit("/", 1)[-1]
    for node in nodes:
        if (node.get("web_slug") or "") == slug:
            it = _wp_item(node)
            it["source_url"] = url
            return it
    items, _ = ci.parse_page(html, url)
    if items:
        it = items[0]
        return {"source_url": url, "title": it["title"], "description": it["description"], "price": it["price"],
                "images": it["images"]}
    return {"source_url": url, "title": "", "description": None, "price": None, "images": []}


# ---------- Puntos de entrada ----------
async def list_items(url: str) -> tuple[str, list[dict]]:
    url = ci.normalize_url(url)
    platform = platform_of(url)
    if not platform:
        raise ci.ImportErrorForUser("Esta opción es solo para tiendas de Todocolección o perfiles de Wallapop.")
    async with ci.http_client() as client:
        items = await (_tc_list(client, url) if platform == "todocoleccion" else _wp_list(client, url))
    if not items:
        raise PlatformBlocked(
            "No hemos encontrado anuncios en esa tienda. Comprueba la dirección o usa la opción del Excel + fotos."
        )
    logger.info("Importar desde plataforma: %s → %s anuncios", url, len(items))
    return platform, items[:LIST_MAX_ITEMS]


async def item_details(urls: list[str], allowed_key: str) -> list[dict]:
    """Descripción y fotos de los anuncios marcados. Solo de la plataforma autorizada."""
    platform = allowed_key.split(":", 1)[0]
    semaphore = asyncio.Semaphore(DETAIL_CONCURRENCY)

    async def one(client, url: str) -> dict:
        if platform_of(url) != platform:
            return {"source_url": url, "error": "no es de la tienda autorizada"}
        async with semaphore:
            try:
                html = await _get_html(client, url)
            except ci.ImportErrorForUser as exc:
                return {"source_url": url, "error": str(exc)}
            await asyncio.sleep(PAGE_PAUSE / 2)
        return _tc_detail(html, url) if platform == "todocoleccion" else _wp_detail(html, url)

    async with ci.http_client() as client:
        return list(await asyncio.gather(*(one(client, u) for u in urls[:DETAIL_BATCH_MAX])))
