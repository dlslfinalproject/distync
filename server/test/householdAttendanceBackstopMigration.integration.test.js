const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");
const { test } = require("node:test");

const TEST_PROJECT_REF = "cldfgbqjvnianmpecybu";
const PRODUCTION_PROJECT_REF = "deufjjzwvagrljixxskn";
const migrationPath = path.resolve(
  __dirname,
  "../../database/migrations/2026-09-14_add_household_attendance_backstops.sql",
);
const migration = fs.readFileSync(migrationPath, "utf8");

const sql = (lines) => lines.join("\n");
const quoteIdentifier = (value) => {
  assert.match(value, /^[a-z0-9_]+$/);
  return '"' + value.replaceAll('"', '""') + '"';
};
const quoteLiteral = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const tempRegclass = (tableName) =>
  quoteLiteral("pg_temp." + tableName) + "::pg_catalog.regclass";

const getVerifiedTestClient = () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Household backstop integration tests require NODE_ENV=test.",
    );
  }

  const rawConnectionString = process.env.TEST_DATABASE_URL;
  if (!rawConnectionString) {
    throw new Error(
      "Household backstop integration tests require TEST_DATABASE_URL.",
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
  const databaseName = connectionUrl.pathname.replace(/^\//, "");

  if (
    connectionIdentity.includes(PRODUCTION_PROJECT_REF) ||
    rawConnectionString.includes(PRODUCTION_PROJECT_REF)
  ) {
    throw new Error(
      "Household backstop integration tests refuse the production Supabase project.",
    );
  }

  const isSupabaseHost =
    connectionUrl.hostname.endsWith(".supabase.co") ||
    connectionUrl.hostname.endsWith(".supabase.com");
  if (isSupabaseHost) {
    if (!connectionIdentity.includes(TEST_PROJECT_REF)) {
      throw new Error(
        "Household backstop integration tests require the verified TEST Supabase project.",
      );
    }
  } else if (!/(^|[_-])test([_-]|$)/i.test(databaseName)) {
    throw new Error(
      "Household backstop integration tests require a disposable database whose name contains test.",
    );
  }

  return new Client({
    connectionString: rawConnectionString,
    ...(isSupabaseHost ? { ssl: { rejectUnauthorized: false } } : {}),
  });
};

const assertPostgresSession = async (client) => {
  const result = await client.query(
    sql([
      "SELECT",
      "  current_database() AS database_name,",
      "  current_user,",
      "  session_user,",
      "  current_schema() AS schema_name,",
      "  version() AS server_version",
    ]),
  );
  const session = result.rows[0];
  assert.ok(session.database_name);
  assert.ok(session.current_user);
  assert.equal(session.current_user, session.session_user);
  assert.equal(session.schema_name, "public");
  assert.match(
    session.server_version,
    /^PostgreSQL 17\.6(?:\D|$)/,
    "PC fixtures must run against PostgreSQL 17.6",
  );
};

const withTempClient = async (callback) => {
  const client = getVerifiedTestClient();
  await client.connect();
  try {
    await assertPostgresSession(client);
    await client.query("BEGIN");
    return await callback(client);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
};

const createC1Table = async (client, tableName) => {
  await client.query(
    sql([
      "CREATE TEMP TABLE " + quoteIdentifier(tableName) + " (",
      "  evacuee_id uuid,",
      "  household_id uuid,",
      "  id uuid,",
      "  status character varying,",
      "  time_out timestamp with time zone",
      ")",
    ]),
  );
};

const createC1Index = async (
  client,
  tableName,
  indexName,
  {
    unique = true,
    column = "evacuee_id",
    predicate = "status = 'PRESENT' AND time_out IS NULL",
  } = {},
) => {
  await client.query(
    "CREATE " +
      (unique ? "UNIQUE " : "") +
      "INDEX " +
      quoteIdentifier(indexName) +
      " ON " +
      quoteIdentifier(tableName) +
      " (" +
      quoteIdentifier(column) +
      ") WHERE " +
      predicate,
  );
};

const runC1Postcondition = async (client, tableName, indexName) => {
  const table = tempRegclass(tableName);
  const index = quoteLiteral(indexName);
  const result = await client.query(
    sql([
      "SELECT EXISTS (",
      "  SELECT 1",
      "  FROM pg_catalog.pg_class idx",
      "  JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace",
      "  JOIN pg_catalog.pg_index i ON i.indexrelid = idx.oid",
      "  JOIN pg_catalog.pg_am am ON am.oid = idx.relam",
      "  WHERE n.oid = pg_catalog.pg_my_temp_schema()",
      "    AND idx.relname = " + index,
      "    AND idx.relkind = 'i'",
      "    AND i.indrelid = " + table,
      "    AND i.indisunique",
      "    AND i.indisvalid",
      "    AND i.indisready",
      "    AND i.indislive",
      "    AND NOT i.indisprimary",
      "    AND NOT i.indisexclusion",
      "    AND i.indnkeyatts = 1",
      "    AND i.indnatts = 1",
      "    AND i.indexprs IS NULL",
      "    AND i.indpred IS NOT NULL",
      "    AND i.indkey[0] = (",
      "      SELECT a.attnum",
      "      FROM pg_catalog.pg_attribute a",
      "      WHERE a.attrelid = " + table,
      "        AND a.attname = 'evacuee_id'",
      "        AND a.attnum > 0",
      "        AND NOT a.attisdropped",
      "    )",
      "    AND am.amname = 'btree'",
      "    AND pg_catalog.regexp_replace(",
      "      pg_catalog.regexp_replace(",
      "        pg_catalog.regexp_replace(",
      "          lower(pg_catalog.pg_get_expr(i.indpred, i.indrelid, true)),",
      "          '[[:space:]]+', '', 'g'",
      "        ),",
      "        '::(text|character varying|text\\[\\]|character varying\\[\\])', '', 'g'",
      "      ),",
      "      '[()]', '', 'g'",
      "    ) = 'status=''present''andtime_outisnull'",
      "  ) AS matches",
    ]),
  );
  return result.rows[0].matches;
};

const createC4Table = async (client, tableName) => {
  await client.query(
    sql([
      "CREATE TEMP TABLE " + quoteIdentifier(tableName) + " (",
      "  household_id uuid,",
      "  id uuid,",
      "  is_family_head boolean",
      ")",
    ]),
  );
};

const createC4Index = async (
  client,
  tableName,
  indexName,
  { column = "household_id", predicate = "is_family_head IS TRUE" } = {},
) => {
  await client.query(
    "CREATE UNIQUE INDEX " +
      quoteIdentifier(indexName) +
      " ON " +
      quoteIdentifier(tableName) +
      " (" +
      quoteIdentifier(column) +
      ") WHERE " +
      predicate,
  );
};

const runC4Postcondition = async (client, tableName, indexName) => {
  const table = tempRegclass(tableName);
  const index = quoteLiteral(indexName);
  const result = await client.query(
    sql([
      "SELECT EXISTS (",
      "  SELECT 1",
      "  FROM pg_catalog.pg_class idx",
      "  JOIN pg_catalog.pg_namespace n ON n.oid = idx.relnamespace",
      "  JOIN pg_catalog.pg_index i ON i.indexrelid = idx.oid",
      "  JOIN pg_catalog.pg_am am ON am.oid = idx.relam",
      "  WHERE n.oid = pg_catalog.pg_my_temp_schema()",
      "    AND idx.relname = " + index,
      "    AND idx.relkind = 'i'",
      "    AND i.indrelid = " + table,
      "    AND i.indisunique",
      "    AND i.indisvalid",
      "    AND i.indisready",
      "    AND i.indislive",
      "    AND NOT i.indisprimary",
      "    AND NOT i.indisexclusion",
      "    AND i.indnkeyatts = 1",
      "    AND i.indnatts = 1",
      "    AND i.indexprs IS NULL",
      "    AND i.indpred IS NOT NULL",
      "    AND i.indkey[0] = (",
      "      SELECT a.attnum",
      "      FROM pg_catalog.pg_attribute a",
      "      WHERE a.attrelid = " + table,
      "        AND a.attname = 'household_id'",
      "        AND a.attnum > 0",
      "        AND NOT a.attisdropped",
      "    )",
      "    AND am.amname = 'btree'",
      "    AND pg_catalog.regexp_replace(",
      "      pg_catalog.regexp_replace(",
      "        pg_catalog.regexp_replace(",
      "          lower(pg_catalog.pg_get_expr(i.indpred, i.indrelid, true)),",
      "          '[[:space:]]+', '', 'g'",
      "        ),",
      "        '::(text|character varying|text\\[\\]|character varying\\[\\])', '', 'g'",
      "      ),",
      "      '[()]', '', 'g'",
      "    ) = 'is_family_headistrue'",
      "  ) AS matches",
    ]),
  );
  return result.rows[0].matches;
};

const createC2Table = async (client, tableName, wrong = false) => {
  const check = wrong
    ? "CHECK ((status = 'PRESENT' AND time_out IS NULL) OR (status IN ('LEFT', 'TRANSFERRED') AND time_out IS NULL))"
    : "CHECK ((status = 'PRESENT' AND time_out IS NULL) OR (status IN ('LEFT', 'TRANSFERRED') AND time_out IS NOT NULL))";
  await client.query(
    sql([
      "CREATE TEMP TABLE " + quoteIdentifier(tableName) + " (",
      "  status character varying,",
      "  time_out timestamp with time zone,",
      "  CONSTRAINT chk_evacuation_log_status_time_out " + check,
      ")",
    ]),
  );
};

const getC2CanonicalMatch = async (client, tableName) => {
  const table = tempRegclass(tableName);
  const expected =
    "check(status='present'andtime_outisnullor(status=any(array['left','transferred']))andtime_outisnotnull)";
  const result = await client.query(
    sql([
      "SELECT",
      "  pg_catalog.pg_get_constraintdef(c.oid, true) AS definition,",
      "  pg_catalog.regexp_replace(",
      "    pg_catalog.regexp_replace(",
      "      pg_catalog.regexp_replace(",
      "        pg_catalog.regexp_replace(",
      "          pg_catalog.regexp_replace(",
      "            lower(pg_catalog.pg_get_constraintdef(c.oid, true)),",
      "            '::character varying\\[\\]', '', 'g'",
      "          ),",
      "          '::character varying', '', 'g'",
      "        ),",
      "        '::text\\[\\]', '', 'g'",
      "      ),",
      "      '::text', '', 'g'",
      "    ),",
      "    '[[:space:]]+', '', 'g'",
      "  ) AS normalized,",
      "  pg_catalog.regexp_replace(",
      "    pg_catalog.regexp_replace(",
      "      pg_catalog.regexp_replace(",
      "        pg_catalog.regexp_replace(",
      "          pg_catalog.regexp_replace(",
      "            lower(pg_catalog.pg_get_constraintdef(c.oid, true)),",
      "            '::character varying\\[\\]', '', 'g'",
      "          ),",
      "          '::character varying', '', 'g'",
      "        ),",
      "        '::text\\[\\]', '', 'g'",
      "      ),",
      "      '::text', '', 'g'",
      "    ),",
      "    '[[:space:]]+', '', 'g'",
      "  ) = " + quoteLiteral(expected) + " AS matches",
      "FROM pg_catalog.pg_constraint c",
      "WHERE c.connamespace = pg_catalog.pg_my_temp_schema()",
      "  AND c.conrelid = " + table,
      "  AND c.conname = 'chk_evacuation_log_status_time_out'",
      "  AND c.contype = 'c'",
    ]),
  );
  return result.rows[0];
};

const createApprovedFixture = async (client, prefix) => {
  const households = quoteIdentifier(prefix + "_households");
  const evacuees = quoteIdentifier(prefix + "_evacuees");
  const logs = quoteIdentifier(prefix + "_evacuation_logs");
  const stubs = quoteIdentifier(prefix + "_stubs");

  await client.query(
    sql([
      "CREATE TEMP TABLE " + households + " (",
      "  id uuid NOT NULL,",
      "  disaster_event_id uuid NOT NULL,",
      "  family_head_evacuee_id uuid,",
      "  CONSTRAINT uq_households_id_event UNIQUE (id, disaster_event_id)",
      ");",
      "CREATE TEMP TABLE " + evacuees + " (",
      "  id uuid NOT NULL,",
      "  household_id uuid NOT NULL,",
      "  is_family_head boolean,",
      "  CONSTRAINT uq_evacuees_id_household UNIQUE (id, household_id)",
      ");",
      "ALTER TABLE " + households,
      "  ADD CONSTRAINT fk_households_family_head_same_household",
      "  FOREIGN KEY (family_head_evacuee_id, id)",
      "  REFERENCES " + evacuees + " (id, household_id)",
      "  MATCH SIMPLE ON UPDATE NO ACTION",
      "  ON DELETE SET NULL (family_head_evacuee_id);",
      "CREATE TEMP TABLE " + logs + " (",
      "  household_id uuid,",
      "  disaster_event_id uuid,",
      "  evacuee_id uuid,",
      "  status character varying,",
      "  time_in timestamp with time zone,",
      "  time_out timestamp with time zone,",
      "  CONSTRAINT chk_evacuation_log_time CHECK ((time_out IS NULL) OR (time_out >= time_in)),",
      "  CONSTRAINT chk_evacuation_log_status_time_out CHECK ((status = 'PRESENT' AND time_out IS NULL) OR (status IN ('LEFT', 'TRANSFERRED') AND time_out IS NOT NULL)),",
      "  CONSTRAINT fk_evacuation_logs_household_event",
      "    FOREIGN KEY (household_id, disaster_event_id)",
      "    REFERENCES " + households + " (id, disaster_event_id)",
      "    MATCH SIMPLE ON UPDATE NO ACTION ON DELETE CASCADE,",
      "  CONSTRAINT fk_evacuation_logs_evacuee_household",
      "    FOREIGN KEY (evacuee_id, household_id)",
      "    REFERENCES " + evacuees + " (id, household_id)",
      "    MATCH SIMPLE ON UPDATE NO ACTION ON DELETE CASCADE",
      ");",
      "CREATE TEMP TABLE " + stubs + " (",
      "  household_id uuid,",
      "  disaster_event_id uuid,",
      "  CONSTRAINT fk_stub_household_event",
      "    FOREIGN KEY (household_id, disaster_event_id)",
      "    REFERENCES " + households + " (id, disaster_event_id)",
      "    MATCH SIMPLE ON UPDATE NO ACTION ON DELETE CASCADE",
      ");",
      "CREATE UNIQUE INDEX uq_evacuation_logs_open_evacuee ON " +
        logs +
        " (evacuee_id) WHERE status = 'PRESENT' AND time_out IS NULL;",
      "CREATE UNIQUE INDEX uq_evacuees_household_family_head ON " +
        evacuees +
        " (household_id) WHERE is_family_head IS TRUE;",
    ]),
  );
};

const readConstraint = async (
  client,
  name,
  childTable,
  parentTable,
) => {
  const result = await client.query(
    sql([
      "SELECT",
      "  c.conkey::text AS conkey,",
      "  c.confkey::text AS confkey,",
      "  c.confmatchtype,",
      "  c.confupdtype,",
      "  c.confdeltype,",
      "  c.convalidated,",
      "  c.conrelid = " + tempRegclass(childTable) + " AS child_ok,",
      "  c.confrelid = " + tempRegclass(parentTable) + " AS parent_ok,",
      "  pg_catalog.pg_get_constraintdef(c.oid, true) AS definition",
      "FROM pg_catalog.pg_constraint c",
      "WHERE c.connamespace = pg_catalog.pg_my_temp_schema()",
      "  AND c.conname = $1",
    ]),
    [name],
  );
  assert.equal(result.rowCount, 1);
  return result.rows[0];
};

const finalS29ForTemp = (prefix) => {
  const postconditionStart = migration.indexOf("-- Postconditions keep");
  const doStart = migration.indexOf("DO $$", postconditionStart);
  const commitStart = migration.lastIndexOf("\nCOMMIT;");
  const blockEnd = migration.lastIndexOf("$$;", commitStart) + 3;
  assert.ok(postconditionStart >= 0);
  assert.ok(doStart > postconditionStart);
  assert.ok(blockEnd > doStart);

  let block = migration.slice(doStart, blockEnd);
  for (const tableName of [
    "households",
    "evacuees",
    "evacuation_logs",
    "stubs",
  ]) {
    block = block.replaceAll(
      "'public." + tableName + "'",
      quoteLiteral("pg_temp." + prefix + "_" + tableName),
    );
  }
  block = block.replaceAll(
    "c.connamespace = 'public'::pg_catalog.regnamespace",
    "c.connamespace = pg_catalog.pg_my_temp_schema()",
  );
  block = block.replaceAll(
    "n.nspname = 'public'",
    "n.oid = pg_catalog.pg_my_temp_schema()",
  );
  return block;
};

test("PC1 approved C1 TEMP index passes the complete corrected postcondition", async () => {
  await withTempClient(async (client) => {
    await createC1Table(client, "pc1_evacuation_logs");
    await createC1Index(
      client,
      "pc1_evacuation_logs",
      "uq_evacuation_logs_open_evacuee",
    );
    assert.equal(
      await runC1Postcondition(
        client,
        "pc1_evacuation_logs",
        "uq_evacuation_logs_open_evacuee",
      ),
      true,
    );
  });
});

test("PC2 accepts PostgreSQL 17.6 canonical C1 predicate deparse", async () => {
  await withTempClient(async (client) => {
    await createC1Table(client, "pc2_evacuation_logs");
    await createC1Index(
      client,
      "pc2_evacuation_logs",
      "uq_evacuation_logs_open_evacuee",
    );
    const result = await client.query(
      "SELECT pg_catalog.pg_get_expr(i.indpred, i.indrelid, true) AS predicate " +
        "FROM pg_catalog.pg_index i " +
        "WHERE i.indexrelid = " +
        quoteLiteral("pg_temp.uq_evacuation_logs_open_evacuee") +
        "::pg_catalog.regclass",
    );
    assert.match(result.rows[0].predicate, /status/i);
    assert.match(result.rows[0].predicate, /time_out/i);
    assert.equal(
      await runC1Postcondition(
        client,
        "pc2_evacuation_logs",
        "uq_evacuation_logs_open_evacuee",
      ),
      true,
    );
  });
});

test("PC3 rejects C1 wrong predicates", async () => {
  await withTempClient(async (client) => {
    await createC1Table(client, "pc3_evacuation_logs");
    await createC1Index(
      client,
      "pc3_evacuation_logs",
      "uq_evacuation_logs_open_evacuee",
      { predicate: "status = 'LEFT' AND time_out IS NULL" },
    );
    assert.equal(
      await runC1Postcondition(
        client,
        "pc3_evacuation_logs",
        "uq_evacuation_logs_open_evacuee",
      ),
      false,
    );
  });
});

test("PC4 rejects C1 with the wrong indexed column", async () => {
  await withTempClient(async (client) => {
    await createC1Table(client, "pc4_evacuation_logs");
    await createC1Index(
      client,
      "pc4_evacuation_logs",
      "uq_evacuation_logs_open_evacuee",
      { column: "household_id" },
    );
    assert.equal(
      await runC1Postcondition(
        client,
        "pc4_evacuation_logs",
        "uq_evacuation_logs_open_evacuee",
      ),
      false,
    );
  });
});

test("PC5 rejects a non-unique C1 index", async () => {
  await withTempClient(async (client) => {
    await createC1Table(client, "pc5_evacuation_logs");
    await createC1Index(
      client,
      "pc5_evacuation_logs",
      "uq_evacuation_logs_open_evacuee",
      { unique: false },
    );
    assert.equal(
      await runC1Postcondition(
        client,
        "pc5_evacuation_logs",
        "uq_evacuation_logs_open_evacuee",
      ),
      false,
    );
  });
});

test("PC6 rejects wrong C1 table/schema/object association", async () => {
  await withTempClient(async (client) => {
    await createC1Table(client, "pc6_evacuation_logs");
    await createC1Table(client, "pc6_wrong_table");
    await createC1Index(
      client,
      "pc6_wrong_table",
      "uq_evacuation_logs_open_evacuee",
    );
    assert.equal(
      await runC1Postcondition(
        client,
        "pc6_evacuation_logs",
        "uq_evacuation_logs_open_evacuee",
      ),
      false,
    );
  });
});

test("PC7 verifies C1 validity, readiness, live state, and key counts", async () => {
  await withTempClient(async (client) => {
    await createC1Table(client, "pc7_evacuation_logs");
    await createC1Index(
      client,
      "pc7_evacuation_logs",
      "uq_evacuation_logs_open_evacuee",
    );
    const result = await client.query(
      sql([
        "SELECT",
        "  i.indisvalid, i.indisready, i.indislive,",
        "  i.indnkeyatts, i.indnatts, i.indexprs IS NULL AS no_expressions",
        "FROM pg_catalog.pg_index i",
        "WHERE i.indexrelid = " +
          quoteLiteral("pg_temp.uq_evacuation_logs_open_evacuee") +
          "::pg_catalog.regclass",
      ]),
    );
    assert.deepEqual(result.rows[0], {
      indisvalid: true,
      indisready: true,
      indislive: true,
      indnkeyatts: 1,
      indnatts: 1,
      no_expressions: true,
    });
    assert.equal(
      await runC1Postcondition(
        client,
        "pc7_evacuation_logs",
        "uq_evacuation_logs_open_evacuee",
      ),
      true,
    );
  });
});

test("PC8 approved C4 TEMP partial unique index passes", async () => {
  await withTempClient(async (client) => {
    await createC4Table(client, "pc8_evacuees");
    await createC4Index(
      client,
      "pc8_evacuees",
      "uq_evacuees_household_family_head",
    );
    assert.equal(
      await runC4Postcondition(
        client,
        "pc8_evacuees",
        "uq_evacuees_household_family_head",
      ),
      true,
    );
  });
});

test("PC9 rejects C4 wrong key and wrong predicate", async () => {
  await withTempClient(async (client) => {
    await createC4Table(client, "pc9_evacuees");
    await createC4Index(
      client,
      "pc9_evacuees",
      "uq_evacuees_household_family_head",
      { column: "id" },
    );
    assert.equal(
      await runC4Postcondition(
        client,
        "pc9_evacuees",
        "uq_evacuees_household_family_head",
      ),
      false,
    );
    await client.query(
      "DROP INDEX " + quoteIdentifier("uq_evacuees_household_family_head"),
    );
    await createC4Index(
      client,
      "pc9_evacuees",
      "uq_evacuees_household_family_head",
      { predicate: "is_family_head IS FALSE" },
    );
    assert.equal(
      await runC4Postcondition(
        client,
        "pc9_evacuees",
        "uq_evacuees_household_family_head",
      ),
      false,
    );
  });
});

test("PC10 accepts the canonical C2 CHECK and rejects a materially wrong definition", async () => {
  await withTempClient(async (client) => {
    await createC2Table(client, "pc10_good_logs");
    const good = await getC2CanonicalMatch(client, "pc10_good_logs");
    assert.match(good.definition, /PRESENT/);
    assert.equal(good.matches, true, JSON.stringify(good));

    await createC2Table(client, "pc10_bad_logs", true);
    const bad = await getC2CanonicalMatch(client, "pc10_bad_logs");
    assert.equal(bad.matches, false);
  });
});

test("PC11 verifies supporting UNIQUE table and ordered conkey structure", async () => {
  await withTempClient(async (client) => {
    await createApprovedFixture(client, "pc11");
    const evacueeKey = await readConstraint(
      client,
      "uq_evacuees_id_household",
      "pc11_evacuees",
      "pc11_evacuees",
    );
    const householdKey = await readConstraint(
      client,
      "uq_households_id_event",
      "pc11_households",
      "pc11_households",
    );
    for (const row of [evacueeKey, householdKey]) {
      assert.equal(row.child_ok, true);
      assert.equal(row.parent_ok, false);
      assert.equal(row.confkey == null ? "" : row.confkey.trim(), "");
      assert.equal(
        row.confmatchtype == null ? "" : row.confmatchtype.trim(),
        "",
      );
      assert.equal(row.convalidated, true);
    }
    assert.equal(evacueeKey.conkey, "{1,2}");
    assert.equal(householdKey.conkey, "{1,2}");
  });
});

test("PC12 verifies C5/C7/C8/C9 columns, targets, actions, and validation", async () => {
  await withTempClient(async (client) => {
    await createApprovedFixture(client, "pc12");
    const cases = [
      {
        name: "fk_households_family_head_same_household",
        child: "pc12_households",
        parent: "pc12_evacuees",
        conkey: "{3,1}",
        confkey: "{1,2}",
        deleteAction: "n",
        columnAction: /ON DELETE SET NULL \(family_head_evacuee_id\)/i,
      },
      {
        name: "fk_evacuation_logs_household_event",
        child: "pc12_evacuation_logs",
        parent: "pc12_households",
        conkey: "{1,2}",
        confkey: "{1,2}",
        deleteAction: "c",
      },
      {
        name: "fk_evacuation_logs_evacuee_household",
        child: "pc12_evacuation_logs",
        parent: "pc12_evacuees",
        conkey: "{3,1}",
        confkey: "{1,2}",
        deleteAction: "c",
      },
      {
        name: "fk_stub_household_event",
        child: "pc12_stubs",
        parent: "pc12_households",
        conkey: "{1,2}",
        confkey: "{1,2}",
        deleteAction: "c",
      },
    ];
    for (const item of cases) {
      const row = await readConstraint(
        client,
        item.name,
        item.child,
        item.parent,
      );
      assert.equal(row.child_ok, true, item.name);
      assert.equal(row.parent_ok, true, item.name);
      assert.equal(row.conkey, item.conkey, item.name);
      assert.equal(row.confkey, item.confkey, item.name);
      assert.equal(row.confmatchtype, "s", item.name);
      assert.equal(row.confupdtype, "a", item.name);
      assert.equal(row.confdeltype, item.deleteAction, item.name);
      assert.equal(row.convalidated, true, item.name);
      if (item.columnAction) {
        assert.match(row.definition, item.columnAction);
      }
    }
  });
});

test("PC13 complete corrected S29 accepts the approved TEMP set and rejects a wrong object", async () => {
  await withTempClient(async (client) => {
    await createApprovedFixture(client, "pc13");
    const postconditions = finalS29ForTemp("pc13");
    await client.query(postconditions);

    await client.query(
      "DROP INDEX " + quoteIdentifier("uq_evacuation_logs_open_evacuee"),
    );
    await client.query(
      "CREATE UNIQUE INDEX uq_evacuation_logs_open_evacuee ON " +
        quoteIdentifier("pc13_evacuation_logs") +
        " (household_id) WHERE status = 'PRESENT' AND time_out IS NULL",
    );
    await assert.rejects(
      () => client.query(postconditions),
      /C1 postcondition mismatch/i,
    );
  });
});
