"""Importar el catálogo desde la web propia del vendedor (sin IA, sin coste).

Orden de intento a partir de la dirección que da el vendedor:
  1. Shopify      → /products.json (catálogo público de toda tienda Shopify)
  2. WooCommerce  → /wp-json/wc/store/v1/products (API pública de la tienda)
  3. Cualquier web → datos de producto estándar (schema.org JSON-LD / Open Graph) de la página
                     y de las páginas de producto enlazadas desde ella.

Solo se permite importar desde el dominio de la web que el vendedor tiene en su perfil.
Facebook, Instagram, Wallapop, Todocolección, etc. no se importan (lo prohíben sus condiciones).
"""

import asyncio
import html as htmllib
import ipaddress
import json
import logging
import re
import socket
from typing import Optional
from urllib.parse import urljoin, urlparse, urlunparse

import httpx

logger = logging.getLogger(__name__)

MAX_ITEMS = 200
MAX_PHOTOS = 6
MAX_PAGE_BYTES = 3 * 1024 * 1024
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_LINKED_PAGES = 60
FETCH_CONCURRENCY = 6
TITLE_MAX = 200
DESCRIPTION_MAX = 5000
USER_AGENT = "Mozilla/5.0 (compatible; VentaCofrade-Importador/1.0; +https://ventacofrade.com)"

BLOCKED_DOMAINS = (
    "facebook.com", "fb.com", "instagram.com", "wallapop.com", "todocoleccion.net",
    "milanuncios.com", "vinted.es", "vinted.com", "ebay.es", "ebay.com", "amazon.es", "amazon.com",
    "etsy.com", "tiktok.com", "x.com", "twitter.com",
)


class ImportErrorForUser(ValueError):
    """Error con un mensaje apto para mostrar al vendedor."""


# ---------- Direcciones y dominios ----------
def normalize_url(value: str) -> str:
    value = (value or "").strip()
    if not value:
        raise ImportErrorForUser("Escribe la dirección de tu web.")
    if not re.match(r"^https?://", value, re.I):
        value = "https://" + value
    parsed = urlparse(value)
    if not parsed.hostname or "." not in parsed.hostname:
        raise ImportErrorForUser("Esa dirección no parece válida.")
    return urlunparse(parsed._replace(fragment=""))


def base_domain(host: str) -> str:
    host = (host or "").lower().rstrip(".")
    return host[4:] if host.startswith("www.") else host


def same_site(url: str, profile_website: str) -> bool:
    """La web a importar debe ser la del perfil (o un subdominio suyo)."""
    target = base_domain(urlparse(url).hostname or "")
    own = base_domain(urlparse(normalize_url(profile_website)).hostname or "")
    return bool(own) and (target == own or target.endswith("." + own))


def is_blocked(url: str) -> bool:
    host = base_domain(urlparse(url).hostname or "")
    return any(host == d or host.endswith("." + d) for d in BLOCKED_DOMAINS)


