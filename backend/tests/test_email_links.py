"""Falla si algún email (o guion) enlaza a una página de ventacofrade.com que no existe en la web.

Así no se vuelve a repetir lo de /cuenta/publicar, que llevaba a una página en blanco.
Ejecutar: cd backend && python -m pytest tests/test_email_links.py
"""

import re
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
APP_TSX = BACKEND.parent / "frontend" / "src" / "App.tsx"
LINK_RE = re.compile(r"https://www\.ventacofrade\.com(/[^\s\"'<>?#{}]*)")

# Rutas que sirve Vercel/el backend y no React (sitemap, blog prerenderizado, imágenes…).
STATIC_PREFIXES = ("/blog", "/sitemap", "/favicon", "/images", "/robots.txt", "/seo/")


def _routes() -> list[re.Pattern]:
    paths = re.findall(r'path="([^"]+)"', APP_TSX.read_text(encoding="utf-8"))
    patterns = []
    for path in paths:
        if path == "*":
            continue
        regex = re.sub(r":[A-Za-z]+", "[^/]+", path.rstrip("/") or "/")
        patterns.append(re.compile(f"^{regex}/?$"))
    return patterns


def _links() -> dict[str, set[str]]:
    found: dict[str, set[str]] = {}
    files = (
        list((BACKEND / "services").glob("*.py"))
        + list((BACKEND / "scripts").glob("*.py"))
        + list((BACKEND / "routers").glob("*.py"))
    )
    for py in files:
        text = py.read_text(encoding="utf-8").replace("{SITE_URL}", "https://www.ventacofrade.com")
        # Las partes variables de una f-string (/producto/{p.id}) cuentan como un segmento cualquiera.
        text = re.sub(r"\{[^{}\s]+\}", "x", text)
        for path in LINK_RE.findall(text):
            found.setdefault(path.rstrip("/") or "/", set()).add(py.name)
    return found


def test_email_links_point_to_existing_pages():
    routes = _routes()
    broken = {
        path: sorted(files)
        for path, files in _links().items()
        if not path.startswith(STATIC_PREFIXES) and not any(r.match(path) for r in routes)
    }
    assert not broken, f"Enlaces a páginas que no existen: {broken}"
