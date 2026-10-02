"""
tests/test_resilience.py — Unit and integration tests for Supply Chain Resilience scoring.

Tests:
1. Baseline resilience score calculation from active LogisticsState (all 5 dimensions).
2. Dynamic score reduction following disruptions (BLOCK_ROUTE, VEHICLE_FAILURE, INVENTORY_SHORTAGE).
3. Score improvement following re-optimization / delivery dispatch (demand_coverage improvement).
4. Qualitative key factor identification reflecting system vulnerabilities.
5. GET /api/resilience and GET /api/resilience/score API endpoints integration.
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.models.common import DeliveryStatus, Priority, RiskLevel, SupplyType
from app.models.delivery import Delivery
from app.models.disruption import DisruptionRequest, DisruptionType
from app.models.logistics_state import LogisticsState
from app.models.resilience import ResilienceScore
from app.optimizer.service import optimize_logistics
from app.resilience.service import calculate_resilience, resilience_engine
from app.simulation.disruption_service import disruption_engine
from app.simulation.world import create_initial_logistics_state, world_state_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_world_state_before_each_test():
    world_state_service.reset_state()
    yield
    world_state_service.reset_state()


class TestResilienceScoringEngine:
    def test_baseline_resilience_calculation(self):
        """Validates all 5 dimensions and overall resilience score (0-100) on baseline state."""
        state = create_initial_logistics_state()
        score = calculate_resilience(state)

        assert 0.0 <= score.overall_score <= 100.0
        assert 0.0 <= score.inventory <= 100.0
        assert 0.0 <= score.fleet <= 100.0
        assert 0.0 <= score.routes <= 100.0
        assert 0.0 <= score.demand_coverage <= 100.0
        assert 0.0 <= score.connectivity <= 100.0
        assert len(score.key_factors) > 0

        # Component alias fields
        assert score.inventory_score == score.inventory
        assert score.fleet_score == score.fleet
        assert score.route_score == score.routes
        assert score.demand_coverage_score == score.demand_coverage
        assert score.connectivity_score == score.connectivity

    def test_resilience_decreases_after_route_blockage(self):
        """Blocking key transit routes decreases route and overall resilience scores."""
        state = create_initial_logistics_state()
        baseline_score = calculate_resilience(state)

        # Block multiple routes
        disruption_engine.apply_disruption(state, DisruptionRequest(type=DisruptionType.BLOCK_ROUTE, target_id="ROUTE-01"))
        disruption_engine.apply_disruption(state, DisruptionRequest(type=DisruptionType.BLOCK_ROUTE, target_id="ROUTE-02"))
        disrupted_score = calculate_resilience(state)

        assert disrupted_score.routes < baseline_score.routes
        assert disrupted_score.overall_score < baseline_score.overall_score

    def test_resilience_decreases_after_vehicle_and_inventory_disruptions(self):
        """Vehicle failure and inventory losses degrade fleet and inventory scores respectively."""
        state = create_initial_logistics_state()
        baseline_score = calculate_resilience(state)

        # 1. Vehicle failure
        disruption_engine.apply_disruption(state, DisruptionRequest(type=DisruptionType.VEHICLE_FAILURE, target_id="VEH-01"))
        disruption_engine.apply_disruption(state, DisruptionRequest(type=DisruptionType.VEHICLE_FAILURE, target_id="VEH-02"))
        score_after_fleet_drop = calculate_resilience(state)

        assert score_after_fleet_drop.fleet < baseline_score.fleet

        # 2. Inventory shortage
        disruption_engine.apply_disruption(state, DisruptionRequest(
            type=DisruptionType.INVENTORY_SHORTAGE,
            target_id="DEPOT-ALPHA",
            parameters={"loss_fraction": 0.8},
        ))
        score_after_inv_drop = calculate_resilience(state)

        assert score_after_inv_drop.inventory < score_after_fleet_drop.inventory

    def test_resilience_reflects_improvements_after_deliveries_scheduled(self):
        """Scheduling deliveries to fulfill demand improves demand_coverage and overall score."""
        state = create_initial_logistics_state()
        initial_score = calculate_resilience(state)

        # Execute optimization and record active deliveries into state
        opt_result = optimize_logistics(state)
        for idx, deliv in enumerate(opt_result.deliveries):
            state.deliveries.append(
                Delivery(
                    id=f"DELIV-ACT-{idx}",
                    vehicle_id=deliv.vehicle_id,
                    depot_id=deliv.depot_id,
                    demand_point_id=deliv.demand_point_id,
                    supply_type=deliv.supply_type,
                    quantity=deliv.quantity,
                    route_id=deliv.route_id,
                    status=DeliveryStatus.IN_TRANSIT,
                )
            )

        optimized_score = calculate_resilience(state)
        assert optimized_score.demand_coverage > initial_score.demand_coverage
        assert optimized_score.overall_score > initial_score.overall_score

    def test_key_factors_reflect_system_bottlenecks(self):
        """Severe route blockages trigger specific explanatory key factors."""
        state = create_initial_logistics_state()
        for r_id in list(state.routes.keys())[:6]:
            state.routes[r_id].available = False
            state.routes[r_id].risk = RiskLevel.BLOCKED

        score = calculate_resilience(state)
        assert any("route" in factor.lower() or "blockage" in factor.lower() for factor in score.key_factors)


class TestApiResilienceEndpoint:
    def test_get_resilience_endpoint(self):
        """GET /api/resilience returns 200 OK with full ResilienceScore structure."""
        response = client.get("/api/resilience")
        assert response.status_code == 200
        data = response.json()

        validated = ResilienceScore.model_validate(data)
        assert 0.0 <= validated.overall_score <= 100.0
        assert 0.0 <= validated.inventory <= 100.0
        assert 0.0 <= validated.fleet <= 100.0
        assert 0.0 <= validated.routes <= 100.0
        assert 0.0 <= validated.demand_coverage <= 100.0
        assert 0.0 <= validated.connectivity <= 100.0
        assert len(validated.key_factors) >= 1

    def test_get_resilience_score_alias_endpoint(self):
        """GET /api/resilience/score returns 200 OK."""
        response = client.get("/api/resilience/score")
        assert response.status_code == 200
        data = response.json()
        assert "overall_score" in data
