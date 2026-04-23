from pydantic import BaseModel, Field


class UserRecord(BaseModel):
    id: str
    external_key: str
    shortcut: str | None = None
    display_name: str
    role: str
    is_active: bool


class UserListResponse(BaseModel):
    items: list[UserRecord]


class UserCreateRequest(BaseModel):
    external_key: str = Field(min_length=2, max_length=128)
    shortcut: str | None = Field(default=None, min_length=1, max_length=32)
    password: str = Field(min_length=1, max_length=256)
    display_name: str = Field(min_length=1, max_length=128)
    role: str = Field(default="operator", min_length=3, max_length=32)
    is_active: bool = True


class UserUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=128)
    shortcut: str | None = Field(default=None, min_length=1, max_length=32)
    password: str | None = Field(default=None, min_length=1, max_length=256)
    role: str | None = Field(default=None, min_length=3, max_length=32)
    is_active: bool | None = None
