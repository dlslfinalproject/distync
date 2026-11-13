const express = require("express");

const { requirePolicy } = require("../modules/auth/auth.middleware");
const systemLogService = require("../services/systemLog.service");
const {
  validateGetSystemLogReview,
} = require("../validators/systemLog.validator");

const router = express.Router();

router.get(
  "/review",
  requirePolicy("SYSTEM_LOG_REVIEW"),
  validateGetSystemLogReview,
  async (req, res) => {
    try {
      const review = await systemLogService.getSystemLogReview(
        req.validatedQuery,
      );

      return res.status(200).json(review);
    } catch (error) {
      const statusCode = error.statusCode || 500;

      return res.status(statusCode).json({
        message: error.message || "Failed to load system log review",
      });
    }
  },
);

module.exports = router;
