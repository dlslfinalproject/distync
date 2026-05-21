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
      scoped.ended_at,
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
        de.ended_at,
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
      de.ended_at,
      de.updated_at,
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
        h.residency_status,
        h.current_stay_type
      FROM households h
      WHERE h.disaster_event_id = $1
        AND h.is_active = TRUE
        AND ($2::uuid IS NULL OR h.barangay_id = $2)
    ),
    filtered_evacuees AS (
      SELECT
        e.id,
        e.household_id,
        fh.barangay_id,
        e.sex,
        e.birth_date,
        e.age,
        e.age_value,
        e.age_unit
      FROM evacuees e
      INNER JOIN filtered_households fh ON fh.id = e.household_id
      WHERE e.is_active = TRUE
    ),
    latest_logs AS (
      SELECT DISTINCT ON (el.evacuee_id)
        el.evacuee_id,
        el.household_id,
        el.status,
        el.time_in,
        el.time_out,
        el.evacuation_center_id
      FROM evacuation_logs el
      INNER JOIN filtered_evacuees fe ON fe.id = el.evacuee_id
      WHERE el.disaster_event_id = $1
      ORDER BY
        el.evacuee_id,
        COALESCE(el.time_out, el.time_in) DESC,
        el.updated_at DESC,
        el.created_at DESC
    ),
    sex_distribution AS (
      SELECT
        CASE
          WHEN fe.sex = 'MALE' THEN 'Male'
          WHEN fe.sex = 'FEMALE' THEN 'Female'
          ELSE 'Unspecified'
        END AS name,
        COUNT(*)::int AS value
      FROM filtered_evacuees fe
      GROUP BY 1
      ORDER BY value DESC, name ASC
    ),
    evacuees_with_age AS (
      SELECT
        fe.id,
        CASE
          WHEN fe.birth_date IS NOT NULL THEN GREATEST(DATE_PART('year', AGE(CURRENT_DATE, fe.birth_date))::int, 0)
          WHEN fe.age IS NOT NULL THEN fe.age
          WHEN fe.age_value IS NOT NULL AND fe.age_unit = 'YEARS' THEN fe.age_value
          WHEN fe.age_value IS NOT NULL AND fe.age_unit = 'MONTHS' THEN 0
          ELSE NULL
        END AS age_years
      FROM filtered_evacuees fe
    ),
    age_group_distribution AS (
      SELECT
        CASE
          WHEN ewa.age_years IS NULL THEN 'Unknown'
          WHEN ewa.age_years <= 12 THEN 'Child (0-12)'
          WHEN ewa.age_years <= 17 THEN 'Teen (13-17)'
          WHEN ewa.age_years <= 59 THEN 'Adult (18-59)'
          ELSE 'Senior (60+)'
        END AS name,
        CASE
          WHEN ewa.age_years IS NULL THEN 5
          WHEN ewa.age_years <= 12 THEN 1
          WHEN ewa.age_years <= 17 THEN 2
          WHEN ewa.age_years <= 59 THEN 3
          ELSE 4
        END AS sort_order,
        COUNT(*)::int AS value
      FROM evacuees_with_age ewa
      GROUP BY 1, 2
      ORDER BY sort_order ASC
    ),
    sector_distribution AS (
      SELECT
        sector_items.name,
        COUNT(*)::int AS value
      FROM (
        SELECT s.name
        FROM household_sectors hs
        INNER JOIN filtered_households fh ON fh.id = hs.household_id
        INNER JOIN sectors s ON s.id = hs.sector_id

        UNION ALL

        SELECT s.name
        FROM evacuee_sectors es
        INNER JOIN filtered_evacuees fe ON fe.id = es.evacuee_id
        INNER JOIN sectors s ON s.id = es.sector_id
      ) sector_items
      GROUP BY sector_items.name
      ORDER BY value DESC, sector_items.name ASC
    ),
    stay_type_distribution AS (
      SELECT
        CASE
          WHEN fh.current_stay_type = 'EVAC_CENTER' THEN 'Evacuation Center'
          WHEN fh.current_stay_type = 'RELATIVES' THEN 'Relatives'
          WHEN fh.current_stay_type = 'OTHER_SAFE_PLACE' THEN 'Other Safe Place'
          ELSE 'Unspecified'
        END AS name,
        COUNT(*)::int AS value
      FROM filtered_households fh
      GROUP BY 1
      ORDER BY value DESC, name ASC
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
    ),
    evacuation_center_distribution AS (
      SELECT
        ec.id AS evacuation_center_id,
        ec.name AS evacuation_center_name,
        COUNT(DISTINCT ll.evacuee_id)::int AS value
      FROM latest_logs ll
      INNER JOIN evacuation_centers ec ON ec.id = ll.evacuation_center_id
      WHERE ll.status = 'PRESENT'
        AND ll.time_out IS NULL
      GROUP BY ec.id, ec.name
      ORDER BY value DESC, ec.name ASC
    ),
    relief_distribution_per_barangay AS (
      SELECT
        b.id AS barangay_id,
        b.name AS barangay_name,
        COALESCE(SUM(dti.quantity_released), 0)::int AS value
      FROM distribution_transactions dt
      INNER JOIN filtered_households fh ON fh.id = dt.household_id
      INNER JOIN barangays b ON b.id = fh.barangay_id
      LEFT JOIN distribution_transaction_items dti
        ON dti.distribution_transaction_id = dt.id
      WHERE dt.disaster_event_id = $1
        AND dt.distribution_status = 'CLAIMED'
      GROUP BY b.id, b.name
      ORDER BY value DESC, b.name ASC
    ),
    daily_admission_trend AS (
      SELECT
        DATE(el.time_in) AS admission_date,
        COUNT(DISTINCT el.evacuee_id)::int AS value
      FROM evacuation_logs el
      INNER JOIN filtered_households fh ON fh.id = el.household_id
      WHERE el.disaster_event_id = $1
      GROUP BY DATE(el.time_in)
      ORDER BY admission_date ASC
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
      ) AS per_barangay_chart_dataset,
      (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'name', sd.name,
              'value', sd.value
            )
            ORDER BY sd.value DESC, sd.name ASC
          ),
          '[]'::json
        )
        FROM sex_distribution sd
      ) AS sex_distribution_dataset,
      (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'name', agd.name,
              'value', agd.value
            )
            ORDER BY agd.sort_order ASC
          ),
          '[]'::json
        )
        FROM age_group_distribution agd
      ) AS age_group_distribution_dataset,
      (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'name', sd.name,
              'value', sd.value
            )
            ORDER BY sd.value DESC, sd.name ASC
          ),
          '[]'::json
        )
        FROM sector_distribution sd
      ) AS sector_distribution_dataset,
      (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'name', std.name,
              'value', std.value
            )
            ORDER BY std.value DESC, std.name ASC
          ),
          '[]'::json
        )
        FROM stay_type_distribution std
      ) AS stay_type_distribution_dataset,
      (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'name', ecd.evacuation_center_name,
              'value', ecd.value
            )
            ORDER BY ecd.value DESC, ecd.evacuation_center_name ASC
          ),
          '[]'::json
        )
        FROM evacuation_center_distribution ecd
      ) AS evacuation_center_distribution_dataset,
      (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'name', rdb.barangay_name,
              'value', rdb.value
            )
            ORDER BY rdb.value DESC, rdb.barangay_name ASC
          ),
          '[]'::json
        )
        FROM relief_distribution_per_barangay rdb
      ) AS relief_distribution_dataset,
      (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'name', TO_CHAR(dat.admission_date, 'Mon DD'),
              'date', dat.admission_date,
              'value', dat.value
            )
            ORDER BY dat.admission_date ASC
          ),
          '[]'::json
        )
        FROM daily_admission_trend dat
      ) AS daily_admission_trend_dataset
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
      sex_distribution_dataset: [],
      age_group_distribution_dataset: [],
      sector_distribution_dataset: [],
      stay_type_distribution_dataset: [],
      evacuation_center_distribution_dataset: [],
      relief_distribution_dataset: [],
      daily_admission_trend_dataset: [],
    }
  );
};

