const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => {
  return typeof value === "string" && uuidPattern.test(value);
};

const isValidClientSyncId = (value) => {
  return (
    typeof value === "string" &&
    value.length <= 80 &&
    /^[A-Za-z0-9:_-]+$/.test(value)
  );
};

const isValidDateString = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
};

const validateProcessSyncEntries = (req, res, next) => {
  try {
    const { entries } = req.body || {};

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        message: "entries must be a non-empty array",
      });
    }

    const normalizedEntries = [];

    for (const entry of entries) {
      if (!entry || typeof entry !== "object") {
        return res.status(400).json({
          message: "Each sync entry must be an object",
        });
      }

      if (typeof entry.client_sync_id !== "string" || !entry.client_sync_id.trim()) {
        return res.status(400).json({
          message: "client_sync_id is required for every sync entry",
        });
      }

      const clientSyncId = entry.client_sync_id.trim();

      if (!isValidClientSyncId(clientSyncId)) {
        return res.status(400).json({
          message:
            "client_sync_id must be 80 characters or fewer and contain only letters, numbers, colon, underscore, or hyphen",
        });
      }

      if (typeof entry.action_key !== "string" || !entry.action_key.trim()) {
        return res.status(400).json({
          message: "action_key is required for every sync entry",
        });
      }

      if (typeof entry.entity_type !== "string" || !entry.entity_type.trim()) {
        return res.status(400).json({
          message: "entity_type is required for every sync entry",
        });
      }

      if (!isValidDateString(entry.client_timestamp)) {
        return res.status(400).json({
          message: "client_timestamp must be a valid ISO date string",
        });
      }

      if (
        entry.client_updated_at !== undefined &&
        entry.client_updated_at !== null &&
        !isValidDateString(entry.client_updated_at)
      ) {
        return res.status(400).json({
          message: "client_updated_at must be a valid ISO date string when provided",
        });
      }

      if (
        entry.entity_server_id !== undefined &&
        entry.entity_server_id !== null &&
        !isValidUuid(entry.entity_server_id)
      ) {
        return res.status(400).json({
          message: "entity_server_id must be a valid UUID when provided",
        });
      }

      if (
        entry.device_id !== undefined &&
        entry.device_id !== null &&
        !isValidUuid(entry.device_id)
      ) {
        return res.status(400).json({
          message: "device_id must be a valid UUID when provided",
        });
      }

      if (!entry.payload || typeof entry.payload !== "object") {
        return res.status(400).json({
          message: "payload is required for every sync entry",
        });
      }

      normalizedEntries.push({
        client_sync_id: clientSyncId,
        action_key: entry.action_key.trim(),
        entity_type: entry.entity_type.trim(),
        entity_local_id:
          typeof entry.entity_local_id === "string" && entry.entity_local_id.trim()
            ? entry.entity_local_id.trim()
            : null,
        entity_server_id: entry.entity_server_id || null,
        device_id: entry.device_id || null,
        client_timestamp: entry.client_timestamp,
        client_updated_at: entry.client_updated_at || null,
        payload: entry.payload,
      });
    }

    req.validatedBody = {
      entries: normalizedEntries,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate sync payload",
      error: error.message,
    });
  }
};

const validateGetSyncHistory = (req, res, next) => {
  try {
    const { sync_status, conflict_status, limit } = req.query || {};
    const parsedLimit =
      limit === undefined ? 50 : Number.parseInt(String(limit), 10);

    if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 200) {
      return res.status(400).json({
        message: "limit must be an integer between 1 and 200",
      });
    }

    req.validatedQuery = {
      sync_status:
        typeof sync_status === "string" && sync_status.trim()
          ? sync_status.trim().toUpperCase()
          : null,
      conflict_status:
        typeof conflict_status === "string" && conflict_status.trim()
          ? conflict_status.trim().toUpperCase()
          : null,
      limit: parsedLimit,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate sync history query",
      error: error.message,
    });
  }
};

const validateGetSyncConflictDetail = (req, res, next) => {
  try {
    const { conflictId } = req.params || {};

    if (!isValidUuid(conflictId)) {
      return res.status(400).json({
        message: "conflictId must be a valid UUID",
      });
    }

    req.validatedParams = {
      conflictId,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate sync conflict detail request",
      error: error.message,
    });
  }
};

const validateAuditSyncRetryRequest = (req, res, next) => {
  try {
    const { entries } = req.body || {};

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        message: "entries must be a non-empty array",
      });
    }

    const normalizedEntries = [];

    for (const entry of entries) {
      if (!entry || typeof entry !== "object") {
        return res.status(400).json({
          message: "Each retry audit entry must be an object",
        });
      }

      normalizedEntries.push({
        id:
          typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : null,
        sync_transaction_id:
          typeof entry.sync_transaction_id === "string" &&
          entry.sync_transaction_id.trim()
            ? entry.sync_transaction_id.trim()
            : null,
        module_name:
          typeof entry.module_name === "string" && entry.module_name.trim()
            ? entry.module_name.trim()
            : null,
        entity_type:
          typeof entry.entity_type === "string" && entry.entity_type.trim()
            ? entry.entity_type.trim()
            : null,
        action_key:
          typeof entry.action_key === "string" && entry.action_key.trim()
            ? entry.action_key.trim()
            : null,
        status:
          typeof entry.status === "string" && entry.status.trim()
            ? entry.status.trim().toUpperCase()
            : null,
      });
    }

    req.validatedBody = {
      entries: normalizedEntries,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate sync retry audit request",
      error: error.message,
    });
  }
};

module.exports = {
  validateProcessSyncEntries,
  validateGetSyncHistory,
  validateGetSyncConflictDetail,
  validateAuditSyncRetryRequest,
};
