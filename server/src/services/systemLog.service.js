const systemLogRepository = require("../repositories/systemLog.repository");

const AUDIT_MODULE_LABELS = {
  INVENTORY_ITEM: "Inventory",
  INVENTORY_BATCH: "Inventory",
  INVENTORY_TRANSACTION: "Inventory",
  DONATION: "Donations",
  DONATION_ITEM: "Donations",
  DONATION_NEED: "Donations",
  HOUSEHOLD: "Households",
  HOUSEHOLD_MEMBER: "Households",
  EVACUATION_LOG: "Evacuation",
  DISTRIBUTION_TRANSACTION: "Distribution",
  DISASTER_EVENT: "Disaster Events",
  SUPPLIER: "Inventory",
  STUB: "Stub Distribution",
};

const buildPerformedByLabel = (row) => {
  if (row.first_name || row.last_name) {
    return [row.first_name, row.last_name].filter(Boolean).join(" ");
  }

  return row.email || "System";
};

const inferAuditModule = (row) => {
  return (
    AUDIT_MODULE_LABELS[row.entity_type] ||
    row.entity_type
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
};

const buildValueSummary = (payload = {}) => {
  const keys = Object.keys(payload || {});

  if (!keys.length) {
    return "-";
  }

  return keys.slice(0, 4).join(", ");
};

const getSystemLogReview = async ({ limit = 50, type = "all" } = {}) => {
  const shouldLoadAuditLogs = type === "all" || type === "audit";
  const shouldLoadErrorLogs = type === "all" || type === "error";

  const [auditLogs, errorLogs] = await Promise.all([
    shouldLoadAuditLogs ? systemLogRepository.getAuditLogs({ limit }) : [],
    shouldLoadErrorLogs ? systemLogRepository.getErrorLogs({ limit }) : [],
  ]);

  return {
    filters: {
      limit,
      type,
    },
    audit_logs: auditLogs.map((row) => ({
      id: row.id,
      action: row.action,
      module: inferAuditModule(row),
      performed_by: buildPerformedByLabel(row),
      role_code: row.role_code || null,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      timestamp: row.created_at,
      status: "SUCCESS",
      details: {
        changed_fields: buildValueSummary(row.new_values_json),
        previous_fields: buildValueSummary(row.old_values_json),
      },
    })),
    error_logs: errorLogs.map((row) => ({
      id: row.id,
      action: row.error_code || "SYSTEM_ERROR",
      module: row.module_name,
      performed_by: buildPerformedByLabel(row),
      timestamp: row.created_at,
      status: row.severity || "ERROR",
      error_message: row.error_message,
      stack_trace: row.stack_trace || null,
    })),
  };
};

module.exports = {
  getSystemLogReview,
};
