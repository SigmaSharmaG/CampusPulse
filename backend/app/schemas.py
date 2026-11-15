from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class FacilityStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    category: str
    capacity: int
    density: float = Field(ge=0, le=100)
    wifi_count: int = Field(ge=0)
    noise_db: float = Field(ge=0, le=140)
    updated_at: datetime
    geometry: dict[str, Any]


class DensitySample(BaseModel):
    density: float = Field(ge=0, le=100)
    sampled_at: datetime


class ErrorDetail(BaseModel):
    loc: list[str | int]
    msg: str
    type: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody


class WsMessage(BaseModel):
    type: Literal["snapshot", "facility.updated", "ping"]
    data: dict[str, Any]
