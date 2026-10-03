import React, { useId, useMemo, useState } from "react";
import malvarBarangaysRaw from "../../assets/malvar-barangays.geojson?raw";
import {
  BARANGAY_HEATMAP_COLORS,
  BARANGAY_HEATMAP_METRICS,
  BARANGAY_HEATMAP_UNAFFECTED_COLOR,
  BARANGAY_HEATMAP_VIEWBOX,
  DEFAULT_BARANGAY_HEATMAP_METRIC,
  buildBarangayHeatmapModel,
  indexBarangayHeatmapRows,
  createBarangayHeatmapInteractionHandlers,
  createBarangayHeatmapGeometry,
  getSelectedBarangayHeatmapRow,
} from "./barangayHeatmapModel.mjs";
import "./BarangayHeatMap.css";

const { geoJson: malvarBarangays, pathByFeature } =
  createBarangayHeatmapGeometry(JSON.parse(malvarBarangaysRaw));

const formatCount = (value) => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0
    ? new Intl.NumberFormat().format(number)
    : "Unavailable";
};

const detailFields = [
  ["Registered Households", "registered_households"],
  ["Active Evacuees", "active_evacuees"],
  ["Claimed Relief Stubs", "claimed_stubs"],
  ["Pending Relief Claims", "pending_relief_claims"],
  ["Valid Issued Stubs", "issued_stubs"],
];

