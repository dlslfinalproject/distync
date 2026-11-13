const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationPath = path.resolve(
  __dirname,
  "../../database/migrations/2026-09-14_add_household_attendance_backstops.sql",
);
const schemaPath = path.resolve(
  __dirname,
  "../../database/schema/distync_schema.sql",
);

const migration = fs.readFileSync(migrationPath, "utf8");
const schema = fs.readFileSync(schemaPath, "utf8");

const stripSqlComments = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*--.*$/gm, "");

const ddl = stripSqlComments(migration);

const approvedStage3Objects = [
  "uq_evacuation_logs_open_evacuee",
  "chk_evacuation_log_status_time_out",
  "uq_evacuees_household_family_head",
  "uq_evacuees_id_household",
  "fk_households_family_head_same_household",
  "uq_households_id_event",
  "fk_evacuation_logs_household_event",
  "fk_evacuation_logs_evacuee_household",
  "fk_stub_household_event",
];

const dynamicUniqueIndexStatements = [...ddl.matchAll(
  /EXECUTE\s+\$migration\$(CREATE\s+UNIQUE\s+INDEX[\s\S]*?)\$migration\$/gi,
)].map((match) => match[1].replace(/\s+/g, " ").trim());

test("D1 migration is one explicit transaction with catalog guards and a lifecycle lock", () => {
  assert.match(ddl.trim(), /^BEGIN;[\s\S]*COMMIT;\s*$/);
  assert.match(ddl, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(ddl, /LOCK TABLE[\s\S]*public\.households[\s\S]*public\.evacuees[\s\S]*public\.evacuation_logs[\s\S]*public\.stubs[\s\S]*SHARE ROW EXCLUSIVE MODE/i);
  assert.match(ddl, /pg_catalog\.pg_class/);
  assert.match(ddl, /pg_catalog\.pg_namespace/);
  assert.match(ddl, /pg_catalog\.pg_attribute/);
  assert.match(ddl, /pg_catalog\.pg_constraint/);
  assert.match(ddl, /pg_catalog\.pg_index/);
  assert.match(ddl, /pg_catalog\.pg_get_constraintdef/);
  assert.match(ddl, /pg_catalog\.pg_get_expr/);
});

test("D2 migration contains no business DML or unapproved database security/object changes", () => {
  assert.doesNotMatch(ddl, /\bINSERT\s+INTO\s+public\./i);
  assert.doesNotMatch(ddl, /\bUPDATE\s+public\.[a-z_]+\s+SET\b/i);
  assert.doesNotMatch(ddl, /\bDELETE\s+FROM\s+public\./i);
  assert.doesNotMatch(ddl, /\bMERGE\s+INTO\s+public\./i);
  assert.doesNotMatch(ddl, /\bTRUNCATE\s+public\./i);
  assert.doesNotMatch(ddl, /\bCREATE\s+TRIGGER\b/i);
  assert.doesNotMatch(ddl, /\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i);
  assert.doesNotMatch(ddl, /\b(?:GRANT|REVOKE|ALTER\s+ROLE|OWNER\s+TO)\b/i);
  assert.doesNotMatch(ddl, /\bDROP\s+(?:TABLE|INDEX|CONSTRAINT|TRIGGER)\b/i);
  assert.doesNotMatch(ddl, /CREATE\s+INDEX\s+CONCURRENTLY/i);
  assert.doesNotMatch(ddl, /\bSTAGE-[456]\b/i);
});

test("SY1-SY9 migration syntax and scope regression coverage", () => {
  assert.doesNotMatch(
    ddl,
    /CREATE\s+UNIQUE\s+INDEX\s+public\.(?:uq_evacuation_logs_open_evacuee|uq_evacuees_household_family_head)\b/i,
  );
  assert.match(
    ddl,
    /CREATE\s+UNIQUE\s+INDEX\s+uq_evacuation_logs_open_evacuee\s+ON\s+public\.evacuation_logs\b/i,
  );
  assert.match(
    ddl,
    /CREATE\s+UNIQUE\s+INDEX\s+uq_evacuees_household_family_head\s+ON\s+public\.evacuees\b/i,
  );

  assert.equal(dynamicUniqueIndexStatements.length, 4);
  assert.deepEqual(
    dynamicUniqueIndexStatements.map((statement) =>
      statement.match(/CREATE\s+UNIQUE\s+INDEX\s+(\S+)/i)[1],
    ),
    [
      "uq_evacuation_logs_open_evacuee",
      "uq_evacuees_household_family_head",
      "uq_evacuation_logs_open_evacuee",
      "uq_evacuees_household_family_head",
    ],
  );
  for (const statement of dynamicUniqueIndexStatements) {
    assert.match(
      statement,
      /^CREATE\s+UNIQUE\s+INDEX\s+(?!public\.)[a-z_]+\s+ON\s+public\./i,
    );
  }

  const declaredStage3Objects = [
    ...dynamicUniqueIndexStatements.map(
      (statement) => statement.match(/CREATE\s+UNIQUE\s+INDEX\s+(\S+)/i)[1],
    ),
    ...[...ddl.matchAll(/ADD\s+CONSTRAINT\s+([a-z_]+)/gi)].map(
      (match) => match[1],
    ),
  ];
  assert.deepEqual(
    [...new Set(declaredStage3Objects)].sort(),
    [...approvedStage3Objects].sort(),
  );

  assert.doesNotMatch(ddl, /\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM\s+public\.)/i);
  assert.doesNotMatch(ddl, /\bCREATE\s+TRIGGER\b/i);

  assert.match(
    ddl,
    /c\.conrelid\s*=\s*'public\.evacuation_logs'::pg_catalog\.regclass[\s\S]*c\.conname\s*=\s*'chk_evacuation_log_time'[\s\S]*c\.contype\s*=\s*'c'/i,
  );
  assert.match(
    ddl,
    /'check\(\(time_outisnull\)or\(time_out>=time_in\)\)'/i,
  );
  assert.match(
    ddl,
    /c\.convalidated[\s\S]*NOT c\.condeferrable[\s\S]*NOT c\.condeferred/i,
  );
});

