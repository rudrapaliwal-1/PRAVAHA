"""
optimizer/plan_service.py — Plan Registry and Human-in-the-Loop Approval Service.

Manages plan lifecycle: PENDING, APPROVED, REJECTED, MODIFIED.
Ensures that the optimizer only recommends plans without automatically executing them,
requiring explicit human operator approval before activating a plan in the simulation state.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.models.coa import CourseOfActionPlan
from app.models.common import DeliveryStatus
from app.models.delivery import Delivery
from app.models.logistics_state import LogisticsState
from app.models.optimization import OptimizationDelivery, OptimizationResult
from app.models.plan import (
    LogisticsPlan,
    PlanDecisionResponse,
    PlanState,
)
from app.simulation.world import world_state_service


class PlanApprovalService:
    """
    In-memory registry and approval orchestrator for optimization delivery plans.
    """

    def __init__(self) -> None:
        self._plans: Dict[str, LogisticsPlan] = {}
        self._active_plan_id: Optional[str] = None

    def register_plan(self, plan: LogisticsPlan) -> LogisticsPlan:
        """Stores a plan in the registry."""
        self._plans[plan.id] = plan
        return plan

    def register_optimization_result(
        self,
        result: OptimizationResult,
        name: str = "RECOMMENDED_PLAN",
        plan_id: Optional[str] = None,
    ) -> LogisticsPlan:
        """
        Creates and stores a PENDING LogisticsPlan from an OptimizationResult.
        """
        pid = plan_id or f"PLAN-{uuid.uuid4().hex[:6].upper()}"
        cost = round((result.total_distance * 3.5) + (result.total_eta * 15.0), 2)
        plan = LogisticsPlan(
            id=pid,
            name=name,
            status=PlanState.PENDING,
            deliveries=list(result.deliveries),
            total_supplied=result.total_supplied,
            total_unmet_demand=result.total_unmet_demand,
            total_distance=result.total_distance,
            total_eta=result.total_eta,
            estimated_cost=cost,
            created_at=datetime.now(timezone.utc),
        )
        self._plans[pid] = plan
        return plan

    def register_coa_plan(self, coa: CourseOfActionPlan) -> LogisticsPlan:
        """
        Stores a Course of Action plan in the registry with status PENDING.
        """
        plan = LogisticsPlan(
            id=coa.id,
            name=coa.name,
            status=PlanState.PENDING,
            deliveries=list(coa.deliveries),
            total_supplied=sum(d.quantity for d in coa.deliveries),
            total_unmet_demand=coa.unmet_demand,
            total_distance=coa.distance,
            total_eta=coa.eta,
            estimated_cost=coa.cost,
            created_at=datetime.now(timezone.utc),
        )
        self._plans[plan.id] = plan
        return plan

    def get_plan(self, plan_id: str) -> Optional[LogisticsPlan]:
        """Retrieves a plan by ID."""
        return self._plans.get(plan_id)

    def list_plans(self) -> List[LogisticsPlan]:
        """Returns all registered plans."""
        return list(self._plans.values())

    def get_active_plan_id(self) -> Optional[str]:
        """Returns the ID of the currently approved/active plan."""
        return self._active_plan_id

    def get_active_plan(self) -> Optional[LogisticsPlan]:
        """Returns the currently active LogisticsPlan if one is approved."""
        if self._active_plan_id and self._active_plan_id in self._plans:
            return self._plans[self._active_plan_id]
        return None

    def approve_plan(
        self,
        plan_id: str,
        state: Optional[LogisticsState] = None,
        reason: Optional[str] = None,
    ) -> PlanDecisionResponse:
        """
        Approves a plan, updates its state to APPROVED, and activates its deliveries in the simulation state.

        Args:
            plan_id: Target plan identifier.
            state: Optional custom LogisticsState (defaults to world state).
            reason: Optional operator decision notes.

        Returns:
            PlanDecisionResponse detailing the approval outcome.

        Raises:
            KeyError: If plan_id does not exist.
            ValueError: If plan is already approved.
        """
        if plan_id not in self._plans:
            raise KeyError(f"Plan with ID '{plan_id}' not found")

        plan = self._plans[plan_id]
        if plan.status == PlanState.APPROVED:
            raise ValueError(f"Plan '{plan_id}' is already approved")

        now = datetime.now(timezone.utc)
        plan.status = PlanState.APPROVED
        plan.decided_at = now
        plan.decision_reason = reason

        # Mark as active plan
        self._active_plan_id = plan.id

        # Update simulation world state with approved deliveries
        target_state = state if state is not None else world_state_service.get_state()
        target_state.deliveries.clear()

        for idx, deliv in enumerate(plan.deliveries):
            target_state.deliveries.append(
                Delivery(
                    id=f"DELIV-{plan.id}-{idx+1}",
                    vehicle_id=deliv.vehicle_id,
                    depot_id=deliv.depot_id,
                    demand_point_id=deliv.demand_point_id,
                    supply_type=deliv.supply_type,
                    quantity=deliv.quantity,
                    route_id=deliv.route_id,
                    status=DeliveryStatus.IN_TRANSIT,
                )
            )

        return PlanDecisionResponse(
            plan_id=plan.id,
            status=PlanState.APPROVED,
            message=f"Plan '{plan.id}' approved and set as active logistics plan.",
            plan=plan,
            is_active=True,
            timestamp=now,
        )

    def reject_plan(
        self,
        plan_id: str,
        state: Optional[LogisticsState] = None,
        reason: Optional[str] = None,
    ) -> PlanDecisionResponse:
        """
        Rejects a plan and updates its state to REJECTED.
        If it was previously active, deactivates it from the simulation state.

        Args:
            plan_id: Target plan identifier.
            state: Optional custom LogisticsState (defaults to world state).
            reason: Optional operator rejection rationale.

        Returns:
            PlanDecisionResponse detailing the rejection outcome.

        Raises:
            KeyError: If plan_id does not exist.
        """
        if plan_id not in self._plans:
            raise KeyError(f"Plan with ID '{plan_id}' not found")

        plan = self._plans[plan_id]
        now = datetime.now(timezone.utc)
        plan.status = PlanState.REJECTED
        plan.decided_at = now
        plan.decision_reason = reason

        was_active = self._active_plan_id == plan.id
        if was_active:
            self._active_plan_id = None
            target_state = state if state is not None else world_state_service.get_state()
            target_state.deliveries.clear()

        return PlanDecisionResponse(
            plan_id=plan.id,
            status=PlanState.REJECTED,
            message=f"Plan '{plan.id}' rejected by operator.",
            plan=plan,
            is_active=False,
            timestamp=now,
        )

    def reset(self) -> None:
        """Clears all registered plans and active plan ID."""
        self._plans.clear()
        self._active_plan_id = None


# Singleton instance
plan_service = PlanApprovalService()
