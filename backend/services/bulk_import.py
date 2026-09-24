"""Subida masiva de anuncios por CSV o Excel (plan Profesional).

Columnas (la cabecera no distingue mayúsculas ni tildes):
  titulo*, precio*, categoria*, estado*, provincia*, ciudad, descripcion, fotos

"fotos" admite hasta 6 por anuncio, separadas por | (o ; o ,). Cada una puede ser
el nombre de un archivo que el vendedor adjunta junto al CSV (p. ej. "caliz1.jpg")
o una dirección web (https://...), que el servidor descarga y copia a nuestro bucket.
"""

import asyncio
import csv
import io
import ipaddress
import logging
import re
import socket
import unicodedata
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx

logger = logging.getLogger(__name__)

MAX_ROWS = 200
MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_PHOTOS = 6
MAX_REMOTE_IMAGE_BYTES = 8 * 1024 * 1024
TITLE_MIN, TITLE_MAX = 3, 200
DESCRIPTION_MAX = 5000
PRICE_MAX = 1_000_000

CONDITIONS = {"nuevo": "nuevo", "usado": "usado", "restaurado": "restaurado"}
# Misma lista que el formulario de publicar (frontend/src/pages/Publicar.tsx).
PROVINCES = [
    "Sevilla", "Málaga", "Cádiz", "Córdoba", "Granada", "Huelva", "Jaén", "Almería",
    "Madrid", "Barcelona", "Valencia", "Murcia", "Otra",
]

COLUMN_ALIASES = {
    "title": ["titulo", "title", "nombre"],
    "price": ["precio", "price", "precio eur", "precio euros"],
    "category": ["categoria", "category"],
    "condition": ["estado", "condicion", "condition"],
    "province": ["provincia", "province"],
    "city": ["ciudad", "localidad", "municipio", "city"],
    "description": ["descripcion", "description"],
    "photos": ["fotos", "foto", "imagenes", "imagen", "photos", "images"],
}
REQUIRED = ["title", "price", "category", "condition", "province"]

TEMPLATE_HEADERS = ["titulo", "precio", "categoria", "estado", "provincia", "ciudad", "descripcion", "fotos"]


def norm(text) -> str:
    text = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z0-9]+", " ", text.lower())
    return text.strip()


PROVINCE_LOOKUP = {norm(p): p for p in PROVINCES}
HEADER_LOOKUP = {norm(alias): key for key, aliases in COLUMN_ALIASES.items() for alias in aliases}


