"""
models/optimization.py — Pydantic models for logistics optimization outputs.
"""

from typing import Dict, List
from pydantic import BaseModel, Field

from app.models.common import SupplyType


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
        eta:              Estimated travel time in hours.
    """

    vehicle_id: str = Field(..., description="ID of the assigned transport vehicle")
    depot_id: str = Field(..., description="ID of the origin supply depot")
    demand_point_id: str = Field(..., description="ID of the destination demand point")
    supply_type: SupplyType = Field(..., description="Category of supply delivered")
    quantity: float = Field(..., gt=0, description="Quantity delivered (kg or units)")
    route_id: str = Field(..., description="ID of the chosen route")
    distance: float = Field(..., ge=0, description="Route distance in km")
    eta: float = Field(..., ge=0, description="Estimated travel time in hours")

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

    model_config = {"frozen": False}

