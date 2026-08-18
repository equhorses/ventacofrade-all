import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_admin_user, get_staff_user, require_roles, STAFF_ROLES, ROLE_LABELS
from schemas.auth import UserResponse
from models.auth import User
from models.seller_profiles import Seller_profiles
from models.invitations import Invitation
from models.products import Products
from models.waitlist import Waitlist
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


class AdminUserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    role: str
    account_status: str
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminUsersListResponse(BaseModel):
    items: List[AdminUserResponse]
    total: int


class BanUserRequest(BaseModel):
    reason: Optional[str] = None


@router.get("/users", response_model=AdminUsersListResponse)
async def list_users(
    search: Optional[str] = Query(None, description="Filtra por email o nombre"),
    status_filter: Optional[str] = Query(None, alias="status", description="active | suspended | banned | pending_deletion"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: UserResponse = Depends(get_staff_user),
    db: AsyncSession = Depends(get_db),
):
    """List every user account — not just sellers. Visible to any staff role."""
    query = select(User)
    count_query = select(func.count()).select_from(User)

    if search:
        like = f"%{search.strip().lower()}%"
        query = query.where((User.email.ilike(like)) | (User.name.ilike(like)))
        count_query = count_query.where((User.email.ilike(like)) | (User.name.ilike(like)))

    if status_filter:
        query = query.where(User.account_status == status_filter)
        count_query = count_query.where(User.account_status == status_filter)

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    return AdminUsersListResponse(items=users, total=total)


@router.post("/users/{user_id}/ban", response_model=AdminUserResponse)
async def ban_user(
    user_id: str,
    payload: BanUserRequest,
    current_user: UserResponse = Depends(require_roles("admin", "seguridad")),
    db: AsyncSession = Depends(get_db),
):
    """Ban a user account — blocks login until an admin lifts it. Different
    from the self-service 'suspend my own account', which auto-reactivates
    on next login. Admin/seguridad only."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.role in STAFF_ROLES:
        raise HTTPException(status_code=400, detail="No puedes banear a una cuenta del equipo.")

    user.account_status = "banned"
    user.suspended_at = datetime.now(timezone.utc)
    if payload.reason:
        user.deletion_reasons = payload.reason
    await db.commit()
    await db.refresh(user)

    logger.info("Admin %s banned user %s (reason: %s)", current_user.email, user.email, payload.reason)
    return user


@router.post("/users/{user_id}/unban", response_model=AdminUserResponse)
async def unban_user(
    user_id: str,
    current_user: UserResponse = Depends(require_roles("admin", "seguridad")),
    db: AsyncSession = Depends(get_db),
):
    """Lift a ban, restoring normal access."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.account_status = "active"
    user.suspended_at = None
    await db.commit()
    await db.refresh(user)

    logger.info("Admin %s unbanned user %s", current_user.email, user.email)
    return user


class AdminProductResponse(BaseModel):
    id: int
    user_id: str
    seller_email: Optional[str] = None
    title: str
    price: float
    status: Optional[str] = None
    images: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminProductsListResponse(BaseModel):
    items: List[AdminProductResponse]
    total: int


class RemoveProductRequest(BaseModel):
    reason: Optional[str] = None


@router.get("/products", response_model=AdminProductsListResponse)
async def list_products_admin(
    search: Optional[str] = Query(None, description="Filtra por título"),
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: UserResponse = Depends(get_staff_user),
    db: AsyncSession = Depends(get_db),
):
    """List every listing (including removed/paused ones), with the seller's
    email, for moderation. Visible to any staff role."""
    query = select(Products, User.email).join(User, User.id == Products.user_id, isouter=True)
    count_query = select(func.count()).select_from(Products)

    if search:
        like = f"%{search.strip().lower()}%"
        query = query.where(Products.title.ilike(like))
        count_query = count_query.where(Products.title.ilike(like))

    if status_filter:
        query = query.where(Products.status == status_filter)
        count_query = count_query.where(Products.status == status_filter)

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(Products.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    return AdminProductsListResponse(
        items=[
            AdminProductResponse(
                id=p.id,
                user_id=p.user_id,
                seller_email=email,
                title=p.title,
                price=p.price,
                status=p.status,
                images=p.images,
                created_at=p.created_at,
            )
            for p, email in rows
        ],
        total=total,
    )


@router.post("/products/{product_id}/remove", response_model=AdminProductResponse)
async def remove_product(
    product_id: int,
    payload: RemoveProductRequest,
    current_user: UserResponse = Depends(require_roles("admin", "moderacion")),
    db: AsyncSession = Depends(get_db),
):
    """Hide a listing from public view (moderation action). Doesn't delete it,
    just marks it 'removed' so the seller can see what happened."""
    result = await db.execute(select(Products).where(Products.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Anuncio no encontrado")

    product.status = "removed"
    await db.commit()
    await db.refresh(product)

    logger.info(
        "Admin %s removed product %s (reason: %s)", current_user.email, product_id, payload.reason
    )
    return AdminProductResponse(
        id=product.id,
        user_id=product.user_id,
        title=product.title,
        price=product.price,
        status=product.status,
        images=product.images,
        created_at=product.created_at,
    )


@router.post("/products/{product_id}/restore", response_model=AdminProductResponse)
async def restore_product(
    product_id: int,
    current_user: UserResponse = Depends(require_roles("admin", "moderacion")),
    db: AsyncSession = Depends(get_db),
):
    """Undo a moderation removal, making the listing active again."""
    result = await db.execute(select(Products).where(Products.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Anuncio no encontrado")

    product.status = "active"
    await db.commit()
    await db.refresh(product)

    logger.info("Admin %s restored product %s", current_user.email, product_id)
    return AdminProductResponse(
        id=product.id,
        user_id=product.user_id,
        title=product.title,
        price=product.price,
        status=product.status,
        images=product.images,
        created_at=product.created_at,
    )


@router.delete("/products/{product_id}")
async def delete_product_admin(
    product_id: int,
    current_user: UserResponse = Depends(require_roles("admin", "moderacion")),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a listing (e.g. spam, illegal content)."""
    result = await db.execute(select(Products).where(Products.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Anuncio no encontrado")

    await db.delete(product)
    await db.commit()

    logger.info("Admin %s permanently deleted product %s", current_user.email, product_id)
    return {"message": "Anuncio eliminado", "id": product_id}


class DashboardStats(BaseModel):
    total_users: int
    new_users_last_7_days: int
    total_sellers: int
    active_subscriptions: int
    basico_count: int
    profesional_count: int
    estimated_mrr: float
    total_products: int
    active_products: int
    waitlist_count: int
    invitations_sent: int
    invitations_redeemed: int


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: UserResponse = Depends(get_staff_user),
    db: AsyncSession = Depends(get_db),
):
    """High-level numbers for the admin panel's overview page.
    Available to any staff role — everyone benefits from seeing the big picture."""
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    new_users_last_7_days = (
        await db.execute(select(func.count()).select_from(User).where(User.created_at >= seven_days_ago))
    ).scalar_one()

    total_sellers = (await db.execute(select(func.count()).select_from(Seller_profiles))).scalar_one()
    active_subscriptions = (
        await db.execute(
            select(func.count()).select_from(Seller_profiles).where(Seller_profiles.subscription_status == "active")
        )
    ).scalar_one()
    basico_count = (
        await db.execute(
            select(func.count()).select_from(Seller_profiles).where(
                Seller_profiles.subscription_status == "active", Seller_profiles.plan == "basico"
            )
        )
    ).scalar_one()
    profesional_count = (
        await db.execute(
            select(func.count()).select_from(Seller_profiles).where(
                Seller_profiles.subscription_status == "active", Seller_profiles.plan == "profesional"
            )
        )
    ).scalar_one()
    estimated_mrr = round(basico_count * 4.99 + profesional_count * 9.99, 2)

    total_products = (await db.execute(select(func.count()).select_from(Products))).scalar_one()
    active_products = (
        await db.execute(select(func.count()).select_from(Products).where(Products.status == "active"))
    ).scalar_one()

    waitlist_count = (await db.execute(select(func.count()).select_from(Waitlist))).scalar_one()

    invitations_sent = (await db.execute(select(func.count()).select_from(Invitation))).scalar_one()
    invitations_redeemed = (
        await db.execute(select(func.count()).select_from(Invitation).where(Invitation.status == "redeemed"))
    ).scalar_one()

    return DashboardStats(
        total_users=total_users,
        new_users_last_7_days=new_users_last_7_days,
        total_sellers=total_sellers,
        active_subscriptions=active_subscriptions,
        basico_count=basico_count,
        profesional_count=profesional_count,
        estimated_mrr=estimated_mrr,
        total_products=total_products,
        active_products=active_products,
        waitlist_count=waitlist_count,
        invitations_sent=invitations_sent,
        invitations_redeemed=invitations_redeemed,
    )


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
