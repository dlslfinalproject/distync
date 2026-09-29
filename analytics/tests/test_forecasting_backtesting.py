import math
import unittest
from unittest.mock import patch

from app.forecasting import service
from app.forecasting.schemas import InventoryForecastItemInput


def _evaluate(series):
    return service.evaluate_forecast_models(
        series,
        forecast_horizon_days=14,
        moving_average_window=7,
        exponential_smoothing_alpha=0.4,
    )


def _evaluated_candidate(mae, rmse):
    return {"status": "EVALUATED", "mae": mae, "rmse": rmse}


class ExistingForecastModelRegressionTests(unittest.TestCase):
    def test_moving_average_keeps_recent_window_mean(self):
        self.assertEqual(service._moving_average([1, 2, 3], 2, 4), (2.5, 10.0))

    def test_exponential_smoothing_keeps_configured_alpha_recurrence(self):
        daily, total = service._exponential_smoothing([10, 20, 30], 0.4, 2)

        self.assertAlmostEqual(daily, 20.4)
        self.assertAlmostEqual(total, 40.8)

    def test_trend_projection_keeps_current_linear_projection(self):
        self.assertEqual(service._trend_projection([2, 4, 6], 2), (9.0, 18.0))

    def test_live_inventory_runner_keeps_existing_result_behavior(self):
        item = InventoryForecastItemInput(
            inventory_item_id="item-1",
            item_name="Rice",
            current_available_stock=100,
            reorder_level=10,
            usage_series=[1, 2, 3, 4, 5, 6, 7],
        )

        result = service.run_inventory_forecast(
            items=[item],
            model_name="MOVING_AVERAGE",
            forecast_horizon_days=14,
            lookback_days=30,
            moving_average_window=7,
            exponential_smoothing_alpha=0.4,
        )[0]

        self.assertEqual(result.average_daily_usage, 0.93)
        self.assertEqual(result.forecasted_usage, 56.0)
        self.assertEqual(result.daily_forecast, 4.0)
        self.assertEqual(result.recommended_reorder_quantity, 0)
        self.assertEqual(result.risk_level, "MEDIUM")
        self.assertEqual(result.selected_model, "MOVING_AVERAGE")
        self.assertIsNotNone(result.projected_depletion_date)


class BacktestingMetricTests(unittest.TestCase):
    def test_mae_matches_manual_calculation(self):
        self.assertAlmostEqual(
            service._mean_absolute_error([1, 2, 3], [2, 2, 4]),
            2 / 3,
        )

    def test_rmse_matches_manual_calculation(self):
        self.assertAlmostEqual(
            service._root_mean_squared_error([1, 2, 3], [2, 2, 4]),
            math.sqrt(2 / 3),
        )

    def test_metrics_reject_mismatched_lengths(self):
        with self.assertRaisesRegex(ValueError, "same length"):
            service._mean_absolute_error([1, 2, 3], [1, 2])

        with self.assertRaisesRegex(ValueError, "same length"):
            service._root_mean_squared_error([1, 2, 3], [1, 2])


class RollingOriginFoldTests(unittest.TestCase):
    def test_historical_sanitization_preserves_zeros_and_length(self):
        self.assertEqual(
            service._sanitize_historical_series([3, 0, 4, -2, 5]),
            [3.0, 0.0, 4.0, 0.0, 5.0],
        )

    def test_folds_expand_chronologically_without_target_or_future_values(self):
        series = list(range(1, 15))
        folds = list(service._rolling_origin_folds(series, 7))

        self.assertEqual(len(folds), 7)
        self.assertEqual(folds[0], (list(range(1, 8)), 8))
        self.assertEqual(folds[1], (list(range(1, 9)), 9))
        self.assertEqual(folds[-1], (list(range(1, 14)), 14))

        for fold_index, (training, actual) in enumerate(folds):
            target_index = 7 + fold_index
            self.assertEqual(training, series[:target_index])
            self.assertNotIn(actual, training)
            self.assertTrue(set(training).isdisjoint(series[target_index + 1 :]))

    def test_all_candidates_receive_the_same_unpadded_folds(self):
        series = list(range(1, 15))
        original_dispatcher = service._get_forecast_values
        calls = []

        def recording_dispatcher(model_name, training, horizon, window, alpha):
            calls.append((model_name, list(training), horizon))
            return original_dispatcher(model_name, training, horizon, window, alpha)

        with patch.object(service, "_get_forecast_values", side_effect=recording_dispatcher):
            result = _evaluate(series)

        self.assertEqual(result["initial_training_points"], 7)
        self.assertEqual(result["backtest_points"], 7)
        self.assertEqual(set(result["candidates"]), service.FORECAST_MODELS)

        fold_prefixes = [list(range(1, n + 1)) for n in range(7, 14)]
        for model_name in service.FORECAST_MODELS:
            model_folds = [
                training
                for called_model, training, horizon in calls
                if called_model == model_name and horizon == 1
            ]
            self.assertEqual(model_folds, fold_prefixes)
            self.assertEqual(len(model_folds[0]), 7)
            self.assertEqual(model_folds[0], list(range(1, 8)))
            self.assertEqual(result["candidates"][model_name]["backtest_point_count"], 7)


