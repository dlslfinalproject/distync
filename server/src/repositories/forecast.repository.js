const pool = require("../config/db");

const STANDARD_DISASTER_TYPES = [
  "Typhoon",
  "Flood",
  "Earthquake",
  "Landslide",
  "Volcanic Eruption",
  "Storm Surge",
  "Drought / El Ni\u00f1o",
  "Tsunami",
  "Fire",
];

const sectorIdsDescriptionPrefix = "__relief_pack_sector_ids__:";

const getDisasterEventById = async (id, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT id, event_code, title, status
      FROM disaster_events
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0] || null;
};

const getInventoryForecastItems = async (
  disasterEventId = null,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      SELECT
        ii.id,
        ii.item_code,
        ii.item_name,
        ii.category,
        ii.unit_of_measure,
        ii.reorder_level,
        COALESCE(SUM(ib.quantity_available), 0) AS current_available_stock,
        COALESCE(
          SUM(
            CASE
              WHEN ib.source_type = 'LGU' THEN ib.quantity_available
              ELSE 0
            END
          ),
          0
        ) AS current_lgu_available_stock,
        COALESCE(
          SUM(
            CASE
              WHEN ib.source_type = 'DONATED' THEN ib.quantity_available
              ELSE 0
            END
          ),
          0
        ) AS current_donated_available_stock
      FROM inventory_items ii
      LEFT JOIN inventory_batches ib
        ON ib.inventory_item_id = ii.id
        AND COALESCE(ib.quantity_available, 0) > 0
        AND ib.status IN ('AVAILABLE', 'LOW_STOCK')
        AND (
          ib.expiration_date IS NULL
          OR ib.expiration_date > (CURRENT_DATE + INTERVAL '30 days')
        )
        AND (
          (
            ib.source_type = 'LGU'
            AND NOT EXISTS (
              SELECT 1
              FROM donation_items relief_pack_donation_items
              WHERE relief_pack_donation_items.inventory_batch_id = ib.id
                AND COALESCE(relief_pack_donation_items.remarks, '') ILIKE 'Relief Pack:%'
            )
          )
          OR (
            ib.source_type = 'DONATED'
            AND EXISTS (
              SELECT 1
              FROM donation_items di
              INNER JOIN donations d ON d.id = di.donation_id
              WHERE di.inventory_batch_id = ib.id
                AND d.disaster_event_id = $1
                AND d.status <> 'CANCELLED'
            )
          )
        )
      WHERE ii.is_active = TRUE
      GROUP BY ii.id, ii.item_code, ii.item_name, ii.category, ii.unit_of_measure, ii.reorder_level
      ORDER BY ii.item_name ASC
    `,
    [disasterEventId],
  );

  return result.rows;
};

const getInventoryUsageSeries = async (
  disasterEventId,
  lookbackDays,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      SELECT
        ii.id AS inventory_item_id,
        DATE(it.performed_at) AS usage_date,
        SUM(it.quantity)::numeric AS total_quantity
      FROM inventory_transactions it
      INNER JOIN inventory_batches ib ON ib.id = it.inventory_batch_id
      INNER JOIN inventory_items ii ON ii.id = ib.inventory_item_id
      WHERE it.disaster_event_id = $1
        AND it.transaction_type = 'OUTFLOW'
        AND it.reference_type = 'DISTRIBUTION'
        AND DATE(it.performed_at) >= CURRENT_DATE - ($2::integer - 1)
      GROUP BY ii.id, DATE(it.performed_at)
      ORDER BY ii.id ASC, usage_date ASC
    `,
    [disasterEventId, lookbackDays],
  );

  return result.rows;
};

