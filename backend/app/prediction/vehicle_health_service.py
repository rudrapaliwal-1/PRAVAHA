"""
prediction/vehicle_health_service.py — Vehicle Health & Maintenance Prediction Service.

Provides simulated vehicle telemetry (mileage, utilization, health score) and
predicts maintenance risk (LOW, MEDIUM, HIGH) without heavy ML dependencies.
"""

import hashlib
from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.models.logistics_state import LogisticsState
from app.models.vehicle import Vehicle
from app.models.vehicle_health import (
    MaintenanceRisk,
    VehicleHealthResponse,
    VehicleHealthStatus,
)


class VehicleHealthPredictionService:
    """
    Simulates operational vehicle telemetry and evaluates predictive maintenance risk.
    """

    def _deterministic_base_mileage(self, vehicle_id: str) -> float:
        """Derives stable, deterministic base mileage from vehicle ID hash."""
        digest = hashlib.md5(vehicle_id.encode("utf-8")).hexdigest()
        raw_int = int(digest[:6], 16)
        # Yields a stable baseline mileage between 800.0 km and 4500.0 km
        return round(800.0 + (raw_int % 3700) + ((raw_int % 100) / 10.0), 1)

    def assess_vehicle(
        self,
        vehicle: Vehicle,
        state: Optional[LogisticsState] = None,
    ) -> VehicleHealthStatus:
        """
        Assesses health metrics and maintenance risk for an individual vehicle.

        Args:
            vehicle: Vehicle instance to assess.
            state: Optional LogisticsState snapshot for active delivery context.

        Returns:
            VehicleHealthStatus: Telemetry, health score (0-100), and risk categorization.
        """
        base_mileage = self._deterministic_base_mileage(vehicle.id)

        # Calculate active delivery load and distance if state is provided
        active_load = 0.0
        active_distance = 0.0
        if state is not None and state.deliveries:
            for d in state.deliveries:
                if d.vehicle_id == vehicle.id and d.is_active:
                    active_load += d.quantity
                    # Lookup route distance if available
                    if d.route_id and d.route_id in state.routes:
                        active_distance += state.routes[d.route_id].distance

        total_mileage = round(base_mileage + active_distance, 1)
        utilization = round(min(1.0, active_load / vehicle.capacity) if vehicle.capacity > 0 else 0.0, 2)

        # ---------------------------------------------------------------------
        # Evaluation Logic
        # ---------------------------------------------------------------------
        if not vehicle.available or not vehicle.is_operational or vehicle.fuel_level <= 0.0:
            # Breakdown / offline state
            health_score = 15.0 if vehicle.fuel_level > 0.0 else 5.0
            maintenance_risk = MaintenanceRisk.HIGH
            recommended_action = (
                "Critical breakdown / Vehicle offline. Ground vehicle immediately for overhaul."
                if not vehicle.available
                else "Fuel depleted. Refuel and conduct mechanical inspection."
            )
        else:
            # Operational vehicle health calculation
            mileage_penalty = (total_mileage / 5000.0) * 15.0
            fuel_penalty = (1.0 - (vehicle.fuel_level / 100.0)) * 10.0
            utilization_penalty = utilization * 10.0

            raw_health = 100.0 - mileage_penalty - fuel_penalty - utilization_penalty
            health_score = round(max(0.0, min(100.0, raw_health)), 1)

            if health_score >= 80.0:
                maintenance_risk = MaintenanceRisk.LOW
                recommended_action = "Vehicle nominal. Ready for high-priority missions."
            elif health_score >= 50.0:
                maintenance_risk = MaintenanceRisk.MEDIUM
                recommended_action = "Routine servicing suggested before severe-hazard transit."
            else:
                maintenance_risk = MaintenanceRisk.HIGH
                recommended_action = "High maintenance risk. Schedule preventive depot maintenance."

        return VehicleHealthStatus(
            vehicle_id=vehicle.id,
            mileage=total_mileage,
            utilization=utilization,
            health_score=health_score,
            maintenance_risk=maintenance_risk,
            available=vehicle.available,
            is_operational=vehicle.is_operational,
            fuel_level=vehicle.fuel_level,
            recommended_action=recommended_action,
        )

    def assess_fleet(
        self,
        state: LogisticsState,
    ) -> VehicleHealthResponse:
        """
        Assesses telemetry and maintenance risk across all vehicles in the logistics fleet.

        Args:
            state: LogisticsState containing vehicle fleet and active deliveries.

        Returns:
            VehicleHealthResponse: Aggregated health report and per-vehicle telemetry.
        """
        assessments: List[VehicleHealthStatus] = []
        for vehicle in state.vehicles.values():
            assessments.append(self.assess_vehicle(vehicle, state=state))

        # Sort assessments by health_score ascending (most critical / lowest health first)
        assessments.sort(key=lambda item: item.health_score)

        total_vehicles = len(assessments)
        operational_count = sum(1 for a in assessments if a.is_operational)
        high_risk_count = sum(1 for a in assessments if a.maintenance_risk == MaintenanceRisk.HIGH)
        avg_health = (
            round(sum(a.health_score for a in assessments) / total_vehicles, 1)
            if total_vehicles > 0
            else 100.0
        )

        return VehicleHealthResponse(
            vehicles=assessments,
            total_vehicles=total_vehicles,
            operational_count=operational_count,
            high_risk_count=high_risk_count,
            average_health_score=avg_health,
            timestamp=datetime.now(timezone.utc),
        )


# Singleton vehicle health prediction service instance
vehicle_health_service = VehicleHealthPredictionService()