const BarangayHeatMap = ({ barangays }) => {
  const [selectedMetric, setSelectedMetric] = useState(
    DEFAULT_BARANGAY_HEATMAP_METRIC,
  );
  const [selectedKey, setSelectedKey] = useState("");
  const reactId = useId().replace(/:/g, "");
  const metricId = "barangay-heatmap-metric-" + reactId;
  const titleId = "barangay-heatmap-title-" + reactId;
  const svgTitleId = "barangay-heatmap-svg-title-" + reactId;
  const unavailablePatternId = "barangay-heatmap-unavailable-" + reactId;

  const barangayRowLookup = useMemo(
    () => indexBarangayHeatmapRows(barangays),
    [barangays],
  );
  const model = useMemo(
    () =>
      buildBarangayHeatmapModel(
        malvarBarangays.features,
        barangayRowLookup,
        selectedMetric,
      ),
    [barangayRowLookup, selectedMetric],
  );
  const selectedRow = getSelectedBarangayHeatmapRow(model, selectedKey);

  return (
    <section
      className="barangay-heatmap-card"
      aria-labelledby={titleId}
      data-testid="barangay-operational-heat-map"
    >
      <header className="barangay-heatmap-header">
        <div className="barangay-heatmap-heading">
          <h2 id={titleId}>Barangay Operational Heat Map</h2>
        </div>
      </header>

      {!model.hasData ? (
        <div className="barangay-heatmap-empty" role="status">
          {Array.isArray(barangays)
            ? "No heat map rows were returned for the selected event."
            : "Heat map data is unavailable for the selected event."}
        </div>
      ) : (
        <>
          <div className="barangay-heatmap-layout">
            <div className="barangay-heatmap-map-column">
              <div className="barangay-heatmap-map">
                <svg
                  className="barangay-heatmap-svg"
                  viewBox={
                    "0 0 " +
                    BARANGAY_HEATMAP_VIEWBOX.width +
                    " " +
                    BARANGAY_HEATMAP_VIEWBOX.height
                  }
                  role="group"
                  aria-labelledby={svgTitleId}
                >
                  <title id={svgTitleId}>
                    {"Malvar barangay map shaded by " + model.metric.label}
                  </title>
                  <defs>
                    <pattern
                      id={unavailablePatternId}
                      width="7"
                      height="7"
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(45)"
                    >
                      <rect width="7" height="7" fill="#f7f5ee" />
                      <line
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="7"
                        stroke="#657789"
                        strokeWidth="2"
                      />
                    </pattern>
                  </defs>
                  {model.rows.map((row) => {
                    const isSelected = row.key === selectedKey;
                    const affectedLabel =
                      row.status === "affected"
                        ? "Affected by selected event"
                        : row.status === "unaffected"
                          ? "Not affected by selected event"
                          : "Data unavailable";
                    const valueLabel =
                      row.value === null ? "Unavailable" : formatCount(row.value);
                    const accessibleLabel =
                      row.name +
                      ". " +
                      affectedLabel +
                      ". " +
                      model.metric.label +
                      ": " +
                      valueLabel +
                      (isSelected ? ". Selected." : ".");
                    const interactionHandlers =
                      createBarangayHeatmapInteractionHandlers(
                        row.key,
                        setSelectedKey,
                      );

                    return (
                      <path
                        key={row.key}
                        d={pathByFeature.get(row.feature) || ""}
                        className={[
                          "barangay-heatmap-polygon",
                          "barangay-heatmap-polygon--" + row.status,
                          isSelected ? "barangay-heatmap-polygon--selected" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        fill={
                          row.status === "unavailable"
                            ? "url(#" + unavailablePatternId + ")"
                            : row.fill ||
                              BARANGAY_HEATMAP_UNAFFECTED_COLOR
                        }
                        stroke={
                          isSelected
                            ? "#17324d"
                            : row.status === "unavailable"
                              ? "#657789"
                              : "#ffffff"
                        }
                        strokeWidth={isSelected ? 3 : 1.25}
                        strokeDasharray={
                          row.status === "unavailable" ? "4 3" : undefined
                        }
                        vectorEffect="non-scaling-stroke"
                        role="button"
                        tabIndex={0}
                        aria-label={accessibleLabel}
                        aria-pressed={isSelected}
                        {...interactionHandlers}
                      >
                        <title>{accessibleLabel}</title>
                      </path>
                    );
                  })}
                </svg>
              </div>

              <div
                className="barangay-heatmap-legend"
                aria-label={"Legend for " + model.metric.label}
              >
                <div className="barangay-heatmap-legend-heading">
                  <strong>{model.metric.label}</strong>
                  <span>Low → High</span>
                </div>
                <div className="barangay-heatmap-color-steps" aria-hidden="true">
                  {BARANGAY_HEATMAP_COLORS.map((color, index) => (
                    <span
                      key={color}
                      className="barangay-heatmap-color-step"
                      style={{ backgroundColor: color }}
                      title={"Magnitude step " + (index + 1)}
                    />
                  ))}
                </div>
                <div className="barangay-heatmap-scale-range">
                  <span>Low</span>
                  <span>
                    {model.affectedCount === 0
                      ? "No affected values"
                      : model.maxValue === 0
                        ? "Affected values: 0"
                        : "Affected values: 0–" + formatCount(model.maxValue)}
                  </span>
                  <span>High</span>
                </div>
                <div className="barangay-heatmap-state-legend">
                  <span>
                    <i
                      className="barangay-heatmap-swatch barangay-heatmap-swatch--unaffected"
                      aria-hidden="true"
                    />
                    Not affected by selected event
                  </span>
                  <span>
                    <i
                      className="barangay-heatmap-swatch barangay-heatmap-swatch--zero"
                      aria-hidden="true"
                    />
                    Affected value of 0
                  </span>
                  <span>
                    <i
                      className="barangay-heatmap-swatch barangay-heatmap-swatch--unavailable"
                      aria-hidden="true"
                    />
                    Data unavailable
                  </span>
                </div>
              </div>
            </div>

            <div className="barangay-heatmap-side-column">
              <div className="barangay-heatmap-control">
                <label htmlFor={metricId}>Map Metric</label>
                <select
                  id={metricId}
                  aria-label="Heat map metric"
                  value={selectedMetric}
                  onChange={(event) => setSelectedMetric(event.target.value)}
                >
                  {BARANGAY_HEATMAP_METRICS.map((metric) => (
                    <option key={metric.key} value={metric.key}>
                      {metric.label}
                    </option>
                  ))}
                </select>
              </div>

              <aside
                className="barangay-heatmap-details"
                aria-label="Selected barangay summary"
                aria-live="polite"
              >
                <h3>Barangay Summary</h3>
                {!selectedRow ? (
                  <p>Select a barangay to view its summary.</p>
                ) : (
                  <>
                    <h4>{selectedRow.name}</h4>
                    <p className="barangay-heatmap-affected">
                      <strong>
                        {selectedRow.status === "affected"
                          ? "Affected"
                          : selectedRow.status === "unaffected"
                            ? "Not affected"
                            : "Data unavailable"}
                      </strong>
                    </p>
                    {selectedRow.apiRow ? (
                      <dl>
                        {detailFields.map(([label, field]) => (
                          <div key={field}>
                            <dt>{label}</dt>
                            <dd>{formatCount(selectedRow.apiRow[field])}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p>Aggregate details are unavailable for this boundary.</p>
                    )}
                  </>
                )}
              </aside>
            </div>
          </div>

          {model.affectedCount === 0 ? (
            <p className="barangay-heatmap-note" role="status">
              No barangays are marked as affected by this event.
            </p>
          ) : model.maxValue === 0 ? (
            <p className="barangay-heatmap-note" role="status">
              Affected barangays have zero values for {model.metric.label}.
            </p>
          ) : null}

          {model.hasJoinMismatch ? (
            <p className="barangay-heatmap-warning" role="status">
              Some boundary data could not be matched to the event summary. Those
              barangays are marked as unavailable.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
};

export default BarangayHeatMap;
