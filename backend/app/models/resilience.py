"""
models/resilience.py — Pydantic models for Supply Chain Resilience Assessment.
"""

from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


class ResilienceScore(BaseModel):
    """
    Comprehensive multi-dimensional resilience score (0-100) for the logistics network.

    Attributes:
        overall_score:          Weighted aggregate resilience health (0-100).
        inventory:              Inventory buffer vs total demand requirement score (0-100).
        fleet:                  Fleet operational readiness and fuel availability score (0-100).
        routes:                 Usable route proportion and risk penalization score (0-100).
        demand_coverage:        Fulfilled demand and scheduled dispatch coverage score (0-100).
        connectivity:           Graph reachability between supply hubs and demand points (0-100).
        inventory_score:        Alias matching inventory component.
        fleet_score:            Alias matching fleet component.
        route_score:            Alias matching routes component.
        demand_coverage_score:  Alias matching demand_coverage component.
        connectivity_score:     Alias matching connectivity component.
        key_factors:            Qualitative explanations and critical driving factors.
        calculated_at:          UTC assessment timestamp.
    """

    overall_score: float = Field(..., ge=0.0, le=100.0, description="Overall resilience score (0-100)")
    inventory: float = Field(..., ge=0.0, le=100.0, description="Inventory availability score (0-100)")
    fleet: float = Field(..., ge=0.0, le=100.0, description="Fleet availability score (0-100)")
    routes: float = Field(..., ge=0.0, le=100.0, description="Route availability score (0-100)")
    demand_coverage: float = Field(..., ge=0.0, le=100.0, description="Demand coverage score (0-100)")
    connectivity: float = Field(..., ge=0.0, le=100.0, description="Network connectivity score (0-100)")
    
    # Secondary score aliases for dual schema compatibility
    inventory_score: Optional[float] = Field(default=None, description="Inventory score (0-100)")
    fleet_score: Optional[float] = Field(default=None, description="Fleet score (0-100)")
    route_score: Optional[float] = Field(default=None, description="Route score (0-100)")
    demand_coverage_score: Optional[float] = Field(default=None, description="Demand coverage score (0-100)")
    connectivity_score: Optional[float] = Field(default=None, description="Connectivity score (0-100)")

    key_factors: List[str] = Field(
        default_factory=list,
        description="Top qualitative factors affecting the resilience score",
    )
    calculated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp of resilience evaluation",
    )

    @model_validator(mode="after")
    def sync_score_aliases(self) -> "ResilienceScore":
        if self.inventory_score is None:
            self.inventory_score = self.inventory
        if self.fleet_score is None:
            self.fleet_score = self.fleet
        if self.route_score is None:
            self.route_score = self.routes
        if self.demand_coverage_score is None:
            self.demand_coverage_score = self.demand_coverage
        if self.connectivity_score is None:
            self.connectivity_score = self.connectivity
        return self

    model_config = {"frozen": False}
