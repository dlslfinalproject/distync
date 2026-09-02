const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { Pool } = require("pg");

const TEST_PROJECT_REF = "cldfgbqjvnianmpecybu";
const PRODUCTION_PROJECT_REF = "deufjjzwvagrljixxskn";

const getVerifiedTestPool = () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Users-email index integration tests require NODE_ENV=test.",
    );
  }

  if (process.env.ALLOW_TEST_DB_MUTATIONS !== "true") {
    throw new Error(
      "Users-email index integration tests require ALLOW_TEST_DB_MUTATIONS=true.",
    );
  }

  const rawConnectionString = process.env.TEST_DATABASE_URL;
  if (!rawConnectionString) {
    throw new Error(
      "Users-email index integration tests require TEST_DATABASE_URL.",
    );
  }

  const connectionUrl = new URL(rawConnectionString);
  const supabaseUrl = process.env.SUPABASE_URL
    ? new URL(process.env.SUPABASE_URL)
    : null;
  const connectionIdentity = [
    connectionUrl.hostname,
    decodeURIComponent(connectionUrl.username),
    supabaseUrl?.hostname || "",
  ].join(" ");

  if (!connectionIdentity.includes(TEST_PROJECT_REF)) {
    throw new Error(
      "Users-email index integration tests require the verified TEST Supabase project.",
    );
  }

  if (
    connectionIdentity.includes(PRODUCTION_PROJECT_REF) ||
    rawConnectionString.includes(PRODUCTION_PROJECT_REF)
  ) {
    throw new Error(
      "Users-email index integration tests refuse the production Supabase project.",
    );
  }

  const isSupabaseHost =
    connectionUrl.hostname.endsWith(".supabase.co") ||
    connectionUrl.hostname.endsWith(".supabase.com");

  if (!isSupabaseHost) {
    throw new Error(
      "Users-email index integration tests require a Supabase PostgreSQL host.",
    );
  }

  return new Pool({
    connectionString: rawConnectionString,
    ssl: { rejectUnauthorized: false },
  });
};

const assertVerifiedSession = async (pool) => {
  const result = await pool.query(
    `
      SELECT
        current_database() AS database_name,
        current_user,
        session_user,
        current_setting('server_version') AS server_version
    `,
  );

  assert.equal(result.rows[0].database_name, "postgres");
  assert.equal(result.rows[0].current_user, "postgres");
  assert.equal(result.rows[0].session_user, "postgres");
  assert.match(result.rows[0].server_version, /^17\./);
};

const assertCanonicalEmailState = async (pool) => {
  const canonicalResult = await pool.query(
    `
      SELECT
        c.conname,
        c.convalidated,
        c.condeferrable,
        c.condeferred,
        c.conindid::regclass::text AS backing_index,
        i.relname AS backing_index_name,
        am.amname AS access_method,
        ix.indisunique,
        ix.indisvalid,
        ix.indisready,
        ix.indislive,
        ix.indnkeyatts,
        ix.indnatts,
        ix.indkey::text AS indkey,
        ix.indoption::text AS indoption,
        ix.indcollation::text AS indcollation,
        ix.indclass::text AS indclass,
        ix.indpred IS NULL AS no_predicate,
        ix.indexprs IS NULL AS no_expression,
        pg_get_constraintdef(c.oid, true) AS definition,
        EXISTS (
          SELECT 1
          FROM pg_depend d
          WHERE d.classid = 'pg_class'::regclass
            AND d.objid = c.conindid
            AND d.refclassid = 'pg_constraint'::regclass
            AND d.refobjid = c.oid
            AND d.deptype = 'i'
        ) AS internally_owned
      FROM pg_constraint c
      INNER JOIN pg_class i ON i.oid = c.conindid
      INNER JOIN pg_index ix ON ix.indexrelid = i.oid
      INNER JOIN pg_am am ON am.oid = i.relam
      WHERE c.connamespace = 'public'::regnamespace
        AND c.conrelid = 'public.users'::regclass
        AND c.conname = 'users_email_key'
        AND c.contype = 'u'
    `,
  );

  assert.equal(canonicalResult.rowCount, 1);
  const canonical = canonicalResult.rows[0];
  assert.equal(canonical.conname, "users_email_key");
  assert.equal(canonical.convalidated, true);
  assert.equal(canonical.condeferrable, false);
  assert.equal(canonical.condeferred, false);
  assert.equal(canonical.backing_index, "users_email_key");
  assert.equal(canonical.backing_index_name, "users_email_key");
  assert.equal(canonical.access_method, "btree");
  assert.equal(canonical.indisunique, true);
  assert.equal(canonical.indisvalid, true);
  assert.equal(canonical.indisready, true);
  assert.equal(canonical.indislive, true);
  assert.equal(canonical.indnkeyatts, 1);
  assert.equal(canonical.indnatts, 1);
  assert.equal(canonical.indkey, "3");
  assert.equal(canonical.indoption, "0");
  assert.equal(canonical.indcollation, "100");
  assert.equal(canonical.indclass, "3126");
  assert.equal(canonical.no_predicate, true);
  assert.equal(canonical.no_expression, true);
  assert.equal(canonical.definition, "UNIQUE (email)");
  assert.equal(canonical.internally_owned, true);

  const redundantResult = await pool.query(
    `
      SELECT COUNT(*)::integer AS row_count
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname = 'idx_users_email'
    `,
  );
  assert.equal(redundantResult.rows[0].row_count, 0);

  const rawEmailIndexResult = await pool.query(
    `
      SELECT COUNT(*)::integer AS row_count
      FROM pg_index ix
      WHERE ix.indrelid = 'public.users'::regclass
        AND ix.indisunique
        AND ix.indnkeyatts = 1
        AND ix.indnatts = 1
        AND ix.indkey::text = '3'
        AND ix.indpred IS NULL
        AND ix.indexprs IS NULL
    `,
  );
  assert.equal(rawEmailIndexResult.rows[0].row_count, 1);

  const googleSubResult = await pool.query(
    `
      SELECT
        i.relname,
        am.amname AS access_method,
        ix.indisunique,
        ix.indisvalid,
        ix.indisready,
        ix.indislive,
        ix.indkey::text AS indkey
      FROM pg_class i
      INNER JOIN pg_index ix ON ix.indexrelid = i.oid
      INNER JOIN pg_am am ON am.oid = i.relam
      WHERE i.oid = 'public.users_google_sub_key'::regclass
    `,
  );
  assert.deepEqual(googleSubResult.rows, [
    {
      relname: "users_google_sub_key",
      access_method: "btree",
      indisunique: true,
      indisvalid: true,
      indisready: true,
      indislive: true,
      indkey: "2",
    },
  ]);
};

