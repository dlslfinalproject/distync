const assert = require("node:assert/strict");
const { Client } = require("pg");
const { test } = require("node:test");

const TEST_PROJECT_REF = "cldfgbqjvnianmpecybu";
const PRODUCTION_PROJECT_REF = "deufjjzwvagrljixxskn";
const TARGET_INDEX = "idx_distribution_transaction_items_batch";

const getVerifiedTestClient = () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "DTI batch-index integration tests require NODE_ENV=test.",
    );
  }

  const rawConnectionString = process.env.TEST_DATABASE_URL;
  if (!rawConnectionString) {
    throw new Error(
      "DTI batch-index integration tests require TEST_DATABASE_URL.",
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
      "DTI batch-index integration tests require the verified TEST Supabase project.",
    );
  }

  if (
    connectionIdentity.includes(PRODUCTION_PROJECT_REF) ||
    rawConnectionString.includes(PRODUCTION_PROJECT_REF)
  ) {
    throw new Error(
      "DTI batch-index integration tests refuse the production Supabase project.",
    );
  }

  const isSupabaseHost =
    connectionUrl.hostname.endsWith(".supabase.co") ||
    connectionUrl.hostname.endsWith(".supabase.com");
  if (!isSupabaseHost) {
    throw new Error(
      "DTI batch-index integration tests require a Supabase PostgreSQL host.",
    );
  }

  return new Client({
    connectionString: rawConnectionString,
    ssl: { rejectUnauthorized: false },
  });
};

const getIndex = async (client) => {
  const result = await client.query(
    `
      SELECT
        i.oid::text AS index_oid,
        i.relname AS index_name,
        n.nspname AS index_schema,
        t.oid::text AS table_oid,
        t.relname AS table_name,
        tn.nspname AS table_schema,
        i.relkind,
        am.amname AS access_method,
        ix.indisunique,
        ix.indisprimary,
        ix.indisexclusion,
        ix.indisvalid,
        ix.indisready,
        ix.indislive,
        ix.indnullsnotdistinct,
        ix.indnkeyatts,
        ix.indnatts,
        ix.indkey::text AS indkey,
        ix.indoption::text AS indoption,
        ix.indcollation::text AS indcollation,
        pg_get_indexdef(i.oid) AS index_definition,
        pg_get_expr(ix.indpred, ix.indrelid) AS predicate,
        pg_get_expr(ix.indexprs, ix.indrelid) AS expressions,
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
          LEFT JOIN pg_opclass opc ON opc.oid = ix.indclass[positions.s]
          LEFT JOIN pg_namespace opn ON opn.oid = opc.opcnamespace
          WHERE positions.s <= ix.indnkeyatts
        ), '[]'::json) AS key_opclasses,
        pg_size_pretty(pg_relation_size(i.oid)) AS size,
        pg_relation_size(i.oid) AS size_bytes,
        (
          SELECT COUNT(*)
          FROM pg_constraint c
          WHERE c.conindid = i.oid
        ) AS backing_constraint_count,
        (
          SELECT COUNT(*)
          FROM pg_depend d
          WHERE d.classid = 'pg_class'::regclass
            AND d.objid = i.oid
            AND d.refclassid = 'pg_constraint'::regclass
        ) AS constraint_dependency_count,
        COALESCE((
          SELECT json_agg(json_build_object(
            'referenced_class', d.refclassid::regclass::text,
            'referenced_object_id', d.refobjid::text,
            'referenced_subobject_id', d.refobjsubid,
            'dependency_type', d.deptype
          ) ORDER BY d.refclassid, d.refobjid, d.refobjsubid, d.deptype)
          FROM pg_depend d
          WHERE d.classid = 'pg_class'::regclass
            AND d.objid = i.oid
        ), '[]'::json) AS dependencies,
        (
          SELECT COUNT(*)
          FROM pg_depend d
          WHERE d.refclassid = 'pg_class'::regclass
            AND d.refobjid = i.oid
        ) AS external_dependent_count
      FROM pg_class i
      JOIN pg_namespace n ON n.oid = i.relnamespace
      JOIN pg_index ix ON ix.indexrelid = i.oid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace tn ON tn.oid = t.relnamespace
      JOIN pg_am am ON am.oid = i.relam
      WHERE n.nspname = 'public'
        AND tn.nspname = 'public'
        AND i.relname = $1
    `,
    [TARGET_INDEX],
  );

  return result.rows[0] || null;
};

