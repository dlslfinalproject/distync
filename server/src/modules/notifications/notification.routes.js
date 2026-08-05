const express = require("express");

const { ROLE_CODES, requireRoles } = require("../auth/auth.middleware");
const notificationService = require("./notification.service");

const router = express.Router();

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
      const status =
        req.query.status === "UNREAD" ? "UNREAD" : "ALL";
      const parsedLimit = Number(req.query.limit || 30);
      const limit = Number.isFinite(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), 100)
        : 30;

      const notifications = await notificationService.getNotificationsForUser(
        req.auth.userId,
        {
          status,
          limit,
        },
      );

      return res.status(200).json(notifications);
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
