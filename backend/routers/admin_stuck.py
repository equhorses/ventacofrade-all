"""Admin → Atascados: gente que se ha quedado a medias y botón para mandarle ayuda."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import require_roles
from schemas.auth import UserResponse
from services.audit import log_admin_action
from services.email import HELP_MESSAGES, send_help_email
from services.stuck_users import find_stuck

router = APIRouter(prefix="/api/v1/admin/atascados", tags=["admin"])


@router.get("")
async def list_stuck(
    current_user: UserResponse = Depends(require_roles("admin", "soporte")),
    db: AsyncSession = Depends(get_db),
):
    items = await find_stuck(db)
    return {"items": items, "total": len(items)}


class HelpRequest(BaseModel):
    email: EmailStr
    reason: str


@router.post("/ayuda")
async def send_help(
    payload: HelpRequest,
    current_user: UserResponse = Depends(require_roles("admin", "soporte")),
    db: AsyncSession = Depends(get_db),
):
    if payload.reason not in HELP_MESSAGES:
        raise HTTPException(status_code=400, detail="Motivo desconocido")
    ok = await send_help_email(str(payload.email), payload.reason)
    if not ok:
        raise HTTPException(status_code=502, detail="No se pudo enviar el email. Revisa RESEND_API_KEY en Railway.")
    await log_admin_action(
        db, current_user.id, current_user.email, "help_email", target=str(payload.email).lower(), details=payload.reason
    )
    return {"ok": True}
