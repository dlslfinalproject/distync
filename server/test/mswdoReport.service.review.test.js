const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const servicePath = path.resolve(__dirname, "../src/services/mswdoReport.service.js");
const repositoryPath = path.resolve(
  __dirname,
  "../src/repositories/mswdoReport.repository.js",
);
const systemLogPath = path.resolve(__dirname, "../src/utils/systemLog.js");

const loadService = ({ repository, auditImpl = async () => {} }) => {
  const originalServiceEntry = require.cache[servicePath];
  const originalRepositoryEntry = require.cache[repositoryPath];
  const originalSystemLogEntry = require.cache[systemLogPath];

  delete require.cache[servicePath];
  require.cache[repositoryPath] = {
    id: repositoryPath,
    filename: repositoryPath,
    loaded: true,
    exports: repository,
  };
  require.cache[systemLogPath] = {
    id: systemLogPath,
    filename: systemLogPath,
    loaded: true,
    exports: {
      logAuditSafely: auditImpl,
    },
  };

  const service = require(servicePath);

  const restore = () => {
    delete require.cache[servicePath];

    if (originalServiceEntry) require.cache[servicePath] = originalServiceEntry;
    if (originalRepositoryEntry) require.cache[repositoryPath] = originalRepositoryEntry;
    else delete require.cache[repositoryPath];
    if (originalSystemLogEntry) require.cache[systemLogPath] = originalSystemLogEntry;
    else delete require.cache[systemLogPath];
  };

  return { service, restore };
};

test("Barangay anomaly review revalidates derived anomaly before persisting", async () => {
  let lookupFilters = null;
  let upsertPayload = null;
  let auditPayload = null;
  const { service, restore } = loadService({
    repository: {
      findAnomalyBySourceIdentity: async (filters) => {
        lookupFilters = filters;
        return {
          source_type: "ERROR_LOG",
          source_id: "error-1",
          anomaly_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
          barangay_id: "barangay-a",
          disaster_event_id: "event-1",
          manual_review_allowed: true,
        };
      },
      upsertAnomalyReview: async (payload) => {
        upsertPayload = payload;
        return {
          id: "review-1",
          source_type: payload.sourceType,
          source_id: payload.sourceId,
          anomaly_type: payload.anomalyType,
          barangay_id: payload.barangayId,
          disaster_event_id: payload.disasterEventId,
          review_status: payload.reviewStatus,
          resolution_reason: payload.resolutionReason,
          reviewed_by: payload.reviewedBy,
          reviewed_at: "2026-08-22T00:00:00.000Z",
        };
      },
    },
    auditImpl: async (payload) => {
      auditPayload = payload;
    },
  });

  try {
    const review = await service.upsertBarangayAnomalyReview({
      barangayId: "barangay-a",
      auth: { userId: "user-1", roleCode: "BARANGAY" },
      payload: {
        source_type: "ERROR_LOG",
        source_id: "error-1",
        anomaly_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
        review_status: "REVIEWED_VALID",
        resolution_reason: "Same name, but verified as a legitimate separate household.",
      },
    });

    assert.deepEqual(lookupFilters, {
      barangayId: "barangay-a",
      anomalyType: "DUPLICATE_HOUSEHOLD_REGISTRATION",
      sourceType: "ERROR_LOG",
      sourceId: "error-1",
      roleScope: "BARANGAY",
    });
    assert.equal(upsertPayload.reviewedBy, "user-1");
    assert.equal(upsertPayload.barangayId, "barangay-a");
    assert.equal(review.review_status, "REVIEWED_VALID");
    assert.equal(auditPayload.action, "ANOMALY_REVIEW_CREATE");
  } finally {
    restore();
  }
});

test("Barangay anomaly review refuses disappeared or sync-center-owned anomalies", async () => {
  const missingHarness = loadService({
    repository: {
      findAnomalyBySourceIdentity: async () => null,
      upsertAnomalyReview: async () => {
        throw new Error("should not persist");
      },
    },
  });

  try {
    await assert.rejects(
      async () =>
        missingHarness.service.upsertBarangayAnomalyReview({
          barangayId: "barangay-a",
          auth: { userId: "user-1", roleCode: "BARANGAY" },
          payload: {
            source_type: "ERROR_LOG",
            source_id: "missing",
            anomaly_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
            review_status: "REFERRED",
            resolution_reason: "Needs another office.",
          },
        }),
      (error) => {
        assert.equal(error.statusCode, 404);
        assert.equal(error.code, "ANOMALY_REVIEW_UNAVAILABLE");
        assert.match(error.message, /no longer available for review/);
        return true;
      },
    );
  } finally {
    missingHarness.restore();
  }

  const syncHarness = loadService({
    repository: {
      findAnomalyBySourceIdentity: async () => ({
        anomaly_type: "SYNC_CONFLICT",
        manual_review_allowed: false,
      }),
      upsertAnomalyReview: async () => {
        throw new Error("should not persist");
      },
    },
  });

  try {
    await assert.rejects(
      async () =>
        syncHarness.service.upsertBarangayAnomalyReview({
          barangayId: "barangay-a",
          auth: { userId: "user-1", roleCode: "BARANGAY" },
          payload: {
            source_type: "SYNC_CONFLICT",
            source_id: "conflict-1",
            anomaly_type: "SYNC_CONFLICT",
            review_status: "ISSUE_CONFIRMED",
            resolution_reason: "Trying to resolve here.",
          },
        }),
      (error) => {
        assert.match(error.message, /not eligible|cannot be reviewed/);
        return true;
      },
    );
  } finally {
    syncHarness.restore();
  }
});

test("Barangay anomaly review refuses currently listed but non-reviewable anomalies with a structured conflict", async () => {
  let upsertCalled = false;
  const { service, restore } = loadService({
    repository: {
      findAnomalyBySourceIdentity: async () => ({
        anomaly_type: "FAILED_STUB_OR_QR_VERIFICATION",
        manual_review_allowed: false,
      }),
      upsertAnomalyReview: async () => {
        upsertCalled = true;
        throw new Error("should not persist");
      },
    },
  });

  try {
    await assert.rejects(
      async () =>
        service.upsertBarangayAnomalyReview({
          barangayId: "barangay-a",
          auth: { userId: "user-1", roleCode: "BARANGAY" },
          payload: {
            source_type: "ERROR_LOG",
            source_id: "excluded-invalid-qr",
            anomaly_type: "FAILED_STUB_OR_QR_VERIFICATION",
            review_status: "ISSUE_CONFIRMED",
            resolution_reason: "Reviewed from an old open modal.",
          },
        }),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, "ANOMALY_REVIEW_NOT_ALLOWED");
        assert.match(error.message, /cannot be reviewed here/);
        return true;
      },
    );
    assert.equal(upsertCalled, false);
  } finally {
    restore();
  }
});
