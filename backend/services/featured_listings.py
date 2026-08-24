"""
Handles paying to feature (highlight) a single listing for a fixed number
of days — a one-time Stripe payment, separate from the recurring seller
subscription plans.

Pricing lives here as a simple dict; no Stripe Price objects need to be
pre-created in the dashboard (uses dynamic price_data).
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import stripe
from core.config import settings
from models.products import Products
from models.feature_purchases import FeaturePurchases
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# days -> price in cents (EUR)
FEATURE_PRICES_CENTS = {
    3: 299,
    7: 599,
    30: 1499,
}


class FeaturedListingsNotConfiguredError(RuntimeError):
    pass


class FeaturedListingsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _ensure_stripe_configured(self):
        secret_key = getattr(settings, "stripe_secret_key", None)
        if not secret_key:
            raise FeaturedListingsNotConfiguredError("STRIPE_SECRET_KEY no está configurada.")
        stripe.api_key = secret_key

    async def create_feature_checkout(
        self,
        product_id: int,
        days: int,
        user_id: str,
        user_email: str,
        success_url: str,
        cancel_url: str,
    ) -> str:
        if days not in FEATURE_PRICES_CENTS:
            raise ValueError(f"Duración no válida. Elige entre: {', '.join(str(d) for d in FEATURE_PRICES_CENTS)} días.")

        self._ensure_stripe_configured()

        result = await self.db.execute(select(Products).where(Products.id == product_id))
        product = result.scalar_one_or_none()
        if not product:
            raise ValueError("Anuncio no encontrado.")
        if product.user_id != user_id:
            raise ValueError("Este anuncio no te pertenece.")

        price_cents = FEATURE_PRICES_CENTS[days]

        session = await stripe.checkout.Session.create_async(
            mode="payment",
            customer_email=user_email,
            line_items=[
                {
                    "price_data": {
                        "currency": "eur",
                        "product_data": {"name": f"Destacar anuncio: {product.title} ({days} días)"},
                        "unit_amount": price_cents,
                    },
                    "quantity": 1,
                }
            ],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "purpose": "feature_listing",
                "product_id": str(product_id),
                "days": str(days),
                "user_id": user_id,
            },
        )
        return session.url

    async def handle_feature_payment_completed(self, session) -> None:
        metadata = getattr(session, "metadata", None)
        product_id = getattr(metadata, "product_id", None) if metadata else None
        days = getattr(metadata, "days", None) if metadata else None
        if not product_id or not days:
            logger.warning("feature_listing checkout completed without expected metadata; ignoring.")
            return

        result = await self.db.execute(select(Products).where(Products.id == int(product_id)))
        product = result.scalar_one_or_none()
        if not product:
            logger.warning(f"Product {product_id} not found for feature payment completion.")
            return

        now = datetime.now(timezone.utc)
        current_until = product.featured_until
        if current_until and current_until.tzinfo is None:
            current_until = current_until.replace(tzinfo=timezone.utc)

        # Extend from the current expiry if still active, otherwise start from now.
        base = current_until if (current_until and current_until > now) else now
        product.featured_until = base + timedelta(days=int(days))
        product.is_featured = True

        # Keep a permanent revenue record — featured_until only tracks the
        # current expiry and gets overwritten on renewal, so this is the
        # only place the admin can see real earnings history from this.
        self.db.add(
            FeaturePurchases(
                product_id=product.id,
                seller_user_id=product.user_id,
                days=int(days),
                amount_cents=FEATURE_PRICES_CENTS.get(int(days), 0),
            )
        )

        await self.db.commit()
        logger.info(f"Product {product_id} featured until {product.featured_until}")
