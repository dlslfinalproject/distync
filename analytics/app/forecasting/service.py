from datetime import date, timedelta
from math import ceil
from typing import Iterable, List, Tuple

from .schemas import InventoryForecastItemInput, InventoryForecastResult


FORECAST_MODELS = {
    "MOVING_AVERAGE",
    "EXPONENTIAL_SMOOTHING",
    "TREND_PROJECTION",
}


def _round_two(value: float) -> float:
    return round(float(value or 0), 2)


def _normalize_series(values: Iterable[float], target_length: int) -> List[float]:
    normalized = [max(0.0, float(value or 0)) for value in values]

    if len(normalized) >= target_length:
        return normalized[-target_length:]

    return [0.0] * (target_length - len(normalized)) + normalized


def _average_daily_usage(series: List[float]) -> float:
    if not series:
        return 0.0

    return sum(series) / len(series)


def _moving_average(
    series: List[float],
    window: int,
    horizon_days: int,
) -> Tuple[float, float]:
    sample = series[-window:] if window > 0 else series

    if not sample:
        return 0.0, 0.0

    daily_forecast = sum(sample) / len(sample)
    return daily_forecast, daily_forecast * horizon_days


def _exponential_smoothing(
    series: List[float],
    alpha: float,
    horizon_days: int,
) -> Tuple[float, float]:
    if not series:
        return 0.0, 0.0

    smoothed_value = series[0]

    for observation in series[1:]:
        smoothed_value = alpha * observation + (1 - alpha) * smoothed_value

    return smoothed_value, smoothed_value * horizon_days


def _trend_projection(series: List[float], horizon_days: int) -> Tuple[float, float]:
    sample_size = len(series)

    if sample_size == 0:
        return 0.0, 0.0

    x_values = list(range(1, sample_size + 1))
    y_values = [float(value or 0) for value in series]

    sum_x = sum(x_values)
    sum_y = sum(y_values)
    sum_xy = sum(x * y for x, y in zip(x_values, y_values))
    sum_xx = sum(x * x for x in x_values)

    denominator = sample_size * sum_xx - sum_x * sum_x
    slope = (
        0.0
        if denominator == 0
        else (sample_size * sum_xy - sum_x * sum_y) / denominator
    )
    intercept = (sum_y - slope * sum_x) / sample_size

    future_values = [
        max(0.0, intercept + slope * (sample_size + index + 1))
        for index in range(horizon_days)
    ]
    forecasted_usage = sum(future_values)
    daily_forecast = forecasted_usage / horizon_days if horizon_days else 0.0

    return daily_forecast, forecasted_usage


def _calculate_projected_depletion_date(
    current_stock: float,
    daily_forecast: float,
) -> date | None:
    if current_stock <= 0:
        return date.today()

    if daily_forecast <= 0:
        return None

    days_until_depletion = ceil(current_stock / daily_forecast)
    return date.today() + timedelta(days=days_until_depletion)


def _calculate_recommended_reorder_quantity(
    current_stock: float,
    forecasted_usage: float,
) -> int:
    shortfall = max(0.0, forecasted_usage - current_stock)
    return ceil(shortfall)


def _calculate_risk_level(current_stock: float, daily_forecast: float) -> str:
    if current_stock <= 0:
        return "CRITICAL"

    if daily_forecast <= 0:
        return "LOW"

    days_remaining = current_stock / daily_forecast

    if days_remaining <= 7:
        return "CRITICAL"
    if days_remaining <= 14:
        return "HIGH"
    if days_remaining <= 30:
        return "MEDIUM"

    return "LOW"


def _get_forecast_values(
    model_name: str,
    series: List[float],
    horizon_days: int,
    moving_average_window: int,
    exponential_smoothing_alpha: float,
) -> Tuple[float, float]:
    if model_name == "EXPONENTIAL_SMOOTHING":
        return _exponential_smoothing(series, exponential_smoothing_alpha, horizon_days)

    if model_name == "TREND_PROJECTION":
        return _trend_projection(series, horizon_days)

    return _moving_average(series, moving_average_window, horizon_days)


def run_inventory_forecast(
    *,
    items: List[InventoryForecastItemInput],
    model_name: str,
    forecast_horizon_days: int,
    lookback_days: int,
    moving_average_window: int,
    exponential_smoothing_alpha: float,
) -> List[InventoryForecastResult]:
    if model_name not in FORECAST_MODELS:
        raise ValueError(
            "model_name must be one of: MOVING_AVERAGE, EXPONENTIAL_SMOOTHING, TREND_PROJECTION"
        )

    results: List[InventoryForecastResult] = []

    for item in items:
        normalized_series = _normalize_series(item.usage_series, lookback_days)
        current_stock = max(0.0, float(item.current_available_stock or 0))
        average_daily_usage = _average_daily_usage(normalized_series)
        daily_forecast, forecasted_usage = _get_forecast_values(
            model_name,
            normalized_series,
            forecast_horizon_days,
            moving_average_window,
            exponential_smoothing_alpha,
        )
        projected_depletion_date = _calculate_projected_depletion_date(
            current_stock,
            daily_forecast,
        )
        recommended_reorder_quantity = _calculate_recommended_reorder_quantity(
            current_stock,
            forecasted_usage,
        )
        risk_level = _calculate_risk_level(current_stock, daily_forecast)

        results.append(
            InventoryForecastResult(
                inventory_item_id=item.inventory_item_id,
                item_name=item.item_name,
                item_code=item.item_code,
                category=item.category,
                unit_of_measure=item.unit_of_measure,
                current_available_stock=_round_two(current_stock),
                average_daily_usage=_round_two(average_daily_usage),
                forecasted_usage=_round_two(forecasted_usage),
                projected_depletion_date=projected_depletion_date,
                recommended_reorder_quantity=recommended_reorder_quantity,
                risk_level=risk_level,
                selected_model=model_name,
                daily_forecast=_round_two(daily_forecast),
            )
        )

    return results
