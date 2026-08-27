const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateGetSyncHistory,
  validateProcessSyncEntries,
} = require("../src/validators/sync.validator");

const createResponse = () => {
  const response = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  return response;
};

const baseEntry = {
  client_sync_id: "11111111-1111-4111-8111-111111111111",
  action_key: "HOUSEHOLD_REGISTER",
  entity_type: "HOUSEHOLD",
  entity_local_id: "local-household-1",
  client_timestamp: "2026-08-08T01:00:00.000Z",
  payload: {
    family_head_first_name: "Local",
  },
};

test("validateProcessSyncEntries accepts bounded UUID or legacy local client sync ids", () => {
  for (const clientSyncId of [
    "11111111-1111-4111-8111-111111111111",
    "local-1770000000000-abcd1234",
  ]) {
    const req = {
      body: {
        entries: [
          {
            ...baseEntry,
            client_sync_id: clientSyncId,
          },
        ],
      },
    };
    const res = createResponse();
    let nextCalled = false;

    validateProcessSyncEntries(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.validatedBody.entries[0].client_sync_id, clientSyncId);
  }
});

test("validateProcessSyncEntries rejects malformed client sync ids", () => {
  const req = {
    body: {
      entries: [
        {
          ...baseEntry,
          client_sync_id: "bad id with spaces and too much meaning",
        },
      ],
    },
  };
  const res = createResponse();
  let nextCalled = false;

  validateProcessSyncEntries(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /client_sync_id must be 80 characters/i);
});

test("validateGetSyncHistory accepts allow-listed sync and conflict statuses", () => {
  const req = {
    query: {
      sync_status: "failed",
      conflict_status: "resolved",
      limit: "100",
    },
  };
  const res = createResponse();
  let nextCalled = false;

  validateGetSyncHistory(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.validatedQuery.sync_status, "FAILED");
  assert.equal(req.validatedQuery.conflict_status, "RESOLVED");
  assert.equal(req.validatedQuery.limit, 100);
});

test("validateGetSyncHistory rejects unsupported filter statuses", () => {
  for (const query of [
    { sync_status: "RESOLVED" },
    { conflict_status: "FAILED" },
  ]) {
    const req = { query };
    const res = createResponse();
    let nextCalled = false;

    validateGetSyncHistory(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 400);
    assert.match(res.payload.message, /must be one of/i);
  }
});

test("validateGetSyncHistory accepts a valid MSWDO Barangay filter", () => {
  const barangayId = "11111111-1111-4111-8111-111111111111";
  const req = {
    query: {
      barangay_id: barangayId,
      limit: "25",
    },
  };
  const res = createResponse();
  let nextCalled = false;

  validateGetSyncHistory(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.validatedQuery.barangay_id, barangayId);
  assert.equal(req.validatedQuery.limit, 25);
});

test("validateGetSyncHistory rejects a malformed Barangay filter", () => {
  const req = {
    query: {
      barangay_id: "not-a-uuid",
    },
  };
  const res = createResponse();
  let nextCalled = false;

  validateGetSyncHistory(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /barangay_id must be a valid UUID/i);
});
