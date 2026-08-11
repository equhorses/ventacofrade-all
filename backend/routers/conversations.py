import logging
from datetime import datetime
from typing import List, Optional

from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from schemas.auth import UserResponse
from services.conversations import ConversationsService
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/messages", tags=["conversations"])


class ConversationSummary(BaseModel):
    product_id: int
    other_user_id: str
    other_user_name: str
    other_user_avatar: Optional[str] = None
    product_title: str
    product_image: Optional[str] = None
    last_message: str
    last_message_at: Optional[datetime] = None
    last_message_is_mine: bool
    unread_count: int


class ThreadMessage(BaseModel):
    id: int
    content: str
    is_mine: bool
    created_at: Optional[datetime] = None


class ThreadProduct(BaseModel):
    id: int
    title: str
    image: Optional[str] = None
    user_id: str


class ThreadOtherUser(BaseModel):
    id: str
    name: str
    avatar_url: Optional[str] = None


class ThreadResponse(BaseModel):
    messages: List[ThreadMessage]
    product: Optional[ThreadProduct] = None
    other_user: Optional[ThreadOtherUser] = None


class UnreadCountResponse(BaseModel):
    count: int


@router.get("/conversations", response_model=List[ConversationSummary])
async def list_conversations(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all conversations (grouped message threads) for the current user."""
    service = ConversationsService(db)
    return await service.list_conversations(str(current_user.id))


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Total number of unread messages across all conversations."""
    service = ConversationsService(db)
    count = await service.get_unread_count(str(current_user.id))
    return {"count": count}


@router.get("/conversations/{product_id}/{other_user_id}", response_model=ThreadResponse)
async def get_thread(
    product_id: int,
    other_user_id: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the full message thread between the current user and another user
    about a specific product. Marks any unread messages in this thread as
    read as a side effect.
    """
    service = ConversationsService(db)
    return await service.get_thread(str(current_user.id), product_id, other_user_id)
