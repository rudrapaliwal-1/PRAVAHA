"""
models/route.py — Route model for logistics optimization.

A route represents a navigable path between two geographic points.
The OR-Tools optimizer uses routes as edges in the VRP graph.
"""

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.common import RiskLevel
from app.models.vehicle import Location


class Route(BaseModel):
    """
    A navigable edge in the logistics network graph.

    Attributes:
        id:          Unique route identifier (e.g. "RT-001").
        source:      Origin location of the route.
        destination: Destination location of the route.
        distance:    Route length in kilometres.
        travel_time: Estimated travel time in hours under normal conditions.
        risk:        Threat / hazard level on this route.
        available:   False if the route is blocked (bridge out, IED threat, flood, etc.).
    """

    id: str = Field(..., min_length=1, description="Unique route identifier")
    source: Location = Field(..., description="Origin GPS position")
    destination: Location = Field(..., description="Destination GPS position")
    distance: float = Field(..., gt=0, description="Route length in km")
    travel_time: float = Field(..., gt=0, description="Estimated travel time in hours")
    risk: RiskLevel = Field(default=RiskLevel.SAFE, description="Threat level on this route")
    available: bool = Field(default=True, description="False if the route is currently blocked")

    @field_validator("id")
    @classmethod
    def id_must_be_stripped(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Route id must not be blank")
        return v

    @model_validator(mode="after")
    def travel_time_consistent_with_distance(self) -> "Route":
        """
        Sanity check: average speed implied by distance / travel_time
        should be between 1 and 1000 km/h.
        Catches obvious data entry errors (e.g. distance in metres instead of km).
        """
        implied_speed = self.distance / self.travel_time
        if not (1.0 <= implied_speed <= 1000.0):
            raise ValueError(
                f"Implied speed {implied_speed:.1f} km/h is unrealistic. "
                f"Check distance ({self.distance} km) and travel_time ({self.travel_time} h)."
            )
        return self

    @property
    def is_usable(self) -> bool:
        """A route is usable if it's available and not fully blocked."""
        return self.available and self.risk != RiskLevel.BLOCKED

    @property
    def risk_multiplier(self) -> float:
        """
        Cost multiplier for the optimizer based on risk level.
        Higher risk → higher effective cost.
        """
        multipliers = {
            RiskLevel.SAFE: 1.0,
            RiskLevel.LOW: 1.2,
            RiskLevel.MEDIUM: 1.5,
            RiskLevel.HIGH: 2.5,
            RiskLevel.BLOCKED: float("inf"),
        }
        return multipliers[self.risk]

    model_config = {"frozen": False}
