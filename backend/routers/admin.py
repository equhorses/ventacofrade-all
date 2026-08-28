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
from models.messages import Messages
from models.audit import AuditLog, LoginAttempt
from models.house_ads import HouseAds
from models.feature_purchases import FeaturePurchases
from models.favorites import Favorites
from models.reviews import Reviews
from models.professional_profiles import ProfessionalProfiles
from models.ad_slot_configs import AdSlotConfig
from models.ad_bookings import AdBooking
from services.house_ad_bookings import AdBookingsService
from routers.house_ads import KNOWN_SLOTS
from services.email import send_invitation_email
from services.audit import log_admin_action

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
    source: Optional[str] = None
    activated_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CreateInvitationRequest(BaseModel):
    email: EmailStr
    months: int = 1
    # Set to "sorteo_instagram" when this invitation is a raffle prize, so its
    # free-access clock only starts once the platform actually launches
    # publicly (see services/platform_settings.py).
    source: Optional[str] = None


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
    is_seller: bool = False
    plan: Optional[str] = None
    subscription_status: Optional[str] = None
    free_access_until: Optional[datetime] = None
    has_active_featured: bool = False

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
    """List every user account — not just sellers. Visible to any staff role.
    Also surfaces, per user, whether they're a seller and if so their plan,
    subscription status, any free/gifted access, and whether they currently
    have a featured listing — so staff don't have to jump into Vendedores to
    see what someone has."""
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

    user_ids = [u.id for u in users]
    sellers_by_user_id = {}
    if user_ids:
        seller_result = await db.execute(
            select(Seller_profiles).where(Seller_profiles.user_id.in_(user_ids))
        )
        sellers_by_user_id = {s.user_id: s for s in seller_result.scalars().all()}

    now = datetime.now(timezone.utc)
    featured_user_ids: set = set()
    if sellers_by_user_id:
        featured_result = await db.execute(
            select(Products.user_id)
            .where(Products.user_id.in_(sellers_by_user_id.keys()))
            .where(Products.featured_until.isnot(None))
            .where(Products.featured_until > now)
            .distinct()
        )
        featured_user_ids = {row[0] for row in featured_result.all()}

    items = []
    for u in users:
        seller = sellers_by_user_id.get(u.id)
        items.append(
            AdminUserResponse(
                id=u.id,
                email=u.email,
                name=u.name,
                role=u.role,
                account_status=u.account_status,
                created_at=u.created_at,
                last_login=u.last_login,
                is_seller=seller is not None,
                plan=seller.plan if seller else None,
                subscription_status=seller.subscription_status if seller else None,
                free_access_until=seller.free_access_until if seller else None,
                has_active_featured=u.id in featured_user_ids,
            )
        )

    return AdminUsersListResponse(items=items, total=total)


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
    await log_admin_action(
        db, current_user.id, current_user.email, "ban_user", target=user.email, details=payload.reason
    )
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
    await log_admin_action(db, current_user.id, current_user.email, "unban_user", target=user.email)
    return user


class DeleteUserResponse(BaseModel):
    deleted_email: str


