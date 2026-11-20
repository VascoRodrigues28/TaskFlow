from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from database import get_session
from models import UserRecord
from schemas.auth import AccessToken, LoginRequest, RegisterRequest, User
from security import access_token_user_id, create_access_token, dummy_password_hash, password_hasher

router = APIRouter(prefix="/auth", tags=["Autenticação"])
DatabaseSession = Annotated[Session, Depends(get_session)]
BearerCredentials = Annotated[
    HTTPAuthorizationCredentials | None, Depends(HTTPBearer(auto_error=False))
]


def unauthorized(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=message,
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, session: DatabaseSession) -> User:
    statement = (
        insert(UserRecord)
        .values(
            email=payload.email.lower(),
            password_hash=password_hasher.hash(payload.password.get_secret_value()),
        )
        .on_conflict_do_nothing(index_elements=[UserRecord.email])
        .returning(UserRecord)
    )
    user = session.scalar(statement)
    if user is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="O email já está registado.")

    session.commit()
    return User.model_validate(user)


@router.post("/login")
def login(payload: LoginRequest, session: DatabaseSession, response: Response) -> AccessToken:
    user = session.scalar(select(UserRecord).where(UserRecord.email == payload.email.lower()))
    password_hash = user.password_hash if user is not None else dummy_password_hash
    verified = password_hasher.verify(payload.password.get_secret_value(), password_hash)
    if user is None or not verified:
        raise unauthorized("Email ou palavra-passe inválidos.")

    response.headers["Cache-Control"] = "no-store"
    return AccessToken(access_token=create_access_token(user.id))


def get_current_user(credentials: BearerCredentials, session: DatabaseSession) -> UserRecord:
    invalid_credentials = unauthorized("Token de acesso inválido ou expirado.")
    if credentials is None:
        raise invalid_credentials

    try:
        user_id = access_token_user_id(credentials.credentials)
    except (InvalidTokenError, ValueError):
        raise invalid_credentials from None

    user = session.get(UserRecord, user_id)
    if user is None:
        raise invalid_credentials
    return user


@router.get("/me")
def me(user: Annotated[UserRecord, Depends(get_current_user)]) -> User:
    return User.model_validate(user)
