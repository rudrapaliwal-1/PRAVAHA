"""
tests/test_vehicle_health.py — Unit and integration tests for Vehicle Health & Maintenance Prediction.

Tests:
1. Deterministic vehicle telemetry calculation (mileage, utilization, health_score, maintenance_risk).
2. Maintenance risk categorization (LOW, MEDIUM, HIGH).
3. Disruption interaction: Vehicle failure marks vehicle unavailable, elevates maintenance risk to HIGH.
4. Dynamic Re-optimization interaction: Affected deliveries on failed vehicle are identified and reassigned by CP-SAT.
5. GET /api/vehicle-health API endpoint integration.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.common import DeliveryStatus, Priority, SupplyType
from app.models.delivery import Delivery
from app.models.disruption import DisruptionRequest, DisruptionType
from app.models.vehicle import Location, Vehicle
from app.models.vehicle_health import (
    MaintenanceRisk,
    VehicleHealthResponse,
    VehicleHealthStatus,
)
from app.optimizer.reoptimizer import reoptimizer_service
from app.optimizer.service import optimize_logistics
from app.prediction.vehicle_health_service import vehicle_health_service
from app.simulation.disruption_service import disruption_engine
from app.simulation.world import create_initial_logistics_state, world_state_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_world_state_before_each_test():
    world_state_service.reset_state()
    yield
    world_state_service.reset_state()


class TestVehicleHealthService:
    def test_baseline_vehicle_telemetry_and_health(self):
        """Validates simulated telemetry generation for baseline operational vehicles."""
        state = create_initial_logistics_state()
        report = vehicle_health_service.assess_fleet(state)

        expected_operational = sum(1 for v in state.vehicles.values() if v.is_operational)
        expected_high_risk = sum(1 for v in state.vehicles.values() if not v.is_operational)

        assert report.total_vehicles == len(state.vehicles)
        assert report.operational_count == expected_operational
        assert report.high_risk_count == expected_high_risk
        assert 0.0 <= report.average_health_score <= 100.0

        for status_item in report.vehicles:
            assert status_item.vehicle_id in state.vehicles
            assert status_item.mileage > 0.0
            assert 0.0 <= status_item.utilization <= 1.0
            assert 0.0 <= status_item.health_score <= 100.0
            assert status_item.maintenance_risk in [
                MaintenanceRisk.LOW,
                MaintenanceRisk.MEDIUM,
                MaintenanceRisk.HIGH,
            ]
            expected_v = state.vehicles[status_item.vehicle_id]
            assert status_item.available == expected_v.available
            assert status_item.is_operational == expected_v.is_operational

    def test_vehicle_failure_disruption_impacts_health(self):
        """Simulating a vehicle failure updates its health score and raises maintenance risk to HIGH."""
        state = create_initial_logistics_state()
        v_id = "VEH-01"

        # Pre-disruption status
        pre_status = vehicle_health_service.assess_vehicle(state.vehicles[v_id], state=state)
        assert pre_status.available is True
        assert pre_status.maintenance_risk in [MaintenanceRisk.LOW, MaintenanceRisk.MEDIUM]

        # Apply vehicle failure disruption
        disruption_engine.apply_disruption(
            state,
            DisruptionRequest(type=DisruptionType.VEHICLE_FAILURE, target_id=v_id),
        )

        assert state.vehicles[v_id].available is False
        assert state.vehicles[v_id].is_operational is False

        # Post-disruption status
        post_status = vehicle_health_service.assess_vehicle(state.vehicles[v_id], state=state)
        assert post_status.available is False
        assert post_status.is_operational is False
        assert post_status.maintenance_risk == MaintenanceRisk.HIGH
        assert post_status.health_score < pre_status.health_score
        assert "breakdown" in post_status.recommended_action.lower() or "ground" in post_status.recommended_action.lower()

    def test_failed_vehicle_reoptimization_reassigns_affected_deliveries(self):
        """When a vehicle fails, dynamic re-optimization identifies compromised deliveries and reassigns them."""
        state = create_initial_logistics_state()

        # 1. Run baseline optimization
        baseline_plan = optimize_logistics(state)
        assert len(baseline_plan.deliveries) > 0

        # Pick a vehicle that is assigned in the baseline plan
        target_delivery = baseline_plan.deliveries[0]
        failed_vehicle_id = target_delivery.vehicle_id
        assert failed_vehicle_id in state.vehicles

        # 2. Trigger vehicle failure disruption & dynamic re-optimization
        reopt_result = reoptimizer_service.reoptimize(
            disruption=DisruptionRequest(
                type=DisruptionType.VEHICLE_FAILURE,
                target_id=failed_vehicle_id,
            ),
            state=state,
            previous_plan=baseline_plan,
        )

        # 3. Verify affected deliveries identified
        assert failed_vehicle_id in reopt_result.affected_vehicles
        assert any(d.vehicle_id == failed_vehicle_id for d in reopt_result.affected_deliveries)

        # 4. Verify the new plan does NOT use the failed vehicle
        for new_delivery in reopt_result.new_plan.deliveries:
            assert new_delivery.vehicle_id != failed_vehicle_id

        # 5. Check fleet health reflects the failed vehicle
        fleet_report = vehicle_health_service.assess_fleet(state)
        failed_report = next(v for v in fleet_report.vehicles if v.vehicle_id == failed_vehicle_id)
        assert failed_report.available is False
        assert failed_report.maintenance_risk == MaintenanceRisk.HIGH


class TestApiVehicleHealthEndpoint:
    def test_get_vehicle_health_endpoint(self):
        """GET /api/vehicle-health returns 200 OK with full fleet telemetry and risk distribution."""
        response = client.get("/api/vehicle-health")
        assert response.status_code == 200
        data = response.json()

        validated = VehicleHealthResponse.model_validate(data)
        state = world_state_service.get_state()
        expected_operational = sum(1 for v in state.vehicles.values() if v.is_operational)

        assert validated.total_vehicles == len(state.vehicles)
        assert validated.operational_count == expected_operational
        assert len(validated.vehicles) == validated.total_vehicles

        first_v = validated.vehicles[0]
        assert first_v.mileage > 0.0
        assert 0.0 <= first_v.health_score <= 100.0
        assert first_v.maintenance_risk in [
            MaintenanceRisk.LOW,
            MaintenanceRisk.MEDIUM,
            MaintenanceRisk.HIGH,
        ]

    def test_get_vehicle_health_after_disruption(self):
        """GET /api/vehicle-health reflects live disruptions applied to the world state."""
        # Inject vehicle failure
        client.post(
            "/api/simulation/disruption",
            json={"type": "VEHICLE_FAILURE", "target_id": "VEH-02"},
        )

        response = client.get("/api/vehicle-health")
        assert response.status_code == 200
        data = response.json()

        state = world_state_service.get_state()
        expected_operational = sum(1 for v in state.vehicles.values() if v.is_operational)

        validated = VehicleHealthResponse.model_validate(data)
        assert validated.high_risk_count >= 2
        assert validated.operational_count == expected_operational

        v2 = next((v for v in validated.vehicles if v.vehicle_id == "VEH-02"), None)
        assert v2 is not None
        assert v2.available is False
        assert v2.maintenance_risk == MaintenanceRisk.HIGH

