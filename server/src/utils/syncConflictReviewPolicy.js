const { ROLE_CODES } = require("../modules/auth/auth.middleware");

const CONFLICT_STATUS = Object.freeze({
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
});

const RESOLUTION_STRATEGY = Object.freeze({
  FIRST_ACCEPTED: "FIRST_ACCEPTED",
  LATEST_TIMESTAMP: "LATEST_TIMESTAMP",
  EARLIEST_ORIGINAL: "EARLIEST_ORIGINAL",
  MANUAL_REVIEW: "MANUAL_REVIEW",
});

const RESOLUTION_ACTION = Object.freeze({
  MARK_REVIEWED: "MARK_REVIEWED",
  KEEP_SERVER: "KEEP_SERVER",
  APPLY_LOCAL: "APPLY_LOCAL",
  ACCEPT_BOTH: "ACCEPT_BOTH",
});

const INVENTORY_STOCK_STATE_DRIFT = "INVENTORY_STOCK_STATE_DRIFT";
const DUPLICATE_INVENTORY_ITEM = "DUPLICATE_INVENTORY_ITEM";
const DUPLICATE_INVENTORY_BARCODE = "DUPLICATE_INVENTORY_BARCODE";
const DUPLICATE_INVENTORY_BATCH = "DUPLICATE_INVENTORY_BATCH";
const POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE =
  "POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE";

const INVENTORY_IDENTITY_CONFLICT_TYPES = new Set([
  DUPLICATE_INVENTORY_ITEM,
  DUPLICATE_INVENTORY_BARCODE,
  DUPLICATE_INVENTORY_BATCH,
]);

const isManualMayorInventoryIdentityConflict = (conflict = {}) =>
  conflict.status === CONFLICT_STATUS.OPEN &&
  conflict.resolution_strategy === RESOLUTION_STRATEGY.MANUAL_REVIEW &&
  INVENTORY_IDENTITY_CONFLICT_TYPES.has(conflict.conflict_type) &&
  ["INVENTORY_ITEM", "INVENTORY_BATCH"].includes(conflict.entity_type);

const isManualInventoryStockDriftReviewable = (conflict = {}) =>
  conflict.status === CONFLICT_STATUS.OPEN &&
  conflict.resolution_strategy === RESOLUTION_STRATEGY.MANUAL_REVIEW &&
  conflict.conflict_type === INVENTORY_STOCK_STATE_DRIFT;

const isSyncConflictOwnedByUser = (conflict = {}, auth = {}) =>
  Boolean(conflict.user_id && auth.userId && conflict.user_id === auth.userId);

const canReviewSyncConflict = (conflict = {}, auth = {}) =>
  auth?.roleCode === ROLE_CODES.MAYOR &&
  (isManualInventoryStockDriftReviewable(conflict) ||
    isManualMayorInventoryIdentityConflict(conflict));

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
  DUPLICATE_INVENTORY_ITEM,
  DUPLICATE_INVENTORY_BARCODE,
  DUPLICATE_INVENTORY_BATCH,
  INVENTORY_IDENTITY_CONFLICT_TYPES,
  POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE,
  isManualInventoryStockDriftReviewable,
  isManualMayorInventoryIdentityConflict,
  isSyncConflictOwnedByUser,
  canReviewSyncConflict,
  getSyncConflictReviewCapability,
  isPossibleCrossBarangayHouseholdDuplicate,
};
