"""Password hashing utilities using Python's standard library only.

Uses PBKDF2-HMAC-SHA256, which is built into hashlib, so no extra
dependencies are required (keeps the Railway build simple and reliable).
"""
import hashlib
import hmac
import os
import secrets

_ITERATIONS = 260_000
_ALGO = "sha256"


def hash_password(password: str) -> str:
    """Hash a plaintext password, returning a string safe to store in the DB.

    Format: pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>
    """
    salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac(_ALGO, password.encode("utf-8"), bytes.fromhex(salt), _ITERATIONS)
    return f"pbkdf2_sha256${_ITERATIONS}${salt}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a plaintext password against a stored hash created by hash_password."""
    try:
        algo_name, iterations_str, salt, hash_hex = stored_hash.split("$")
        if algo_name != "pbkdf2_sha256":
            return False
        iterations = int(iterations_str)
    except (ValueError, AttributeError):
        return False

    derived = hashlib.pbkdf2_hmac(_ALGO, password.encode("utf-8"), bytes.fromhex(salt), iterations)
    return hmac.compare_digest(derived.hex(), hash_hex)
