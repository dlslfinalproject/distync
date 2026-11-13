from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


ForecastModelName = Literal[
    "MOVING_AVERAGE",
    "EXPONENTIAL_SMOOTHING",
    "TREND_PROJECTION",
]
ForecastSelectionMode = Literal["FIXED_MODEL", "AUTO_BACKTEST"]


class StatisticalForecast(BaseModel):
    model_name: ForecastModelName
    daily_forecast: float
    forecasted_usage: float


class ForecastCandidateEvaluation(BaseModel):
    model_name: ForecastModelName
    status: Literal["EVALUATED", "NOT_EVALUATED", "UNAVAILABLE"]
    mae: Optional[float] = None
    rmse: Optional[float] = None
    backtest_point_count: int = Field(default=0, ge=0)
    current_forecast: Optional[StatisticalForecast] = None
    failure_reason: Optional[str] = None


class InventoryForecastItemInput(BaseModel):
    inventory_item_id: str
    item_name: str
    item_code: Optional[str] = None
    category: Optional[str] = None
    unit_of_measure: Optional[str] = None
    current_available_stock: float = Field(default=0)
    reorder_level: float = Field(default=0)
    usage_series: List[float] = Field(default_factory=list)


class InventoryForecastRequest(BaseModel):
    model_name: str = "MOVING_AVERAGE"
    selection_mode: ForecastSelectionMode = "FIXED_MODEL"
    forecast_horizon_days: int = Field(default=14, ge=1, le=90)
    lookback_days: int = Field(default=30, ge=1, le=365)
    moving_average_window: int = Field(default=7, ge=1, le=90)
    exponential_smoothing_alpha: float = Field(default=0.4, gt=0, lt=1)
    items: List[InventoryForecastItemInput] = Field(default_factory=list)


class InventoryForecastResult(BaseModel):
    inventory_item_id: str
    item_name: str
    item_code: Optional[str] = None
    category: Optional[str] = None
    unit_of_measure: Optional[str] = None
    current_available_stock: float
    reorder_level: float
    average_daily_usage: float
    forecasted_usage: float
    projected_depletion_date: Optional[date] = None
    recommended_reorder_quantity: int
    risk_level: str
    selected_model: str
    daily_forecast: float
    recommended_model: Optional[ForecastModelName] = None
    recommendation_status: Optional[str] = None
    recommendation_reason: Optional[str] = None
    selection_reason: Optional[str] = None
    evaluation_status: Optional[str] = None
    evaluation_method: Optional[str] = None
    initial_training_points: Optional[int] = None
    available_observations: Optional[int] = None
    backtest_points: Optional[int] = None
    candidate_evaluations: Optional[List[ForecastCandidateEvaluation]] = None
    raw_statistical_forecast: Optional[StatisticalForecast] = None


class InventoryForecastResponse(BaseModel):
    model_name: str
    forecast_horizon_days: int
    lookback_days: int
    results: List[InventoryForecastResult]
