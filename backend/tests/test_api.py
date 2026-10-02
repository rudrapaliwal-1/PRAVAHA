"""
tests/test_api.py

Validates all HTTP API endpoints:
- GET /health
- GET /api/state
- GET /api/vehicles
- GET /api/depots
- GET /api/demand-points
- GET /api/routes
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestApiEndpoints:
    def test_health_endpoint(self):
        """GET /health must return status ok and service name."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {
            "status": "ok",
            "service": "MissionPath Backend",
        }

    def test_get_state_endpoint(self):
        """GET /api/state must return complete LogisticsState."""
        response = client.get("/api/state")
        assert response.status_code == 200
        data = response.json()

        assert "vehicles" in data
        assert "depots" in data
        assert "demand_points" in data
        assert "routes" in data
        assert "deliveries" in data

        assert len(data["vehicles"]) == 10
        assert len(data["depots"]) == 3
        assert len(data["demand_points"]) == 6
        assert len(data["routes"]) == 12

    def test_get_vehicles_endpoint(self):
        """GET /api/vehicles must return 10 vehicles."""
        response = client.get("/api/vehicles")
        assert response.status_code == 200
        vehicles = response.json()
        assert isinstance(vehicles, list)
        assert len(vehicles) == 10

        vehicle_ids = {v["id"] for v in vehicles}
        assert "VEH-01" in vehicle_ids
        assert "VEH-10" in vehicle_ids

    def test_get_depots_endpoint(self):
        """GET /api/depots must return 3 depots."""
        response = client.get("/api/depots")
        assert response.status_code == 200
        depots = response.json()
        assert isinstance(depots, list)
        assert len(depots) == 3

        depot_ids = {d["id"] for d in depots}
        assert depot_ids == {"DEPOT-ALPHA", "DEPOT-BRAVO", "DEPOT-CHARLIE"}

    def test_get_demand_points_endpoint(self):
        """GET /api/demand-points must return 6 demand points."""
        response = client.get("/api/demand-points")
        assert response.status_code == 200
        dps = response.json()
        assert isinstance(dps, list)
        assert len(dps) == 6

        dp_ids = {dp["id"] for dp in dps}
        assert dp_ids == {
            "DEMAND-01",
            "DEMAND-02",
            "DEMAND-03",
            "DEMAND-04",
            "DEMAND-05",
            "DEMAND-06",
        }

    def test_get_routes_endpoint(self):
        """GET /api/routes must return 12 routes."""
        response = client.get("/api/routes")
        assert response.status_code == 200
        routes = response.json()
        assert isinstance(routes, list)
        assert len(routes) == 12

        route_ids = {r["id"] for r in routes}
        assert "ROUTE-01" in route_ids
        assert "ROUTE-12" in route_ids

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
