"""Lectura de catálogos: Excel/CSV del vendedor y páginas de Todocolección."""

import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.catalog_file import CatalogFileError, parse_catalog_file  # noqa: E402
from services.platform_import import _tc_detail, _tc_list_page, source_key  # noqa: E402


def test_csv_spanish_prices_and_photos():
    data = "titulo;precio;fotos\nVirgen de candelero;2.000;v1.jpg, v2.jpg\nCorona;45,5;\n".encode("cp1252")
    items = parse_catalog_file("a.csv", data)["items"]
    assert items[0]["price"] == 2000.0 and items[0]["photos"] == ["v1.jpg", "v2.jpg"]
    assert items[1]["price"] == 45.5


def test_xlsx_header_not_on_first_row():
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(["Catálogo"])
    ws.append(["Referencia", "Título del artículo", "Precio (€)", "Estado"])
    ws.append([101, "Candelabro de plata", "1.250,50", "Restaurado"])
    buf = io.BytesIO()
    wb.save(buf)
    item = parse_catalog_file("c.xlsx", buf.getvalue())["items"][0]
    assert (item["ref"], item["price"], item["condition"]) == ("101", 1250.5, "restaurado")


def test_missing_title_column():
    try:
        parse_catalog_file("a.csv", b"foo;bar\n1;2\n")
    except CatalogFileError:
        return
    raise AssertionError("debería fallar sin columna de título")


def test_todocoleccion_list_and_detail():
    html = (
        '<a href="/orfebreria/candelabro~x123"><img src="https://cloud1.todocoleccion.online/o/tc/1/123.jpg?s=1"></a>'
        '<a href="/orfebreria/candelabro~x123">Candelabro de plata</a> 1.250,00 €'
        '<a href="/juguetes/coche~x9">Coche</a> 12,00 €'
    )
    items = _tc_list_page(html, "https://www.todocoleccion.net/s/catalogo?P=1&tienda=x")
    assert [(i["title"], i["price"]) for i in items] == [("Candelabro de plata", 1250.0), ("Coche", 12.0)]
    assert items[0]["images"] == ["https://cloud1.todocoleccion.online/o/tc/1/123.jpg"]

    detail = _tc_detail(
        '<h1>Candelabro</h1><span itemprop="price" content="1250.00"></span>'
        '<img src="https://cloud1.todocoleccion.online/o/tc/1/123.jpg"><img src="https://cloud1.todocoleccion.online/o/tc/1/123_1.jpg">'
        '<div id="descripcion">Siglo XIX, 45 cm de alto y en buen estado.</div>',
        "https://www.todocoleccion.net/orfebreria/candelabro~x123",
    )
    assert detail["price"] == 1250.0 and len(detail["images"]) == 2
    assert detail["description"].startswith("Siglo XIX")


def test_source_key():
    assert source_key("https://www.todocoleccion.net/tienda/Pepe") == "todocoleccion:pepe"
    assert source_key("https://es.wallapop.com/user/pepe-123") == "wallapop:pepe-123"
