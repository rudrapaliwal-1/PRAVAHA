"""
tests/test_prediction.py — Unit and integration tests for the Demand Prediction Service.

Tests:
1. Deterministic prediction formula: current + (consumption_rate * horizon)
2. Variable time horizon scaling (6h, 12h, 24h)
3. Estimated time to shortage computation
4. Shortage severity ranking (CRITICAL, HIGH, MODERATE, LOW, NONE)
5. Prediction confidence scoring
6. Complete simulation world prediction analysis
7. GET /api/predictions API endpoint integration
8. GET /api/predictions query parameter customization
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.models.common import Priority, SupplyType
from app.models.demand_point import DemandPoint
from app.models.logistics_state import LogisticsState
from app.models.prediction import (
    DemandPointPrediction,
    PredictionResponse,
    ShortageSeverity,
    SupplyPrediction,
)
from app.models.vehicle import Location
from app.prediction.service import predict_demand, prediction_service
from app.simulation.world import create_initial_logistics_state

client = TestClient(app)


class TestDemandPredictionService:
    def test_deterministic_forecast_formula(self):
        """Validates predicted_demand = current_requirement + (consumption_rate * horizon)."""
        loc = Location(lat=30.55, lon=78.4)
        dp = DemandPoint(
            id="DP-TEST-01",
            location=loc,
            priority=Priority.HIGH,
            required_supplies={SupplyType.WATER: 1000.0, SupplyType.FOOD: 500.0},
            consumption_rate={SupplyType.WATER: 100.0, SupplyType.FOOD: 50.0},
        )
        state = LogisticsState(demand_points={dp.id: dp})

        result = predict_demand(state, horizon_hours=6.0)

        assert result.total_demand_points == 1
        dp_pred = result.predictions["DP-TEST-01"]
        assert dp_pred.time_horizon_hours == 6.0

        # Water: 1000 + (100 * 6) = 1600.0
        water_pred = dp_pred.predictions[SupplyType.WATER.value]
        assert water_pred.current_requirement == 1000.0
        assert water_pred.consumption_rate == 100.0
        assert water_pred.predicted_demand == 1600.0

        # Food: 500 + (50 * 6) = 800.0
        food_pred = dp_pred.predictions[SupplyType.FOOD.value]
        assert food_pred.current_requirement == 500.0
        assert food_pred.consumption_rate == 50.0
        assert food_pred.predicted_demand == 800.0

    def test_variable_time_horizon_scaling(self):
        """Verifies linear scaling across different horizon lengths (6h, 12h, 24h)."""
        loc = Location(lat=30.55, lon=78.4)
        dp = DemandPoint(
            id="DP-SCALE",
            location=loc,
            priority=Priority.MEDIUM,
            required_supplies={SupplyType.MEDICINE: 200.0},
            consumption_rate={SupplyType.MEDICINE: 20.0},
        )
        state = LogisticsState(demand_points={dp.id: dp})

        pred_6h = predict_demand(state, horizon_hours=6.0)
        pred_12h = predict_demand(state, horizon_hours=12.0)
        pred_24h = predict_demand(state, horizon_hours=24.0)

        med_6h = pred_6h.predictions["DP-SCALE"].predictions[SupplyType.MEDICINE.value]
        med_12h = pred_12h.predictions["DP-SCALE"].predictions[SupplyType.MEDICINE.value]
        med_24h = pred_24h.predictions["DP-SCALE"].predictions[SupplyType.MEDICINE.value]

        assert med_6h.predicted_demand == 200.0 + (20.0 * 6)   # 320.0
        assert med_12h.predicted_demand == 200.0 + (20.0 * 12) # 440.0
        assert med_24h.predicted_demand == 200.0 + (20.0 * 24) # 680.0

    def test_estimated_time_to_shortage_calculation(self):
        """
        - Active unmet requirement (>0) -> time to shortage is 0.0 (already in shortage).
        - Zero unmet requirement with positive burn rate -> time to shortage equals horizon window.
        - Zero unmet requirement and zero burn rate -> time to shortage is None.
        """
        loc = Location(lat=30.55, lon=78.4)
        dp = DemandPoint(
            id="DP-SHORTAGE",
            location=loc,
            priority=Priority.CRITICAL,
            required_supplies={
                SupplyType.MEDICINE: 500.0,
                SupplyType.WATER: 0.0,
                SupplyType.EQUIPMENT: 0.0,
            },
            consumption_rate={
                SupplyType.MEDICINE: 50.0,
                SupplyType.WATER: 120.0,
                SupplyType.EQUIPMENT: 0.0,
            },
        )
        state = LogisticsState(demand_points={dp.id: dp})
        result = predict_demand(state, horizon_hours=8.0)

        dp_pred = result.predictions["DP-SHORTAGE"]

        # Medicine has active requirement -> shortage immediate (0.0)
        assert dp_pred.predictions[SupplyType.MEDICINE.value].estimated_time_to_shortage == 0.0

        # Water has 0 requirement but active burn rate -> shortage within horizon (8.0)
        assert dp_pred.predictions[SupplyType.WATER.value].estimated_time_to_shortage == 8.0

        # Equipment has 0 requirement and 0 burn rate -> no shortage (None)
        assert dp_pred.predictions[SupplyType.EQUIPMENT.value].estimated_time_to_shortage is None

    def test_shortage_severity_ranking(self):
        """Verifies correct shortage severity classifications."""
        loc = Location(lat=30.55, lon=78.4)
        dp_crit = DemandPoint(
            id="DP-CRITICAL-SEV",
            location=loc,
            priority=Priority.CRITICAL,
            required_supplies={SupplyType.MEDICINE: 800.0},
            consumption_rate={SupplyType.MEDICINE: 60.0},
        )
        dp_low = DemandPoint(
            id="DP-LOW-SEV",
            location=loc,
            priority=Priority.LOW,
            required_supplies={SupplyType.WATER: 0.0},
            consumption_rate={SupplyType.WATER: 0.0},
        )
        state = LogisticsState(demand_points={dp_crit.id: dp_crit, dp_low.id: dp_low})
        result = predict_demand(state, horizon_hours=6.0)

        assert result.predictions["DP-CRITICAL-SEV"].highest_severity == ShortageSeverity.CRITICAL
        assert result.predictions["DP-CRITICAL-SEV"].predictions[SupplyType.MEDICINE.value].shortage_severity == ShortageSeverity.CRITICAL

        assert result.predictions["DP-LOW-SEV"].highest_severity == ShortageSeverity.NONE
        assert result.predictions["DP-LOW-SEV"].predictions[SupplyType.WATER.value].shortage_severity == ShortageSeverity.NONE
        assert result.critical_shortage_count == 1

    def test_prediction_confidence_metrics(self):
        """Confidence score must be between 0.0 and 1.0."""
        loc = Location(lat=30.55, lon=78.4)
        dp = DemandPoint(
            id="DP-CONF",
            location=loc,
            priority=Priority.MEDIUM,
            required_supplies={SupplyType.FOOD: 300.0},
            consumption_rate={SupplyType.FOOD: 30.0},
        )
        state = LogisticsState(demand_points={dp.id: dp})
        result = predict_demand(state, horizon_hours=6.0)

        conf = result.predictions["DP-CONF"].predictions[SupplyType.FOOD.value].prediction_confidence
        assert 0.0 <= conf <= 1.0
        assert conf == 0.95

    def test_simulation_world_predictions(self):
        """Verifies predictions generated over the standard 6-demand point simulation world."""
        state = create_initial_logistics_state()
        result = predict_demand(state, horizon_hours=6.0)

        assert result.total_demand_points == 6
        assert len(result.predictions) == 6
        assert result.critical_shortage_count >= 1
        assert "water" in result.total_predicted_demand
        assert "medicine" in result.total_predicted_demand
        assert "food" in result.total_predicted_demand
        assert "fuel" in result.total_predicted_demand
        assert "equipment" in result.total_predicted_demand
        assert all(total > 0 for total in result.total_predicted_demand.values())


class TestApiPredictionsEndpoint:
    def test_get_predictions_default(self):
        """GET /api/predictions returns 200 OK with valid PredictionResponse schema."""
        response = client.get("/api/predictions")
        assert response.status_code == 200
        data = response.json()

        validated = PredictionResponse.model_validate(data)
        assert validated.time_horizon_hours == 6.0
        assert validated.total_demand_points == 6
        assert len(validated.predictions) == 6
        assert validated.critical_shortage_count >= 1
        assert len(validated.total_predicted_demand) > 0

    def test_get_predictions_custom_horizon(self):
        """GET /api/predictions?horizon_hours=12.0 returns forecasts with 12h horizon."""
        response = client.get("/api/predictions?horizon_hours=12.0")
        assert response.status_code == 200
        data = response.json()

        validated = PredictionResponse.model_validate(data)
        assert validated.time_horizon_hours == 12.0

        # Compare 6h vs 12h total water demand
        response_6h = client.get("/api/predictions?horizon_hours=6.0")
        data_6h = response_6h.json()
        assert data["total_predicted_demand"]["water"] > data_6h["total_predicted_demand"]["water"]

    def test_get_predictions_invalid_horizon_rejected(self):
        """GET /api/predictions with negative or zero horizon returns 422 Unprocessable Entity."""
        response = client.get("/api/predictions?horizon_hours=-1.0")
        assert response.status_code == 422

        response_zero = client.get("/api/predictions?horizon_hours=0.0")
        assert response_zero.status_code == 422