const assertIndexContract = (index, table, column) => {
  assert.ok(index, "the canonical DTI batch index should exist");
  assert.equal(index.index_name, TARGET_INDEX);
  assert.equal(index.index_schema, "public");
  assert.equal(index.table_oid, table.table_oid);
  assert.equal(index.table_name, "distribution_transaction_items");
  assert.equal(index.table_schema, "public");
  assert.equal(index.relkind, "i");
  assert.equal(index.access_method, "btree");
  assert.equal(index.indisunique, false);
  assert.equal(index.indisprimary, false);
  assert.equal(index.indisexclusion, false);
  assert.equal(index.indisvalid, true);
  assert.equal(index.indisready, true);
  assert.equal(index.indislive, true);
  assert.equal(index.indnullsnotdistinct, false);
  assert.equal(index.indnkeyatts, 1);
  assert.equal(index.indnatts, 1);
  assert.equal(index.indkey, String(column.attnum));
  assert.equal(index.indoption, "0");
  assert.equal(index.indcollation, "0");
  assert.equal(
    index.index_definition,
    "CREATE INDEX idx_distribution_transaction_items_batch ON public.distribution_transaction_items USING btree (inventory_batch_id)",
  );
  assert.equal(index.predicate, null);
  assert.equal(index.expressions, null);
  assert.deepEqual(index.key_attributes, [
    {
      position: 0,
      attname: "inventory_batch_id",
      type: "uuid",
    },
  ]);
  assert.deepEqual(index.key_opclasses, [
    {
      position: 0,
      name: "uuid_ops",
      namespace: "pg_catalog",
      input_type: "uuid",
    },
  ]);
  assert.equal(Number(index.backing_constraint_count), 0);
  assert.equal(Number(index.constraint_dependency_count), 0);
  assert.deepEqual(index.dependencies, [
    {
      referenced_class: "pg_class",
      referenced_object_id: table.table_oid,
      referenced_subobject_id: column.attnum,
      dependency_type: "a",
    },
  ]);
  assert.equal(Number(index.external_dependent_count), 0);
  assert.ok(Number(index.size_bytes) > 0);
};

const getForeignKeys = async (client) => {
  const result = await client.query(`
    SELECT
      c.conname,
      pg_get_constraintdef(c.oid, false) AS definition,
      c.convalidated,
      c.condeferrable,
      c.condeferred,
      CASE c.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
      END AS delete_action,
      CASE c.confupdtype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
      END AS update_action
    FROM pg_constraint c
    WHERE c.connamespace = 'public'::regnamespace
      AND c.conrelid = 'public.distribution_transaction_items'::regclass
      AND c.contype = 'f'
    ORDER BY c.conname
  `);
  return new Map(result.rows.map((row) => [row.conname, row]));
};

const getDataProfile = async (client) => {
  const result = await client.query(`
    SELECT COUNT(*)::integer AS row_count,
           COUNT(DISTINCT distribution_transaction_id)::integer AS parent_count,
           COUNT(DISTINCT inventory_batch_id)::integer AS batch_count,
           COUNT(DISTINCT inventory_item_id)::integer AS item_count,
           COALESCE(SUM(quantity_released), 0)::integer AS quantity_total,
           COUNT(*) FILTER (WHERE quantity_released <= 0)::integer AS non_positive_quantity_count,
           COUNT(*) FILTER (WHERE item_code_snapshot IS NULL)::integer AS item_code_snapshot_null_count,
           COUNT(*) FILTER (WHERE item_name_snapshot IS NULL)::integer AS item_name_snapshot_null_count,
           COUNT(*) FILTER (WHERE unit_of_measure_snapshot IS NULL)::integer AS unit_of_measure_snapshot_null_count
    FROM public.distribution_transaction_items
  `);
  return result.rows[0];
};

const getIntegrityProfile = async (client) => {
  const result = await client.query(`
    SELECT COUNT(*) FILTER (WHERE dt.id IS NULL)::integer AS orphan_distribution_count,
           COUNT(*) FILTER (WHERE ib.id IS NULL)::integer AS orphan_batch_count,
           COUNT(*) FILTER (WHERE ii.id IS NULL)::integer AS orphan_item_count,
           COUNT(*) FILTER (
             WHERE ib.id IS NOT NULL
               AND ib.inventory_item_id IS DISTINCT FROM dti.inventory_item_id
           )::integer AS batch_item_mismatch_count
    FROM public.distribution_transaction_items dti
    LEFT JOIN public.distribution_transactions dt
      ON dt.id = dti.distribution_transaction_id
    LEFT JOIN public.inventory_batches ib
      ON ib.id = dti.inventory_batch_id
    LEFT JOIN public.inventory_items ii
      ON ii.id = dti.inventory_item_id
  `);
  return result.rows[0];
};

