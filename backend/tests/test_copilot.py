"""
tests/test_copilot.py — Unit and integration tests for AI Logistics Copilot.

Tests:
1. Vehicle selection explanation grounded in CP-SAT and vehicle telemetry.
2. Route change/exclusion explanation referencing road blockage or hazard.
3. Shortage risk identification referencing predicted supply consumption.
4. Resilience score degradation explanation referencing sub-indices.
5. Post-disruption changes & affected deliveries explanation.
6. Course of Action (COA) trade-off explanation.
7. Information not available response for non-existent entities (anti-hallucination).
8. Custom/Mocked LLM provider testing.
9. POST /api/copilot API endpoint integration.
"""

from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient

from app.copilot.llm_client import BaseCopilotLLM, DeterministicGroundedCopilot
from app.copilot.service import LogisticsCopilotService, copilot_service
from app.main import app
from app.models.copilot import CopilotRequest, CopilotResponse
from app.models.disruption import DisruptionRequest, DisruptionType
from app.optimizer.plan_service import plan_service
from app.optimizer.service import optimize_logistics
from app.simulation.disruption_service import disruption_engine
from app.simulation.world import create_initial_logistics_state, world_state_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_world_state_before_each_test():
    world_state_service.reset_state()
    plan_service.reset()
    copilot_service.set_llm_client(DeterministicGroundedCopilot())
    yield
    world_state_service.reset_state()
    plan_service.reset()
    copilot_service.set_llm_client(DeterministicGroundedCopilot())


class TestLogisticsCopilotExplanations:
    def test_explain_vehicle_selection_with_optimization_context(self):
        """Explains why a specific vehicle was chosen based on capacity, fuel, and CP-SAT assignment."""
        state = create_initial_logistics_state()
        opt_result = optimize_logistics(state)
        plan_service.register_optimization_result(opt_result)

        target_delivery = opt_result.deliveries[0]
        v_id = target_delivery.vehicle_id

        req = CopilotRequest(question=f"Why was Vehicle {v_id} selected for delivery?")
        response = copilot_service.ask(req, state=state)

        assert v_id in response.referenced_entities
        assert "cp-sat" in response.answer.lower() or "optimizer" in response.answer.lower()
        assert "capacity" in response.answer.lower() or "fuel" in response.answer.lower()
        assert str(target_delivery.depot_id) in response.answer or str(target_delivery.demand_point_id) in response.answer

    def test_explain_route_change_or_blockage(self):
        """Explains why a blocked route was avoided and deliveries rerouted."""
        state = create_initial_logistics_state()
        # ROUTE-12 is BLOCKED in initial deterministic state
        req = CopilotRequest(question="Why was Route ROUTE-12 changed and not used?")
        response = copilot_service.ask(req, state=state)

        assert "ROUTE-12" in response.referenced_entities
        assert "blocked" in response.answer.lower() or "unavailable" in response.answer.lower()
        assert "cp-sat" in response.answer.lower() or "constraints" in response.answer.lower()

    def test_explain_impending_shortage_locations(self):
        """Identifies locations with predicted supply shortages based on consumption rates."""
        state = create_initial_logistics_state()
        req = CopilotRequest(question="Which locations are at risk of shortage?")
        response = copilot_service.ask(req, state=state)

        assert len(response.referenced_entities) > 0
        assert "shortage" in response.answer.lower() or "resupply" in response.answer.lower()

    def test_explain_resilience_score_drivers(self):
        """Explains the resilience score and key factors driving the index."""
        state = create_initial_logistics_state()
        req = CopilotRequest(question="Why did the resilience score decrease?")
        response = copilot_service.ask(req, state=state)

        assert "resilience" in response.answer.lower()
        assert "inventory" in response.answer.lower() or "fleet" in response.answer.lower() or "routes" in response.answer.lower()

    def test_explain_disruption_impacts_and_affected_resources(self):
        """Explains the impact of a vehicle breakdown or route blockage disruption."""
        state = create_initial_logistics_state()
        disruption_engine.apply_disruption(
            state,
            DisruptionRequest(type=DisruptionType.BLOCK_ROUTE, target_id="ROUTE-01"),
        )

        req = CopilotRequest(question="What changed after the disruption and which deliveries were affected?")
        response = copilot_service.ask(req, state=state)

        assert "ROUTE-01" in response.referenced_entities
        assert "disruption" in response.answer.lower() or "re-optimization" in response.answer.lower()

    def test_explain_courses_of_action(self):
        """Explains the tactical trade-offs between Fast, Safe, and Cost-Efficient COAs."""
        state = create_initial_logistics_state()
        req = CopilotRequest(question="Why was this Course of Action generated?")
        response = copilot_service.ask(req, state=state)

        assert "course of action" in response.answer.lower() or "trade-off" in response.answer.lower() or "fastest" in response.answer.lower()

    def test_non_existent_entity_reports_information_not_available(self):
        """Anti-hallucination check: missing entity produces explicit 'Information not available' response."""
        state = create_initial_logistics_state()
        req = CopilotRequest(question="Why was Vehicle VEH-999 selected?")
        response = copilot_service.ask(req, state=state)

        assert "not available" in response.answer.lower() or "does not exist" in response.answer.lower()
        assert "VEH-999" in response.referenced_entities

    def test_mocked_ai_provider_integration(self):
        """Validates that custom/mocked AI providers can be plugged in seamlessly."""
        mock_llm = MagicMock(spec=BaseCopilotLLM)
        mock_llm.generate_explanation.return_value = (
            "Mocked AI Copilot: Vehicle VEH-01 was selected due to shortest travel duration.",
            ["VEH-01"],
            "mock_provider_gpt4",
        )

        custom_copilot = LogisticsCopilotService(llm_client=mock_llm)
        req = CopilotRequest(question="Why was Vehicle VEH-01 selected?")
        res = custom_copilot.ask(req)

        assert res.provider == "mock_provider_gpt4"
        assert "Mocked AI Copilot" in res.answer
        assert "VEH-01" in res.referenced_entities
        mock_llm.generate_explanation.assert_called_once()


class TestApiCopilotEndpoint:
    def test_post_copilot_endpoint(self):
        """POST /api/copilot returns 200 OK with grounded explanation and context summary."""
        payload = {
            "question": "Why was Route ROUTE-12 not used for delivery?",
            "context": "Focus on flood-affected northern supply corridors.",
        }
        response = client.post("/api/copilot", json=payload)
        assert response.status_code == 200
        data = response.json()

        validated = CopilotResponse.model_validate(data)
        assert len(validated.answer) > 20
        assert "ROUTE-12" in validated.referenced_entities
        assert len(validated.context_summary) > 0
        assert validated.provider in ["deterministic_grounded_engine", "grounded_copilot_engine"]

    def test_post_copilot_endpoint_invalid_payload_rejected(self):
        """POST /api/copilot with empty question returns 422 Unprocessable Entity."""
        response = client.post("/api/copilot", json={"question": ""})
        assert response.status_code == 422
