const assert = require("node:assert/strict");
const { Client } = require("pg");
const { test } = require("node:test");

const TEST_PROJECT_REF = "cldfgbqjvnianmpecybu";
const PRODUCTION_PROJECT_REF = "deufjjzwvagrljixxskn";
const CANONICAL_INDEX = "idx_distribution_transactions_household_event";
const STANDALONE_INDEX = "idx_distribution_transactions_disaster_event_id";

const getVerifiedTestClient = () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Distribution event-index integration tests require NODE_ENV=test.",
    );
  }

  const rawConnectionString = process.env.TEST_DATABASE_URL;
  if (!rawConnectionString) {
    throw new Error(
      "Distribution event-index integration tests require TEST_DATABASE_URL.",
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
      "Distribution event-index integration tests require the verified TEST Supabase project.",
    );
  }

  if (
    connectionIdentity.includes(PRODUCTION_PROJECT_REF) ||
    rawConnectionString.includes(PRODUCTION_PROJECT_REF)
  ) {
    throw new Error(
      "Distribution event-index integration tests refuse the production Supabase project.",
    );
  }

  const isSupabaseHost =
    connectionUrl.hostname.endsWith(".supabase.co") ||
    connectionUrl.hostname.endsWith(".supabase.com");

  if (!isSupabaseHost) {
    throw new Error(
      "Distribution event-index integration tests require a Supabase PostgreSQL host.",
    );
  }

  return new Client({
    connectionString: rawConnectionString,
    ssl: { rejectUnauthorized: false },
  });
};

const getIndex = async (client, indexName) => {
  const result = await client.query(
    `
      SELECT
        i.relname AS index_name,
        am.amname AS access_method,
        ix.indisunique,
        ix.indisprimary,
        ix.indisexclusion,
        ix.indisvalid,
        ix.indisready,
        ix.indislive,
        ix.indnkeyatts,
        ix.indnatts,
        ix.indkey::text AS indkey,
        ix.indoption::text AS indoption,
        ix.indcollation::text AS indcollation,
        pg_get_indexdef(i.oid) AS index_definition,
        pg_get_expr(ix.indpred, ix.indrelid) AS predicate,
        pg_get_expr(ix.indexprs, ix.indrelid) AS expressions,
        pg_size_pretty(pg_relation_size(i.oid)) AS size,
        COALESCE((
          SELECT json_agg(json_build_object(
            'position', positions.s,
            'attname', a.attname,
            'type', format_type(a.atttypid, a.atttypmod)
          ) ORDER BY positions.s)
          FROM generate_subscripts(ix.indkey, 1) positions(s)
          LEFT JOIN pg_attribute a
            ON a.attrelid = ix.indrelid
           AND a.attnum = ix.indkey[positions.s]
          WHERE positions.s <= ix.indnkeyatts
        ), '[]'::json) AS key_attributes,
        COALESCE((
          SELECT json_agg(json_build_object(
            'position', positions.s,
            'name', opc.opcname,
            'namespace', opn.nspname,
            'input_type', format_type(opc.opcintype, -1)
          ) ORDER BY positions.s)
          FROM generate_subscripts(ix.indclass, 1) positions(s)
          LEFT JOIN pg_opclass opc
            ON opc.oid = ix.indclass[positions.s]
          LEFT JOIN pg_namespace opn ON opn.oid = opc.opcnamespace
          WHERE positions.s <= ix.indnkeyatts
        ), '[]'::json) AS key_opclasses,
        (
          SELECT COUNT(*)
          FROM pg_constraint c
          WHERE c.conindid = i.oid
        ) AS backing_constraint_count,
        (
          SELECT COUNT(*)
          FROM pg_depend d
          WHERE d.refclassid = 'pg_class'::regclass
            AND d.refobjid = i.oid
        ) AS external_dependent_count,
        (
          SELECT COUNT(*)
          FROM pg_depend d
          WHERE d.classid = 'pg_class'::regclass
            AND d.objid = i.oid
            AND d.refclassid = 'pg_constraint'::regclass
        ) AS constraint_dependency_count
      FROM pg_class i
      INNER JOIN pg_namespace n ON n.oid = i.relnamespace
      INNER JOIN pg_index ix ON ix.indexrelid = i.oid
      INNER JOIN pg_class t ON t.oid = ix.indrelid
      INNER JOIN pg_namespace tn ON tn.oid = t.relnamespace
      INNER JOIN pg_am am ON am.oid = i.relam
      WHERE n.nspname = 'public'
        AND tn.nspname = 'public'
        AND t.relname = 'distribution_transactions'
        AND i.relname = $1
    `,
    [indexName],
  );

  return result.rows[0] || null;
};

