import unittest

from pydantic import ValidationError

from app.forecasting import service
from app.forecasting.schemas import (
    InventoryForecastItemInput,
    InventoryForecastRequest,
)


def make_item(item_id, history):
    return InventoryForecastItemInput(
        inventory_item_id=item_id,
        item_name=item_id,
        current_available_stock=50,
        reorder_level=2,
        usage_series=history,
    )


def auto_forecast(items):
    return service.run_auto_backtest_inventory_forecast(
        items=items,
        forecast_horizon_days=14,
        moving_average_window=7,
        exponential_smoothing_alpha=0.4,
    )


class ForecastSelectionModeSchemaTests(unittest.TestCase):
    def test_legacy_request_defaults_to_fixed_model(self):
        request = InventoryForecastRequest(
            items=[make_item("rice", [1, 2, 3])],
        )

        self.assertEqual(request.selection_mode, "FIXED_MODEL")
        self.assertEqual(request.model_name, "MOVING_AVERAGE")

    def test_auto_mode_is_additive_and_invalid_mode_is_rejected(self):
        request = InventoryForecastRequest(
            selection_mode="AUTO_BACKTEST",
            items=[make_item("rice", list(range(14)))],
        )
        self.assertEqual(request.selection_mode, "AUTO_BACKTEST")

        with self.assertRaises(ValidationError):
            InventoryForecastRequest(selection_mode="AUTOMATIC")


