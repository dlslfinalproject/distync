const assert = require("node:assert/strict");
const test = require("node:test");

const {
  validateDonationManagementTransparency,
  validatePublicDonationPortal,
} = require("../src/validators/donation.validator");

const runValidator = (query) => {
  const response = {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const request = { query };
  let nextCalled = false;

  validatePublicDonationPortal(request, response, () => {
    nextCalled = true;
  });

  return { nextCalled, request, response };
};

const runManagementTransparencyValidator = (query) => {
  const response = {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const request = { query };
  let nextCalled = false;

  validateDonationManagementTransparency(request, response, () => {
    nextCalled = true;
  });

  return { nextCalled, request, response };
};

test("public portal pagination is optional and normalizes a complete pair", () => {
  const legacy = runValidator({});
  assert.equal(legacy.nextCalled, true);
  assert.deepEqual(legacy.request.validatedQuery, {
    disaster_event_id: null,
    transparency_page: null,
    transparency_page_size: null,
  });

  const paginated = runValidator({
    disaster_event_id: "00000000-0000-4000-8000-000000000001",
    transparency_page: "2",
    transparency_page_size: "50",
  });
  assert.equal(paginated.nextCalled, true);
  assert.deepEqual(paginated.request.validatedQuery, {
    disaster_event_id: "00000000-0000-4000-8000-000000000001",
    transparency_page: 2,
    transparency_page_size: 50,
  });
});

test("public portal pagination rejects a partial pair", () => {
  for (const query of [
    { transparency_page: "1" },
    { transparency_page_size: "25" },
  ]) {
    const result = runValidator(query);
    assert.equal(result.nextCalled, false);
    assert.equal(result.response.statusCode, 400);
    assert.match(
      result.response.body.message,
      /transparency_page and transparency_page_size must be provided together/,
    );
  }
});

test("public portal pagination rejects malformed and out-of-range values", () => {
  for (const value of ["0", "-1", "abc", "1.5", "1x", "1e2"]) {
    const result = runValidator({
      transparency_page: value,
      transparency_page_size: "25",
    });
    assert.equal(result.nextCalled, false, `page ${value} should be rejected`);
    assert.equal(result.response.statusCode, 400);
  }

  for (const value of ["0", "-1", "101", "abc", "10x", "1.5"]) {
    const result = runValidator({
      transparency_page: "1",
      transparency_page_size: value,
    });
    assert.equal(
      result.nextCalled,
      false,
      `page size ${value} should be rejected`,
    );
    assert.equal(result.response.statusCode, 400);
  }
});

test("Mayor transparency validator accepts optional event scope only", () => {
  const allEvents = runManagementTransparencyValidator({});
  assert.equal(allEvents.nextCalled, true);
  assert.deepEqual(allEvents.request.validatedQuery, {
    disaster_event_id: null,
  });

  const closedEvent = runManagementTransparencyValidator({
    disaster_event_id: "00000000-0000-4000-8000-000000000001",
  });
  assert.equal(closedEvent.nextCalled, true);
  assert.deepEqual(closedEvent.request.validatedQuery, {
    disaster_event_id: "00000000-0000-4000-8000-000000000001",
  });

  const invalidEvent = runManagementTransparencyValidator({
    disaster_event_id: "closed-event",
  });
  assert.equal(invalidEvent.nextCalled, false);
  assert.equal(invalidEvent.response.statusCode, 400);
});
