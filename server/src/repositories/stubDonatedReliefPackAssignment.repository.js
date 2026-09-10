const pool = require("../config/db");

const lockDisasterEventForDonationAssignments = async (
  disasterEventId,
  dbClient = pool,
) => {
  if (!disasterEventId) {
    return null;
  }

  const result = await dbClient.query(
    `
      SELECT id, status
      FROM disaster_events
      WHERE id = $1
      FOR UPDATE
    `,
    [disasterEventId],
  );

  return result.rows[0] || null;
};

const getEligibleUnclaimedStubsForDonationAssignments = async (
  disasterEventId,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      SELECT
        s.id,
        s.disaster_event_id,
        s.household_id,
        s.issued_at,
        latest_attendance.time_in AS queue_time_in
      FROM stubs s
      INNER JOIN households h
        ON h.id = s.household_id
      INNER JOIN LATERAL (
        SELECT el.status, el.time_in, el.time_out
        FROM evacuation_logs el
        WHERE el.household_id = h.id
          AND el.disaster_event_id = s.disaster_event_id
        ORDER BY
          COALESCE(el.time_out, el.time_in) DESC,
          el.updated_at DESC,
          el.created_at DESC
        LIMIT 1
      ) latest_attendance ON TRUE
      WHERE s.disaster_event_id = $1
        AND s.status = 'ISSUED'
        AND h.current_stay_type = 'EVAC_CENTER'
        AND h.is_active = TRUE
        AND latest_attendance.status = 'PRESENT'
        AND latest_attendance.time_out IS NULL
      ORDER BY
        latest_attendance.time_in ASC NULLS LAST,
        s.issued_at ASC,
        s.id ASC
      FOR UPDATE OF s
    `,
    [disasterEventId],
  );

  return result.rows;
};

const getActiveAssignmentsByEvent = async (disasterEventId, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT
        a.id,
        a.stub_id,
        a.disaster_event_id,
        a.donation_id,
        a.pack_name,
        a.pack_size,
        a.assignment_status,
        a.items_snapshot,
        a.assigned_at,
        a.claimed_at,
        a.released_at,
        a.release_reason,
        a.updated_at,
        d.donor_name
      FROM stub_donated_relief_pack_assignments a
      INNER JOIN donations d
        ON d.id = a.donation_id
      WHERE a.disaster_event_id = $1
        AND a.assignment_status = 'RESERVED'
      ORDER BY a.assigned_at ASC, a.id ASC
      FOR UPDATE OF a
    `,
    [disasterEventId],
  );

  return result.rows;
};

const getAssignmentsByStubIds = async (
  stubIds,
  dbClient = pool,
  { includeReleased = false, forUpdate = false } = {},
) => {
  const normalizedStubIds = [
    ...new Set((Array.isArray(stubIds) ? stubIds : []).filter(Boolean)),
  ];

  if (normalizedStubIds.length === 0) {
    return [];
  }

  const result = await dbClient.query(
    `
      SELECT
        a.id,
        a.stub_id,
        a.disaster_event_id,
        a.donation_id,
        a.pack_name,
        a.pack_size,
        a.assignment_status,
        a.items_snapshot,
        a.assigned_at,
        a.claimed_at,
        a.released_at,
        a.release_reason,
        a.updated_at,
        d.donor_name
      FROM stub_donated_relief_pack_assignments a
      INNER JOIN donations d
        ON d.id = a.donation_id
      WHERE a.stub_id = ANY($1::uuid[])
        AND ${includeReleased ? "TRUE" : "a.assignment_status <> 'RELEASED'"}
      ORDER BY a.assigned_at ASC, a.id ASC
      ${forUpdate ? "FOR UPDATE OF a" : ""}
    `,
    [normalizedStubIds],
  );

  return result.rows;
};

const insertAssignment = async (assignment, dbClient = pool) => {
  const result = await dbClient.query(
    `
      INSERT INTO stub_donated_relief_pack_assignments (
        stub_id,
        disaster_event_id,
        donation_id,
        pack_name,
        pack_size,
        assignment_status,
        items_snapshot,
        assigned_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'RESERVED', $6::jsonb, NOW(), NOW())
      ON CONFLICT (stub_id, donation_id, (LOWER(pack_name)), pack_size)
      DO NOTHING
      RETURNING
        id,
        stub_id,
        disaster_event_id,
        donation_id,
        pack_name,
        pack_size,
        assignment_status,
        items_snapshot,
        assigned_at,
        claimed_at,
        released_at,
        release_reason,
        updated_at
    `,
    [
      assignment.stub_id,
      assignment.disaster_event_id,
      assignment.donation_id,
      assignment.pack_name,
      assignment.pack_size,
      JSON.stringify(assignment.items_snapshot || []),
    ],
  );

  return result.rows[0] || null;
};

const markAssignmentsClaimedForStub = async (stubId, dbClient = pool) => {
  const result = await dbClient.query(
    `
      UPDATE stub_donated_relief_pack_assignments
      SET
        assignment_status = 'CLAIMED',
        claimed_at = COALESCE(claimed_at, NOW()),
        updated_at = NOW()
      WHERE stub_id = $1
        AND assignment_status = 'RESERVED'
      RETURNING id, stub_id, donation_id, pack_name, pack_size, assignment_status
    `,
    [stubId],
  );

  return result.rows;
};

const releaseAssignmentsForHousehold = async (
  householdId,
  disasterEventId,
  releaseReason,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      UPDATE stub_donated_relief_pack_assignments a
      SET
        assignment_status = 'RELEASED',
        released_at = COALESCE(released_at, NOW()),
        release_reason = COALESCE($3, release_reason),
        updated_at = NOW()
      FROM stubs s
      WHERE a.stub_id = s.id
        AND s.household_id = $1
        AND s.disaster_event_id = $2
        AND a.assignment_status = 'RESERVED'
      RETURNING a.id, a.stub_id, a.donation_id, a.pack_name, a.pack_size, a.assignment_status
    `,
    [householdId, disasterEventId, releaseReason || null],
  );

  return result.rows;
};

const releaseAssignmentsForEvent = async (
  disasterEventId,
  releaseReason,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      UPDATE stub_donated_relief_pack_assignments
      SET
        assignment_status = 'RELEASED',
        released_at = COALESCE(released_at, NOW()),
        release_reason = COALESCE($2, release_reason),
        updated_at = NOW()
      WHERE disaster_event_id = $1
        AND assignment_status = 'RESERVED'
      RETURNING id, stub_id, donation_id, pack_name, pack_size, assignment_status
    `,
    [disasterEventId, releaseReason || null],
  );

  return result.rows;
};

module.exports = {
  lockDisasterEventForDonationAssignments,
  getEligibleUnclaimedStubsForDonationAssignments,
  getActiveAssignmentsByEvent,
  getAssignmentsByStubIds,
  insertAssignment,
  markAssignmentsClaimedForStub,
  releaseAssignmentsForHousehold,
  releaseAssignmentsForEvent,
};
