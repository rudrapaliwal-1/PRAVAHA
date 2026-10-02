"""
models/logistics_state.py — LogisticsState: the top-level in-memory world state.

This is the single object the optimizer reads and writes.
All collections are keyed by entity ID for O(1) lookup.
"""

from typing import Dict, List

from pydantic import BaseModel, Field, model_validator

from app.models.delivery import Delivery
from app.models.demand_point import DemandPoint
from app.models.depot import Depot
from app.models.route import Route
from app.models.vehicle import Vehicle


class LogisticsState(BaseModel):
    """
    Complete snapshot of the logistics network at a point in time.

    Attributes:
        vehicles:      All vehicles in the fleet, keyed by vehicle ID.
        depots:        All supply depots, keyed by depot ID.
        demand_points: All demand locations, keyed by demand point ID.
        routes:        All navigable routes, keyed by route ID.
        deliveries:    All active and historical deliveries (list — not keyed,
                       because multiple deliveries can share the same vehicle).
    """

    vehicles: Dict[str, Vehicle] = Field(
        default_factory=dict,
        description="Fleet — map of vehicle_id → Vehicle",
    )
    depots: Dict[str, Depot] = Field(
        default_factory=dict,
        description="Supply nodes — map of depot_id → Depot",
    )
    demand_points: Dict[str, DemandPoint] = Field(
        default_factory=dict,
        description="Demand nodes — map of demand_point_id → DemandPoint",
    )
    routes: Dict[str, Route] = Field(
        default_factory=dict,
        description="Graph edges — map of route_id → Route",
    )
    deliveries: List[Delivery] = Field(
        default_factory=list,
        description="All delivery tasks (pending, in-transit, completed)",
    )

    # ------------------------------------------------------------------
    # Cross-entity referential integrity
    # ------------------------------------------------------------------

    @model_validator(mode="after")
    def delivery_refs_must_exist(self) -> "LogisticsState":
        """
        Ensure every Delivery references IDs that actually exist in the state.
        Skipped when any collection is empty (partial / incremental builds).
        """
        if not self.deliveries:
            return self

        for i, d in enumerate(self.deliveries):
            if self.vehicles and d.vehicle_id not in self.vehicles:
                raise ValueError(
                    f"Delivery[{i}] references unknown vehicle_id '{d.vehicle_id}'"
                )
            if self.depots and d.depot_id not in self.depots:
                raise ValueError(
                    f"Delivery[{i}] references unknown depot_id '{d.depot_id}'"
                )
            if self.demand_points and d.demand_point_id not in self.demand_points:
                raise ValueError(
                    f"Delivery[{i}] references unknown demand_point_id '{d.demand_point_id}'"
                )
            if self.routes and d.route_id not in self.routes:
                raise ValueError(
                    f"Delivery[{i}] references unknown route_id '{d.route_id}'"
                )
        return self

    # ------------------------------------------------------------------
    # Convenience helpers for the optimizer / API layer
    # ------------------------------------------------------------------

    def available_vehicles(self) -> List[Vehicle]:
        """Return all vehicles that are ready for assignment."""
        return [v for v in self.vehicles.values() if v.is_operational]

    def usable_routes(self) -> List[Route]:
        """Return all routes that are not blocked."""
        return [r for r in self.routes.values() if r.is_usable]

    def active_deliveries(self) -> List[Delivery]:
        """Return deliveries that are still in progress."""
        return [d for d in self.deliveries if d.is_active]

    def summary(self) -> dict:
        """Quick human-readable overview of the current state."""
        return {
            "vehicles": {
                "total": len(self.vehicles),
                "available": len(self.available_vehicles()),
            },
            "depots": len(self.depots),
            "demand_points": len(self.demand_points),
            "routes": {
                "total": len(self.routes),
                "usable": len(self.usable_routes()),
            },
            "deliveries": {
                "total": len(self.deliveries),
                "active": len(self.active_deliveries()),
            },
        }

    model_config = {"frozen": False}
