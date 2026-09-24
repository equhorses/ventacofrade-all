"""Subida con IA: el vendedor sube fotos y Claude (Anthropic) propone los anuncios.

La IA agrupa las fotos por artículo y sugiere título, descripción, categoría y
estado. El precio NUNCA lo pone la IA: lo escribe siempre el vendedor.

Variables de entorno (Railway, servicio backend):
  ANTHROPIC_API_KEY   - clave de console.anthropic.com (obligatoria)
  AI_LISTINGS_MODEL   - modelo (opcional; por defecto Claude Haiku 4.5)
  AI_DAILY_PHOTO_LIMIT- fotos que puede analizar cada vendedor al día (opcional; por defecto 120)
"""

import logging
from typing import Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)

API_URL = "https://api.anthropic.com/v1/messages"
DEFAULT_MODEL = "claude-haiku-4-5-20251001"
MAX_PHOTOS_PER_BATCH = 40
MAX_PHOTOS_PER_ITEM = 6
DEFAULT_DAILY_LIMIT = 120
CONDITIONS = ["nuevo", "usado", "restaurado"]
TITLE_MAX = 200
DESCRIPTION_MAX = 5000


class AINotConfiguredError(RuntimeError):
    pass


class AIServiceError(RuntimeError):
    pass


def _setting(name: str) -> Optional[str]:
    try:
        value = getattr(settings, name)
    except AttributeError:
        return None
    return str(value).strip() if value else None


def api_key() -> Optional[str]:
    return _setting("anthropic_api_key")


def model() -> str:
    return _setting("ai_listings_model") or DEFAULT_MODEL


def daily_limit() -> int:
    try:
        return max(int(_setting("ai_daily_photo_limit") or DEFAULT_DAILY_LIMIT), 0)
    except ValueError:
        return DEFAULT_DAILY_LIMIT


SYSTEM_PROMPT = """Eres el asistente de VentaCofrade, un mercado online de artículos cofrades y religiosos \
de Semana Santa (túnicas, capirotes, cíngulos, medallas, orfebrería, bordados, cera y candelería, \
imaginería, enseres de paso, libros, etc.).

Un vendedor ha subido varias fotos numeradas. Tu trabajo:
1. Agrupar las fotos por artículo: las fotos que muestran el MISMO objeto (distintos ángulos, detalles, \
etiquetas o contramarcas) van juntas. Objetos distintos, aunque se parezcan, van por separado. \
Si dudas, sepáralas: al vendedor le es más fácil unir que separar. Cada foto debe aparecer exactamente \
una vez. Máximo 6 fotos por artículo. Pon primero la foto que mejor muestra el objeto entero.
2. Para cada artículo, proponer:
   - title: título claro y concreto en español (máx. 80 caracteres), como lo buscaría un comprador. \
Ej.: "Medalla de hermandad esmaltada con cordón", "Túnica de nazareno negra talla M".
   - description: 2 a 4 frases sencillas describiendo solo lo que se VE (material aparente, color, \
técnica, estado visible, medidas o tallas si aparecen en una etiqueta). No inventes datos: no afirmes \
que es plata de ley, antiguo o de un taller concreto salvo que se lea claramente en la foto; en ese \
caso di "según se aprecia en la contramarca" o similar. Sin exageraciones ni emojis.
   - category_id: el id de la categoría más adecuada de la lista que se te da.
   - condition: "nuevo", "usado" o "restaurado". Si no se puede saber, "usado".
No pongas precio. No describas a personas que salgan en las fotos. Si una foto no muestra ningún \
artículo vendible (captura de pantalla, foto borrosa sin objeto claro), agrúpala sola con el título \
"Revisar esta foto".
Responde únicamente usando la herramienta proponer_anuncios."""

TOOL = {
    "name": "proponer_anuncios",
    "description": "Devuelve los artículos detectados en las fotos con los datos propuestos para cada anuncio.",
    "input_schema": {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "photos": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "Números de las fotos de este artículo, la principal primero.",
                        },
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "category_id": {"type": "integer"},
                        "condition": {"type": "string", "enum": CONDITIONS},
                    },
                    "required": ["photos", "title", "description", "category_id", "condition"],
                },
            }
        },
        "required": ["items"],
    },
}


