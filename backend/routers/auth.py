from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from database import get_session
from models import UserRecord
from schemas.auth import AccessToken, CredentialUpdate, LoginRequest, ProfileUpdate, RegisterRequest, User
from security import access_token_identity, create_access_token, dummy_password_hash, password_hasher

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
    return AccessToken(access_token=create_access_token(user.id, user.token_version))


def get_current_user(credentials: BearerCredentials, session: DatabaseSession) -> UserRecord:
    invalid_credentials = unauthorized("Token de acesso inválido ou expirado.")
    if credentials is None:
        raise invalid_credentials

    try:
        user_id, token_version = access_token_identity(credentials.credentials)
    except (InvalidTokenError, ValueError):
        raise invalid_credentials from None

    user = session.get(UserRecord, user_id)
    if user is None or user.token_version != token_version:
        raise invalid_credentials
    return user


CurrentUser = Annotated[UserRecord, Depends(get_current_user)]


@router.get("/me")
def me(user: CurrentUser) -> User:
    return User.model_validate(user)


@router.put("/me")
def update_profile(payload: ProfileUpdate, user: CurrentUser, session: DatabaseSession) -> User:
    for field, value in payload.model_dump().items():
        setattr(user, field, value)
    session.commit()
    return User.model_validate(user)


@router.put("/credentials", status_code=status.HTTP_204_NO_CONTENT)
def update_credentials(payload: CredentialUpdate, user: CurrentUser, session: DatabaseSession) -> Response:
    original_version = user.token_version
    locked_user = session.scalar(
        select(UserRecord).where(UserRecord.id == user.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if locked_user is None or locked_user.token_version != original_version:
        raise unauthorized("Token de acesso inválido ou expirado.")
    if not password_hasher.verify(payload.current_password.get_secret_value(), locked_user.password_hash):
        raise HTTPException(status_code=403, detail="A palavra-passe atual está incorreta.")

    email = payload.email.lower() if payload.email else locked_user.email
    if email == locked_user.email and payload.new_password is None:
        raise HTTPException(status_code=422, detail="Indica um email diferente ou uma nova palavra-passe.")

    locked_user.email = email
    if payload.new_password is not None:
        locked_user.password_hash = password_hasher.hash(payload.new_password.get_secret_value())
    locked_user.token_version += 1
    try:
        session.commit()
    except DBAPIError as error:
        session.rollback()
        # pg8000 puts the PostgreSQL error fields in the first argument.
        args = error.orig.args
        if args and isinstance(args[0], dict) and args[0].get("C") == "23505":
            raise HTTPException(status_code=409, detail="O email já está registado.") from None
        raise
    return Response(status_code=status.HTTP_204_NO_CONTENT)
