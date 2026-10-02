"""
prediction/service.py — Deterministic Demand Prediction Service.

Provides transparent, explainable forecasting of near-future supply requirements,
consumption depletion trajectories, shortage timings, and urgency scores.
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional

from app.models.common import Priority, SupplyType
from app.models.demand_point import DemandPoint
from app.models.logistics_state import LogisticsState
from app.models.prediction import (
    DemandPointPrediction,
    PredictionResponse,
    ShortageSeverity,
    SupplyPrediction,
)


def _compute_shortage_severity(
    priority: Priority,
    current_req: float,
    consumption_rate: float,
    predicted_demand: float,
) -> ShortageSeverity:
    """
    Determines the shortage severity classification for a given supply stream.
    """
    if current_req <= 0 and consumption_rate <= 0:
        return ShortageSeverity.NONE

    # Critical priority with active deficit is always CRITICAL
    if priority == Priority.CRITICAL and (current_req > 0 or consumption_rate >= 50.0):
        return ShortageSeverity.CRITICAL

    # Immediate large unmet requirement
    if current_req >= 1000.0 or (current_req > 0 and consumption_rate >= 80.0):
        return ShortageSeverity.CRITICAL

    if priority == Priority.HIGH or current_req >= 400.0 or consumption_rate >= 40.0:
        return ShortageSeverity.HIGH

    if priority == Priority.MEDIUM or current_req > 0 or consumption_rate > 0:
        return ShortageSeverity.MODERATE

    return ShortageSeverity.LOW


def _compute_confidence(current_req: float, consumption_rate: float) -> float:
    """
    Computes deterministic forecast confidence score (0.0 to 1.0).
    """
    if current_req == 0.0 and consumption_rate == 0.0:
        return 1.00
    if consumption_rate > 0.0 and current_req > 0.0:
        return 0.95
    if consumption_rate > 0.0 and current_req == 0.0:
        return 0.92
    return 0.90


def _severity_rank(severity: ShortageSeverity) -> int:
    ranks = {
        ShortageSeverity.CRITICAL: 4,
        ShortageSeverity.HIGH: 3,
        ShortageSeverity.MODERATE: 2,
        ShortageSeverity.LOW: 1,
        ShortageSeverity.NONE: 0,
    }
    return ranks.get(severity, 0)


class DemandPredictionService:
    """
    Prediction service calculating near-future logistics demand
    and shortage trajectories across all demand points.
    """

    def predict(
        self,
        state: LogisticsState,
        horizon_hours: float = 6.0,
    ) -> PredictionResponse:
        """
        Calculates supply predictions for all demand points in the given state.

        Formula:
            predicted_demand = current_requirement + (consumption_rate * horizon_hours)

        Args:
            state: Current LogisticsState snapshot.
            horizon_hours: Lookahead window in hours (default 6.0).

        Returns:
            PredictionResponse: Complete structured forecast.
        """
        now = state.timestamp if state.timestamp is not None else datetime.now(timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        predictions_map: Dict[str, DemandPointPrediction] = {}
        total_predicted_by_supply: Dict[str, float] = {}
        critical_count = 0

        # Base priority multipliers for recommended urgency score
        priority_multipliers = {
            Priority.CRITICAL: 10.0,
            Priority.HIGH: 5.0,
            Priority.MEDIUM: 2.0,
            Priority.LOW: 1.0,
        }

        for dp_id, dp in state.demand_points.items():
            supply_predictions: Dict[str, SupplyPrediction] = {}
            highest_sev = ShortageSeverity.NONE

            # Identify all relevant supply types (union of required_supplies and consumption_rate keys)
            all_supply_keys = set(dp.required_supplies.keys()) | set(dp.consumption_rate.keys())

            dp_total_predicted = 0.0

            for st in all_supply_keys:
                current_req = float(dp.required_supplies.get(st, 0.0))
                burn_rate = float(dp.consumption_rate.get(st, 0.0))

                predicted_qty = round(current_req + (burn_rate * horizon_hours), 2)
                dp_total_predicted += predicted_qty

                # Track global total
                st_key = st.value
                total_predicted_by_supply[st_key] = round(
                    total_predicted_by_supply.get(st_key, 0.0) + predicted_qty, 2
                )

                # Time to shortage estimation
                if current_req > 0:
                    time_to_shortage: Optional[float] = 0.0
                elif burn_rate > 0:
                    time_to_shortage = round(horizon_hours, 2)
                else:
                    time_to_shortage = None

                severity = _compute_shortage_severity(
                    priority=dp.priority,
                    current_req=current_req,
                    consumption_rate=burn_rate,
                    predicted_demand=predicted_qty,
                )

                if _severity_rank(severity) > _severity_rank(highest_sev):
                    highest_sev = severity

                confidence = _compute_confidence(current_req, burn_rate)

                supply_predictions[st.value] = SupplyPrediction(
                    supply_type=st,
                    current_requirement=current_req,
                    consumption_rate=burn_rate,
                    predicted_demand=predicted_qty,
                    estimated_time_to_shortage=time_to_shortage,
                    shortage_severity=severity,
                    prediction_confidence=confidence,
                )

            if highest_sev == ShortageSeverity.CRITICAL:
                critical_count += 1

            # Calculate composite urgency score
            p_mult = priority_multipliers.get(dp.priority, 1.0)
            urgency_score = round(p_mult * (1.0 + (dp_total_predicted / 1000.0)), 2)

            predictions_map[dp_id] = DemandPointPrediction(
                demand_point_id=dp_id,
                priority=dp.priority,
                deadline=dp.deadline,
                time_horizon_hours=float(horizon_hours),
                predictions=supply_predictions,
                highest_severity=highest_sev,
                recommended_urgency_score=urgency_score,
            )

        return PredictionResponse(
            time_horizon_hours=float(horizon_hours),
            generated_at=now,
            total_demand_points=len(state.demand_points),
            predictions=predictions_map,
            critical_shortage_count=critical_count,
            total_predicted_demand=total_predicted_by_supply,
        )


# Singleton prediction service instance
prediction_service = DemandPredictionService()


def predict_demand(
    state: LogisticsState,
    horizon_hours: float = 6.0,
) -> PredictionResponse:
    """Helper function to generate demand forecasts."""
    return prediction_service.predict(state, horizon_hours=horizon_hours)