const getOutflowReconciliation = async (client) => {
  const result = await client.query(`
    WITH expected AS (
      SELECT distribution_transaction_id, inventory_batch_id, inventory_item_id,
             COUNT(*)::integer AS dti_row_count,
             SUM(quantity_released)::integer AS expected_quantity
      FROM public.distribution_transaction_items
      GROUP BY distribution_transaction_id, inventory_batch_id, inventory_item_id
    ), actual AS (
      SELECT it.reference_id AS distribution_transaction_id,
             it.inventory_batch_id,
             ib.inventory_item_id,
             COUNT(*)::integer AS outflow_row_count,
             SUM(it.quantity)::integer AS actual_quantity
      FROM public.inventory_transactions it
      JOIN public.inventory_batches ib ON ib.id = it.inventory_batch_id
      WHERE it.reference_type = 'DISTRIBUTION'
        AND it.transaction_type = 'OUTFLOW'
        AND it.reference_id IS NOT NULL
      GROUP BY it.reference_id, it.inventory_batch_id, ib.inventory_item_id
    ), joined AS (
      SELECT e.distribution_transaction_id AS expected_distribution_transaction_id,
             a.distribution_transaction_id AS actual_distribution_transaction_id,
             e.inventory_batch_id AS expected_inventory_batch_id,
             a.inventory_batch_id AS actual_inventory_batch_id,
             e.inventory_item_id AS expected_inventory_item_id,
             a.inventory_item_id AS actual_inventory_item_id,
             e.dti_row_count,
             a.outflow_row_count,
             e.expected_quantity,
             a.actual_quantity
      FROM expected e
      FULL OUTER JOIN actual a
        ON a.distribution_transaction_id = e.distribution_transaction_id
       AND a.inventory_batch_id = e.inventory_batch_id
       AND a.inventory_item_id = e.inventory_item_id
    )
    SELECT (SELECT COUNT(*)::integer FROM public.distribution_transaction_items) AS dti_row_count,
           (SELECT COUNT(*)::integer
            FROM public.inventory_transactions
            WHERE reference_type = 'DISTRIBUTION'
              AND transaction_type = 'OUTFLOW'
              AND reference_id IS NOT NULL) AS outflow_row_count,
           (SELECT COALESCE(SUM(quantity_released), 0)::integer
            FROM public.distribution_transaction_items) AS dti_quantity,
           (SELECT COALESCE(SUM(quantity), 0)::integer
            FROM public.inventory_transactions
            WHERE reference_type = 'DISTRIBUTION'
              AND transaction_type = 'OUTFLOW'
              AND reference_id IS NOT NULL) AS outflow_quantity,
           COUNT(*) FILTER (
             WHERE dti_row_count IS NOT NULL AND outflow_row_count IS NULL
           )::integer AS expected_only_groups,
           COUNT(*) FILTER (
             WHERE dti_row_count IS NULL AND outflow_row_count IS NOT NULL
           )::integer AS actual_only_groups,
           COUNT(*) FILTER (
             WHERE dti_row_count IS NOT NULL
               AND outflow_row_count IS NOT NULL
               AND expected_quantity IS DISTINCT FROM actual_quantity
           )::integer AS quantity_mismatch_groups,
           COUNT(*) FILTER (
             WHERE dti_row_count IS NOT NULL
               AND outflow_row_count IS NOT NULL
               AND (
                 expected_inventory_item_id IS DISTINCT FROM actual_inventory_item_id
                 OR expected_inventory_batch_id IS DISTINCT FROM actual_inventory_batch_id
               )
           )::integer AS key_mismatch_groups
    FROM joined
  `);
  return result.rows[0];
};

