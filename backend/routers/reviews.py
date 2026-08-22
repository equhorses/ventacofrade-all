import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from models.auth import User
from models.reviews import Reviews
from models.seller_profiles import Seller_profiles

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/reviews", tags=["reviews"])


class ReviewResponse(BaseModel):
    id: int
    seller_profile_id: int
    reviewer_user_id: str
    reviewer_name: Optional[str] = None
    rating: int
    comment: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReviewsListResponse(BaseModel):
    items: List[ReviewResponse]
    total: int
    average_rating: float


class SubmitReviewRequest(BaseModel):
    seller_profile_id: int
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


async def _recalculate_seller_rating(db: AsyncSession, seller_profile_id: int) -> None:
    """Keep seller_profiles.rating in sync with the average of its reviews."""
    result = await db.execute(
        select(func.avg(Reviews.rating)).where(Reviews.seller_profile_id == seller_profile_id)
    )
    avg_rating = result.scalar()

    seller_result = await db.execute(select(Seller_profiles).where(Seller_profiles.id == seller_profile_id))
    seller = seller_result.scalar_one_or_none()
    if seller:
        seller.rating = round(float(avg_rating), 2) if avg_rating is not None else 0
        await db.commit()


@router.get("", response_model=ReviewsListResponse)
async def list_reviews(
    seller_profile_id: int = Query(..., description="ID del perfil de vendedor"),
    db: AsyncSession = Depends(get_db),
):
    """List reviews for a seller, public — anyone can read them."""
    result = await db.execute(
        select(Reviews, User.name, User.email)
        .join(User, User.id == Reviews.reviewer_user_id, isouter=True)
        .where(Reviews.seller_profile_id == seller_profile_id)
        .order_by(Reviews.created_at.desc())
    )
    rows = result.all()

    avg_result = await db.execute(
        select(func.avg(Reviews.rating)).where(Reviews.seller_profile_id == seller_profile_id)
    )
    avg_rating = avg_result.scalar()

    return ReviewsListResponse(
        items=[
            ReviewResponse(
                id=r.id,
                seller_profile_id=r.seller_profile_id,
                reviewer_user_id=r.reviewer_user_id,
                reviewer_name=name or (email.split("@")[0] if email else None),
                rating=r.rating,
                comment=r.comment,
                created_at=r.created_at,
            )
            for r, name, email in rows
        ],
        total=len(rows),
        average_rating=round(float(avg_rating), 2) if avg_rating is not None else 0,
    )


@router.post("", response_model=ReviewResponse, status_code=201)
async def submit_review(
    payload: SubmitReviewRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Leave (or update) a review for a seller. One review per person per
    seller — submitting again just updates your existing review."""
    seller_result = await db.execute(
        select(Seller_profiles).where(Seller_profiles.id == payload.seller_profile_id)
    )
    seller = seller_result.scalar_one_or_none()
    if not seller:
        raise HTTPException(status_code=404, detail="Vendedor no encontrado")

    if seller.user_id == str(current_user.id):
        raise HTTPException(status_code=400, detail="No puedes valorarte a ti mismo")

    existing_result = await db.execute(
        select(Reviews).where(
            Reviews.seller_profile_id == payload.seller_profile_id,
            Reviews.reviewer_user_id == str(current_user.id),
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        existing.rating = payload.rating
        existing.comment = payload.comment
        review = existing
    else:
        review = Reviews(
            seller_profile_id=payload.seller_profile_id,
            reviewer_user_id=str(current_user.id),
            rating=payload.rating,
            comment=payload.comment,
        )
        db.add(review)

    await db.commit()
    await db.refresh(review)

    await _recalculate_seller_rating(db, payload.seller_profile_id)

    return ReviewResponse(
        id=review.id,
        seller_profile_id=review.seller_profile_id,
        reviewer_user_id=review.reviewer_user_id,
        reviewer_name=current_user.name,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
    )
