"""
prediction — AI-powered and deterministic demand forecasting, shortage detection, and resupply planning.
"""

from app.prediction.service import (
    DemandPredictionService,
    predict_demand,
    prediction_service,
)
from app.prediction.shortage_service import (
    ShortageDetectionService,
    detect_shortages,
    shortage_service,
)
from app.prediction.vehicle_health_service import (
    VehicleHealthPredictionService,
    vehicle_health_service,
)

__all__ = [
    "DemandPredictionService",
    "prediction_service",
    "predict_demand",
    "ShortageDetectionService",
    "shortage_service",
    "detect_shortages",
    "VehicleHealthPredictionService",
    "vehicle_health_service",
]