const getForecastEventContext = async (disasterEventId, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT
        de.id,
        de.event_code,
        de.title,
        de.status,
        de.start_date,
        de.end_date,
        de.ended_at,
        COALESCE(household_summary.household_count, 0) AS household_count,
        COALESCE(evacuee_summary.evacuee_count, 0) AS evacuee_count,
        COALESCE(attendance_summary.attendance_record_count, 0) AS attendance_record_count,
        COALESCE(attendance_summary.present_evacuee_count, 0) AS present_evacuee_count,
        COALESCE(eligibility_summary.eligible_household_count, 0) AS eligible_household_count,
        COALESCE(eligibility_summary.eligible_evacuee_count, 0) AS eligible_evacuee_count,
        COALESCE(eligibility_summary.claimed_household_count, 0) AS claimed_household_count,
        COALESCE(eligibility_summary.unclaimed_eligible_household_count, 0) AS unclaimed_eligible_household_count,
        COALESCE(distribution_summary.distribution_transaction_count, 0) AS distribution_transaction_count,
        COALESCE(distribution_summary.total_released_quantity, 0) AS total_released_quantity,
        COALESCE(inventory_summary.active_inventory_item_count, 0) AS active_inventory_item_count,
        COALESCE(template_summary.active_standard_pack_count, 0) AS active_standard_pack_count
      FROM disaster_events de
      LEFT JOIN (
        SELECT
          disaster_event_id,
          COUNT(*)::integer AS household_count
        FROM households
        WHERE disaster_event_id = $1
        GROUP BY disaster_event_id
      ) AS household_summary
        ON household_summary.disaster_event_id = de.id
      LEFT JOIN (
        SELECT
          h.disaster_event_id,
          COUNT(e.id)::integer AS evacuee_count
        FROM households h
        INNER JOIN evacuees e ON e.household_id = h.id
        WHERE h.disaster_event_id = $1
        GROUP BY h.disaster_event_id
      ) AS evacuee_summary
        ON evacuee_summary.disaster_event_id = de.id
      LEFT JOIN (
        SELECT
          el.disaster_event_id,
          COUNT(*)::integer AS attendance_record_count,
          COUNT(DISTINCT CASE
            WHEN el.status = 'PRESENT' AND el.time_out IS NULL THEN el.evacuee_id
            ELSE NULL
          END)::integer AS present_evacuee_count
        FROM evacuation_logs el
        WHERE el.disaster_event_id = $1
        GROUP BY el.disaster_event_id
      ) AS attendance_summary
        ON attendance_summary.disaster_event_id = de.id
      LEFT JOIN (
        SELECT
          h.disaster_event_id,
          COUNT(DISTINCT h.id)::integer AS eligible_household_count,
          COUNT(DISTINCT e.id)::integer AS eligible_evacuee_count,
          COUNT(DISTINCT CASE WHEN s.status = 'CLAIMED' THEN h.id END)::integer
            AS claimed_household_count,
          COUNT(DISTINCT CASE WHEN s.status = 'ISSUED' THEN h.id END)::integer
            AS unclaimed_eligible_household_count
        FROM households h
        INNER JOIN stubs s
          ON s.household_id = h.id
          AND s.disaster_event_id = h.disaster_event_id
        INNER JOIN LATERAL (
          SELECT el.status, el.time_in, el.time_out
          FROM evacuation_logs el
          WHERE el.household_id = h.id
            AND el.disaster_event_id = h.disaster_event_id
          ORDER BY
            COALESCE(el.time_out, el.time_in) DESC,
            el.updated_at DESC,
            el.created_at DESC
          LIMIT 1
        ) latest_attendance ON TRUE
        LEFT JOIN evacuees e
          ON e.household_id = h.id
          AND e.is_active = TRUE
        WHERE h.disaster_event_id = $1
          AND h.is_active = TRUE
          AND h.current_stay_type = 'EVAC_CENTER'
          AND s.status IN ('ISSUED', 'CLAIMED')
          AND latest_attendance.status = 'PRESENT'
          AND latest_attendance.time_out IS NULL
        GROUP BY h.disaster_event_id
      ) AS eligibility_summary
        ON eligibility_summary.disaster_event_id = de.id
      LEFT JOIN (
        SELECT
          dt.disaster_event_id,
          COUNT(DISTINCT dt.id)::integer AS distribution_transaction_count,
          COALESCE(SUM(dti.quantity_released), 0)::numeric AS total_released_quantity
        FROM distribution_transactions dt
        LEFT JOIN distribution_transaction_items dti
          ON dti.distribution_transaction_id = dt.id
        WHERE dt.disaster_event_id = $1
          AND dt.distribution_status = 'CLAIMED'
        GROUP BY dt.disaster_event_id
      ) AS distribution_summary
        ON distribution_summary.disaster_event_id = de.id
      LEFT JOIN (
        SELECT COUNT(*)::integer AS active_inventory_item_count
        FROM inventory_items
        WHERE is_active = TRUE
      ) AS inventory_summary
        ON TRUE
      LEFT JOIN (
        SELECT COUNT(*)::integer AS active_standard_pack_count
        FROM relief_pack_templates
        WHERE is_active = TRUE
          AND is_additional_pack = FALSE
      ) AS template_summary
        ON TRUE
      WHERE de.id = $1
      LIMIT 1
    `,
    [disasterEventId],
  );

  return result.rows[0] || null;
};

const getReliefPackDemandByEvent = async (disasterEventId, dbClient = pool) => {
  const result = await dbClient.query(
    `
      WITH disaster_context AS (
        SELECT
          id,
          disaster_type,
          ($2::text[] @> ARRAY[disaster_type]::text[]) AS is_standard_disaster_type
        FROM disaster_events
        WHERE id = $1
      ),
      eligible_households AS (
        SELECT
          h.id,
          h.household_size,
          h.disaster_event_id
        FROM households h
        INNER JOIN stubs s
          ON s.household_id = h.id
          AND s.disaster_event_id = h.disaster_event_id
        INNER JOIN LATERAL (
          SELECT el.status, el.time_in, el.time_out
          FROM evacuation_logs el
          WHERE el.household_id = h.id
            AND el.disaster_event_id = h.disaster_event_id
          ORDER BY
            COALESCE(el.time_out, el.time_in) DESC,
            el.updated_at DESC,
            el.created_at DESC
          LIMIT 1
        ) latest_attendance ON TRUE
        WHERE h.disaster_event_id = $1
          AND h.is_active = TRUE
          AND h.current_stay_type = 'EVAC_CENTER'
          AND s.status = 'ISSUED'
          AND latest_attendance.status = 'PRESENT'
          AND latest_attendance.time_out IS NULL
      ),
      household_sector_ids AS (
        SELECT hs.household_id, hs.sector_id
        FROM household_sectors hs
        INNER JOIN eligible_households eh ON eh.id = hs.household_id
        UNION
        SELECT e.household_id, es.sector_id
        FROM evacuees e
        INNER JOIN evacuee_sectors es ON es.evacuee_id = e.id
        INNER JOIN eligible_households eh ON eh.id = e.household_id
        WHERE e.is_active = TRUE
      ),
      assigned_templates AS (
        SELECT
          eh.id AS household_id,
          eh.household_size,
          rpt.id AS template_id,
          CASE
            WHEN rpt.based_on_family_size = TRUE
              AND family_size_coverage.coverage > 0
              THEN GREATEST(
                1,
                CEIL(eh.household_size::numeric / family_size_coverage.coverage)
              )
            ELSE 1
          END AS pack_multiplier
        FROM eligible_households eh
        CROSS JOIN disaster_context dc
        INNER JOIN relief_pack_templates rpt
          ON rpt.is_active = TRUE
          AND (
            rpt.applies_to_all_disasters = TRUE
            OR EXISTS (
              SELECT 1
              FROM relief_pack_template_disaster_types rptdt
              WHERE rptdt.template_id = rpt.id
                AND (
                  rptdt.disaster_type = dc.disaster_type
                  OR (
                    dc.is_standard_disaster_type = FALSE
                    AND rptdt.disaster_type = 'Other'
                  )
                )
            )
          )
        CROSS JOIN LATERAL (
          SELECT COALESCE(
            NULLIF(SUBSTRING(TRIM(COALESCE(rpt.description, '')) FROM '^[0-9]+'), '')::integer,
            0
          ) AS coverage
        ) family_size_coverage
        WHERE (
          rpt.is_additional_pack = FALSE
          OR EXISTS (
            SELECT 1
            FROM household_sector_ids hsi
            WHERE hsi.household_id = eh.id
              AND (
                hsi.sector_id = rpt.sector_id
                OR (
                  rpt.description LIKE ($3 || '%')
                  AND POSITION(('"' || hsi.sector_id::text || '"') IN rpt.description) > 0
                )
              )
          )
        )
      ),
      item_demand AS (
        SELECT
          rpti.inventory_item_id,
          SUM(rpti.quantity_required * assigned_templates.pack_multiplier)::numeric
            AS projected_household_demand,
          COUNT(DISTINCT assigned_templates.household_id)::numeric
            AS assigned_household_count
        FROM assigned_templates
        INNER JOIN relief_pack_template_items rpti
          ON rpti.template_id = assigned_templates.template_id
        GROUP BY rpti.inventory_item_id
      )
      SELECT
        ii.id AS inventory_item_id,
        ii.item_code,
        ii.item_name,
        ii.category,
        ii.unit_of_measure,
        CASE
          WHEN item_demand.assigned_household_count > 0
            THEN item_demand.projected_household_demand / item_demand.assigned_household_count
          ELSE 0
        END::numeric AS quantity_per_household,
        item_demand.projected_household_demand
      FROM item_demand
      INNER JOIN inventory_items ii
        ON ii.id = item_demand.inventory_item_id
      ORDER BY projected_household_demand DESC, ii.item_name ASC
    `,
    [disasterEventId, STANDARD_DISASTER_TYPES, sectorIdsDescriptionPrefix],
  );

  return result.rows;
};

const getInventoryUsageTrend = async (
  disasterEventId,
  lookbackDays,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      WITH date_series AS (
        SELECT generate_series(
          CURRENT_DATE - ($2::integer - 1),
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS usage_date
      )
      SELECT
        date_series.usage_date,
        COALESCE(SUM(it.quantity), 0)::numeric AS total_quantity
      FROM date_series
      LEFT JOIN inventory_transactions it
        ON DATE(it.performed_at) = date_series.usage_date
       AND it.disaster_event_id = $1
       AND it.transaction_type = 'OUTFLOW'
       AND it.reference_type = 'DISTRIBUTION'
      GROUP BY date_series.usage_date
      ORDER BY date_series.usage_date ASC
    `,
    [disasterEventId, lookbackDays],
  );

  return result.rows;
};

