const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateSaveCurrentSettings,
} = require("../src/validators/settings.validator");

const createResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.payload = body;
    return this;
  },
});

test("validateSaveCurrentSettings accepts structured multi-word names", () => {
  const req = {
    body: {
      settings: {
        profile: {
          firstName: "Jane Allyson",
          middleName: "De Leon",
          lastName: "Dela Cruz",
          contactNumber: "09123456789",
        },
      },
    },
  };
  const res = createResponse();
  let nextCalled = false;

  validateSaveCurrentSettings(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.payload, null);
});

test("validateSaveCurrentSettings rejects protected profile fields", () => {
  const req = {
    body: {
      settings: {
        profile: {
          firstName: "Juan",
          lastName: "Reyes",
          contactNumber: "+639171234567",
          emailAddress: "override@example.com",
        },
      },
    },
  };
  const res = createResponse();

  validateSaveCurrentSettings(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.payload.message,
    "Email, role, and barangay assignment cannot be changed from Account Settings.",
  );
});

test("validateSaveCurrentSettings rejects legacy fullName updates", () => {
  const req = {
    body: {
      settings: {
        profile: {
          fullName: "Maria Angela Dela Cruz",
          contactNumber: "+639171234567",
        },
      },
    },
  };
  const res = createResponse();

  validateSaveCurrentSettings(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(
    res.payload.message,
    "Email, role, and barangay assignment cannot be changed from Account Settings.",
  );
});
