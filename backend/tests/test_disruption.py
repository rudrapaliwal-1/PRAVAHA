"""
tests/test_disruption.py — Unit and integration tests for the Disruption Simulation Engine.

Tests:
1. BLOCK_ROUTE disruption
2. VEHICLE_FAILURE disruption
3. DEMAND_SURGE disruption
4. INVENTORY_SHORTAGE disruption
5. NEW_EMERGENCY disruption
6. State isolation from baseline deterministic data
7. POST /api/simulation/disruption endpoint integration
8. Validation error handling for non-existent targets
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.models.common import Priority, RiskLevel, SupplyType
from app.models.disruption import DisruptionRequest, DisruptionResult, DisruptionType
from app.models.logistics_state import LogisticsState
from app.simulation.disruption_service import disruption_engine, simulate_disruption
from app.simulation.world import create_initial_logistics_state, world_state_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_world_state_before_each_test():
    """Ensure each test runs against a fresh clean world state."""
    world_state_service.reset_state()
    yield
    world_state_service.reset_state()


class TestDisruptionTypes:
    def test_block_route_disruption(self):
        """BLOCK_ROUTE sets target route unavailable and risk to BLOCKED."""
        state = create_initial_logistics_state()
        route_id = "ROUTE-01"
        assert state.routes[route_id].available is True
        assert state.routes[route_id].risk != RiskLevel.BLOCKED

        req = DisruptionRequest(type=DisruptionType.BLOCK_ROUTE, target_id=route_id)
        result = simulate_disruption(state, req)

        assert result.event_type == DisruptionType.BLOCK_ROUTE
        assert result.affected_entities == [route_id]
        assert state.routes[route_id].available is False
        assert state.routes[route_id].risk == RiskLevel.BLOCKED
        assert result.state_changes["new_available"] is False
        assert result.state_changes["new_risk"] == "blocked"

    def test_vehicle_failure_disruption(self):
        """VEHICLE_FAILURE sets target vehicle unavailable."""
        state = create_initial_logistics_state()
        veh_id = "VEH-01"
        assert state.vehicles[veh_id].available is True

        req = DisruptionRequest(type=DisruptionType.VEHICLE_FAILURE, target_id=veh_id)
        result = simulate_disruption(state, req)

        assert result.event_type == DisruptionType.VEHICLE_FAILURE
        assert result.affected_entities == [veh_id]
        assert state.vehicles[veh_id].available is False
        assert result.state_changes["new_available"] is False

    def test_demand_surge_disruption(self):
        """DEMAND_SURGE increases required supplies by specified multiplier."""
        state = create_initial_logistics_state()
        dp_id = "DEMAND-01"
        prev_water = state.demand_points[dp_id].required_supplies[SupplyType.WATER]

        req = DisruptionRequest(
            type=DisruptionType.DEMAND_SURGE,
            target_id=dp_id,
            parameters={"surge_multiplier": 2.0},
        )
        result = simulate_disruption(state, req)

        assert result.event_type == DisruptionType.DEMAND_SURGE
        assert result.affected_entities == [dp_id]
        new_water = state.demand_points[dp_id].required_supplies[SupplyType.WATER]
        assert new_water == prev_water * 2.0
        assert result.state_changes["new_required_supplies"]["water"] == prev_water * 2.0

    def test_inventory_shortage_disruption(self):
        """INVENTORY_SHORTAGE reduces depot inventory by specified percentage."""
        state = create_initial_logistics_state()
        depot_id = "DEPOT-ALPHA"
        prev_medicine = state.depots[depot_id].inventory[SupplyType.MEDICINE]

        req = DisruptionRequest(
            type=DisruptionType.INVENTORY_SHORTAGE,
            target_id=depot_id,
            parameters={"loss_fraction": 0.5},
        )
        result = simulate_disruption(state, req)

        assert result.event_type == DisruptionType.INVENTORY_SHORTAGE
        assert result.affected_entities == [depot_id]
        new_medicine = state.depots[depot_id].inventory[SupplyType.MEDICINE]
        assert new_medicine == prev_medicine * 0.5
        assert result.state_changes["new_inventory"]["medicine"] == prev_medicine * 0.5

    def test_new_emergency_disruption(self):
        """NEW_EMERGENCY adds a new high-priority demand point and connects routes from depots."""
        state = create_initial_logistics_state()
        emergency_id = "DEMAND-EMERGENCY-ALPHA"
        initial_dp_count = len(state.demand_points)

        req = DisruptionRequest(
            type=DisruptionType.NEW_EMERGENCY,
            target_id=emergency_id,
            parameters={
                "priority": "critical",
                "location": {"lat": 30.4500, "lon": 78.3500},
                "required_supplies": {"medicine": 1200.0, "water": 4000.0},
            },
        )
        result = simulate_disruption(state, req)

        assert result.event_type == DisruptionType.NEW_EMERGENCY
        assert emergency_id in state.demand_points
        assert len(state.demand_points) == initial_dp_count + 1
        new_dp = state.demand_points[emergency_id]
        assert new_dp.priority == Priority.CRITICAL
        assert new_dp.required_supplies[SupplyType.MEDICINE] == 1200.0
        assert len(result.state_changes["created_routes"]) == len(state.depots)

    def test_state_isolation_from_original_generator(self):
        """Mutating the simulated state does not modify the deterministic generator output."""
        state = world_state_service.get_state()
        req = DisruptionRequest(type=DisruptionType.BLOCK_ROUTE, target_id="ROUTE-01")
        disruption_engine.apply_disruption(state, req)

        # Active state has blocked route
        assert state.routes["ROUTE-01"].available is False

        # Fresh baseline state from generator remains pristine
        clean_state = create_initial_logistics_state()
        assert clean_state.routes["ROUTE-01"].available is True


class TestApiDisruptionEndpoint:
    def test_post_disruption_block_route(self):
        """POST /api/simulation/disruption returns 200 OK and applies disruption."""
        payload = {
            "type": "BLOCK_ROUTE",
            "target_id": "ROUTE-04",
        }
        response = client.post("/api/simulation/disruption", json=payload)
        assert response.status_code == 200
        data = response.json()

        validated = DisruptionResult.model_validate(data)
        assert validated.event_type == DisruptionType.BLOCK_ROUTE
        assert validated.affected_entities == ["ROUTE-04"]
        assert validated.state_changes["new_available"] is False

        # Verify mutation in world state
        current_state = world_state_service.get_state()
        assert current_state.routes["ROUTE-04"].available is False

    def test_post_disruption_non_existent_target_returns_400(self):
        """POST /api/simulation/disruption with unknown target_id returns 400 Bad Request."""
        payload = {
            "type": "BLOCK_ROUTE",
            "target_id": "ROUTE-DOES-NOT-EXIST-999",
        }
        response = client.post("/api/simulation/disruption", json=payload)
        assert response.status_code == 400
        assert "not found" in response.json()["detail"].lower()
