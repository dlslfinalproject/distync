const {
  insertAuditLog,
  insertErrorLog,
} = require("../repositories/systemLog.repository");

const MAX_STACK_TRACE_LENGTH = 4000;

const normalizeActor = (actor) => {
  if (!actor) {
    return {
      userId: null,
      roleCode: null,
      deviceId: null,
      ipAddress: null,
    };
  }

  if (typeof actor === "string") {
    return {
      userId: actor,
      roleCode: null,
      deviceId: null,
      ipAddress: null,
    };
  }

  return {
    userId: actor.userId || actor.user_id || null,
    roleCode: actor.roleCode || actor.role_code || null,
    deviceId: actor.deviceId || actor.device_id || null,
    ipAddress: actor.ipAddress || actor.ip_address || null,
  };
};

const pickDefined = (payload, keys) => {
  return keys.reduce((summary, key) => {
    if (payload?.[key] !== undefined) {
      summary[key] = payload[key];
    }

    return summary;
  }, {});
};

const buildStackTrace = (error) => {
  if (!error?.stack) {
    return null;
  }

  return String(error.stack).slice(0, MAX_STACK_TRACE_LENGTH);
};

const logAuditSafely = async ({
  actor,
  action,
  entityType,
  entityId,
  oldValues = {},
  newValues = {},
  sourceEventKey = null,
  throwOnError = false,
}) => {
  const normalizedActor = normalizeActor(actor);

  try {
    await insertAuditLog({
      user_id: normalizedActor.userId,
      role_code: normalizedActor.roleCode,
      device_id: normalizedActor.deviceId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values_json: oldValues,
      new_values_json: newValues,
      ip_address: normalizedActor.ipAddress,
      source_event_key: sourceEventKey,
    });
  } catch (error) {
    if (throwOnError) {
      throw error;
    }

    console.error("Failed to write audit log:", error.message);
  }
};

const logErrorSafely = async ({
  actor,
  moduleName,
  errorCode,
  errorMessage,
  severity = "ERROR",
  error,
  referenceType,
  referenceId,
  context = {},
}) => {
  const normalizedActor = normalizeActor(actor);

  try {
    await insertErrorLog({
      user_id: normalizedActor.userId,
      device_id: normalizedActor.deviceId,
      module_name: moduleName,
      error_code: errorCode,
      error_message: errorMessage,
      stack_trace: buildStackTrace(error),
      severity,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
      context_json: context || {},
    });
  } catch (loggingError) {
    console.error("Failed to write error log:", loggingError.message);
  }
};

module.exports = {
  normalizeActor,
  pickDefined,
  logAuditSafely,
  logErrorSafely,
};
