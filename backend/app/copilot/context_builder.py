"""
copilot/context_builder.py — Grounding Context Aggregator for AI Logistics Copilot.

Assembles ground truth from CP-SAT optimization results, active simulation state,
resilience metrics, shortage predictions, and vehicle telemetry.
"""

from typing import Any, Dict, List, Optional

from app.models.logistics_state import LogisticsState
from app.models.plan import LogisticsPlan
from app.optimizer.plan_service import plan_service
from app.prediction.shortage_service import shortage_service
from app.prediction.vehicle_health_service import vehicle_health_service
from app.resilience.service import resilience_engine
from app.simulation.world import world_state_service


class CopilotContextBuilder:
    """
    Constructs comprehensive, factual grounding context from the in-memory logistics state.
    """

    def build_context(
        self,
        state: Optional[LogisticsState] = None,
        custom_context: Optional[str] = None,
        include_optimization: bool = True,
        include_resilience: bool = True,
        include_shortages: bool = True,
    ) -> Dict[str, Any]:
        """
        Gathers factual operational data across all logistics subsystems.

        Returns:
            Dict containing structured data and formatted human-readable summary.
        """
        active_state = state if state is not None else world_state_service.get_state()

        # 1. State entities snapshot
        vehicles_data = [
            {
                "id": v.id,
                "capacity": v.capacity,
                "available": v.available,
                "is_operational": v.is_operational,
                "fuel_level": v.fuel_level,
                "speed": v.speed,
            }
            for v in active_state.vehicles.values()
        ]

        depots_data = [
            {
                "id": d.id,
                "inventory": {st.value: qty for st, qty in d.inventory.items()},
            }
            for d in active_state.depots.values()
        ]

        demand_points_data = [
            {
                "id": dp.id,
                "required_supplies": {st.value: qty for st, qty in dp.required_supplies.items()},
                "priority": dp.priority.value,
                "deadline": dp.deadline.isoformat() if dp.deadline else None,
            }
            for dp in active_state.demand_points.values()
        ]

        routes_data = [
            {
                "id": r.id,
                "distance": r.distance,
                "travel_time": r.travel_time,
                "risk": r.risk.value,
                "available": r.available,
                "is_usable": r.is_usable,
            }
            for r in active_state.routes.values()
        ]

        deliveries_data = [
            {
                "id": d.id,
                "vehicle_id": d.vehicle_id,
                "depot_id": d.depot_id,
                "demand_point_id": d.demand_point_id,
                "supply_type": d.supply_type.value,
                "quantity": d.quantity,
                "route_id": d.route_id,
                "status": d.status.value,
            }
            for d in active_state.deliveries
        ]

        # 2. Subsystem evaluations
        resilience_data = (
            resilience_engine.calculate_resilience(active_state).model_dump(mode="json")
            if include_resilience
            else None
        )

        shortage_data = (
            shortage_service.detect_shortages(active_state).model_dump(mode="json")
            if include_shortages
            else None
        )

        fleet_health_data = (
            vehicle_health_service.assess_fleet(active_state).model_dump(mode="json")
        )

        # 3. Active & candidate optimization plans
        active_plan = plan_service.get_active_plan()
        all_plans = [p.model_dump(mode="json") for p in plan_service.list_plans()] if include_optimization else []

        # 4. Context summary string
        summary_lines = [
            f"Fleet: {len(vehicles_data)} vehicles ({sum(1 for v in vehicles_data if v['is_operational'])} operational).",
            f"Depots: {len(depots_data)} supply depots.",
            f"Demand Points: {len(demand_points_data)} destinations.",
            f"Routes: {len(routes_data)} total corridors ({sum(1 for r in routes_data if r['is_usable'])} usable).",
            f"Active Deliveries in State: {len(deliveries_data)}.",
        ]
        if resilience_data:
            summary_lines.append(f"Supply Chain Resilience Score: {resilience_data['overall_score']}/100.")
        if shortage_data:
            summary_lines.append(f"Predicted Impending Shortages: {len(shortage_data['shortages'])} items.")
        if active_plan:
            summary_lines.append(f"Active Approved Plan: {active_plan.id} ({active_plan.name}).")
        if custom_context:
            summary_lines.append(f"Operator Context Note: {custom_context}")

        return {
            "vehicles": vehicles_data,
            "depots": depots_data,
            "demand_points": demand_points_data,
            "routes": routes_data,
            "deliveries": deliveries_data,
            "resilience": resilience_data,
            "shortages": shortage_data,
            "fleet_health": fleet_health_data,
            "active_plan": active_plan.model_dump(mode="json") if active_plan else None,
            "all_plans": all_plans,
            "custom_context": custom_context,
            "summary_text": " | ".join(summary_lines),
        }


# Singleton context builder
context_builder = CopilotContextBuilder()
