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

const updateDisasterEventById = async (id, updates, dbClient = pool) => {
  const query = `
    UPDATE disaster_events
    SET
      end_date = COALESCE($2, end_date),
      status = COALESCE($3, status),
      ended_at = COALESCE($4, ended_at),
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
    updates.end_date ?? null,
    updates.status ?? null,
    updates.ended_at ?? null,
  ];
  const result = await dbClient.query(query, values);
  return result.rows[0] || null;
};

module.exports = {
  getAllDisasterEvents,
  getActiveDisasterEvents,
  getClosedDisasterEvents,
  getDisasterEventById,
  getAffectedBarangaysByDisasterEventId,
  getAffectedBarangaysByDisasterEventIds,
  getValidBarangayCount,
  insertDisasterEvent,
  insertDisasterEventBarangays,
  updateDisasterEventById,
};
