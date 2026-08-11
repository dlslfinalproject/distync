const validateGetSystemLogReview = (req, res, next) => {
  try {
    const { limit, type } = req.query;
    const isUnlimited = String(limit || "").toLowerCase() === "all";
    const parsedLimit = isUnlimited ? null : Number(limit || 50);

    if (
      !isUnlimited &&
      (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 200)
    ) {
      return res.status(400).json({
        message: "limit must be an integer between 1 and 200, or all",
      });
    }

    const normalizedType = String(type || "all").toLowerCase();

    if (!["all", "audit", "error"].includes(normalizedType)) {
      return res.status(400).json({
        message: "type must be one of: all, audit, error",
      });
    }

    req.validatedQuery = {
      limit: parsedLimit,
      type: normalizedType,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate system log review request",
      error: error.message,
    });
  }
};

module.exports = {
  validateGetSystemLogReview,
};
