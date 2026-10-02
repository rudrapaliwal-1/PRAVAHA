"""
models/optimization.py — Pydantic models for logistics optimization outputs.
"""

from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.models.common import Priority, RiskLevel, SupplyType


class OptimizerWeights(BaseModel):
    """
    Configurable objective weighting coefficients for the CP-SAT solver.
    Allows flexible trade-offs between delivery urgency, speed, distance, and risk.
    """

    # Unmet demand penalties per priority tier
    weight_unmet_critical: int = Field(
        default=10_000,
        ge=0,
        description="Penalty multiplier for unmet critical demand",
    )
    weight_unmet_high: int = Field(
        default=5_000,
        ge=0,
        description="Penalty multiplier for unmet high demand",
    )
    weight_unmet_medium: int = Field(
        default=2_000,
        ge=0,
        description="Penalty multiplier for unmet medium demand",
    )
    weight_unmet_low: int = Field(
        default=1_000,
        ge=0,
        description="Penalty multiplier for unmet low demand",
    )

    # Route travel metrics coefficients
    weight_distance: int = Field(
        default=10,
        ge=0,
        description="Cost coefficient per km of travel distance",
    )
    weight_travel_time: int = Field(
        default=100,
        ge=0,
        description="Cost coefficient per hour of travel time",
    )

    # Route risk penalties
    weight_risk_safe: int = Field(
        default=0,
        ge=0,
        description="Penalty score for SAFE routes",
    )
    weight_risk_low: int = Field(
        default=200,
        ge=0,
        description="Penalty score for LOW risk routes",
    )
    weight_risk_medium: int = Field(
        default=800,
        ge=0,
        description="Penalty score for MEDIUM risk routes",
    )
    weight_risk_high: int = Field(
        default=3_000,
        ge=0,
        description="Penalty score for HIGH risk routes",
    )

    # Delivery deadline penalties
    weight_late_delivery: int = Field(
        default=5_000,
        ge=0,
        description="Penalty score added for deliveries that arrive after deadline",
    )

    def get_priority_weight(self, priority: Priority) -> int:
        """Returns penalty weight for a given Priority."""
        weights = {
            Priority.CRITICAL: self.weight_unmet_critical,
            Priority.HIGH: self.weight_unmet_high,
            Priority.MEDIUM: self.weight_unmet_medium,
            Priority.LOW: self.weight_unmet_low,
        }
        return weights.get(priority, self.weight_unmet_medium)

    def get_risk_penalty(self, risk: RiskLevel) -> int:
        """Returns penalty score for a given RiskLevel."""
        penalties = {
            RiskLevel.SAFE: self.weight_risk_safe,
            RiskLevel.LOW: self.weight_risk_low,
            RiskLevel.MEDIUM: self.weight_risk_medium,
            RiskLevel.HIGH: self.weight_risk_high,
            RiskLevel.BLOCKED: 1_000_000,
        }
        return penalties.get(risk, 0)

    model_config = {"frozen": False}


