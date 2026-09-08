const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const BARANGAY_ID = "22222222-2222-4222-8222-222222222222";

const readSource = (relativePath) =>
  fs.readFile(path.join(__dirname, "..", relativePath), "utf8");

const restoreModuleCache = (entries) => {
  entries.forEach(([modulePath, originalEntry]) => {
    if (originalEntry) {
      require.cache[modulePath] = originalEntry;
    } else {
      delete require.cache[modulePath];
    }
  });
};

const withStubbedMasterlistRepository = async (rows, runTest) => {
  const repositoryPath = require.resolve("../src/repositories/masterlist.repository");
  const poolPath = require.resolve("../src/config/db");
  const originalEntries = [
    [repositoryPath, require.cache[repositoryPath]],
    [poolPath, require.cache[poolPath]],
  ];
  const calls = [];

  delete require.cache[repositoryPath];
  require.cache[poolPath] = {
    id: poolPath,
    filename: poolPath,
    loaded: true,
    exports: {
      query: async (query, values) => {
        calls.push({ query, values });
        return { rows };
      },
    },
  };

  try {
    await runTest(require(repositoryPath), calls);
  } finally {
    delete require.cache[repositoryPath];
    restoreModuleCache(originalEntries);
  }
};

const buildPageRows = (totalItems = 250, pageSize = 25) =>
  Array.from({ length: pageSize }, (_, index) => ({
    household_id: `household-${index + 1}`,
    masterlist_record_id: `record-${index + 1}`,
    filtered_total_count: totalItems,
  }));

test("MSWDO paginated repository returns only the requested page with exact count metadata", async () => {
  await withStubbedMasterlistRepository(
    buildPageRows(),
    async (repository, calls) => {
      const result = await repository.getHouseholdsByFilters(
        EVENT_ID,
        null,
        "active",
        {
          mode: "mswdo",
          page: 1,
          pageSize: 25,
          search: "  PERCENT_%  ",
          sector_codes: ["LACTATING"],
          sort_order: "newest",
        },
      );

      assert.equal(calls.length, 1);
      assert.equal(result.rows.length, 25);
      assert.deepEqual(result.pagination, {
        page: 1,
        pageSize: 25,
        totalItems: 250,
        totalPages: 10,
        hasPreviousPage: false,
        hasNextPage: true,
      });
      assert.equal(result.rows[0].household_id, "household-1");
      assert.deepEqual(calls[0].values, [
        EVENT_ID,
        "%percent\\_\\%%",
        ["LACTATING_MOTHER"],
        25,
        0,
      ]);
    },
  );
});

test("MSWDO query mode carries the client search, sector, status, and sort parity contract", async () => {
  await withStubbedMasterlistRepository(
    buildPageRows(51),
    async (repository, calls) => {
      await repository.getHouseholdsByFilters(
        EVENT_ID,
        BARANGAY_ID,
        "archived",
        {
          mode: "mswdo",
          page: 2,
          pageSize: 25,
          search: "Family Head",
          sector_codes: ["PWD", "SENIOR_CITIZEN"],
          sort_order: "oldest",
        },
      );

      const query = calls[0].query;
      assert.match(query, /records\.is_active IS NOT FALSE/);
      assert.match(query, /records\.attendance_time_out IS NULL/);
      assert.match(query, /UPPER\(COALESCE\(records\.attendance_status, ''\)\) <> 'LEFT'/);
      assert.match(query, /client_family_head_name/);
      assert.match(query, /client_address/);
      assert.match(query, /client_sector_text/);
      assert.match(query, /client_arrival_time_text/);
      assert.match(query, /client_departure_time_text/);
      assert.match(query, /records\.barangay_name/);
      assert.match(query, /LACTATING_MOTHER/);
      assert.match(query, /Staying with Relatives/);
      assert.match(query, /client_sort_timestamp ASC/);
      assert.match(query, /COUNT\(\*\)::int AS filtered_total_count/);
      assert.ok(
        query.indexOf("FROM filtered_records") < query.indexOf("paged_records AS"),
      );
      assert.match(query, /LIMIT \$\d+\s+OFFSET \$\d+/);
      assert.deepEqual(calls[0].values, [
        EVENT_ID,
        BARANGAY_ID,
        "%family head%",
        ["PWD", "SENIOR_CITIZEN"],
        25,
        25,
      ]);
    },
  );
});

