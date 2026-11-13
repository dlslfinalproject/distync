import React from "react";

const MODEL_ORDER = [
  "MOVING_AVERAGE",
  "EXPONENTIAL_SMOOTHING",
  "TREND_PROJECTION",
];

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const formatMetric = (value, unit) => {
  if (!isFiniteNumber(value)) {
    return "—";
  }

  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
};

const formatPointCount = (value) =>
  Number.isInteger(value) && value >= 0 ? String(value) : "—";

const candidateStatusLabel = (status) => {
  if (status === "EVALUATED") return "Evaluated";
  if (status === "NOT_EVALUATED") return "Not evaluated";
  if (status === "UNAVAILABLE") return "Unavailable";
  return status ? `Unknown status (${status})` : "Status unavailable";
};

const getDecisionMessage = (evaluation) => {
  const reason = evaluation?.recommendation_reason;
  const status = evaluation?.evaluation_status;

  if (status === "INSUFFICIENT_HISTORY" || reason === "INSUFFICIENT_HISTORY") {
    return "Insufficient historical data to compare the candidate models.";
  }
  if (reason === "METRIC_TIE") {
    return "Backtest metrics tied. No model was uniquely recommended.";
  }
  if (reason === "NO_DISCRIMINATING_SIGNAL") {
    return "Historical usage did not distinguish one model as a recommendation.";
  }
  if (reason === "CANDIDATE_UNAVAILABLE") {
    return "A candidate model was unavailable, so no unique recommendation was made.";
  }
  if (!['EVALUATED', 'INSUFFICIENT_HISTORY'].includes(status)) {
    return `Evaluation status is unknown${status ? ` (${status})` : ""}.`;
  }
  if (reason && evaluation?.recommendation_status === "NO_RECOMMENDATION") {
    return `No unique recommendation was made (stored reason: ${reason}).`;
  }
  if (evaluation?.recommendation_status === "RECOMMENDED") {
    return "The recommended model is the one saved with this forecast run.";
  }
  return `Recommendation status is unknown${evaluation?.recommendation_status ? ` (${evaluation.recommendation_status})` : ""}.`;
};

const tableStyles = {
  width: "100%",
  minWidth: "760px",
  borderCollapse: "collapse",
  color: "#24496e",
  fontSize: "13px",
};

const cellStyles = {
  padding: "10px 12px",
  borderBottom: "1px solid #dce7f1",
  textAlign: "left",
  verticalAlign: "top",
  whiteSpace: "nowrap",
};

const ForecastModelValidation = ({ result, getForecastModelLabel }) => {
  const evaluation = result?.model_evaluation;
  if (!evaluation || typeof evaluation !== "object") {
    return (
      <article
        aria-label={`Historical model evaluation for ${result?.item_name || "inventory item"}`}
        style={{
          border: "1px solid #d6e2ef",
          borderRadius: "12px",
          backgroundColor: "#ffffff",
          padding: "clamp(14px, 2vw, 20px)",
        }}
      >
        <h5 style={{ margin: 0, color: "#17324d", fontSize: "16px" }}>
          {result?.item_name || "Unknown inventory item"}
          {result?.item_code ? ` (${result.item_code})` : ""}
        </h5>
        <p style={{ margin: "6px 0 0", color: "#5d7188", fontSize: "13px" }}>
          Historical model evaluation evidence is unavailable for this item.
        </p>
      </article>
    );
  }

  const candidateByName = new Map(
    (Array.isArray(evaluation.candidates) ? evaluation.candidates : []).map(
      (candidate) => [candidate?.model_name, candidate],
    ),
  );
  const labelFor = (modelName) => {
    if (!modelName) {
      return "Model unavailable";
    }

    const label = getForecastModelLabel?.(modelName);
    return label && label !== "Model unavailable"
      ? label
      : `Unknown model (${modelName})`;
  };
  const recommendedLabel = evaluation.recommended_model
    ? labelFor(evaluation.recommended_model)
    : "No unique recommendation";
  const isOperationalFallback =
    evaluation.selection_reason === "OPERATIONAL_FALLBACK";
  const selectedModelLabel = evaluation.selected_model
    ? labelFor(evaluation.selected_model)
    : "Model unavailable";

  return (
    <article
      aria-label={`Historical model evaluation for ${result.item_name || "inventory item"}`}
      style={{
        border: "1px solid #d6e2ef",
        borderRadius: "12px",
        backgroundColor: "#ffffff",
        padding: "clamp(14px, 2vw, 20px)",
        display: "grid",
        gap: "12px",
        minWidth: 0,
      }}
    >
      <div>
        <h5 style={{ margin: 0, color: "#17324d", fontSize: "16px" }}>
          {result.item_name || "Unknown inventory item"}
          {result.item_code ? ` (${result.item_code})` : ""}
        </h5>
        <p style={{ margin: "6px 0 0", color: "#5d7188", fontSize: "13px" }}>
          Recommended model: <strong>{recommendedLabel}</strong>
          {isOperationalFallback ? (
            <span>
              {" · "}Operational model used: <strong>{selectedModelLabel} (fallback)</strong>
            </span>
          ) : evaluation.selection_reason === "HISTORICALLY_RECOMMENDED" ? (
            <span>
              {" · "}Operational model used: <strong>{selectedModelLabel}</strong>
            </span>
          ) : null}
        </p>
        <p style={{ margin: "5px 0 0", color: "#5d7188", fontSize: "13px" }}>
          {getDecisionMessage(evaluation)}
          {Number.isInteger(evaluation.backtest_points)
            ? ` Backtest points: ${evaluation.backtest_points}.`
            : " Backtest point count unavailable."}
          {Number.isInteger(evaluation.available_observations)
            ? ` Available observations: ${evaluation.available_observations}.`
            : ""}
        </p>
      </div>

      <div style={{ overflowX: "auto", minWidth: 0 }}>
        <table style={tableStyles} aria-label={`Candidate model results for ${result.item_name || "inventory item"}`}>
          <thead>
            <tr>
              {["Candidate Model", "MAE", "RMSE", "Statistical Forecast", "Status", "Backtest Points"].map((heading) => (
                <th key={heading} scope="col" style={{ ...cellStyles, color: "#17324d", fontWeight: 800 }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODEL_ORDER.map((modelName) => {
              const candidate = candidateByName.get(modelName);
              return (
                <tr key={modelName}>
                  <th scope="row" style={{ ...cellStyles, fontWeight: 700 }}>
                    {labelFor(modelName)}
                  </th>
                  <td style={cellStyles}>{formatMetric(candidate?.mae, result.unit_of_measure)}</td>
                  <td style={cellStyles}>{formatMetric(candidate?.rmse, result.unit_of_measure)}</td>
                  <td style={cellStyles}>{formatMetric(candidate?.forecasted_usage, result.unit_of_measure)}</td>
                  <td style={cellStyles}>{candidateStatusLabel(candidate?.status)}</td>
                  <td style={cellStyles}>{formatPointCount(candidate?.backtest_points)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
};

export default ForecastModelValidation;
