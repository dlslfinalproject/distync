const pool = require("../config/db");

const selectDisasterEventColumns = `
  SELECT
    id,
    event_code,
    title,
    disaster_type,
    description,
    start_date,
    end_date,
    ended_at,
    status,
    created_by,
    created_at,
    updated_at
  FROM disaster_events
`;

const getAllDisasterEvents = async () => {
  const query = `
    ${selectDisasterEventColumns}
    WHERE status = ANY($1::TEXT[])
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query, [["ACTIVE", "CLOSED"]]);
  return result.rows;
};

const getActiveDisasterEvents = async () => {
  const query = `
    ${selectDisasterEventColumns}
    WHERE status = $1
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query, ["ACTIVE"]);
  return result.rows;
};

const getClosedDisasterEvents = async () => {
  const query = `
    ${selectDisasterEventColumns}
    WHERE status = $1
    ORDER BY updated_at DESC, created_at DESC
  `;

  const result = await pool.query(query, ["CLOSED"]);
  return result.rows;
};

const getDisasterEventById = async (id) => {
  const query = `
    ${selectDisasterEventColumns}
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getLatestHouseholdActivityByDisasterEventId = async (disasterEventId) => {
  const query = `
    WITH household_activity AS (
      SELECT MAX(activity_at) AS latest_activity_at
      FROM (
        SELECT h.registered_at AS activity_at
        FROM households h
        WHERE h.disaster_event_id = $1

        UNION ALL

        SELECT h.updated_at AS activity_at
        FROM households h
        WHERE h.disaster_event_id = $1

        UNION ALL

        SELECT el.time_in AS activity_at
        FROM evacuation_logs el
        WHERE el.disaster_event_id = $1

        UNION ALL

        SELECT el.time_out AS activity_at
        FROM evacuation_logs el
        WHERE el.disaster_event_id = $1

        UNION ALL

        SELECT el.updated_at AS activity_at
        FROM evacuation_logs el
        WHERE el.disaster_event_id = $1
      ) activities
    )
    SELECT latest_activity_at
    FROM household_activity
  `;

  const result = await pool.query(query, [disasterEventId]);
  return result.rows[0]?.latest_activity_at || null;
};

const getAffectedBarangaysByDisasterEventId = async (disasterEventId) => {
  const query = `
    SELECT
      b.id,
      b.code,
      b.name
    FROM disaster_event_barangays deb
    INNER JOIN barangays b ON b.id = deb.barangay_id
    WHERE deb.disaster_event_id = $1
    ORDER BY b.name ASC
  `;

  const result = await pool.query(query, [disasterEventId]);
  return result.rows;
};

const getValidBarangayCount = async () => {
  const query = `
    SELECT COUNT(*)::INTEGER AS count
    FROM barangays
    WHERE code <> $1
  `;

  const result = await pool.query(query, ["NON_RESIDENT_OUTSIDE_MALVAR"]);
  return result.rows[0]?.count || 0;
};

const getAffectedBarangaysByDisasterEventIds = async (disasterEventIds) => {
  if (!Array.isArray(disasterEventIds) || disasterEventIds.length === 0) {
    return [];
  }

  const query = `
    SELECT
      deb.disaster_event_id,
      b.id,
      b.code,
      b.name
    FROM disaster_event_barangays deb
    INNER JOIN barangays b ON b.id = deb.barangay_id
    WHERE deb.disaster_event_id = ANY($1::UUID[])
    ORDER BY b.name ASC
  `;

  const result = await pool.query(query, [disasterEventIds]);
  return result.rows;
};

const insertDisasterEvent = async (disasterEventData, dbClient) => {
  const query = `
    INSERT INTO disaster_events (
      event_code,
      title,
      disaster_type,
      description,
      start_date,
      end_date,
      ended_at,
      status,
      created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING
      id,
      event_code,
      title,
      disaster_type,
      description,
      start_date,
      end_date,
      ended_at,
      status,
      created_by,
      created_at,
      updated_at
  `;

  const values = [
    disasterEventData.event_code || null,
    disasterEventData.title,
    disasterEventData.disaster_type,
    disasterEventData.description,
    disasterEventData.start_date,
    disasterEventData.end_date,
    disasterEventData.ended_at || null,
    disasterEventData.status,
    disasterEventData.created_by,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const insertDisasterEventBarangays = async (
  disasterEventId,
  barangayIds,
  dbClient,
) => {
  const insertedRows = [];

  for (const barangayId of barangayIds) {
    const query = `
      INSERT INTO disaster_event_barangays (
        disaster_event_id,
        barangay_id
      )
      VALUES ($1, $2)
      RETURNING
        id,
        disaster_event_id,
        barangay_id,
        created_at
    `;

    const result = await dbClient.query(query, [disasterEventId, barangayId]);
    insertedRows.push(result.rows[0]);
  }

  return insertedRows;
};

const deleteDisasterEventBarangaysByDisasterEventId = async (
  disasterEventId,
  dbClient = pool,
) => {
  const query = `
    DELETE FROM disaster_event_barangays
    WHERE disaster_event_id = $1
  `;

  await dbClient.query(query, [disasterEventId]);
};

const updateDisasterEventById = async (id, updates, dbClient = pool) => {
  const query = `
    UPDATE disaster_events
    SET
      title = COALESCE($2, title),
      disaster_type = COALESCE($3, disaster_type),
      description = CASE WHEN $4::boolean THEN $5 ELSE description END,
      start_date = COALESCE($6, start_date),
      end_date = COALESCE($7, end_date),
      status = COALESCE($8, status),
      ended_at = CASE WHEN $9::boolean THEN $10 ELSE ended_at END,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      event_code,
      title,
      disaster_type,
      description,
      start_date,
      end_date,
      ended_at,
      status,
      created_by,
      created_at,
      updated_at
  `;

  const values = [
    id,
    updates.title ?? null,
    updates.disaster_type ?? null,
    Object.prototype.hasOwnProperty.call(updates, "description"),
    updates.description ?? null,
    updates.start_date ?? null,
    updates.end_date ?? null,
    updates.status ?? null,
    Object.prototype.hasOwnProperty.call(updates, "ended_at"),
    updates.ended_at ?? null,
  ];
  const result = await dbClient.query(query, values);
  return result.rows[0] || null;
};

const getDisasterEventReportSummary = async ({
  disasterEventId = null,
  barangayId = null,
  status = null,
  dateFrom = null,
  dateTo = null,
  limit = 100,
}) => {
  const values = [];
  const conditions = [];

  if (disasterEventId) {
    values.push(disasterEventId);
    conditions.push(`de.id = $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`de.status = $${values.length}`);
  }

  if (dateFrom) {
    values.push(dateFrom);
    conditions.push(`de.start_date >= $${values.length}`);
  }

  if (dateTo) {
    values.push(dateTo);
    conditions.push(`de.start_date <= $${values.length}`);
  }

  const barangayFilterIndex = barangayId ? values.push(barangayId) : null;

  if (barangayFilterIndex) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM disaster_event_barangays deb_filter
        WHERE deb_filter.disaster_event_id = de.id
          AND deb_filter.barangay_id = $${barangayFilterIndex}
      )
    `);
  }

  values.push(limit);
  const limitIndex = values.length;
  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const barangayScopedHouseholds = barangayFilterIndex
    ? `AND h.barangay_id = $${barangayFilterIndex}`
    : "";
  const barangayScopedStubs = barangayFilterIndex
    ? `AND hs.barangay_id = $${barangayFilterIndex}`
    : "";
  const barangayScopedTransactions = barangayFilterIndex
    ? `AND hd.barangay_id = $${barangayFilterIndex}`
    : "";
  const barangayScopedAffected = barangayFilterIndex
    ? `AND deb.barangay_id = $${barangayFilterIndex}`
    : "";

  const query = `
    SELECT
      de.id,
      de.event_code,
      de.title,
      de.disaster_type,
      de.start_date,
      de.end_date,
      de.status,
      COALESCE(affected_barangays.affected_barangays_count, 0)::int AS affected_barangays_count,
      COALESCE(affected_barangays.affected_barangays_text, '--') AS affected_barangays_text,
      COALESCE(household_counts.registered_households_count, 0)::int AS registered_households_count,
      COALESCE(distribution_counts.distributed_aid_count, 0)::int AS distributed_aid_count,
      COALESCE(stub_counts.claimed_stubs_count, 0)::int AS claimed_stubs_count,
      COALESCE(stub_counts.unclaimed_stubs_count, 0)::int AS unclaimed_stubs_count,
      COALESCE(distribution_counts.quantity_released_total, 0)::int AS quantity_released_total
    FROM disaster_events de
    LEFT JOIN LATERAL (
      SELECT
        COUNT(DISTINCT deb.barangay_id)::int AS affected_barangays_count,
        STRING_AGG(DISTINCT b.name, ', ' ORDER BY b.name) AS affected_barangays_text
      FROM disaster_event_barangays deb
      INNER JOIN barangays b ON b.id = deb.barangay_id
      WHERE deb.disaster_event_id = de.id
      ${barangayScopedAffected}
    ) affected_barangays ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS registered_households_count
      FROM households h
      WHERE h.disaster_event_id = de.id
      ${barangayScopedHouseholds}
    ) household_counts ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE s.status = 'CLAIMED')::int AS claimed_stubs_count,
        COUNT(*) FILTER (WHERE s.status = 'ISSUED')::int AS unclaimed_stubs_count
      FROM stubs s
      WHERE s.disaster_event_id = de.id
        AND EXISTS (
          SELECT 1
          FROM households hs
          WHERE hs.id = s.household_id
          ${barangayScopedStubs}
        )
    ) stub_counts ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COUNT(DISTINCT dt.id) FILTER (
          WHERE dt.distribution_status = 'CLAIMED'
        )::int AS distributed_aid_count,
        COALESCE(SUM(dti.quantity_released), 0)::int AS quantity_released_total
      FROM distribution_transactions dt
      LEFT JOIN distribution_transaction_items dti
        ON dti.distribution_transaction_id = dt.id
      WHERE dt.disaster_event_id = de.id
        AND EXISTS (
          SELECT 1
          FROM households hd
          WHERE hd.id = dt.household_id
          ${barangayScopedTransactions}
        )
    ) distribution_counts ON TRUE
    ${whereClause}
    ORDER BY de.start_date DESC, de.created_at DESC
    LIMIT $${limitIndex}
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

module.exports = {
  getAllDisasterEvents,
  getActiveDisasterEvents,
  getClosedDisasterEvents,
  getDisasterEventById,
  getLatestHouseholdActivityByDisasterEventId,
  getAffectedBarangaysByDisasterEventId,
  getAffectedBarangaysByDisasterEventIds,
  getValidBarangayCount,
  insertDisasterEvent,
  insertDisasterEventBarangays,
  deleteDisasterEventBarangaysByDisasterEventId,
  updateDisasterEventById,
  getDisasterEventReportSummary,
};
