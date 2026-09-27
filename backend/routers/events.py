"""La web avisa aquí de los momentos en que alguien se puede atascar.

Nunca devuelve error al navegador (ni 401): si la sesión no vale, simplemente no se guarda.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import AccessTokenError, decode_access_token
from core.database import get_db
from models.user_events import UserEvent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/events", tags=["events"])

ALLOWED_KINDS = {"publish_started", "publish_failed", "upload_failed", "api_error"}
MAX_PER_HOUR = 30


class EventIn(BaseModel):
    kind: str = Field(max_length=50)
    detail: Optional[str] = Field(default=None, max_length=1000)
    path: Optional[str] = Field(default=None, max_length=255)


@router.post("", status_code=204)
async def record_event(payload: EventIn, request: Request, db: AsyncSession = Depends(get_db)):
    if payload.kind not in ALLOWED_KINDS:
        return Response(status_code=204)
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return Response(status_code=204)
    try:
        claims = decode_access_token(auth.split(" ", 1)[1])
    except AccessTokenError:
        return Response(status_code=204)
    user_id = str(claims.get("sub") or "")
    if not user_id:
        return Response(status_code=204)

    since = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = (
        await db.execute(
            select(func.count(UserEvent.id)).where(UserEvent.user_id == user_id, UserEvent.created_at >= since)
        )
    ).scalar_one()
    if recent >= MAX_PER_HOUR:
        return Response(status_code=204)

    db.add(
        UserEvent(
            user_id=user_id,
            email=(claims.get("email") or "")[:255] or None,
            kind=payload.kind,
            detail=(payload.detail or "")[:1000] or None,
            path=(payload.path or "")[:255] or None,
        )
    )
    await db.commit()
    return Response(status_code=204)
