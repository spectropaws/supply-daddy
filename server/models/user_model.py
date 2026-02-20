from pydantic import BaseModel, Field
from typing import Optional


class UserRegister(BaseModel):
    """Registration input."""
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    password: str = Field(..., min_length=6)
    role: str = Field(..., description="manufacturer, transit_node, or receiver")
    node_codes: list[str] = Field(default=[], description="For transit_node: which nodes they operate")


class UserLogin(BaseModel):
    """Login input."""
    email: str
    password: str


class UserResponse(BaseModel):
    user_id: str
    username: str
    email: str
    role: str
    node_codes: list[str] = []
    created_at: Optional[str] = None
