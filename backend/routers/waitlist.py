import logging

from core.database import get_db
from fastapi import APIRouter, Depends, HTTPException, status
from models.waitlist import Waitlist
from pydantic import BaseModel, EmailStr
from services.email import send_waitlist_confirmation_email
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/waitlist", tags=["waitlist"])
logger = logging.getLogger(__name__)


class WaitlistJoinRequest(BaseModel):
    email: EmailStr


@router.post("/join", status_code=status.HTTP_201_CREATED)
async def join_waitlist(payload: WaitlistJoinRequest, db: AsyncSession = Depends(get_db)):
    """Add an email to the waitlist. Idempotent: if already registered, returns success."""
    normalized_email = payload.email.strip().lower()

    result = await db.execute(select(Waitlist).where(Waitlist.email == normalized_email))
    existing = result.scalar_one_or_none()
    if existing:
        return {"success": True, "message": "Ya estás en la lista de espera"}

    entry = Waitlist(email=normalized_email)
    db.add(entry)
    await db.commit()

    await send_waitlist_confirmation_email(to_email=normalized_email)

    return {"success": True, "message": "Te hemos apuntado a la lista de espera"}
