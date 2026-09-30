const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const repositoryRoot = path.resolve(__dirname, "../..");
const migrationPath = path.join(
  repositoryRoot,
  "database",
  "migrations",
  "2026-09-30_add_forecast_model_selection_persistence.sql",
);
const migrationSql = fs.readFileSync(migrationPath, "utf8");
const schemaSql = fs.readFileSync(
  path.join(repositoryRoot, "database", "schema", "distync_schema.sql"),
  "utf8",
);

test("forecast persistence migration and schema snapshot define additive legacy-safe fields", () => {
  assert.match(
    migrationSql,
    /ADD COLUMN IF NOT EXISTS selection_mode character varying NOT NULL DEFAULT 'FIXED_MODEL'/,
  );
  assert.match(migrationSql, /ALTER COLUMN model_name DROP NOT NULL/);
  assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS selected_model_name character varying/);
  assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS model_evaluation jsonb/);
  assert.match(migrationSql, /CHECK \(selection_mode IN \('FIXED_MODEL', 'AUTO_BACKTEST'\)\)/);
  assert.match(migrationSql, /'MOVING_AVERAGE'[\s\S]*'EXPONENTIAL_SMOOTHING'[\s\S]*'TREND_PROJECTION'/);
  assert.doesNotMatch(migrationSql, /DELETE FROM|TRUNCATE|UPDATE public\.forecast_results/i);
  assert.doesNotMatch(migrationSql, /CREATE (?:GIN )?INDEX/i);

  const forecastRuns = schemaSql.match(
    /CREATE TABLE public\.forecast_runs \(([\s\S]*?)\n\);/,
  )?.[1];
  const forecastResults = schemaSql.match(
    /CREATE TABLE public\.forecast_results \(([\s\S]*?)\n\);/,
  )?.[1];

  assert.ok(forecastRuns);
  assert.ok(forecastResults);
  assert.match(forecastRuns, /selection_mode character varying NOT NULL DEFAULT 'FIXED_MODEL'/);
  assert.match(forecastRuns, /model_name character varying,/);
  assert.match(forecastRuns, /forecast_runs_selection_mode_check/);
  assert.match(forecastResults, /selected_model_name character varying,/);
  assert.match(forecastResults, /model_evaluation jsonb,/);
  assert.match(forecastResults, /forecast_results_selected_model_name_check/);
});
