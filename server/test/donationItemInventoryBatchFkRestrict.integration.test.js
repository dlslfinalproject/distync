const assert = require("node:assert/strict");
const { Client } = require("pg");
const { test } = require("node:test");

const TEST_PROJECT_REF = "cldfgbqjvnianmpecybu";
const PRODUCTION_PROJECT_REF = "deufjjzwvagrljixxskn";
const TARGET_CONSTRAINT = "donation_items_inventory_batch_id_fkey";

const getVerifiedTestClient = () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Donation-item batch-FK integration tests require NODE_ENV=test.",
    );
  }

  const rawConnectionString = process.env.TEST_DATABASE_URL;
  if (!rawConnectionString) {
    throw new Error(
      "Donation-item batch-FK integration tests require TEST_DATABASE_URL.",
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
      "Donation-item batch-FK integration tests require the verified TEST Supabase project.",
    );
  }

  if (
    connectionIdentity.includes(PRODUCTION_PROJECT_REF) ||
    rawConnectionString.includes(PRODUCTION_PROJECT_REF)
  ) {
    throw new Error(
      "Donation-item batch-FK integration tests refuse the production Supabase project.",
    );
  }

  const isSupabaseHost =
    connectionUrl.hostname.endsWith(".supabase.co") ||
    connectionUrl.hostname.endsWith(".supabase.com");
  if (!isSupabaseHost) {
    throw new Error(
      "Donation-item batch-FK integration tests require a Supabase PostgreSQL host.",
    );
  }

  return new Client({
    connectionString: rawConnectionString,
    ssl: { rejectUnauthorized: false },
  });
};

const getTargetConstraint = async (client) => {
  const result = await client.query(`
    SELECT
      n.nspname AS source_schema,
      source_table.relname AS source_table,
      referenced_namespace.nspname AS target_schema,
      target_table.relname AS target_table,
      c.conname,
      c.contype::text AS contype,
      c.convalidated,
      c.condeferrable,
      c.condeferred,
      c.confupdtype::text AS on_update_code,
      c.confdeltype::text AS on_delete_code,
      c.confmatchtype::text AS match_code,
      c.conkey::text AS source_key,
      c.confkey::text AS target_key,
      c.conbin IS NOT NULL AS has_expression,
      pg_get_constraintdef(c.oid) AS constraint_definition
    FROM pg_constraint c
    JOIN pg_class source_table ON source_table.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = source_table.relnamespace
    JOIN pg_class target_table ON target_table.oid = c.confrelid
    JOIN pg_namespace referenced_namespace
      ON referenced_namespace.oid = target_table.relnamespace
    WHERE n.nspname = 'public'
      AND c.conrelid = 'public.donation_items'::regclass
      AND c.conname = $1
  `, [TARGET_CONSTRAINT]);
  return result.rows;
};

