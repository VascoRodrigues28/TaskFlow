from datetime import UTC, datetime, timedelta
from os import getenv
from secrets import token_urlsafe
from uuid import UUID

import jwt
from pwdlib import PasswordHash

password_hasher = PasswordHash.recommended()
dummy_password_hash = password_hasher.hash(token_urlsafe(32))
TOKEN_LIFETIME = timedelta(minutes=30)
TOKEN_ISSUER = "taskflow-api"
TOKEN_ALGORITHM = "HS256"


def jwt_secret() -> str:
    secret = getenv("JWT_SECRET", "")
    if len(secret.encode()) < 32:
        raise RuntimeError("Define JWT_SECRET com pelo menos 32 bytes aleatórios.")
    return secret


def create_access_token(user_id: UUID) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {"sub": str(user_id), "iss": TOKEN_ISSUER, "iat": now, "exp": now + TOKEN_LIFETIME},
        jwt_secret(),
        algorithm=TOKEN_ALGORITHM,
    )


def access_token_user_id(token: str) -> UUID:
    claims = jwt.decode(
        token,
        jwt_secret(),
        algorithms=[TOKEN_ALGORITHM],
        issuer=TOKEN_ISSUER,
        options={"require": ["sub", "iss", "iat", "exp"]},
    )
    return UUID(claims["sub"])
