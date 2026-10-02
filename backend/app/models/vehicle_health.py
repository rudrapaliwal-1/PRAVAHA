"""
models/vehicle_health.py — Vehicle Health and Maintenance Telemetry Models.

Defines schemas for vehicle telemetry, operational health, and maintenance risk prediction.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class MaintenanceRisk(str, Enum):
    """Predicted maintenance risk level for a transport vehicle."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class VehicleHealthStatus(BaseModel):
    """
    Simulated telemetry and maintenance health assessment for a single vehicle.
    """
    vehicle_id: str = Field(..., description="Unique identifier of the vehicle")
    mileage: float = Field(..., ge=0.0, description="Total operational mileage in kilometers")
    utilization: float = Field(..., ge=0.0, le=1.0, description="Fleet utilization ratio (0.0 to 1.0)")
    health_score: float = Field(..., ge=0.0, le=100.0, description="Overall health score (0-100)")
    maintenance_risk: MaintenanceRisk = Field(..., description="Predicted maintenance risk level (LOW/MEDIUM/HIGH)")
    available: bool = Field(default=True, description="Whether the vehicle is currently available for dispatch")
    is_operational: bool = Field(default=True, description="Whether the vehicle is operational")
    fuel_level: float = Field(default=100.0, ge=0.0, le=100.0, description="Current fuel level percentage")
    recommended_action: Optional[str] = Field(
        default=None,
        description="Recommended operational or maintenance action",
    )

    model_config = {"frozen": False}


class VehicleHealthResponse(BaseModel):
    """
    Fleet-wide vehicle health and maintenance prediction response.
    """
    vehicles: List[VehicleHealthStatus] = Field(
        default_factory=list,
        description="List of vehicle telemetry and health statuses",
    )
    total_vehicles: int = Field(..., description="Total vehicle fleet count")
    operational_count: int = Field(..., description="Number of operational vehicles")
    high_risk_count: int = Field(..., description="Number of vehicles at HIGH maintenance risk")
    average_health_score: float = Field(..., description="Average health score across the fleet (0-100)")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of health assessment evaluation",
    )
