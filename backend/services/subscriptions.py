"""
Handles Stripe Checkout Sessions for the two seller subscription plans
(Basico / Profesional), each combining a recurring monthly price with a
one-time activation fee in a single Checkout Session.

Configure via these environment variables (all required for checkout to work):
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PRICE_BASICO_RECURRENTE
  STRIPE_PRICE_BASICO_ACTIVACION
  STRIPE_PRICE_PROFESIONAL_RECURRENTE
  STRIPE_PRICE_PROFESIONAL_ACTIVACION

If STRIPE_SECRET_KEY isn't set, checkout creation fails gracefully with a
clear 503 rather than crashing — same pattern used for R2/Turnstile/hCaptcha.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

import stripe
from core.config import settings
from models.seller_profiles import Seller_profiles
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

PLAN_ENV_KEYS = {
    "basico": ("stripe_price_basico_recurrente", "stripe_price_basico_activacion"),
    "profesional": ("stripe_price_profesional_recurrente", "stripe_price_profesional_activacion"),
}


class SubscriptionsNotConfiguredError(RuntimeError):
    pass


class SubscriptionsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _ensure_stripe_configured(self):
        secret_key = getattr(settings, "stripe_secret_key", None)
        if not secret_key:
            raise SubscriptionsNotConfiguredError("STRIPE_SECRET_KEY no está configurada.")
        stripe.api_key = secret_key

    async def get_seller_profile_by_user(self, user_id: str) -> Optional[Seller_profiles]:
        result = await self.db.execute(select(Seller_profiles).where(Seller_profiles.user_id == user_id))
        return result.scalar_one_or_none()

    async def create_checkout_session(
        self,
        plan: str,
        user_id: str,
        user_email: str,
        success_url: str,
        cancel_url: str,
    ) -> str:
        if plan not in PLAN_ENV_KEYS:
            raise ValueError(f"Plan desconocido: {plan}")

        self._ensure_stripe_configured()

        recurring_key, activation_key = PLAN_ENV_KEYS[plan]
        recurring_price_id = getattr(settings, recurring_key, None)
        activation_price_id = getattr(settings, activation_key, None)

        if not recurring_price_id or not activation_price_id:
            raise SubscriptionsNotConfiguredError(
                f"Faltan las variables de precio de Stripe para el plan '{plan}'."
            )

        seller_profile = await self.get_seller_profile_by_user(user_id)
        if not seller_profile:
            raise ValueError(
                "Completa primero tus datos de vendedor en Mi perfil antes de activar un plan."
            )

        session = await stripe.checkout.Session.create_async(
            mode="subscription",
            customer_email=user_email,
            line_items=[
                {"price": recurring_price_id, "quantity": 1},
                {"price": activation_price_id, "quantity": 1},
            ],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"user_id": user_id, "plan": plan, "seller_profile_id": str(seller_profile.id)},
            subscription_data={"metadata": {"user_id": user_id, "plan": plan}},
        )
        return session.url
    async def handle_webhook_event(self, event):
        event_type = event["type"]
        data = dict(event["data"]["object"])
        if event_type == "checkout.session.completed":
            await self._handle_checkout_completed(data)
        elif event_type in ("customer.subscription.deleted", "customer.subscription.updated"):
            await self._handle_subscription_change(data)
        else:
            logger.debug(f"Ignoring unhandled Stripe event type: {event_type}")
    async def _handle_checkout_completed(self, session: dict):
        metadata = session.get("metadata") or {}
        user_id = metadata.get("user_id")
        if not user_id:
            logger.warning("checkout.session.completed without user_id metadata; ignoring.")
            return

        seller_profile = await self.get_seller_profile_by_user(user_id)
        if not seller_profile:
            logger.warning(f"No seller_profile found for user_id={user_id} on checkout completion.")
            return

        seller_profile.is_active = True
        seller_profile.activation_paid = True
        seller_profile.subscription_status = "active"
        seller_profile.subscription_end_date = datetime.now() + timedelta(days=31)
        seller_profile.stripe_customer_id = session.get("customer")
        seller_profile.stripe_subscription_id = session.get("subscription")

        await self.db.commit()
        logger.info(f"Activated subscription for user_id={user_id} (seller_profile {seller_profile.id})")

    async def _handle_subscription_change(self, subscription: dict):
        metadata = subscription.get("metadata") or {}
        user_id = metadata.get("user_id")
        if not user_id:
            return

        seller_profile = await self.get_seller_profile_by_user(user_id)
        if not seller_profile:
            return

        status = subscription.get("status")
        if status in ("canceled", "unpaid", "incomplete_expired"):
            seller_profile.subscription_status = "inactive"
            seller_profile.is_active = False
        elif status == "active":
            seller_profile.subscription_status = "active"
            seller_profile.is_active = True

        await self.db.commit()
        logger.info(f"Updated subscription status for user_id={user_id} to {seller_profile.subscription_status}")