const insertForecastRun = async (payload, dbClient = pool) => {
  const result = await dbClient.query(
    `
      INSERT INTO forecast_runs (
        disaster_event_id,
        run_type,
        run_by,
        run_at,
        model_name,
        parameters_json
      )
      VALUES ($1, $2, $3, NOW(), $4, $5)
      RETURNING id, disaster_event_id, run_type, run_by, run_at, model_name, parameters_json
    `,
    [
      payload.disaster_event_id,
      payload.run_type,
      payload.run_by,
      payload.model_name,
      payload.parameters_json,
    ],
  );

  return result.rows[0] || null;
};

const insertForecastResult = async (payload, dbClient = pool) => {
  const result = await dbClient.query(
    `
      INSERT INTO forecast_results (
        forecast_run_id,
        inventory_item_id,
        predicted_quantity_needed,
        predicted_depletion_date,
        recommended_reorder_quantity,
        confidence_notes,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id
    `,
    [
      payload.forecast_run_id,
      payload.inventory_item_id,
      payload.predicted_quantity_needed,
      payload.predicted_depletion_date,
      payload.recommended_reorder_quantity,
      payload.confidence_notes,
    ],
  );

  return result.rows[0] || null;
};

const getLatestForecastRunByDisasterEvent = async (
  disasterEventId,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      SELECT
        fr.id,
        fr.disaster_event_id,
        fr.run_type,
        fr.run_by,
        fr.run_at,
        fr.model_name,
        fr.parameters_json,
        de.event_code,
        de.title AS disaster_event_title
      FROM forecast_runs fr
      INNER JOIN disaster_events de ON de.id = fr.disaster_event_id
      WHERE fr.disaster_event_id = $1
      ORDER BY fr.run_at DESC, fr.id DESC
      LIMIT 1
    `,
    [disasterEventId],
  );

  return result.rows[0] || null;
};

const getLatestForecastRun = async (dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT
        fr.id,
        fr.disaster_event_id,
        fr.run_type,
        fr.run_by,
        fr.run_at,
        fr.model_name,
        fr.parameters_json,
        de.event_code,
        de.title AS disaster_event_title
      FROM forecast_runs fr
      INNER JOIN disaster_events de ON de.id = fr.disaster_event_id
      ORDER BY fr.run_at DESC, fr.id DESC
      LIMIT 1
    `,
  );

  return result.rows[0] || null;
};

