const test = require("node:test");
const assert = require("node:assert/strict");

const auditUtilityPath = require.resolve("../src/utils/distributionAudit");
const systemLogPath = require.resolve("../src/utils/systemLog");

const withStubbedAuditUtility = async (systemLogStub, runTest) => {
  const originalSystemLog = require.cache[systemLogPath];
  const originalAuditUtility = require.cache[auditUtilityPath];

  delete require.cache[auditUtilityPath];
  delete require.cache[systemLogPath];
  require.cache[systemLogPath] = {
    id: systemLogPath,
    filename: systemLogPath,
    loaded: true,
    exports: systemLogStub,
  };

  try {
    const distributionAudit = require(auditUtilityPath);
    await runTest(distributionAudit);
  } finally {
    delete require.cache[auditUtilityPath];
    delete require.cache[systemLogPath];

    if (originalAuditUtility) {
      require.cache[auditUtilityPath] = originalAuditUtility;
    }

    if (originalSystemLog) {
      require.cache[systemLogPath] = originalSystemLog;
    }
  }
};

test("distribution audit records a stable, reviewable transaction summary", async () => {
  const auditCalls = [];

  await withStubbedAuditUtility(
    {
      pickDefined: (value, keys) =>
        Object.fromEntries(
          keys
            .map((key) => [key, value?.[key]])
            .filter(([, item]) => item !== undefined),
        ),
      logAuditSafely: async (payload) => {
        auditCalls.push(payload);
      },
    },
    async ({ recordDistributionAudit }) => {
      await recordDistributionAudit({
        actor: {
          userId: "user-1",
          roleCode: "BARANGAY",
          deviceId: "device-1",
        },
        action: "DISTRIBUTION_RECORD",
        distributionTransaction: {
          id: "distribution-1",
          disaster_event_id: "event-1",
          household_id: "household-1",
          stub_id: "stub-1",
          distribution_status: "CLAIMED",
          receipt_no: "RCPT-1",
          unexpected_internal_value: "must not be logged",
        },
      });
    },
  );

  assert.deepEqual(auditCalls, [
    {
      actor: {
        userId: "user-1",
        roleCode: "BARANGAY",
        deviceId: "device-1",
      },
      action: "DISTRIBUTION_RECORD",
      entityType: "DISTRIBUTION_TRANSACTION",
      entityId: "distribution-1",
      oldValues: {},
      newValues: {
        id: "distribution-1",
        disaster_event_id: "event-1",
        household_id: "household-1",
        stub_id: "stub-1",
        distribution_status: "CLAIMED",
        receipt_no: "RCPT-1",
      },
      sourceEventKey: "distribution-claim:distribution-1",
    },
  ]);
});

test("distribution audit ignores an incomplete transaction payload", async () => {
  let callCount = 0;

  await withStubbedAuditUtility(
    {
      pickDefined: () => ({}),
      logAuditSafely: async () => {
        callCount += 1;
      },
    },
    async ({ recordDistributionAudit }) => {
      await recordDistributionAudit({
        actor: { userId: "user-1" },
        action: "DISTRIBUTION_RECORD",
        distributionTransaction: null,
      });
    },
  );

  assert.equal(callCount, 0);
});

test("distribution audit retains safe claim-proof metadata and excludes private paths or URLs", async () => {
  const auditCalls = [];

  await withStubbedAuditUtility(
    {
      pickDefined: (value, keys) =>
        Object.fromEntries(
          keys
            .map((key) => [key, value?.[key]])
            .filter(([, item]) => item !== undefined),
        ),
      logAuditSafely: async (payload) => auditCalls.push(payload),
    },
    async ({ recordDistributionAudit }) => {
      await recordDistributionAudit({
        actor: { userId: "barangay-user", roleCode: "BARANGAY" },
        action: "DISTRIBUTION_RECORD",
        distributionTransaction: {
          id: "distribution-photo-1",
          proof_type: "PHOTO",
          proof_photo_present: true,
          proof_photo_sha256: "d".repeat(64),
          proof_photo_mime_type: "image/jpeg",
          proof_photo_size_bytes: 1200,
          proof_photo_captured_at: "2026-09-24T03:00:00.000Z",
          proof_photo_path: "private/path/photo.jpg",
          proof_photo_signed_url: "https://storage.example/signed?token=secret",
          proof_photo_data_url: "data:image/jpeg;base64,secret",
        },
      });
    },
  );

  const serializedAudit = JSON.stringify(auditCalls);
  assert.match(serializedAudit, /proof_photo_sha256/);
  assert.match(serializedAudit, /image\/jpeg/);
  assert.doesNotMatch(serializedAudit, /private\/path|signed\?token|data:image/);
});
