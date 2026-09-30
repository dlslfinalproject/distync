from datetime import date, timedelta
from math import ceil, isfinite, sqrt
from typing import Iterable, Iterator, List, Sequence, Tuple

from .schemas import InventoryForecastItemInput, InventoryForecastResult


FORECAST_MODELS = {
    "MOVING_AVERAGE",
    "EXPONENTIAL_SMOOTHING",
    "TREND_PROJECTION",
}
FORECAST_MODEL_ORDER = (
    "MOVING_AVERAGE",
    "EXPONENTIAL_SMOOTHING",
    "TREND_PROJECTION",
)
_MINIMUM_MODEL_TRAINING_POINTS = 1


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
    reorder_level: float,
) -> int:
    shortfall = max(0.0, forecasted_usage + reorder_level - current_stock)
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


def _sanitize_historical_series(values: Iterable[float]) -> List[float]:
    """Convert a chronological observed-quantity series without changing its length.

    This deliberately does not use ``_normalize_series``: backtest prefixes
    must not be padded or truncated to the operational lookback. Values follow
    the existing model layer's nonnegative convention, and real zero periods
    remain in place.
    """
    normalized: List[float] = []

    try:
        iterator = iter(values)
    except TypeError as error:
        raise ValueError("historical_series must be an iterable of numbers") from error

    for value in iterator:
        try:
            numeric_value = float(value or 0.0)
        except (TypeError, ValueError) as error:
            raise ValueError("historical_series values must be numeric") from error

        if not isfinite(numeric_value):
            raise ValueError("historical_series values must be finite")

        normalized.append(max(0.0, numeric_value))

    return normalized


def _rolling_origin_folds(
    series: Sequence[float],
    initial_training_points: int,
) -> Iterator[Tuple[List[float], float]]:
    """Yield chronological expanding prefixes and their next observed value."""
    if initial_training_points < 1:
        raise ValueError("initial_training_points must be at least 1")

    for origin in range(initial_training_points, len(series)):
        yield list(series[:origin]), series[origin]


def _validated_metric_pairs(
    actual_values: Sequence[float],
    predictions: Sequence[float],
) -> List[Tuple[float, float]]:
    if len(actual_values) != len(predictions):
        raise ValueError("actual_values and predictions must have the same length")
    if not actual_values:
        raise ValueError("metrics require at least one actual/predicted pair")

    pairs: List[Tuple[float, float]] = []
    for actual, predicted in zip(actual_values, predictions):
        try:
            numeric_actual = float(actual)
            numeric_prediction = float(predicted)
        except (TypeError, ValueError) as error:
            raise ValueError("metric values must be numeric") from error

        if not isfinite(numeric_actual) or not isfinite(numeric_prediction):
            raise ValueError("metric values must be finite")

        pairs.append((numeric_actual, numeric_prediction))

    return pairs


def _mean_absolute_error(
    actual_values: Sequence[float],
    predictions: Sequence[float],
) -> float:
    """Return raw, unrounded MAE for matching actual and predicted periods."""
    pairs = _validated_metric_pairs(actual_values, predictions)
    metric = sum(abs(actual - predicted) for actual, predicted in pairs) / len(pairs)
    if not isfinite(metric):
        raise ValueError("MAE must be finite")
    return metric


def _root_mean_squared_error(
    actual_values: Sequence[float],
    predictions: Sequence[float],
) -> float:
    """Return raw, unrounded RMSE for matching actual and predicted periods."""
    pairs = _validated_metric_pairs(actual_values, predictions)
    metric = sqrt(
        sum((actual - predicted) ** 2 for actual, predicted in pairs) / len(pairs)
    )
    if not isfinite(metric):
        raise ValueError("RMSE must be finite")
    return metric


