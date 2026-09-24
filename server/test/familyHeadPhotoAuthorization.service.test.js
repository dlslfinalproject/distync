const test = require("node:test");
const assert = require("node:assert/strict");

const servicePath = require.resolve("../src/services/householdRegistration.service");
const repositoryPath = require.resolve("../src/repositories/householdRegistration.repository");
const familyStoragePath = require.resolve("../src/services/familyHeadPhotoStorage.service");

const withStubbedHouseholdPhotoAccess = async (runTest) => {
  const originalEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  const originalEntries = new Map(
    [servicePath, repositoryPath, familyStoragePath].map((modulePath) => [
      modulePath,
      require.cache[modulePath],
    ]),
  );
  let household = {
    id: "household-1",
    barangay_id: "barangay-a",
    family_head_photo_path: "event-1/barangay-a/households/household-1/photo.jpg",
    family_head_photo_url: null,
  };

  try {
    require.cache[repositoryPath] = {
      id: repositoryPath,
      filename: repositoryPath,
      loaded: true,
      exports: {
        getHouseholdSummaryById: async (id) =>
          String(id) === String(household.id) ? household : null,
      },
    };
    require.cache[familyStoragePath] = {
      id: familyStoragePath,
      filename: familyStoragePath,
      loaded: true,
      exports: {
        resolveFamilyHeadPhoto: async ({ familyHeadPhotoPath }) =>
          familyHeadPhotoPath
            ? {
                url: "https://storage.example/signed-household-photo",
                expiresAt: "2026-09-24T10:05:00.000Z",
              }
            : null,
      },
    };
    delete require.cache[servicePath];
    const service = require(servicePath);
    await runTest({
      service,
      setHousehold(value) { household = value; },
    });
  } finally {
    for (const modulePath of [servicePath, repositoryPath, familyStoragePath]) {
      delete require.cache[modulePath];
      const originalEntry = originalEntries.get(modulePath);
      if (originalEntry) require.cache[modulePath] = originalEntry;
    }
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
  }
};

test("Barangay and MSWDO can resolve authorized family-head photos while Mayor and external roles are denied on household access", async () => {
  await withStubbedHouseholdPhotoAccess(async ({ service, setHousehold }) => {
    const inScope = await service.getFamilyHeadPhotoForRequester({
      householdId: "household-1",
      requester: {
        roleCode: "BARANGAY",
        defaultBarangayId: "barangay-a",
      },
    });
    assert.equal(inScope.url, "https://storage.example/signed-household-photo");
    assert.equal(inScope.available, true);

    await assert.rejects(
      service.getFamilyHeadPhotoForRequester({
        householdId: "household-1",
        requester: {
          roleCode: "BARANGAY",
          defaultBarangayId: "barangay-b",
        },
      }),
      { statusCode: 403, code: "BARANGAY_SCOPE_FORBIDDEN" },
    );
    await assert.rejects(
      service.getFamilyHeadPhotoForRequester({
        householdId: "household-1",
        requester: { roleCode: "BARANGAY", defaultBarangayId: null },
      }),
      { statusCode: 403, code: "BARANGAY_SCOPE_FORBIDDEN" },
    );

    const mswdo = await service.getFamilyHeadPhotoForRequester({
      householdId: "household-1",
      requester: { roleCode: "MSWDO" },
    });
    assert.equal(mswdo.available, true);

    for (const roleCode of ["MAYOR", "DONOR", "NGO", "PUBLIC"]) {
      await assert.rejects(
        service.getFamilyHeadPhotoForRequester({
          householdId: "household-1",
          requester: { roleCode },
        }),
        { statusCode: 403, code: "FAMILY_HEAD_PHOTO_FORBIDDEN" },
      );
    }

    setHousehold({
      id: "household-1",
      barangay_id: "barangay-a",
      family_head_photo_path: null,
      family_head_photo_url: null,
    });
    const missing = await service.getFamilyHeadPhotoForRequester({
      householdId: "household-1",
      requester: { roleCode: "MSWDO" },
    });
    assert.equal(missing.url, null);
    assert.equal(missing.available, false);
  });
});