# ---------- Lectura del archivo ----------
def _decode(raw: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("No se pudo leer el archivo. Guárdalo como CSV UTF-8.")


def _read_csv(raw: bytes) -> list[list]:
    text = _decode(raw)
    sample = text[:5000]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        delimiter = dialect.delimiter
    except csv.Error:
        delimiter = ";" if sample.count(";") > sample.count(",") else ","
    return [row for row in csv.reader(io.StringIO(text), delimiter=delimiter)]


def _read_xlsx(raw: bytes) -> list[list]:
    try:
        from openpyxl import load_workbook
    except ImportError as exc:  # pragma: no cover
        raise ValueError("El servidor no puede leer Excel ahora mismo. Usa CSV.") from exc
    try:
        workbook = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    except Exception as exc:
        raise ValueError("No se pudo abrir el Excel. Comprueba que es un .xlsx válido.") from exc
    sheet = workbook.worksheets[0]
    rows = []
    for row in sheet.iter_rows(values_only=True):
        rows.append(["" if v is None else v for v in row])
        if len(rows) > MAX_ROWS + 50:
            break
    workbook.close()
    return rows


def read_rows(filename: str, raw: bytes) -> list[dict]:
    """Devuelve una lista de {row: nº de fila en el archivo, values: {campo: valor}}."""
    if len(raw) > MAX_FILE_BYTES:
        raise ValueError("El archivo pesa más de 5 MB.")
    name = (filename or "").lower()
    if name.endswith(".xlsx"):
        table = _read_xlsx(raw)
    elif name.endswith(".csv") or name.endswith(".txt"):
        table = _read_csv(raw)
    elif name.endswith(".xls"):
        raise ValueError("El formato .xls antiguo no es compatible. Guárdalo como .xlsx o CSV.")
    else:
        raise ValueError("Sube un archivo .csv o .xlsx.")

    # La cabecera es la primera fila con alguna columna reconocida.
    header_index, mapping = None, {}
    for i, row in enumerate(table[:10]):
        found = {}
        for col, cell in enumerate(row):
            key = HEADER_LOOKUP.get(norm(cell))
            if key and key not in found:
                found[key] = col
        if "title" in found and "price" in found:
            header_index, mapping = i, found
            break
    if header_index is None:
        raise ValueError("No se encuentra la cabecera. La primera fila debe tener al menos: titulo, precio, categoria, estado, provincia.")
    missing = [c for c in REQUIRED if c not in mapping]
    if missing:
        names = {k: v[0] for k, v in COLUMN_ALIASES.items()}
        raise ValueError("Faltan columnas: " + ", ".join(names[c] for c in missing) + ".")

    rows = []
    for i, row in enumerate(table[header_index + 1:], start=header_index + 2):
        values = {key: (row[col] if col < len(row) else "") for key, col in mapping.items()}
        if all(str(v).strip() == "" for v in values.values()):
            continue  # fila vacía
        rows.append({"row": i, "values": values})
    if not rows:
        raise ValueError("El archivo no tiene anuncios debajo de la cabecera.")
    if len(rows) > MAX_ROWS:
        raise ValueError(f"Máximo {MAX_ROWS} anuncios por archivo. Divídelo en varios.")
    return rows


# ---------- Validación ----------
def parse_price(value) -> Optional[float]:
    if isinstance(value, (int, float)):
        return round(float(value), 2)
    text = re.sub(r"[€\s]|eur(os)?", "", str(value or "").lower())
    if not text:
        return None
    if "," in text and "." in text:
        # 1.234,50 → 1234.50 ; 1,234.50 → 1234.50
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        text = text.replace(",", ".")
    try:
        return round(float(text), 2)
    except ValueError:
        return None


def split_photos(value) -> list[str]:
    tokens = re.split(r"[|;,\n]+", str(value or ""))
    return [t.strip() for t in tokens if t.strip()]


def is_url(token: str) -> bool:
    return token.lower().startswith(("http://", "https://"))


def photo_filename(token: str) -> str:
    """Nombre de archivo sin carpetas, en minúsculas (así se emparejan con lo adjuntado)."""
    return re.split(r"[\\/]", token)[-1].strip().lower()


def validate_row(values: dict, categories: dict) -> tuple[dict, list[str]]:
    """categories: {clave normalizada (nombre, slug o id): (id, nombre)}"""
    errors = []
    title = str(values.get("title") or "").strip()
    if len(title) < TITLE_MIN:
        errors.append("Falta el título (mínimo 3 caracteres).")
    elif len(title) > TITLE_MAX:
        errors.append(f"El título pasa de {TITLE_MAX} caracteres.")

    price = parse_price(values.get("price"))
    if price is None:
        errors.append("El precio no es un número válido.")
    elif price <= 0 or price > PRICE_MAX:
        errors.append("El precio debe ser mayor que 0.")

    raw_category = values.get("category")
    if isinstance(raw_category, float) and raw_category.is_integer():
        raw_category = int(raw_category)
    category = categories.get(norm(raw_category))
    if not category:
        errors.append(f"Categoría no reconocida: «{str(raw_category or '').strip() or 'vacía'}».")

    condition = CONDITIONS.get(norm(values.get("condition")))
    if not condition:
        errors.append("Estado no válido: usa nuevo, usado o restaurado.")

    province = PROVINCE_LOOKUP.get(norm(values.get("province")))
    if not province:
        errors.append(f"Provincia no reconocida: «{str(values.get('province') or '').strip() or 'vacía'}».")

    description = str(values.get("description") or "").strip()
    if len(description) > DESCRIPTION_MAX:
        errors.append(f"La descripción pasa de {DESCRIPTION_MAX} caracteres.")

    photos = split_photos(values.get("photos"))
    if len(photos) > MAX_PHOTOS:
        errors.append(f"Máximo {MAX_PHOTOS} fotos por anuncio.")

    data = {
        "title": title[:TITLE_MAX],
        "price": price,
        "category_id": category[0] if category else None,
        "category_name": category[1] if category else None,
        "condition": condition,
        "location_province": province,
        "location_city": (str(values.get("city") or "").strip()[:100] or None),
        "description": description[:DESCRIPTION_MAX] or None,
        "photos": photos[:MAX_PHOTOS],
    }
    return data, errors


# ---------- Fotos desde una dirección web ----------
def _public_host(host: str) -> bool:
    """Evita que el servidor descargue de redes internas (SSRF)."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
    return True


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


async def download_image(client: httpx.AsyncClient, url: str) -> tuple[bytes, str]:
    current = url
    for _ in range(4):  # la petición inicial + hasta 3 redirecciones
        parsed = urlparse(current)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            raise ValueError("dirección no válida")
        if not await asyncio.to_thread(_public_host, parsed.hostname):
            raise ValueError("dirección no permitida")
        async with client.stream("GET", current) as response:
            if response.status_code in (301, 302, 303, 307, 308) and response.headers.get("location"):
                current = urljoin(current, response.headers["location"])
                continue
            if response.status_code != 200:
                raise ValueError(f"el servidor respondió {response.status_code}")
            chunks, size = [], 0
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > MAX_REMOTE_IMAGE_BYTES:
                    raise ValueError("la imagen pesa más de 8 MB")
                chunks.append(chunk)
            data = b"".join(chunks)
            content_type = sniff_image_type(data)
            if not content_type:
                raise ValueError("no es una imagen JPG, PNG, WEBP o GIF")
            return data, content_type
    raise ValueError("demasiadas redirecciones")


def http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=httpx.Timeout(15.0),
        follow_redirects=False,
        headers={"User-Agent": "VentaCofrade-Importador/1.0"},
    )


# ---------- Plantilla ----------
EXAMPLE_ROWS = [
    ["Cáliz de plata repujada", "450", "{cat1}", "usado", "Sevilla", "Sevilla",
     "Cáliz del siglo XX en plata de ley, con estuche original.", "caliz1.jpg|caliz2.jpg"],
    ["Túnica de nazareno talla M", "85,50", "{cat2}", "nuevo", "Málaga", "Antequera",
     "Túnica sin estrenar, tejido de sarga.", "https://ejemplo.com/foto-tunica.jpg"],
]


def template_rows(category_names: list[str]) -> list[list[str]]:
    cat1 = category_names[0] if category_names else "Orfebrería"
    cat2 = category_names[1] if len(category_names) > 1 else cat1
    return [[cell.format(cat1=cat1, cat2=cat2) for cell in row] for row in EXAMPLE_ROWS]


def template_csv(category_names: list[str]) -> bytes:
    out = io.StringIO()
    writer = csv.writer(out, delimiter=";")
    writer.writerow(TEMPLATE_HEADERS)
    writer.writerows(template_rows(category_names))
    return ("\ufeff" + out.getvalue()).encode("utf-8")  # BOM: Excel respeta las tildes


def template_xlsx(category_names: list[str]) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    wb = Workbook()
    ws = wb.active
    ws.title = "Anuncios"
    ws.append(TEMPLATE_HEADERS)
    for row in template_rows(category_names):
        ws.append(row)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="6D28D9")
    for col, width in zip("ABCDEFGH", [34, 10, 22, 12, 14, 16, 50, 40]):
        ws.column_dimensions[col].width = width

    help_ws = wb.create_sheet("Valores válidos")
    help_ws.append(["categoria", "estado", "provincia"])
    for cell in help_ws[1]:
        cell.font = Font(bold=True)
    conditions = list(CONDITIONS)
    for i in range(max(len(category_names), len(conditions), len(PROVINCES))):
        help_ws.append([
            category_names[i] if i < len(category_names) else "",
            conditions[i] if i < len(conditions) else "",
            PROVINCES[i] if i < len(PROVINCES) else "",
        ])
    for col in "ABC":
        help_ws.column_dimensions[col].width = 28

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
