import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_admin_user, get_staff_user, require_roles, STAFF_ROLES, ROLE_LABELS
from schemas.auth import UserResponse
from models.auth import User
from models.seller_profiles import Seller_profiles
from models.invitations import Invitation
from services.email import send_invitation_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class AdminSellerResponse(BaseModel):
    """Seller profile plus the owner's account info, for the admin panel."""
    id: int
    user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    shop_name: str
    subscription_status: Optional[str] = None
    free_listing_used: bool = False
    free_access_until: Optional[datetime] = None

    class Config:
        from_attributes = True


class GrantFreeAccessRequest(BaseModel):
    """months=0 (or omitted) revokes any complimentary access currently granted."""
    months: Optional[int] = None


class InvitationResponse(BaseModel):
    id: int
    email: str
    months: int
    status: str
    created_at: Optional[datetime] = None
    redeemed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CreateInvitationRequest(BaseModel):
    email: EmailStr
    months: int = 1


class StaffMemberResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    role: str
    role_label: str

    class Config:
        from_attributes = True


class AssignRoleRequest(BaseModel):
    email: EmailStr
    role: str


@router.get("/sellers", response_model=List[AdminSellerResponse])
async def list_sellers(
    search: Optional[str] = Query(None, description="Filtra por email, nombre o tienda"),
    current_user: UserResponse = Depends(require_roles("admin", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """List seller profiles with their account email/name, for the admin panel."""
    query = select(Seller_profiles, User).join(User, User.id == Seller_profiles.user_id)

    if search:
        like = f"%{search.strip().lower()}%"
        query = query.where(
            (User.email.ilike(like)) | (User.name.ilike(like)) | (Seller_profiles.shop_name.ilike(like))
        )

    query = query.order_by(Seller_profiles.created_at.desc()).limit(200)

    result = await db.execute(query)
    rows = result.all()

    return [
        AdminSellerResponse(
            id=seller.id,
            user_id=seller.user_id,
            email=user.email,
            name=user.name,
            shop_name=seller.shop_name,
            subscription_status=seller.subscription_status,
            free_listing_used=bool(seller.free_listing_used),
            free_access_until=seller.free_access_until,
        )
        for seller, user in rows
    ]


@router.post("/sellers/{seller_profile_id}/free-access", response_model=AdminSellerResponse)
async def grant_free_access(
    seller_profile_id: int,
    payload: GrantFreeAccessRequest,
    current_user: UserResponse = Depends(require_roles("admin", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Grant (or revoke) complimentary publishing access to a seller."""
    result = await db.execute(select(Seller_profiles).where(Seller_profiles.id == seller_profile_id))
    seller = result.scalar_one_or_none()
    if not seller:
        raise HTTPException(status_code=404, detail="Perfil de vendedor no encontrado")

    months = payload.months or 0
    if months > 0:
        seller.free_access_until = datetime.now(timezone.utc) + timedelta(days=30 * months)
    else:
        seller.free_access_until = None

    await db.commit()
    await db.refresh(seller)

    user_result = await db.execute(select(User).where(User.id == seller.user_id))
    user = user_result.scalar_one_or_none()

    logger.info(
        "Admin %s set free_access_until=%s for seller_profile_id=%s",
        current_user.email,
        seller.free_access_until,
        seller_profile_id,
    )

    return AdminSellerResponse(
        id=seller.id,
        user_id=seller.user_id,
        email=user.email if user else None,
        name=user.name if user else None,
        shop_name=seller.shop_name,
        subscription_status=seller.subscription_status,
        free_listing_used=bool(seller.free_listing_used),
        free_access_until=seller.free_access_until,
    )


@router.get("/invitations", response_model=List[InvitationResponse])
async def list_invitations(
    current_user: UserResponse = Depends(require_roles("admin", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """List all invitations sent, most recent first."""
    result = await db.execute(select(Invitation).order_by(Invitation.created_at.desc()).limit(200))
    return result.scalars().all()


@router.post("/invitations", response_model=InvitationResponse, status_code=201)
async def create_invitation(
    payload: CreateInvitationRequest,
    current_user: UserResponse = Depends(require_roles("admin", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Invite someone by email with N months of free publishing access.

    When that email later creates a seller profile, the free access is applied
    automatically (see create_seller_profiles in routers/seller_profiles.py).
    """
    normalized_email = payload.email.strip().lower()

    invitation = Invitation(
        email=normalized_email,
        token=secrets.token_urlsafe(24),
        months=max(1, payload.months),
        status="pending",
        invited_by=current_user.id,
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    sent = await send_invitation_email(to_email=normalized_email, months=invitation.months, token=invitation.token)
    if not sent:
        logger.warning("Invitacion creada pero el email no se pudo enviar a %s", normalized_email)

    return invitation


@router.get("/staff", response_model=List[StaffMemberResponse])
async def list_staff(
    current_user: UserResponse = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """List every account that has a staff role (not a regular 'user').
    Super-admin only, since this reveals who has internal access."""
    result = await db.execute(select(User).where(User.role.in_(STAFF_ROLES)).order_by(User.email))
    users = result.scalars().all()
    return [
        StaffMemberResponse(
            id=u.id,
            email=u.email,
            name=u.name,
            role=u.role,
            role_label=ROLE_LABELS.get(u.role, u.role),
        )
        for u in users
    ]


@router.post("/staff/assign-role", response_model=StaffMemberResponse)
async def assign_role(
    payload: AssignRoleRequest,
    current_user: UserResponse = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Assign a staff role to an existing account (or 'user' to revoke staff
    access). Super-admin only. The target account must have logged in at
    least once already, so it exists in our database.

    Note: role changes only take effect the next time that person logs in,
    since the role travels inside their login token."""
    normalized_email = payload.email.strip().lower()

    if payload.role not in STAFF_ROLES and payload.role != "user":
        raise HTTPException(
            status_code=400,
            detail=f"Rol desconocido. Usa uno de: {', '.join(sorted(STAFF_ROLES))}, o 'user' para revocar.",
        )

    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="Esa cuenta todavía no existe. Esa persona debe iniciar sesión al menos una vez primero.",
        )

    if user.id == current_user.id and payload.role != "admin":
        raise HTTPException(status_code=400, detail="No puedes quitarte a ti mismo el rol de super admin.")

    user.role = payload.role
    await db.commit()
    await db.refresh(user)

    logger.info("Admin %s set role=%s for %s", current_user.email, payload.role, normalized_email)

    return StaffMemberResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        role_label=ROLE_LABELS.get(user.role, user.role),
    )