def _public_host(host: str) -> bool:
    """Evita que el servidor acceda a redes internas (SSRF)."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
    return True


# ---------- Descargas seguras ----------
def http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=httpx.Timeout(20.0),
        follow_redirects=False,
        headers={"User-Agent": USER_AGENT, "Accept-Language": "es-ES,es;q=0.9"},
    )


async def fetch(client: httpx.AsyncClient, url: str, max_bytes: int) -> tuple[int, str, bytes, str]:
    """GET con comprobación de cada redirección. Devuelve (status, content_type, cuerpo, url_final)."""
    current = url
    for _ in range(5):
        parsed = urlparse(current)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            raise ValueError("dirección no válida")
        if not await asyncio.to_thread(_public_host, parsed.hostname):
            raise ValueError("dirección no permitida")
        async with client.stream("GET", current) as response:
            if response.status_code in (301, 302, 303, 307, 308) and response.headers.get("location"):
                current = urljoin(current, response.headers["location"])
                continue
            chunks, size = [], 0
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > max_bytes:
                    raise ValueError("demasiado grande")
                chunks.append(chunk)
            return response.status_code, response.headers.get("content-type", ""), b"".join(chunks), current
    raise ValueError("demasiadas redirecciones")


async def fetch_json(client, url: str):
    try:
        status, ctype, body, _ = await fetch(client, url, MAX_PAGE_BYTES)
    except Exception:
        return None
    if status != 200:
        return None
    try:
        return json.loads(body.decode("utf-8", "ignore"))
    except ValueError:
        return None


def sniff_image_type(data: bytes) -> Optional[str]:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    return None


async def download_image(client, url: str) -> tuple[bytes, str]:
    status, _, data, _ = await fetch(client, url, MAX_IMAGE_BYTES)
    if status != 200:
        raise ValueError(f"respondió {status}")
    content_type = sniff_image_type(data)
    if not content_type:
        raise ValueError("no es JPG, PNG, WEBP o GIF")
    return data, content_type


# ---------- Limpieza de datos ----------
def strip_html(value) -> str:
    text = str(value or "")
    text = re.sub(r"(?is)<(script|style).*?</\1>", " ", text)
    text = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</h\d>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = htmllib.unescape(text)
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def parse_price(value) -> Optional[float]:
    if isinstance(value, (int, float)):
        return round(float(value), 2) if value > 0 else None
    text = re.sub(r"[^\d,.]", "", str(value or ""))
    if not text:
        return None
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".") if text.rfind(",") > text.rfind(".") else text.replace(",", "")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        n = round(float(text), 2)
    except ValueError:
        return None
    return n if n > 0 else None


def make_item(title, description, price, images, source_url) -> Optional[dict]:
    title = strip_html(title)[:TITLE_MAX]
    if len(title) < 3:
        return None
    clean_images = []
    for img in images:
        if isinstance(img, str) and img.startswith("//"):
            img = "https:" + img
        if isinstance(img, str) and re.match(r"^https?://", img) and img not in clean_images:
            clean_images.append(img)
    return {
        "title": title,
        "description": strip_html(description)[:DESCRIPTION_MAX] or None,
        "price": parse_price(price),
        "images": clean_images[:MAX_PHOTOS],
        "source_url": source_url,
    }


# ---------- 1. Shopify ----------
async def from_shopify(client, origin: str) -> list[dict]:
    items = []
    for page in range(1, 5):
        data = await fetch_json(client, f"{origin}/products.json?limit=250&page={page}")
        products = data.get("products") if isinstance(data, dict) else None
        if not products:
            break
        for p in products:
            variants = p.get("variants") or [{}]
            item = make_item(
                p.get("title"),
                p.get("body_html"),
                variants[0].get("price"),
                [i.get("src") for i in p.get("images") or []],
                f"{origin}/products/{p.get('handle')}" if p.get("handle") else origin,
            )
            if item:
                items.append(item)
        if len(products) < 250 or len(items) >= MAX_ITEMS:
            break
    return items


# ---------- 2. WooCommerce ----------
async def from_woocommerce(client, origin: str) -> list[dict]:
    items = []
    for path in ("/wp-json/wc/store/v1/products", "/wp-json/wc/store/products"):
        for page in range(1, 3):
            data = await fetch_json(client, f"{origin}{path}?per_page=100&page={page}")
            if not isinstance(data, list) or not data:
                break
            for p in data:
                prices = p.get("prices") or {}
                raw = prices.get("price")
                minor = prices.get("currency_minor_unit", 2)
                price = None
                if raw not in (None, ""):
                    try:
                        price = int(raw) / (10 ** int(minor))
                    except (TypeError, ValueError):
                        price = raw
                item = make_item(
                    p.get("name"),
                    p.get("description") or p.get("short_description"),
                    price,
                    [i.get("src") for i in p.get("images") or []],
                    p.get("permalink") or origin,
                )
                if item:
                    items.append(item)
            if len(data) < 100 or len(items) >= MAX_ITEMS:
                break
        if items:
            break
    return items


# ---------- 3. Cualquier web (schema.org / Open Graph) ----------
LD_RE = re.compile(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.I | re.S)
META_RE = re.compile(r'<meta\s+[^>]*(?:property|name)=["\']([^"\']+)["\'][^>]*content=["\']([^"\']*)["\']', re.I)
META_RE_REV = re.compile(r'<meta\s+[^>]*content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']([^"\']+)["\']', re.I)
LINK_RE = re.compile(r'<a\s+[^>]*href=["\']([^"\'#]+)["\']', re.I)


def _walk_ld(node, out: list):
    if isinstance(node, list):
        for n in node:
            _walk_ld(n, out)
    elif isinstance(node, dict):
        out.append(node)
        for key in ("@graph", "itemListElement", "item", "mainEntity", "hasVariant"):
            if key in node:
                _walk_ld(node[key], out)


def _types(node: dict) -> set:
    t = node.get("@type")
    return {str(x).lower() for x in (t if isinstance(t, list) else [t])}


def _ld_images(value) -> list:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [value.get("url") or value.get("contentUrl")]
    if isinstance(value, list):
        return [x for v in value for x in _ld_images(v)]
    return []


def _ld_price(offers):
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    if isinstance(offers, dict):
        return offers.get("price") or offers.get("lowPrice") or (offers.get("priceSpecification") or {}).get("price")
    return None


def parse_page(html: str, page_url: str) -> tuple[list[dict], list[str]]:
    """Productos que declara la página y enlaces de productos que lista (ItemList)."""
    nodes: list = []
    for block in LD_RE.findall(html):
        try:
            _walk_ld(json.loads(htmllib.unescape(block.strip())), nodes)
        except ValueError:
            continue
    items, links = [], []
    for node in nodes:
        types = _types(node)
        if "product" in types or "productgroup" in types:
            item = make_item(
                node.get("name"),
                node.get("description"),
                _ld_price(node.get("offers")),
                [urljoin(page_url, i) for i in _ld_images(node.get("image")) if i],
                urljoin(page_url, node.get("url") or page_url),
            )
            if item:
                items.append(item)
        elif "listitem" in types and isinstance(node.get("url"), str):
            links.append(urljoin(page_url, node["url"]))

    if not items:
        meta = {k.lower(): v for k, v in META_RE.findall(html)}
        meta.update({k.lower(): v for v, k in META_RE_REV.findall(html)})
        if meta.get("og:type", "").lower() in ("product", "og:product") or meta.get("product:price:amount"):
            item = make_item(
                meta.get("og:title"),
                meta.get("og:description"),
                meta.get("product:price:amount") or meta.get("og:price:amount"),
                [urljoin(page_url, meta["og:image"])] if meta.get("og:image") else [],
                page_url,
            )
            if item:
                items.append(item)
    return items, links


def candidate_links(html: str, page_url: str) -> list[str]:
    """Enlaces del mismo sitio que parecen fichas de producto."""
    host = base_domain(urlparse(page_url).hostname or "")
    found = []
    for href in LINK_RE.findall(html):
        url = urljoin(page_url, htmllib.unescape(href)).split("#")[0]
        parsed = urlparse(url)
        if base_domain(parsed.hostname or "") != host or url == page_url:
            continue
        path = parsed.path.lower()
        if re.search(r"\.(jpg|jpeg|png|gif|webp|pdf|css|js|xml)$", path):
            continue
        if re.search(r"/(producto|productos|product|products|articulo|articulos|item|p|tienda|shop)/[^/]+", path) or path.endswith(".html"):
            if url not in found:
                found.append(url)
    return found[:MAX_LINKED_PAGES]


async def from_any_page(client, url: str) -> list[dict]:
    try:
        status, ctype, body, final_url = await fetch(client, url, MAX_PAGE_BYTES)
    except Exception as exc:
        raise ImportErrorForUser("No hemos podido abrir esa página. Comprueba la dirección.") from exc
    if status != 200 or "html" not in ctype.lower():
        raise ImportErrorForUser("No hemos podido abrir esa página. Comprueba la dirección.")
    html = body.decode("utf-8", "ignore")
    items, links = parse_page(html, final_url)
    if len(items) > 1:
        return items
    # Página de catálogo: se visitan las fichas enlazadas.
    links = list(dict.fromkeys(links + candidate_links(html, final_url)))[:MAX_LINKED_PAGES]
    semaphore = asyncio.Semaphore(FETCH_CONCURRENCY)

    async def visit(link):
        async with semaphore:
            try:
                s, c, b, f = await fetch(client, link, MAX_PAGE_BYTES)
            except Exception:
                return []
            if s != 200 or "html" not in c.lower():
                return []
            return parse_page(b.decode("utf-8", "ignore"), f)[0]

    for found in await asyncio.gather(*(visit(l) for l in links)):
        items.extend(found)
    return items


# ---------- Punto de entrada ----------
async def discover(url: str) -> tuple[str, list[dict]]:
    parsed = urlparse(url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    async with http_client() as client:
        items = await from_shopify(client, origin)
        source = "shopify"
        if not items:
            items, source = await from_woocommerce(client, origin), "woocommerce"
        if not items:
            items, source = await from_any_page(client, url), "web"

    # Sin duplicados (mismo título y precio) y con tope.
    unique, seen = [], set()
    for it in items:
        key = (it["title"].lower(), it["price"])
        if key not in seen:
            seen.add(key)
            unique.append(it)
    logger.info("Importar catálogo: %s → %s productos (%s)", url, len(unique), source)
    return source, unique[:MAX_ITEMS]
