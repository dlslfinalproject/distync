const mswdoReportRepository = require("../repositories/mswdoReport.repository");
const { logAuditSafely } = require("../utils/systemLog");

const MANUAL_REVIEW_ANOMALY_TYPES = new Set([
  "SUSPICIOUS_DISTRIBUTION_ACTIVITY",
  "DUPLICATE_HOUSEHOLD_REGISTRATION",
  "INVENTORY_DISTRIBUTION_MISMATCH",
  "FAILED_STUB_OR_QR_VERIFICATION",
]);

const createHttpError = (statusCode, message, code = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const getAnomalyTracking = async (filters) => {
  return mswdoReportRepository.getMswdoAnomalyTracking({
    disasterEventId: filters.disasterEventId || filters.disaster_event_id || null,
    barangayId: filters.barangayId || filters.barangay_id || null,
    status: filters.status || null,
    statusCategory: filters.statusCategory || filters.status_category || null,
    anomalyType: filters.anomalyType || filters.anomaly_type || null,
    search: filters.search || null,
    order: filters.order || "newest",
    reviewState: filters.reviewState || filters.review_state || null,
    roleScope: filters.roleScope || filters.role_scope || null,
    dateFrom: filters.dateFrom || filters.date_from || null,
    dateTo: filters.dateTo || filters.date_to || null,
    limit: filters.limit || 100,
    page: filters.page || 1,
    pageSize: filters.pageSize || filters.page_size || filters.limit || 50,
  });
};

const upsertBarangayAnomalyReview = async ({ payload, auth, barangayId }) => {
  if (!barangayId) {
    throw createHttpError(403, "No assigned barangay. Please contact administrator.");
  }

  if (!auth?.userId) {
    throw createHttpError(401, "Authentication is required for this request");
  }

  if (!MANUAL_REVIEW_ANOMALY_TYPES.has(payload.anomaly_type)) {
    throw createHttpError(
      400,
      "This anomaly is not eligible for manual Barangay review",
    );
  }

  const anomaly = await mswdoReportRepository.findAnomalyBySourceIdentity({
    barangayId,
    anomalyType: payload.anomaly_type,
    sourceType: payload.source_type,
    sourceId: payload.source_id,
    roleScope: "BARANGAY",
  });

  if (!anomaly) {
    throw createHttpError(
      404,
      "This anomaly is no longer available for review. Its underlying record may have changed or it may no longer require Barangay review.",
      "ANOMALY_REVIEW_UNAVAILABLE",
    );
  }

  if (anomaly.manual_review_allowed !== true) {
    throw createHttpError(
      409,
      "This anomaly is handled in its owning workflow and cannot be reviewed here.",
      "ANOMALY_REVIEW_NOT_ALLOWED",
    );
  }

  const existingReview = anomaly.review_id
    ? {
        id: anomaly.review_id,
        review_status: anomaly.review_status,
        resolution_reason: anomaly.resolution_reason,
        reviewed_by: anomaly.reviewed_by,
        reviewed_at: anomaly.reviewed_at,
      }
    : null;

  const review = await mswdoReportRepository.upsertAnomalyReview({
    sourceType: payload.source_type,
    sourceId: payload.source_id,
    anomalyType: payload.anomaly_type,
    barangayId,
    disasterEventId: anomaly.disaster_event_id || null,
    reviewStatus: payload.review_status,
    resolutionReason: payload.resolution_reason,
    reviewedBy: auth.userId,
  });

  await logAuditSafely({
    actor: {
      userId: auth.userId,
      roleCode: auth.roleCode,
      deviceId: auth.deviceId || null,
      ipAddress: auth.ipAddress || null,
    },
    action: existingReview ? "ANOMALY_REVIEW_UPDATE" : "ANOMALY_REVIEW_CREATE",
    entityType: "ANOMALY_REVIEW",
    entityId: review.id,
    oldValues: existingReview || {},
    newValues: {
      id: review.id,
      source_type: review.source_type,
      source_id: review.source_id,
      anomaly_type: review.anomaly_type,
      barangay_id: review.barangay_id,
      disaster_event_id: review.disaster_event_id,
      review_status: review.review_status,
      resolution_reason: review.resolution_reason,
      reviewed_by: review.reviewed_by,
      reviewed_at: review.reviewed_at,
    },
  });

  return review;
};

module.exports = {
  getAnomalyTracking,
  upsertBarangayAnomalyReview,
};
