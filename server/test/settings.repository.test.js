const test = require("node:test");
const assert = require("node:assert/strict");

const {
  updateUserProfile,
} = require("../src/repositories/settings.repository");

test("updateUserProfile clears middle_name when middleName is null", async () => {
  const capturedQueries = [];
  const dbClient = {
    async query(sql, params) {
      capturedQueries.push({ sql, params });
      return {
        rows: [
          {
            id: "user-1",
            email: "user@example.com",
            first_name: "Jane Allyson",
            middle_name: null,
            last_name: "Paray",
            contact_number: "+639952071990",
            default_barangay_id: null,
            is_active: true,
          },
        ],
      };
    },
  };

  const result = await updateUserProfile(
    "user-1",
    {
      firstName: "Jane Allyson",
      middleName: null,
      lastName: "Paray",
      contactNumber: "+639952071990",
    },
    dbClient,
  );

  assert.equal(result.middle_name, null);
  assert.equal(capturedQueries.length, 1);
  assert.match(capturedQueries[0].sql, /middle_name = \$3/i);
  assert.doesNotMatch(capturedQueries[0].sql, /middle_name = COALESCE\(\$3, middle_name\)/i);
  assert.equal(capturedQueries[0].params[2], null);
});