def _select_recommended_model(
    candidates: dict,
) -> Tuple[str | None, str]:
    """Select by unrounded MAE, then unrounded RMSE, with no arbitrary tie-break.

    Exact Python floating-point equality is used. No display rounding or
    tolerance is applied. A three-model comparison is not valid if any
    candidate is unavailable.
    """
    if any(
        candidates.get(model_name, {}).get("status") != "EVALUATED"
        for model_name in FORECAST_MODELS
    ):
        return None, "CANDIDATE_UNAVAILABLE"

    lowest_mae = min(candidates[model_name]["mae"] for model_name in FORECAST_MODELS)
    mae_winners = [
        model_name
        for model_name in FORECAST_MODELS
        if candidates[model_name]["mae"] == lowest_mae
    ]
    if len(mae_winners) == 1:
        return mae_winners[0], "UNIQUE_LOWEST_MAE"

    lowest_rmse = min(candidates[model_name]["rmse"] for model_name in mae_winners)
    rmse_winners = [
        model_name
        for model_name in mae_winners
        if candidates[model_name]["rmse"] == lowest_rmse
    ]
    if len(rmse_winners) == 1:
        return rmse_winners[0], "LOWEST_RMSE_AFTER_MAE_TIE"

    return None, "METRIC_TIE"


def _unavailable_candidate(
    *,
    backtest_point_count: int,
    exception: Exception,
    mae: float | None = None,
    rmse: float | None = None,
) -> dict:
    return {
        "status": "UNAVAILABLE",
        "mae": mae,
        "rmse": rmse,
        "backtest_point_count": backtest_point_count,
        "current_forecast": None,
        "failure_reason": "MATHEMATICAL_EVALUATION_ERROR",
        "failure_exception": type(exception).__name__,
    }


def _evaluate_candidate_model(
    model_name: str,
    eligible_series: List[float],
    *,
    initial_training_points: int,
    moving_average_window: int,
    exponential_smoothing_alpha: float,
    forecast_horizon_days: int,
) -> dict:
    actual_values: List[float] = []
    predictions: List[float] = []

    try:
        for training_series, actual in _rolling_origin_folds(
            eligible_series,
            initial_training_points,
        ):
            daily_forecast, _ = _get_forecast_values(
                model_name,
                training_series,
                1,
                moving_average_window,
                exponential_smoothing_alpha,
            )
            actual_values.append(actual)
            predictions.append(daily_forecast)

        mae = _mean_absolute_error(actual_values, predictions)
        rmse = _root_mean_squared_error(actual_values, predictions)
    except (ValueError, ArithmeticError) as error:
        return _unavailable_candidate(
            backtest_point_count=len(predictions),
            exception=error,
        )

    try:
        daily_forecast, forecasted_usage = _get_forecast_values(
            model_name,
            eligible_series,
            forecast_horizon_days,
            moving_average_window,
            exponential_smoothing_alpha,
        )
        if not isfinite(daily_forecast) or not isfinite(forecasted_usage):
            raise ValueError("full-history forecast values must be finite")
    except (ValueError, ArithmeticError) as error:
        return _unavailable_candidate(
            backtest_point_count=len(predictions),
            exception=error,
            mae=mae,
            rmse=rmse,
        )

    return {
        "status": "EVALUATED",
        "mae": mae,
        "rmse": rmse,
        "backtest_point_count": len(predictions),
        "current_forecast": {
            "daily_forecast": daily_forecast,
            "forecasted_usage": forecasted_usage,
        },
        "failure_reason": None,
        "failure_exception": None,
    }


