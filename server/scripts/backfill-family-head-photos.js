#!/usr/bin/env node

const crypto = require("crypto");
const { Pool } = require("pg");
const {
  FAMILY_HEAD_PHOTO_BUCKET,
  parseFamilyHeadPhotoDataUrl,
  uploadFamilyHeadPhoto,
} = require("../src/services/familyHeadPhotoStorage.service");

const DEFAULT_BATCH_SIZE = 100;
const MIN_ORPHAN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PHOTO_ORPHAN_PATH_PATTERN =
  /^[A-Za-z0-9_-]{1,80}\/[A-Za-z0-9_-]{1,80}\/(?:operations\/[a-f0-9]{32}|households\/[A-Za-z0-9_-]{1,80})\/([a-f0-9]{64})\.(?:jpg|png|webp|gif)$/i;

const getPathFingerprint = (path) =>
  crypto.createHash("sha256").update(String(path || "")).digest("hex");

const classifyLegacyPhotoRow = (row) => {
  if (row?.family_head_photo_path) {
    return { status: "already_migrated" };
  }

  const value = row?.family_head_photo_url;
  if (typeof value !== "string" || !value.trim()) {
    return { status: "empty" };
  }

  try {
    return {
      status: "ready",
      image: parseFamilyHeadPhotoDataUrl(value),
    };
  } catch (error) {
    return {
      status: value.trim().startsWith("data:") ? "invalid" : "legacy_reference",
      errorCode: error?.code || "FAMILY_HEAD_PHOTO_INVALID",
    };
  }
};

const migrateFamilyHeadPhotoRow = async ({
  row,
  query,
  uploadPhoto = uploadFamilyHeadPhoto,
  removeUnreferenced = null,
  dryRun = false,
}) => {
  const classified = classifyLegacyPhotoRow(row);
  if (classified.status !== "ready") {
    return { status: classified.status, errorCode: classified.errorCode || null };
  }

  if (dryRun) {
    return {
      status: "would_migrate",
      sha256: classified.image.sha256,
      mimeType: classified.image.mimeType,
      sizeBytes: classified.image.sizeBytes,
    };
  }

  if (typeof query !== "function") {
    throw new TypeError("A database query function is required for backfill writes.");
  }

  const photo = await uploadPhoto({
    dataUrl: row.family_head_photo_url,
    disasterEventId: row.disaster_event_id,
    barangayId: row.barangay_id,
    householdId: row.id,
    operationId: `family-head-photo-backfill-${row.id}`,
  });

  let result;
  try {
    result = await query(
      `UPDATE households
       SET family_head_photo_path = $1,
           family_head_photo_sha256 = $2,
           family_head_photo_mime_type = $3,
           family_head_photo_size_bytes = $4,
           family_head_photo_url = NULL
       WHERE id = $5
         AND family_head_photo_path IS NULL
         AND family_head_photo_url = $6
       RETURNING id`,
      [
        photo.path,
        photo.sha256,
        photo.mimeType,
        photo.sizeBytes,
        row.id,
        row.family_head_photo_url,
      ],
    );
  } catch (error) {
    if (removeUnreferenced) {
      try {
        await removeUnreferenced({ path: photo.path });
      } catch (cleanupError) {
        // Leave the deterministic object for the age-gated orphan reconciler.
        console.warn("Family-head backfill compensation failed", {
          path_sha256: getPathFingerprint(photo.path),
          error_code: cleanupError?.code || cleanupError?.name || "unknown",
        });
      }
    }
    return {
      status: "database_failed",
      pathSha256: getPathFingerprint(photo.path),
      errorCode: error?.code || error?.name || "database-error",
    };
  }

  if (!result?.rows?.length) {
    if (removeUnreferenced) {
      await removeUnreferenced({ path: photo.path });
    }
    return {
      status: "source_changed",
      pathSha256: getPathFingerprint(photo.path),
    };
  }

  return {
    status: "migrated",
    sha256: photo.sha256,
    pathSha256: getPathFingerprint(photo.path),
  };
};

