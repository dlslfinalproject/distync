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
    updated_at,
    COALESCE((
      SELECT COUNT(DISTINCT h.id)::int
      FROM stubs s
      INNER JOIN households h ON h.id = s.household_id
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
      WHERE s.disaster_event_id = disaster_events.id
        AND s.status = 'ISSUED'
        AND h.current_stay_type = 'EVAC_CENTER'
        AND h.is_active = TRUE
        AND latest_attendance.status = 'PRESENT'
        AND latest_attendance.time_out IS NULL
    ), 0)::int AS eligible_unclaimed_households_count
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

const getDisasterEventsByBarangayId = async (barangayId) => {
  const query = `
    ${selectDisasterEventColumns}
    WHERE status = ANY($1::TEXT[])
      AND EXISTS (
        SELECT 1
        FROM disaster_event_barangays deb
        WHERE deb.disaster_event_id = disaster_events.id
          AND deb.barangay_id = $2
      )
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query, [
    ["ACTIVE", "CLOSED", "ARCHIVED"],
    barangayId,
  ]);
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

const findConflictingOpenDisasterEventByTitle = async ({
  title,
  excludeId = null,
  dbClient = pool,
}) => {
  const query = `
    ${selectDisasterEventColumns}
    WHERE LOWER(REGEXP_REPLACE(TRIM(title), '\s+', ' ', 'g')) =
      LOWER(REGEXP_REPLACE(TRIM($1), '\s+', ' ', 'g'))
      AND status = ANY($2::TEXT[])
      AND ($3::UUID IS NULL OR id <> $3::UUID)
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const result = await dbClient.query(query, [
    title,
    ["PLANNED", "ACTIVE"],
    excludeId,
  ]);

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

const getHouseholdCountsByDisasterEventBarangayIds = async (
  disasterEventId,
  barangayIds,
  dbClient = pool,
) => {
  if (!Array.isArray(barangayIds) || barangayIds.length === 0) {
    return [];
  }

  const query = `
    SELECT
      h.barangay_id,
      COUNT(*)::INTEGER AS household_count
    FROM households h
    WHERE h.disaster_event_id = $1
      AND h.barangay_id = ANY($2::UUID[])
    GROUP BY h.barangay_id
  `;

  const result = await dbClient.query(query, [disasterEventId, barangayIds]);
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

const listActiveDisasterEventsForEvacuationSummary = async (dbClient = pool) => {
  const query = `
    SELECT
      id,
      event_code,
      title,
      status
    FROM disaster_events
    WHERE status = 'ACTIVE'
    ORDER BY created_at DESC
  `;

  const result = await dbClient.query(query);
  return result.rows;
};

const getEvacuationSummaryForWindow = async (
  { disasterEventId, windowStart, windowEnd },
  dbClient = pool,
) => {
  if (!disasterEventId || !windowStart || !windowEnd) {
    return null;
  }

  const disasterEventResult = await dbClient.query(
    `
      SELECT
        id,
        event_code,
        title,
        status
      FROM disaster_events
      WHERE id = $1
      LIMIT 1
    `,
    [disasterEventId],
  );

  const disasterEvent = disasterEventResult.rows[0] || null;

  if (!disasterEvent) {
    return null;
  }

  const [totalsResult, barangaysResult] = await Promise.all([
    dbClient.query(
      `
        WITH new_households AS (
          SELECT COUNT(DISTINCT h.id)::int AS count
          FROM households h
          WHERE h.disaster_event_id = $1
            AND h.is_active = TRUE
            AND h.registered_at >= $2::timestamptz
            AND h.registered_at < $3::timestamptz
        ),
        cumulative_households AS (
          SELECT COUNT(DISTINCT h.id)::int AS count
          FROM households h
          WHERE h.disaster_event_id = $1
            AND h.is_active = TRUE
        ),
        new_evacuees AS (
          SELECT COUNT(DISTINCT e.id)::int AS count
          FROM evacuees e
          INNER JOIN households h ON h.id = e.household_id
          WHERE h.disaster_event_id = $1
            AND h.is_active = TRUE
            AND e.is_active = TRUE
            AND e.created_at >= $2::timestamptz
            AND e.created_at < $3::timestamptz
        ),
        cumulative_evacuees AS (
          SELECT COUNT(DISTINCT e.id)::int AS count
          FROM evacuees e
          INNER JOIN households h ON h.id = e.household_id
          WHERE h.disaster_event_id = $1
            AND h.is_active = TRUE
            AND e.is_active = TRUE
        ),
        latest_logs AS (
          SELECT DISTINCT ON (el.evacuee_id)
            el.evacuee_id,
            el.status,
            el.time_out
          FROM evacuation_logs el
          INNER JOIN households h ON h.id = el.household_id
          WHERE el.disaster_event_id = $1
          ORDER BY
            el.evacuee_id,
            COALESCE(el.time_out, el.time_in) DESC,
            el.updated_at DESC,
            el.created_at DESC,
            el.id DESC
        ),
        current_attendance AS (
          SELECT
            COUNT(*) FILTER (
              WHERE latest_logs.status = 'PRESENT'
                AND latest_logs.time_out IS NULL
            )::int AS present_evacuees,
            COUNT(*) FILTER (
              WHERE latest_logs.status IN ('LEFT', 'TRANSFERRED')
                OR latest_logs.time_out IS NOT NULL
            )::int AS departed_evacuees
          FROM latest_logs
        ),
        attendance_activity AS (
          SELECT
            COUNT(DISTINCT el.evacuee_id) FILTER (
              WHERE el.time_in >= $2::timestamptz
                AND el.time_in < $3::timestamptz
            )::int AS arrival_count,
            COUNT(DISTINCT el.evacuee_id) FILTER (
              WHERE el.time_out >= $2::timestamptz
                AND el.time_out < $3::timestamptz
            )::int AS departure_count
          FROM evacuation_logs el
          INNER JOIN households h ON h.id = el.household_id
          WHERE el.disaster_event_id = $1
        )
        SELECT
          COALESCE(new_households.count, 0) AS new_households,
          COALESCE(cumulative_households.count, 0) AS cumulative_households,
          COALESCE(new_evacuees.count, 0) AS new_evacuees,
          COALESCE(cumulative_evacuees.count, 0) AS cumulative_evacuees,
          COALESCE(current_attendance.present_evacuees, 0) AS present_evacuees,
          COALESCE(current_attendance.departed_evacuees, 0) AS departed_evacuees,
          COALESCE(attendance_activity.arrival_count, 0) AS arrival_count,
          COALESCE(attendance_activity.departure_count, 0) AS departure_count
        FROM new_households
        CROSS JOIN cumulative_households
        CROSS JOIN new_evacuees
        CROSS JOIN cumulative_evacuees
        CROSS JOIN current_attendance
        CROSS JOIN attendance_activity
      `,
      [disasterEventId, windowStart, windowEnd],
    ),
    dbClient.query(
      `
        WITH active_barangays AS (
          SELECT
            b.id,
            b.name
          FROM disaster_event_barangays deb
          INNER JOIN barangays b ON b.id = deb.barangay_id
          WHERE deb.disaster_event_id = $1
        ),
        new_households_by_barangay AS (
          SELECT
            h.barangay_id,
            COUNT(DISTINCT h.id)::int AS new_households
          FROM households h
          WHERE h.disaster_event_id = $1
            AND h.is_active = TRUE
            AND h.registered_at >= $2::timestamptz
            AND h.registered_at < $3::timestamptz
          GROUP BY h.barangay_id
        ),
        cumulative_households_by_barangay AS (
          SELECT
            h.barangay_id,
            COUNT(DISTINCT h.id)::int AS cumulative_households
          FROM households h
          WHERE h.disaster_event_id = $1
            AND h.is_active = TRUE
          GROUP BY h.barangay_id
        ),
        new_evacuees_by_barangay AS (
          SELECT
            h.barangay_id,
            COUNT(DISTINCT e.id)::int AS new_evacuees
          FROM evacuees e
          INNER JOIN households h ON h.id = e.household_id
          WHERE h.disaster_event_id = $1
            AND h.is_active = TRUE
            AND e.is_active = TRUE
            AND e.created_at >= $2::timestamptz
            AND e.created_at < $3::timestamptz
          GROUP BY h.barangay_id
        ),
        cumulative_evacuees_by_barangay AS (
          SELECT
            h.barangay_id,
            COUNT(DISTINCT e.id)::int AS cumulative_evacuees
          FROM evacuees e
          INNER JOIN households h ON h.id = e.household_id
          WHERE h.disaster_event_id = $1
            AND h.is_active = TRUE
            AND e.is_active = TRUE
          GROUP BY h.barangay_id
        ),
        latest_logs AS (
          SELECT DISTINCT ON (el.evacuee_id)
            el.evacuee_id,
            h.barangay_id,
            el.status,
            el.time_out
          FROM evacuation_logs el
          INNER JOIN households h ON h.id = el.household_id
          WHERE el.disaster_event_id = $1
          ORDER BY
            el.evacuee_id,
            COALESCE(el.time_out, el.time_in) DESC,
            el.updated_at DESC,
            el.created_at DESC,
            el.id DESC
        ),
        present_by_barangay AS (
          SELECT
            latest_logs.barangay_id,
            COUNT(*) FILTER (
              WHERE latest_logs.status = 'PRESENT'
                AND latest_logs.time_out IS NULL
            )::int AS present_evacuees
          FROM latest_logs
          GROUP BY latest_logs.barangay_id
        )
        SELECT
          active_barangays.id AS barangay_id,
          active_barangays.name AS barangay_name,
          COALESCE(new_households_by_barangay.new_households, 0) AS new_households,
          COALESCE(cumulative_households_by_barangay.cumulative_households, 0) AS cumulative_households,
          COALESCE(new_evacuees_by_barangay.new_evacuees, 0) AS new_evacuees,
          COALESCE(cumulative_evacuees_by_barangay.cumulative_evacuees, 0) AS cumulative_evacuees,
          COALESCE(present_by_barangay.present_evacuees, 0) AS present_evacuees
        FROM active_barangays
        LEFT JOIN new_households_by_barangay
          ON new_households_by_barangay.barangay_id = active_barangays.id
        LEFT JOIN cumulative_households_by_barangay
          ON cumulative_households_by_barangay.barangay_id = active_barangays.id
        LEFT JOIN new_evacuees_by_barangay
          ON new_evacuees_by_barangay.barangay_id = active_barangays.id
        LEFT JOIN cumulative_evacuees_by_barangay
          ON cumulative_evacuees_by_barangay.barangay_id = active_barangays.id
        LEFT JOIN present_by_barangay
          ON present_by_barangay.barangay_id = active_barangays.id
        WHERE
          COALESCE(new_households_by_barangay.new_households, 0) > 0
          OR COALESCE(cumulative_households_by_barangay.cumulative_households, 0) > 0
          OR COALESCE(new_evacuees_by_barangay.new_evacuees, 0) > 0
          OR COALESCE(cumulative_evacuees_by_barangay.cumulative_evacuees, 0) > 0
          OR COALESCE(present_by_barangay.present_evacuees, 0) > 0
        ORDER BY active_barangays.name ASC
      `,
      [disasterEventId, windowStart, windowEnd],
    ),
  ]);

  const totalsRow = totalsResult.rows[0] || {};

  return {
    disasterEvent: {
      id: disasterEvent.id,
      eventCode: disasterEvent.event_code,
      title: disasterEvent.title,
      status: disasterEvent.status,
    },
    window: {
      start: windowStart,
      end: windowEnd,
    },
    totals: {
      newHouseholds: Number(totalsRow.new_households || 0),
      cumulativeHouseholds: Number(totalsRow.cumulative_households || 0),
      newEvacuees: Number(totalsRow.new_evacuees || 0),
      cumulativeEvacuees: Number(totalsRow.cumulative_evacuees || 0),
      presentEvacuees: Number(totalsRow.present_evacuees || 0),
      departedEvacuees: Number(totalsRow.departed_evacuees || 0),
    },
    attendanceActivity: {
      arrivals: Number(totalsRow.arrival_count || 0),
      departures: Number(totalsRow.departure_count || 0),
    },
    barangays: barangaysResult.rows.map((row) => ({
      barangayId: row.barangay_id,
      barangayName: row.barangay_name,
      newHouseholds: Number(row.new_households || 0),
      cumulativeHouseholds: Number(row.cumulative_households || 0),
      newEvacuees: Number(row.new_evacuees || 0),
      cumulativeEvacuees: Number(row.cumulative_evacuees || 0),
      presentEvacuees: Number(row.present_evacuees || 0),
    })),
  };
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

const generateDisasterEventCode = async (startDate, dbClient) => {
  const eventYear = startDate
    ? new Date(startDate).getUTCFullYear()
    : new Date().getUTCFullYear();

  const query = `
    WITH existing_max AS (
      SELECT COALESCE(
        MAX(
          CAST(
            SUBSTRING(event_code FROM '^DE-\\d{4}-(\\d{4})$') AS INTEGER
          )
        ),
        0
      ) AS last_number
      FROM disaster_events
      WHERE event_code ~ ('^DE-' || $1::TEXT || '-\\d{4}$')
    ),
    upserted AS (
      INSERT INTO disaster_event_code_counters (
        event_year,
        last_number,
        updated_at
      )
      SELECT
        $1::INTEGER,
        GREATEST(1, (SELECT last_number FROM existing_max) + 1),
        NOW()
      ON CONFLICT (event_year) DO UPDATE
        SET
          last_number = GREATEST(
            disaster_event_code_counters.last_number,
            (SELECT last_number FROM existing_max)
          ) + 1,
          updated_at = NOW()
      RETURNING last_number
    )
    SELECT last_number
    FROM upserted
  `;

  const result = await dbClient.query(query, [eventYear]);
  const nextNumber = result.rows[0]?.last_number;

  return `DE-${eventYear}-${String(nextNumber || 0).padStart(4, "0")}`;
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

const closeDisasterEventIfActive = async (
  { id, endDate, endedAt },
  dbClient = pool,
) => {
  const query = `
    UPDATE disaster_events
    SET
      end_date = $2,
      ended_at = $3,
      status = 'CLOSED',
      updated_at = NOW()
    WHERE id = $1
      AND status = 'ACTIVE'
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

  const result = await dbClient.query(query, [id, endDate, endedAt]);
  return result.rows[0] || null;
};

const getDisasterEventReportSummary = async ({
  disasterEventId = null,
  barangayId = null,
  statuses = null,
  status = null,
  dateFrom = null,
  dateTo = null,
  sortOrder = "newest",
  limit = 100,
}) => {
  const values = [];
  const conditions = [];
  const orderClauses = {
    newest: "ORDER BY de.start_date DESC NULLS LAST, de.created_at DESC",
    oldest: "ORDER BY de.start_date ASC NULLS LAST, de.created_at ASC",
    az: "ORDER BY LOWER(de.title) ASC, de.start_date DESC NULLS LAST",
    za: "ORDER BY LOWER(de.title) DESC, de.start_date DESC NULLS LAST",
  };
  const orderClause = orderClauses[sortOrder] || orderClauses.newest;

  if (disasterEventId) {
    values.push(disasterEventId);
    conditions.push(`de.id = $${values.length}`);
  }

  if (Array.isArray(statuses) && statuses.length > 0) {
    values.push(statuses);
    conditions.push(`de.status = ANY($${values.length}::TEXT[])`);
  } else if (status) {
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
      FROM (
        SELECT DISTINCT ON (scoped_households.household_key)
          scoped_households.household_key
        FROM (
          SELECT
            h.registered_at,
            h.updated_at,
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
          WHERE h.disaster_event_id = de.id
          ${barangayScopedHouseholds}
        ) scoped_households
        ORDER BY
          scoped_households.household_key,
          COALESCE(scoped_households.updated_at, scoped_households.registered_at) DESC,
          scoped_households.registered_at DESC
      ) latest_households
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
    ${orderClause}
    LIMIT $${limitIndex}
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getDisasterEventReportBarangayBreakdown = async ({
  disasterEventId = null,
  barangayId = null,
  statuses = null,
  status = null,
  dateFrom = null,
  dateTo = null,
  sortOrder = "newest",
  limit = 1000,
}) => {
  const values = [];
  const conditions = [];
  const orderClauses = {
    newest: "ORDER BY de.start_date DESC NULLS LAST, de.created_at DESC, b.name ASC",
    oldest: "ORDER BY de.start_date ASC NULLS LAST, de.created_at ASC, b.name ASC",
    az: "ORDER BY LOWER(de.title) ASC, b.name ASC",
    za: "ORDER BY LOWER(de.title) DESC, b.name ASC",
  };
  const orderClause = orderClauses[sortOrder] || orderClauses.newest;

  if (disasterEventId) {
    values.push(disasterEventId);
    conditions.push(`de.id = $${values.length}`);
  }

  if (barangayId) {
    values.push(barangayId);
    conditions.push(`deb_row.barangay_id = $${values.length}`);
  }

  if (Array.isArray(statuses) && statuses.length > 0) {
    values.push(statuses);
    conditions.push(`de.status = ANY($${values.length}::TEXT[])`);
  } else if (status) {
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

  values.push(limit);
  const limitIndex = values.length;
  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT
      de.id,
      de.event_code,
      de.title,
      de.disaster_type,
      de.start_date,
      de.end_date,
      de.status,
      b.id AS barangay_id,
      b.name AS barangay_name,
      COALESCE(household_counts.registered_households_count, 0)::int AS registered_households_count,
      COALESCE(distribution_counts.distributed_aid_count, 0)::int AS distributed_aid_count,
      COALESCE(stub_counts.claimed_stubs_count, 0)::int AS claimed_stubs_count,
      COALESCE(stub_counts.unclaimed_stubs_count, 0)::int AS unclaimed_stubs_count,
      COALESCE(distribution_counts.quantity_released_total, 0)::int AS quantity_released_total
    FROM disaster_events de
    INNER JOIN disaster_event_barangays deb_row
      ON deb_row.disaster_event_id = de.id
    INNER JOIN barangays b
      ON b.id = deb_row.barangay_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS registered_households_count
      FROM (
        SELECT DISTINCT ON (scoped_households.household_key)
          scoped_households.household_key
        FROM (
          SELECT
            h.registered_at,
            h.updated_at,
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
          WHERE h.disaster_event_id = de.id
            AND h.barangay_id = deb_row.barangay_id
        ) scoped_households
        ORDER BY
          scoped_households.household_key,
          COALESCE(scoped_households.updated_at, scoped_households.registered_at) DESC,
          scoped_households.registered_at DESC
      ) latest_households
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
            AND hs.barangay_id = deb_row.barangay_id
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
            AND hd.barangay_id = deb_row.barangay_id
        )
    ) distribution_counts ON TRUE
    ${whereClause}
    ${orderClause}
    LIMIT $${limitIndex}
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

module.exports = {
  getAllDisasterEvents,
  getActiveDisasterEvents,
  getClosedDisasterEvents,
  getDisasterEventsByBarangayId,
  getDisasterEventById,
  findConflictingOpenDisasterEventByTitle,
  getLatestHouseholdActivityByDisasterEventId,
  getAffectedBarangaysByDisasterEventId,
  getHouseholdCountsByDisasterEventBarangayIds,
  getAffectedBarangaysByDisasterEventIds,
  listActiveDisasterEventsForEvacuationSummary,
  getEvacuationSummaryForWindow,
  getValidBarangayCount,
  insertDisasterEvent,
  generateDisasterEventCode,
  insertDisasterEventBarangays,
  deleteDisasterEventBarangaysByDisasterEventId,
  updateDisasterEventById,
  closeDisasterEventIfActive,
  getDisasterEventReportSummary,
  getDisasterEventReportBarangayBreakdown,
};
