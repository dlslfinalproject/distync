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
        COALESCE(SUM(ib.quantity_available), 0) AS current_available_stock
      FROM inventory_items ii
      LEFT JOIN inventory_batches ib ON ib.inventory_item_id = ii.id
      WHERE ii.is_active = TRUE
      GROUP BY ii.id, ii.item_code, ii.item_name, ii.category, ii.unit_of_measure
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

module.exports = {
  getDisasterEventById,
  getInventoryForecastItems,
  getInventoryUsageSeries,
  insertForecastRun,
  insertForecastResult,
  getLatestForecastRunByDisasterEvent,
  getForecastResultsByRunId,
  getForecastRunById,
  getForecastRunHistory,
};
