const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const pool = require("../src/config/db");
const stubService = require("../src/services/stub.service");
const syncService = require("../src/services/sync.service");

const TEST_PROJECT_REF = "cldfgbqjvnianmpecybu";
const PRODUCTION_PROJECT_REF = "deufjjzwvagrljixxskn";
const FIXTURE_BATCH_QUANTITY = 100000;
const FIXTURE_DISASTER_TYPE = "Typhoon";
const FIXTURE_STUB_LABELS = [
  "concurrent",
  "same_household_a",
  "same_household_b",
  "sync_replay",
  "cross_device",
  "online_vs_offline",
  "canonical_violation",
  "status_reuse",
];

const assertVerifiedTestDatabase = async () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Distribution stub integration tests require NODE_ENV=test.",
    );
  }

  if (process.env.ALLOW_TEST_DB_MUTATIONS !== "true") {
    throw new Error(
      "Distribution stub integration tests require ALLOW_TEST_DB_MUTATIONS=true.",
    );
  }

  const rawConnectionString = process.env.TEST_DATABASE_URL;
  if (!rawConnectionString) {
    throw new Error(
      "Distribution stub integration tests require TEST_DATABASE_URL.",
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
      "Distribution stub integration tests require the verified TEST Supabase project.",
    );
  }

  if (
    connectionIdentity.includes(PRODUCTION_PROJECT_REF) ||
    rawConnectionString.includes(PRODUCTION_PROJECT_REF)
  ) {
    throw new Error(
      "Distribution stub integration tests refuse the production Supabase project.",
    );
  }

  const isSupabaseHost =
    connectionUrl.hostname.endsWith(".supabase.co") ||
    connectionUrl.hostname.endsWith(".supabase.com");

  if (!isSupabaseHost) {
    throw new Error(
      "Distribution stub integration tests require a Supabase PostgreSQL host.",
    );
  }

  const sessionResult = await pool.query(`
    SELECT
      current_database() AS database_name,
      current_user,
      session_user,
      current_setting('server_version') AS server_version
  `);
  const session = sessionResult.rows[0];
  assert.equal(session.database_name, "postgres");
  assert.equal(session.current_user, "postgres");
  assert.equal(session.session_user, "postgres");
  assert.match(session.server_version, /^17\./);
};

const assertCanonicalState = async () => {
  const canonicalResult = await pool.query(`
    SELECT
      c.conname,
      c.convalidated,
      c.condeferrable,
      c.condeferred,
      c.conindid::regclass::text AS backing_index,
      i.relname AS backing_index_name,
      n.nspname AS backing_index_schema,
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
    INNER JOIN pg_namespace n ON n.oid = i.relnamespace
    INNER JOIN pg_index ix ON ix.indexrelid = i.oid
    INNER JOIN pg_am am ON am.oid = i.relam
    WHERE c.connamespace = 'public'::regnamespace
      AND c.conrelid = 'public.distribution_transactions'::regclass
      AND c.conname = 'uq_distribution_stub'
      AND c.contype = 'u'
  `);

  assert.deepEqual(canonicalResult.rows, [
    {
      conname: "uq_distribution_stub",
      convalidated: true,
      condeferrable: false,
      condeferred: false,
      backing_index: "uq_distribution_stub",
      backing_index_name: "uq_distribution_stub",
      backing_index_schema: "public",
      access_method: "btree",
      indisunique: true,
      indisprimary: false,
      indisexclusion: false,
      indisvalid: true,
      indisready: true,
      indislive: true,
      indnkeyatts: 1,
      indnatts: 1,
      indkey: "4",
      indoption: "0",
      indcollation: "0",
      indclass: "10065",
      no_predicate: true,
      no_expression: true,
      definition: "UNIQUE (stub_id)",
      internally_owned: true,
    },
  ]);

  const redundantResult = await pool.query(`
    SELECT COUNT(*)::integer AS row_count
    FROM pg_class
    WHERE relnamespace = 'public'::regnamespace
      AND relname = 'idx_distribution_transactions_stub_id'
  `);
  assert.equal(redundantResult.rows[0].row_count, 0);

  const rawUniqueResult = await pool.query(`
    SELECT COUNT(*)::integer AS row_count
    FROM pg_index ix
    WHERE ix.indrelid = 'public.distribution_transactions'::regclass
      AND ix.indisunique
      AND NOT ix.indisprimary
      AND NOT ix.indisexclusion
      AND ix.indnkeyatts = 1
      AND ix.indnatts = 1
      AND ix.indkey::text = '4'
      AND ix.indpred IS NULL
      AND ix.indexprs IS NULL
  `);
  assert.equal(rawUniqueResult.rows[0].row_count, 1);

  const explainClient = await pool.connect();
  try {
    await explainClient.query("BEGIN");
    await explainClient.query("SET LOCAL enable_seqscan = off");
    const planResult = await explainClient.query(`
      EXPLAIN (COSTS OFF)
      SELECT id
      FROM public.distribution_transactions
      WHERE stub_id = '00000000-0000-4000-8000-000000000001'
    `);
    await explainClient.query("ROLLBACK");
    const plan = planResult.rows.map((row) => row["QUERY PLAN"]);
    assert.ok(plan.some((line) => line.includes("uq_distribution_stub")));
    assert.ok(
      plan.every((line) => !line.includes("idx_distribution_transactions_stub_id")),
    );
  } catch (error) {
    await explainClient.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    explainClient.release();
  }
};

