import logging
from typing import Optional

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
    email: Optional[str] = None
    months: Optional[int] = None
    already_redeemed: Optional[bool] = None


@router.get("/verify", response_model=VerifyTokenResponse)
async def verify_invitation_token(
    token: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    """Check whether an invitation token exists, and if so return the email
    and months it grants — safe to reveal here because holding the token
    (an unguessable random string sent only to that person's inbox) already
    proves ownership of that invitation; this lets the frontend show a
    personalized "your free access is waiting" banner and pre-fill the
    signup form with the right email."""
    result = await db.execute(select(Invitation).where(Invitation.token == token))
    invitation = result.scalar_one_or_none()
    if not invitation:
        return VerifyTokenResponse(valid=False)

    return VerifyTokenResponse(
        valid=True,
        email=invitation.email,
        months=invitation.months,
        already_redeemed=invitation.status == "redeemed",
    )
