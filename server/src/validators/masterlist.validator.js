const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => {
  return typeof value === "string" && uuidPattern.test(value);
};

const parseUuidList = (value) => {
  if (!value || typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const parsePositiveInteger = (value, fallback) => {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

const validateGetMasterlist = (req, res, next) => {
  try {
    const {
      disaster_event_id,
      barangay_id,
      record_status,
      page,
      pageSize,
      search,
      sector_ids,
      sort_order,
    } = req.query;

    if (!isValidUuid(disaster_event_id)) {
      return res.status(400).json({
        message: "disaster_event_id is required and must be a valid UUID",
      });
    }

    if (barangay_id !== undefined && !isValidUuid(barangay_id)) {
      return res.status(400).json({
        message: "barangay_id must be a valid UUID when provided",
      });
    }

    if (
      record_status !== undefined &&
      !["active", "archived", "all"].includes(String(record_status).toLowerCase())
    ) {
      return res.status(400).json({
        message: "record_status must be active, archived, or all when provided",
      });
    }

    const hasPage = page !== undefined;
    const hasPageSize = pageSize !== undefined;
    const parsedPage = hasPage ? parsePositiveInteger(page, 1) : null;
    const parsedPageSize = hasPageSize
      ? Math.min(parsePositiveInteger(pageSize, 25), 100)
      : null;
    const parsedSectorTokens = parseUuidList(sector_ids);
    const parsedSectorIds = parsedSectorTokens.filter(isValidUuid);
    const parsedSectorCodes = parsedSectorTokens.filter(
      (sectorToken) => !isValidUuid(sectorToken),
    );

    if (hasPage && String(parsedPage) !== String(Number.parseInt(page, 10))) {
      return res.status(400).json({
        message: "page must be a positive integer when provided",
      });
    }

    if (hasPageSize) {
      const requestedPageSize = Number.parseInt(pageSize, 10);

      if (
        !Number.isInteger(requestedPageSize) ||
        requestedPageSize < 1 ||
        requestedPageSize > 100
      ) {
        return res.status(400).json({
          message: "pageSize must be an integer between 1 and 100",
        });
      }
    }

    if (
      sort_order !== undefined &&
      !["newest", "oldest", "az", "za"].includes(String(sort_order).toLowerCase())
    ) {
      return res.status(400).json({
        message: "sort_order must be newest, oldest, az, or za when provided",
      });
    }

    req.validatedQuery = {
      disaster_event_id,
      barangay_id: barangay_id || null,
      record_status: String(record_status || "active").toLowerCase(),
      page: parsedPage,
      pageSize: parsedPageSize,
      search: typeof search === "string" ? search.trim() : "",
      sector_ids: parsedSectorIds,
      sector_codes: parsedSectorCodes,
      sort_order: String(sort_order || "newest").toLowerCase(),
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate masterlist request",
      error: error.message,
    });
  }
};

const validateExportMswdoMasterlist = (req, res, next) => {
  try {
    const {
      disaster_event_id,
      barangay_id,
      barangay_ids,
      format,
      search,
      sector_ids,
      record_status,
      sort_order,
    } =
      req.query;

    if (!isValidUuid(disaster_event_id)) {
      return res.status(400).json({
        message: "disaster_event_id is required and must be a valid UUID",
      });
    }

    if (barangay_id !== undefined && barangay_id !== "" && !isValidUuid(barangay_id)) {
      return res.status(400).json({
        message: "barangay_id must be a valid UUID when provided",
      });
    }

    const parsedBarangayIds = parseUuidList(barangay_ids);

    if (parsedBarangayIds.some((barangayUuid) => !isValidUuid(barangayUuid))) {
      return res.status(400).json({
        message: "barangay_ids must contain valid UUID values",
      });
    }

    if (!["pdf", "excel", "csv"].includes(String(format || "").toLowerCase())) {
      return res.status(400).json({
        message: "format must be one of: pdf, excel, csv",
      });
    }

    const parsedSectorIds = parseUuidList(sector_ids);

    if (parsedSectorIds.some((sectorId) => !isValidUuid(sectorId))) {
      return res.status(400).json({
        message: "sector_ids must contain valid UUID values",
      });
    }

    if (
      record_status !== undefined &&
      !["active", "archived", "all"].includes(
        String(record_status).toLowerCase(),
      )
    ) {
      return res.status(400).json({
        message: "record_status must be active, archived, or all when provided",
      });
    }

    if (
      sort_order !== undefined &&
      !["newest", "oldest", "az", "za"].includes(
        String(sort_order).toLowerCase(),
      )
    ) {
      return res.status(400).json({
        message: "sort_order must be newest, oldest, az, or za when provided",
      });
    }

    req.validatedQuery = {
      disaster_event_id,
      barangay_id: barangay_id || null,
      barangay_ids: parsedBarangayIds,
      format: String(format).toLowerCase(),
      search: typeof search === "string" ? search : "",
      record_status: String(record_status || "active").toLowerCase(),
      sort_order: String(sort_order || "newest").toLowerCase(),
      sector_ids: parsedSectorIds,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate masterlist export request",
      error: error.message,
    });
  }
};

const validateGetBarangayDashboard = (req, res, next) => {
  try {
    const { user_id, disaster_event_id, event_scope, override_barangay_id } =
      req.query;

    const hasUserId =
      user_id !== undefined &&
      user_id !== null &&
      user_id !== "";

    if (hasUserId && !isValidUuid(user_id)) {
      return res.status(400).json({
        message: "user_id must be a valid UUID when provided",
      });
    }

    if (
      disaster_event_id !== undefined &&
      disaster_event_id !== null &&
      disaster_event_id !== "" &&
      !isValidUuid(disaster_event_id)
    ) {
      return res.status(400).json({
        message: "disaster_event_id must be a valid UUID when provided",
      });
    }

    if (
      event_scope !== undefined &&
      !["active", "ended"].includes(String(event_scope).toLowerCase())
    ) {
      return res.status(400).json({
        message: "event_scope must be active or ended when provided",
      });
    }

    if (
      override_barangay_id !== undefined &&
      override_barangay_id !== null &&
      override_barangay_id !== "" &&
      !isValidUuid(override_barangay_id)
    ) {
      return res.status(400).json({
        message: "override_barangay_id must be a valid UUID when provided",
      });
    }

    if (!hasUserId && !override_barangay_id) {
      return res.status(400).json({
        error: "NO_ASSIGNED_BARANGAY",
        message: "No assigned barangay. Please contact administrator.",
      });
    }

    req.validatedQuery = {
      user_id: hasUserId ? user_id : null,
      disaster_event_id: disaster_event_id || null,
      event_scope: String(event_scope || "active").toLowerCase(),
      override_barangay_id: override_barangay_id || null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate barangay dashboard request",
      error: error.message,
    });
  }
};

module.exports = {
  validateExportMswdoMasterlist,
  validateGetMasterlist,
  validateGetBarangayDashboard,
};
