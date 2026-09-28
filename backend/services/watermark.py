"""Tapar la marca de agua de Todocolección con un recuadro de VentaCofrade.

Solo se usa al importar fotos de Todocolección con autorización del vendedor (las fotos son suyas).
Su marca va abajo a la derecha: el logo + "todocoleccion" en blanco, de ~19 % del ancho de la foto.
"""

import io
import logging

logger = logging.getLogger(__name__)

BRAND_COLOR = (109, 40, 217)  # #6d28d9, el morado de VentaCofrade
TEXT = "VentaCofrade"

# Posición de su marca, relativa al ANCHO de la foto (medida sobre una foto real de 893 px):
# de 720 a 869 px en horizontal y de 29 a 13 px por encima del borde inferior.
MARK_LEFT = 0.194   # distancia desde el borde derecho hasta el inicio de la marca
MARK_RIGHT = 0.027  # distancia desde el borde derecho hasta el final de la marca
MARK_TOP = 0.0325   # distancia desde el borde inferior hasta arriba de la marca
MARK_BOTTOM = 0.0146
PAD = 0.014         # margen extra alrededor, por si la marca varía un poco


def is_todocoleccion_image(url: str) -> bool:
    return "todocoleccion.online/" in (url or "")


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

    x0 = int(w - (MARK_LEFT + PAD) * w)
    x1 = int(w - max(MARK_RIGHT - PAD, 0.004) * w)
    y0 = int(h - (MARK_TOP + PAD) * w)
    y1 = int(h - max(MARK_BOTTOM - PAD, 0.003) * w)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(w, x1), min(h, y1)

    draw = ImageDraw.Draw(img)
    radius = max(4, (y1 - y0) // 3)
    draw.rounded_rectangle((x0, y0, x1, y1), radius=radius, fill=BRAND_COLOR)

    # Texto blanco lo más grande posible dentro del recuadro.
    box_w, box_h = x1 - x0, y1 - y0
    size = max(8, int(box_h * 0.62))
    font = _font(size)
    while size > 8:
        left, top, right, bottom = draw.textbbox((0, 0), TEXT, font=font)
        if right - left <= box_w * 0.86 and bottom - top <= box_h * 0.7:
            break
        size -= 1
        font = _font(size)
    left, top, right, bottom = draw.textbbox((0, 0), TEXT, font=font)
    tx = x0 + (box_w - (right - left)) / 2 - left
    ty = y0 + (box_h - (bottom - top)) / 2 - top
    draw.text((tx, ty), TEXT, font=font, fill=(255, 255, 255))

    out = io.BytesIO()
    img.save(out, "JPEG", quality=90, optimize=True)
    return out.getvalue(), "image/jpeg"