class OptimizationDelivery(BaseModel):
    """
    A single delivery assignment computed by the CP-SAT optimizer.

    Attributes:
        vehicle_id:       ID of the vehicle performing the delivery.
        depot_id:         ID of the source depot.
        demand_point_id:  ID of the destination demand point.
        supply_type:      Type of supply delivered.
        quantity:         Amount delivered (kg or units).
        route_id:         ID of the route used.
        distance:         Route distance in kilometres.
        travel_time:      Estimated travel time in hours.
        risk:             Hazard/threat level on the selected route.
        eta:              Estimated time of arrival / duration in hours.
        deadline:         UTC deadline timestamp of the demand point (if specified).
        late_delivery:    Whether the delivery is projected to arrive after deadline.
        priority:         Urgency priority tier of the receiving demand point.
    """

    vehicle_id: str = Field(..., description="ID of the assigned transport vehicle")
    depot_id: str = Field(..., description="ID of the origin supply depot")
    demand_point_id: str = Field(..., description="ID of the destination demand point")
    supply_type: SupplyType = Field(..., description="Category of supply delivered")
    quantity: float = Field(..., gt=0, description="Quantity delivered (kg or units)")
    route_id: str = Field(..., description="ID of the chosen route")
    distance: float = Field(..., ge=0, description="Route distance in km")
    travel_time: float = Field(..., ge=0, description="Route travel time in hours")
    risk: RiskLevel = Field(default=RiskLevel.SAFE, description="Risk level on the chosen route")
    eta: float = Field(..., ge=0, description="Estimated travel duration in hours")
    deadline: Optional[datetime] = Field(
        default=None,
        description="UTC datetime by which supplies must arrive (None = no deadline)",
    )
    late_delivery: bool = Field(
        default=False,
        description="True if ETA exceeds the deadline window",
    )
    priority: Priority = Field(
        default=Priority.MEDIUM,
        description="Priority of the served demand point",
    )

    model_config = {"frozen": False}



class OptimizationResult(BaseModel):
    """
    Complete solution returned by the CP-SAT logistics optimizer.

    Attributes:
        status:               Solver status ("OPTIMAL", "FEASIBLE", "INFEASIBLE", "NO_SOLUTION").
        objective_value:      Solver objective value.
        deliveries:           List of computed delivery assignments.
        unmet_demand:         Remaining unmet demand map per demand point and supply type.
        total_supplied:       Total quantity of all supplies successfully delivered.
        total_unmet_demand:   Total quantity of remaining unmet demand across all demand points.
        inventory_used:       Inventory dispatched per depot ID and supply type.
        inventory_remaining:  Remaining stock per depot ID and supply type.
        total_distance:       Sum of distances across all assigned deliveries.
        total_eta:            Sum of travel times across all assigned deliveries.
    """

    status: str = Field(
        ...,
        description="Optimization status (e.g. OPTIMAL, FEASIBLE, INFEASIBLE, NO_SOLUTION)",
    )
    objective_value: float = Field(
        ...,
        description="Calculated objective value from CP-SAT optimizer",
    )
    deliveries: List[OptimizationDelivery] = Field(
        default_factory=list,
        description="List of planned delivery assignments",
    )
    unmet_demand: Dict[str, Dict[str, float]] = Field(
        default_factory=dict,
        description="Unsatisfied demand per demand point ID and supply type",
    )
    total_supplied: float = Field(
        default=0.0,
        ge=0,
        description="Total quantity of all supplies successfully delivered",
    )
    total_unmet_demand: float = Field(
        default=0.0,
        ge=0,
        description="Total quantity of remaining unmet demand across all demand points",
    )
    inventory_used: Dict[str, Dict[str, float]] = Field(
        default_factory=dict,
        description="Inventory dispatched per depot ID and supply type",
    )
    inventory_remaining: Dict[str, Dict[str, float]] = Field(
        default_factory=dict,
        description="Remaining stock per depot ID and supply type",
    )
    total_distance: float = Field(
        default=0.0,
        ge=0,
        description="Total travel distance in km across all scheduled deliveries",
    )
    total_eta: float = Field(
        default=0.0,
        ge=0,
        description="Total travel time in hours across all scheduled deliveries",
    )
    total_late_deliveries: int = Field(
        default=0,
        ge=0,
        description="Count of scheduled deliveries exceeding demand point deadlines",
    )

    model_config = {"frozen": False}


class OptimizeRequest(BaseModel):
    """
    Request model for POST /api/optimize.
    """

    state: Optional[Dict] = Field(
        default=None,
        description="Custom LogisticsState to optimize. If omitted, uses current in-memory state.",
    )
    weights: Optional[OptimizerWeights] = Field(
        default=None,
        description="Configurable optimizer weights. If omitted, defaults are used.",
    )

    model_config = {"frozen": False}


