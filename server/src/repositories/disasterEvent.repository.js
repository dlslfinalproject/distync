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
    status,
    created_by,
    created_at,
    updated_at
  FROM disaster_events
`;

const getAllDisasterEvents = async () => {
  const query = `
    ${selectDisasterEventColumns}
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query);
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

const insertDisasterEvent = async (disasterEventData, dbClient) => {
  const query = `
    INSERT INTO disaster_events (
      event_code,
      title,
      disaster_type,
      description,
      start_date,
      end_date,
      status,
      created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING
      id,
      event_code,
      title,
      disaster_type,
      description,
      start_date,
      end_date,
      status,
      created_by,
      created_at,
      updated_at
  `;

  const values = [
    disasterEventData.event_code,
    disasterEventData.title,
    disasterEventData.disaster_type,
    disasterEventData.description,
    disasterEventData.start_date,
    disasterEventData.end_date,
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
      status,
      created_by,
      created_at,
      updated_at
  `;

  const values = [id, updates.end_date ?? null, updates.status ?? null];
  const result = await dbClient.query(query, values);
  return result.rows[0] || null;
};

module.exports = {
  getAllDisasterEvents,
  getActiveDisasterEvents,
  getDisasterEventById,
  getAffectedBarangaysByDisasterEventId,
  insertDisasterEvent,
  insertDisasterEventBarangays,
  updateDisasterEventById,
};