const getForecastResultsByRunId = async (forecastRunId, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT
        fr.id,
        fr.forecast_run_id,
        fr.inventory_item_id,
        fr.predicted_quantity_needed,
        fr.predicted_depletion_date,
        fr.recommended_reorder_quantity,
        fr.confidence_notes,
        fr.created_at,
        ii.item_code,
        ii.item_name,
        ii.category,
        ii.unit_of_measure
      FROM forecast_results fr
      INNER JOIN inventory_items ii ON ii.id = fr.inventory_item_id
      WHERE fr.forecast_run_id = $1
      ORDER BY ii.item_name ASC
    `,
    [forecastRunId],
  );

  return result.rows;
};

const getForecastRunById = async (forecastRunId, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT
        fr.id,
        fr.disaster_event_id,
        fr.run_type,
        fr.run_by,
        fr.run_at,
        fr.model_name,
        fr.parameters_json,
        de.event_code,
        de.title AS disaster_event_title,
        u.first_name AS run_by_first_name,
        u.last_name AS run_by_last_name,
        u.email AS run_by_email
      FROM forecast_runs fr
      INNER JOIN disaster_events de ON de.id = fr.disaster_event_id
      LEFT JOIN users u ON u.id = fr.run_by
      WHERE fr.id = $1
      LIMIT 1
    `,
    [forecastRunId],
  );

  return result.rows[0] || null;
};

