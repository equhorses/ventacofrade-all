"""
Verifies hCaptcha tokens against hCaptcha's API.

Configure via the HCAPTCHA_SECRET_KEY environment variable (the secret key
from the hCaptcha dashboard, NOT the public site key). If this variable
isn't set, verification is skipped entirely — this lets the app keep
working before the CAPTCHA is configured, and turns on enforcement
automatically the moment the env var is added, no code changes needed.
"""

import logging
from typing import Optional

import httpx
from core.config import settings

logger = logging.getLogger(__name__)

HCAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify"


def is_hcaptcha_configured() -> bool:
    return bool(getattr(settings, "hcaptcha_secret_key", None))


async def verify_hcaptcha_token(token: Optional[str], remote_ip: Optional[str] = None) -> bool:
    """
    Returns True if the token is valid, or if hCaptcha isn't configured yet
    (graceful no-op). Returns False if configured but the token is missing
    or invalid.
    """
    secret_key = getattr(settings, "hcaptcha_secret_key", None)
    if not secret_key:
        logger.debug("hCaptcha not configured (HCAPTCHA_SECRET_KEY unset); skipping CAPTCHA check.")
        return True

    if not token:
        return False

    payload = {"secret": secret_key, "response": token}
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(HCAPTCHA_VERIFY_URL, data=payload)
            resp.raise_for_status()
            data = resp.json()
            return bool(data.get("success"))
    except Exception as e:
        logger.error(f"hCaptcha verification request failed: {e}")
        # Fail closed: if we can't verify, treat as invalid rather than
        # silently letting spam through.
        return False
