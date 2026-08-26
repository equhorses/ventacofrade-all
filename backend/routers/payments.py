import logging

import stripe
from core.config import settings
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from schemas.auth import UserResponse
from services.subscriptions import SubscriptionsNotConfiguredError, SubscriptionsService
from services.featured_listings import FeaturedListingsNotConfiguredError, FeaturedListingsService, FEATURE_PRICES_CENTS
from services.house_ad_bookings import AdBookingsService
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/payments", tags=["payments"])

FRONTEND_URL_FALLBACK = "https://ventacofrade-all.vercel.app"


class CreateCheckoutRequest(BaseModel):
    plan: str  # "basico" | "profesional"


class CreateCheckoutResponse(BaseModel):
    url: str


class ChangePlanRequest(BaseModel):
    plan: str  # "basico" | "profesional"


class SubscriptionActionResponse(BaseModel):
    subscription_status: str | None = None
    plan: str | None = None
    cancel_at_period_end: bool | None = None
    subscription_end_date: str | None = None


@router.post("/checkout", response_model=CreateCheckoutResponse)
async def create_checkout(
    payload: CreateCheckoutRequest,
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout Session for a seller subscription plan."""
    origin = request.headers.get("origin") or FRONTEND_URL_FALLBACK
    success_url = f"{origin}/cuenta/suscripcion?checkout=success"
    cancel_url = f"{origin}/cuenta/suscripcion?checkout=cancelled"

    service = SubscriptionsService(db)
    try:
        url = await service.create_checkout_session(
            plan=payload.plan,
            user_id=str(current_user.id),
            user_email=current_user.email,
            success_url=success_url,
            cancel_url=cancel_url,
        )
        return CreateCheckoutResponse(url=url)
    except SubscriptionsNotConfiguredError as e:
        logger.error(f"Stripe not configured: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Los pagos todavía no están disponibles. Inténtalo más tarde.",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating checkout session: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo iniciar el pago.")


class FeatureListingRequest(BaseModel):
    product_id: int
    days: int  # 3 | 7 | 30


@router.get("/feature-listing/prices")
async def get_feature_prices():
    """Public pricing table for featuring a listing, in euros."""
    return {str(days): cents / 100 for days, cents in FEATURE_PRICES_CENTS.items()}


@router.post("/feature-listing", response_model=CreateCheckoutResponse)
async def create_feature_checkout(
    payload: FeatureListingRequest,
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a one-time Stripe Checkout Session to feature a listing."""
    origin = request.headers.get("origin") or FRONTEND_URL_FALLBACK
    success_url = f"{origin}/cuenta/anuncios?feature=success"
    cancel_url = f"{origin}/cuenta/anuncios?feature=cancelled"

    service = FeaturedListingsService(db)
    try:
        url = await service.create_feature_checkout(
            product_id=payload.product_id,
            days=payload.days,
            user_id=str(current_user.id),
            user_email=current_user.email,
            success_url=success_url,
            cancel_url=cancel_url,
        )
        return CreateCheckoutResponse(url=url)
    except FeaturedListingsNotConfiguredError as e:
        logger.error(f"Stripe not configured: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Los pagos todavía no están disponibles. Inténtalo más tarde.",
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating feature-listing checkout: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo iniciar el pago.")


def _to_action_response(seller_profile) -> "SubscriptionActionResponse":
    return SubscriptionActionResponse(
        subscription_status=seller_profile.subscription_status,
        plan=seller_profile.plan,
        cancel_at_period_end=bool(seller_profile.cancel_at_period_end),
        subscription_end_date=(
            seller_profile.subscription_end_date.isoformat() if seller_profile.subscription_end_date else None
        ),
    )


@router.post("/subscription/cancel", response_model=SubscriptionActionResponse)
async def cancel_subscription(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Schedule cancellation for the end of the current paid period — access
    continues until then, but the renewal will not be charged."""
    service = SubscriptionsService(db)
    try:
        seller_profile = await service.cancel_subscription(str(current_user.id))
        return _to_action_response(seller_profile)
    except SubscriptionsNotConfiguredError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error cancelling subscription: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo cancelar la suscripción.")


@router.post("/subscription/resume", response_model=SubscriptionActionResponse)
async def resume_subscription(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Undo a scheduled cancellation while the current period hasn't ended."""
    service = SubscriptionsService(db)
    try:
        seller_profile = await service.resume_subscription(str(current_user.id))
        return _to_action_response(seller_profile)
    except SubscriptionsNotConfiguredError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error resuming subscription: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo reactivar la suscripción.")


@router.post("/subscription/change-plan", response_model=SubscriptionActionResponse)
async def change_plan(
    payload: ChangePlanRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Switch plan; Stripe prorates the difference automatically."""
    service = SubscriptionsService(db)
    try:
        seller_profile = await service.change_plan(str(current_user.id), payload.plan)
        return _to_action_response(seller_profile)
    except SubscriptionsNotConfiguredError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error changing plan: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo cambiar de plan.")


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Receives and verifies Stripe webhook events, then updates seller subscriptions."""
    webhook_secret = getattr(settings, "stripe_webhook_secret", None)
    if not webhook_secret:
        logger.error("STRIPE_WEBHOOK_SECRET not configured; rejecting webhook.")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Webhook not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        logger.error(f"Invalid Stripe webhook signature: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

    service = SubscriptionsService(db)
    featured_service = FeaturedListingsService(db)
    ad_bookings_service = AdBookingsService(db)
    try:
        if event.type == "checkout.session.completed":
            session = event.data.object
            metadata = getattr(session, "metadata", None)
            purpose = getattr(metadata, "purpose", None) if metadata else None
            if purpose == "feature_listing":
                await featured_service.handle_feature_payment_completed(session)
            elif purpose == "house_ad_booking":
                await ad_bookings_service.handle_booking_payment_completed(session)
            else:
                await service.handle_webhook_event(event)
        else:
            await service.handle_webhook_event(event)
    except Exception as e:
        import traceback
        logger.error(f"Error handling Stripe webhook event: {e}\n{traceback.format_exc()}")
        # Return 200 anyway so Stripe doesn't endlessly retry a permanently
        # failing event; the error is logged for investigation.

    return {"received": True}
