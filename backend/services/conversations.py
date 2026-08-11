import logging
from typing import Any, Dict, List, Optional

from models.messages import Messages
from models.products import Products
from models.auth import User
from sqlalchemy import or_, select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class ConversationsService:
    """
    Groups raw Messages rows (sender_id, receiver_id, product_id, content)
    into conversation threads, the way a real chat inbox works.

    A "conversation" is uniquely identified by (product_id, other_user_id)
    from the current user's point of view.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_conversations(self, user_id: str) -> List[Dict[str, Any]]:
        result = await self.db.execute(
            select(Messages)
            .where(or_(Messages.user_id == user_id, Messages.receiver_id == user_id))
            .order_by(Messages.created_at.desc())
        )
        messages = result.scalars().all()

        # Group by (product_id, other_user_id), keeping the most recent
        # message first since we already queried in descending order.
        groups: Dict[tuple, Dict[str, Any]] = {}
        for m in messages:
            other_user_id = m.receiver_id if m.user_id == user_id else m.user_id
            key = (m.product_id, other_user_id)
            if key not in groups:
                groups[key] = {
                    "product_id": m.product_id,
                    "other_user_id": other_user_id,
                    "last_message": m.content,
                    "last_message_at": m.created_at,
                    "last_message_is_mine": m.user_id == user_id,
                    "unread_count": 0,
                }
            if m.receiver_id == user_id and not m.is_read:
                groups[key]["unread_count"] += 1

        conversations = list(groups.values())

        # Enrich with product title/image and other user's name/email.
        product_ids = {c["product_id"] for c in conversations}
        other_user_ids = {c["other_user_id"] for c in conversations}

        products_by_id: Dict[int, Products] = {}
        if product_ids:
            prod_result = await self.db.execute(select(Products).where(Products.id.in_(product_ids)))
            products_by_id = {p.id: p for p in prod_result.scalars().all()}

        users_by_id: Dict[str, User] = {}
        if other_user_ids:
            user_result = await self.db.execute(select(User).where(User.id.in_(other_user_ids)))
            users_by_id = {u.id: u for u in user_result.scalars().all()}

        for c in conversations:
            product = products_by_id.get(c["product_id"])
            other_user = users_by_id.get(c["other_user_id"])
            c["product_title"] = product.title if product else "Anuncio eliminado"
            c["product_image"] = (product.images.split(",")[0] if product and product.images else None)
            c["other_user_name"] = (other_user.name if other_user and other_user.name else None) or (
                other_user.email if other_user else "Usuario"
            )
            c["other_user_avatar"] = other_user.avatar_url if other_user else None

        return conversations

    async def get_unread_count(self, user_id: str) -> int:
        result = await self.db.execute(
            select(Messages).where(Messages.receiver_id == user_id, Messages.is_read.is_(False))
        )
        return len(result.scalars().all())

    async def get_thread(
        self, user_id: str, product_id: int, other_user_id: str
    ) -> Dict[str, Any]:
        result = await self.db.execute(
            select(Messages)
            .where(
                Messages.product_id == product_id,
                or_(
                    (Messages.user_id == user_id) & (Messages.receiver_id == other_user_id),
                    (Messages.user_id == other_user_id) & (Messages.receiver_id == user_id),
                ),
            )
            .order_by(Messages.created_at.asc())
        )
        messages = result.scalars().all()

        if not messages:
            return {"messages": [], "product": None, "other_user": None}

        # Mark everything the current user received in this thread as read.
        await self.db.execute(
            sql_update(Messages)
            .where(
                Messages.product_id == product_id,
                Messages.user_id == other_user_id,
                Messages.receiver_id == user_id,
                Messages.is_read.is_(False),
            )
            .values(is_read=True)
        )
        await self.db.commit()

        product_result = await self.db.execute(select(Products).where(Products.id == product_id))
        product = product_result.scalar_one_or_none()

        user_result = await self.db.execute(select(User).where(User.id == other_user_id))
        other_user = user_result.scalar_one_or_none()

        return {
            "messages": [
                {
                    "id": m.id,
                    "content": m.content,
                    "is_mine": m.user_id == user_id,
                    "created_at": m.created_at,
                }
                for m in messages
            ],
            "product": {
                "id": product.id,
                "title": product.title,
                "image": product.images.split(",")[0] if product.images else None,
                "user_id": product.user_id,
            }
            if product
            else None,
            "other_user": {
                "id": other_user.id,
                "name": other_user.name or other_user.email,
                "avatar_url": other_user.avatar_url,
            }
            if other_user
            else {"id": other_user_id, "name": "Usuario", "avatar_url": None},
        }
