"""
prediction/shortage_service.py — Supply Shortage Detection and Resupply Recommendation.

Evaluates demand locations against on-hand inventories, burn rates, and forecast horizons
to compute time to depletion, predicted shortfalls, severity classifications, and urgency rankings.
"""

from datetime import datetime, timezone
from typing import List, Optional

from app.models.common import Priority, SupplyType
from app.models.demand_point import DemandPoint
from app.models.logistics_state import LogisticsState
from app.models.prediction import ShortageSeverity
from app.models.shortage import ShortageItem, ShortageResponse


def _compute_shortage_severity_level(
    time_to_shortage: Optional[float],
    predicted_shortage: float,
    current_available: float,
    priority: Priority,
) -> ShortageSeverity:
    """
    Classifies shortage severity into CRITICAL, HIGH, MEDIUM, LOW, or NONE.
    """
    if time_to_shortage is None and predicted_shortage <= 0.0 and current_available > 0.0:
        return ShortageSeverity.NONE

    # Immediate or zero inventory with active consumption or requirement
    if time_to_shortage is not None and time_to_shortage == 0.0:
        return ShortageSeverity.CRITICAL

    # Imminent depletion in <= 2 hours
    if time_to_shortage is not None and time_to_shortage <= 2.0:
        return ShortageSeverity.CRITICAL

    # High depletion urgency (2h to 6h)
    if time_to_shortage is not None and time_to_shortage <= 6.0:
        return ShortageSeverity.HIGH

    # Moderate depletion urgency (6h to 12h)
    if time_to_shortage is not None and time_to_shortage <= 12.0:
        return ShortageSeverity.MEDIUM

    # Minor or far-horizon shortage (>12h)
    if time_to_shortage is not None and time_to_shortage > 12.0:
        return ShortageSeverity.LOW

    if predicted_shortage > 0.0:
        return ShortageSeverity.LOW

    return ShortageSeverity.NONE


def _severity_rank(sev: ShortageSeverity) -> int:
    ranks = {
        ShortageSeverity.CRITICAL: 4,
        ShortageSeverity.HIGH: 3,
        ShortageSeverity.MODERATE: 2,
        ShortageSeverity.MEDIUM: 2,
        ShortageSeverity.LOW: 1,
        ShortageSeverity.NONE: 0,
    }
    return ranks.get(sev, 0)


def _priority_rank(p: Priority) -> int:
    ranks = {
        Priority.CRITICAL: 4,
        Priority.HIGH: 3,
        Priority.MEDIUM: 2,
        Priority.LOW: 1,
    }
    return ranks.get(p, 2)


class ShortageDetectionService:
    """
    Shortage analysis engine calculating inventory exhaustion timelines,
    resupply requirements, and prioritized shortage notifications.
    """

    def detect_shortages(
        self,
        state: LogisticsState,
        horizon_hours: float = 12.0,
    ) -> ShortageResponse:
        """
        Scans all demand points in the logistics state and computes shortage metrics.

        Args:
            state: Current LogisticsState snapshot.
            horizon_hours: Lookahead analysis window in hours (default: 12.0).

        Returns:
            ShortageResponse: Collection of shortages sorted by urgency.
        """
        now = state.timestamp if state.timestamp is not None else datetime.now(timezone.utc)
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        shortages: List[ShortageItem] = []

        for dp_id, dp in state.demand_points.items():
            # Combine all referenced supply types
            all_supplies = (
                set(dp.current_inventory.keys())
                | set(dp.required_supplies.keys())
                | set(dp.consumption_rate.keys())
            )

            for st in all_supplies:
                available = float(dp.current_inventory.get(st, 0.0))
                rate = float(dp.consumption_rate.get(st, 0.0))
                req = float(dp.required_supplies.get(st, 0.0))

                # 1. Time to shortage calculation
                if rate > 0.0:
                    time_to_shortage: Optional[float] = round(available / rate, 2)
                else:
                    if available == 0.0 and req > 0.0:
                        time_to_shortage = 0.0
                    else:
                        time_to_shortage = None

                if available == 0.0 and (rate > 0.0 or req > 0.0):
                    time_to_shortage = 0.0

                # 2. Predicted shortage over horizon
                projected_consumption = rate * horizon_hours
                shortfall = max(0.0, (projected_consumption + req) - available)
                predicted_shortage = round(shortfall, 2)

                # 3. Recommended resupply quantity
                recommended_resupply = round(max(req, shortfall), 2)

                # 4. Severity level
                severity = _compute_shortage_severity_level(
                    time_to_shortage=time_to_shortage,
                    predicted_shortage=predicted_shortage,
                    current_available=available,
                    priority=dp.priority,
                )

                # 5. Calculate composite urgency score
                sev_weight = _severity_rank(severity) * 1000
                p_weight = _priority_rank(dp.priority) * 100
                time_weight = 0.0
                if time_to_shortage is not None:
                    time_weight = max(0.0, 500.0 - (time_to_shortage * 20.0))

                resupply_weight = min(50.0, recommended_resupply / 100.0)
                urgency_score = round(sev_weight + p_weight + time_weight + resupply_weight, 2)

                shortages.append(
                    ShortageItem(
                        demand_point_id=dp_id,
                        supply_type=st,
                        current_available=available,
                        consumption_rate=rate,
                        time_to_shortage=time_to_shortage,
                        predicted_shortage=predicted_shortage,
                        severity=severity,
                        recommended_resupply_quantity=recommended_resupply,
                        priority=dp.priority,
                        deadline=dp.deadline,
                        urgency_score=urgency_score,
                    )
                )

        # Sort shortages by urgency (urgency_score descending, time_to_shortage ascending)
        shortages.sort(
            key=lambda item: (
                -item.urgency_score,
                item.time_to_shortage if item.time_to_shortage is not None else 999999.0,
                -item.recommended_resupply_quantity,
            )
        )

        critical_count = sum(1 for s in shortages if s.severity == ShortageSeverity.CRITICAL)
        high_count = sum(1 for s in shortages if s.severity == ShortageSeverity.HIGH)

        return ShortageResponse(
            generated_at=now,
            horizon_hours=float(horizon_hours),
            total_shortages_detected=len(shortages),
            critical_shortages_count=critical_count,
            high_shortages_count=high_count,
            shortages=shortages,
        )


# Singleton shortage service instance
shortage_service = ShortageDetectionService()


def detect_shortages(
    state: LogisticsState,
    horizon_hours: float = 12.0,
) -> ShortageResponse:
    """Helper function to evaluate logistics state shortages."""
    return shortage_service.detect_shortages(state, horizon_hours=horizon_hours)