@router.delete("/users/{user_id}", response_model=DeleteUserResponse)
async def delete_user_admin(
    user_id: str,
    current_user: UserResponse = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a user account and everything tied to it: seller
    profile, listings, professional profile, reviews, favorites, and any
    pending/redeemed invitation. Intended for cleaning up test accounts —
    super admin only, and refuses to touch staff/team accounts to avoid an
    accidental self-lockout or deleting a colleague.

    Unlike 'ban', this cannot be undone.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if user.role != "user":
        raise HTTPException(
            status_code=400,
            detail="No se pueden borrar cuentas de equipo desde aquí. Quita antes su rol en la pestaña Equipo.",
        )

    deleted_email = user.email

    seller_result = await db.execute(select(Seller_profiles).where(Seller_profiles.user_id == user_id))
    seller_profile = seller_result.scalar_one_or_none()
    if seller_profile:
        await db.execute(Products.__table__.delete().where(Products.user_id == user_id))
        await db.execute(FeaturePurchases.__table__.delete().where(FeaturePurchases.seller_user_id == user_id))
        await db.execute(Reviews.__table__.delete().where(Reviews.seller_profile_id == seller_profile.id))
        await db.delete(seller_profile)

    await db.execute(ProfessionalProfiles.__table__.delete().where(ProfessionalProfiles.user_id == user_id))
    await db.execute(Favorites.__table__.delete().where(Favorites.user_id == user_id))
    await db.execute(Messages.__table__.delete().where(Messages.user_id == user_id))
    await db.execute(Messages.__table__.delete().where(Messages.receiver_id == user_id))
    await db.execute(Reviews.__table__.delete().where(Reviews.reviewer_user_id == user_id))
    await db.execute(Invitation.__table__.delete().where(Invitation.redeemed_by_user_id == user_id))

    await db.delete(user)
    await db.commit()

    logger.info("Admin %s permanently deleted user %s", current_user.email, deleted_email)
    await log_admin_action(
        db, current_user.id, current_user.email, "delete_user",
        target=deleted_email, details="Borrado permanente: perfil, anuncios, mensajes, valoraciones, favoritos",
    )
    return DeleteUserResponse(deleted_email=deleted_email)


class AdminProductResponse(BaseModel):
    id: int
    user_id: str
    seller_email: Optional[str] = None
    title: str
    price: float
    status: Optional[str] = None
    images: Optional[str] = None
    featured_until: Optional[datetime] = None
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
                featured_until=p.featured_until,
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
    await log_admin_action(
        db, current_user.id, current_user.email, "remove_product",
        target=f"product:{product_id} ({product.title})", details=payload.reason,
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
    await log_admin_action(
        db, current_user.id, current_user.email, "restore_product",
        target=f"product:{product_id} ({product.title})",
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


class AdminReviewResponse(BaseModel):
    id: int
    seller_profile_id: int
    seller_email: Optional[str] = None
    reviewer_user_id: str
    reviewer_email: Optional[str] = None
    rating: int
    comment: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminReviewsListResponse(BaseModel):
    items: List[AdminReviewResponse]
    total: int


@router.get("/reviews", response_model=AdminReviewsListResponse)
async def list_reviews_admin(
    search: Optional[str] = Query(None, description="Filtra por texto del comentario"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: UserResponse = Depends(get_staff_user),
    db: AsyncSession = Depends(get_db),
):
    """List every review left on any seller profile, for moderation.
    Visible to any staff role."""
    reviewer = User.__table__.alias("reviewer")
    seller_owner = User.__table__.alias("seller_owner")

    query = (
        select(Reviews, reviewer.c.email, seller_owner.c.email)
        .join(reviewer, reviewer.c.id == Reviews.reviewer_user_id, isouter=True)
        .join(Seller_profiles, Seller_profiles.id == Reviews.seller_profile_id, isouter=True)
        .join(seller_owner, seller_owner.c.id == Seller_profiles.user_id, isouter=True)
    )
    count_query = select(func.count()).select_from(Reviews)

    if search:
        like = f"%{search.strip().lower()}%"
        query = query.where(Reviews.comment.ilike(like))
        count_query = count_query.where(Reviews.comment.ilike(like))

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(Reviews.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    rows = result.all()

    return AdminReviewsListResponse(
        items=[
            AdminReviewResponse(
                id=r.id,
                seller_profile_id=r.seller_profile_id,
                seller_email=seller_email,
                reviewer_user_id=r.reviewer_user_id,
                reviewer_email=reviewer_email,
                rating=r.rating,
                comment=r.comment,
                created_at=r.created_at,
            )
            for r, reviewer_email, seller_email in rows
        ],
        total=total,
    )


@router.delete("/reviews/{review_id}")
async def delete_review_admin(
    review_id: int,
    current_user: UserResponse = Depends(require_roles("admin", "moderacion")),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a single review (e.g. abuse, spam, insults) and
    recalculate the seller's average rating."""
    result = await db.execute(select(Reviews).where(Reviews.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Valoración no encontrada")

    seller_profile_id = review.seller_profile_id
    review_comment = review.comment

    await db.delete(review)
    await db.commit()

    # Reuse the same average-rating logic the public reviews router uses.
    from routers.reviews import _recalculate_seller_rating
    await _recalculate_seller_rating(db, seller_profile_id)

    logger.info("Admin %s deleted review %s", current_user.email, review_id)
    await log_admin_action(
        db, current_user.id, current_user.email, "delete_review",
        target=f"review:{review_id}", details=review_comment,
    )
    return {"message": "Valoración eliminada", "id": review_id}


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

    product_title = product.title
    await db.delete(product)
    await db.commit()

    logger.info("Admin %s permanently deleted product %s", current_user.email, product_id)
    await log_admin_action(
        db, current_user.id, current_user.email, "delete_product",
        target=f"product:{product_id} ({product_title})",
    )
    return {"message": "Anuncio eliminado", "id": product_id}


class AdminConversationResponse(BaseModel):
    product_id: int
    product_title: str
    buyer_email: Optional[str] = None
    buyer_user_id: Optional[str] = None
    seller_email: Optional[str] = None
    seller_user_id: Optional[str] = None
    last_message: str
    last_message_at: Optional[datetime] = None
    message_count: int


class AdminMessageResponse(BaseModel):
    id: int
    user_id: str
    sender_email: Optional[str] = None
    content: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.get("/conversations", response_model=List[AdminConversationResponse])
async def list_conversations_admin(
    search: Optional[str] = Query(None, description="Filtra por título de anuncio o email"),
    current_user: UserResponse = Depends(require_roles("admin", "soporte")),
    db: AsyncSession = Depends(get_db),
):
    """Read-only overview of every conversation on the platform, for support.
    Admin/soporte only — this is sensitive (people's private messages)."""
    result = await db.execute(select(Messages).order_by(Messages.created_at.desc()).limit(2000))
    messages = result.scalars().all()

    groups: dict = {}
    for m in messages:
        key = (m.product_id, tuple(sorted([m.user_id, m.receiver_id])))
        if key not in groups:
            groups[key] = {
                "product_id": m.product_id,
                "participants": {m.user_id, m.receiver_id},
                "last_message": m.content,
                "last_message_at": m.created_at,
                "message_count": 0,
            }
        groups[key]["message_count"] += 1

    conversations = list(groups.values())

    product_ids = {c["product_id"] for c in conversations}
    all_user_ids: set = set()
    for c in conversations:
        all_user_ids |= c["participants"]

    products_by_id = {}
    if product_ids:
        prod_result = await db.execute(select(Products).where(Products.id.in_(product_ids)))
        products_by_id = {p.id: p for p in prod_result.scalars().all()}

    users_by_id = {}
    if all_user_ids:
        user_result = await db.execute(select(User).where(User.id.in_(all_user_ids)))
        users_by_id = {u.id: u for u in user_result.scalars().all()}

    responses = []
    for c in conversations:
        product = products_by_id.get(c["product_id"])
        participant_ids = list(c["participants"])
        seller_email = None
        seller_user_id = None
        buyer_email = None
        buyer_user_id = None

        if product:
            seller_user_id = product.user_id
            seller_user = users_by_id.get(product.user_id)
            seller_email = seller_user.email if seller_user else None
            other_ids = [pid for pid in participant_ids if pid != product.user_id]
            if other_ids:
                buyer_user_id = other_ids[0]
                buyer_user = users_by_id.get(buyer_user_id)
                buyer_email = buyer_user.email if buyer_user else None
        else:
            # Support conversation (product_id == 0): one side is staff, the
            # other is the regular user — show the regular user, not blank.
            for pid in participant_ids:
                person = users_by_id.get(pid)
                if person and person.role in STAFF_ROLES:
                    seller_user_id = pid
                else:
                    buyer_user_id = pid
                    buyer_email = person.email if person else None

        if c["product_id"] == 0:
            title = "Soporte VentaCofrade"
        else:
            title = product.title if product else "Anuncio eliminado"

        if search:
            like = search.strip().lower()
            haystack = f"{title} {seller_email or ''} {buyer_email or ''}".lower()
            if like not in haystack:
                continue

        responses.append(
            AdminConversationResponse(
                product_id=c["product_id"],
                product_title=title,
                buyer_email=buyer_email,
                buyer_user_id=buyer_user_id,
                seller_email=seller_email,
                seller_user_id=seller_user_id,
                last_message=c["last_message"],
                last_message_at=c["last_message_at"],
                message_count=c["message_count"],
            )
        )

    responses.sort(key=lambda r: r.last_message_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return responses[:200]


class AdminThreadMessage(BaseModel):
    id: int
    user_id: str
    sender_email: Optional[str] = None
    content: str
    created_at: Optional[datetime] = None


@router.get("/conversations/thread", response_model=List[AdminThreadMessage])
async def get_conversation_thread(
    product_id: int = Query(...),
    user_a: str = Query(...),
    user_b: str = Query(...),
    current_user: UserResponse = Depends(require_roles("admin", "soporte")),
    db: AsyncSession = Depends(get_db),
):
    """Read-only view of a full buyer-seller conversation about a listing,
    for support supervision. Not for replying — staff who need to intervene
    should contact the person directly via the support chat."""
    result = await db.execute(
        select(Messages)
        .where(
            Messages.product_id == product_id,
            ((Messages.user_id == user_a) & (Messages.receiver_id == user_b))
            | ((Messages.user_id == user_b) & (Messages.receiver_id == user_a)),
        )
        .order_by(Messages.created_at.asc())
    )
    messages = result.scalars().all()

    sender_ids = {m.user_id for m in messages}
    users_by_id = {}
    if sender_ids:
        user_result = await db.execute(select(User).where(User.id.in_(sender_ids)))
        users_by_id = {u.id: u for u in user_result.scalars().all()}

    return [
        AdminThreadMessage(
            id=m.id,
            user_id=m.user_id,
            sender_email=users_by_id[m.user_id].email if m.user_id in users_by_id else None,
            content=m.content,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.get("/messages/unread-count")
async def get_unread_support_count(
    current_user: UserResponse = Depends(require_roles("admin", "soporte")),
    db: AsyncSession = Depends(get_db),
):
    """How many support messages (written by regular users, not staff) are
    still unread. Used for the notification badge on the 'Mensajes' tab."""
    staff_result = await db.execute(select(User.id).where(User.role.in_(STAFF_ROLES)))
    staff_ids = {row[0] for row in staff_result.all()}

    result = await db.execute(
        select(func.count())
        .select_from(Messages)
        .where(Messages.product_id == SUPPORT_PRODUCT_ID)
        .where(Messages.is_read.is_(False))
        .where(Messages.user_id.notin_(staff_ids) if staff_ids else True)
    )
    count = result.scalar_one()
    return {"unread_count": count}


class AdminChatMessage(BaseModel):
    id: int
    user_id: str
    sender_email: Optional[str] = None
    content: str
    created_at: Optional[datetime] = None
    is_from_staff: bool


class SendMessageRequest(BaseModel):
    content: str


SUPPORT_PRODUCT_ID = 0


@router.get("/users/{user_id}/messages", response_model=List[AdminChatMessage])
async def get_support_thread(
    user_id: str,
    current_user: UserResponse = Depends(require_roles("admin", "soporte")),
    db: AsyncSession = Depends(get_db),
):
    """Read the direct support conversation with a specific user (not tied
    to any product listing — that's what SUPPORT_PRODUCT_ID represents)."""
    result = await db.execute(
        select(Messages)
        .where(
            Messages.product_id == SUPPORT_PRODUCT_ID,
            (Messages.user_id == user_id) | (Messages.receiver_id == user_id),
        )
        .order_by(Messages.created_at.asc())
    )
    messages = result.scalars().all()

    sender_ids = {m.user_id for m in messages}
    users_by_id = {}
    if sender_ids:
        user_result = await db.execute(select(User).where(User.id.in_(sender_ids)))
        users_by_id = {u.id: u for u in user_result.scalars().all()}

    return [
        AdminChatMessage(
            id=m.id,
            user_id=m.user_id,
            sender_email=users_by_id[m.user_id].email if m.user_id in users_by_id else None,
            content=m.content,
            created_at=m.created_at,
            is_from_staff=m.user_id != user_id,
        )
        for m in messages
    ]


@router.post("/users/{user_id}/messages", response_model=AdminChatMessage, status_code=201)
async def send_support_message(
    user_id: str,
    payload: SendMessageRequest,
    current_user: UserResponse = Depends(require_roles("admin", "soporte")),
    db: AsyncSession = Depends(get_db),
):
    """Send a direct message to a user, as VentaCofrade support."""
    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")

    message = Messages(
        user_id=current_user.id,
        receiver_id=user_id,
        product_id=SUPPORT_PRODUCT_ID,
        content=payload.content.strip(),
        is_read=False,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    await log_admin_action(
        db, current_user.id, current_user.email, "send_support_message", target=target_user.email
    )

    return AdminChatMessage(
        id=message.id,
        user_id=message.user_id,
        sender_email=current_user.email,
        content=message.content,
        created_at=message.created_at,
        is_from_staff=True,
    )


class AuditLogEntry(BaseModel):
    id: int
    actor_email: Optional[str] = None
    action: str
    target: Optional[str] = None
    details: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.get("/audit-log", response_model=List[AuditLogEntry])
async def get_audit_log(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: UserResponse = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Who did what, and when. Super-admin only — this is the audit trail
    over everyone's actions, including other admins'."""
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()


class LoginAttemptEntry(BaseModel):
    id: int
    email: str
    method: str
    success: bool
    reason: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SecurityOverview(BaseModel):
    recent_attempts: List[LoginAttemptEntry]
    failed_last_24h: int
    suspicious_emails: List[str]  # emails with 3+ failed attempts in the last 24h


@router.get("/security", response_model=SecurityOverview)
async def get_security_overview(
    current_user: UserResponse = Depends(require_roles("admin", "seguridad")),
    db: AsyncSession = Depends(get_db),
):
    """Recent login activity and a simple 'possible brute force' signal:
    emails with 3+ failed attempts in the last 24 hours."""
    since = datetime.now(timezone.utc) - timedelta(hours=24)

    recent_result = await db.execute(
        select(LoginAttempt).order_by(LoginAttempt.created_at.desc()).limit(100)
    )
    recent_attempts = recent_result.scalars().all()

    failed_result = await db.execute(
        select(LoginAttempt).where(LoginAttempt.success.is_(False), LoginAttempt.created_at >= since)
    )
    failed_attempts = failed_result.scalars().all()

    failed_by_email: dict = {}
    for attempt in failed_attempts:
        failed_by_email[attempt.email] = failed_by_email.get(attempt.email, 0) + 1

    suspicious_emails = [email for email, count in failed_by_email.items() if count >= 3]

    return SecurityOverview(
        recent_attempts=recent_attempts,
        failed_last_24h=len(failed_attempts),
        suspicious_emails=suspicious_emails,
    )


class DashboardStats(BaseModel):
    total_users: int
    new_users_last_7_days: int
    total_sellers: int
    active_subscriptions: int
    basico_count: int
    profesional_count: int
    # Money figures — only populated for the super admin (role == "admin").
    # Other staff roles get null here, not the real numbers.
    estimated_mrr: Optional[float] = None
    featured_revenue_total: Optional[float] = None
    featured_revenue_this_month: Optional[float] = None
    active_featured_count: int
    total_products: int
    active_products: int
    waitlist_count: int
    invitations_sent: int
    invitations_redeemed: int
    google_accounts: int
    password_accounts: int


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
    now_utc = datetime.now(timezone.utc)
    start_of_month = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    is_super_admin = current_user.role == "admin"

    estimated_mrr = None
    featured_revenue_total_cents = 0
    featured_revenue_this_month_cents = 0

    if is_super_admin:
        estimated_mrr = round(basico_count * 4.99 + profesional_count * 9.99, 2)
        featured_revenue_total_cents = (
            await db.execute(select(func.coalesce(func.sum(FeaturePurchases.amount_cents), 0)))
        ).scalar_one()
        featured_revenue_this_month_cents = (
            await db.execute(
                select(func.coalesce(func.sum(FeaturePurchases.amount_cents), 0)).where(
                    FeaturePurchases.created_at >= start_of_month
                )
            )
        ).scalar_one()

    active_featured_count = (
        await db.execute(
            select(func.count()).select_from(Products).where(
                Products.featured_until.isnot(None), Products.featured_until > now_utc
            )
        )
    ).scalar_one()

    total_products = (await db.execute(select(func.count()).select_from(Products))).scalar_one()
    active_products = (
        await db.execute(select(func.count()).select_from(Products).where(Products.status == "active"))
    ).scalar_one()

    waitlist_count = (await db.execute(select(func.count()).select_from(Waitlist))).scalar_one()

    invitations_sent = (await db.execute(select(func.count()).select_from(Invitation))).scalar_one()
    invitations_redeemed = (
        await db.execute(select(func.count()).select_from(Invitation).where(Invitation.status == "redeemed"))
    ).scalar_one()

    google_accounts = (
        await db.execute(select(func.count()).select_from(User).where(User.password_hash.is_(None)))
    ).scalar_one()
    password_accounts = total_users - google_accounts

    return DashboardStats(
        total_users=total_users,
        new_users_last_7_days=new_users_last_7_days,
        total_sellers=total_sellers,
        active_subscriptions=active_subscriptions,
        basico_count=basico_count,
        profesional_count=profesional_count,
        estimated_mrr=estimated_mrr,
        featured_revenue_total=round(featured_revenue_total_cents / 100, 2) if is_super_admin else None,
        featured_revenue_this_month=round(featured_revenue_this_month_cents / 100, 2) if is_super_admin else None,
        active_featured_count=active_featured_count,
        total_products=total_products,
        active_products=active_products,
        waitlist_count=waitlist_count,
        invitations_sent=invitations_sent,
        invitations_redeemed=invitations_redeemed,
        google_accounts=google_accounts,
        password_accounts=password_accounts,
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
    await log_admin_action(
        db, current_user.id, current_user.email, "grant_free_access",
        target=f"seller_profile:{seller_profile_id} ({user.email if user else '?'})",
        details=f"months={months}",
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
        source=payload.source,
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    sent = await send_invitation_email(to_email=normalized_email, months=invitation.months, token=invitation.token)
    if not sent:
        logger.warning("Invitacion creada pero el email no se pudo enviar a %s", normalized_email)

    await log_admin_action(
        db, current_user.id, current_user.email, "create_invitation",
        target=normalized_email, details=f"months={invitation.months}",
    )

    return invitation


@router.delete("/invitations/{invitation_id}")
async def delete_invitation(
    invitation_id: int,
    current_user: UserResponse = Depends(require_roles("admin", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Delete an invitation that was never redeemed — for cleaning up test
    invites before the real campaign. Redeemed invitations should be removed
    by deleting the associated user account instead (that cascades and keeps
    the audit trail consistent with an actual account having existed)."""
    result = await db.execute(select(Invitation).where(Invitation.id == invitation_id))
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    if invitation.status == "redeemed":
        raise HTTPException(
            status_code=400,
            detail="Esta invitación ya fue canjeada. Borra la cuenta de usuario asociada en vez de la invitación.",
        )

    email = invitation.email
    await db.delete(invitation)
    await db.commit()

    await log_admin_action(db, current_user.id, current_user.email, "delete_invitation", target=email)
    return {"deleted": True}


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
    await log_admin_action(
        db, current_user.id, current_user.email, "assign_role",
        target=normalized_email, details=f"role={payload.role}",
    )

    return StaffMemberResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        role_label=ROLE_LABELS.get(user.role, user.role),
    )


class HouseAdAdminResponse(BaseModel):
    id: Optional[int] = None
    slot: str
    title: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    active: bool = False

    class Config:
        from_attributes = True


class UpsertHouseAdRequest(BaseModel):
    slot: str
    title: str
    image_url: str
    link_url: str
    active: bool = True


@router.get("/house-ads", response_model=List[HouseAdAdminResponse])
async def list_house_ads(
    current_user: UserResponse = Depends(require_roles("admin", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """List every reserved slot, with its configured ad (if any)."""
    result = await db.execute(select(HouseAds))
    ads_by_slot = {ad.slot: ad for ad in result.scalars().all()}

    return [
        HouseAdAdminResponse(
            id=ads_by_slot[slot].id if slot in ads_by_slot else None,
            slot=slot,
            title=ads_by_slot[slot].title if slot in ads_by_slot else None,
            image_url=ads_by_slot[slot].image_url if slot in ads_by_slot else None,
            link_url=ads_by_slot[slot].link_url if slot in ads_by_slot else None,
            active=bool(ads_by_slot[slot].active) if slot in ads_by_slot else False,
        )
        for slot in KNOWN_SLOTS
    ]


@router.put("/house-ads/{slot}", response_model=HouseAdAdminResponse)
async def upsert_house_ad(
    slot: str,
    payload: UpsertHouseAdRequest,
    current_user: UserResponse = Depends(require_roles("admin", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Create or update the ad configured for a slot."""
    if slot not in KNOWN_SLOTS:
        raise HTTPException(status_code=400, detail=f"Hueco desconocido. Usa uno de: {', '.join(KNOWN_SLOTS)}")

    result = await db.execute(select(HouseAds).where(HouseAds.slot == slot))
    ad = result.scalar_one_or_none()

    if ad:
        ad.title = payload.title
        ad.image_url = payload.image_url
        ad.link_url = payload.link_url
        ad.active = payload.active
    else:
        ad = HouseAds(
            slot=slot,
            title=payload.title,
            image_url=payload.image_url,
            link_url=payload.link_url,
            active=payload.active,
        )
        db.add(ad)

    await db.commit()
    await db.refresh(ad)

    await log_admin_action(
        db, current_user.id, current_user.email, "upsert_house_ad", target=slot, details=payload.title
    )

    return ad


@router.delete("/house-ads/{slot}")
async def delete_house_ad(
    slot: str,
    current_user: UserResponse = Depends(require_roles("admin", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Remove the ad configured for a slot (the slot goes back to empty)."""
    result = await db.execute(select(HouseAds).where(HouseAds.slot == slot))
    ad = result.scalar_one_or_none()
    if not ad:
        raise HTTPException(status_code=404, detail="No hay ningún anuncio configurado en ese hueco")

    await db.delete(ad)
    await db.commit()

    await log_admin_action(db, current_user.id, current_user.email, "delete_house_ad", target=slot)

    return {"message": "Anuncio eliminado", "slot": slot}


# --- Self-service ad slot bookings: pricing/availability config + approval queue ---

class AdSlotAdminResponse(BaseModel):
    slot: str
    price_cents: int
    self_service_enabled: bool
    occupied_until: Optional[datetime] = None
    queue_length: int = 0


class UpdateAdSlotRequest(BaseModel):
    price_cents: Optional[int] = None
    self_service_enabled: Optional[bool] = None


@router.get("/ad-slots", response_model=List[AdSlotAdminResponse])
async def list_ad_slots(
    current_user: UserResponse = Depends(require_roles("admin", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Price, self-service toggle, and current occupancy for every ad slot."""
    service = AdBookingsService(db)
    out = []
    for slot in KNOWN_SLOTS:
        config = await service.get_slot_config(slot)
        if not config:
            config = AdSlotConfig(slot=slot, price_cents=4999, self_service_enabled=True)
            db.add(config)
            await db.commit()
            await db.refresh(config)
        active = await service.get_active_booking(slot)
        queue_length = await service.get_queue_length(slot)
        out.append(
            AdSlotAdminResponse(
                slot=slot,
                price_cents=config.price_cents,
                self_service_enabled=config.self_service_enabled,
                occupied_until=active.ends_at if active else None,
                queue_length=queue_length,
            )
        )
    return out


@router.put("/ad-slots/{slot}", response_model=AdSlotAdminResponse)
async def update_ad_slot(
    slot: str,
    payload: UpdateAdSlotRequest,
    current_user: UserResponse = Depends(require_roles("admin", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Change the monthly price and/or block/allow self-service purchase of a slot."""
    if slot not in KNOWN_SLOTS:
        raise HTTPException(status_code=400, detail=f"Hueco desconocido. Usa uno de: {', '.join(KNOWN_SLOTS)}")

    result = await db.execute(select(AdSlotConfig).where(AdSlotConfig.slot == slot))
    config = result.scalar_one_or_none()
    if not config:
        config = AdSlotConfig(slot=slot)
        db.add(config)

    if payload.price_cents is not None:
        if payload.price_cents < 0:
            raise HTTPException(status_code=400, detail="El precio no puede ser negativo.")
        config.price_cents = payload.price_cents
    if payload.self_service_enabled is not None:
        config.self_service_enabled = payload.self_service_enabled

    await db.commit()
    await db.refresh(config)

    await log_admin_action(
        db, current_user.id, current_user.email, "update_ad_slot", target=slot,
        details=f"price_cents={config.price_cents}, self_service_enabled={config.self_service_enabled}",
    )

    service = AdBookingsService(db)
    active = await service.get_active_booking(slot)
    queue_length = await service.get_queue_length(slot)
    return AdSlotAdminResponse(
        slot=slot, price_cents=config.price_cents, self_service_enabled=config.self_service_enabled,
        occupied_until=active.ends_at if active else None, queue_length=queue_length,
    )


class AdBookingAdminResponse(BaseModel):
    id: int
    slot: str
    advertiser_name: str
    advertiser_email: str
    title: str
    image_url: str
    link_url: str
    amount_cents: int
    status: str
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    rejected_reason: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/ad-bookings", response_model=List[AdBookingAdminResponse])
async def list_ad_bookings(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: UserResponse = Depends(require_roles("admin", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """List advertiser slot bookings, most recent first. Filter by status
    (e.g. status=pending_approval) to see what's waiting for review."""
    query = select(AdBooking).order_by(AdBooking.created_at.desc()).limit(200)
    if status_filter:
        query = select(AdBooking).where(AdBooking.status == status_filter).order_by(
            AdBooking.created_at.desc()
        ).limit(200)
    result = await db.execute(query)
    return result.scalars().all()


class RejectAdBookingRequest(BaseModel):
    reason: str


@router.post("/ad-bookings/{booking_id}/approve", response_model=AdBookingAdminResponse)
async def approve_ad_booking(
    booking_id: int,
    current_user: UserResponse = Depends(require_roles("admin", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Approve a paid booking's creative. Goes live immediately if the slot
    is free, otherwise joins the queue for when it frees up."""
    service = AdBookingsService(db)
    try:
        booking = await service.approve_booking(booking_id, admin_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await log_admin_action(
        db, current_user.id, current_user.email, "approve_ad_booking",
        target=booking.advertiser_email, details=f"slot={booking.slot}, status={booking.status}",
    )
    return booking


@router.post("/ad-bookings/{booking_id}/reject", response_model=AdBookingAdminResponse)
async def reject_ad_booking(
    booking_id: int,
    payload: RejectAdBookingRequest,
    current_user: UserResponse = Depends(require_roles("admin", "marketing")),
    db: AsyncSession = Depends(get_db),
):
    """Reject a paid booking's creative (e.g. inappropriate content). The
    charge itself isn't refunded automatically — do that from Stripe if needed."""
    service = AdBookingsService(db)
    try:
        booking = await service.reject_booking(booking_id, admin_id=current_user.id, reason=payload.reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    await log_admin_action(
        db, current_user.id, current_user.email, "reject_ad_booking",
        target=booking.advertiser_email, details=f"slot={booking.slot}, reason={payload.reason}",
    )
    return booking
