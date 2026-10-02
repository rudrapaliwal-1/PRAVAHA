"""
optimizer/reoptimizer.py — Dynamic Re-Optimization Service.

Connects the Disruption Simulation Engine with the Google OR-Tools CP-SAT Optimizer.
Executes the closed-loop re-optimization cycle:
1. Capture pre-disruption state & baseline plan
2. Ingest disruption & identify affected deliveries
3. Apply state mutations and remove compromised resources
4. Re-solve the logistics network via CP-SAT to produce a new feasible plan
5. Compare schedule variance, affected assets, and unmet demand
"""

from typing import List, Optional

from app.models.disruption import DisruptionRequest, DisruptionResult, DisruptionType
from app.models.logistics_state import LogisticsState
from app.models.optimization import OptimizationDelivery, OptimizationResult, OptimizerWeights
from app.models.reoptimization import ReoptimizationResult
from app.optimizer.service import optimizer_service
from app.simulation.disruption_service import disruption_engine
from app.simulation.world import world_state_service


class DynamicReoptimizer:
    """
    Dynamic re-optimization orchestrator connecting disruptions with CP-SAT solver.
    """

    def reoptimize(
        self,
        disruption: DisruptionRequest,
        state: Optional[LogisticsState] = None,
        previous_plan: Optional[OptimizationResult] = None,
        weights: Optional[OptimizerWeights] = None,
    ) -> ReoptimizationResult:
        """
        Executes end-to-end dynamic re-optimization.

        Args:
            disruption: DisruptionRequest specifying the event type and target.
            state: Optional custom LogisticsState (defaults to active world state).
            previous_plan: Optional pre-disruption baseline plan.
            weights: Optional CP-SAT solver objective weights.

        Returns:
            ReoptimizationResult containing comparison of old and new plans,
            identified affected deliveries, delay variance, and solver status.
        """
        # 1. Start with the current logistics state
        target_state = state if state is not None else world_state_service.get_state()

        # 2. Capture baseline pre-disruption plan if not provided
        if previous_plan is None:
            pre_disruption_state = target_state.model_copy(deep=True)
            baseline_plan = optimizer_service.optimize(pre_disruption_state, weights=weights)
        else:
            baseline_plan = previous_plan

        # 3. Detect and apply the disruption to the state
        disruption_result = disruption_engine.apply_disruption(target_state, disruption)

        # 4. Identify affected resources & deliveries
        affected_vehicles: List[str] = [
            v_id for v_id in disruption_result.affected_entities
            if v_id in target_state.vehicles and not target_state.vehicles[v_id].is_operational
        ]
        affected_routes: List[str] = [
            r_id for r_id in disruption_result.affected_entities
            if r_id in target_state.routes and not target_state.routes[r_id].is_usable
        ]

        if disruption.type == DisruptionType.VEHICLE_FAILURE and disruption.target_id:
            if disruption.target_id not in affected_vehicles:
                affected_vehicles.append(disruption.target_id)
        if disruption.type == DisruptionType.BLOCK_ROUTE and disruption.target_id:
            if disruption.target_id not in affected_routes:
                affected_routes.append(disruption.target_id)

        affected_deliveries: List[OptimizationDelivery] = []
        for delivery in baseline_plan.deliveries:
            is_compromised = False

            # Check if delivery used a blocked route
            if delivery.route_id in affected_routes or (
                delivery.route_id in target_state.routes and not target_state.routes[delivery.route_id].is_usable
            ):
                is_compromised = True
            # Check if delivery used a failed vehicle
            elif delivery.vehicle_id in affected_vehicles or (
                delivery.vehicle_id in target_state.vehicles and not target_state.vehicles[delivery.vehicle_id].is_operational
            ):
                is_compromised = True
            # Check if source depot inventory was depleted below delivery quantity
            elif delivery.depot_id in disruption_result.affected_entities:
                depot = target_state.depots.get(delivery.depot_id)
                if depot and depot.inventory.get(delivery.supply_type, 0.0) < delivery.quantity:
                    is_compromised = True

            if is_compromised:
                affected_deliveries.append(delivery)

        # 5. Run CP-SAT again on the updated state to generate a fresh feasible plan
        new_plan = optimizer_service.optimize(target_state, weights=weights)

        # 6. Compare old plan and new plan
        prev_eta = round(baseline_plan.total_eta, 2)
        new_eta = round(new_plan.total_eta, 2)
        delay = round(max(0.0, new_eta - prev_eta), 2)
        trigger_str = f"{disruption.type.value}:{disruption.target_id or 'GENERAL'}"

        return ReoptimizationResult(
            trigger=trigger_str,
            disruption_event=disruption_result,
            affected_deliveries=affected_deliveries,
            affected_vehicles=affected_vehicles,
            affected_routes=affected_routes,
            previous_eta=prev_eta,
            new_eta=new_eta,
            delay=delay,
            previous_plan=baseline_plan,
            new_plan=new_plan,
            unmet_demand=new_plan.unmet_demand,
            optimization_status=new_plan.status,
        )


# Singleton reoptimizer instance
reoptimizer_service = DynamicReoptimizer()


def reoptimize_logistics(
    disruption: DisruptionRequest,
    state: Optional[LogisticsState] = None,
    previous_plan: Optional[OptimizationResult] = None,
    weights: Optional[OptimizerWeights] = None,
) -> ReoptimizationResult:
    """Helper function to execute dynamic re-optimization."""
    return reoptimizer_service.reoptimize(
        disruption=disruption,
        state=state,
        previous_plan=previous_plan,
        weights=weights,
    )