const assertCanonicalIndex = (index) => {
  assert.ok(index, "canonical composite index should exist");
  assert.equal(index.index_name, CANONICAL_INDEX);
  assert.equal(index.access_method, "btree");
  assert.equal(index.indisunique, false);
  assert.equal(index.indisprimary, false);
  assert.equal(index.indisexclusion, false);
  assert.equal(index.indisvalid, true);
  assert.equal(index.indisready, true);
  assert.equal(index.indislive, true);
  assert.equal(index.indnkeyatts, 2);
  assert.equal(index.indnatts, 2);
  assert.equal(index.indkey, "2 3");
  assert.equal(index.indoption, "0 0");
  assert.equal(index.indcollation, "0 0");
  assert.deepEqual(index.key_attributes, [
    { position: 0, attname: "disaster_event_id", type: "uuid" },
    { position: 1, attname: "household_id", type: "uuid" },
  ]);
  assert.deepEqual(index.key_opclasses, [
    {
      position: 0,
      name: "uuid_ops",
      namespace: "pg_catalog",
      input_type: "uuid",
    },
    {
      position: 1,
      name: "uuid_ops",
      namespace: "pg_catalog",
      input_type: "uuid",
    },
  ]);
  assert.equal(
    index.index_definition,
    "CREATE INDEX idx_distribution_transactions_household_event ON public.distribution_transactions USING btree (disaster_event_id, household_id)",
  );
  assert.equal(index.predicate, null);
  assert.equal(index.expressions, null);
  assert.equal(index.backing_constraint_count, "0");
  assert.equal(index.external_dependent_count, "0");
  assert.equal(index.constraint_dependency_count, "0");
};

const assertHouseholdIndex = (index) => {
  assert.ok(index, "household-leading index should remain present");
  assert.equal(index.index_name, "idx_distribution_transactions_household_id");
  assert.equal(index.access_method, "btree");
  assert.equal(index.indisunique, false);
  assert.equal(index.indisprimary, false);
  assert.equal(index.indisexclusion, false);
  assert.equal(index.indisvalid, true);
  assert.equal(index.indisready, true);
  assert.equal(index.indislive, true);
  assert.equal(index.indnkeyatts, 1);
  assert.equal(index.indnatts, 1);
  assert.equal(index.indkey, "3");
  assert.deepEqual(index.key_attributes, [
    { position: 0, attname: "household_id", type: "uuid" },
  ]);
  assert.equal(index.backing_constraint_count, "0");
};

