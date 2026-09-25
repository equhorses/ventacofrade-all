"""API de las páginas de búsqueda /venta/<slug> (la web React las pinta con esto)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.seller_plans import tiers_for_users
from services.seo_landings import LANDINGS, POPULAR, LANDINGS_BY_SLUG, build_landing, description_for, title_for

router = APIRouter(prefix="/api/v1/landings", tags=["landings"])


def _summary(item: dict) -> dict:
    return {"slug": item["slug"], "name": item["name"], "parent": item.get("parent")}


def _product(p, tiers: dict) -> dict:
    return {
        "id": p.id,
        "title": p.title,
        "price": p.price,
        "images": p.images,
        "condition": p.condition,
        "location_city": p.location_city,
        "location_province": p.location_province,
        "is_featured": bool(p.is_featured),
        "seller_tier": tiers.get(p.user_id, "gratis"),
    }


@router.get("")
async def list_landings():
    return {
        "items": [_summary(i) for i in LANDINGS],
        "popular": [_summary(LANDINGS_BY_SLUG[s]) for s in POPULAR if s in LANDINGS_BY_SLUG],
    }


@router.get("/{slug}")
async def get_landing(slug: str, db: AsyncSession = Depends(get_db)):
    data = await build_landing(db, slug)
    if not data:
        raise HTTPException(status_code=404, detail="Búsqueda no encontrada")
    item = data["landing"]
    tiers = await tiers_for_users(db, [p.user_id for p in data["matches"] + data["related"]])
    return {
        "slug": item["slug"],
        "name": item["name"],
        "title": title_for(item),
        "description": description_for(item),
        "intro": item["intro"],
        "category_slug": data["category"].slug if data["category"] else None,
        "matches": [_product(p, tiers) for p in data["matches"]],
        "related": [_product(p, tiers) for p in data["related"]],
        "related_landings": [_summary(i) for i in data["related_landings"]],
        "children": [_summary(i) for i in data["children"]],
        "indexable": data["indexable"],
    }
