"""Tapar la marca de agua de Todocolección con un recuadro de VentaCofrade.

Solo se usa al importar fotos de Todocolección con autorización del vendedor (las fotos son suyas).
Su marca va abajo a la derecha: el logo + "todocoleccion" en blanco, de ~19 % del ancho de la foto.
"""

import io
import logging
import os

logger = logging.getLogger(__name__)

BRAND_COLOR = (109, 40, 217)  # #6d28d9, el morado de VentaCofrade
TEXT = "VentaCofrade"

# Su marca medida sobre una foto real de 893 x 1200 px: de 720 a 869 px en horizontal (logo "T" + texto)
# y de 1171 a 1187 px en vertical. En otras fotos crece con el lado mayor, así que el recuadro se escala
# con el mayor de los dos factores (ancho y alto) y lleva margen de sobra para no dejar asomar la "T".
REF_W, REF_H = 893, 1200
BOX_LEFT = 215    # px (a escala de referencia) desde el borde derecho hasta el inicio del recuadro
BOX_RIGHT = 8     # px desde el borde derecho hasta el final del recuadro
BOX_TOP = 52      # px desde el borde inferior hasta arriba del recuadro
BOX_BOTTOM = 3    # px desde el borde inferior hasta abajo del recuadro


def is_todocoleccion_image(url: str) -> bool:
    return "todocoleccion.online/" in (url or "")


LOGO_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "logo-circle.png")
_logo_cache: dict[int, object] = {}


def _logo(size: int):
    """Logo redondo de VentaCofrade (con transparencia) al tamaño pedido, o None si no está el archivo."""
    if size < 8:
        return None
    if size not in _logo_cache:
        from PIL import Image

        try:
            _logo_cache[size] = Image.open(LOGO_PATH).convert("RGBA").resize((size, size), Image.LANCZOS)
        except OSError:
            logger.warning("No se encuentra el logo %s", LOGO_PATH)
            _logo_cache[size] = None
    return _logo_cache[size]


def _font(size: int):
    from PIL import ImageFont

    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # Pillow antiguo
        return ImageFont.load_default()


def cover_todocoleccion_mark(data: bytes) -> tuple[bytes, str]:
    """Devuelve la foto (JPEG) con un recuadro morado "VentaCofrade" encima de la marca de Todocolección."""
    from PIL import Image, ImageDraw

    img = Image.open(io.BytesIO(data))
    img = img.convert("RGB")
    w, h = img.size
    if w < 200 or h < 150:
        # Miniatura: no lleva marca legible, se deja como está.
        out = io.BytesIO()
        img.save(out, "JPEG", quality=90)
        return out.getvalue(), "image/jpeg"

    # Nunca más pequeño que en la foto de referencia: en fotos pequeñas su marca no encoge al mismo ritmo.
    scale = max(1.0, w / REF_W, h / REF_H)
    x0 = max(0, int(w - BOX_LEFT * scale))
    x1 = min(w, int(w - BOX_RIGHT * scale))
    y0 = max(0, int(h - BOX_TOP * scale))
    y1 = min(h, int(h - BOX_BOTTOM * scale))

    draw = ImageDraw.Draw(img)
    radius = max(4, (y1 - y0) // 3)
    draw.rounded_rectangle((x0, y0, x1, y1), radius=radius, fill=BRAND_COLOR)

    box_w, box_h = x1 - x0, y1 - y0
    pad = max(3, int(box_h * 0.12))

    # Logo redondo de VentaCofrade a la izquierda.
    logo_size = box_h - 2 * pad
    text_left = x0 + pad
    logo = _logo(logo_size)
    if logo is not None:
        img.paste(logo, (x0 + pad, y0 + pad), logo)
        text_left = x0 + pad + logo_size + max(3, pad)

    # Texto blanco lo más grande posible en el hueco que queda.
    area_w = x1 - pad - text_left
    size = max(8, int(box_h * 0.6))
    font = _font(size)
    while size > 8:
        left, top, right, bottom = draw.textbbox((0, 0), TEXT, font=font)
        if right - left <= area_w and bottom - top <= box_h * 0.62:
            break
        size -= 1
        font = _font(size)
    left, top, right, bottom = draw.textbbox((0, 0), TEXT, font=font)
    tx = text_left + (area_w - (right - left)) / 2 - left
    ty = y0 + (box_h - (bottom - top)) / 2 - top
    draw.text((tx, ty), TEXT, font=font, fill=(255, 255, 255))

    out = io.BytesIO()
    img.save(out, "JPEG", quality=90, optimize=True)
    return out.getvalue(), "image/jpeg"