const getForcedPlan = async (client, batchId) => {
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL enable_seqscan = off");
    const result = await client.query(
      `EXPLAIN (COSTS OFF)
       SELECT id, distribution_transaction_id, inventory_item_id, quantity_released
       FROM public.distribution_transaction_items
       WHERE inventory_batch_id = $1`,
      [batchId],
    );
    await client.query("ROLLBACK");
    return result.rows.map((row) => row["QUERY PLAN"]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
};

test("TEST DTI batch index and FK contracts remain intact after reconciliation", async () => {
  const client = getVerifiedTestClient();

  try {
    await client.connect();

    const session = (
      await client.query(`
        SELECT current_database() AS database_name,
               current_user,
               session_user,
               current_schema() AS schema_name,
               current_setting('server_version') AS server_version
      `)
    ).rows[0];
    assert.equal(session.database_name, "postgres");
    assert.equal(session.current_user, "postgres");
    assert.equal(session.session_user, "postgres");
    assert.equal(session.schema_name, "public");
    assert.match(session.server_version, /^17\./);

    const table = (
      await client.query(`
        SELECT c.oid::text AS table_oid,
               c.relkind,
               c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'distribution_transaction_items'
      `)
    ).rows[0];
    assert.ok(table, "DTI table should exist");
    assert.equal(table.relkind, "r");

    const column = (
      await client.query(`
        SELECT a.attnum,
               format_type(a.atttypid, a.atttypmod) AS data_type,
               a.attnotnull,
               a.attisdropped
        FROM pg_attribute a
        WHERE a.attrelid = 'public.distribution_transaction_items'::regclass
          AND a.attname = 'inventory_batch_id'
      `)
    ).rows[0];
    assert.ok(column, "inventory_batch_id should exist");
    assert.equal(column.data_type, "uuid");
    assert.equal(column.attnotnull, true);
    assert.equal(column.attisdropped, false);

    assertIndexContract(await getIndex(client), table, column);

    const fks = await getForeignKeys(client);
    const expectedFks = {
      distribution_transaction_items_distribution_transaction_id_fkey: {
        definition:
          "FOREIGN KEY (distribution_transaction_id) REFERENCES distribution_transactions(id) ON DELETE CASCADE",
        delete_action: "CASCADE",
      },
      distribution_transaction_items_inventory_batch_id_fkey: {
        definition:
          "FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT",
        delete_action: "RESTRICT",
      },
      distribution_transaction_items_inventory_item_id_fkey: {
        definition:
          "FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT",
        delete_action: "RESTRICT",
      },
    };
    for (const [name, expected] of Object.entries(expectedFks)) {
      const fk = fks.get(name);
      assert.ok(fk, `${name} should exist`);
      assert.equal(fk.definition, expected.definition);
      assert.equal(fk.delete_action, expected.delete_action);
      assert.equal(fk.update_action, "NO ACTION");
      assert.equal(fk.convalidated, true);
      assert.equal(fk.condeferrable, false);
      assert.equal(fk.condeferred, false);
    }

    const profile = await getDataProfile(client);
    const integrity = await getIntegrityProfile(client);
    const outflow = await getOutflowReconciliation(client);

    for (const field of [
      "non_positive_quantity_count",
      "item_code_snapshot_null_count",
      "item_name_snapshot_null_count",
      "unit_of_measure_snapshot_null_count",
    ]) {
      assert.equal(Number(profile[field]), 0, `${field} should remain zero`);
    }
    for (const field of [
      "orphan_distribution_count",
      "orphan_batch_count",
      "orphan_item_count",
      "batch_item_mismatch_count",
    ]) {
      assert.equal(Number(integrity[field]), 0, `${field} should remain zero`);
    }
    assert.equal(Number(outflow.dti_row_count), Number(profile.row_count));
    assert.equal(Number(outflow.dti_quantity), Number(profile.quantity_total));
    assert.equal(Number(outflow.outflow_row_count), Number(profile.row_count));
    assert.equal(Number(outflow.outflow_quantity), Number(profile.quantity_total));
    assert.equal(Number(outflow.expected_only_groups), 0);
    assert.equal(Number(outflow.actual_only_groups), 0);
    assert.equal(Number(outflow.quantity_mismatch_groups), 0);
    assert.equal(Number(outflow.key_mismatch_groups), 0);

    const batch = (
      await client.query(`
        SELECT inventory_batch_id
        FROM public.distribution_transaction_items
        ORDER BY inventory_batch_id
        LIMIT 1
      `)
    ).rows[0];
    assert.ok(batch, "TEST should contain a representative DTI batch");
    const plan = await getForcedPlan(client, batch.inventory_batch_id);
    assert.ok(
      plan.some((line) => line.includes(TARGET_INDEX)),
      "forced batch lookup should retain the canonical DTI batch-index planner path",
    );
  } finally {
    await client.end();
  }
});
