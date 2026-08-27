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
        resolution_reason: "  Same name, but verified as a legitimate separate household.  ",
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
    assert.equal(
      upsertPayload.resolutionReason,
      "Same name, but verified as a legitimate separate household.",
    );
    assert.equal(review.review_status, "REVIEWED_VALID");
    assert.equal(auditPayload.action, "ANOMALY_REVIEW_CREATE");
  } finally {
    restore();
  }
});

test("anomaly review service rejects missing or whitespace-only notes before persistence", async () => {
  let lookupCalled = false;
  const { service, restore } = loadService({
    repository: {
      findAnomalyBySourceIdentity: async () => {
        lookupCalled = true;
        return null;
      },
    },
  });

  const submit = (resolutionReason) =>
    service.upsertBarangayAnomalyReview({
      barangayId: "barangay-a",
      auth: { userId: "user-1", roleCode: "BARANGAY" },
      payload: {
        source_type: "ERROR_LOG",
        source_id: "error-note",
        anomaly_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
        review_status: "REVIEWED_VALID",
        ...(resolutionReason === undefined ? {} : { resolution_reason: resolutionReason }),
      },
    });

  try {
    for (const resolutionReason of [undefined, null, "", "   "]) {
      await assert.rejects(
        () => submit(resolutionReason),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.message, "Note is required.");
          return true;
        },
      );
    }

    await assert.rejects(
      () => submit("x".repeat(2001)),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.message, "Note must be 2000 characters or fewer.");
        return true;
      },
    );

    assert.equal(lookupCalled, false);
  } finally {
    restore();
  }
});

test("MSWDO anomaly review revalidates in consolidated scope and persists the anomaly Barangay", async () => {
  let lookupFilters = null;
  let createPayload = null;
  let upsertCalled = false;
  const { service, restore } = loadService({
    repository: {
      findAnomalyBySourceIdentity: async (filters) => {
        lookupFilters = filters;
        return {
          source_type: "ERROR_LOG",
          source_id: "error-2",
          anomaly_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
          barangay_id: "barangay-b",
          disaster_event_id: "event-1",
          manual_review_allowed: true,
        };
      },
      createAnomalyReview: async (payload) => {
        createPayload = payload;
        return {
          id: "review-2",
          barangay_id: payload.barangayId,
          review_status: payload.reviewStatus,
        };
      },
      upsertAnomalyReview: async () => {
        upsertCalled = true;
        throw new Error("MSWDO must not use the editable upsert path");
      },
    },
  });

  try {
    const review = await service.upsertAnomalyReview({
      auth: { userId: "mswdo-user", roleCode: "MSWDO" },
      payload: {
        source_type: "ERROR_LOG",
        source_id: "error-2",
        anomaly_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
        review_status: "ISSUE_CONFIRMED",
        resolution_reason: "Validated with the affected Barangay.",
      },
    });

    assert.deepEqual(lookupFilters, {
      barangayId: null,
      anomalyType: "DUPLICATE_HOUSEHOLD_REGISTRATION",
      sourceType: "ERROR_LOG",
      sourceId: "error-2",
      roleScope: "MSWDO",
    });
    assert.equal(createPayload.barangayId, "barangay-b");
    assert.equal(createPayload.reviewedBy, "mswdo-user");
    assert.equal(upsertCalled, false);
    assert.equal(review.review_status, "ISSUE_CONFIRMED");
  } finally {
    restore();
  }
});

test("MSWDO anomaly review rejects an existing completed review without rewriting or auditing it", async () => {
  let createCalled = false;
  let auditCalled = false;
  const { service, restore } = loadService({
    repository: {
      findAnomalyBySourceIdentity: async () => ({
        source_type: "ERROR_LOG",
        source_id: "error-final",
        anomaly_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
        barangay_id: "barangay-b",
        disaster_event_id: "event-1",
        manual_review_allowed: true,
        review_id: "review-final",
        review_status: "REVIEWED_VALID",
        resolution_reason: "Original review note.",
        reviewed_by: "original-reviewer",
        reviewed_at: "2026-08-22T00:00:00.000Z",
      }),
      createAnomalyReview: async () => {
        createCalled = true;
        throw new Error("MSWDO must not rewrite a completed review");
      },
      upsertAnomalyReview: async () => {
        createCalled = true;
        throw new Error("MSWDO must not use the editable upsert path");
      },
    },
    auditImpl: async () => {
      auditCalled = true;
    },
  });

  try {
    await assert.rejects(
      async () =>
        service.upsertAnomalyReview({
          auth: { userId: "new-reviewer", roleCode: "MSWDO" },
          payload: {
            source_type: "ERROR_LOG",
            source_id: "error-final",
            anomaly_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
            review_status: "ISSUE_CONFIRMED",
            resolution_reason: "Attempted replacement note.",
          },
        }),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, "ANOMALY_REVIEW_FINAL");
        assert.match(error.message, /already been reviewed/);
        return true;
      },
    );
    assert.equal(createCalled, false);
    assert.equal(auditCalled, false);
  } finally {
    restore();
  }
});

