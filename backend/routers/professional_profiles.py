import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from models.professional_profiles import ProfessionalProfiles
from models.auth import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/professional_profiles", tags=["professional_profiles"])

SPECIALTIES = [
    "Bordados",
    "Orfebrería",
    "Restauración",
    "Diseño de pasos",
    "Talla e imaginería",
    "Fotografía",
    "Música y bandas",
    "Cerería",
    "Otros",
]


class ProfessionalProfileData(BaseModel):
    business_name: str
    specialty: str
    description: Optional[str] = None
    province: str
    city: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    portfolio_images: Optional[str] = None


class ProfessionalProfileUpdateData(BaseModel):
    business_name: Optional[str] = None
    specialty: Optional[str] = None
    description: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    portfolio_images: Optional[str] = None
    is_active: Optional[bool] = None


class ProfessionalProfileResponse(BaseModel):
    id: int
    user_id: str
    business_name: str
    specialty: str
    description: Optional[str] = None
    province: str
    city: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    portfolio_images: Optional[str] = None
    is_active: Optional[bool] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProfessionalProfileListResponse(BaseModel):
    items: List[ProfessionalProfileResponse]
    total: int


@router.get("/specialties", response_model=List[str])
async def list_specialties():
    """Fixed list of specialties, for the filter dropdown and the create form."""
    return SPECIALTIES


@router.get("", response_model=ProfessionalProfileListResponse)
async def list_professional_profiles(
    specialty: Optional[str] = Query(None),
    province: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Filtra por nombre del negocio"),
    skip: int = Query(0, ge=0),
    limit: int = Query(24, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Public directory listing — anyone can browse the Red Profesional."""
    query = select(ProfessionalProfiles).where(ProfessionalProfiles.is_active.is_(True))
    count_query = select(func.count()).select_from(ProfessionalProfiles).where(
        ProfessionalProfiles.is_active.is_(True)
    )

    if specialty:
        query = query.where(ProfessionalProfiles.specialty == specialty)
        count_query = count_query.where(ProfessionalProfiles.specialty == specialty)
    if province:
        query = query.where(ProfessionalProfiles.province == province)
        count_query = count_query.where(ProfessionalProfiles.province == province)
    if search:
        like = f"%{search.strip().lower()}%"
        query = query.where(ProfessionalProfiles.business_name.ilike(like))
        count_query = count_query.where(ProfessionalProfiles.business_name.ilike(like))

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(ProfessionalProfiles.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()

    return ProfessionalProfileListResponse(items=items, total=total)


@router.get("/mine", response_model=Optional[ProfessionalProfileResponse])
async def get_my_professional_profile(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The current user's own professional profile, if they have one (for the edit form)."""
    result = await db.execute(
        select(ProfessionalProfiles).where(ProfessionalProfiles.user_id == str(current_user.id))
    )
    return result.scalar_one_or_none()


@router.get("/{id}", response_model=ProfessionalProfileResponse)
async def get_professional_profile(id: int, db: AsyncSession = Depends(get_db)):
    """Public profile detail page."""
    result = await db.execute(select(ProfessionalProfiles).where(ProfessionalProfiles.id == id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil profesional no encontrado")
    return profile


@router.post("", response_model=ProfessionalProfileResponse, status_code=201)
async def create_professional_profile(
    data: ProfessionalProfileData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create your professional profile. Free to activate — no payment
    required right now (activation_paid defaults to true)."""
    existing = await db.execute(
        select(ProfessionalProfiles).where(ProfessionalProfiles.user_id == str(current_user.id))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Ya tienes un perfil profesional creado.")

    if data.specialty not in SPECIALTIES:
        raise HTTPException(status_code=400, detail=f"Especialidad no válida. Usa una de: {', '.join(SPECIALTIES)}")

    profile = ProfessionalProfiles(user_id=str(current_user.id), **data.model_dump())
    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    logger.info(f"Professional profile created for user_id={current_user.id}")
    return profile


@router.put("/{id}", response_model=ProfessionalProfileResponse)
async def update_professional_profile(
    id: int,
    data: ProfessionalProfileUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update your own professional profile."""
    result = await db.execute(select(ProfessionalProfiles).where(ProfessionalProfiles.id == id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil profesional no encontrado")
    if profile.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Este perfil no te pertenece")

    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    for key, value in update_dict.items():
        setattr(profile, key, value)

    await db.commit()
    await db.refresh(profile)
    return profile


@router.delete("/{id}")
async def delete_professional_profile(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete your own professional profile."""
    result = await db.execute(select(ProfessionalProfiles).where(ProfessionalProfiles.id == id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil profesional no encontrado")
    if profile.user_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Este perfil no te pertenece")

    await db.delete(profile)
    await db.commit()
    return {"message": "Perfil profesional eliminado", "id": id}