const createFixture = async () => {
  const client = await pool.connect();
  const suffix = crypto.randomUUID();
  const tag = `TEST_DSI_${suffix.slice(0, 12)}`;
  const fixture = {
    tag,
    userId: crypto.randomUUID(),
    roleId: null,
    barangayId: crypto.randomUUID(),
    eventId: crypto.randomUUID(),
    eventBarangayId: crypto.randomUUID(),
    secondEventId: crypto.randomUUID(),
    secondEventBarangayId: crypto.randomUUID(),
    householdId: crypto.randomUUID(),
    evacueeId: crypto.randomUUID(),
    evacuationLogId: crypto.randomUUID(),
    secondEvacuationLogId: crypto.randomUUID(),
    extraCycles: [],
    inventoryItemIds: [],
    inventoryItemSnapshots: [],
    batchIds: [],
    stubIds: {},
    stubEventIds: {},
    stubEventIdsById: {},
    deviceUuids: [],
    referenceYear: null,
    referenceCounterSnapshot: null,
    syncClientIds: [],
  };

  try {
    await client.query("BEGIN");

    const roleResult = await client.query(
      "SELECT id FROM public.roles WHERE code = 'BARANGAY' LIMIT 1",
    );
    assert.equal(roleResult.rowCount, 1, "TEST must contain the BARANGAY role");
    fixture.roleId = roleResult.rows[0].id;

    const templateItemsResult = await client.query(
      `
        SELECT DISTINCT
          rpt.id AS template_id,
          rpti.inventory_item_id
        FROM public.relief_pack_templates rpt
        INNER JOIN public.relief_pack_template_items rpti
          ON rpti.template_id = rpt.id
        WHERE rpt.is_active = TRUE
          AND rpt.is_additional_pack = FALSE
          AND (
            rpt.applies_to_all_disasters = TRUE
            OR EXISTS (
              SELECT 1
              FROM public.relief_pack_template_disaster_types rptdt
              WHERE rptdt.template_id = rpt.id
                AND rptdt.disaster_type = $1
            )
          )
      `,
      [FIXTURE_DISASTER_TYPE],
    );
    assert.ok(
      templateItemsResult.rowCount > 0,
      "TEST must contain at least one active standard relief-pack item",
    );
    fixture.inventoryItemIds = [
      ...new Set(templateItemsResult.rows.map((row) => row.inventory_item_id)),
    ];

    const itemSnapshotResult = await client.query(
      `
        SELECT id, quantity, packaging_count, updated_at
        FROM public.inventory_items
        WHERE id = ANY($1::uuid[])
      `,
      [fixture.inventoryItemIds],
    );
    assert.equal(
      itemSnapshotResult.rowCount,
      fixture.inventoryItemIds.length,
      "all standard relief-pack items must exist",
    );
    fixture.inventoryItemSnapshots = itemSnapshotResult.rows;

    const yearResult = await client.query(
      "SELECT EXTRACT(YEAR FROM NOW())::integer AS reference_year",
    );
    fixture.referenceYear = yearResult.rows[0].reference_year;
    const counterResult = await client.query(
      `
        SELECT reference_year, last_sequence
        FROM public.inventory_transaction_reference_counters
        WHERE reference_year = $1
      `,
      [fixture.referenceYear],
    );
    fixture.referenceCounterSnapshot = counterResult.rows[0] || null;

    await client.query(
      `
        INSERT INTO public.barangays (
          id, code, name, municipality_name, province_name, is_active
        )
        VALUES ($1, $2, $3, 'Malvar', 'Batangas', TRUE)
      `,
      [
        fixture.barangayId,
        `${tag}_BRGY_CODE`,
        `${tag} Barangay`,
      ],
    );

    await client.query(
      `
        INSERT INTO public.users (
          id, email, first_name, last_name, default_barangay_id,
          is_active, auth_provider
        )
        VALUES ($1, $2, 'Distribution', 'Stub Test', $3, TRUE, 'GOOGLE')
      `,
      [
        fixture.userId,
        `${tag.toLowerCase()}@distync.local`,
        fixture.barangayId,
      ],
    );

    await client.query(
      `
        INSERT INTO public.user_roles (id, user_id, role_id, assigned_by)
        VALUES ($1, $2, $3, NULL)
      `,
      [crypto.randomUUID(), fixture.userId, fixture.roleId],
    );

    await client.query(
      `
        INSERT INTO public.disaster_events (
          id, event_code, title, disaster_type, start_date, status, created_by
        )
        VALUES ($1, $2, $3, $4, CURRENT_DATE, 'ACTIVE', $5)
      `,
      [
        fixture.eventId,
        `${tag}_EVENT`,
        `${tag} disaster event`,
        FIXTURE_DISASTER_TYPE,
        fixture.userId,
      ],
    );

    await client.query(
      `
        INSERT INTO public.disaster_event_barangays (id, disaster_event_id, barangay_id)
        VALUES ($1, $2, $3)
      `,
      [fixture.eventBarangayId, fixture.eventId, fixture.barangayId],
    );

    await client.query(
      `
        INSERT INTO public.disaster_events (
          id, event_code, title, disaster_type, start_date, status, created_by
        )
        VALUES ($1, $2, $3, $4, CURRENT_DATE, 'ACTIVE', $5)
      `,
      [
        fixture.secondEventId,
        `${tag}_EVENT_2`,
        `${tag} second disaster cycle`,
        FIXTURE_DISASTER_TYPE,
        fixture.userId,
      ],
    );

    for (const label of FIXTURE_STUB_LABELS) {
      if (label === "concurrent" || label === "same_household_b") {
        continue;
      }

      const cycle = {
        label,
        eventId: crypto.randomUUID(),
        eventBarangayId: crypto.randomUUID(),
        evacuationLogId: crypto.randomUUID(),
      };
      fixture.extraCycles.push(cycle);

      await client.query(
        `
          INSERT INTO public.disaster_events (
            id, event_code, title, disaster_type, start_date, status, created_by
          )
          VALUES ($1, $2, $3, $4, CURRENT_DATE, 'ACTIVE', $5)
        `,
        [
          cycle.eventId,
          `${tag}_EVENT_${label}`,
          `${tag} ${label} cycle`,
          FIXTURE_DISASTER_TYPE,
          fixture.userId,
        ],
      );

      await client.query(
        `
          INSERT INTO public.disaster_event_barangays (id, disaster_event_id, barangay_id)
          VALUES ($1, $2, $3)
        `,
        [cycle.eventBarangayId, cycle.eventId, fixture.barangayId],
      );
    }

    await client.query(
      `
        INSERT INTO public.disaster_event_barangays (id, disaster_event_id, barangay_id)
        VALUES ($1, $2, $3)
      `,
      [
        fixture.secondEventBarangayId,
        fixture.secondEventId,
        fixture.barangayId,
      ],
    );

    await client.query(
      `
        INSERT INTO public.households (
          id, disaster_event_id, barangay_id, family_head_first_name,
          family_head_last_name, sex, current_stay_type, household_size,
          is_active, registered_by, residency_status
        )
        VALUES ($1, $2, $3, 'Distribution', 'Stub Household', 'FEMALE',
                'EVAC_CENTER', 1, TRUE, $4, 'RESIDENT')
      `,
      [
        fixture.householdId,
        fixture.eventId,
        fixture.barangayId,
        fixture.userId,
      ],
    );

    await client.query(
      `
        INSERT INTO public.evacuees (
          id, household_id, first_name, last_name, sex,
          relationship_to_head, is_family_head, is_active
        )
        VALUES ($1, $2, 'Distribution', 'Stub Household', 'FEMALE',
                'SELF', TRUE, TRUE)
      `,
      [fixture.evacueeId, fixture.householdId],
    );

    await client.query(
      `
        UPDATE public.households
        SET family_head_evacuee_id = $2
        WHERE id = $1
      `,
      [fixture.householdId, fixture.evacueeId],
    );

    await client.query(
      `
        INSERT INTO public.evacuation_logs (
          id, disaster_event_id, household_id, evacuee_id,
          time_in, status, recorded_by
        )
        VALUES ($1, $2, $3, $4, NOW(), 'PRESENT', $5)
      `,
      [
        fixture.evacuationLogId,
        fixture.eventId,
        fixture.householdId,
        fixture.evacueeId,
        fixture.userId,
      ],
    );

    await client.query(
      `
        INSERT INTO public.evacuation_logs (
          id, disaster_event_id, household_id, evacuee_id,
          time_in, status, recorded_by
        )
        VALUES ($1, $2, $3, $4, NOW(), 'PRESENT', $5)
      `,
      [
        fixture.secondEvacuationLogId,
        fixture.secondEventId,
        fixture.householdId,
        fixture.evacueeId,
        fixture.userId,
      ],
    );

    for (const cycle of fixture.extraCycles) {
      await client.query(
        `
          INSERT INTO public.evacuation_logs (
            id, disaster_event_id, household_id, evacuee_id,
            time_in, status, recorded_by
          )
          VALUES ($1, $2, $3, $4, NOW(), 'PRESENT', $5)
        `,
        [
          cycle.evacuationLogId,
          cycle.eventId,
          fixture.householdId,
          fixture.evacueeId,
          fixture.userId,
        ],
      );
    }

    for (const [index, inventoryItemId] of fixture.inventoryItemIds.entries()) {
      const batchId = crypto.randomUUID();
      fixture.batchIds.push(batchId);
      await client.query(
        `
          INSERT INTO public.inventory_batches (
            id, inventory_item_id, batch_no, source_type,
            quantity_received, quantity_available, status, created_by,
            received_at, created_at, updated_at
          )
          VALUES ($1, $2, $3, 'LGU', $4, $4, 'AVAILABLE', $5,
                  TIMESTAMPTZ '1900-01-01 00:00:00+00',
                  TIMESTAMPTZ '1900-01-01 00:00:00+00', NOW())
        `,
        [
          batchId,
          inventoryItemId,
          `${tag}_BATCH_${index}`,
          FIXTURE_BATCH_QUANTITY,
          fixture.userId,
        ],
      );
    }

    for (const label of FIXTURE_STUB_LABELS) {
      const stubId = crypto.randomUUID();
      fixture.stubIds[label] = stubId;
      const stubEventId =
        label === "concurrent"
          ? fixture.eventId
          : label === "same_household_b"
            ? fixture.secondEventId
            : fixture.extraCycles.find((cycle) => cycle.label === label).eventId;
      fixture.stubEventIds[label] = stubEventId;
      fixture.stubEventIdsById[stubId] = stubEventId;
      await client.query(
        `
          INSERT INTO public.stubs (
            id, disaster_event_id, household_id, stub_no, serial_no,
            status, issued_by, qr_status, qr_code_value
          )
          VALUES ($1, $2, $3, $4, $5, 'ISSUED', $6, 'ACTIVE', $7)
        `,
        [
          stubId,
          stubEventId,
          fixture.householdId,
          `${tag}_STUB_${label}`,
          `${tag}_SERIAL_${label}`,
          fixture.userId,
          `DISTYNC-STUB|${stubEventId}|${fixture.householdId}|${stubId}`,
        ],
      );
    }

    await client.query("COMMIT");
    return fixture;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

const insertRawDistribution = async (fixture, stubId, status = "CLAIMED") => {
  const distributionId = crypto.randomUUID();
  const eventId = fixture.stubEventIdsById[stubId] || fixture.eventId;
  await pool.query(
    `
      INSERT INTO public.distribution_transactions (
        id, disaster_event_id, household_id, stub_id,
        distribution_status, verified_by, received_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `,
    [
      distributionId,
      eventId,
      fixture.householdId,
      stubId,
      status,
      fixture.userId,
    ],
  );
  return distributionId;
};

const insertDuplicateDistribution = async (fixture, stubId) => {
  try {
    await insertRawDistribution(fixture, stubId);
    assert.fail("duplicate distribution insert should fail");
  } catch (error) {
    assert.equal(error.code, "23505");
    assert.equal(error.constraint, "uq_distribution_stub");
    return error;
  }
};

const deleteRawDistribution = async (distributionId) => {
  await pool.query("DELETE FROM public.distribution_transactions WHERE id = $1", [
    distributionId,
  ]);
};

const buildClaimParams = (
  fixture,
  stubId,
  eventId = fixture.stubEventIdsById[stubId] || fixture.eventId,
) => ({
  id: stubId,
  user_id: fixture.userId,
  barangay_id: null,
  verified_by: fixture.userId,
  claimed_at: new Date().toISOString(),
  disaster_event_id: eventId,
  override_barangay_id: null,
});

const buildSyncEntry = (
  fixture,
  stubId,
  clientSyncId,
  {
    deviceId = null,
    localId = `${fixture.tag}_LOCAL_${clientSyncId}`,
    timestamp = new Date().toISOString(),
  } = {},
) => ({
  client_sync_id: clientSyncId,
  device_id: deviceId,
  entity_type: "STUB",
  entity_local_id: localId,
  entity_server_id: stubId,
  action_key: "STUB_CLAIM",
  client_timestamp: timestamp,
  payload: {
    disaster_event_id:
      fixture.stubEventIdsById[stubId] || fixture.eventId,
  },
});

const processSyncEntry = async (fixture, entry) =>
  (
    await syncService.processSyncEntries({
      entries: [entry],
      auth: {
        userId: fixture.userId,
        roleCode: "BARANGAY",
        defaultBarangayId: fixture.barangayId,
        deviceId: null,
      },
    })
  )[0];

const getFixtureEffects = async (fixture) => {
  const result = await pool.query(
    `
      WITH fixture_transactions AS (
        SELECT id
        FROM public.distribution_transactions
        WHERE stub_id = ANY($1::uuid[])
      ), fixture_items AS (
        SELECT dti.id, dti.quantity_released
        FROM public.distribution_transaction_items dti
        INNER JOIN fixture_transactions ft
          ON ft.id = dti.distribution_transaction_id
      ), fixture_outflows AS (
        SELECT it.id, it.quantity
        FROM public.inventory_transactions it
        INNER JOIN fixture_transactions ft
          ON ft.id = it.reference_id
        WHERE it.reference_type = 'DISTRIBUTION'
          AND it.transaction_type = 'OUTFLOW'
      )
      SELECT
        (SELECT COUNT(*)::integer FROM fixture_transactions) AS distribution_count,
        (SELECT COUNT(*)::integer FROM fixture_items) AS item_count,
        (SELECT COALESCE(SUM(quantity_released), 0)::integer FROM fixture_items)
          AS released_quantity,
        (SELECT COUNT(*)::integer FROM fixture_outflows) AS outflow_count,
        (SELECT COALESCE(SUM(quantity), 0)::integer FROM fixture_outflows)
          AS outflow_quantity,
        (SELECT COUNT(*)::integer
         FROM public.distribution_transactions dt
         INNER JOIN fixture_transactions ft ON ft.id = dt.id
         WHERE dt.receipt_no IS NOT NULL) AS receipt_count,
        (SELECT COUNT(DISTINCT dt.receipt_no)::integer
         FROM public.distribution_transactions dt
         INNER JOIN fixture_transactions ft ON ft.id = dt.id
         WHERE dt.receipt_no IS NOT NULL) AS distinct_receipt_count,
        (SELECT COUNT(*)::integer
         FROM public.distribution_transactions dt
         INNER JOIN fixture_transactions ft ON ft.id = dt.id
         WHERE dt.receipt_status = 'GENERATED') AS generated_receipt_count
    `,
    [
      [
        fixture.stubIds.concurrent,
        fixture.stubIds.same_household_a,
        fixture.stubIds.same_household_b,
        fixture.stubIds.sync_replay,
        fixture.stubIds.cross_device,
        fixture.stubIds.online_vs_offline,
      ],
    ],
  );
  return result.rows[0];
};

const assertBatchInventoryEffects = async (fixture) => {
  const result = await pool.query(
    `
      WITH fixture_transactions AS (
        SELECT id
        FROM public.distribution_transactions
        WHERE stub_id = ANY($2::uuid[])
      )
      SELECT
        b.id,
        b.quantity_available,
        COALESCE(SUM(dti.quantity_released), 0)::integer AS released_quantity
      FROM public.inventory_batches b
      LEFT JOIN public.distribution_transaction_items dti
        ON dti.inventory_batch_id = b.id
       AND dti.distribution_transaction_id IN (SELECT id FROM fixture_transactions)
      WHERE b.id = ANY($1::uuid[])
      GROUP BY b.id, b.quantity_available
      ORDER BY b.id
    `,
    [
      fixture.batchIds,
      [
        fixture.stubIds.concurrent,
        fixture.stubIds.same_household_a,
        fixture.stubIds.same_household_b,
        fixture.stubIds.sync_replay,
        fixture.stubIds.cross_device,
        fixture.stubIds.online_vs_offline,
      ],
    ],
  );

  assert.equal(result.rowCount, fixture.batchIds.length);
  for (const row of result.rows) {
    assert.equal(
      Number(row.quantity_available),
      FIXTURE_BATCH_QUANTITY - Number(row.released_quantity),
    );
  }
};

const cleanupFixture = async (fixture) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const distributionIdsResult = await client.query(
      `
        SELECT id
        FROM public.distribution_transactions
        WHERE stub_id = ANY($1::uuid[])
      `,
      [Object.values(fixture.stubIds)],
    );
    const distributionIds = distributionIdsResult.rows.map((row) => row.id);

    const syncIdsResult = await client.query(
      `
        SELECT id
        FROM public.sync_transactions
        WHERE client_sync_id LIKE $1
      `,
      [`${fixture.tag}%`],
    );
    const syncIds = syncIdsResult.rows.map((row) => row.id);

    const conflictIdsResult = syncIds.length
      ? await client.query(
          `
            SELECT id
            FROM public.sync_conflicts
            WHERE sync_transaction_id = ANY($1::uuid[])
          `,
          [syncIds],
        )
      : { rows: [] };
    const conflictIds = conflictIdsResult.rows.map((row) => row.id);

    const inventoryTransactionIdsResult = distributionIds.length
      ? await client.query(
          `
            SELECT id
            FROM public.inventory_transactions
            WHERE reference_type = 'DISTRIBUTION'
              AND reference_id = ANY($1::uuid[])
          `,
          [distributionIds],
        )
      : { rows: [] };
    const inventoryTransactionIds = inventoryTransactionIdsResult.rows.map(
      (row) => row.id,
    );

    const outboxSourceIds = [...syncIds, ...conflictIds];
    const notificationOutboxIdsResult = outboxSourceIds.length
      ? await client.query(
          `
            SELECT id
            FROM public.notification_outbox
            WHERE source_id = ANY($1::uuid[])
          `,
          [outboxSourceIds],
        )
      : { rows: [] };
    const notificationOutboxIds = notificationOutboxIdsResult.rows.map(
      (row) => row.id,
    );

    const notificationIdsResult = await client.query(
      `
        SELECT id
        FROM public.notifications
        WHERE disaster_event_id = $1
           OR source_event_key LIKE $2
           OR reference_id = ANY($3::uuid[])
           OR reference_id = ANY($4::uuid[])
      `,
      [
        fixture.eventId,
        `${fixture.tag}%`,
        distributionIds.length ? distributionIds : [crypto.randomUUID()],
        conflictIds.length ? conflictIds : [crypto.randomUUID()],
      ],
    );
    const notificationIds = notificationIdsResult.rows.map((row) => row.id);

    if (notificationIds.length) {
      await client.query(
        "DELETE FROM public.notification_email_deliveries WHERE notification_id = ANY($1::uuid[])",
        [notificationIds],
      );
      await client.query(
        "DELETE FROM public.notification_recipients WHERE notification_id = ANY($1::uuid[])",
        [notificationIds],
      );
      await client.query(
        "DELETE FROM public.notifications WHERE id = ANY($1::uuid[])",
        [notificationIds],
      );
    }

    if (notificationOutboxIds.length) {
      await client.query(
        "DELETE FROM public.notification_outbox WHERE id = ANY($1::uuid[])",
        [notificationOutboxIds],
      );
    }

    if (conflictIds.length) {
      await client.query(
        "DELETE FROM public.sync_conflicts WHERE id = ANY($1::uuid[])",
        [conflictIds],
      );
    }

    if (inventoryTransactionIds.length) {
      await client.query(
        "DELETE FROM public.inventory_domain_effect_intents WHERE inventory_transaction_id = ANY($1::uuid[])",
        [inventoryTransactionIds],
      );
      await client.query(
        "DELETE FROM public.inventory_transactions WHERE id = ANY($1::uuid[])",
        [inventoryTransactionIds],
      );
    }

    if (distributionIds.length) {
      await client.query(
        "DELETE FROM public.distribution_transaction_items WHERE distribution_transaction_id = ANY($1::uuid[])",
        [distributionIds],
      );
      await client.query(
        "DELETE FROM public.distribution_transactions WHERE id = ANY($1::uuid[])",
        [distributionIds],
      );
    }

    if (syncIds.length) {
      await client.query(
        "DELETE FROM public.sync_transactions WHERE id = ANY($1::uuid[])",
        [syncIds],
      );
    }

    await client.query(
      `
        DELETE FROM public.audit_logs
        WHERE user_id = $1
           OR entity_id = ANY($2::uuid[])
           OR source_event_key LIKE $3
      `,
      [
        fixture.userId,
        [...distributionIds, ...conflictIds],
        `${fixture.tag}%`,
      ],
    );
    await client.query(
      "DELETE FROM public.error_logs WHERE user_id = $1",
      [fixture.userId],
    );

    await client.query(
      "DELETE FROM public.devices WHERE device_uuid = ANY($1::text[])",
      [fixture.deviceUuids.length ? fixture.deviceUuids : ["__no_fixture_device__"]],
    );

    await client.query(
      "DELETE FROM public.evacuation_logs WHERE id = $1",
      [fixture.evacuationLogId],
    );
    await client.query(
      "DELETE FROM public.evacuation_logs WHERE id = $1",
      [fixture.secondEvacuationLogId],
    );
    for (const cycle of fixture.extraCycles) {
      await client.query(
        "DELETE FROM public.evacuation_logs WHERE id = $1",
        [cycle.evacuationLogId],
      );
    }
    await client.query(
      "UPDATE public.households SET family_head_evacuee_id = NULL WHERE id = $1",
      [fixture.householdId],
    );
    await client.query(
      "DELETE FROM public.evacuees WHERE id = $1",
      [fixture.evacueeId],
    );
    await client.query(
      "DELETE FROM public.household_privacy_consents WHERE household_id = $1",
      [fixture.householdId],
    );
    await client.query(
      "DELETE FROM public.household_sectors WHERE household_id = $1",
      [fixture.householdId],
    );
    await client.query(
      "DELETE FROM public.stubs WHERE id = ANY($1::uuid[])",
      [Object.values(fixture.stubIds)],
    );
    await client.query(
      "DELETE FROM public.households WHERE id = $1",
      [fixture.householdId],
    );

    await client.query(
      "DELETE FROM public.inventory_batches WHERE id = ANY($1::uuid[])",
      [fixture.batchIds],
    );
    for (const snapshot of fixture.inventoryItemSnapshots) {
      await client.query(
        `
          UPDATE public.inventory_items
          SET quantity = $2,
              packaging_count = $3,
              updated_at = $4
          WHERE id = $1
        `,
        [snapshot.id, snapshot.quantity, snapshot.packaging_count, snapshot.updated_at],
      );
    }

    if (fixture.referenceCounterSnapshot) {
      await client.query(
        `
          UPDATE public.inventory_transaction_reference_counters
          SET last_sequence = $2
          WHERE reference_year = $1
        `,
        [
          fixture.referenceCounterSnapshot.reference_year,
          fixture.referenceCounterSnapshot.last_sequence,
        ],
      );
    } else {
      await client.query(
        "DELETE FROM public.inventory_transaction_reference_counters WHERE reference_year = $1",
        [fixture.referenceYear],
      );
    }

    await client.query(
      "DELETE FROM public.user_role_settings WHERE user_id = $1",
      [fixture.userId],
    );
    await client.query("DELETE FROM public.user_roles WHERE user_id = $1", [
      fixture.userId,
    ]);
    await client.query("DELETE FROM public.disaster_event_barangays WHERE id = $1", [
      fixture.eventBarangayId,
    ]);
    await client.query("DELETE FROM public.disaster_event_barangays WHERE id = $1", [
      fixture.secondEventBarangayId,
    ]);
    await client.query("DELETE FROM public.disaster_events WHERE id = $1", [
      fixture.secondEventId,
    ]);
    for (const cycle of fixture.extraCycles) {
      await client.query(
        "DELETE FROM public.disaster_event_barangays WHERE id = $1",
        [cycle.eventBarangayId],
      );
      await client.query("DELETE FROM public.disaster_events WHERE id = $1", [
        cycle.eventId,
      ]);
    }
    await client.query("DELETE FROM public.disaster_events WHERE id = $1", [
      fixture.eventId,
    ]);
    await client.query("DELETE FROM public.users WHERE id = $1", [
      fixture.userId,
    ]);
    await client.query("DELETE FROM public.barangays WHERE id = $1", [
      fixture.barangayId,
    ]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

test("distribution stub claims and offline replays remain exactly once after canonical index consolidation", async () => {
  await assertVerifiedTestDatabase();
  await assertCanonicalState();

  const fixture = await createFixture();

  try {
    const concurrentResults = await Promise.allSettled([
      stubService.claimBarangayStub(
        buildClaimParams(fixture, fixture.stubIds.concurrent),
      ),
      stubService.claimBarangayStub(
        buildClaimParams(fixture, fixture.stubIds.concurrent),
      ),
    ]);
    const concurrentSuccesses = concurrentResults.filter(
      (result) => result.status === "fulfilled",
    );
    const concurrentConflicts = concurrentResults.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason?.code === "STUB_ALREADY_CLAIMED",
    );
    assert.equal(concurrentSuccesses.length, 1);
    assert.equal(concurrentConflicts.length, 1);

    await assert.rejects(
      () =>
        stubService.claimBarangayStub(
          buildClaimParams(fixture, fixture.stubIds.concurrent),
        ),
      (error) => {
        assert.equal(error.code, "STUB_ALREADY_CLAIMED");
        assert.equal(error.statusCode, 409);
        return true;
      },
    );

    const sameHouseholdFirst = await stubService.claimBarangayStub(
      buildClaimParams(fixture, fixture.stubIds.same_household_a),
    );
    const sameHouseholdSecond = await stubService.claimBarangayStub(
      buildClaimParams(
        fixture,
        fixture.stubIds.same_household_b,
        fixture.secondEventId,
      ),
    );
    assert.equal(sameHouseholdFirst.data.status, "CLAIMED");
    assert.equal(sameHouseholdSecond.data.status, "CLAIMED");
    assert.notEqual(
      sameHouseholdFirst.data.distribution_transaction_id,
      sameHouseholdSecond.data.distribution_transaction_id,
    );

    const canonicalDistributionId = await insertRawDistribution(
      fixture,
      fixture.stubIds.canonical_violation,
    );
    await assert.rejects(
      () =>
        stubService.claimBarangayStub(
          buildClaimParams(fixture, fixture.stubIds.canonical_violation),
        ),
      (error) => {
        assert.equal(error.code, "STUB_ALREADY_CLAIMED");
        assert.equal(error.statusCode, 409);
        assert.equal(error.entityServerId, fixture.stubIds.canonical_violation);
        return true;
      },
    );
    await deleteRawDistribution(canonicalDistributionId);

    const statusReuseDistributionId = await insertRawDistribution(
      fixture,
      fixture.stubIds.status_reuse,
      "CANCELLED",
    );
    const cancelledDuplicateError = await insertDuplicateDistribution(
      fixture,
      fixture.stubIds.status_reuse,
    );
    assert.equal(cancelledDuplicateError.constraint, "uq_distribution_stub");
    await pool.query(
      "UPDATE public.distribution_transactions SET distribution_status = 'REVERSED' WHERE id = $1",
      [statusReuseDistributionId],
    );
    const reversedDuplicateError = await insertDuplicateDistribution(
      fixture,
      fixture.stubIds.status_reuse,
    );
    assert.equal(reversedDuplicateError.constraint, "uq_distribution_stub");
    await deleteRawDistribution(statusReuseDistributionId);

    const replayClientSyncId = `${fixture.tag}_SYNC_REPLAY`;
    fixture.syncClientIds.push(replayClientSyncId);
    const replayEntry = buildSyncEntry(
      fixture,
      fixture.stubIds.sync_replay,
      replayClientSyncId,
      { deviceId: crypto.randomUUID() },
    );
    fixture.deviceUuids.push(replayEntry.device_id);
    const replayFirst = await processSyncEntry(fixture, replayEntry);
    const replaySecond = await processSyncEntry(fixture, replayEntry);
    assert.equal(replayFirst.sync_status, "SYNCED");
    assert.equal(replaySecond.sync_status, "SYNCED");
    assert.equal(replaySecond.replayed, true);
    assert.equal(
      replayFirst.sync_transaction_id,
      replaySecond.sync_transaction_id,
    );

    const firstDeviceId = crypto.randomUUID();
    const secondDeviceId = crypto.randomUUID();
    const crossDeviceFirstSyncId = `${fixture.tag}_CROSS_DEVICE_A`;
    const crossDeviceSecondSyncId = `${fixture.tag}_CROSS_DEVICE_B`;
    fixture.syncClientIds.push(crossDeviceFirstSyncId, crossDeviceSecondSyncId);
    fixture.deviceUuids.push(firstDeviceId, secondDeviceId);
    const crossDeviceFirst = await processSyncEntry(
      fixture,
      buildSyncEntry(
        fixture,
        fixture.stubIds.cross_device,
        crossDeviceFirstSyncId,
        { deviceId: firstDeviceId },
      ),
    );
    const crossDeviceSecond = await processSyncEntry(
      fixture,
      buildSyncEntry(
        fixture,
        fixture.stubIds.cross_device,
        crossDeviceSecondSyncId,
        { deviceId: secondDeviceId },
      ),
    );
    assert.equal(crossDeviceFirst.sync_status, "SYNCED");
    assert.equal(crossDeviceSecond.sync_status, "CONFLICT");
    assert.equal(crossDeviceSecond.conflict.conflict_type, "STUB_ALREADY_CLAIMED");

    const onlineVsOfflineSyncId = `${fixture.tag}_ONLINE_VS_OFFLINE`;
    fixture.syncClientIds.push(onlineVsOfflineSyncId);
    await stubService.claimBarangayStub(
      buildClaimParams(fixture, fixture.stubIds.online_vs_offline),
    );
    const onlineVsOffline = await processSyncEntry(
      fixture,
      buildSyncEntry(
        fixture,
        fixture.stubIds.online_vs_offline,
        onlineVsOfflineSyncId,
      ),
    );
    assert.equal(onlineVsOffline.sync_status, "CONFLICT");
    assert.equal(onlineVsOffline.conflict.conflict_type, "STUB_ALREADY_CLAIMED");

    const effects = await getFixtureEffects(fixture);
    assert.equal(Number(effects.distribution_count), 6);
    assert.equal(Number(effects.item_count), Number(effects.outflow_count));
    assert.equal(Number(effects.released_quantity), Number(effects.outflow_quantity));
    assert.ok(Number(effects.released_quantity) > 0);
    assert.equal(Number(effects.receipt_count), 6);
    assert.equal(Number(effects.distinct_receipt_count), 6);
    assert.equal(Number(effects.generated_receipt_count), 6);
    await assertBatchInventoryEffects(fixture);

    const stubStateResult = await pool.query(
      `
        SELECT id, status
        FROM public.stubs
        WHERE id = ANY($1::uuid[])
      `,
      [[
        fixture.stubIds.concurrent,
        fixture.stubIds.same_household_a,
        fixture.stubIds.same_household_b,
        fixture.stubIds.sync_replay,
        fixture.stubIds.cross_device,
        fixture.stubIds.online_vs_offline,
      ]],
    );
    assert.equal(stubStateResult.rowCount, 6);
    assert.ok(stubStateResult.rows.every((row) => row.status === "CLAIMED"));

    const syncStateResult = await pool.query(
      `
        SELECT client_sync_id, sync_status, COUNT(*) OVER ()::integer AS total_rows
        FROM public.sync_transactions
        WHERE client_sync_id LIKE $1
        ORDER BY client_sync_id
      `,
      [`${fixture.tag}%`],
    );
    assert.equal(syncStateResult.rows.length, 4);
    assert.equal(
      syncStateResult.rows.filter((row) => row.sync_status === "SYNCED").length,
      2,
    );
    assert.equal(
      syncStateResult.rows.filter((row) => row.sync_status === "CONFLICT").length,
      2,
    );
  } finally {
    await cleanupFixture(fixture);
  }

  await assertCanonicalState();
});
