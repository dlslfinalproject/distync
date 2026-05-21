const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const forecastService = require("../services/forecast.service");
const inventoryItemService = require("../services/inventoryItem.service");
const {
  validateExportInventoryItems,
  validateForecastHistoryQuery,
  validateForecastLatestQuery,
  validateForecastRunIdParam,
  validateForecastRunPayload,
  validateInventoryItemId,
  validateGetInventoryItems,
  validateInventoryItemPayload,
} = require("../validators/inventoryItem.validator");

const router = express.Router();

router.get(
  "/forecast/health",
  requireRoles(ROLE_CODES.MAYOR),
  async (_req, res) => {
    try {
      const health = await forecastService.getAnalyticsServiceHealth();

      return res.status(200).json({
        data: health,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to fetch analytics health",
      });
    }
  },
);

router.get(
  "/forecast/history",
  requireRoles(ROLE_CODES.MAYOR),
  validateForecastHistoryQuery,
  async (req, res) => {
    try {
      const history = await forecastService.getInventoryForecastHistory(
        req.validatedQuery,
      );

      return res.status(200).json({
        data: history,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to fetch forecast history",
      });
    }
  },
);

router.get(
  "/forecast/history/:runId",
  requireRoles(ROLE_CODES.MAYOR),
  validateForecastRunIdParam,
  async (req, res) => {
    try {
      const forecastRunDetails =
        await forecastService.getInventoryForecastRunDetails(
          req.validatedParams.runId,
        );

      return res.status(200).json({
        data: forecastRunDetails,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to fetch forecast run details",
      });
    }
  },
);

router.get(
  "/forecast/latest",
  requireRoles(ROLE_CODES.MAYOR),
  validateForecastLatestQuery,
  async (req, res) => {
    try {
      const latestForecast = await forecastService.getLatestInventoryForecast(
        req.validatedQuery.disaster_event_id,
      );

      return res.status(200).json({
        data: latestForecast,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to fetch latest inventory forecast",
      });
    }
  },
);

router.post(
  "/forecast/run",
  requireRoles(ROLE_CODES.MAYOR),
  validateForecastRunPayload,
  async (req, res) => {
    try {
      const forecastPayload = await forecastService.runInventoryForecast({
        ...req.validatedBody,
        run_by: req.auth.userId,
      });

      return res.status(201).json({
        message: "Inventory forecast completed successfully",
        data: forecastPayload,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to run inventory forecast",
      });
    }
  },
);

router.get(
  "/",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateGetInventoryItems,
  async (req, res) => {
  try {
    const inventoryItems = await inventoryItemService.getInventoryItems(
      req.validatedQuery,
    );

    return res.status(200).json(inventoryItems);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch inventory items",
    });
  }
  },
);

router.get(
  "/export",
  requireRoles(ROLE_CODES.MAYOR),
  validateExportInventoryItems,
  async (req, res) => {
  try {
    const file = req.validatedQuery.report_type
      ? await inventoryItemService.exportInventoryConditionReport({
          report_type: req.validatedQuery.report_type,
          near_expiry_days: req.validatedQuery.near_expiry_days,
          filters: req.validatedQuery,
          format: req.validatedQuery.format,
        })
      : await inventoryItemService.exportInventoryItems(req.validatedQuery);

    res.setHeader("Content-Type", file.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.filename}"`,
    );

    return res.status(200).send(file.buffer);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to export inventory items",
    });
  }
  },
);

router.get(
  "/:id",
  requireRoles(ROLE_CODES.BARANGAY, ROLE_CODES.MSWDO, ROLE_CODES.MAYOR),
  validateInventoryItemId,
  async (req, res) => {
  try {
    const inventoryItem = await inventoryItemService.getInventoryItemById(
      req.params.id,
    );

    if (!inventoryItem) {
      return res.status(404).json({
        message: "Inventory item not found",
      });
    }

    return res.status(200).json(inventoryItem);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to fetch inventory item",
    });
  }
  },
);

router.post(
  "/",
  requireRoles(ROLE_CODES.MAYOR),
  validateInventoryItemPayload,
  async (req, res) => {
  try {
    const inventoryItem = await inventoryItemService.createInventoryItem(
      req.validatedBody,
      req.auth,
    );

    return res.status(201).json({
      message: "Inventory item created successfully",
      data: inventoryItem,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to create inventory item",
    });
  }
  },
);

router.put(
  "/:id",
  requireRoles(ROLE_CODES.MAYOR),
  validateInventoryItemId,
  validateInventoryItemPayload,
  async (req, res) => {
    try {
      const inventoryItem = await inventoryItemService.updateInventoryItem(
        req.params.id,
        req.validatedBody,
        req.auth,
      );

      return res.status(200).json({
        message: "Inventory item updated successfully",
        data: inventoryItem,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to update inventory item",
      });
    }
  },
);

module.exports = router;
