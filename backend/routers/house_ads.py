import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from models.house_ads import HouseAds
from models.ad_bookings import AdBooking
from services.house_ad_bookings import AdBookingsNotConfiguredError, AdBookingsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/house-ads", tags=["house-ads"])

# The full list of named spots reserved in the UI for house ads.
KNOWN_SLOTS = ["home_top", "explorar_top"]

FRONTEND_URL_FALLBACK = "https://ventacofrade-all.vercel.app"


class HouseAdResponse(BaseModel):
    slot: str
    title: str
    image_url: str
    link_url: str

    class Config:
        from_attributes = True


# --- Self-service ad slot bookings — these specific paths MUST be declared
# before the "/{slot}" catch-all route below, or FastAPI would match e.g.
# GET /slots as slot="slots" and silently return null instead. ---


class SlotAvailabilityResponse(BaseModel):
    slot: str
    price_cents: int
    self_service_enabled: bool
    occupied_until: Optional[datetime] = None
    queue_length: int = 0


@router.get("/slots", response_model=List[SlotAvailabilityResponse])
async def list_slot_availability(db: AsyncSession = Depends(get_db)):
    """Public — pricing and current availability for every ad slot, so the
    self-service booking page can show 'free now' / 'occupied until X'."""
    service = AdBookingsService(db)
    out = []
    for slot in KNOWN_SLOTS:
        config = await service.get_slot_config(slot)
        if not config:
            continue
        active = await service.get_active_booking(slot)
        queue_length = await service.get_queue_length(slot)
        out.append(
            SlotAvailabilityResponse(
                slot=slot,
                price_cents=config.price_cents,
                self_service_enabled=config.self_service_enabled,
                occupied_until=active.ends_at if active else None,
                queue_length=queue_length,
            )
        )
    return out


class BookSlotRequest(BaseModel):
    slot: str
    advertiser_name: str
    title: str
    image_url: str
    link_url: str


class BookSlotResponse(BaseModel):
    url: str


@router.post("/book", response_model=BookSlotResponse)
async def book_slot(
    payload: BookSlotRequest,
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a Stripe Checkout for a 30-day house-ad slot. Requires a
    VentaCofrade account (any account, not just sellers)."""
    if payload.slot not in KNOWN_SLOTS:
        raise HTTPException(status_code=400, detail="Hueco publicitario no válido.")

    origin = request.headers.get("origin") or FRONTEND_URL_FALLBACK
    success_url = f"{origin}/publicidad?booking=success"
    cancel_url = f"{origin}/publicidad?booking=cancelled"

    service = AdBookingsService(db)
    try:
        url = await service.create_booking_checkout(
            slot=payload.slot,
            user_id=str(current_user.id),
            advertiser_name=payload.advertiser_name,
            advertiser_email=current_user.email,
            title=payload.title,
            image_url=payload.image_url,
            link_url=payload.link_url,
            success_url=success_url,
            cancel_url=cancel_url,
        )
        return BookSlotResponse(url=url)
    except AdBookingsNotConfiguredError as e:
        logger.error(f"Stripe not configured: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Los pagos todavía no están disponibles. Inténtalo más tarde.",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating ad booking checkout: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo iniciar el pago.")


class MyBookingResponse(BaseModel):
    id: int
    slot: str
    title: str
    status: str
    amount_cents: int
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    rejected_reason: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/my-bookings", response_model=List[MyBookingResponse])
async def list_my_bookings(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The current user's own ad slot purchases, so they can check status."""
    result = await db.execute(
        select(AdBooking).where(AdBooking.user_id == str(current_user.id)).order_by(AdBooking.created_at.desc())
    )
    return result.scalars().all()


# --- Generic catch-all: must stay LAST so it never shadows the routes above ---


@router.get("/{slot}", response_model=Optional[HouseAdResponse])
async def get_house_ad(slot: str, db: AsyncSession = Depends(get_db)):
    """Public — returns the active house ad for a slot, or null if none set."""
    result = await db.execute(
        select(HouseAds).where(HouseAds.slot == slot, HouseAds.active.is_(True))
    )
    ad = result.scalar_one_or_none()
    return ad
