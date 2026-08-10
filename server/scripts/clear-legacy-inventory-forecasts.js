const pool = require("../src/config/db");

const shouldApply = process.argv.includes("--apply");

const LEGACY_FORECAST_QUERY = `
  WITH legacy_runs AS (
    SELECT id
    FROM forecast_runs
    WHERE run_type = 'INVENTORY_DEMAND'
      AND (
        parameters_json IS NULL
        OR NOT (
          COALESCE(parameters_json->'event_context', '{}'::jsonb)
            ? 'eligible_household_count'
        )
        OR NOT (
          COALESCE(parameters_json->'event_context', '{}'::jsonb)
            ? 'unclaimed_eligible_household_count'
        )
      )
  )
  SELECT
    (SELECT COUNT(*)::integer FROM legacy_runs) AS legacy_run_count,
    (
      SELECT COUNT(*)::integer
      FROM forecast_results fr
      INNER JOIN legacy_runs lr ON lr.id = fr.forecast_run_id
    ) AS legacy_result_count
`;

const DELETE_LEGACY_FORECAST_QUERY = `
  WITH legacy_runs AS (
    SELECT id
    FROM forecast_runs
    WHERE run_type = 'INVENTORY_DEMAND'
      AND (
        parameters_json IS NULL
        OR NOT (
          COALESCE(parameters_json->'event_context', '{}'::jsonb)
            ? 'eligible_household_count'
        )
        OR NOT (
          COALESCE(parameters_json->'event_context', '{}'::jsonb)
            ? 'unclaimed_eligible_household_count'
        )
      )
  ),
  deleted_results AS (
    DELETE FROM forecast_results fr
    USING legacy_runs lr
    WHERE fr.forecast_run_id = lr.id
    RETURNING fr.id
  ),
  deleted_runs AS (
    DELETE FROM forecast_runs fr
    USING legacy_runs lr
    WHERE fr.id = lr.id
    RETURNING fr.id
  )
  SELECT
    (SELECT COUNT(*)::integer FROM deleted_runs) AS deleted_run_count,
    (SELECT COUNT(*)::integer FROM deleted_results) AS deleted_result_count
`;

const main = async () => {
  const client = await pool.connect();

  try {
    const previewResult = await client.query(LEGACY_FORECAST_QUERY);
    const preview = previewResult.rows[0] || {};

    console.log(
      `Legacy inventory forecast runs: ${preview.legacy_run_count || 0}`,
    );
    console.log(
      `Legacy inventory forecast results: ${preview.legacy_result_count || 0}`,
    );

    if (!shouldApply) {
      console.log("Dry run only. Re-run with --apply to delete these rows.");
      return;
    }

    await client.query("BEGIN");
    const deleteResult = await client.query(DELETE_LEGACY_FORECAST_QUERY);
    await client.query("COMMIT");

    const deleted = deleteResult.rows[0] || {};

    console.log(
      `Deleted legacy inventory forecast runs: ${deleted.deleted_run_count || 0}`,
    );
    console.log(
      `Deleted legacy inventory forecast results: ${deleted.deleted_result_count || 0}`,
    );
  } catch (error) {
    if (shouldApply) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error(error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

main();
