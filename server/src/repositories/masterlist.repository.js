const pool = require("../config/db");
const BARANGAY_ROLE_CODE = "BARANGAY";

const getDisasterEventSummaryById = async (id) => {
  const query = `
    SELECT
      id,
      event_code,
      title,
      disaster_type,
      status
    FROM disaster_events
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getBarangaySummaryById = async (id) => {
  const query = `
    SELECT
      id,
      code,
      name,
      municipality_name,
      province_name,
      is_active
    FROM barangays
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getBarangayUserScopeById = async (userId) => {
  const query = `
    SELECT
      u.id,
      u.default_barangay_id,
      b.code AS barangay_code,
      b.name AS barangay_name,
      r.code AS role_code
    FROM users u
    LEFT JOIN barangays b ON b.id = u.default_barangay_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = $1
    ORDER BY ur.assigned_at ASC NULLS LAST
    LIMIT 1
  `;

  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
};

const getBarangayScopedDisasterEventsByStatuses = async (
  barangayId,
  statuses,
) => {
  const query = `
    SELECT
      scoped.id,
      scoped.event_code,
      scoped.title,
      scoped.disaster_type,
      scoped.description,
      scoped.start_date,
      scoped.end_date,
      scoped.status,
      scoped.created_at,
      scoped.updated_at
    FROM (
      SELECT DISTINCT
        de.id,
        de.event_code,
        de.title,
        de.disaster_type,
        de.description,
        de.start_date,
        de.end_date,
        de.status,
        de.created_at,
        de.updated_at,
        COALESCE(de.end_date, de.start_date) AS sort_date
      FROM disaster_events de
      LEFT JOIN disaster_event_barangays deb
        ON deb.disaster_event_id = de.id
        AND deb.barangay_id = $1
      LEFT JOIN households h
        ON h.disaster_event_id = de.id
        AND h.barangay_id = $1
        AND h.is_active = TRUE
      WHERE (deb.barangay_id IS NOT NULL OR h.id IS NOT NULL)
        AND de.status = ANY($2::text[])
    ) scoped
    ORDER BY
      scoped.sort_date DESC,
      scoped.created_at DESC
  `;

  const result = await pool.query(query, [barangayId, statuses]);
  return result.rows;
};

const getBarangayScopedDisasterEventById = async (
  disasterEventId,
  barangayId,
) => {
  const query = `
    SELECT
      de.id,
      de.event_code,
      de.title,
      de.disaster_type,
      de.description,
      de.start_date,
      de.end_date,
      de.status
    FROM disaster_events de
    LEFT JOIN disaster_event_barangays deb
      ON deb.disaster_event_id = de.id
      AND deb.barangay_id = $2
    LEFT JOIN households h
      ON h.disaster_event_id = de.id
      AND h.barangay_id = $2
      AND h.is_active = TRUE
    WHERE de.id = $1
      AND (deb.barangay_id IS NOT NULL OR h.id IS NOT NULL)
    LIMIT 1
  `;

  const result = await pool.query(query, [disasterEventId, barangayId]);
  return result.rows[0] || null;
};

const getBarangayDashboardMetrics = async (disasterEventId, barangayId) => {
  const query = `
    WITH scoped_households AS (
      SELECT h.id
      FROM households h
      WHERE h.disaster_event_id = $1
        AND h.barangay_id = $2
        AND h.is_active = TRUE
    ),
    scoped_evacuees AS (
      SELECT e.id
      FROM evacuees e
      JOIN scoped_households sh ON sh.id = e.household_id
      WHERE e.is_active = TRUE
    ),
    latest_logs AS (
      SELECT DISTINCT ON (el.evacuee_id)
        el.evacuee_id,
        el.status,
        el.time_in,
        el.time_out
      FROM evacuation_logs el
      JOIN scoped_households sh ON sh.id = el.household_id
      WHERE el.disaster_event_id = $1
      ORDER BY
        el.evacuee_id,
        COALESCE(el.time_out, el.time_in) DESC,
        el.updated_at DESC,
        el.created_at DESC
    )
    SELECT
      (SELECT COUNT(*)::int FROM scoped_evacuees) AS total_evacuees_individuals,
      (SELECT COUNT(*)::int FROM scoped_households) AS total_families,
      (
        SELECT COUNT(*)::int
        FROM latest_logs ll
        WHERE ll.status = 'PRESENT'
          AND ll.time_out IS NULL
      ) AS currently_admitted_evacuees,
      (
        SELECT COUNT(*)::int
        FROM latest_logs ll
        WHERE ll.status IN ('LEFT', 'TRANSFERRED')
          AND ll.time_out IS NOT NULL
      ) AS total_departed_evacuees
  `;

  const result = await pool.query(query, [disasterEventId, barangayId]);
  return result.rows[0] || {
    total_evacuees_individuals: 0,
    total_families: 0,
    currently_admitted_evacuees: 0,
    total_departed_evacuees: 0,
  };
};

const getMswdoMasterlistAnalytics = async (disasterEventId, barangayId = null) => {
  const query = `
    WITH filtered_households AS (
      SELECT
        h.id,
        h.barangay_id,
        h.household_size,
        h.residency_status
      FROM households h
      WHERE h.disaster_event_id = $1
        AND h.is_active = TRUE
        AND ($2::uuid IS NULL OR h.barangay_id = $2)
    ),
    filtered_evacuees AS (
      SELECT
        e.id,
        e.household_id,
        fh.barangay_id
      FROM evacuees e
      INNER JOIN filtered_households fh ON fh.id = e.household_id
      WHERE e.is_active = TRUE
    ),
    latest_logs AS (
      SELECT DISTINCT ON (el.evacuee_id)
        el.evacuee_id,
        el.status,
        el.time_out
      FROM evacuation_logs el
      INNER JOIN filtered_evacuees fe ON fe.id = el.evacuee_id
      WHERE el.disaster_event_id = $1
      ORDER BY
        el.evacuee_id,
        COALESCE(el.time_out, el.time_in) DESC,
        el.updated_at DESC,
        el.created_at DESC
    ),
    summary AS (
      SELECT
        (SELECT COUNT(*)::int FROM filtered_evacuees)
          AS total_number_of_evacuees_individuals,
        (SELECT COUNT(*)::int FROM filtered_households)
          AS total_number_of_families,
        COALESCE(
          (
            SELECT ROUND(AVG(fh.household_size)::numeric, 1)
            FROM filtered_households fh
          ),
          0
        ) AS average_household_size,
        (
          SELECT COUNT(*)::int
          FROM latest_logs ll
          WHERE ll.status = 'PRESENT'
            AND ll.time_out IS NULL
        ) AS currently_admitted_evacuees,
        (
          SELECT COUNT(*)::int
          FROM latest_logs ll
          WHERE ll.status IN ('LEFT', 'TRANSFERRED')
            AND ll.time_out IS NOT NULL
        ) AS total_departed_evacuees,
        (
          SELECT COUNT(DISTINCT fh.barangay_id)::int
          FROM filtered_households fh
        ) AS total_barangays_covered
    ),
    per_barangay AS (
      SELECT
        b.id AS barangay_id,
        b.name AS barangay_name,
        COUNT(DISTINCT fh.id)::int AS families_count,
        COUNT(DISTINCT fe.id)::int AS evacuees_count,
        COUNT(DISTINCT fe.id) FILTER (
          WHERE ll.status = 'PRESENT'
            AND ll.time_out IS NULL
        )::int AS admitted_evacuees_count,
        COUNT(DISTINCT fe.id) FILTER (
          WHERE ll.status IN ('LEFT', 'TRANSFERRED')
            AND ll.time_out IS NOT NULL
        )::int AS departed_evacuees_count
      FROM filtered_households fh
      INNER JOIN barangays b ON b.id = fh.barangay_id
      LEFT JOIN filtered_evacuees fe ON fe.household_id = fh.id
      LEFT JOIN latest_logs ll ON ll.evacuee_id = fe.id
      GROUP BY b.id, b.name
      ORDER BY b.name ASC
    )
    SELECT
      summary.total_number_of_evacuees_individuals,
      summary.total_number_of_families,
      summary.average_household_size,
      summary.currently_admitted_evacuees,
      summary.total_departed_evacuees,
      summary.total_barangays_covered,
      COALESCE(
        json_agg(
          json_build_object(
            'barangay_id', per_barangay.barangay_id,
            'barangay_name', per_barangay.barangay_name,
            'families_count', per_barangay.families_count,
            'evacuees_count', per_barangay.evacuees_count,
            'admitted_evacuees_count', per_barangay.admitted_evacuees_count,
            'departed_evacuees_count', per_barangay.departed_evacuees_count
          )
          ORDER BY per_barangay.barangay_name ASC
        ) FILTER (WHERE per_barangay.barangay_id IS NOT NULL),
        '[]'::json
      ) AS per_barangay_chart_dataset
    FROM summary
    LEFT JOIN per_barangay ON TRUE
    GROUP BY
      summary.total_number_of_evacuees_individuals,
      summary.total_number_of_families,
      summary.average_household_size,
      summary.currently_admitted_evacuees,
      summary.total_departed_evacuees,
      summary.total_barangays_covered
  `;

  const result = await pool.query(query, [disasterEventId, barangayId]);
  return (
    result.rows[0] || {
      total_number_of_evacuees_individuals: 0,
      total_number_of_families: 0,
      average_household_size: 0,
      currently_admitted_evacuees: 0,
      total_departed_evacuees: 0,
      total_barangays_covered: 0,
      per_barangay_chart_dataset: [],
    }
  );
};

const getHouseholdsByFilters = async (disasterEventId, barangayId = null) => {
  const values = [disasterEventId];
  let barangayFilterClause = "";

  if (barangayId) {
    values.push(barangayId);
    barangayFilterClause = "AND h.barangay_id = $2";
  }

  const query = `
    SELECT
      h.id AS household_id,
      h.disaster_event_id,
      h.barangay_id,
      h.residency_status,
      h.family_head_first_name,
      h.family_head_middle_name,
      h.family_head_last_name,
      h.family_head_suffix,
      h.household_size,
      h.current_stay_type,
      h.current_address_details,
      h.contact_number,
      h.registered_at,
      h.family_head_evacuee_id,
      b.code AS barangay_code,
      b.name AS barangay_name,
      b.municipality_name,
      b.province_name
    FROM households h
    LEFT JOIN barangays b ON b.id = h.barangay_id
    WHERE h.disaster_event_id = $1
    ${barangayFilterClause}
    ORDER BY h.registered_at DESC, h.family_head_last_name ASC
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getStubsByHouseholdIds = async (householdIds) => {
  if (householdIds.length === 0) {
    return [];
  }

  const query = `
    SELECT DISTINCT ON (household_id)
      id,
      household_id,
      stub_no,
      serial_no,
      status
    FROM stubs
    WHERE household_id = ANY($1::uuid[])
    ORDER BY household_id, issued_at DESC, updated_at DESC
  `;

  const result = await pool.query(query, [householdIds]);
  return result.rows;
};

const getHouseholdSectorsByHouseholdIds = async (householdIds) => {
  if (householdIds.length === 0) {
    return [];
  }

  const query = `
    SELECT
      hs.household_id,
      s.id,
      s.code,
      s.name
    FROM household_sectors hs
    INNER JOIN sectors s ON s.id = hs.sector_id
    WHERE hs.household_id = ANY($1::uuid[])
    ORDER BY s.name ASC
  `;

  const result = await pool.query(query, [householdIds]);
  return result.rows;
};

const getMembersByHouseholdIds = async (householdIds) => {
  if (householdIds.length === 0) {
    return [];
  }

  const query = `
    SELECT
      id AS evacuee_id,
      household_id,
      first_name,
      middle_name,
      last_name,
      suffix,
      sex,
      age,
      age_value,
      age_unit,
      relationship_to_head,
      is_family_head
    FROM evacuees
    WHERE household_id = ANY($1::uuid[])
    ORDER BY household_id ASC, is_family_head DESC, created_at ASC
  `;

  const result = await pool.query(query, [householdIds]);
  return result.rows;
};

const getMemberSectorsByHouseholdIds = async (householdIds) => {
  if (householdIds.length === 0) {
    return [];
  }

  const query = `
    SELECT
      e.household_id,
      es.evacuee_id,
      s.id,
      s.code,
      s.name
    FROM evacuee_sectors es
    INNER JOIN evacuees e ON e.id = es.evacuee_id
    INNER JOIN sectors s ON s.id = es.sector_id
    WHERE e.household_id = ANY($1::uuid[])
    ORDER BY e.household_id ASC, s.name ASC
  `;

  const result = await pool.query(query, [householdIds]);
  return result.rows;
};

const getLatestAttendanceByHouseholdIds = async (householdIds) => {
  if (householdIds.length === 0) {
    return [];
  }

  const query = `
    SELECT
      ranked.household_id,
      ranked.status,
      ranked.time_in,
      ranked.time_out,
      ranked.evacuation_center_id
    FROM (
      SELECT
        el.household_id,
        el.status,
        el.time_in,
        el.time_out,
        el.evacuation_center_id,
        ROW_NUMBER() OVER (
          PARTITION BY el.household_id
          ORDER BY el.created_at DESC, el.time_in DESC
        ) AS row_number
      FROM evacuation_logs el
      WHERE el.household_id = ANY($1::uuid[])
    ) ranked
    WHERE ranked.row_number = 1
  `;

  const result = await pool.query(query, [householdIds]);
  return result.rows;
};

module.exports = {
  BARANGAY_ROLE_CODE,
  getDisasterEventSummaryById,
  getBarangaySummaryById,
  getBarangayUserScopeById,
  getBarangayScopedDisasterEventsByStatuses,
  getBarangayScopedDisasterEventById,
  getBarangayDashboardMetrics,
  getMswdoMasterlistAnalytics,
  getHouseholdsByFilters,
  getStubsByHouseholdIds,
  getHouseholdSectorsByHouseholdIds,
  getMembersByHouseholdIds,
  getMemberSectorsByHouseholdIds,
  getLatestAttendanceByHouseholdIds,
};