const countFixtureRows = async (pool, email) => {
  const result = await pool.query(
    "SELECT COUNT(*)::integer AS row_count FROM public.users WHERE email = $1",
    [email],
  );
  return result.rows[0].row_count;
};

const cleanupFixture = async (pool, email) => {
  await pool.query("DELETE FROM public.users WHERE email = $1", [email]);
  assert.equal(await countFixtureRows(pool, email), 0);
};

const getPlan = async (pool, sql) => {
  const result = await pool.query(`EXPLAIN (COSTS OFF) ${sql}`);
  return result.rows.map((row) => row["QUERY PLAN"]);
};

const getForcedIndexPlan = async (pool, sql) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL enable_seqscan = off");
    const result = await client.query(`EXPLAIN (COSTS OFF) ${sql}`);
    await client.query("ROLLBACK");
    return result.rows.map((row) => row["QUERY PLAN"]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

test("TEST keeps canonical exact-email indexability and rejects duplicate stored emails", async () => {
  const pool = getVerifiedTestPool();
  const email = `users-email-sequential-${crypto.randomUUID()}@distync.local`;
  const client = await pool.connect();

  try {
    await assertVerifiedSession(pool);
    await assertCanonicalEmailState(pool);

    const exactPlan = await getForcedIndexPlan(
      pool,
      `SELECT id FROM public.users WHERE email = '${email}'`,
    );
    assert.ok(exactPlan.some((line) => line.includes("users_email_key")));
    assert.ok(exactPlan.every((line) => !line.includes("idx_users_email")));

    const lowercasePlan = await getPlan(
      pool,
      `SELECT id FROM public.users WHERE LOWER(email) = LOWER('${email.toUpperCase()}')`,
    );
    assert.ok(lowercasePlan.every((line) => !line.includes("idx_users_email")));

    const googleSubPlan = await getForcedIndexPlan(
      pool,
      "SELECT id FROM public.users WHERE google_sub = 'synthetic-google-sub-plan-check'",
    );
    assert.ok(googleSubPlan.some((line) => line.includes("users_google_sub_key")));

    await client.query("BEGIN");
    const firstInsert = await client.query(
      `
        INSERT INTO public.users (
          email,
          first_name,
          last_name,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, 'Email', 'Index Test', TRUE, NOW(), NOW())
        RETURNING id
      `,
      [email],
    );
    assert.equal(firstInsert.rowCount, 1);

    await client.query("SAVEPOINT duplicate_email_attempt");
    await assert.rejects(
      client.query(
        `
          INSERT INTO public.users (
            email,
            first_name,
            last_name,
            is_active,
            created_at,
            updated_at
          )
          VALUES ($1, 'Duplicate', 'Email Test', TRUE, NOW(), NOW())
        `,
        [email],
      ),
      (error) => {
        assert.equal(error.code, "23505");
        assert.equal(error.constraint, "users_email_key");
        return true;
      },
    );
    await client.query("ROLLBACK TO SAVEPOINT duplicate_email_attempt");
    await client.query("RELEASE SAVEPOINT duplicate_email_attempt");

    const countResult = await client.query(
      "SELECT COUNT(*)::integer AS row_count FROM public.users WHERE email = $1",
      [email],
    );
    assert.equal(countResult.rows[0].row_count, 1);
    await client.query("ROLLBACK");
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    await cleanupFixture(pool, email);
    await pool.end();
  }
});

test("TEST keeps exact-email duplicate protection under concurrent inserts", async () => {
  const pool = getVerifiedTestPool();
  const email = `users-email-concurrent-${crypto.randomUUID()}@distync.local`;
  const clients = [];

  try {
    await assertVerifiedSession(pool);
    await assertCanonicalEmailState(pool);

    for (let index = 0; index < 8; index += 1) {
      clients.push(await pool.connect());
    }

    const results = await Promise.allSettled(
      clients.map((client) =>
        client.query(
          `
            INSERT INTO public.users (
              email,
              first_name,
              last_name,
              is_active,
              created_at,
              updated_at
            )
            VALUES ($1, 'Concurrent', 'Email Test', TRUE, NOW(), NOW())
            RETURNING id
          `,
          [email],
        ),
      ),
    );

    const successes = results.filter((result) => result.status === "fulfilled");
    const duplicateRejections = results.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason?.code === "23505" &&
        result.reason?.constraint === "users_email_key",
    );

    assert.equal(successes.length, 1);
    assert.equal(duplicateRejections.length, 7);
    assert.equal(results.length, 8);
    assert.equal(await countFixtureRows(pool, email), 1);
  } finally {
    clients.forEach((client) => client.release());
    await cleanupFixture(pool, email);
    await pool.end();
  }
});
