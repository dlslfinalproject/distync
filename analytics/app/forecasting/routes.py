import logging

from fastapi import APIRouter, HTTPException

from .schemas import InventoryForecastRequest, InventoryForecastResponse
from .service import run_inventory_forecast

router = APIRouter(prefix="/forecasting", tags=["forecasting"])
logger = logging.getLogger(__name__)


@router.post("/inventory-demand", response_model=InventoryForecastResponse)
def forecast_inventory_demand(payload: InventoryForecastRequest):
    try:
        results = run_inventory_forecast(
            items=payload.items,
            model_name=payload.model_name,
            forecast_horizon_days=payload.forecast_horizon_days,
            lookback_days=payload.lookback_days,
            moving_average_window=payload.moving_average_window,
            exponential_smoothing_alpha=payload.exponential_smoothing_alpha,
        )

        return InventoryForecastResponse(
            model_name=payload.model_name,
            forecast_horizon_days=payload.forecast_horizon_days,
            lookback_days=payload.lookback_days,
            results=results,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        logger.exception("Analytics service failed to compute inventory forecast.")
        raise HTTPException(
            status_code=500,
            detail="Analytics service failed to compute inventory forecast.",
        ) from error