class ForecastEvaluationTests(unittest.TestCase):
    def test_exactly_fourteen_observations_produce_seven_common_points(self):
        result = _evaluate(list(range(1, 15)))

        self.assertEqual(result["evaluation_status"], "EVALUATED")
        self.assertEqual(result["initial_training_points"], 7)
        self.assertEqual(result["minimum_backtest_points"], 7)
        self.assertEqual(result["required_observations"], 14)
        self.assertEqual(result["backtest_points"], 7)
        self.assertTrue(
            all(candidate["backtest_point_count"] == 7
                for candidate in result["candidates"].values())
        )

    def test_thirteen_observations_are_insufficient_for_recommendation(self):
        result = _evaluate(list(range(1, 14)))

        self.assertEqual(result["evaluation_status"], "INSUFFICIENT_HISTORY")
        self.assertEqual(result["available_observations"], 13)
        self.assertEqual(result["required_observations"], 14)
        self.assertEqual(result["minimum_backtest_points"], 7)
        self.assertEqual(result["backtest_points"], 6)
        self.assertIsNone(result["recommended_model"])
        self.assertEqual(result["recommendation_reason"], "INSUFFICIENT_HISTORY")
        self.assertTrue(
            all(candidate["status"] == "NOT_EVALUATED"
                for candidate in result["candidates"].values())
        )

    def test_linear_series_recommends_trend_projection(self):
        result = _evaluate(list(range(1, 15)))
        trend = result["candidates"]["TREND_PROJECTION"]

        self.assertEqual(result["recommended_model"], "TREND_PROJECTION")
        self.assertEqual(result["recommendation_status"], "RECOMMENDED")
        self.assertAlmostEqual(trend["mae"], 0.0, places=12)
        self.assertAlmostEqual(trend["rmse"], 0.0, places=12)

    def test_constant_series_returns_no_recommendation_on_complete_tie(self):
        result = _evaluate([5] * 14)

        self.assertIsNone(result["recommended_model"])
        self.assertEqual(result["recommendation_status"], "NO_RECOMMENDATION")
        self.assertEqual(result["recommendation_reason"], "METRIC_TIE")
        self.assertEqual(
            {(candidate["mae"], candidate["rmse"])
             for candidate in result["candidates"].values()},
            {(0.0, 0.0)},
        )

    def test_all_zero_series_is_evaluated_but_has_no_discriminating_signal(self):
        result = _evaluate([0] * 14)

        self.assertEqual(result["evaluation_status"], "EVALUATED")
        self.assertIsNone(result["recommended_model"])
        self.assertEqual(result["recommendation_reason"], "NO_DISCRIMINATING_SIGNAL")
        self.assertTrue(
            all(candidate["mae"] == 0.0 and candidate["rmse"] == 0.0
                for candidate in result["candidates"].values())
        )
        self.assertTrue(
            all(candidate["current_forecast"] == {
                "daily_forecast": 0.0,
                "forecasted_usage": 0.0,
            } for candidate in result["candidates"].values())
        )

    def test_mae_is_primary_selection_criterion(self):
        candidates = {
            "MOVING_AVERAGE": _evaluated_candidate(1.0, 10.0),
            "EXPONENTIAL_SMOOTHING": _evaluated_candidate(2.0, 2.0),
            "TREND_PROJECTION": _evaluated_candidate(3.0, 3.0),
        }

        self.assertEqual(
            service._select_recommended_model(candidates),
            ("MOVING_AVERAGE", "UNIQUE_LOWEST_MAE"),
        )

    def test_rmse_breaks_an_exact_mae_tie(self):
        candidates = {
            "MOVING_AVERAGE": _evaluated_candidate(1.0, 3.0),
            "EXPONENTIAL_SMOOTHING": _evaluated_candidate(1.0, 2.0),
            "TREND_PROJECTION": _evaluated_candidate(2.0, 2.0),
        }

        self.assertEqual(
            service._select_recommended_model(candidates),
            ("EXPONENTIAL_SMOOTHING", "LOWEST_RMSE_AFTER_MAE_TIE"),
        )

    def test_complete_metric_tie_has_no_model_order_fallback(self):
        candidates = {
            "MOVING_AVERAGE": _evaluated_candidate(1.0, 2.0),
            "EXPONENTIAL_SMOOTHING": _evaluated_candidate(1.0, 2.0),
            "TREND_PROJECTION": _evaluated_candidate(3.0, 4.0),
        }

        self.assertEqual(
            service._select_recommended_model(candidates),
            (None, "METRIC_TIE"),
        )

    def test_candidate_failure_is_unavailable_and_blocks_recommendation(self):
        original_dispatcher = service._get_forecast_values

        def failing_dispatcher(model_name, training, horizon, window, alpha):
            if model_name == "TREND_PROJECTION":
                raise ValueError("controlled mathematical failure")
            return original_dispatcher(model_name, training, horizon, window, alpha)

        with patch.object(service, "_get_forecast_values", side_effect=failing_dispatcher):
            result = _evaluate(list(range(1, 15)))

        self.assertEqual(result["candidates"]["TREND_PROJECTION"]["status"], "UNAVAILABLE")
        self.assertEqual(
            result["candidates"]["TREND_PROJECTION"]["failure_reason"],
            "MATHEMATICAL_EVALUATION_ERROR",
        )
        self.assertEqual(
            result["candidates"]["TREND_PROJECTION"]["failure_exception"],
            "ValueError",
        )
        self.assertTrue(
            all(result["candidates"][model]["status"] == "EVALUATED"
                for model in ("MOVING_AVERAGE", "EXPONENTIAL_SMOOTHING"))
        )
        self.assertIsNone(result["recommended_model"])
        self.assertEqual(result["recommendation_reason"], "CANDIDATE_UNAVAILABLE")

    def test_full_history_candidate_forecasts_use_all_observations(self):
        series = list(range(1, 15))
        original_dispatcher = service._get_forecast_values
        calls = []

        def recording_dispatcher(model_name, training, horizon, window, alpha):
            calls.append((model_name, list(training), horizon))
            return original_dispatcher(model_name, training, horizon, window, alpha)

        with patch.object(service, "_get_forecast_values", side_effect=recording_dispatcher):
            result = _evaluate(series)

        current_calls = [call for call in calls if call[2] == 14]
        self.assertEqual(len(current_calls), 3)
        self.assertTrue(all(training == series for _, training, _ in current_calls))
        self.assertTrue(all(len(training) == 14 for _, training, _ in current_calls))
        self.assertTrue(
            all(candidate["current_forecast"] is not None
                for candidate in result["candidates"].values())
        )
        selected = result["selected_statistical_forecast"]
        self.assertEqual(selected["model_name"], "TREND_PROJECTION")
        self.assertEqual(
            {key: value for key, value in selected.items() if key != "model_name"},
            result["candidates"]["TREND_PROJECTION"]["current_forecast"],
        )

    def test_backtesting_does_not_mutate_input_series(self):
        series = [3, 0, 4, 0, 5, 2, 1, 8, 3, 4, 6, 0, 2, 9]
        original = series.copy()

        _evaluate(series)

        self.assertEqual(series, original)


if __name__ == "__main__":
    unittest.main()