const parseArguments = (args = process.argv.slice(2)) => {
  const options = {
    apply: false,
    cleanupOrphans: false,
    confirmOrphanCleanup: false,
    confirmProductionBackfill: false,
    target: "test",
    batchSize: DEFAULT_BATCH_SIZE,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--cleanup-orphans") options.cleanupOrphans = true;
    else if (arg === "--confirm-orphan-cleanup") options.confirmOrphanCleanup = true;
    else if (arg === "--confirm-production-backfill") {
      options.confirmProductionBackfill = true;
    } else if (arg === "--target") {
      options.target = String(args[index + 1] || "").trim().toLowerCase();
      index += 1;
    } else if (arg === "--batch-size") {
      options.batchSize = Number(args[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 1000) {
    throw new Error("--batch-size must be an integer between 1 and 1000.");
  }
  if (!["test", "staging", "production"].includes(options.target)) {
    throw new Error("--target must be test, staging, or production.");
  }
  if (options.apply && options.target === "production" && !options.confirmProductionBackfill) {
    throw new Error(
      "Production writes require --confirm-production-backfill and explicit production credentials.",
    );
  }
  if (options.apply && options.cleanupOrphans && !options.confirmOrphanCleanup) {
    throw new Error(
      "Orphan deletion requires --confirm-orphan-cleanup after reviewing a dry run.",
    );
  }

  return options;
};

const getDatabaseUrl = ({ target, apply }) => {
  if (target === "test") {
    const testUrl = String(process.env.TEST_DATABASE_URL || "").trim();
    if (!testUrl) {
      throw new Error("TEST_DATABASE_URL is required for the test target.");
    }
    return testUrl;
  }

  const explicitUrl = String(
    process.env.FAMILY_HEAD_PHOTO_BACKFILL_DATABASE_URL || "",
  ).trim();
  if (!explicitUrl) {
    throw new Error(
      "FAMILY_HEAD_PHOTO_BACKFILL_DATABASE_URL is required for staging/production; DATABASE_URL is never used by this script.",
    );
  }
  if (
    apply &&
    process.env.FAMILY_HEAD_PHOTO_BACKFILL_STORAGE_ENV !== target
  ) {
    throw new Error(
      `Set FAMILY_HEAD_PHOTO_BACKFILL_STORAGE_ENV=${target} before a ${target} write.`,
    );
  }
  return explicitUrl;
};

const assertStorageTarget = ({ target }) => {
  const configuredTarget = String(
    process.env.FAMILY_HEAD_PHOTO_BACKFILL_STORAGE_ENV || "",
  ).trim().toLowerCase();
  if (configuredTarget !== target) {
    throw new Error(
      `Storage target must be explicitly set with FAMILY_HEAD_PHOTO_BACKFILL_STORAGE_ENV=${target}.`,
    );
  }
  if (
    !String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim() ||
    !String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  ) {
    throw new Error("Explicit Supabase server Storage credentials are required.");
  }
};

const listStorageObjectsRecursively = async (storage, prefix = "", output = []) => {
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await storage.storage
      .from(FAMILY_HEAD_PHOTO_BUCKET)
      .list(prefix, {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
    if (error) {
      throw new Error("Family-head Storage listing failed.");
    }

    const entries = Array.isArray(data) ? data : [];
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null || entry.metadata === null) {
        await listStorageObjectsRecursively(storage, path, output);
      } else {
        output.push({ ...entry, path });
      }
    }
    if (entries.length < pageSize) break;
    offset += pageSize;
  }

  return output;
};

const reconcileOrphans = async ({ storage, query, apply, now = Date.now() }) => {
  const objects = await listStorageObjectsRecursively(storage);
  let verified = 0;
  let deleted = 0;
  let tooRecent = 0;
  let referenced = 0;
  let invalid = 0;

  for (const object of objects) {
    const createdAt = Date.parse(object.created_at || object.createdAt || "");
    const parsedPath = PHOTO_ORPHAN_PATH_PATTERN.exec(object.path);
    if (!Number.isFinite(createdAt) || !parsedPath) {
      invalid += 1;
      continue;
    }
    if (now - createdAt < MIN_ORPHAN_AGE_MS) {
      tooRecent += 1;
      continue;
    }

    const { rows } = await query(
      "SELECT 1 FROM households WHERE family_head_photo_path = $1 LIMIT 1",
      [object.path],
    );
    if (rows?.length) {
      referenced += 1;
      continue;
    }

    const { data, error } = await storage.storage
      .from(FAMILY_HEAD_PHOTO_BUCKET)
      .download(object.path);
    if (error || !data) {
      invalid += 1;
      continue;
    }
    const bytes = Buffer.from(await data.arrayBuffer());
    const actualHash = crypto.createHash("sha256").update(bytes).digest("hex");
    if (actualHash !== parsedPath[1].toLowerCase()) {
      invalid += 1;
      continue;
    }

    verified += 1;
    if (!apply) continue;

    // Recheck the reference immediately before deletion to guard a concurrent backfill.
    const finalReferenceCheck = await query(
      "SELECT 1 FROM households WHERE family_head_photo_path = $1 LIMIT 1",
      [object.path],
    );
    if (finalReferenceCheck.rows?.length) {
      referenced += 1;
      continue;
    }

    const { error: removeError } = await storage.storage
      .from(FAMILY_HEAD_PHOTO_BUCKET)
      .remove([object.path]);
    if (!removeError) deleted += 1;
  }

  return { examined: objects.length, verified, deleted, tooRecent, referenced, invalid };
};

const runBackfill = async ({ query, uploadPhoto, removeUnreferenced, batchSize, dryRun }) => {
  const counts = {
    examined: 0,
    wouldMigrate: 0,
    migrated: 0,
    alreadyMigrated: 0,
    invalid: 0,
    legacyReference: 0,
    empty: 0,
    sourceChanged: 0,
    databaseFailed: 0,
  };
  let cursor = null;

  while (true) {
    const { rows = [] } = await query(
      `SELECT id, disaster_event_id, barangay_id,
              family_head_photo_url, family_head_photo_path
       FROM households
       WHERE family_head_photo_url IS NOT NULL
         AND ($1::text IS NULL OR id::text > $1)
       ORDER BY id::text
       LIMIT $2`,
      [cursor, batchSize],
    );
    if (rows.length === 0) break;
    cursor = String(rows[rows.length - 1].id);

    for (const row of rows) {
      counts.examined += 1;
      const result = await migrateFamilyHeadPhotoRow({
        row,
        query,
        uploadPhoto,
        removeUnreferenced,
        dryRun,
      });
      const field = {
        would_migrate: "wouldMigrate",
        migrated: "migrated",
        already_migrated: "alreadyMigrated",
        source_changed: "sourceChanged",
        database_failed: "databaseFailed",
      }[result.status];
      if (field) counts[field] += 1;
      else if (Object.hasOwn(counts, result.status)) counts[result.status] += 1;
    }
  }

  return counts;
};

const main = async () => {
  const options = parseArguments();
  const connectionString = getDatabaseUrl(options);
  const writeMode = Boolean(options.apply);
  if (options.cleanupOrphans || writeMode) {
    assertStorageTarget({ target: options.target });
  }

  // The target URL is explicit and never inherited from the application DATABASE_URL.
  const parsedDatabaseUrl = new URL(connectionString);
  const databaseHost = parsedDatabaseUrl.hostname;
  const scopedPool = new Pool({
    connectionString,
    ...(databaseHost.endsWith(".supabase.co") || databaseHost.endsWith(".supabase.com")
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  });

  const query = (text, values) => scopedPool.query(text, values);
  const report = {};
  try {
    if (options.cleanupOrphans) {
      const storage = require("../src/services/profilePictureStorage.service").getSupabaseStorageClient();
      if (!storage) {
        throw new Error("Supabase service-role Storage credentials are unavailable.");
      }
      report.orphans = await reconcileOrphans({
        storage,
        query,
        apply: writeMode,
      });
    } else {
      report.backfill = await runBackfill({
        query,
        uploadPhoto: uploadFamilyHeadPhoto,
        removeUnreferenced: require("../src/services/familyHeadPhotoStorage.service")
          .removeUnreferencedFamilyHeadPhoto,
        batchSize: options.batchSize,
        dryRun: !writeMode,
      });
    }
  } finally {
    await scopedPool.end();
  }

  console.log(
    JSON.stringify(
      {
        mode: writeMode ? "apply" : "dry-run",
        target: options.target,
        bucket: FAMILY_HEAD_PHOTO_BUCKET,
        ...report,
      },
      null,
      2,
    ),
  );
};

if (require.main === module) {
  main().catch((error) => {
    console.error("Family-head photo maintenance failed", {
      error_code: error?.code || error?.name || "unknown",
    });
    process.exitCode = 1;
  });
}

module.exports = {
  MIN_ORPHAN_AGE_MS,
  PHOTO_ORPHAN_PATH_PATTERN,
  classifyLegacyPhotoRow,
  getDatabaseUrl,
  getPathFingerprint,
  migrateFamilyHeadPhotoRow,
  parseArguments,
  assertStorageTarget,
  reconcileOrphans,
  runBackfill,
};
