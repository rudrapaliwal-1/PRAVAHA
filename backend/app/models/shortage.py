"""
models/shortage.py — Pydantic models for supply shortage detection and resupply recommendation.
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.models.common import Priority, SupplyType
from app.models.prediction import ShortageSeverity


class ShortageItem(BaseModel):
    """
    Detailed shortage assessment for a single supply stream at a demand point.

    Attributes:
        demand_point_id:               Identifier of the evaluated demand point.
        supply_type:                   Type of supply evaluated.
        current_available:             Current available on-hand quantity at the location.
        consumption_rate:              Consumption burn rate per hour (units/kg per hour).
        time_to_shortage:              Hours until complete stock depletion (e.g. available / rate).
        predicted_shortage:            Projected deficit amount over the evaluation horizon.
        severity:                      Shortage severity classification (CRITICAL, HIGH, MEDIUM, LOW, NONE).
        recommended_resupply_quantity: Calculated quantity needed to replenish stock and fulfill horizon.
        priority:                      Demand point operational priority tier.
        deadline:                      Optional delivery deadline for this location.
        urgency_score:                 Composite ranking score for prioritizing dispatch.
    """

    demand_point_id: str = Field(..., description="ID of the demand point")
    supply_type: SupplyType = Field(..., description="Category of supply evaluated")
    current_available: float = Field(..., ge=0.0, description="Current on-hand available stock")
    consumption_rate: float = Field(..., ge=0.0, description="Consumption rate in units per hour")
    time_to_shortage: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Hours until inventory is exhausted (0.0 if already depleted, None if no depletion)",
    )
    predicted_shortage: float = Field(..., ge=0.0, description="Projected deficit over the forecast horizon")
    severity: ShortageSeverity = Field(..., description="Severity level: CRITICAL, HIGH, MEDIUM, LOW, NONE")
    recommended_resupply_quantity: float = Field(
        ...,
        ge=0.0,
        description="Recommended resupply volume to eliminate shortage",
    )
    priority: Priority = Field(default=Priority.MEDIUM, description="Location urgency tier")
    deadline: Optional[datetime] = Field(default=None, description="Delivery deadline")
    urgency_score: float = Field(default=0.0, ge=0.0, description="Urgency priority rank score")

    model_config = {"frozen": False}


class ShortageResponse(BaseModel):
    """
    Structured response payload for GET /api/shortages.
    """

    generated_at: datetime = Field(..., description="UTC assessment timestamp")
    horizon_hours: float = Field(..., description="Lookahead planning window in hours")
    total_shortages_detected: int = Field(..., ge=0, description="Total shortage items identified")
    critical_shortages_count: int = Field(..., ge=0, description="Number of critical severity shortages")
    high_shortages_count: int = Field(..., ge=0, description="Number of high severity shortages")
    shortages: List[ShortageItem] = Field(
        default_factory=list,
        description="List of detected supply shortages, sorted by urgency",
    )

    model_config = {"frozen": False}
