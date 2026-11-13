const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Pool } = require("pg");

const TEST_PROJECT_REF = "cldfgbqjvnianmpecybu";
const PRODUCTION_PROJECT_REF = "deufjjzwvagrljixxskn";

const getVerifiedTestPool = () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("User-role uniqueness integration tests require NODE_ENV=test.");
  }

  if (process.env.ALLOW_TEST_DB_MUTATIONS !== "true") {
    throw new Error(
      "User-role uniqueness integration tests require ALLOW_TEST_DB_MUTATIONS=true.",
    );
  }

  const rawConnectionString = process.env.TEST_DATABASE_URL;
  if (!rawConnectionString) {
    throw new Error(
      "User-role uniqueness integration tests require TEST_DATABASE_URL.",
    );
  }

  const connectionUrl = new URL(rawConnectionString);
  const connectionIdentity = [
    connectionUrl.hostname,
    decodeURIComponent(connectionUrl.username),
    process.env.SUPABASE_URL || "",
  ].join(" ");

  if (!connectionIdentity.includes(TEST_PROJECT_REF)) {
    throw new Error(
      "User-role uniqueness integration tests require the verified TEST Supabase project.",
    );
  }

  if (
    connectionIdentity.includes(PRODUCTION_PROJECT_REF) ||
    rawConnectionString.includes(PRODUCTION_PROJECT_REF)
  ) {
    throw new Error(
      "User-role uniqueness integration tests refuse the production Supabase project.",
    );
  }

  const isSupabaseHost =
    connectionUrl.hostname.endsWith(".supabase.co") ||
    connectionUrl.hostname.endsWith(".supabase.com");

  return new Pool({
    connectionString: rawConnectionString,
    ...(isSupabaseHost ? { ssl: { rejectUnauthorized: false } } : {}),
  });
};

const insertFixtureUser = async (dbClient, label) => {
  const suffix = crypto.randomUUID();
  const result = await dbClient.query(
    `
      INSERT INTO users (
        email,
        first_name,
        last_name,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, 'User Role Uniqueness Test', TRUE, NOW(), NOW())
      RETURNING id
    `,
    [`user-role-uniqueness-${label}-${suffix}@distync.local`, label],
  );

  return result.rows[0].id;
};

const createFixture = async (pool) => {
  const dbClient = await pool.connect();

  try {
    await dbClient.query("BEGIN");

    const roleResult = await dbClient.query(
      `
        SELECT id, code
        FROM roles
        WHERE code = ANY($1::text[])
        ORDER BY code ASC
      `,
      [["MAYOR", "MSWDO"]],
    );

    assert.deepEqual(
      roleResult.rows.map((row) => row.code),
      ["MAYOR", "MSWDO"],
      "expected the canonical seeded roles used by the security regression",
    );

    const roleIds = Object.fromEntries(
      roleResult.rows.map((row) => [row.code, row.id]),
    );

    const sequentialUserId = await insertFixtureUser(dbClient, "sequential");
    const concurrentUserId = await insertFixtureUser(dbClient, "concurrent");

    await dbClient.query("COMMIT");

    return {
      sequentialUserId,
      concurrentUserId,
      mayorRoleId: roleIds.MAYOR,
      mswdoRoleId: roleIds.MSWDO,
    };
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
  }
};

const cleanupFixture = async (pool, fixture) => {
  const dbClient = await pool.connect();

  try {
    await dbClient.query("BEGIN");
    await dbClient.query(
      "DELETE FROM user_role_settings WHERE user_id = ANY($1::uuid[])",
      [[fixture.sequentialUserId, fixture.concurrentUserId]],
    );
    await dbClient.query(
      "DELETE FROM user_roles WHERE user_id = ANY($1::uuid[])",
      [[fixture.sequentialUserId, fixture.concurrentUserId]],
    );
    await dbClient.query(
      "DELETE FROM users WHERE id = ANY($1::uuid[])",
      [[fixture.sequentialUserId, fixture.concurrentUserId]],
    );
    await dbClient.query("COMMIT");
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
  }
};

