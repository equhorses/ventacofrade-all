"""
Handles Stripe Checkout Sessions and lifecycle management (cancel, resume,
change plan) for the two seller subscription plans (Basico / Profesional).

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
from datetime import datetime, timezone
from typing import Optional

import stripe
from core.config import settings
from models.seller_profiles import Seller_profiles
from models.auth import User
from services.email import send_subscription_confirmation_email
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

    def _recurring_price_id(self, plan: str) -> Optional[str]:
        recurring_key, _ = PLAN_ENV_KEYS[plan]
        return getattr(settings, recurring_key, None)

    def _plan_for_price_id(self, price_id: Optional[str]) -> Optional[str]:
        """Reverse-lookup: given a Stripe price ID, which plan name is it?"""
        if not price_id:
            return None
        for plan, (recurring_key, _) in PLAN_ENV_KEYS.items():
            if getattr(settings, recurring_key, None) == price_id:
                return plan
        return None

    @staticmethod
    def _to_datetime(unix_ts: Optional[int]):
        if not unix_ts:
            return None
        return datetime.fromtimestamp(unix_ts, tz=timezone.utc)

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

    async def cancel_subscription(self, user_id: str) -> Seller_profiles:
        """Soft-cancel: keep access until the current paid period ends, but
        don't charge the renewal. This is what 'cancelar suscripción' means
        from the seller's point of view."""
        self._ensure_stripe_configured()

        seller_profile = await self.get_seller_profile_by_user(user_id)
        if not seller_profile or not seller_profile.stripe_subscription_id:
            raise ValueError("No tienes ninguna suscripción activa que cancelar.")

        subscription = await stripe.Subscription.modify_async(
            seller_profile.stripe_subscription_id,
            cancel_at_period_end=True,
        )

        seller_profile.cancel_at_period_end = True
        seller_profile.subscription_end_date = self._to_datetime(
            getattr(subscription, "current_period_end", None)
        )
        await self.db.commit()
        await self.db.refresh(seller_profile)
        logger.info(f"Subscription for user_id={user_id} set to cancel at period end.")
        return seller_profile

    async def resume_subscription(self, user_id: str) -> Seller_profiles:
        """Undo a scheduled cancellation, while the period hasn't ended yet."""
        self._ensure_stripe_configured()

        seller_profile = await self.get_seller_profile_by_user(user_id)
        if not seller_profile or not seller_profile.stripe_subscription_id:
            raise ValueError("No tienes ninguna suscripción que reactivar.")

        subscription = await stripe.Subscription.modify_async(
            seller_profile.stripe_subscription_id,
            cancel_at_period_end=False,
        )

        seller_profile.cancel_at_period_end = False
        seller_profile.subscription_end_date = self._to_datetime(
            getattr(subscription, "current_period_end", None)
        )
        await self.db.commit()
        await self.db.refresh(seller_profile)
        logger.info(f"Subscription for user_id={user_id} resumed (cancellation undone).")
        return seller_profile

    async def change_plan(self, user_id: str, new_plan: str) -> Seller_profiles:
        """Switch between Basico/Profesional. Stripe prorates automatically:
        moving up charges the difference now, moving down credits the
        difference toward the next invoice — no manual math needed."""
        if new_plan not in PLAN_ENV_KEYS:
            raise ValueError(f"Plan desconocido: {new_plan}")

        self._ensure_stripe_configured()

        seller_profile = await self.get_seller_profile_by_user(user_id)
        if not seller_profile or not seller_profile.stripe_subscription_id:
            raise ValueError("No tienes ninguna suscripción activa que cambiar.")

        if seller_profile.plan == new_plan:
            raise ValueError("Ya tienes activo ese plan.")

        new_price_id = self._recurring_price_id(new_plan)
        if not new_price_id:
            raise SubscriptionsNotConfiguredError(
                f"Falta la variable de precio de Stripe para el plan '{new_plan}'."
            )

        subscription = await stripe.Subscription.retrieve_async(seller_profile.stripe_subscription_id)
        current_item = subscription["items"]["data"][0]

        updated = await stripe.Subscription.modify_async(
            seller_profile.stripe_subscription_id,
            items=[{"id": current_item["id"], "price": new_price_id}],
            proration_behavior="create_prorations",
        )

        seller_profile.plan = new_plan
        seller_profile.subscription_status = "active"
        seller_profile.cancel_at_period_end = bool(getattr(updated, "cancel_at_period_end", False))
        seller_profile.subscription_end_date = self._to_datetime(
            getattr(updated, "current_period_end", None)
        )
        await self.db.commit()
        await self.db.refresh(seller_profile)
        logger.info(f"Plan changed for user_id={user_id} to {new_plan} (prorated by Stripe).")
        return seller_profile

    async def handle_webhook_event(self, event):
        event_type = event.type
        data = event.data.object
        if event_type == "checkout.session.completed":
            await self._handle_checkout_completed(data)
        elif event_type in ("customer.subscription.deleted", "customer.subscription.updated"):
            await self._handle_subscription_change(data)
        else:
            logger.debug(f"Ignoring unhandled Stripe event type: {event_type}")

    async def _handle_checkout_completed(self, session):
        metadata = getattr(session, "metadata", None)
        user_id = getattr(metadata, "user_id", None) if metadata else None
        if not user_id:
            logger.warning("checkout.session.completed without user_id metadata; ignoring.")
            return
        seller_profile = await self.get_seller_profile_by_user(user_id)
        if not seller_profile:
            logger.warning(f"No seller_profile found for user_id={user_id} on checkout completion.")
            return

        plan = getattr(metadata, "plan", None) if metadata else None
        subscription_id = getattr(session, "subscription", None)

        seller_profile.is_active = True
        seller_profile.activation_paid = True
        seller_profile.subscription_status = "active"
        seller_profile.plan = plan
        seller_profile.cancel_at_period_end = False
        seller_profile.stripe_customer_id = getattr(session, "customer", None)
        seller_profile.stripe_subscription_id = subscription_id

        if subscription_id:
            try:
                self._ensure_stripe_configured()
                subscription = await stripe.Subscription.retrieve_async(subscription_id)
                seller_profile.subscription_end_date = self._to_datetime(
                    getattr(subscription, "current_period_end", None)
                )
            except Exception as e:
                logger.warning(f"Could not fetch subscription period end for {subscription_id}: {e}")

        await self.db.commit()
        logger.info(f"Activated subscription for user_id={user_id} (seller_profile {seller_profile.id})")

        user_result = await self.db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if user:
            await send_subscription_confirmation_email(to_email=user.email, plan=plan or "basico", name=user.name)

    async def _handle_subscription_change(self, subscription):
        """Keeps our copy of status/dates in sync with Stripe on every
        renewal, cancellation, or plan change — this is the single source
        of truth for 'subscription_end_date' and 'cancel_at_period_end'."""
        metadata = getattr(subscription, "metadata", None)
        user_id = getattr(metadata, "user_id", None) if metadata else None
        if not user_id:
            return
        seller_profile = await self.get_seller_profile_by_user(user_id)
        if not seller_profile:
            return

        status_value = getattr(subscription, "status", None)
        if status_value in ("canceled", "unpaid", "incomplete_expired"):
            seller_profile.subscription_status = "inactive"
            seller_profile.is_active = False
        elif status_value == "active":
            seller_profile.subscription_status = "active"
            seller_profile.is_active = True

        seller_profile.cancel_at_period_end = bool(getattr(subscription, "cancel_at_period_end", False))
        seller_profile.subscription_end_date = self._to_datetime(
            getattr(subscription, "current_period_end", None)
        )

        try:
            items = subscription.get("items", {}).get("data", []) if hasattr(subscription, "get") else []
            if items:
                price_id = items[0].get("price", {}).get("id")
                plan = self._plan_for_price_id(price_id)
                if plan:
                    seller_profile.plan = plan
        except Exception as e:
            logger.debug(f"Could not resolve plan from subscription items: {e}")

        await self.db.commit()
        logger.info(f"Updated subscription status for user_id={user_id} to {seller_profile.subscription_status}")
