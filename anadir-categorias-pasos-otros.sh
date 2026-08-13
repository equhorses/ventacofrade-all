#!/usr/bin/env bash
set -e

API_URL="https://ventacofrade-all-production-8c28.up.railway.app"

echo "Anadiendo categorias 'Pasos' y 'Otros'..."

curl -s -X POST "$API_URL/api/v1/entities/categories/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "name": "Pasos",
        "slug": "pasos",
        "description": "Tronos, palios, respiraderos y elementos de pasos procesionales",
        "icon": "church",
        "order_index": 9
      },
      {
        "name": "Otros",
        "slug": "otros",
        "description": "Otros articulos cofrades que no encajan en el resto de categorias",
        "icon": "package",
        "order_index": 99
      }
    ]
  }'

echo ""
echo ""
echo "Listo. Comprueba en la web que aparecen en el desplegable de categorias al publicar un anuncio."