test("D3 migration defines the exact C1 open-attendance partial unique index", () => {
  assert.match(
    ddl,
    /CREATE\s+UNIQUE\s+INDEX\s+uq_evacuation_logs_open_evacuee\s+ON\s+public\.evacuation_logs\s*\(evacuee_id\)\s+WHERE\s+status\s*=\s*'PRESENT'\s+AND\s+time_out\s+IS\s+NULL/i,
  );
  assert.match(ddl, /uq_evacuation_logs_open_evacuee[\s\S]*indisunique/i);
  assert.match(ddl, /uq_evacuation_logs_open_evacuee[\s\S]*indpred/i);
});

test("D4 migration adds C2 as NOT VALID, validates it, and does not recreate time-order", () => {
  assert.match(
    ddl,
    /ADD\s+CONSTRAINT\s+chk_evacuation_log_status_time_out\s+CHECK\s*\(\(status\s*=\s*'PRESENT'[\s\S]*status\s+IN\s*\('LEFT',\s*'TRANSFERRED'\)[\s\S]*\)\s+NOT\s+VALID/i,
  );
  assert.match(
    ddl,
    /VALIDATE\s+CONSTRAINT\s+chk_evacuation_log_status_time_out/i,
  );
  assert.doesNotMatch(
    ddl,
    /ADD\s+CONSTRAINT\s+chk_evacuation_log_time\b/i,
  );
  assert.doesNotMatch(
    ddl,
    /(?:DROP|RENAME|ALTER)\s+CONSTRAINT\s+chk_evacuation_log_time\b/i,
  );
});

test("G1-G7 existing time-order guard accepts audited deparses and rejects drift", () => {
  const acceptedDeparses = [
    "check((time_outisnull)or(time_out>=time_in))",
    "check(time_outisnullortime_out>=time_in)",
  ];

  for (const deparse of acceptedDeparses) {
    assert.match(ddl, new RegExp(`'${deparse.replace(/[()]/g, "\\$&")}'`));
  }
  assert.doesNotMatch(ddl, /time_outisnullortime_out<=time_in/i);
  assert.doesNotMatch(ddl, /time_inisnullortime_out>=time_in/i);
  assert.match(
    ddl,
    /c\.conrelid\s*=\s*'public\.evacuation_logs'::pg_catalog\.regclass[\s\S]*c\.conname\s*=\s*'chk_evacuation_log_time'[\s\S]*c\.contype\s*=\s*'c'/i,
  );
  assert.match(ddl, /c\.convalidated[\s\S]*NOT c\.condeferrable[\s\S]*NOT c\.condeferred/i);
  assert.match(ddl, /already exists with a different definition/);
});

test("D5 migration defines the exact C4 one-flagged-family-head partial unique index", () => {
  assert.match(
    ddl,
    /CREATE\s+UNIQUE\s+INDEX\s+uq_evacuees_household_family_head\s+ON\s+public\.evacuees\s*\(household_id\)\s+WHERE\s+is_family_head\s+IS\s+TRUE/i,
  );
  assert.match(ddl, /uq_evacuees_household_family_head[\s\S]*indisunique/i);
  assert.match(ddl, /uq_evacuees_household_family_head[\s\S]*indpred/i);
});

test("D6 migration adds both approved supporting unique keys", () => {
  assert.match(
    ddl,
    /ADD\s+CONSTRAINT\s+uq_evacuees_id_household\s+UNIQUE\s*\(id,\s*household_id\)/i,
  );
  assert.match(
    ddl,
    /ADD\s+CONSTRAINT\s+uq_households_id_event\s+UNIQUE\s*\(id,\s*disaster_event_id\)/i,
  );
});

test("D7 migration adds the family-head same-household FK with audited SET NULL column action", () => {
  assert.match(
    ddl,
    /ADD\s+CONSTRAINT\s+fk_households_family_head_same_household\s+FOREIGN\s+KEY\s*\(family_head_evacuee_id,\s*id\)\s+REFERENCES\s+public\.evacuees\s*\(id,\s*household_id\)\s+MATCH\s+SIMPLE\s+ON\s+UPDATE\s+NO\s+ACTION\s+ON\s+DELETE\s+SET\s+NULL\s*\(family_head_evacuee_id\)\s+NOT\s+VALID/i,
  );
  assert.match(
    ddl,
    /VALIDATE\s+CONSTRAINT\s+fk_households_family_head_same_household/i,
  );
});

test("D8 migration adds the attendance-to-household event FK with CASCADE", () => {
  assert.match(
    ddl,
    /ADD\s+CONSTRAINT\s+fk_evacuation_logs_household_event\s+FOREIGN\s+KEY\s*\(household_id,\s*disaster_event_id\)\s+REFERENCES\s+public\.households\s*\(id,\s*disaster_event_id\)\s+MATCH\s+SIMPLE\s+ON\s+UPDATE\s+NO\s+ACTION\s+ON\s+DELETE\s+CASCADE\s+NOT\s+VALID/i,
  );
  assert.match(ddl, /VALIDATE\s+CONSTRAINT\s+fk_evacuation_logs_household_event/i);
});

test("D9 migration adds the attendance-to-evacuee household FK with CASCADE", () => {
  assert.match(
    ddl,
    /ADD\s+CONSTRAINT\s+fk_evacuation_logs_evacuee_household\s+FOREIGN\s+KEY\s*\(evacuee_id,\s*household_id\)\s+REFERENCES\s+public\.evacuees\s*\(id,\s*household_id\)\s+MATCH\s+SIMPLE\s+ON\s+UPDATE\s+NO\s+ACTION\s+ON\s+DELETE\s+CASCADE\s+NOT\s+VALID/i,
  );
  assert.match(ddl, /VALIDATE\s+CONSTRAINT\s+fk_evacuation_logs_evacuee_household/i);
});

test("D10 migration adds the stub-to-household event FK with CASCADE", () => {
  assert.match(
    ddl,
    /ADD\s+CONSTRAINT\s+fk_stub_household_event\s+FOREIGN\s+KEY\s*\(household_id,\s*disaster_event_id\)\s+REFERENCES\s+public\.households\s*\(id,\s*disaster_event_id\)\s+MATCH\s+SIMPLE\s+ON\s+UPDATE\s+NO\s+ACTION\s+ON\s+DELETE\s+CASCADE\s+NOT\s+VALID/i,
  );
  assert.match(ddl, /VALIDATE\s+CONSTRAINT\s+fk_stub_household_event/i);
});

test("D11 migration fails closed on data/definition collisions and validates all new constraints", () => {
  assert.match(ddl, /STAGE-3 MIGRATION BLOCKED — LIVE DATA REPAIR REVIEW REQUIRED/);
  assert.match(ddl, /already exists with a different definition/);
  assert.match(ddl, /exists under another name/);
  for (const name of [
    "chk_evacuation_log_status_time_out",
    "fk_households_family_head_same_household",
    "fk_evacuation_logs_household_event",
    "fk_evacuation_logs_evacuee_household",
    "fk_stub_household_event",
  ]) {
    assert.match(
      ddl,
      new RegExp(`VALIDATE\\s+CONSTRAINT\\s+${name}`, "i"),
    );
  }
  assert.match(ddl, /convalidated/);
  assert.match(ddl, /condeferrable/);
  assert.match(ddl, /condeferred/);
});

test("D12 canonical schema contains only the targeted lifecycle alignment", () => {
  for (const name of [
    "chk_evacuation_log_time",
    "uq_evacuation_logs_open_evacuee",
    "chk_evacuation_log_status_time_out",
    "uq_evacuees_household_family_head",
    "uq_evacuees_id_household",
    "fk_households_family_head_same_household",
    "uq_households_id_event",
    "fk_evacuation_logs_household_event",
    "fk_evacuation_logs_evacuee_household",
    "fk_stub_household_event",
  ]) {
    assert.match(schema, new RegExp(name));
  }
});

test("D13 C1 and C4 use bounds-safe pg_index key-slot verification", () => {
  assert.doesNotMatch(ddl, /i\.indkey::smallint\[\]\s*=\s*ARRAY/i);
  assert.equal((ddl.match(/i\.indkey\[0\]\s*=/gi) || []).length, 8);
  assert.match(
    ddl,
    /i\.indkey\[0\]\s*=\s*\([\s\S]*?a\.attrelid\s*=\s*'public\.evacuation_logs'::pg_catalog\.regclass[\s\S]*?a\.attname\s*=\s*'evacuee_id'/i,
  );
  assert.match(
    ddl,
    /i\.indkey\[0\]\s*=\s*\([\s\S]*?a\.attrelid\s*=\s*'public\.evacuees'::pg_catalog\.regclass[\s\S]*?a\.attname\s*=\s*'household_id'/i,
  );
  for (const indexName of [
    "uq_evacuation_logs_open_evacuee",
    "uq_evacuees_household_family_head",
  ]) {
    const indexSection = ddl.slice(ddl.indexOf(indexName));
    assert.match(indexSection, /indnkeyatts\s*=\s*1/i);
    assert.match(indexSection, /indnatts\s*=\s*1/i);
    assert.match(indexSection, /indexprs\s+IS\s+NULL/i);
    assert.match(indexSection, /indpred\s+IS\s+NOT\s+NULL/i);
    assert.match(indexSection, /indisunique/i);
    assert.match(indexSection, /indisvalid/i);
    assert.match(indexSection, /indisready/i);
    assert.match(indexSection, /indislive/i);
  }
});

test("D14 C2 uses audited cast-first canonicalization and preserves grouping", () => {
  const canonical =
    "check(status=''present''andtime_outisnullor(status=any(array[''left'',''transferred'']))andtime_outisnotnull)";
  assert.equal(
    (ddl.match(new RegExp(canonical.replace(/[()[\]]/g, "\\$&"), "g")) || []).length,
    3,
  );
  assert.match(
    ddl,
    /lower\(pg_catalog\.pg_get_constraintdef\(c\.oid,\s*true\)\),[\s\S]*'::character varying\\\[\\\]'[\s\S]*'::character varying'[\s\S]*'::text\\\[\\\]'[\s\S]*'::text'[\s\S]*'\[\[:space:\]\]\+'/i,
  );
  assert.doesNotMatch(
    ddl,
    /chk_evacuation_log_status_time_out[\s\S]{0,1600}'\[\\(\\)\]',\s*'',\s*'g'/i,
  );
  assert.match(ddl, /c\.convalidated/);
});

test("D15 S29 independently verifies every final constraint object", () => {
  const s29 = ddl.slice(ddl.lastIndexOf("DO $$"));
  assert.doesNotMatch(
    s29,
    /SELECT\s+COUNT\(\*\)[\s\S]*approved constraint postcondition count/i,
  );
  for (const name of [
    "chk_evacuation_log_status_time_out",
    "uq_evacuees_id_household",
    "uq_households_id_event",
    "fk_households_family_head_same_household",
    "fk_evacuation_logs_household_event",
    "fk_evacuation_logs_evacuee_household",
    "fk_stub_household_event",
  ]) {
    assert.match(
      s29,
      new RegExp("c\\.conname\\s*=\\s*'" + name + "'"),
    );
  }
  assert.match(s29, /c\.conkey\s*=\s*ARRAY\[/i);
  assert.match(s29, /c\.confkey\s*=\s*ARRAY\[/i);
  assert.match(s29, /c\.confmatchtype\s*=\s*'s'/i);
  assert.match(s29, /c\.confupdtype\s*=\s*'a'/i);
  assert.match(s29, /c\.confdeltype\s*=\s*'n'/i);
  assert.match(s29, /c\.confdeltype\s*=\s*'c'/i);
  assert.match(s29, /c\.convalidated/i);
});