const assertStubConstraint = async (client) => {
  const result = await client.query(`
    SELECT
      c.conname,
      c.contype,
      c.convalidated,
      c.condeferrable,
      c.condeferred,
      c.conkey::text AS conkey,
      c.conindid::regclass::text AS backing_index,
      pg_get_constraintdef(c.oid, true) AS definition,
      i.relname AS backing_index_name,
      am.amname AS access_method,
      ix.indisunique,
      ix.indisvalid,
      ix.indisready,
      ix.indislive,
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
      AND c.conrelid = 'public.distribution_transactions'::regclass
      AND c.conname = 'uq_distribution_stub'
  `);

  assert.equal(result.rowCount, 1);
  const constraint = result.rows[0];
  assert.equal(constraint.conname, "uq_distribution_stub");
  assert.equal(constraint.contype, "u");
  assert.equal(constraint.convalidated, true);
  assert.equal(constraint.condeferrable, false);
  assert.equal(constraint.condeferred, false);
  assert.equal(constraint.conkey, "{4}");
  assert.equal(constraint.backing_index, "uq_distribution_stub");
  assert.equal(constraint.backing_index_name, "uq_distribution_stub");
  assert.equal(constraint.definition, "UNIQUE (stub_id)");
  assert.equal(constraint.access_method, "btree");
  assert.equal(constraint.indisunique, true);
  assert.equal(constraint.indisvalid, true);
  assert.equal(constraint.indisready, true);
  assert.equal(constraint.indislive, true);
  assert.equal(constraint.internally_owned, true);
};

const getForcedPlan = async (client, sql) => {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL enable_seqscan = off");
    const result = await client.query(`EXPLAIN (COSTS OFF) ${sql}`);
    await client.query("ROLLBACK");
    return result.rows.map((row) => row["QUERY PLAN"]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
};

const quoteLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`;

test("TEST has the canonical event-leading index contract and planner path", async () => {
  const client = getVerifiedTestClient();

  try {
    await client.connect();

    const session = (
      await client.query(`
        SELECT
          current_database() AS database_name,
          current_user,
          session_user,
          current_schema() AS schema_name,
          version() AS server_version
      `)
    ).rows[0];
    assert.equal(session.database_name, "postgres");
    assert.equal(session.current_user, "postgres");
    assert.equal(session.session_user, "postgres");
    assert.equal(session.schema_name, "public");
    assert.match(session.server_version, /^PostgreSQL 17\./);

    assertCanonicalIndex(await getIndex(client, CANONICAL_INDEX));
    assert.equal(await getIndex(client, STANDALONE_INDEX), null);
    assertHouseholdIndex(
      await getIndex(client, "idx_distribution_transactions_household_id"),
    );
    await assertStubConstraint(client);

    const fixture = (
      await client.query(`
        SELECT disaster_event_id, household_id
        FROM public.distribution_transactions
        ORDER BY id
        LIMIT 1
      `)
    ).rows[0];
    assert.ok(fixture, "TEST should contain a distribution transaction fixture");

    const event = quoteLiteral(fixture.disaster_event_id);
    const eventHistorySql = `
      SELECT dt.id, dt.household_id, dt.distribution_status
      FROM public.distribution_transactions dt
      WHERE dt.disaster_event_id = ${event}
    `;
    const eventReportSql = `
      SELECT dt.disaster_event_id, COUNT(*)::int AS distribution_transaction_count
      FROM public.distribution_transactions dt
      WHERE dt.disaster_event_id = ${event}
        AND dt.distribution_status = 'CLAIMED'
      GROUP BY dt.disaster_event_id
    `;
    const eventHouseholdSql = `
      SELECT dt.disaster_event_id, dt.household_id, COUNT(*)::int AS transaction_count
      FROM public.distribution_transactions dt
      WHERE dt.disaster_event_id = ${event}
      GROUP BY dt.disaster_event_id, dt.household_id
      ORDER BY dt.disaster_event_id, dt.household_id
    `;
    const plans = {
      event_history: await getForcedPlan(client, eventHistorySql),
      event_report: await getForcedPlan(client, eventReportSql),
      event_household_grouping: await getForcedPlan(client, eventHouseholdSql),
    };

    for (const [name, plan] of Object.entries(plans)) {
      assert.ok(
        plan.some((line) => line.includes(CANONICAL_INDEX)),
        `${name} should retain the canonical event-leading planner path`,
      );
      assert.ok(
        plan.every((line) => !line.includes(STANDALONE_INDEX)),
        `${name} must not reference the removed standalone index`,
      );
    }
  } finally {
    await client.end();
  }
});