const assertCanonicalState = async (pool) => {
  const canonicalResult = await pool.query(
    `
      SELECT
        c.conname,
        c.convalidated,
        c.condeferrable,
        c.condeferred,
        c.conindid::regclass::text AS backing_index,
        i.relname AS backing_index_name,
        ix.indisunique,
        ix.indisvalid,
        ix.indisready,
        ix.indislive,
        ix.indkey::text AS indkey,
        ix.indnkeyatts,
        ix.indnatts,
        pg_get_constraintdef(c.oid, true) AS definition
      FROM pg_constraint c
      INNER JOIN pg_class i ON i.oid = c.conindid
      INNER JOIN pg_index ix ON ix.indexrelid = i.oid
      WHERE c.conrelid = 'public.user_roles'::regclass
        AND c.conname = 'uq_user_role'
        AND c.contype = 'u'
    `,
  );

  assert.deepEqual(canonicalResult.rows, [
    {
      conname: "uq_user_role",
      convalidated: true,
      condeferrable: false,
      condeferred: false,
      backing_index: "uq_user_role",
      backing_index_name: "uq_user_role",
      indisunique: true,
      indisvalid: true,
      indisready: true,
      indislive: true,
      indkey: "2 3",
      indnkeyatts: 2,
      indnatts: 2,
      definition: "UNIQUE (user_id, role_id)",
    },
  ]);

  const duplicateResult = await pool.query(
    `
      SELECT COUNT(*)::integer AS row_count
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname = 'user_roles_user_role_unique'
    `,
  );

  assert.equal(duplicateResult.rows[0].row_count, 0);

  const implementationResult = await pool.query(
    `
      SELECT COUNT(*)::integer AS row_count
      FROM pg_index
      WHERE indrelid = 'public.user_roles'::regclass
        AND indisunique
        AND indnkeyatts = 2
        AND indnatts = 2
        AND indkey::text = '2 3'
        AND indpred IS NULL
        AND indexprs IS NULL
    `,
  );

  assert.equal(implementationResult.rows[0].row_count, 1);
};

test("user-role uniqueness remains canonical, race-safe, and multi-role aware", async () => {
  const pool = getVerifiedTestPool();
  let fixture;

  try {
    await assertCanonicalState(pool);
    fixture = await createFixture(pool);

    const firstAssignment = await pool.query(
      `
        INSERT INTO user_roles (user_id, role_id, assigned_at)
        VALUES ($1, $2, NOW())
        RETURNING id
      `,
      [fixture.sequentialUserId, fixture.mayorRoleId],
    );
    assert.equal(firstAssignment.rowCount, 1);

    await assert.rejects(
      pool.query(
        `
          INSERT INTO user_roles (user_id, role_id, assigned_at)
          VALUES ($1, $2, NOW())
        `,
        [fixture.sequentialUserId, fixture.mayorRoleId],
      ),
      (error) => {
        assert.equal(error.code, "23505");
        assert.equal(error.constraint, "uq_user_role");
        return true;
      },
    );

    const differentRoleAssignment = await pool.query(
      `
        INSERT INTO user_roles (user_id, role_id, assigned_at)
        VALUES ($1, $2, NOW())
        RETURNING id
      `,
      [fixture.sequentialUserId, fixture.mswdoRoleId],
    );
    assert.equal(differentRoleAssignment.rowCount, 1);

    const roleResolution = await pool.query(
      `
        SELECT r.code
        FROM user_roles ur
        INNER JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY r.code ASC
      `,
      [fixture.sequentialUserId],
    );
    assert.deepEqual(
      roleResolution.rows.map((row) => row.code),
      ["MAYOR", "MSWDO"],
      "role resolution must continue to allow multiple different roles",
    );

    const clients = await Promise.all(
      Array.from({ length: 8 }, () => pool.connect()),
    );
    let concurrentResults;

    try {
      concurrentResults = await Promise.allSettled(
        clients.map((dbClient) =>
          dbClient.query(
            `
              INSERT INTO user_roles (user_id, role_id, assigned_at)
              VALUES ($1, $2, NOW())
              RETURNING id
            `,
            [fixture.concurrentUserId, fixture.mayorRoleId],
          ),
        ),
      );
    } finally {
      clients.forEach((dbClient) => dbClient.release());
    }

    const concurrentSuccesses = concurrentResults.filter(
      (result) => result.status === "fulfilled",
    );
    const concurrentDuplicateRejections = concurrentResults.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason?.code === "23505" &&
        result.reason?.constraint === "uq_user_role",
    );

    assert.equal(concurrentSuccesses.length, 1);
    assert.equal(concurrentDuplicateRejections.length, 7);

    const countResult = await pool.query(
      `
        SELECT user_id, COUNT(*)::integer AS row_count
        FROM user_roles
        WHERE user_id = ANY($1::uuid[])
        GROUP BY user_id
        ORDER BY array_position($1::uuid[], user_id)
      `,
      [[fixture.sequentialUserId, fixture.concurrentUserId]],
    );
    assert.deepEqual(
      countResult.rows.map((row) => Number(row.row_count)),
      [2, 1],
    );

    await assertCanonicalState(pool);
  } finally {
    if (fixture) {
      await cleanupFixture(pool, fixture);
    }
    await pool.end();
  }
});
