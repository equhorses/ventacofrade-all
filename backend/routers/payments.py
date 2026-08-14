import logging

import stripe
from core.config import settings
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from schemas.auth import UserResponse
from services.subscriptions import SubscriptionsNotConfiguredError, SubscriptionsService
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/payments", tags=["payments"])

FRONTEND_URL_FALLBACK = "https://ventacofrade-all.vercel.app"


class CreateCheckoutRequest(BaseModel):
    plan: str  # "basico" | "profesional"


class CreateCheckoutResponse(BaseModel):
    url: str


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
    try:
        await service.handle_webhook_event(event)
    except Exception as e:
        import traceback
        logger.error(f"Error handling Stripe webhook event: {e}\n{traceback.format_exc()}")
        # Return 200 anyway so Stripe doesn't endlessly retry a permanently
        # failing event; the error is logged for investigation.

    return {"received": True}
