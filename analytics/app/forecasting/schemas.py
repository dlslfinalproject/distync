from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field


class InventoryForecastItemInput(BaseModel):
    inventory_item_id: str
    item_name: str
    item_code: Optional[str] = None
    category: Optional[str] = None
    unit_of_measure: Optional[str] = None
    current_available_stock: float = Field(default=0)
    usage_series: List[float] = Field(default_factory=list)


class InventoryForecastRequest(BaseModel):
    model_name: str = "MOVING_AVERAGE"
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
    average_daily_usage: float
    forecasted_usage: float
    projected_depletion_date: Optional[date] = None
    recommended_reorder_quantity: int
    risk_level: str
    selected_model: str
    daily_forecast: float


class InventoryForecastResponse(BaseModel):
    model_name: str
    forecast_horizon_days: int
    lookback_days: int
    results: List[InventoryForecastResult]