class AutoBacktestForecastTests(unittest.TestCase):
    def test_three_items_can_select_three_different_models(self):
        moving_average_history = [
            2, 1, 1, 2, 0, 0, 5, 0, 2, 2, 10, 2, 0, 20, 5, 10, 0, 5, 0, 10
        ]
        smoothing_history = [0] * 16 + [10] * 14
        trend_history = list(range(1, 31))

        results = auto_forecast(
            [
                make_item("rice", moving_average_history),
                make_item("water", smoothing_history),
                make_item("canned-goods", trend_history),
            ]
        )

        self.assertEqual(
            [result.selected_model for result in results],
            [
                "MOVING_AVERAGE",
                "EXPONENTIAL_SMOOTHING",
                "TREND_PROJECTION",
            ],
        )
        for result in results:
            self.assertEqual(result.recommended_model, result.selected_model)
            self.assertEqual(result.recommendation_status, "RECOMMENDED")
            self.assertEqual(result.selection_reason, "HISTORICALLY_RECOMMENDED")
            self.assertEqual(result.initial_training_points, 7)
            self.assertEqual(result.available_observations, 30 if result.inventory_item_id != "rice" else 20)
            self.assertEqual(result.backtest_points, result.available_observations - 7)
            self.assertEqual(
                [candidate.model_name for candidate in result.candidate_evaluations],
                list(service.FORECAST_MODEL_ORDER),
            )
            self.assertTrue(
                all(candidate.current_forecast is not None for candidate in result.candidate_evaluations)
            )
            selected_candidate = next(
                candidate
                for candidate in result.candidate_evaluations
                if candidate.model_name == result.selected_model
            )
            self.assertEqual(
                result.raw_statistical_forecast.forecasted_usage,
                selected_candidate.current_forecast.forecasted_usage,
            )

        serialized = results[0].model_dump(mode="json")
        self.assertEqual(len(serialized["candidate_evaluations"]), 3)
        self.assertEqual(
            serialized["raw_statistical_forecast"]["model_name"],
            serialized["selected_model"],
        )
        self.assertIsInstance(serialized["candidate_evaluations"][0]["mae"], float)

    def test_current_stock_does_not_change_historical_evaluation_metrics(self):
        history = list(range(1, 31))
        low_stock_item = InventoryForecastItemInput(
            inventory_item_id="rice-low-stock",
            item_name="Rice",
            current_available_stock=0,
            usage_series=history,
        )
        high_stock_item = InventoryForecastItemInput(
            inventory_item_id="rice-high-stock",
            item_name="Rice",
            current_available_stock=10000,
            usage_series=history,
        )

        low_stock, high_stock = auto_forecast([low_stock_item, high_stock_item])

        self.assertEqual(low_stock.recommended_model, high_stock.recommended_model)
        self.assertEqual(
            [candidate.mae for candidate in low_stock.candidate_evaluations],
            [candidate.mae for candidate in high_stock.candidate_evaluations],
        )
        self.assertEqual(
            [candidate.rmse for candidate in low_stock.candidate_evaluations],
            [candidate.rmse for candidate in high_stock.candidate_evaluations],
        )
        self.assertEqual(
            low_stock.raw_statistical_forecast,
            high_stock.raw_statistical_forecast,
        )

    def test_thirteen_real_observations_fall_back_without_recommendation_or_padding(self):
        result = auto_forecast([make_item("rice", list(range(1, 14)) )])[0]

        self.assertEqual(result.evaluation_status, "INSUFFICIENT_HISTORY")
        self.assertEqual(result.available_observations, 13)
        self.assertEqual(result.initial_training_points, 7)
        self.assertEqual(result.backtest_points, 6)
        self.assertIsNone(result.recommended_model)
        self.assertEqual(result.recommendation_status, "NOT_EVALUATED")
        self.assertEqual(result.recommendation_reason, "INSUFFICIENT_HISTORY")
        self.assertEqual(result.selected_model, "MOVING_AVERAGE")
        self.assertEqual(result.selection_reason, "OPERATIONAL_FALLBACK")
        self.assertEqual(result.average_daily_usage, 7)
        self.assertEqual(result.raw_statistical_forecast.forecasted_usage, 140)
        self.assertEqual(len(result.candidate_evaluations), 3)
        self.assertTrue(
            all(candidate.status == "NOT_EVALUATED" for candidate in result.candidate_evaluations)
        )
        self.assertTrue(
            all(candidate.current_forecast is not None for candidate in result.candidate_evaluations)
        )

    def test_fourteen_observations_produce_seven_scored_folds(self):
        result = auto_forecast([make_item("rice", list(range(1, 15)))])[0]

        self.assertEqual(result.evaluation_status, "EVALUATED")
        self.assertEqual(result.available_observations, 14)
        self.assertEqual(result.initial_training_points, 7)
        self.assertEqual(result.backtest_points, 7)
        self.assertTrue(
            all(candidate.backtest_point_count == 7 for candidate in result.candidate_evaluations)
        )

    def test_all_zero_history_uses_fallback_and_keeps_no_signal_reason(self):
        result = auto_forecast([make_item("rice", [0] * 30)])[0]

        self.assertIsNone(result.recommended_model)
        self.assertEqual(result.recommendation_reason, "NO_DISCRIMINATING_SIGNAL")
        self.assertEqual(result.selected_model, "MOVING_AVERAGE")
        self.assertEqual(result.selection_reason, "OPERATIONAL_FALLBACK")
        self.assertEqual(result.raw_statistical_forecast.forecasted_usage, 0)

    def test_fixed_model_math_and_response_fields_remain_unchanged(self):
        request = InventoryForecastRequest(
            model_name="MOVING_AVERAGE",
            items=[make_item("rice", list(range(1, 15)))],
        )
        result = service.run_inventory_forecast(
            items=request.items,
            model_name=request.model_name,
            forecast_horizon_days=request.forecast_horizon_days,
            lookback_days=request.lookback_days,
            moving_average_window=request.moving_average_window,
            exponential_smoothing_alpha=request.exponential_smoothing_alpha,
        )[0]

        self.assertEqual(result.selected_model, "MOVING_AVERAGE")
        self.assertEqual(result.daily_forecast, 11)
        self.assertEqual(result.forecasted_usage, 154)
        serialized = result.model_dump(exclude_unset=True)
        self.assertNotIn("candidate_evaluations", serialized)
        self.assertNotIn("recommended_model", serialized)


if __name__ == "__main__":
    unittest.main()
