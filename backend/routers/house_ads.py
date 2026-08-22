import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.house_ads import HouseAds

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/house-ads", tags=["house-ads"])

# The full list of named spots reserved in the UI for house ads.
KNOWN_SLOTS = ["home_top", "explorar_top"]


class HouseAdResponse(BaseModel):
    slot: str
    title: str
    image_url: str
    link_url: str

    class Config:
        from_attributes = True


@router.get("/{slot}", response_model=Optional[HouseAdResponse])
async def get_house_ad(slot: str, db: AsyncSession = Depends(get_db)):
    """Public — returns the active house ad for a slot, or null if none set."""
    result = await db.execute(
        select(HouseAds).where(HouseAds.slot == slot, HouseAds.active.is_(True))
    )
    ad = result.scalar_one_or_none()
    return ad
