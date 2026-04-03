const express = require("express");

const disasterEventService = require("../services/disasterEvent.service");
const {
  validateCreateDisasterEvent,
} = require("../validators/disasterEvent.validator");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const disasterEvents = await disasterEventService.getAllDisasterEvents();

    return res.status(200).json(disasterEvents);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch disaster events",
      error: error.message,
    });
  }
});

router.get("/active", async (req, res) => {
  try {
    const activeDisasterEvents =
      await disasterEventService.getActiveDisasterEvents();

    return res.status(200).json(activeDisasterEvents);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch active disaster events",
      error: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const disasterEvent = await disasterEventService.getDisasterEventById(
      req.params.id,
    );

    if (!disasterEvent) {
      return res.status(404).json({
        message: "Disaster event not found",
      });
    }

    return res.status(200).json(disasterEvent);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch disaster event",
      error: error.message,
    });
  }
});

router.post("/", validateCreateDisasterEvent, async (req, res) => {
  try {
    const disasterEvent = await disasterEventService.createDisasterEvent(
      req.validatedBody,
    );

    return res.status(201).json({
      message: "Disaster event created successfully",
      data: disasterEvent,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to create disaster event",
    });
  }
});

module.exports = router;
