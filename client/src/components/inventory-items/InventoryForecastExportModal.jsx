import React from "react";
import { FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(23, 50, 77, 0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "clamp(12px, 4vw, 24px)",
  zIndex: 1500,
  boxSizing: "border-box",
};

const modalStyles = {
  width: "min(640px, 100%)",
  maxHeight: "min(90vh, 720px)",
  overflowY: "auto",
  backgroundColor: "#ffffff",
  borderRadius: "18px",
  boxShadow: "0 24px 54px rgba(31, 64, 95, 0.22)",
  padding: "clamp(18px, 4vw, 28px)",
  boxSizing: "border-box",
  minWidth: 0,
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#48627d",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const valueStyles = {
  margin: 0,
  color: "#17324d",
  fontSize: "15px",
  fontWeight: 700,
  overflowWrap: "anywhere",
};

const closeButtonStyles = {
  border: "1px solid #c6d8ea",
  borderRadius: "14px",
  width: "42px",
  height: "42px",
  backgroundColor: "#f8fbfe",
  color: "#24496e",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
};

const errorTextStyles = {
  margin: "8px 0 0",
  color: "#dc2626",
  fontSize: "12px",
  lineHeight: 1.4,
};

const InventoryForecastExportModal = ({
  isOpen,
  isSubmitting,
  forecast,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) {
    return null;
  }

  const forecastRun = forecast?.forecast_run;
  const runId = forecastRun?.id;
  const eventTitle =
    forecastRun?.disaster_event?.title || "Selected disaster event";
  const runAt = forecastRun?.run_at
    ? new Date(forecastRun.run_at).toLocaleString()
    : "Unavailable";

  const handleSubmit = (event) => {
    event.preventDefault();
    if (runId) {
      onSubmit(runId);
    }
  };

  const isDisabled = isSubmitting || !runId;

  return (
    <div style={overlayStyles}>
      <form onSubmit={handleSubmit} style={modalStyles}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "20px",
            flexWrap: "wrap",
          }}
        >
          <h3
            style={{
              margin: 0,
              color: "#17324d",
              fontSize: "clamp(21px, 5vw, 26px)",
              fontWeight: 800,
              lineHeight: 1.15,
              overflowWrap: "anywhere",
              minWidth: 0,
            }}
          >
            Inventory Forecasting Report
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={closeButtonStyles}
            aria-label="Close inventory forecasting report modal"
          >
            <FiX size={20} />
          </button>
        </div>

        <section style={{ ...shellStyles.card, marginBottom: "18px" }}>
          <h4
            style={{
              margin: "0 0 14px",
              color: "#17324d",
              fontSize: "18px",
              fontWeight: 800,
            }}
          >
            Persisted Forecast Run
          </h4>
          <div style={{ display: "grid", gap: "14px" }}>
            <div>
              <span style={labelStyles}>Disaster Event</span>
              <p style={valueStyles}>{eventTitle}</p>
            </div>
            <div>
              <span style={labelStyles}>Forecast Run</span>
              <p style={valueStyles}>{runAt}</p>
            </div>
          </div>
          {errorMessage ? <p style={errorTextStyles}>{errorMessage}</p> : null}
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "stretch",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              ...pageHeaderStyles.secondaryButton,
              maxWidth: "100%",
              whiteSpace: "normal",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isDisabled}
            style={{
              ...pageHeaderStyles.primaryButton,
              maxWidth: "100%",
              whiteSpace: "normal",
              opacity: isDisabled ? 0.7 : 1,
              cursor: isDisabled ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Exporting..." : "Export"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InventoryForecastExportModal;
