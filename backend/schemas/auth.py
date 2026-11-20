from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: SecretStr = Field(min_length=1, max_length=128)


class RegisterRequest(LoginRequest):
    password: SecretStr = Field(min_length=12, max_length=128)


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    display_name: str = Field(max_length=100)
    bio: str = Field(max_length=500)
    theme: Literal["dark", "light", "system"]
    language: Literal["pt", "en"]


class CredentialUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: SecretStr = Field(min_length=1, max_length=128)
    email: EmailStr | None = None
    new_password: SecretStr | None = Field(default=None, min_length=12, max_length=128)


class User(ProfileUpdate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr


class AccessToken(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
