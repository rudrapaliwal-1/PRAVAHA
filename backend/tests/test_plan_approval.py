"""
tests/test_plan_approval.py — Unit and integration tests for Human-in-the-Loop Plan Approval.

Tests:
1. Plan Approval:
   - Plan starts in PENDING status without executing automatically.
   - Approval sets status to APPROVED and populates simulation state.deliveries.
   - Plan is marked as active.
2. Plan Rejection:
   - Rejection sets status to REJECTED.
   - Deliveries are not activated in the simulation state.
3. Invalid Plan ID:
   - Approving/rejecting non-existent plan returns 404 error.
4. Already Approved Plan:
   - Approving an already approved plan returns 400 Bad Request error.
5. API Integration:
   - Full flow: /api/optimize -> /api/plans/{plan_id}/approve -> verify /api/state.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.common import DeliveryStatus, Priority, SupplyType
from app.models.optimization import OptimizationDelivery, OptimizationResult
from app.models.plan import LogisticsPlan, PlanDecisionResponse, PlanState
from app.optimizer.plan_service import plan_service
from app.optimizer.service import optimize_logistics
from app.simulation.world import create_initial_logistics_state, world_state_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_world_state_and_plans_before_each_test():
    world_state_service.reset_state()
    plan_service.reset()
    yield
    world_state_service.reset_state()
    plan_service.reset()


class TestPlanApprovalService:
    def test_plan_approval_activates_deliveries_in_state(self):
        """Approving a PENDING plan sets status to APPROVED and populates state.deliveries."""
        state = create_initial_logistics_state()
        assert len(state.deliveries) == 0

        # Generate optimization result
        opt_result = optimize_logistics(state)
        assert len(opt_result.deliveries) > 0

        # Register as recommended plan (PENDING)
        plan = plan_service.register_optimization_result(opt_result, name="TEST_PLAN_1")
        assert plan.status == PlanState.PENDING
        assert plan_service.get_active_plan_id() is None
        # State deliveries must remain empty before approval
        assert len(state.deliveries) == 0

        # Execute human approval
        response = plan_service.approve_plan(
            plan_id=plan.id,
            state=state,
            reason="Approved by Logistics Commander Alpha",
        )

        assert response.status == PlanState.APPROVED
        assert response.is_active is True
        assert plan.status == PlanState.APPROVED
        assert plan_service.get_active_plan_id() == plan.id

        # Verify state.deliveries are populated with approved deliveries
        assert len(state.deliveries) == len(plan.deliveries)
        for idx, deliv in enumerate(state.deliveries):
            assert deliv.vehicle_id == plan.deliveries[idx].vehicle_id
            assert deliv.depot_id == plan.deliveries[idx].depot_id
            assert deliv.demand_point_id == plan.deliveries[idx].demand_point_id
            assert deliv.quantity == plan.deliveries[idx].quantity
            assert deliv.status == DeliveryStatus.IN_TRANSIT

    def test_plan_rejection_marks_rejected_and_does_not_activate(self):
        """Rejecting a plan sets status to REJECTED and leaves state.deliveries empty."""
        state = create_initial_logistics_state()
        opt_result = optimize_logistics(state)

        plan = plan_service.register_optimization_result(opt_result, name="TEST_PLAN_REJECT")
        assert plan.status == PlanState.PENDING

        response = plan_service.reject_plan(
            plan_id=plan.id,
            state=state,
            reason="Transit risk too high along northern corridor",
        )

        assert response.status == PlanState.REJECTED
        assert response.is_active is False
        assert plan.status == PlanState.REJECTED
        assert plan_service.get_active_plan_id() is None
        assert len(state.deliveries) == 0

    def test_invalid_plan_id_raises_key_error(self):
        """Approving or rejecting a non-existent plan ID raises KeyError."""
        with pytest.raises(KeyError):
            plan_service.approve_plan("NON_EXISTENT_PLAN_999")

        with pytest.raises(KeyError):
            plan_service.reject_plan("NON_EXISTENT_PLAN_999")

    def test_already_approved_plan_raises_value_error(self):
        """Attempting to approve a plan that is already APPROVED raises ValueError."""
        state = create_initial_logistics_state()
        opt_result = optimize_logistics(state)
        plan = plan_service.register_optimization_result(opt_result)

        # First approval succeeds
        plan_service.approve_plan(plan.id, state=state)
        assert plan.status == PlanState.APPROVED

        # Second approval must raise ValueError
        with pytest.raises(ValueError, match="already approved"):
            plan_service.approve_plan(plan.id, state=state)


class TestApiPlanApprovalEndpoints:
    def test_api_optimize_and_approve_plan_flow(self):
        """End-to-end API flow: generate plan, approve via API, and verify state."""
        # 1. Trigger optimization
        opt_resp = client.post("/api/optimize")
        assert opt_resp.status_code == 200

        # 2. List registered plans
        plans_resp = client.get("/api/plans")
        assert plans_resp.status_code == 200
        plans_data = plans_resp.json()
        assert len(plans_data) >= 1

        target_plan = plans_data[-1]
        plan_id = target_plan["id"]
        assert target_plan["status"] == "PENDING"

        # 3. State before approval has no deliveries
        state_pre = client.get("/api/state").json()
        assert len(state_pre["deliveries"]) == 0

        # 4. Approve plan via POST /api/plans/{plan_id}/approve
        approve_resp = client.post(
            f"/api/plans/{plan_id}/approve",
            json={"reason": "Tactical greenlight authorized"},
        )
        assert approve_resp.status_code == 200
        approve_data = approve_resp.json()
        assert approve_data["status"] == "APPROVED"
        assert approve_data["is_active"] is True

        # 5. State after approval contains active deliveries
        state_post = client.get("/api/state").json()
        assert len(state_post["deliveries"]) == len(target_plan["deliveries"])

    def test_api_reject_plan_flow(self):
        """Rejecting a plan via API sets status to REJECTED."""
        client.post("/api/optimize")
        plans = client.get("/api/plans").json()
        plan_id = plans[0]["id"]

        reject_resp = client.post(
            f"/api/plans/{plan_id}/reject",
            json={"reason": "Resource bottleneck"},
        )
        assert reject_resp.status_code == 200
        reject_data = reject_resp.json()
        assert reject_data["status"] == "REJECTED"
        assert reject_data["is_active"] is False

    def test_api_invalid_plan_returns_404(self):
        """Approving a missing plan returns 404 NOT FOUND."""
        response = client.post("/api/plans/INVALID-PLAN-ID/approve")
        assert response.status_code == 404

        response_rej = client.post("/api/plans/INVALID-PLAN-ID/reject")
        assert response_rej.status_code == 404

    def test_api_already_approved_plan_returns_400(self):
        """Re-approving an already approved plan returns 400 BAD REQUEST."""
        client.post("/api/optimize")
        plans = client.get("/api/plans").json()
        plan_id = plans[0]["id"]

        # First approval
        res1 = client.post(f"/api/plans/{plan_id}/approve")
        assert res1.status_code == 200

        # Second approval must fail with 400
        res2 = client.post(f"/api/plans/{plan_id}/approve")
        assert res2.status_code == 400
        assert "already approved" in res2.json()["detail"].lower()
