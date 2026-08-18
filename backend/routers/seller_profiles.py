import json
import logging
from typing import List, Optional

from datetime import datetime, date, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.seller_profiles import Seller_profilesService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from models.invitations import Invitation

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/seller_profiles", tags=["seller_profiles"])


# ---------- Pydantic Schemas ----------
class Seller_profilesData(BaseModel):
    """Entity data schema (for create/update)"""
    shop_name: str
    shop_description: str = None
    province: str
    city: str = None
    phone: str = None
    is_active: bool = None
    subscription_status: str = None
    subscription_end_date: Optional[datetime] = None
    activation_paid: bool = None
    rating: float = None
    total_sales: int = None


class Seller_profilesUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    shop_name: Optional[str] = None
    shop_description: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    subscription_status: Optional[str] = None
    subscription_end_date: Optional[datetime] = None
    activation_paid: Optional[bool] = None
    rating: Optional[float] = None
    total_sales: Optional[int] = None


class Seller_profilesResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    shop_name: str
    shop_description: Optional[str] = None
    province: str
    city: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    subscription_status: Optional[str] = None
    subscription_end_date: Optional[datetime] = None
    plan: Optional[str] = None
    cancel_at_period_end: Optional[bool] = None
    activation_paid: Optional[bool] = None
    rating: Optional[float] = None
    total_sales: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Seller_profilesListResponse(BaseModel):
    """List response schema"""
    items: List[Seller_profilesResponse]
    total: int
    skip: int
    limit: int


class Seller_profilesBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Seller_profilesData]


class Seller_profilesBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Seller_profilesUpdateData


class Seller_profilesBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Seller_profilesBatchUpdateItem]


class Seller_profilesBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Seller_profilesListResponse)
async def query_seller_profiless(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query seller_profiless with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying seller_profiless: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Seller_profilesService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
            user_id=str(current_user.id),
        )
        logger.debug(f"Found {result['total']} seller_profiless")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying seller_profiless: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Seller_profilesListResponse)
async def query_seller_profiless_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query seller_profiless with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying seller_profiless: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Seller_profilesService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} seller_profiless")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying seller_profiless: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Seller_profilesResponse)
async def get_seller_profiles(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single seller_profiles by ID (user can only see their own records)"""
    logger.debug(f"Fetching seller_profiles with id: {id}, fields={fields}")
    
    service = Seller_profilesService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Seller_profiles with id {id} not found")
            raise HTTPException(status_code=404, detail="Seller_profiles not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching seller_profiles {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Seller_profilesResponse, status_code=201)
async def create_seller_profiles(
    data: Seller_profilesData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new seller_profiles"""
    logger.debug(f"Creating new seller_profiles with data: {data}")
    
    service = Seller_profilesService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create seller_profiles")

        # If this user's email had a pending invitation, redeem it automatically:
        # apply the free access window and mark the invitation as used.
        normalized_email = (current_user.email or "").strip().lower()
        if normalized_email:
            invite_result = await db.execute(
                select(Invitation).where(
                    Invitation.email == normalized_email, Invitation.status == "pending"
                )
            )
            invitation = invite_result.scalar_one_or_none()
            if invitation:
                result.free_access_until = datetime.now(timezone.utc) + timedelta(days=30 * invitation.months)
                invitation.status = "redeemed"
                invitation.redeemed_by_user_id = str(current_user.id)
                invitation.redeemed_at = datetime.now(timezone.utc)
                await db.commit()
                await db.refresh(result)
                logger.info(f"Invitacion redimida automaticamente para {normalized_email}")

        logger.info(f"Seller_profiles created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating seller_profiles: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating seller_profiles: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Seller_profilesResponse], status_code=201)
async def create_seller_profiless_batch(
    request: Seller_profilesBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple seller_profiless in a single request"""
    logger.debug(f"Batch creating {len(request.items)} seller_profiless")
    
    service = Seller_profilesService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} seller_profiless successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Seller_profilesResponse])
async def update_seller_profiless_batch(
    request: Seller_profilesBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple seller_profiless in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} seller_profiless")
    
    service = Seller_profilesService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} seller_profiless successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Seller_profilesResponse)
async def update_seller_profiles(
    id: int,
    data: Seller_profilesUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing seller_profiles (requires ownership)"""
    logger.debug(f"Updating seller_profiles {id} with data: {data}")

    service = Seller_profilesService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Seller_profiles with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Seller_profiles not found")
        
        logger.info(f"Seller_profiles {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating seller_profiles {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating seller_profiles {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_seller_profiless_batch(
    request: Seller_profilesBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple seller_profiless by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} seller_profiless")
    
    service = Seller_profilesService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} seller_profiless successfully")
        return {"message": f"Successfully deleted {deleted_count} seller_profiless", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_seller_profiles(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single seller_profiles by ID (requires ownership)"""
    logger.debug(f"Deleting seller_profiles with id: {id}")
    
    service = Seller_profilesService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Seller_profiles with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Seller_profiles not found")
        
        logger.info(f"Seller_profiles {id} deleted successfully")
        return {"message": "Seller_profiles deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting seller_profiles {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")