test("live TEST catalog retains the exact donation-item batch RESTRICT contract", async () => {
  const client = getVerifiedTestClient();
  await client.connect();
  try {
    const constraints = await getTargetConstraint(client);
    assert.equal(constraints.length, 1);
    assert.deepEqual(constraints[0], {
      source_schema: "public",
      source_table: "donation_items",
      target_schema: "public",
      target_table: "inventory_batches",
      conname: TARGET_CONSTRAINT,
      contype: "f",
      convalidated: true,
      condeferrable: false,
      condeferred: false,
      on_update_code: "a",
      on_delete_code: "r",
      match_code: "s",
      source_key: "{4}",
      target_key: "{1}",
      has_expression: false,
      constraint_definition:
        "FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT",
    });

    const column = await client.query(`
      SELECT
        format_type(a.atttypid, a.atttypmod) AS data_type,
        NOT a.attnotnull AS nullable,
        pg_get_expr(ad.adbin, ad.adrelid) AS column_default,
        a.attgenerated,
        a.attidentity
      FROM pg_attribute a
      LEFT JOIN pg_attrdef ad
        ON ad.adrelid = a.attrelid
       AND ad.adnum = a.attnum
      WHERE a.attrelid = 'public.donation_items'::regclass
        AND a.attname = 'inventory_batch_id'
        AND NOT a.attisdropped
    `);
    assert.deepEqual(column.rows, [
      {
        data_type: "uuid",
        nullable: true,
        column_default: null,
        attgenerated: "",
        attidentity: "",
      },
    ]);

    const equivalent = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM pg_constraint
      WHERE contype = 'f'
        AND conrelid = 'public.donation_items'::regclass
        AND confrelid = 'public.inventory_batches'::regclass
        AND conkey = ARRAY[(
          SELECT attnum
          FROM pg_attribute
          WHERE attrelid = 'public.donation_items'::regclass
            AND attname = 'inventory_batch_id'
        )]::smallint[]
        AND confkey = ARRAY[(
          SELECT attnum
          FROM pg_attribute
          WHERE attrelid = 'public.inventory_batches'::regclass
            AND attname = 'id'
        )]::smallint[]
    `);
    assert.equal(equivalent.rows[0].count, 1);
  } finally {
    await client.end();
  }
});

test("live TEST donation-item data remains fully linked and unchanged", async () => {
  const client = getVerifiedTestClient();
  await client.connect();
  try {
    const result = await client.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE di.inventory_batch_id IS NOT NULL)::int AS with_batch,
        COUNT(*) FILTER (WHERE di.inventory_batch_id IS NULL)::int AS null_batch,
        COUNT(*) FILTER (
          WHERE di.inventory_batch_id IS NOT NULL
            AND ib.id IS NULL
        )::int AS orphan_batch,
        COUNT(*) FILTER (
          WHERE di.inventory_batch_id IS NOT NULL
            AND ib.id IS NOT NULL
        )::int AS linked,
        COUNT(*) FILTER (
          WHERE di.inventory_batch_id IS NOT NULL
            AND ib.source_type = 'DONATED'
        )::int AS donated,
        COUNT(*) FILTER (
          WHERE di.inventory_batch_id IS NOT NULL
            AND ib.source_type IS DISTINCT FROM 'DONATED'
        )::int AS other_unknown,
        COUNT(*) FILTER (
          WHERE di.inventory_batch_id IS NOT NULL
            AND ib.id IS NOT NULL
            AND di.inventory_item_id IS DISTINCT FROM ib.inventory_item_id
        )::int AS mismatches,
        COALESCE(SUM(di.quantity_received), 0)::bigint AS quantity_sum,
        md5(COALESCE(
          string_agg(
            concat_ws(
              '|',
              di.id::text,
              di.donation_id::text,
              di.inventory_item_id::text,
              di.inventory_batch_id::text,
              di.quantity_received::text
            ),
            '|' ORDER BY di.id
          ),
          ''
        )) AS fingerprint
      FROM public.donation_items di
      LEFT JOIN public.inventory_batches ib
        ON ib.id = di.inventory_batch_id
    `);

    const [row] = result.rows;
    assert.ok(row.total >= 0);
    assert.equal(row.with_batch, row.total);
    assert.equal(row.null_batch, 0);
    assert.equal(row.orphan_batch, 0);
    assert.equal(row.linked, row.total);
    assert.equal(row.donated, row.total);
    assert.equal(row.other_unknown, 0);
    assert.equal(row.mismatches, 0);
    assert.match(row.quantity_sum, /^\d+$/);
    assert.match(row.fingerprint, /^[0-9a-f]{32}$/);
  } finally {
    await client.end();
  }
});

test("live TEST neighboring provenance FKs and donation views remain unchanged", async () => {
  const client = getVerifiedTestClient();
  await client.connect();
  try {
    const fks = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS constraint_definition
      FROM pg_constraint
      WHERE conname IN (
        'distribution_transaction_items_inventory_batch_id_fkey',
        'inventory_transactions_inventory_batch_id_fkey'
      )
      ORDER BY conname
    `);
    assert.deepEqual(fks.rows, [
      {
        conname: "distribution_transaction_items_inventory_batch_id_fkey",
        constraint_definition:
          "FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT",
      },
      {
        conname: "inventory_transactions_inventory_batch_id_fkey",
        constraint_definition:
          "FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches(id) ON DELETE CASCADE",
      },
    ]);

    const views = await client.query(`
      SELECT
        table_name,
        md5(pg_get_viewdef(
          (quote_ident(table_schema) || '.' || quote_ident(table_name))::regclass,
          true
        )) AS definition_fingerprint
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name IN (
          'donation_transparency_summary',
          'public_donation_summary'
        )
      ORDER BY table_name
    `);
    assert.deepEqual(views.rows, [
      {
        table_name: "donation_transparency_summary",
        definition_fingerprint: "31f62955a1f694dcaaa6ad4d62dfd9c1",
      },
      {
        table_name: "public_donation_summary",
        definition_fingerprint: "0514f091ebfb4ad9a4c82fb80a4d9ece",
      },
    ]);
  } finally {
    await client.end();
  }
});