async def propose_listings(image_urls: list[str], categories: list[tuple[int, str]]) -> list[dict]:
    """Devuelve [{images: [url], title, description, category_id, condition}] con todas las fotos repartidas."""
    key = api_key()
    if not key:
        raise AINotConfiguredError("Falta ANTHROPIC_API_KEY")

    category_text = "\n".join(f"- {cid}: {name}" for cid, name in categories)
    content: list[dict] = [{"type": "text", "text": f"Categorías disponibles (id: nombre):\n{category_text}"}]
    for i, url in enumerate(image_urls, start=1):
        content.append({"type": "text", "text": f"Foto {i}:"})
        content.append({"type": "image", "source": {"type": "url", "url": url}})
    content.append({"type": "text", "text": f"Hay {len(image_urls)} fotos en total. Agrúpalas y propón los anuncios."})

    body = {
        "model": model(),
        "max_tokens": 8000,
        "system": SYSTEM_PROMPT,
        "tools": [TOOL],
        "tool_choice": {"type": "tool", "name": "proponer_anuncios"},
        "messages": [{"role": "user", "content": content}],
    }
    headers = {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0)) as client:
            response = await client.post(API_URL, json=body, headers=headers)
    except httpx.HTTPError as exc:
        logger.error("IA: error de conexión con Anthropic: %s", exc)
        raise AIServiceError("No se pudo conectar con el servicio de IA") from exc
    if response.status_code != 200:
        logger.error("IA: Anthropic respondió %s: %s", response.status_code, response.text[:500])
        raise AIServiceError(f"El servicio de IA respondió {response.status_code}")

    data = response.json()
    raw_items = []
    for block in data.get("content", []):
        if block.get("type") == "tool_use" and block.get("name") == "proponer_anuncios":
            raw_items = (block.get("input") or {}).get("items") or []
    usage = data.get("usage", {})
    logger.info(
        "IA: %s fotos → %s artículos (tokens in=%s out=%s)",
        len(image_urls), len(raw_items), usage.get("input_tokens"), usage.get("output_tokens"),
    )
    return normalize(raw_items, image_urls, {cid for cid, _ in categories})


def normalize(raw_items: list, image_urls: list[str], category_ids: set[int]) -> list[dict]:
    """No nos fiamos del todo de la IA: cada foto una sola vez, ninguna perdida, datos válidos."""
    used: set[int] = set()
    items: list[dict] = []

    def new_item(indexes: list[int], raw: dict) -> dict:
        category = raw.get("category_id")
        condition = raw.get("condition")
        return {
            "images": [image_urls[i - 1] for i in indexes],
            "title": str(raw.get("title") or "").strip()[:TITLE_MAX],
            "description": str(raw.get("description") or "").strip()[:DESCRIPTION_MAX],
            "category_id": category if isinstance(category, int) and category in category_ids else None,
            "condition": condition if condition in CONDITIONS else "usado",
        }

    for raw in raw_items:
        if not isinstance(raw, dict):
            continue
        indexes = []
        for n in raw.get("photos") or []:
            if isinstance(n, int) and 1 <= n <= len(image_urls) and n not in used and n not in indexes:
                indexes.append(n)
        if not indexes:
            continue
        # Si la IA mete más de 6 fotos, las que sobran pasan a otro artículo con los mismos datos.
        for start in range(0, len(indexes), MAX_PHOTOS_PER_ITEM):
            chunk = indexes[start:start + MAX_PHOTOS_PER_ITEM]
            used.update(chunk)
            items.append(new_item(chunk, raw))

    # Fotos que la IA se ha dejado: cada una como artículo propio, para que el vendedor decida.
    for n in range(1, len(image_urls) + 1):
        if n not in used:
            items.append(new_item([n], {"title": "Revisar esta foto"}))
    return items
