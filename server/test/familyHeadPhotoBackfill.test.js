const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const {
  MIN_ORPHAN_AGE_MS,
  classifyLegacyPhotoRow,
  migrateFamilyHeadPhotoRow,
  parseArguments,
  reconcileOrphans,
} = require("../scripts/backfill-family-head-photos");

const validPhoto =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4AWP4DwQACfsD/c8LaHIAAAAASUVORK5CYII=";
const buildRow = (overrides = {}) => ({
  id: "household-1",
  disaster_event_id: "event-1",
  barangay_id: "barangay-1",
  family_head_photo_url: validPhoto,
  family_head_photo_path: null,
  ...overrides,
});

test("backfill dry run validates candidates without uploading or writing", async () => {
  let writes = 0;
  let uploads = 0;
  const result = await migrateFamilyHeadPhotoRow({
    row: buildRow(),
    query: async () => { writes += 1; return { rows: [] }; },
    uploadPhoto: async () => { uploads += 1; },
    dryRun: true,
  });
  assert.equal(result.status, "would_migrate");
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal(writes, 0);
  assert.equal(uploads, 0);
});

test("backfill uploads then compare-and-swaps the unchanged legacy source and clears its data URL", async () => {
  const statements = [];
  let uploadCount = 0;
  const result = await migrateFamilyHeadPhotoRow({
    row: buildRow(),
    query: async (sql, values) => {
      statements.push({ sql, values });
      return { rows: [{ id: "household-1" }] };
    },
    uploadPhoto: async (options) => {
      uploadCount += 1;
      assert.equal(options.householdId, "household-1");
      assert.equal(options.operationId, "family-head-photo-backfill-household-1");
      return {
        path: "event-1/barangay-1/households/household-1/abc.jpg",
        sha256: "a".repeat(64),
        mimeType: "image/png",
        sizeBytes: 69,
        created: true,
      };
    },
    dryRun: false,
  });

  assert.equal(result.status, "migrated");
  assert.equal(uploadCount, 1);
  assert.match(statements[0].sql, /family_head_photo_url = NULL/);
  assert.match(statements[0].sql, /family_head_photo_url = \$6/);
  assert.deepEqual(statements[0].values.slice(0, 5), [
    "event-1/barangay-1/households/household-1/abc.jpg",
    "a".repeat(64),
    "image/png",
    69,
    "household-1",
  ]);
  assert.equal(statements[0].values[5], validPhoto);
});

test("backfill skips already migrated, null, corrupt, and non-data legacy values", () => {
  assert.equal(classifyLegacyPhotoRow(buildRow({ family_head_photo_path: "stored/path.jpg" })).status, "already_migrated");
  assert.equal(classifyLegacyPhotoRow(buildRow({ family_head_photo_url: null })).status, "empty");
  assert.equal(classifyLegacyPhotoRow(buildRow({ family_head_photo_url: "data:image/png;base64,AA==" })).status, "invalid");
  assert.equal(classifyLegacyPhotoRow(buildRow({ family_head_photo_url: "https://legacy.example/photo.jpg" })).status, "legacy_reference");
});

test("a concurrent source change fails the compare-and-swap and removes only the unreferenced deterministic object", async () => {
  const removed = [];
  const result = await migrateFamilyHeadPhotoRow({
    row: buildRow(),
    query: async () => ({ rows: [] }),
    uploadPhoto: async () => ({ path: "stable/path/abc.jpg", created: true }),
    removeUnreferenced: async (value) => removed.push(value.path),
    dryRun: false,
  });
  assert.equal(result.status, "source_changed");
  assert.deepEqual(removed, ["stable/path/abc.jpg"]);
});

test("a database failure after upload attempts compensation and remains retryable at the same path", async () => {
  const removed = [];
  const uploadArguments = [];
  const uploadPhoto = async (options) => {
    uploadArguments.push(options);
    return { path: "stable/path/abc.jpg", created: false };
  };
  const first = await migrateFamilyHeadPhotoRow({
    row: buildRow(),
    query: async () => { throw Object.assign(new Error("db error"), { code: "40001" }); },
    uploadPhoto,
    removeUnreferenced: async ({ path }) => removed.push(path),
    dryRun: false,
  });
  const second = await migrateFamilyHeadPhotoRow({
    row: buildRow(),
    query: async () => { throw Object.assign(new Error("db error"), { code: "40001" }); },
    uploadPhoto,
    removeUnreferenced: async () => {},
    dryRun: false,
  });
  assert.equal(first.status, "database_failed");
  assert.equal(second.status, "database_failed");
  assert.equal(removed[0], "stable/path/abc.jpg");
  assert.equal(uploadArguments[0].operationId, uploadArguments[1].operationId);
  assert.equal(uploadArguments[0].householdId, uploadArguments[1].householdId);
});

test("an already-existing verified object can complete backfill without a second object", async () => {
  let writes = 0;
  const result = await migrateFamilyHeadPhotoRow({
    row: buildRow(),
    query: async () => { writes += 1; return { rows: [{ id: "household-1" }] }; },
    uploadPhoto: async () => ({
      path: "event-1/barangay-1/households/household-1/abc.jpg",
      sha256: "a".repeat(64),
      mimeType: "image/png",
      sizeBytes: 69,
      created: false,
    }),
    dryRun: false,
  });
  assert.equal(result.status, "migrated");
  assert.equal(writes, 1);
});

test("backfill flags are dry-run by default and require explicit confirmations for destructive phases", () => {
  assert.equal(parseArguments([]).apply, false);
  assert.equal(parseArguments(["--target", "test", "--apply"]).apply, true);
  assert.throws(
    () => parseArguments(["--target", "production", "--apply"]),
    /confirm-production-backfill/,
  );
  assert.throws(
    () => parseArguments(["--target", "test", "--apply", "--cleanup-orphans"]),
    /confirm-orphan-cleanup/,
  );
});

test("orphan review refuses recent or unverifiable objects and dry run never deletes", async () => {
  const bytes = Buffer.from("family photo");
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const old = new Date(Date.now() - MIN_ORPHAN_AGE_MS - 1000).toISOString();
  const tooRecent = new Date().toISOString();
  const removed = [];
  const storage = {
    storage: {
      from() {
        return {
          async list() {
            return {
              data: [
                { name: `event-1/barangay-1/households/household-1/${hash}.jpg`, id: "object-1", metadata: { size: bytes.length }, created_at: old },
                { name: `event-1/barangay-1/households/household-2/${hash}.jpg`, id: "object-2", metadata: { size: bytes.length }, created_at: tooRecent },
                { name: `event-1/barangay-1/households/household-3/${"b".repeat(64)}.jpg`, id: "object-3", metadata: { size: 9 }, created_at: old },
              ],
              error: null,
            };
          },
          async download(path) {
            return {
              data: new Blob([path.includes("b".repeat(10)) ? Buffer.from("bad") : bytes]),
              error: null,
            };
          },
          async remove(paths) { removed.push(...paths); return { error: null }; },
        };
      },
    },
  };
  const result = await reconcileOrphans({
    storage,
    query: async () => ({ rows: [] }),
    apply: false,
  });
  assert.deepEqual(result, {
    examined: 3,
    verified: 1,
    deleted: 0,
    tooRecent: 1,
    referenced: 0,
    invalid: 1,
  });
  assert.deepEqual(removed, []);
});