const getHouseholdsByFilters = async (
  disasterEventId,
  barangayId = null,
  recordStatus = "active",
) => {
  const values = [disasterEventId];
  let barangayFilterClause = "";
  let activeFilterClause = "";

  if (barangayId) {
    values.push(barangayId);
    barangayFilterClause = "AND h.barangay_id = $2";
  }

  if (recordStatus === "active") {
    activeFilterClause = "AND h.is_active = TRUE";
  } else if (recordStatus === "archived") {
    activeFilterClause = "AND h.is_active = FALSE";
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
      h.is_active,
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
    ${activeFilterClause}
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

const getMembersByHouseholdIds = async (
  householdIds,
  { includeInactive = false } = {},
) => {
  if (householdIds.length === 0) {
    return [];
  }

  const activeFilterClause = includeInactive ? "" : "AND is_active = TRUE";

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
      ${activeFilterClause}
    ORDER BY household_id ASC, is_family_head DESC, created_at ASC
  `;

  const result = await pool.query(query, [householdIds]);
  return result.rows;
};

const getMemberSectorsByHouseholdIds = async (
  householdIds,
  { includeInactive = false } = {},
) => {
  if (householdIds.length === 0) {
    return [];
  }

  const activeFilterClause = includeInactive ? "" : "AND e.is_active = TRUE";

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
      ${activeFilterClause}
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
