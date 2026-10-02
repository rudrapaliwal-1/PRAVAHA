"""
tests/test_shortage.py — Unit and integration tests for Shortage Detection Service.

Scenarios tested:
1. No shortage (ample on-hand stock or zero consumption)
2. Future shortage (e.g., Medical available = 400, consumption = 100/hr -> 4 hours to shortage)
3. Immediate shortage (imminent depletion in <= 2 hours)
4. Zero inventory (on-hand = 0 -> time to shortage = 0.0, critical severity)
5. Urgency sorting verification
6. GET /api/shortages endpoint integration & query validation
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.models.common import Priority, SupplyType
from app.models.demand_point import DemandPoint
from app.models.logistics_state import LogisticsState
from app.models.prediction import ShortageSeverity
from app.models.shortage import ShortageItem, ShortageResponse
from app.models.vehicle import Location
from app.prediction.shortage_service import detect_shortages, shortage_service

client = TestClient(app)


class TestShortageDetectionScenarios:
    def test_no_shortage(self):
        """When available inventory easily covers the horizon, severity is NONE or LOW and predicted shortage is 0."""
        loc = Location(lat=30.55, lon=78.4)
        dp = DemandPoint(
            id="DP-AMPLE",
            location=loc,
            priority=Priority.LOW,
            current_inventory={SupplyType.FOOD: 1000.0},
            consumption_rate={SupplyType.FOOD: 10.0}, # Depletion in 100 hours
            required_supplies={SupplyType.FOOD: 0.0},
        )
        state = LogisticsState(demand_points={dp.id: dp})
        response = detect_shortages(state, horizon_hours=12.0)

        assert response.total_shortages_detected == 1
        item = response.shortages[0]
        assert item.current_available == 1000.0
        assert item.consumption_rate == 10.0
        assert item.time_to_shortage == 100.0
        assert item.predicted_shortage == 0.0
        assert item.severity == ShortageSeverity.LOW

    def test_future_shortage_example_case(self):
        """
        Prompt's exact specification:
        Medical: Available = 400, Consumption = 100/hour -> Time to shortage = 4 hours.
        """
        loc = Location(lat=30.55, lon=78.4)
        dp = DemandPoint(
            id="DP-HOSPITAL",
            location=loc,
            priority=Priority.HIGH,
            current_inventory={SupplyType.MEDICINE: 400.0},
            consumption_rate={SupplyType.MEDICINE: 100.0},
            required_supplies={SupplyType.MEDICINE: 0.0},
        )
        state = LogisticsState(demand_points={dp.id: dp})
        response = detect_shortages(state, horizon_hours=12.0)

        assert response.total_shortages_detected == 1
        item = response.shortages[0]
        assert item.supply_type == SupplyType.MEDICINE
        assert item.current_available == 400.0
        assert item.consumption_rate == 100.0
        assert item.time_to_shortage == 4.0
        # Over 12 hours: total burn = 1200, available = 400 -> shortfall = 800
        assert item.predicted_shortage == 800.0
        assert item.recommended_resupply_quantity == 800.0
        assert item.severity == ShortageSeverity.HIGH

    def test_immediate_shortage(self):
        """When depletion occurs in <= 2 hours, severity is CRITICAL."""
        loc = Location(lat=30.55, lon=78.4)
        dp = DemandPoint(
            id="DP-URGENT",
            location=loc,
            priority=Priority.CRITICAL,
            current_inventory={SupplyType.WATER: 50.0},
            consumption_rate={SupplyType.WATER: 100.0}, # Depletion in 0.5 hours
            required_supplies={SupplyType.WATER: 0.0},
        )
        state = LogisticsState(demand_points={dp.id: dp})
        response = detect_shortages(state, horizon_hours=6.0)

        assert response.total_shortages_detected == 1
        item = response.shortages[0]
        assert item.time_to_shortage == 0.5
        assert item.severity == ShortageSeverity.CRITICAL
        assert item.predicted_shortage == 550.0 # (100 * 6) - 50 = 550
        assert item.recommended_resupply_quantity == 550.0

    def test_zero_inventory(self):
        """When available inventory is 0 and consumption or requirement exists, shortage is immediate (time = 0.0, CRITICAL)."""
        loc = Location(lat=30.55, lon=78.4)
        dp = DemandPoint(
            id="DP-DEPLETED",
            location=loc,
            priority=Priority.HIGH,
            current_inventory={SupplyType.FUEL: 0.0},
            consumption_rate={SupplyType.FUEL: 50.0},
            required_supplies={SupplyType.FUEL: 200.0},
        )
        state = LogisticsState(demand_points={dp.id: dp})
        response = detect_shortages(state, horizon_hours=10.0)

        assert response.total_shortages_detected == 1
        item = response.shortages[0]
        assert item.current_available == 0.0
        assert item.time_to_shortage == 0.0
        assert item.severity == ShortageSeverity.CRITICAL
        # Deficit = 200 + (50 * 10) = 700
        assert item.predicted_shortage == 700.0
        assert item.recommended_resupply_quantity == 700.0

    def test_shortages_sorted_by_urgency(self):
        """Results must be ordered by urgency (immediate/critical shortages first)."""
        loc = Location(lat=30.55, lon=78.4)
        # 1. Zero stock immediate shortage
        dp_crit = DemandPoint(
            id="DP-CRIT",
            location=loc,
            priority=Priority.CRITICAL,
            current_inventory={SupplyType.MEDICINE: 0.0},
            consumption_rate={SupplyType.MEDICINE: 50.0},
        )
        # 2. Future 4h shortage
        dp_high = DemandPoint(
            id="DP-HIGH",
            location=loc,
            priority=Priority.HIGH,
            current_inventory={SupplyType.WATER: 400.0},
            consumption_rate={SupplyType.WATER: 100.0},
        )
        # 3. Far 50h shortage
        dp_low = DemandPoint(
            id="DP-LOW",
            location=loc,
            priority=Priority.LOW,
            current_inventory={SupplyType.FOOD: 1000.0},
            consumption_rate={SupplyType.FOOD: 20.0},
        )
        state = LogisticsState(demand_points={dp.id: dp for dp in [dp_low, dp_crit, dp_high]})
        response = detect_shortages(state, horizon_hours=12.0)

        assert response.total_shortages_detected == 3
        # First must be DP-CRIT
        assert response.shortages[0].demand_point_id == "DP-CRIT"
        assert response.shortages[0].severity == ShortageSeverity.CRITICAL

        # Second must be DP-HIGH
        assert response.shortages[1].demand_point_id == "DP-HIGH"
        assert response.shortages[1].severity == ShortageSeverity.HIGH

        # Third must be DP-LOW
        assert response.shortages[2].demand_point_id == "DP-LOW"
        assert response.shortages[2].severity == ShortageSeverity.LOW


class TestApiShortagesEndpoint:
    def test_get_shortages_default(self):
        """GET /api/shortages returns 200 OK and conforms to ShortageResponse schema."""
        response = client.get("/api/shortages")
        assert response.status_code == 200
        data = response.json()

        validated = ShortageResponse.model_validate(data)
        assert validated.horizon_hours == 12.0
        assert validated.total_shortages_detected > 0
        assert len(validated.shortages) == validated.total_shortages_detected
        assert all(item.recommended_resupply_quantity >= 0 for item in validated.shortages)

    def test_get_shortages_custom_horizon(self):
        """GET /api/shortages?horizon_hours=24.0 calculates deficits over 24 hours."""
        response = client.get("/api/shortages?horizon_hours=24.0")
        assert response.status_code == 200
        data = response.json()

        validated = ShortageResponse.model_validate(data)
        assert validated.horizon_hours == 24.0

    def test_get_shortages_invalid_horizon_rejected(self):
        """GET /api/shortages with negative horizon returns 422."""
        response = client.get("/api/shortages?horizon_hours=-5.0")
        assert response.status_code == 422
