"""Password hashing and session tokens for Campus Customs.

Threat model: someone walks off with campus_customs.db. Everything here is built so that
a stolen copy still does not hand over anybody's password.

Storage format, newest first:

    pbkdf2_sha256$<iterations>$<salt_hex>$<digest_hex>   # accounts created by this app
    pbkdf2_sha256$<salt>$<digest_hex>                    # seed rows, 120_000 iterations

Keeping the iteration count inside the string is what lets us raise the work factor later
without locking anyone out: verification reads the cost from the row it is checking.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from pathlib import Path

ALGORITHM = "pbkdf2_sha256"

# OWASP's current floor for PBKDF2-HMAC-SHA256. The seed rows use 120_000; those accounts
# are transparently upgraded to this on their next successful login.
ITERATIONS = 600_000
LEGACY_ITERATIONS = 120_000

SALT_BYTES = 16
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 200
SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

_SECRET_FILE = Path(__file__).resolve().parent / ".session_secret"


# ------------------------------------------------------------------- passwords


def hash_password(password: str) -> str:
    """Hash a new password with a fresh random salt."""
    salt = secrets.token_bytes(SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"{ALGORITHM}${ITERATIONS}${salt.hex()}${digest.hex()}"


def _parse(stored: str) -> tuple[bytes, int, str] | None:
    """Return (salt_bytes, iterations, expected_hex) for either stored format."""
    parts = stored.split("$")

    if len(parts) == 4:
        algorithm, iterations, salt_hex, expected = parts
        if algorithm != ALGORITHM:
            return None
        try:
            return bytes.fromhex(salt_hex), int(iterations), expected
        except ValueError:
            return None

    if len(parts) == 3:
        # Seed rows: literal ASCII salt, iteration count not recorded.
        algorithm, salt, expected = parts
        if algorithm != ALGORITHM:
            return None
        return salt.encode(), LEGACY_ITERATIONS, expected

    return None


def verify_password(password: str, stored: str) -> tuple[bool, bool]:
    """Check a password. Returns (is_valid, should_rehash).

    should_rehash is True when the row is valid but weaker than what we issue today, so
    the caller can quietly upgrade it while it holds the plaintext.
    """
    parsed = _parse(stored)
    if parsed is None:
        return False, False

    salt, iterations, expected = parsed
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations).hex()

    # Constant time: a timing difference here leaks how much of the digest matched.
    if not hmac.compare_digest(candidate, expected):
        return False, False

    return True, iterations < ITERATIONS


def password_problem(password: str) -> str | None:
    """Return a human-readable reason the password is unacceptable, or None.

    Messages never quote the password back, so it cannot end up in a response body
    or a log line.
    """
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
    if len(password) > MAX_PASSWORD_LENGTH:
        # PBKDF2 has no practical input limit, but an unbounded password is free CPU
        # for anyone who wants to tie up the server.
        return f"Password must be at most {MAX_PASSWORD_LENGTH} characters."
    return None


# -------------------------------------------------------------------- sessions


def _session_secret() -> bytes:
    """Key for signing session tokens.

    Prefers SESSION_SECRET from the environment. Otherwise generates one and stores it
    beside this file (gitignored, chmod 600) so that restarting the server does not log
    everybody out.
    """
    from_env = os.environ.get("SESSION_SECRET")
    if from_env:
        return from_env.encode()

    if _SECRET_FILE.exists():
        return _SECRET_FILE.read_bytes()

    generated = secrets.token_bytes(32)
    _SECRET_FILE.write_bytes(generated)
    _SECRET_FILE.chmod(0o600)
    return generated


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _unb64url(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def create_session_token(user_id: int) -> str:
    """Signed, expiring token: <payload>.<signature>.

    The payload is readable by the client but not editable — changing the user_id breaks
    the signature. It deliberately carries no personal data beyond the account id.
    """
    payload = json.dumps(
        {"sub": user_id, "exp": int(time.time()) + SESSION_TTL_SECONDS},
        separators=(",", ":"),
    ).encode()
    signature = hmac.new(_session_secret(), payload, hashlib.sha256).digest()
    return f"{_b64url(payload)}.{_b64url(signature)}"


def read_session_token(token: str) -> int | None:
    """Return the user id in a valid, unexpired token, else None."""
    try:
        payload_part, signature_part = token.split(".")
        payload = _unb64url(payload_part)
        signature = _unb64url(signature_part)
    except (ValueError, base64.binascii.Error):
        return None

    expected = hmac.new(_session_secret(), payload, hashlib.sha256).digest()
    if not hmac.compare_digest(signature, expected):
        return None

    try:
        claims = json.loads(payload)
    except json.JSONDecodeError:
        return None

    if not isinstance(claims.get("sub"), int) or claims.get("exp", 0) < time.time():
        return None

    return claims["sub"]
