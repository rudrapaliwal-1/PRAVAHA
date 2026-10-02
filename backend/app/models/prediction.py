"""
models/prediction.py — Pydantic models for demand forecasting and shortage prediction.
"""

from datetime import datetime
from enum import Enum
from typing import Dict, Optional
from pydantic import BaseModel, Field

from app.models.common import Priority, SupplyType


class ShortageSeverity(str, Enum):
    """Urgency classification for projected supply shortages."""
    CRITICAL = "critical"   # Immediate or severe deficit
    HIGH = "high"           # Depletion imminent within near horizon
    MEDIUM = "medium"       # Measurable deficit accumulating
    MODERATE = "medium"     # Alias for MEDIUM
    LOW = "low"             # Minor consumption with ample buffer
    NONE = "none"           # No deficit or consumption projected


class SupplyPrediction(BaseModel):
    """
    Detailed forecast metrics for a specific supply type at a demand point.

    Attributes:
        supply_type:                 Category of supply (e.g. food, water, medicine).
        current_requirement:         Current unmet quantity needed right now (kg or units).
        consumption_rate:            Consumption speed in units/kg per hour.
        predicted_demand:            Projected total demand over the specified time horizon.
        estimated_time_to_shortage:  Hours until shortage begins or critical deficit reached (0.0 if already unmet).
        shortage_severity:           Severity classification of the impending shortage.
        prediction_confidence:       Confidence score between 0.0 and 1.0.
    """

    supply_type: SupplyType = Field(..., description="Category of supply forecasted")
    current_requirement: float = Field(..., ge=0.0, description="Current unmet demand (units/kg)")
    consumption_rate: float = Field(..., ge=0.0, description="Burn rate in units/kg per hour")
    predicted_demand: float = Field(..., ge=0.0, description="Forecasted demand: current + (rate * horizon)")
    estimated_time_to_shortage: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Estimated hours until shortage (0.0 if currently unmet, None if no deficit)",
    )
    shortage_severity: ShortageSeverity = Field(
        default=ShortageSeverity.NONE,
        description="Severity classification of the shortage",
    )
    prediction_confidence: float = Field(
        default=0.95,
        ge=0.0,
        le=1.0,
        description="Confidence score for the deterministic forecast (0.0 to 1.0)",
    )

    model_config = {"frozen": False}


class DemandPointPrediction(BaseModel):
    """
    Consolidated demand prediction for a single demand point across all supply types.

    Attributes:
        demand_point_id:            Unique demand point identifier.
        priority:                   Base urgency priority tier (CRITICAL, HIGH, MEDIUM, LOW).
        deadline:                   Optional UTC deadline for supply deliveries.
        time_horizon_hours:         Forecast window in hours.
        predictions:                Mapping of supply type string -> SupplyPrediction.
        highest_severity:           Peak shortage severity among all required supply types.
        recommended_urgency_score:  Calculated composite urgency score (higher = more urgent).
    """

    demand_point_id: str = Field(..., description="Target demand point identifier")
    priority: Priority = Field(..., description="Base operational priority")
    deadline: Optional[datetime] = Field(default=None, description="UTC arrival deadline")
    time_horizon_hours: float = Field(..., gt=0, description="Forecast lookahead in hours")
    predictions: Dict[str, SupplyPrediction] = Field(
        default_factory=dict,
        description="Forecast per supply type",
    )
    highest_severity: ShortageSeverity = Field(
        default=ShortageSeverity.NONE,
        description="Most severe shortage status across all supplies",
    )
    recommended_urgency_score: float = Field(
        default=0.0,
        ge=0.0,
        description="Composite score combining priority, shortfall, and consumption velocity",
    )

    model_config = {"frozen": False}


class PredictionResponse(BaseModel):
    """
    Top-level response payload for GET /api/predictions.
    """

    time_horizon_hours: float = Field(..., description="Lookahead window evaluated in hours")
    generated_at: datetime = Field(..., description="UTC timestamp when predictions were generated")
    total_demand_points: int = Field(..., ge=0, description="Total demand points analyzed")
    predictions: Dict[str, DemandPointPrediction] = Field(
        default_factory=dict,
        description="Prediction results keyed by demand point ID",
    )
    critical_shortage_count: int = Field(
        default=0,
        ge=0,
        description="Count of demand points experiencing critical shortage severity",
    )
    total_predicted_demand: Dict[str, float] = Field(
        default_factory=dict,
        description="Aggregated projected demand across all locations by supply type",
    )

    model_config = {"frozen": False}
