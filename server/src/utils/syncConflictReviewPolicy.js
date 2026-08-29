const { ROLE_CODES } = require("../modules/auth/auth.middleware");

const CONFLICT_STATUS = Object.freeze({
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
});

const RESOLUTION_STRATEGY = Object.freeze({
  FIRST_ACCEPTED: "FIRST_ACCEPTED",
  LATEST_TIMESTAMP: "LATEST_TIMESTAMP",
  MANUAL_REVIEW: "MANUAL_REVIEW",
});

const RESOLUTION_ACTION = Object.freeze({
  MARK_REVIEWED: "MARK_REVIEWED",
  KEEP_SERVER: "KEEP_SERVER",
  APPLY_LOCAL: "APPLY_LOCAL",
});

const INVENTORY_STOCK_STATE_DRIFT = "INVENTORY_STOCK_STATE_DRIFT";
const POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE =
  "POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE";

const isManualInventoryStockDriftReviewable = (conflict = {}) =>
  conflict.status === CONFLICT_STATUS.OPEN &&
  conflict.resolution_strategy === RESOLUTION_STRATEGY.MANUAL_REVIEW &&
  conflict.conflict_type === INVENTORY_STOCK_STATE_DRIFT;

const isSyncConflictOwnedByUser = (conflict = {}, auth = {}) =>
  Boolean(conflict.user_id && auth.userId && conflict.user_id === auth.userId);

const canReviewSyncConflict = (conflict = {}, auth = {}) =>
  auth?.roleCode === ROLE_CODES.MAYOR &&
  isManualInventoryStockDriftReviewable(conflict);

const getSyncConflictReviewCapability = (conflict = {}, auth = {}) => ({
  isOwnedByUser: isSyncConflictOwnedByUser(conflict, auth),
  canReview: canReviewSyncConflict(conflict, auth),
});

const isPossibleCrossBarangayHouseholdDuplicate = (conflict = {}) =>
  conflict.status === CONFLICT_STATUS.OPEN &&
  conflict.resolution_strategy === RESOLUTION_STRATEGY.MANUAL_REVIEW &&
  conflict.conflict_type === POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE;

module.exports = {
  CONFLICT_STATUS,
  RESOLUTION_STRATEGY,
  RESOLUTION_ACTION,
  INVENTORY_STOCK_STATE_DRIFT,
  POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE,
  isManualInventoryStockDriftReviewable,
  isSyncConflictOwnedByUser,
  canReviewSyncConflict,
  getSyncConflictReviewCapability,
  isPossibleCrossBarangayHouseholdDuplicate,
};
