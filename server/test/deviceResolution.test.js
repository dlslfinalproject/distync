const test = require("node:test");
const assert = require("node:assert/strict");

const deviceRepositoryPath = require.resolve(
  "../src/repositories/device.repository",
);
const deviceServicePath = require.resolve("../src/services/device.service");
const dbPath = require.resolve("../src/config/db");

const withStubbedDeviceRepository = async (repositoryStub, runTest) => {
  const originalService = require.cache[deviceServicePath];
  const originalRepository = require.cache[deviceRepositoryPath];

  delete require.cache[deviceServicePath];
  require.cache[deviceRepositoryPath] = {
    id: deviceRepositoryPath,
    filename: deviceRepositoryPath,
    loaded: true,
    exports: repositoryStub,
  };

  try {
    const deviceService = require(deviceServicePath);
    await runTest(deviceService);
  } finally {
    delete require.cache[deviceServicePath];

    if (originalService) {
      require.cache[deviceServicePath] = originalService;
    }

    if (originalRepository) {
      require.cache[deviceRepositoryPath] = originalRepository;
    } else {
      delete require.cache[deviceRepositoryPath];
    }
  }
};

const withStubbedDevicePool = async (poolStub, runTest) => {
  const originalRepository = require.cache[deviceRepositoryPath];
  const originalDb = require.cache[dbPath];

  delete require.cache[deviceRepositoryPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: poolStub,
  };

  try {
    const deviceRepository = require(deviceRepositoryPath);
    await runTest(deviceRepository);
  } finally {
    delete require.cache[deviceRepositoryPath];

    if (originalRepository) {
      require.cache[deviceRepositoryPath] = originalRepository;
    }

    if (originalDb) {
      require.cache[dbPath] = originalDb;
    } else {
      delete require.cache[dbPath];
    }
  }
};

test("device repository resolves existing and new UUIDs through one atomic upsert", async () => {
  const uuid = "22222222-2222-4222-8222-222222222222";
  const row = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    device_uuid: uuid,
  };
  let capturedQuery = null;
  let capturedValues = null;

  await withStubbedDevicePool(
    {
      query: async (query, values) => {
        capturedQuery = query;
        capturedValues = values;
        return { rows: [row] };
      },
    },
    async (deviceRepository) => {
      const resolved = await deviceRepository.upsertDeviceByUuid(uuid);

      assert.deepEqual(resolved, row);
    },
  );

  assert.deepEqual(capturedValues, [uuid]);
  assert.match(capturedQuery, /INSERT INTO devices/i);
  assert.match(capturedQuery, /ON CONFLICT\s*\(\s*device_uuid\s*\)/i);
  assert.match(capturedQuery, /DO UPDATE SET[\s\S]*last_seen_at\s*=\s*NOW\(\)/i);
  assert.match(capturedQuery, /RETURNING[\s\S]*\bid\b/i);
});

test("device service maps an existing UUID, registers a new UUID, and reuses each canonical id", async () => {
  const existingUuid = "22222222-2222-4222-8222-222222222222";
  const newUuid = "33333333-3333-4333-8333-333333333333";
  const canonicalIds = {
    [existingUuid]: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    [newUuid]: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  };
  const rows = new Map([
    [existingUuid, { id: canonicalIds[existingUuid], device_uuid: existingUuid }],
  ]);
  const calls = [];
  const dbClient = { query: async () => ({ rows: [] }) };

  await withStubbedDeviceRepository(
    {
      upsertDeviceByUuid: async (clientDeviceUuid, receivedDbClient) => {
        calls.push({ clientDeviceUuid, receivedDbClient });

        if (!rows.has(clientDeviceUuid)) {
          rows.set(clientDeviceUuid, {
            id: canonicalIds[clientDeviceUuid],
            device_uuid: clientDeviceUuid,
          });
        }

        return rows.get(clientDeviceUuid);
      },
    },
    async (deviceService) => {
      assert.equal(
        await deviceService.resolveCanonicalDeviceId({
          clientDeviceUuid: ` ${existingUuid.toUpperCase()} `,
          dbClient,
        }),
        canonicalIds[existingUuid],
      );
      assert.equal(
        await deviceService.resolveCanonicalDeviceId({
          clientDeviceUuid: newUuid,
          dbClient,
        }),
        canonicalIds[newUuid],
      );
      assert.equal(
        await deviceService.resolveCanonicalDeviceId({
          clientDeviceUuid: newUuid,
          dbClient,
        }),
        canonicalIds[newUuid],
      );
    },
  );

  assert.deepEqual(
    calls.map(({ clientDeviceUuid }) => clientDeviceUuid),
    [existingUuid, newUuid, newUuid],
  );
  assert.ok(calls.every(({ receivedDbClient }) => receivedDbClient === dbClient));
});

test("concurrent resolution of one client UUID returns one canonical identity", async () => {
  const clientDeviceUuid = "44444444-4444-4444-8444-444444444444";
  const canonicalDeviceId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const rows = new Map();

  await withStubbedDeviceRepository(
    {
      upsertDeviceByUuid: async (uuid) => {
        await new Promise((resolve) => setImmediate(resolve));

        if (!rows.has(uuid)) {
          rows.set(uuid, { id: canonicalDeviceId, device_uuid: uuid });
        }

        return rows.get(uuid);
      },
    },
    async (deviceService) => {
      const resolvedIds = await Promise.all(
        Array.from({ length: 12 }, () =>
          deviceService.resolveCanonicalDeviceId({ clientDeviceUuid }),
        ),
      );

      assert.deepEqual([...new Set(resolvedIds)], [canonicalDeviceId]);
      assert.equal(rows.size, 1);
    },
  );
});

test("invalid or failed device resolution returns structured safe errors", async () => {
  let repositoryCalls = 0;

  await withStubbedDeviceRepository(
    {
      upsertDeviceByUuid: async () => {
        repositoryCalls += 1;
        throw new Error("database detail that must not reach the UI");
      },
    },
    async (deviceService) => {
      await assert.rejects(
        () =>
          deviceService.resolveCanonicalDeviceId({
            clientDeviceUuid: "not-a-uuid",
          }),
        (error) => {
          assert.equal(error.statusCode, 400);
          assert.equal(error.code, "INVALID_DEVICE_IDENTITY");
          assert.match(error.message, /persistent device UUID/i);
          return true;
        },
      );
      assert.equal(repositoryCalls, 0);

      await assert.rejects(
        () =>
          deviceService.resolveCanonicalDeviceId({
            clientDeviceUuid: "55555555-5555-4555-8555-555555555555",
          }),
        (error) => {
          assert.equal(error.statusCode, 500);
          assert.equal(error.code, "DEVICE_RESOLUTION_FAILED");
          assert.match(error.message, /could not be resolved/i);
          assert.doesNotMatch(error.message, /database detail/i);
          return true;
        },
      );
      assert.equal(repositoryCalls, 1);
    },
  );
});