test("omitting both pagination parameters preserves the legacy array response and predicates", async () => {
  await withStubbedMasterlistRepository(
    [
      {
        household_id: "legacy-household",
        masterlist_record_id: "legacy-record",
        filtered_total_count: 1,
      },
    ],
    async (repository, calls) => {
      const result = await repository.getHouseholdsByFilters(
        EVENT_ID,
        null,
        "active",
        { search: "family" },
      );

      assert.ok(Array.isArray(result));
      assert.equal(result.length, 1);
      assert.doesNotMatch(calls[0].query, /LIMIT \$/);
      assert.match(calls[0].query, /records\.attendance_log_id IS NOT NULL/);
    },
  );
});

const runValidation = (query) => {
  const validator = require("../src/validators/masterlist.validator");
  const req = { query };
  let statusCode = 200;
  let payload = null;
  let nextCalled = false;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return value;
    },
  };

  validator.validateGetMasterlist(req, res, () => {
    nextCalled = true;
  });

  return { nextCalled, payload, req, statusCode };
};

test("masterlist pagination validator accepts supported integers and rejects parseInt prefixes", () => {
  const valid = runValidation({
    disaster_event_id: EVENT_ID,
    page: "1",
    pageSize: "100",
  });
  assert.equal(valid.nextCalled, true);
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.req.validatedQuery.page, 1);
  assert.equal(valid.req.validatedQuery.pageSize, 100);

  const numeric = runValidation({
    disaster_event_id: EVENT_ID,
    page: 1,
    pageSize: 25,
  });
  assert.equal(numeric.nextCalled, true);
  assert.equal(numeric.req.validatedQuery.page, 1);
  assert.equal(numeric.req.validatedQuery.pageSize, 25);

  const legacy = runValidation({ disaster_event_id: EVENT_ID });
  assert.equal(legacy.nextCalled, true);
  assert.equal(legacy.req.validatedQuery.page, null);
  assert.equal(legacy.req.validatedQuery.pageSize, null);

  for (const value of ["0", "-1", "abc", "1.5", "1x"]) {
    assert.equal(
      runValidation({ disaster_event_id: EVENT_ID, page: value }).statusCode,
      400,
      `page=${value} must be rejected`,
    );
  }

  for (const value of ["0", "-1", "abc", "1.5", "10x", "101"]) {
    assert.equal(
      runValidation({ disaster_event_id: EVENT_ID, pageSize: value }).statusCode,
      400,
      `pageSize=${value} must be rejected`,
    );
  }
});