test("MSWDO anomaly review maps a concurrent unique-identity race to final-review conflict", async () => {
  const { service, restore } = loadService({
    repository: {
      findAnomalyBySourceIdentity: async () => ({
        source_type: "ERROR_LOG",
        source_id: "error-race",
        anomaly_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
        barangay_id: "barangay-b",
        disaster_event_id: "event-1",
        manual_review_allowed: true,
        review_id: null,
      }),
      createAnomalyReview: async () => {
        const error = new Error("duplicate key value violates unique constraint");
        error.code = "23505";
        throw error;
      },
    },
  });

  try {
    await assert.rejects(
      async () =>
        service.upsertAnomalyReview({
          auth: { userId: "racing-reviewer", roleCode: "MSWDO" },
          payload: {
            source_type: "ERROR_LOG",
            source_id: "error-race",
            anomaly_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
            review_status: "REFERRED",
            resolution_reason: "Concurrent review attempt.",
          },
        }),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, "ANOMALY_REVIEW_FINAL");
        return true;
      },
    );
  } finally {
    restore();
  }
});

test("MSWDO first review remains unchanged when a later differing submission is attempted", async () => {
  let persistedReview = null;
  let auditCount = 0;
  const { service, restore } = loadService({
    repository: {
      findAnomalyBySourceIdentity: async () => ({
        source_type: "ERROR_LOG",
        source_id: "error-once",
        anomaly_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
        barangay_id: "barangay-b",
        disaster_event_id: "event-1",
        manual_review_allowed: true,
        ...(persistedReview
          ? {
              review_id: persistedReview.id,
              review_status: persistedReview.review_status,
              resolution_reason: persistedReview.resolution_reason,
              reviewed_by: persistedReview.reviewed_by,
              reviewed_at: persistedReview.reviewed_at,
            }
          : {}),
      }),
      createAnomalyReview: async (payload) => {
        if (persistedReview) {
          const error = new Error("duplicate key value violates unique constraint");
          error.code = "23505";
          throw error;
        }

        persistedReview = {
          id: "review-once",
          source_type: payload.sourceType,
          source_id: payload.sourceId,
          anomaly_type: payload.anomalyType,
          barangay_id: payload.barangayId,
          review_status: payload.reviewStatus,
          resolution_reason: payload.resolutionReason,
          reviewed_by: payload.reviewedBy,
          reviewed_at: "2026-08-27T00:00:00.000Z",
        };
        return persistedReview;
      },
    },
    auditImpl: async () => {
      auditCount += 1;
    },
  });

  const firstPayload = {
    source_type: "ERROR_LOG",
    source_id: "error-once",
    anomaly_type: "DUPLICATE_HOUSEHOLD_REGISTRATION",
    review_status: "ISSUE_CONFIRMED",
    resolution_reason: "Original final review.",
  };

  try {
    const firstReview = await service.upsertAnomalyReview({
      auth: { userId: "first-reviewer", roleCode: "MSWDO" },
      payload: firstPayload,
    });

    await assert.rejects(
      async () =>
        service.upsertAnomalyReview({
          auth: { userId: "second-reviewer", roleCode: "MSWDO" },
          payload: {
            ...firstPayload,
            review_status: "REFERRED",
            resolution_reason: "Attempted second final review.",
          },
        }),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, "ANOMALY_REVIEW_FINAL");
        return true;
      },
    );

    assert.equal(firstReview.review_status, "ISSUE_CONFIRMED");
    assert.equal(persistedReview.review_status, "ISSUE_CONFIRMED");
    assert.equal(persistedReview.resolution_reason, "Original final review.");
    assert.equal(persistedReview.reviewed_by, "first-reviewer");
    assert.equal(auditCount, 1);
  } finally {
    restore();
  }
});

test("MSWDO anomaly review refuses an operational row without Barangay attribution", async () => {
  let upsertCalled = false;
  const { service, restore } = loadService({
    repository: {
      findAnomalyBySourceIdentity: async () => ({
        anomaly_type: "INVENTORY_DISTRIBUTION_MISMATCH",
        barangay_id: null,
        manual_review_allowed: false,
      }),
      upsertAnomalyReview: async () => {
        upsertCalled = true;
        return {};
      },
    },
  });

  try {
    await assert.rejects(
      async () =>
        service.upsertAnomalyReview({
          auth: { userId: "mswdo-user", roleCode: "MSWDO" },
          payload: {
            source_type: "INVENTORY_DISTRIBUTION_ORPHAN_OUTFLOW",
            source_id: "outflow-1",
            anomaly_type: "INVENTORY_DISTRIBUTION_MISMATCH",
            review_status: "REFERRED",
            resolution_reason: "Barangay attribution is still being established.",
          },
        }),
      (error) => {
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, "ANOMALY_REVIEW_BARANGAY_REQUIRED");
        assert.match(error.message, /Barangay must be identified/);
        return true;
      },
    );
    assert.equal(upsertCalled, false);
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
