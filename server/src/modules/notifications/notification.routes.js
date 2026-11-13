const express = require("express");

const { ROLE_CODES, requireRoles } = require("../auth/auth.middleware");
const notificationService = require("./notification.service");

const router = express.Router();

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const VALID_STATUSES = new Set(["ALL", "UNREAD"]);
const VALID_PRIORITIES = new Set(["ALL", "INFO", "INFORMATIONAL", "WARNING", "CRITICAL"]);
const CURSOR_MAX_LENGTH = 512;

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const parseCursor = (value) => {
  if (!value) return null;
  if (typeof value !== "string" || value.length > CURSOR_MAX_LENGTH) {
    throw createValidationError("Invalid notification cursor");
  }

  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const generatedAt = new Date(cursor?.generatedAt);
    const isUuid =
      typeof cursor?.id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cursor.id);
    if (!Number.isFinite(generatedAt.getTime()) || !isUuid) {
      throw new Error("invalid cursor");
    }
    return { generatedAt: generatedAt.toISOString(), id: cursor.id };
  } catch (_error) {
    throw createValidationError("Invalid notification cursor");
  }
};

const parseListFilters = (query) => {
  const status = String(query.status || "ALL").toUpperCase();
  const category = String(query.category || "ALL").toUpperCase();
  const priority = String(query.priority || "ALL").toUpperCase();
  const rawLimit = query.limit ?? DEFAULT_PAGE_SIZE;

  if (!VALID_STATUSES.has(status)) throw createValidationError("Invalid notification status");
  if (!/^[A-Z_]+$/.test(category)) throw createValidationError("Invalid notification category");
  if (!VALID_PRIORITIES.has(priority)) throw createValidationError("Invalid notification priority");
  if (!/^\d+$/.test(String(rawLimit))) throw createValidationError("Notification limit must be an integer");

  const limit = Number(rawLimit);
  if (limit < 1 || limit > MAX_PAGE_SIZE) {
    throw createValidationError(`Notification limit must be between 1 and ${MAX_PAGE_SIZE}`);
  }

  return {
    status,
    category,
    priority: priority === "INFO" ? "INFORMATIONAL" : priority,
    cursor: parseCursor(query.cursor),
    limit,
  };
};

router.get(
  "/rules/current",
  requireRoles(ROLE_CODES.MAYOR, ROLE_CODES.MSWDO, ROLE_CODES.BARANGAY),
  async (req, res) => {
    try {
      // Compatibility route: the Settings page must use /api/v1/settings/current.
      const rules = await notificationService.getNotificationRulesForRole(
        req.auth.roleCode,
      );

      return res.status(200).json({
        data: rules,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to fetch notification rules",
      });
    }
  },
);

router.get(
  "/",
  requireRoles(ROLE_CODES.MAYOR, ROLE_CODES.MSWDO, ROLE_CODES.BARANGAY),
  async (req, res) => {
    try {
      const filters = parseListFilters(req.query);
      const page = await notificationService.getNotificationsForUser(
        req.auth.userId,
        {
          ...filters,
          roleCode: req.auth.roleCode,
        },
      );

      return res.status(200).json(page);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to fetch notifications",
      });
    }
  },
);

router.get(
  "/unread-count",
  requireRoles(ROLE_CODES.MAYOR, ROLE_CODES.MSWDO, ROLE_CODES.BARANGAY),
  async (req, res) => {
    try {
      const unread_count = await notificationService.getUnreadCountForUser(
        req.auth.userId,
      );

      return res.status(200).json({ unread_count });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to fetch unread notification count",
      });
    }
  },
);

router.post(
  "/:id/read",
  requireRoles(ROLE_CODES.MAYOR, ROLE_CODES.MSWDO, ROLE_CODES.BARANGAY),
  async (req, res) => {
    try {
      const updatedRecipient = await notificationService.markNotificationAsRead(
        req.params.id,
        req.auth.userId,
      );

      return res.status(200).json({
        message: "Notification marked as read",
        data: updatedRecipient,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to mark notification as read",
      });
    }
  },
);

router.post(
  "/read-all",
  requireRoles(ROLE_CODES.MAYOR, ROLE_CODES.MSWDO, ROLE_CODES.BARANGAY),
  async (req, res) => {
    try {
      const result = await notificationService.markAllNotificationsAsRead(
        req.auth.userId,
      );

      return res.status(200).json({
        message: "All notifications marked as read",
        data: result,
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        message: error.message || "Failed to mark all notifications as read",
      });
    }
  },
);

module.exports = router;