def evaluate_forecast_models(
    historical_series: Iterable[float],
    *,
    forecast_horizon_days: int,
    moving_average_window: int,
    exponential_smoothing_alpha: float,
) -> dict:
    """Backtest the existing models on complete chronological observed history.

    ``historical_series`` must already contain only eligible, complete periods
    in chronological order. This function performs no date filtering,
    persistence, or operational lookback padding. It requires a minimum of
    ``initial_training_points`` scored one-step folds in addition to the same
    number of initial training observations before issuing a recommendation.
    """
    if not isinstance(moving_average_window, int) or moving_average_window < 1:
        raise ValueError("moving_average_window must be a positive integer")
    if not isinstance(forecast_horizon_days, int) or forecast_horizon_days < 1:
        raise ValueError("forecast_horizon_days must be a positive integer")

    try:
        alpha = float(exponential_smoothing_alpha)
    except (TypeError, ValueError) as error:
        raise ValueError("exponential_smoothing_alpha must be between 0 and 1") from error
    if not isfinite(alpha) or not 0 < alpha < 1:
        raise ValueError("exponential_smoothing_alpha must be between 0 and 1")

    eligible_series = _sanitize_historical_series(historical_series)

    # Both existing exponential smoothing and trend projection need one real
    # observation; the active moving-average window sets the common minimum.
    initial_training_points = max(
        moving_average_window,
        _MINIMUM_MODEL_TRAINING_POINTS,
    )
    minimum_backtest_points = initial_training_points
    required_observations = initial_training_points + minimum_backtest_points
    available_backtest_points = max(0, len(eligible_series) - initial_training_points)
    insufficient_history = len(eligible_series) < required_observations

    candidates = {
        model_name: {
            "status": "NOT_EVALUATED",
            "mae": None,
            "rmse": None,
            "backtest_point_count": 0,
            "current_forecast": None,
            "failure_reason": "INSUFFICIENT_HISTORY",
            "failure_exception": None,
        }
        for model_name in sorted(FORECAST_MODELS)
    }

    if insufficient_history:
        return {
            "evaluation_status": "INSUFFICIENT_HISTORY",
            "evaluation_method": "ROLLING_ORIGIN_ONE_STEP",
            "initial_training_points": initial_training_points,
            "minimum_backtest_points": minimum_backtest_points,
            "available_observations": len(eligible_series),
            "required_observations": required_observations,
            "backtest_points": available_backtest_points,
            "candidates": candidates,
            "recommended_model": None,
            "recommendation_status": "NOT_EVALUATED",
            "recommendation_reason": "INSUFFICIENT_HISTORY",
            "selected_statistical_forecast": None,
        }

    for model_name in sorted(FORECAST_MODELS):
        candidates[model_name] = _evaluate_candidate_model(
            model_name,
            eligible_series,
            initial_training_points=initial_training_points,
            moving_average_window=moving_average_window,
            exponential_smoothing_alpha=alpha,
            forecast_horizon_days=forecast_horizon_days,
        )

    recommended_model, recommendation_reason = _select_recommended_model(candidates)
    if (
        recommendation_reason != "CANDIDATE_UNAVAILABLE"
        and not any(eligible_series)
    ):
        recommended_model = None
        recommendation_reason = "NO_DISCRIMINATING_SIGNAL"

    selected_forecast = None
    if recommended_model is not None:
        selected_forecast = {
            "model_name": recommended_model,
            **candidates[recommended_model]["current_forecast"],
        }

    return {
        "evaluation_status": "EVALUATED",
        "evaluation_method": "ROLLING_ORIGIN_ONE_STEP",
        "initial_training_points": initial_training_points,
        "minimum_backtest_points": minimum_backtest_points,
        "available_observations": len(eligible_series),
        "required_observations": required_observations,
        "backtest_points": available_backtest_points,
        "candidates": candidates,
        "recommended_model": recommended_model,
        "recommendation_status": (
            "RECOMMENDED" if recommended_model is not None else "NO_RECOMMENDATION"
        ),
        "recommendation_reason": recommendation_reason,
        "selected_statistical_forecast": selected_forecast,
    }


