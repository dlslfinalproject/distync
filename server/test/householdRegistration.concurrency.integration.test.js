const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const pool = require("../src/config/db");
const householdRegistrationService = require("../src/services/householdRegistration.service");
const {
  HOUSEHOLD_PRIVACY_CONSENT_STATUS,
  HOUSEHOLD_PRIVACY_NOTICE_VERSION,
} = require("../src/config/privacyNotice");

const uniqueSuffix = () => crypto.randomUUID().slice(0, 8);

const insertReturningId = async (dbClient, query, values) => {
  const result = await dbClient.query(query, values);
  return result.rows[0].id;
};

const seedRegistrationScope = async () => {
  const dbClient = await pool.connect();
  const suffix = uniqueSuffix();

  try {
    const barangayId = await insertReturningId(
      dbClient,
      `
        INSERT INTO barangays (
          code,
          name,
          municipality_name,
          province_name,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, $2, 'Malvar', 'Batangas', TRUE, NOW(), NOW())
        RETURNING id
      `,
      [`H04_${suffix}`, `H04 Barangay ${suffix}`],
    );

    const userId = await insertReturningId(
      dbClient,
      `
        INSERT INTO users (
          email,
          first_name,
          last_name,
          default_barangay_id,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, 'H04', 'Registrar', $2, TRUE, NOW(), NOW())
        RETURNING id
      `,
      [`h04-${suffix}@distync.local`, barangayId],
    );

    const eventId = await insertReturningId(
      dbClient,
      `
        INSERT INTO disaster_events (
          event_code,
          title,
          disaster_type,
          start_date,
          status,
          created_by,
          created_at,
          updated_at
        )
        VALUES ($1, $2, 'FLOOD', CURRENT_DATE, 'ACTIVE', $3, NOW(), NOW())
        RETURNING id
      `,
      [`H04-${suffix}`, `H04 Event ${suffix}`, userId],
    );

    await dbClient.query(
      `
        INSERT INTO disaster_event_barangays (
          disaster_event_id,
          barangay_id,
          created_at
        )
        VALUES ($1, $2, NOW())
      `,
      [eventId, barangayId],
    );

    await dbClient.query(
      `
        INSERT INTO sectors (
          code,
          name,
          description,
          sector_group,
          is_barangay_visible,
          is_mswdo_visible,
          created_at
        )
        VALUES (
          'ADULT',
          'Adult',
          'Adult age group',
          'AGE_GROUP',
          TRUE,
          TRUE,
          NOW()
        )
        ON CONFLICT (code) DO NOTHING
      `,
    );

    return {
      suffix,
      barangayId,
      eventId,
      userId,
    };
  } finally {
    dbClient.release();
  }
};

const cleanupRegistrationScope = async ({ barangayId, eventId, userId }) => {
  const dbClient = await pool.connect();

  try {
    await dbClient.query("BEGIN");
    const householdRows = await dbClient.query(
      `
        SELECT id
        FROM households
        WHERE disaster_event_id = $1
          AND barangay_id = $2
      `,
      [eventId, barangayId],
    );
    const householdIds = householdRows.rows.map((row) => row.id);

    if (householdIds.length > 0) {
      await dbClient.query(
        "DELETE FROM household_privacy_consents WHERE household_id = ANY($1::uuid[])",
        [householdIds],
      );
      await dbClient.query(
        "DELETE FROM evacuation_logs WHERE household_id = ANY($1::uuid[])",
        [householdIds],
      );
      await dbClient.query(
        `
          DELETE FROM evacuee_sectors
          WHERE evacuee_id IN (
            SELECT id
            FROM evacuees
            WHERE household_id = ANY($1::uuid[])
          )
        `,
        [householdIds],
      );
      await dbClient.query(
        "DELETE FROM household_sectors WHERE household_id = ANY($1::uuid[])",
        [householdIds],
      );
      await dbClient.query(
        "DELETE FROM stubs WHERE household_id = ANY($1::uuid[])",
        [householdIds],
      );
      await dbClient.query(
        "UPDATE households SET family_head_evacuee_id = NULL WHERE id = ANY($1::uuid[])",
        [householdIds],
      );
      await dbClient.query(
        "DELETE FROM evacuees WHERE household_id = ANY($1::uuid[])",
        [householdIds],
      );
      await dbClient.query("DELETE FROM households WHERE id = ANY($1::uuid[])", [
        householdIds,
      ]);
    }

    await dbClient.query(
      "DELETE FROM disaster_event_barangays WHERE disaster_event_id = $1 AND barangay_id = $2",
      [eventId, barangayId],
    );
    await dbClient.query("DELETE FROM disaster_events WHERE id = $1", [eventId]);
    await dbClient.query("DELETE FROM users WHERE id = $1", [userId]);
    await dbClient.query("DELETE FROM barangays WHERE id = $1", [barangayId]);
    await dbClient.query("COMMIT");
  } catch (error) {
    await dbClient.query("ROLLBACK");
    throw error;
  } finally {
    dbClient.release();
  }
};

const buildRequest = ({ eventId, barangayId, userId, suffix }) => ({
  disaster_event_id: eventId,
  barangay_id: barangayId,
  residency_status: "RESIDENT",
  evacuation_center_id: null,
  current_stay_type: "RELATIVES",
  household_size: 1,
  registered_by: userId,
  contact_number: "09170000000",
  current_address_details: `H04 test address ${suffix}`,
  household_sector_ids: [],
  family_head_photo_url: null,
  photo_verification_notes: null,
  family_head: {
    first_name: `H04`,
    middle_name: "",
    last_name: `Concurrent ${suffix}`,
    suffix: "",
    sex: "MALE",
    age_value: 35,
    age_unit: "YEARS",
    sector_ids: [],
  },
  members: [],
  privacy_acknowledgment: {
    consent_status: HOUSEHOLD_PRIVACY_CONSENT_STATUS.ACKNOWLEDGED,
    notice_version: HOUSEHOLD_PRIVACY_NOTICE_VERSION,
    acknowledged_at: "2026-08-08T08:00:00.000Z",
    acknowledged_by_name: `H04 Concurrent ${suffix}`,
  },
});

test("H04-07 concurrent same-event duplicate registration leaves one household", async () => {
  pool.assertTestDatabaseMutationAllowed();

  const scope = await seedRegistrationScope();

  try {
    const request = buildRequest(scope);
    const results = await Promise.allSettled([
      householdRegistrationService.registerHousehold(request),
      householdRegistrationService.registerHousehold(request),
    ]);
    const successes = results.filter((result) => result.status === "fulfilled");
    const duplicateRejections = results.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason?.code === "DUPLICATE_HOUSEHOLD_REGISTRATION",
    );
    const countResult = await pool.query(
      `
        SELECT COUNT(*)::integer AS count
        FROM households
        WHERE disaster_event_id = $1
          AND barangay_id = $2
          AND family_head_first_name = 'H04'
          AND family_head_last_name = $3
      `,
      [scope.eventId, scope.barangayId, `Concurrent ${scope.suffix}`],
    );

    assert.equal(successes.length, 1);
    assert.equal(duplicateRejections.length, 1);
    assert.equal(countResult.rows[0].count, 1);
  } finally {
    await cleanupRegistrationScope(scope);
  }
});
