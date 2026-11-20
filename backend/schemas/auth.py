from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: SecretStr = Field(min_length=1, max_length=128)


class RegisterRequest(LoginRequest):
    password: SecretStr = Field(min_length=12, max_length=128)


class User(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr


class AccessToken(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