def run_auto_backtest_inventory_forecast(
    *,
    items: List[InventoryForecastItemInput],
    forecast_horizon_days: int,
    moving_average_window: int,
    exponential_smoothing_alpha: float,
) -> List[InventoryForecastResult]:
    """Evaluate each item's observed history and forecast from that same history.

    The Stage 1 evaluator remains the source of evaluation metrics and
    recommendations. When history is too short for evaluation, current
    candidate forecasts are still calculated from the real supplied prefix so
    the operational Moving Average fallback has an output without padding.
    """
    results: List[InventoryForecastResult] = []

    for item in items:
        historical_series = _sanitize_historical_series(item.usage_series)
        evaluation = evaluate_forecast_models(
            historical_series,
            forecast_horizon_days=forecast_horizon_days,
            moving_average_window=moving_average_window,
            exponential_smoothing_alpha=exponential_smoothing_alpha,
        )

        candidate_results = {}
        candidate_evaluations = []
        for model_name in FORECAST_MODEL_ORDER:
            candidate = dict(evaluation["candidates"][model_name])
            current_forecast = candidate.get("current_forecast")

            if current_forecast is None and candidate["status"] == "NOT_EVALUATED":
                try:
                    daily_forecast, forecasted_usage = _get_forecast_values(
                        model_name,
                        historical_series,
                        forecast_horizon_days,
                        moving_average_window,
                        exponential_smoothing_alpha,
                    )
                    if not isfinite(daily_forecast) or not isfinite(forecasted_usage):
                        raise ValueError("full-history forecast values must be finite")
                    current_forecast = {
                        "daily_forecast": daily_forecast,
                        "forecasted_usage": forecasted_usage,
                    }
                except (ValueError, ArithmeticError) as error:
                    candidate["status"] = "UNAVAILABLE"
                    candidate["failure_reason"] = "FULL_HISTORY_FORECAST_ERROR"
                    candidate["failure_exception"] = type(error).__name__

            candidate_results[model_name] = {
                **candidate,
                "current_forecast": current_forecast,
            }
            candidate_evaluations.append(
                {
                    "model_name": model_name,
                    "status": candidate["status"],
                    "mae": candidate.get("mae"),
                    "rmse": candidate.get("rmse"),
                    "backtest_point_count": candidate.get(
                        "backtest_point_count", 0
                    ),
                    "current_forecast": (
                        {
                            "model_name": model_name,
                            **current_forecast,
                        }
                        if current_forecast is not None
                        else None
                    ),
                    "failure_reason": candidate.get("failure_reason"),
                }
            )

        recommended_model = evaluation["recommended_model"]
        selected_model = recommended_model or "MOVING_AVERAGE"
        selected_candidate = candidate_results[selected_model]
        selected_forecast = selected_candidate["current_forecast"]
        if selected_forecast is None:
            raise RuntimeError(
                f"No operational forecast is available for {selected_model}"
            )

        daily_forecast = selected_forecast["daily_forecast"]
        forecasted_usage = selected_forecast["forecasted_usage"]
        current_stock = max(0.0, float(item.current_available_stock or 0))
        reorder_level = max(0.0, float(item.reorder_level or 0))
        average_daily_usage = _average_daily_usage(historical_series)
        raw_statistical_forecast = {
            "model_name": selected_model,
            "daily_forecast": daily_forecast,
            "forecasted_usage": forecasted_usage,
        }

        results.append(
            InventoryForecastResult(
                inventory_item_id=item.inventory_item_id,
                item_name=item.item_name,
                item_code=item.item_code,
                category=item.category,
                unit_of_measure=item.unit_of_measure,
                current_available_stock=_round_two(current_stock),
                reorder_level=_round_two(reorder_level),
                average_daily_usage=_round_two(average_daily_usage),
                forecasted_usage=_round_two(forecasted_usage),
                projected_depletion_date=_calculate_projected_depletion_date(
                    current_stock,
                    daily_forecast,
                ),
                recommended_reorder_quantity=_calculate_recommended_reorder_quantity(
                    current_stock,
                    forecasted_usage,
                    reorder_level,
                ),
                risk_level=_calculate_risk_level(current_stock, daily_forecast),
                selected_model=selected_model,
                daily_forecast=_round_two(daily_forecast),
                recommended_model=recommended_model,
                recommendation_status=evaluation["recommendation_status"],
                recommendation_reason=evaluation["recommendation_reason"],
                selection_reason=(
                    "HISTORICALLY_RECOMMENDED"
                    if recommended_model is not None
                    else "OPERATIONAL_FALLBACK"
                ),
                evaluation_status=evaluation["evaluation_status"],
                evaluation_method=evaluation["evaluation_method"],
                initial_training_points=evaluation["initial_training_points"],
                available_observations=evaluation["available_observations"],
                backtest_points=evaluation["backtest_points"],
                candidate_evaluations=candidate_evaluations,
                raw_statistical_forecast=raw_statistical_forecast,
            )
        )

    return results


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
        reorder_level = max(0.0, float(item.reorder_level or 0))
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
            reorder_level,
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
                reorder_level=_round_two(reorder_level),
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
