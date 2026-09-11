const { logAuditSafely, pickDefined } = require("./systemLog");

const DISTRIBUTION_AUDIT_ENTITY_TYPE = "DISTRIBUTION_TRANSACTION";

const summarizeDistributionTransaction = (transaction) =>
  pickDefined(transaction, [
    "id",
    "disaster_event_id",
    "household_id",
    "stub_id",
    "distribution_status",
    "claimed_by_name",
    "verified_by",
    "qr_reference_value",
    "receipt_no",
    "receipt_status",
    "received_at",
    "relief_pack_template_id",
    "remarks",
  ]);

const buildDistributionAuditSourceEventKey = (distributionTransactionId) =>
  distributionTransactionId
    ? `distribution-claim:${distributionTransactionId}`
    : null;

const recordDistributionAudit = async ({
  actor,
  action,
  distributionTransaction,
}) => {
  if (!distributionTransaction?.id) {
    return;
  }

  await logAuditSafely({
    actor,
    action,
    entityType: DISTRIBUTION_AUDIT_ENTITY_TYPE,
    entityId: distributionTransaction.id,
    oldValues: {},
    newValues: summarizeDistributionTransaction(distributionTransaction),
    sourceEventKey: buildDistributionAuditSourceEventKey(
      distributionTransaction.id,
    ),
  });
};

module.exports = {
  DISTRIBUTION_AUDIT_ENTITY_TYPE,
  summarizeDistributionTransaction,
  buildDistributionAuditSourceEventKey,
  recordDistributionAudit,
};
