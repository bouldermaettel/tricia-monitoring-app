from pydantic import BaseModel, Field


class AuthSessionRequest(BaseModel):
    username: str = Field(min_length=2, max_length=128)
    password: str = Field(min_length=1, max_length=256)


class AuthSessionResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_expires_in: int
    actor_id: str
    external_key: str
    acronym: str
    display_name: str
    role: str
    must_change_password: bool
    is_active: bool


class AuthRefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class AuthPasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=1, max_length=256)
