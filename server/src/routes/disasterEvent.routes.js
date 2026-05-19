const express = require("express");

const { ROLE_CODES, requireRoles } = require("../modules/auth/auth.middleware");
const disasterEventService = require("../services/disasterEvent.service");
const {
  validateCreateDisasterEvent,
  validateExportDisasterEvents,
  validateExtendDisasterEvent,
} = require("../validators/disasterEvent.validator");

const router = express.Router();

router.get("/", requireRoles(ROLE_CODES.MSWDO), async (req, res) => {
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

router.get("/ended", requireRoles(ROLE_CODES.MSWDO), async (req, res) => {
  try {
    const closedDisasterEvents =
      await disasterEventService.getClosedDisasterEvents();

    return res.status(200).json(closedDisasterEvents);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch ended disaster events",
      error: error.message,
    });
  }
});

router.get(
  "/export",
  requireRoles(ROLE_CODES.MSWDO),
  validateExportDisasterEvents,
  async (req, res) => {
  try {
    const file = await disasterEventService.exportDisasterEvents(
      req.validatedQuery,
    );

    res.setHeader("Content-Type", file.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.filename}"`,
    );

    return res.status(200).send(file.buffer);
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to export disaster events",
    });
  }
  },
);

router.get("/:id", requireRoles(ROLE_CODES.MSWDO), async (req, res) => {
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

router.post(
  "/",
  requireRoles(ROLE_CODES.MSWDO),
  validateCreateDisasterEvent,
  async (req, res) => {
  try {
    const disasterEvent = await disasterEventService.createDisasterEvent(
      {
        ...req.validatedBody,
        created_by: req.auth.userId,
      },
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
  },
);

router.patch(
  "/:id",
  requireRoles(ROLE_CODES.MSWDO),
  validateExtendDisasterEvent,
  async (req, res) => {
  try {
    const disasterEvent = await disasterEventService.extendDisasterEvent(
      req.params.id,
      req.validatedBody.end_date,
    );

    return res.status(200).json({
      message: "Disaster event extended successfully",
      data: disasterEvent,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to extend disaster event",
    });
  }
  },
);

router.patch("/:id/end", requireRoles(ROLE_CODES.MSWDO), async (req, res) => {
  try {
    const disasterEvent = await disasterEventService.endDisasterEvent(
      req.params.id,
    );

    return res.status(200).json({
      message: "Disaster event ended successfully",
      data: disasterEvent,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: error.message || "Failed to end disaster event",
    });
  }
});

module.exports = router;