test("MSWDO route derives semantic mode from authenticated role while preserving Barangay scope", async () => {
  const routesPath = require.resolve("../src/routes/masterlist.routes");
  const authMiddlewarePath = require.resolve("../src/modules/auth/auth.middleware");
  const servicePath = require.resolve("../src/services/masterlist.service");
  const originalEntries = [
    [routesPath, require.cache[routesPath]],
    [authMiddlewarePath, require.cache[authMiddlewarePath]],
    [servicePath, require.cache[servicePath]],
  ];
  const calls = [];

  delete require.cache[routesPath];
  require.cache[authMiddlewarePath] = {
    id: authMiddlewarePath,
    filename: authMiddlewarePath,
    loaded: true,
    exports: {
      ROLE_CODES: {
        BARANGAY: "BARANGAY",
        MSWDO: "MSWDO",
        MAYOR: "MAYOR",
        DONOR: "DONOR",
      },
      requireAuthentication: (req, res, next) => {
        const roleCode = req.headers["x-test-role"];

        if (!roleCode) {
          return res.status(401).json({ message: "Authentication required" });
        }

        req.auth = {
          userId: "test-user",
          roleCode,
          defaultBarangayId: BARANGAY_ID,
        };
        return next();
      },
      requireRoles: (...allowedRoles) => (req, res, next) => {
        if (!req.auth) {
          return require.cache[authMiddlewarePath].exports.requireAuthentication(
            req,
            res,
            () => {
              if (!allowedRoles.includes(req.auth?.roleCode)) {
                return res.status(403).json({ message: "Forbidden" });
              }

              return next();
            },
          );
        }

        if (!allowedRoles.includes(req.auth?.roleCode)) {
          return res.status(403).json({ message: "Forbidden" });
        }

        return next();
      },
    },
  };
  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: {
      getMasterlist: async (filters) => {
        calls.push(filters);
        return { data: [], count: 0 };
      },
    },
  };

  const app = express();
  app.use("/api/v1/masterlist", require(routesPath));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/masterlist`;
    const mswdoResponse = await fetch(
      `${baseUrl}?disaster_event_id=${EVENT_ID}&page=1&pageSize=25&barangay_id=${BARANGAY_ID}&sector_ids=PWD,SENIOR_CITIZEN`,
      { headers: { "x-test-role": "MSWDO" } },
    );
    assert.equal(mswdoResponse.status, 200);
    assert.equal(calls[0].source_role, "MSWDO");
    assert.equal(calls[0].barangay_id, BARANGAY_ID);
    assert.deepEqual(calls[0].sector_codes, ["PWD", "SENIOR_CITIZEN"]);

    const barangayResponse = await fetch(
      `${baseUrl}?disaster_event_id=${EVENT_ID}&page=1&pageSize=25&barangay_id=99999999-9999-4999-8999-999999999999`,
      { headers: { "x-test-role": "BARANGAY" } },
    );
    assert.equal(barangayResponse.status, 200);
    assert.equal(calls[1].barangay_id, BARANGAY_ID);
    assert.equal(calls[1].source_role, undefined);

    const mayorResponse = await fetch(
      `${baseUrl}?disaster_event_id=${EVENT_ID}&page=1&pageSize=25&barangay_id=${BARANGAY_ID}`,
      { headers: { "x-test-role": "MAYOR" } },
    );
    assert.equal(mayorResponse.status, 200);
    assert.equal(calls[2].source_role, undefined);

    const donorResponse = await fetch(
      `${baseUrl}?disaster_event_id=${EVENT_ID}&page=1&pageSize=25`,
      { headers: { "x-test-role": "DONOR" } },
    );
    assert.equal(donorResponse.status, 403);

    const unauthenticatedResponse = await fetch(
      `${baseUrl}?disaster_event_id=${EVENT_ID}&page=1&pageSize=25`,
    );
    assert.equal(unauthenticatedResponse.status, 401);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    delete require.cache[routesPath];
    restoreModuleCache(originalEntries);
  }
});

test("MSWDO repository query remains set-based for page enrichment", async () => {
  const [repositorySource, serviceSource] = await Promise.all([
    readSource("src/repositories/masterlist.repository.js"),
    readSource("src/services/masterlist.service.js"),
  ]);

  assert.match(repositorySource, /const getStubsByHouseholdIds = async \(householdIds\)/);
  assert.match(repositorySource, /const getHouseholdSectorsByHouseholdIds = async \(householdIds\)/);
  assert.match(repositorySource, /const getMembersByHouseholdIds = async \(\s*householdIds/);
  assert.match(repositorySource, /const getMemberSectorsByHouseholdIds = async \(\s*householdIds/);
  assert.match(serviceSource, /getStubsByHouseholdIds\(householdIds\)/);
  assert.match(serviceSource, /getHouseholdSectorsByHouseholdIds\(householdIds\)/);
  assert.match(serviceSource, /getMembersByHouseholdIds\(\s*householdIds/);
  assert.match(serviceSource, /getMemberSectorsByHouseholdIds\(householdIds/);
  assert.doesNotMatch(serviceSource, /households\.map\(async/);
  assert.doesNotMatch(serviceSource, /await masterlistRepository\.get[A-Za-z]+\([^)]*household\.household_id/);
});
