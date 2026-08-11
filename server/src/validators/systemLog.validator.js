const validateGetSystemLogReview = (req, res, next) => {
  try {
    const { audit_action, date_from, date_to, limit, module, page, search, type } =
      req.query;
    const isUnlimited = String(limit || "").toLowerCase() === "all";
    const parsedLimit = isUnlimited ? null : Number(limit || 50);
    const parsedPage = Number(page || 1);

    if (
      !isUnlimited &&
      (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 200)
    ) {
      return res.status(400).json({
        message: "limit must be an integer between 1 and 200, or all",
      });
    }

    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        message: "page must be a positive integer",
      });
    }

    const normalizedType = String(type || "all").toLowerCase();

    if (!["all", "audit", "error"].includes(normalizedType)) {
      return res.status(400).json({
        message: "type must be one of: all, audit, error",
      });
    }

    const normalizedModule = String(module || "all").toLowerCase();

    if (
      !["all", "inventory", "relief pack", "donation", "distribution"].includes(
        normalizedModule,
      )
    ) {
      return res.status(400).json({
        message:
          "module must be one of: all, inventory, relief pack, donation, distribution",
      });
    }

    const normalizedAuditAction = String(audit_action || "all").toLowerCase();

    if (
      ![
        "all",
        "item_created",
        "item_details_edited",
        "stock_added",
        "stock_adjusted",
        "written_off",
        "relief_pack_template_created",
        "relief_pack_details_edited",
        "donation_entry",
        "donation_details_edited",
        "distributed_items",
      ].includes(normalizedAuditAction)
    ) {
      return res.status(400).json({
        message: "audit_action is not a valid audit action filter",
      });
    }

    const normalizedDateFrom = String(date_from || "").trim();
    const normalizedDateTo = String(date_to || "").trim();
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    if (normalizedDateFrom && !datePattern.test(normalizedDateFrom)) {
      return res.status(400).json({
        message: "date_from must use YYYY-MM-DD format",
      });
    }

    if (normalizedDateTo && !datePattern.test(normalizedDateTo)) {
      return res.status(400).json({
        message: "date_to must use YYYY-MM-DD format",
      });
    }

    if (
      normalizedDateFrom &&
      normalizedDateTo &&
      normalizedDateFrom > normalizedDateTo
    ) {
      return res.status(400).json({
        message: "date_from must be before or equal to date_to",
      });
    }

    req.validatedQuery = {
      auditAction: normalizedAuditAction,
      dateFrom: normalizedDateFrom,
      dateTo: normalizedDateTo,
      limit: parsedLimit,
      module: normalizedModule,
      page: parsedPage,
      search: String(search || "").trim(),
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