const getForecastRunHistory = async (
  { disasterEventId = null, limit = 10 } = {},
  dbClient = pool,
) => {
  const values = [];
  const conditions = [];

  if (disasterEventId) {
    values.push(disasterEventId);
    conditions.push(`fr.disaster_event_id = $${values.length}`);
  }

  values.push(limit);

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await dbClient.query(
    `
      SELECT
        fr.id,
        fr.disaster_event_id,
        fr.run_type,
        fr.run_by,
        fr.run_at,
        fr.model_name,
        fr.parameters_json,
        de.event_code,
        de.title AS disaster_event_title,
        u.first_name AS run_by_first_name,
        u.last_name AS run_by_last_name,
        u.email AS run_by_email
      FROM forecast_runs fr
      INNER JOIN disaster_events de ON de.id = fr.disaster_event_id
      LEFT JOIN users u ON u.id = fr.run_by
      ${whereClause}
      ORDER BY fr.run_at DESC, fr.id DESC
      LIMIT $${values.length}
    `,
    values,
  );

  return result.rows;
};

const getLatestForecastResultByInventoryItem = async (
  inventoryItemId,
  dbClient = pool,
) => {
  const result = await dbClient.query(
    `
      SELECT
        fr.id,
        fr.forecast_run_id,
        fr.inventory_item_id,
        fr.predicted_quantity_needed,
        fr.predicted_depletion_date,
        fr.recommended_reorder_quantity,
        fr.confidence_notes,
        fr.created_at,
        run.model_name,
        run.run_at,
        run.disaster_event_id,
        de.event_code,
        de.title AS disaster_event_title
      FROM forecast_results fr
      INNER JOIN forecast_runs run ON run.id = fr.forecast_run_id
      INNER JOIN disaster_events de ON de.id = run.disaster_event_id
      WHERE fr.inventory_item_id = $1
      ORDER BY run.run_at DESC, fr.created_at DESC
      LIMIT 1
    `,
    [inventoryItemId],
  );

  return result.rows[0] || null;
};

module.exports = {
  getDisasterEventById,
  getInventoryForecastItems,
  getInventoryUsageSeries,
  getForecastEventContext,
  getReliefPackDemandByEvent,
  getInventoryUsageTrend,
  insertForecastRun,
  insertForecastResult,
  getLatestForecastRun,
  getLatestForecastRunByDisasterEvent,
  getForecastResultsByRunId,
  getForecastRunById,
  getForecastRunHistory,
  getLatestForecastResultByInventoryItem,
};
