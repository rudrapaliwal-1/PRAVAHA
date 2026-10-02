"""
api/schemas.py — Standardized Pydantic schemas for API metadata and error responses.
"""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Liveness probe response model."""

    status: str = Field(
        default="ok",
        description="Current health status of the service",
        json_schema_extra={"example": "ok"},
    )
    service: str = Field(
        default="MissionPath Backend",
        description="Name of the backend service",
        json_schema_extra={"example": "MissionPath Backend"},
    )

    model_config = {"frozen": True}


class ErrorResponse(BaseModel):
    """Standardized error response model."""

    detail: str = Field(
        ...,
        description="Human-readable error explanation",
        json_schema_extra={"example": "Requested logistics resource was not found"},
    )

    model_config = {"frozen": True}
