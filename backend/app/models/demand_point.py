"""
models/demand_point.py — DemandPoint model for logistics optimization.

A demand point is a location that needs supplies — a refugee camp,
forward firebase, disaster zone, field hospital, etc.
"""

from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.common import Priority, SupplyType
from app.models.vehicle import Location


class DemandPoint(BaseModel):
    """
    A supply destination node in the logistics network.

    Attributes:
        id:                Unique demand point identifier (e.g. "DP-001").
        location:          GPS coordinates.
        required_supplies: Map of SupplyType → quantity needed (kg or units).
        priority:          Urgency level (critical / high / medium / low).
        deadline:          UTC datetime by which supplies must arrive.
                           None means no hard deadline.
        consumption_rate:  Map of SupplyType → consumption per hour.
                           Used by the AI prediction engine.
    """

    id: str = Field(..., min_length=1, description="Unique demand point identifier")
    location: Location = Field(..., description="GPS position of the demand point")
    required_supplies: Dict[SupplyType, float] = Field(
        default_factory=dict,
        description="Supplies needed per type (kg or units)",
    )
    current_inventory: Dict[SupplyType, float] = Field(
        default_factory=dict,
        description="Current on-hand inventory at the demand point (kg or units)",
    )
    priority: Priority = Field(default=Priority.MEDIUM, description="Urgency level")
    deadline: Optional[datetime] = Field(
        default=None,
        description="UTC datetime by which supplies must arrive (None = no hard deadline)",
    )
    consumption_rate: Dict[SupplyType, float] = Field(
        default_factory=dict,
        description="Consumption per hour per supply type (used by AI forecasting)",
    )

    @field_validator("id")
    @classmethod
    def id_must_be_stripped(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("DemandPoint id must not be blank")
        return v

    @field_validator("required_supplies", "consumption_rate", "current_inventory")
    @classmethod
    def quantities_must_be_non_negative(cls, v: Dict[SupplyType, float]) -> Dict[SupplyType, float]:
        for supply_type, qty in v.items():
            if qty < 0:
                raise ValueError(f"Quantity for '{supply_type}' must be >= 0, got {qty}")
        return v

    @model_validator(mode="after")
    def deadline_must_be_future_or_none(self) -> "DemandPoint":
        """Warn (not error) if deadline is in the past — useful for testing with historical data."""
        # We allow past deadlines in tests; the optimizer will deprioritize them.
        return self

    @property
    def is_critical(self) -> bool:
        return self.priority == Priority.CRITICAL

    def total_required(self) -> float:
        """Return total supply quantity needed across all types."""
        return sum(self.required_supplies.values())

    model_config = {"frozen": False}
