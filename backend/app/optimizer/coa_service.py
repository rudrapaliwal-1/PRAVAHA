"""
optimizer/coa_service.py — Courses of Action (COA) Multi-Plan Generation Service.

Generates 3 distinct feasible strategic options for human decision-makers following a disruption:
1. FASTEST: Minimizes delivery transit time.
2. LOWEST_RISK: Minimizes convoy threat exposure on routes.
3. RESOURCE_EFFICIENT: Minimizes distance traveled, fuel burn, and fleet wear.

All options enforce identical hard constraints (vehicle capacity, inventory, route availability, demand).
"""

from datetime import datetime, timezone
from typing import List, Optional
import uuid

from app.models.coa import COAType, CourseOfActionPlan, CoursesOfActionResponse
from app.models.common import RiskLevel
from app.models.disruption import DisruptionRequest
from app.models.logistics_state import LogisticsState
from app.models.optimization import OptimizationResult, OptimizerWeights
from app.optimizer.service import optimizer_service
from app.simulation.disruption_service import disruption_engine
from app.simulation.world import world_state_service


def _calculate_plan_metrics(
    plan_name: str,
    result: OptimizationResult,
) -> CourseOfActionPlan:
    """
    Computes summary metrics (ETA, distance, normalized risk score, cost, unmet demand)
    for an optimization result.
    """
    risk_scores = {
        RiskLevel.SAFE: 0.0,
        RiskLevel.LOW: 0.25,
        RiskLevel.MEDIUM: 0.50,
        RiskLevel.HIGH: 0.75,
        RiskLevel.BLOCKED: 1.0,
    }

    if result.deliveries:
        avg_risk = round(
            sum(risk_scores.get(d.risk, 0.0) for d in result.deliveries) / len(result.deliveries),
            2,
        )
    else:
        avg_risk = 0.0

    distance = round(result.total_distance, 2)
    eta = round(result.total_eta, 2)

    # Realistic operational cost formula:
    # Fuel/maintenance ($5/km) + transit operations ($50/hr) + hazard contingency ($200 * risk)
    cost = round((distance * 5.0) + (eta * 50.0) + (avg_risk * 200.0), 2)

    descriptions = {
        COAType.FASTEST.value: "Maximizes delivery velocity to arrive in minimum transit time, accepting longer mileage and moderate route hazards.",
        COAType.LOWEST_RISK.value: "Maximizes convoy security by strictly selecting safer transit corridors, accepting potential travel delays or extra mileage.",
        COAType.RESOURCE_EFFICIENT.value: "Minimizes total mileage and fuel consumption to conserve vehicle wear and logistics resources.",
    }

    return CourseOfActionPlan(
        id=f"COA-{plan_name}-{uuid.uuid4().hex[:6].upper()}",
        name=plan_name,
        eta=eta,
        distance=distance,
        risk=avg_risk,
        cost=cost,
        unmet_demand=round(result.total_unmet_demand, 2),
        deliveries=result.deliveries,
        status=result.status,
        description=descriptions.get(plan_name),
    )


class CoursesOfActionService:
    """
    Generates alternative Courses of Action with tailored multi-objective parameterizations.
    """

    def generate_courses_of_action(
        self,
        state: Optional[LogisticsState] = None,
        disruption: Optional[DisruptionRequest] = None,
    ) -> CoursesOfActionResponse:
        """
        Executes CP-SAT under 3 distinct objective parameterizations to produce
        FASTEST, LOWEST_RISK, and RESOURCE_EFFICIENT action plans.

        Args:
            state: Optional custom LogisticsState (defaults to active world state).
            disruption: Optional disruption event to apply before solving.

        Returns:
            CoursesOfActionResponse containing the 3 feasible evaluated plans.
        """
        now = datetime.now(timezone.utc)
        target_state = state if state is not None else world_state_service.get_state()
        state_copy = target_state.model_copy(deep=True)

        if disruption is not None:
            disruption_engine.apply_disruption(state_copy, disruption)

        # ---------------------------------------------------------------------
        # PLAN 1: FASTEST (Minimize delivery transit time)
        # ---------------------------------------------------------------------
        weights_fastest = OptimizerWeights(
            weight_unmet_critical=10_000,
            weight_unmet_high=5_000,
            weight_unmet_medium=2_000,
            weight_unmet_low=1_000,
            weight_travel_time=1_000,   # Heavily penalize travel time
            weight_distance=1,
            weight_risk_safe=0,
            weight_risk_low=10,
            weight_risk_medium=50,
            weight_risk_high=200,
            weight_late_delivery=10_000,
        )
        res_fastest = optimizer_service.optimize(state_copy.model_copy(deep=True), weights=weights_fastest)
        plan_fastest = _calculate_plan_metrics(COAType.FASTEST.value, res_fastest)

        # ---------------------------------------------------------------------
        # PLAN 2: LOWEST_RISK (Minimize route threat / hazard)
        # ---------------------------------------------------------------------
        weights_lowest_risk = OptimizerWeights(
            weight_unmet_critical=10_000,
            weight_unmet_high=5_000,
            weight_unmet_medium=2_000,
            weight_unmet_low=1_000,
            weight_travel_time=5,
            weight_distance=1,
            weight_risk_safe=0,
            weight_risk_low=2_000,
            weight_risk_medium=10_000,  # Heavily penalize route hazards
            weight_risk_high=50_000,
            weight_late_delivery=5_000,
        )
        res_lowest_risk = optimizer_service.optimize(state_copy.model_copy(deep=True), weights=weights_lowest_risk)
        plan_lowest_risk = _calculate_plan_metrics(COAType.LOWEST_RISK.value, res_lowest_risk)

        # ---------------------------------------------------------------------
        # PLAN 3: RESOURCE_EFFICIENT (Minimize distance / fuel / cost)
        # ---------------------------------------------------------------------
        weights_resource_efficient = OptimizerWeights(
            weight_unmet_critical=10_000,
            weight_unmet_high=5_000,
            weight_unmet_medium=2_000,
            weight_unmet_low=1_000,
            weight_travel_time=5,
            weight_distance=500,        # Heavily penalize mileage & fuel burn
            weight_risk_safe=0,
            weight_risk_low=50,
            weight_risk_medium=200,
            weight_risk_high=1_000,
            weight_late_delivery=2_000,
        )
        res_resource_efficient = optimizer_service.optimize(state_copy.model_copy(deep=True), weights=weights_resource_efficient)
        plan_resource_efficient = _calculate_plan_metrics(COAType.RESOURCE_EFFICIENT.value, res_resource_efficient)

        return CoursesOfActionResponse(
            plans=[plan_fastest, plan_lowest_risk, plan_resource_efficient],
            generated_at=now,
        )


# Singleton COA service instance
coa_service = CoursesOfActionService()


def generate_courses_of_action(
    state: Optional[LogisticsState] = None,
    disruption: Optional[DisruptionRequest] = None,
) -> CoursesOfActionResponse:
    """Helper function to generate the 3 Courses of Action."""
    return coa_service.generate_courses_of_action(state=state, disruption=disruption)
