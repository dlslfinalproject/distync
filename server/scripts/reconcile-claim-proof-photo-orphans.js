const crypto = require("crypto");
const { Pool } = require("pg");

const {
  CLAIM_PROOF_PHOTO_BUCKET,
  isClaimProofPhotoPath,
} = require("../src/services/claimProofPhotoStorage.service");
const {
  getSupabaseStorageClient,
} = require("../src/services/profilePictureStorage.service");

const MIN_ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
const DELETE_CONFIRMATION = "DELETE-UNREFERENCED-CLAIM-PROOF-PHOTOS";

const parseArguments = (args = process.argv.slice(2)) => {
  const options = { target: "", delete: false, confirmation: "" };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--target") {
      options.target = String(args[index + 1] || "").trim().toLowerCase();
      index += 1;
    } else if (arg === "--delete") {
      options.delete = true;
    } else if (arg.startsWith("--confirm=")) {
      options.confirmation = arg.slice("--confirm=".length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!["test", "staging", "production"].includes(options.target)) {
    throw new Error("Pass --target test, --target staging, or --target production.");
  }
  if (options.delete && options.confirmation !== DELETE_CONFIRMATION) {
    throw new Error(
      `Deletion requires --confirm=${DELETE_CONFIRMATION} after reviewing a dry run.`,
    );
  }
  if (!options.delete && options.confirmation) {
    throw new Error("--confirm is only valid together with --delete.");
  }
  return options;
};

const assertExplicitTarget = ({ target }) => {
  const configuredTarget = String(
    process.env.CLAIM_PROOF_ORPHAN_STORAGE_ENV || "",
  )
    .trim()
    .toLowerCase();
  if (configuredTarget !== target) {
    throw new Error(
      `Storage target must be explicitly set with CLAIM_PROOF_ORPHAN_STORAGE_ENV=${target}.`,
    );
  }

  const databaseUrl = String(
    process.env.CLAIM_PROOF_ORPHAN_DATABASE_URL || "",
  ).trim();
  if (!databaseUrl) {
    throw new Error(
      "CLAIM_PROOF_ORPHAN_DATABASE_URL is required; DATABASE_URL is never used by this script.",
    );
  }
  if (
    !String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim() ||
    !String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  ) {
    throw new Error("Explicit Supabase server Storage credentials are required.");
  }
  return databaseUrl;
};

const listStorageObjectsRecursively = async (storage, prefix = "", output = []) => {
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await storage.storage
      .from(CLAIM_PROOF_PHOTO_BUCKET)
      .list(prefix, {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
    if (error) {
      throw new Error("Claim-proof Storage listing failed.");
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
  const counts = {
    examined: objects.length,
    eligible: 0,
    deleted: 0,
    tooRecent: 0,
    referenced: 0,
    invalid: 0,
    deleteFailed: 0,
  };

  for (const object of objects) {
    const path = String(object.path || "");
    const createdAt = Date.parse(object.created_at || object.createdAt || "");
    if (!isClaimProofPhotoPath(path) || !Number.isFinite(createdAt)) {
      counts.invalid += 1;
      continue;
    }
    if (now - createdAt < MIN_ORPHAN_AGE_MS) {
      counts.tooRecent += 1;
      continue;
    }

    const firstReferenceCheck = await query(
      "SELECT 1 FROM distribution_transactions WHERE proof_photo_path = $1 LIMIT 1",
      [path],
    );
    if (firstReferenceCheck.rows?.length) {
      counts.referenced += 1;
      continue;
    }

    const { data, error } = await storage.storage
      .from(CLAIM_PROOF_PHOTO_BUCKET)
      .download(path);
    if (error || !data) {
      counts.invalid += 1;
      continue;
    }
    const bytes = Buffer.from(await data.arrayBuffer());
    const expectedHash = path.split("/").at(-1)?.split(".")[0]?.toLowerCase();
    const actualHash = crypto.createHash("sha256").update(bytes).digest("hex");
    if (actualHash !== expectedHash) {
      counts.invalid += 1;
      continue;
    }

    counts.eligible += 1;
    if (!apply) continue;

    const finalReferenceCheck = await query(
      "SELECT 1 FROM distribution_transactions WHERE proof_photo_path = $1 LIMIT 1",
      [path],
    );
    if (finalReferenceCheck.rows?.length) {
      counts.referenced += 1;
      continue;
    }

    const { error: removeError } = await storage.storage
      .from(CLAIM_PROOF_PHOTO_BUCKET)
      .remove([path]);
    if (removeError) counts.deleteFailed += 1;
    else counts.deleted += 1;
  }

  return counts;
};

const main = async () => {
  const options = parseArguments();
  const databaseUrl = assertExplicitTarget(options);
  const parsedDatabaseUrl = new URL(databaseUrl);
  const databaseHost = parsedDatabaseUrl.hostname;
  const pool = new Pool({
    connectionString: databaseUrl,
    ...(databaseHost.endsWith(".supabase.co") || databaseHost.endsWith(".supabase.com")
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  });
  const storage = getSupabaseStorageClient();
  if (!storage) {
    await pool.end();
    throw new Error("Supabase service-role Storage credentials are unavailable.");
  }

  try {
    const report = await reconcileOrphans({
      storage,
      query: (sql, values) => pool.query(sql, values),
      apply: options.delete,
    });
    console.log(
      JSON.stringify(
        {
          mode: options.delete ? "delete" : "dry-run",
          target: options.target,
          bucket: CLAIM_PROOF_PHOTO_BUCKET,
          minimum_age_hours: MIN_ORPHAN_AGE_MS / (60 * 60 * 1000),
          ...report,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || "Claim-proof orphan reconciliation failed.");
    process.exitCode = 1;
  });
}

module.exports = {
  DELETE_CONFIRMATION,
  MIN_ORPHAN_AGE_MS,
  parseArguments,
  reconcileOrphans,
};
