import logging

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.invitations import Invitation

logger = logging.getLogger(__name__)

# Public (no auth) — this is used by people who don't have an account yet,
# to unlock the "Coming Soon" gate via their personal invitation link.
router = APIRouter(prefix="/api/v1/invitations", tags=["invitations"])


class VerifyTokenResponse(BaseModel):
    valid: bool


@router.get("/verify", response_model=VerifyTokenResponse)
async def verify_invitation_token(
    token: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    """Check whether an invitation token exists (doesn't reveal the email)."""
    result = await db.execute(select(Invitation.id).where(Invitation.token == token))
    return VerifyTokenResponse(valid=result.scalar_one_or_none() is not None)
