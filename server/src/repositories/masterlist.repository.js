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
      SELECT
        h.id,
        h.is_active,
        h.household_size,
        h.registered_at,
        h.updated_at,
        h.current_stay_type,
        LOWER(
          CONCAT_WS(
            '|',
            REGEXP_REPLACE(BTRIM(COALESCE(h.family_head_first_name, '')), '\\s+', ' ', 'g'),
            REGEXP_REPLACE(BTRIM(COALESCE(h.family_head_middle_name, '')), '\\s+', ' ', 'g'),
            REGEXP_REPLACE(BTRIM(COALESCE(h.family_head_last_name, '')), '\\s+', ' ', 'g'),
            REGEXP_REPLACE(BTRIM(COALESCE(h.family_head_suffix, '')), '\\s+', ' ', 'g'),
            COALESCE(h.sex, ''),
            REGEXP_REPLACE(BTRIM(COALESCE(h.contact_number, '')), '\\s+', '', 'g')
          )
        ) AS household_key
      FROM households h
      WHERE h.disaster_event_id = $1
        AND h.barangay_id = $2
    ),
    deduplicated_households AS (
      SELECT DISTINCT ON (sh.household_key)
        sh.id,
        sh.household_key,
        sh.household_size,
        sh.is_active,
        sh.current_stay_type,
        sh.registered_at,
        sh.updated_at
      FROM scoped_households sh
      ORDER BY
        sh.household_key,
        COALESCE(sh.updated_at, sh.registered_at) DESC,
        sh.is_active DESC,
        sh.registered_at DESC
    ),
    scoped_evacuees AS (
      SELECT
        e.id,
        e.household_id,
        dh.household_key,
        dh.is_active AS household_is_active,
        dh.current_stay_type,
        dh.registered_at AS household_registered_at,
        dh.updated_at AS household_updated_at,
        e.created_at AS evacuee_created_at,
        e.updated_at AS evacuee_updated_at,
        LOWER(
          CONCAT_WS(
            '|',
            REGEXP_REPLACE(BTRIM(COALESCE(e.first_name, '')), '\\s+', ' ', 'g'),
            REGEXP_REPLACE(BTRIM(COALESCE(e.middle_name, '')), '\\s+', ' ', 'g'),
            REGEXP_REPLACE(BTRIM(COALESCE(e.last_name, '')), '\\s+', ' ', 'g'),
            REGEXP_REPLACE(BTRIM(COALESCE(e.suffix, '')), '\\s+', ' ', 'g'),
            COALESCE(e.sex, ''),
            COALESCE(e.relationship_to_head, ''),
            CASE WHEN e.is_family_head THEN '1' ELSE '0' END
          )
        ) AS evacuee_key
      FROM evacuees e
      JOIN deduplicated_households dh ON dh.id = e.household_id
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
    ),
    deduplicated_evacuees AS (
      SELECT DISTINCT ON (se.evacuee_key)
        se.evacuee_key,
        se.household_key,
        se.current_stay_type,
        ll.status,
        ll.time_in,
        ll.time_out
      FROM scoped_evacuees se
      LEFT JOIN latest_logs ll ON ll.evacuee_id = se.id
      ORDER BY
        se.evacuee_key,
        COALESCE(ll.time_out, ll.time_in, se.household_updated_at, se.household_registered_at, se.evacuee_updated_at, se.evacuee_created_at) DESC,
        se.household_is_active DESC,
        se.evacuee_updated_at DESC,
        se.evacuee_created_at DESC
    )
    SELECT
      (
        SELECT COALESCE(SUM(dh.household_size), 0)::int
        FROM deduplicated_households dh
      )
        AS total_evacuees_individuals,
      (
        SELECT COUNT(*)::int
        FROM deduplicated_households dh
      ) AS total_families,
      (
        SELECT COUNT(*)::int
        FROM deduplicated_evacuees de
        WHERE de.current_stay_type = 'EVAC_CENTER'
          AND de.status = 'PRESENT'
          AND de.time_out IS NULL
      ) AS currently_admitted_evacuees,
      (
        SELECT COUNT(*)::int
        FROM deduplicated_evacuees de
        WHERE de.current_stay_type = 'EVAC_CENTER'
          AND de.status = 'LEFT'
          AND de.time_out IS NOT NULL
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
        h.current_stay_type,
        h.is_active,
        h.registered_at,
        h.updated_at,
        h.family_head_first_name,
        h.family_head_middle_name,
        h.family_head_last_name,
        h.family_head_suffix,
        h.sex,
        h.contact_number
      FROM households h
      WHERE h.disaster_event_id = $1
        AND ($2::uuid IS NULL OR h.barangay_id = $2)
    ),
    summary_households AS (
      SELECT
        fh.id,
        fh.barangay_id,
        fh.household_size,
        fh.current_stay_type,
        fh.is_active,
        fh.registered_at,
        fh.updated_at,
        LOWER(
          CONCAT_WS(
            '|',
            REGEXP_REPLACE(BTRIM(COALESCE(fh.family_head_first_name, '')), '\\s+', ' ', 'g'),
            REGEXP_REPLACE(BTRIM(COALESCE(fh.family_head_middle_name, '')), '\\s+', ' ', 'g'),
            REGEXP_REPLACE(BTRIM(COALESCE(fh.family_head_last_name, '')), '\\s+', ' ', 'g'),
            REGEXP_REPLACE(BTRIM(COALESCE(fh.family_head_suffix, '')), '\\s+', ' ', 'g'),
            COALESCE(fh.sex, ''),
            REGEXP_REPLACE(BTRIM(COALESCE(fh.contact_number, '')), '\\s+', '', 'g')
          )
        ) AS household_key
      FROM filtered_households fh
    ),
    deduplicated_summary_households AS (
      SELECT DISTINCT ON (sh.household_key)
        sh.id,
        sh.barangay_id,
        sh.household_size,
        sh.current_stay_type,
        sh.is_active,
        sh.registered_at,
        sh.updated_at,
        sh.household_key
      FROM summary_households sh
      ORDER BY
        sh.household_key,
        COALESCE(sh.updated_at, sh.registered_at) DESC,
        sh.is_active DESC,
        sh.registered_at DESC
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
        e.age_unit,
        e.first_name,
        e.middle_name,
        e.last_name,
        e.suffix,
        e.relationship_to_head,
        e.is_family_head,
        e.created_at,
        e.updated_at,
        fh.is_active AS household_is_active,
        fh.current_stay_type,
        fh.registered_at AS household_registered_at,
        fh.updated_at AS household_updated_at
      FROM evacuees e
      INNER JOIN filtered_households fh ON fh.id = e.household_id
    ),
    summary_evacuees AS (
      SELECT
        fe.id,
        fe.household_id,
        dsh.household_key,
        fe.sex,
        fe.birth_date,
        fe.age,
        fe.age_value,
        fe.age_unit,
        fe.household_is_active,
        fe.current_stay_type,
        fe.household_registered_at,
        fe.household_updated_at,
        fe.created_at AS evacuee_created_at,
        fe.updated_at AS evacuee_updated_at,
        LOWER(
          CONCAT_WS(
            '|',
            REGEXP_REPLACE(BTRIM(COALESCE(fe.first_name, '')), '\\s+', ' ', 'g'),
            REGEXP_REPLACE(BTRIM(COALESCE(fe.middle_name, '')), '\\s+', ' ', 'g'),
            REGEXP_REPLACE(BTRIM(COALESCE(fe.last_name, '')), '\\s+', ' ', 'g'),
            REGEXP_REPLACE(BTRIM(COALESCE(fe.suffix, '')), '\\s+', ' ', 'g'),
            COALESCE(fe.sex, ''),
            COALESCE(fe.relationship_to_head, ''),
            CASE WHEN fe.is_family_head THEN '1' ELSE '0' END
          )
        ) AS evacuee_key
      FROM filtered_evacuees fe
      INNER JOIN deduplicated_summary_households dsh
        ON dsh.id = fe.household_id
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
    deduplicated_summary_evacuees AS (
      SELECT DISTINCT ON (se.evacuee_key)
        se.id,
        se.evacuee_key,
        se.household_key,
        se.sex,
        se.birth_date,
        se.age,
        se.age_value,
        se.age_unit,
        se.current_stay_type,
        ll.status,
        ll.time_in,
        ll.time_out,
        ll.evacuation_center_id
      FROM summary_evacuees se
      LEFT JOIN latest_logs ll ON ll.evacuee_id = se.id
      ORDER BY
        se.evacuee_key,
        COALESCE(
          ll.time_out,
          ll.time_in,
          se.household_updated_at,
          se.household_registered_at,
          se.evacuee_updated_at,
          se.evacuee_created_at
        ) DESC,
        se.household_is_active DESC,
        se.evacuee_updated_at DESC,
        se.evacuee_created_at DESC
    ),
    sex_distribution AS (
      SELECT
        CASE
          WHEN dse.sex = 'MALE' THEN 'Male'
          WHEN dse.sex = 'FEMALE' THEN 'Female'
          ELSE 'Unspecified'
        END AS name,
        COUNT(*)::int AS value
      FROM deduplicated_summary_evacuees dse
      GROUP BY 1
      ORDER BY value DESC, name ASC
    ),
    evacuees_with_age AS (
      SELECT
        dse.id,
        CASE
          WHEN dse.birth_date IS NOT NULL THEN GREATEST(DATE_PART('year', AGE(CURRENT_DATE, dse.birth_date))::int, 0)
          WHEN dse.age IS NOT NULL THEN dse.age
          WHEN dse.age_value IS NOT NULL AND dse.age_unit = 'YEARS' THEN dse.age_value
          WHEN dse.age_value IS NOT NULL AND dse.age_unit = 'MONTHS' THEN 0
          ELSE NULL
        END AS age_years
      FROM deduplicated_summary_evacuees dse
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
        sector_items.code,
        sector_items.name,
        sector_items.sector_group,
        COUNT(*)::int AS value
      FROM (
        SELECT s.code, s.name, s.sector_group
        FROM household_sectors hs
        INNER JOIN deduplicated_summary_households dsh ON dsh.id = hs.household_id
        INNER JOIN sectors s ON s.id = hs.sector_id

        UNION ALL

        SELECT s.code, s.name, s.sector_group
        FROM evacuee_sectors es
        INNER JOIN deduplicated_summary_evacuees dse ON dse.id = es.evacuee_id
        INNER JOIN sectors s ON s.id = es.sector_id
      ) sector_items
      GROUP BY sector_items.code, sector_items.name, sector_items.sector_group
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
        COALESCE(SUM(fh.household_size), 0)::int AS value
      FROM deduplicated_summary_households fh
      GROUP BY 1
      ORDER BY value DESC, name ASC
    ),
    summary AS (
      SELECT
        (
          SELECT COALESCE(SUM(dsh.household_size), 0)::int
          FROM deduplicated_summary_households dsh
        )
          AS total_number_of_evacuees_individuals,
        (
          SELECT COUNT(*)::int
          FROM deduplicated_summary_households dsh
        )
          AS total_number_of_families,
        COALESCE(
          (
            SELECT ROUND(AVG(dsh.household_size)::numeric, 1)
            FROM deduplicated_summary_households dsh
          ),
          0
        ) AS average_household_size,
        (
          SELECT COUNT(*)::int
          FROM deduplicated_summary_evacuees dse
          WHERE dse.current_stay_type = 'EVAC_CENTER'
            AND dse.status = 'PRESENT'
            AND dse.time_out IS NULL
        ) AS currently_admitted_evacuees,
        (
          SELECT COUNT(*)::int
          FROM deduplicated_summary_evacuees dse
          WHERE dse.current_stay_type = 'EVAC_CENTER'
            AND dse.status = 'LEFT'
            AND dse.time_out IS NOT NULL
        ) AS total_departed_evacuees,
        (
          SELECT COUNT(DISTINCT deb.barangay_id)::int
          FROM disaster_event_barangays deb
          WHERE deb.disaster_event_id = $1
            AND ($2::uuid IS NULL OR deb.barangay_id = $2)
        ) AS total_barangays_covered
    ),
    per_barangay_households AS (
      SELECT
        b.id AS barangay_id,
        b.name AS barangay_name,
        COUNT(*)::int AS families_count,
        COALESCE(SUM(dsh.household_size), 0)::int AS evacuees_count
      FROM deduplicated_summary_households dsh
      INNER JOIN barangays b ON b.id = dsh.barangay_id
      GROUP BY b.id, b.name
    ),
    per_barangay_evacuation AS (
      SELECT
        dsh.barangay_id,
        COUNT(*) FILTER (
          WHERE dse.current_stay_type = 'EVAC_CENTER'
            AND dse.status = 'PRESENT'
            AND dse.time_out IS NULL
        )::int AS admitted_evacuees_count,
        COUNT(*) FILTER (
          WHERE dse.current_stay_type = 'EVAC_CENTER'
            AND dse.status = 'LEFT'
            AND dse.time_out IS NOT NULL
        )::int AS departed_evacuees_count
      FROM deduplicated_summary_households dsh
      LEFT JOIN deduplicated_summary_evacuees dse
        ON dse.household_key = dsh.household_key
      GROUP BY dsh.barangay_id
    ),
    per_barangay AS (
      SELECT
        pbh.barangay_id,
        pbh.barangay_name,
        pbh.families_count,
        pbh.evacuees_count,
        COALESCE(pbe.admitted_evacuees_count, 0)::int AS admitted_evacuees_count,
        COALESCE(pbe.departed_evacuees_count, 0)::int AS departed_evacuees_count
      FROM per_barangay_households pbh
      LEFT JOIN per_barangay_evacuation pbe
        ON pbe.barangay_id = pbh.barangay_id
      ORDER BY pbh.barangay_name ASC
    ),
    evacuation_center_distribution AS (
      SELECT
        ec.id AS evacuation_center_id,
        ec.name AS evacuation_center_name,
        COUNT(*)::int AS value
      FROM deduplicated_summary_evacuees dse
      INNER JOIN evacuation_centers ec ON ec.id = dse.evacuation_center_id
      WHERE dse.current_stay_type = 'EVAC_CENTER'
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
        DATE(dse.time_in) AS admission_date,
        COUNT(*)::int AS value
      FROM deduplicated_summary_evacuees dse
      WHERE dse.time_in IS NOT NULL
      GROUP BY DATE(dse.time_in)
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
              'code', sd.code,
              'name', sd.name,
              'sector_group', sd.sector_group,
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
  let recordStatusFilterClause = "";

  if (barangayId) {
    values.push(barangayId);
    barangayFilterClause = "AND h.barangay_id = $2";
  }

  if (recordStatus === "active") {
    recordStatusFilterClause = `
      WHERE (
        records.is_active = TRUE
        AND records.attendance_log_id IS NOT NULL
        AND records.attendance_time_out IS NULL
        AND UPPER(COALESCE(records.attendance_status, '')) = 'PRESENT'
      )
    `;
  } else if (recordStatus === "archived") {
    recordStatusFilterClause = `
      WHERE (
        records.attendance_log_id IS NOT NULL
        AND (
          records.attendance_time_out IS NOT NULL
          OR UPPER(COALESCE(records.attendance_status, '')) = 'LEFT'
        )
      ) OR (
        records.attendance_log_id IS NULL
        AND records.is_active = FALSE
      )
    `;
  }

  const query = `
    WITH household_scope AS (
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
    ),
    family_head_evacuees AS (
      SELECT
        hs.household_id,
        COALESCE(
          hs.family_head_evacuee_id,
          (
            SELECT e.id
            FROM evacuees e
            WHERE e.household_id = hs.household_id
              AND e.is_family_head = TRUE
            ORDER BY e.created_at ASC
            LIMIT 1
          )
        ) AS family_head_evacuee_id
      FROM household_scope hs
    ),
    attendance_occurrences AS (
      SELECT
        hs.household_id,
        el.id AS attendance_log_id,
        el.status AS attendance_status,
        el.time_in AS attendance_time_in,
        el.time_out AS attendance_time_out,
        el.evacuation_center_id AS attendance_evacuation_center_id,
        el.created_at AS attendance_created_at,
        el.updated_at AS attendance_updated_at
      FROM household_scope hs
      INNER JOIN family_head_evacuees fhe
        ON fhe.household_id = hs.household_id
      INNER JOIN evacuation_logs el
        ON el.household_id = hs.household_id
        AND el.disaster_event_id = $1
        AND el.evacuee_id = fhe.family_head_evacuee_id
    ),
    records AS (
      SELECT
        hs.household_id,
        hs.disaster_event_id,
        hs.barangay_id,
        hs.residency_status,
        hs.family_head_first_name,
        hs.family_head_middle_name,
        hs.family_head_last_name,
        hs.family_head_suffix,
        hs.household_size,
        hs.current_stay_type,
        hs.current_address_details,
        hs.contact_number,
        hs.is_active,
        hs.registered_at,
        hs.family_head_evacuee_id,
        hs.barangay_code,
        hs.barangay_name,
        hs.municipality_name,
        hs.province_name,
        ao.attendance_log_id,
        ao.attendance_status,
        ao.attendance_time_in,
        ao.attendance_time_out,
        ao.attendance_evacuation_center_id,
        ao.attendance_created_at,
        ao.attendance_updated_at,
        COALESCE(ao.attendance_log_id::text, hs.household_id::text) AS masterlist_record_id
      FROM household_scope hs
      LEFT JOIN attendance_occurrences ao
        ON ao.household_id = hs.household_id
    )
    SELECT
      records.household_id,
      records.disaster_event_id,
      records.barangay_id,
      records.residency_status,
      records.family_head_first_name,
      records.family_head_middle_name,
      records.family_head_last_name,
      records.family_head_suffix,
      records.household_size,
      records.current_stay_type,
      records.current_address_details,
      records.contact_number,
      records.is_active,
      records.registered_at,
      records.family_head_evacuee_id,
      records.barangay_code,
      records.barangay_name,
      records.municipality_name,
      records.province_name,
      records.attendance_log_id,
      records.attendance_status,
      records.attendance_time_in,
      records.attendance_time_out,
      records.attendance_evacuation_center_id,
      records.masterlist_record_id
    FROM records
    ${recordStatusFilterClause}
    ORDER BY
      COALESCE(
        records.attendance_time_out,
        records.attendance_time_in,
        records.registered_at
      ) DESC,
      records.family_head_last_name ASC,
      records.family_head_first_name ASC
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
    SELECT DISTINCT ON (el.household_id)
      el.household_id,
      el.status,
      el.time_in,
      el.time_out,
      el.evacuation_center_id
    FROM evacuation_logs el
    WHERE el.household_id = ANY($1::uuid[])
    ORDER BY
      el.household_id,
      COALESCE(el.time_out, el.time_in) DESC,
      el.updated_at DESC,
      el.created_at DESC
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
