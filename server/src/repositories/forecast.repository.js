const pool = require("../config/db");

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

const getInventoryForecastItems = async (dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT
        ii.id,
        ii.item_code,
        ii.item_name,
        ii.category,
        ii.unit_of_measure,
        ii.reorder_level,
        COALESCE(SUM(ib.quantity_available), 0) AS current_available_stock
      FROM inventory_items ii
      LEFT JOIN inventory_batches ib ON ib.inventory_item_id = ii.id
      WHERE ii.is_active = TRUE
      GROUP BY ii.id, ii.item_code, ii.item_name, ii.category, ii.unit_of_measure, ii.reorder_level
      ORDER BY ii.item_name ASC
    `,
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
        COALESCE(distribution_summary.distribution_transaction_count, 0) AS distribution_transaction_count,
        COALESCE(distribution_summary.total_released_quantity, 0) AS total_released_quantity,
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
          dt.disaster_event_id,
          COUNT(DISTINCT dt.id)::integer AS distribution_transaction_count,
          COALESCE(SUM(dti.quantity_released), 0)::numeric AS total_released_quantity
        FROM distribution_transactions dt
        LEFT JOIN distribution_transaction_items dti
          ON dti.distribution_transaction_id = dt.id
        WHERE dt.disaster_event_id = $1
        GROUP BY dt.disaster_event_id
      ) AS distribution_summary
        ON distribution_summary.disaster_event_id = de.id
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
      WITH household_summary AS (
        SELECT COUNT(*)::numeric AS household_count
        FROM households
        WHERE disaster_event_id = $1
      )
      SELECT
        ii.id AS inventory_item_id,
        ii.item_code,
        ii.item_name,
        ii.category,
        ii.unit_of_measure,
        SUM(rpti.quantity_required)::numeric AS quantity_per_household,
        (SUM(rpti.quantity_required) * household_summary.household_count)::numeric
          AS projected_household_demand
      FROM relief_pack_templates rpt
      INNER JOIN relief_pack_template_items rpti
        ON rpti.template_id = rpt.id
      INNER JOIN inventory_items ii
        ON ii.id = rpti.inventory_item_id
      CROSS JOIN household_summary
      WHERE rpt.is_active = TRUE
        AND rpt.is_additional_pack = FALSE
      GROUP BY
        ii.id,
        ii.item_code,
        ii.item_name,
        ii.category,
        ii.unit_of_measure,
        household_summary.household_count
      ORDER BY projected_household_demand DESC, ii.item_name ASC
    `,
    [disasterEventId],
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
  getLatestForecastRunByDisasterEvent,
  getForecastResultsByRunId,
  getForecastRunById,
  getForecastRunHistory,
  getLatestForecastResultByInventoryItem,
};
