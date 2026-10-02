"""
tests/test_api.py

Validates all HTTP API endpoints:
- GET /health
- GET /api/state
- GET /api/vehicles
- GET /api/depots
- GET /api/demand-points
- GET /api/routes

Also tests:
- Pydantic response model validation
- Single source of truth consistency
- Error handling (404 Not Found and 500 Server Error)
"""

from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.api.schemas import ErrorResponse, HealthResponse
from app.main import app
from app.models.demand_point import DemandPoint
from app.models.depot import Depot
from app.models.logistics_state import LogisticsState
from app.models.route import Route
from app.models.vehicle import Vehicle
from app.simulation.world import world_state_service

client = TestClient(app)


class TestApiEndpoints:
    @pytest.fixture(autouse=True)
    def reset_world_state(self):
        """Ensure fresh baseline world state before and after each test."""
        world_state_service.reset_state()
        yield
        world_state_service.reset_state()

    def test_health_endpoint(self):
        """GET /health must return status ok and service name conforming to HealthResponse."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        validated = HealthResponse.model_validate(data)
        assert validated.status == "ok"
        assert validated.service == "MissionPath Backend"

    def test_get_state_endpoint(self):
        """GET /api/state must return complete LogisticsState conforming to Pydantic model."""
        response = client.get("/api/state")
        assert response.status_code == 200
        data = response.json()

        validated_state = LogisticsState.model_validate(data)
        assert len(validated_state.vehicles) == 10
        assert len(validated_state.depots) == 3
        assert len(validated_state.demand_points) == 6
        assert len(validated_state.routes) == 12

    def test_get_vehicles_endpoint(self):
        """GET /api/vehicles must return 10 vehicles conforming to Vehicle model."""
        response = client.get("/api/vehicles")
        assert response.status_code == 200
        vehicles_data = response.json()
        assert isinstance(vehicles_data, list)
        assert len(vehicles_data) == 10

        vehicles = [Vehicle.model_validate(v) for v in vehicles_data]
        vehicle_ids = {v.id for v in vehicles}
        assert "VEH-01" in vehicle_ids
        assert "VEH-10" in vehicle_ids

        # Ensure all vehicles have positive capacities and valid coordinates
        for v in vehicles:
            assert v.capacity > 0
            assert -90.0 <= v.current_location.lat <= 90.0
            assert -180.0 <= v.current_location.lon <= 180.0

    def test_get_depots_endpoint(self):
        """GET /api/depots must return 3 depots conforming to Depot model."""
        response = client.get("/api/depots")
        assert response.status_code == 200
        depots_data = response.json()
        assert isinstance(depots_data, list)
        assert len(depots_data) == 3

        depots = [Depot.model_validate(d) for d in depots_data]
        depot_ids = {d.id for d in depots}
        assert depot_ids == {"DEPOT-ALPHA", "DEPOT-BRAVO", "DEPOT-CHARLIE"}

        for depot in depots:
            assert depot.total_stock() > 0

    def test_get_demand_points_endpoint(self):
        """GET /api/demand-points must return 6 demand points conforming to DemandPoint model."""
        response = client.get("/api/demand-points")
        assert response.status_code == 200
        dps_data = response.json()
        assert isinstance(dps_data, list)
        assert len(dps_data) == 6

        dps = [DemandPoint.model_validate(dp) for dp in dps_data]
        dp_ids = {dp.id for dp in dps}
        assert dp_ids == {
            "DEMAND-01",
            "DEMAND-02",
            "DEMAND-03",
            "DEMAND-04",
            "DEMAND-05",
            "DEMAND-06",
        }

        for dp in dps:
            assert dp.total_required() > 0

    def test_get_routes_endpoint(self):
        """GET /api/routes must return 12 routes conforming to Route model."""
        response = client.get("/api/routes")
        assert response.status_code == 200
        routes_data = response.json()
        assert isinstance(routes_data, list)
        assert len(routes_data) == 12

        routes = [Route.model_validate(r) for r in routes_data]
        route_ids = {r.id for r in routes}
        assert "ROUTE-01" in route_ids
        assert "ROUTE-12" in route_ids

        for route in routes:
            assert route.distance > 0
            assert route.travel_time > 0

    def test_data_consistency_across_endpoints(self):
        """Confirm that individual endpoints return the exact same entities as /api/state."""
        state_resp = client.get("/api/state").json()
        vehicles_resp = client.get("/api/vehicles").json()
        depots_resp = client.get("/api/depots").json()
        demand_resp = client.get("/api/demand-points").json()
        routes_resp = client.get("/api/routes").json()

        # Compare IDs and counts
        assert {v["id"] for v in vehicles_resp} == set(state_resp["vehicles"].keys())
        assert {d["id"] for d in depots_resp} == set(state_resp["depots"].keys())
        assert {dp["id"] for dp in demand_resp} == set(state_resp["demand_points"].keys())
        assert {r["id"] for r in routes_resp} == set(state_resp["routes"].keys())

    def test_single_source_of_truth(self):
        """Ensure updates in WorldStateService are reflected across /api/state and /api/vehicles."""
        initial_state = world_state_service.get_state()
        initial_count = len(initial_state.vehicles)

        # Mutate the in-memory state through service
        initial_state.vehicles["VEH-TEMP"] = Vehicle(
            id="VEH-TEMP",
            capacity=9999.0,
            current_location=initial_state.depots["DEPOT-ALPHA"].location,
            speed=50.0,
        )

        vehicles_resp = client.get("/api/vehicles").json()
        assert len(vehicles_resp) == initial_count + 1
        assert any(v["id"] == "VEH-TEMP" for v in vehicles_resp)

        state_resp = client.get("/api/state").json()
        assert "VEH-TEMP" in state_resp["vehicles"]

    def test_not_found_error_response_format(self):
        """Non-existent endpoint returns 404 with standard detail structure."""
        response = client.get("/api/nonexistent-endpoint")
        assert response.status_code == 404
        data = response.json()
        error = ErrorResponse.model_validate(data)
        assert error.detail is not None

    def test_internal_server_error_handling(self):
        """Simulated service failure returns HTTP 500 with ErrorResponse schema."""
        with patch.object(world_state_service, "get_state", side_effect=RuntimeError("State store unavailable")):
            endpoints = [
                "/api/state",
                "/api/vehicles",
                "/api/depots",
                "/api/demand-points",
                "/api/routes",
            ]
            for endpoint in endpoints:
                resp = client.get(endpoint)
                assert resp.status_code == 500
                data = resp.json()
                error = ErrorResponse.model_validate(data)
                assert "State store unavailable" in error.detail

