import React, { useEffect, useMemo, useState } from "react";
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

const inputStyles = {
  width: "100%",
  minHeight: "48px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #cbdbea",
  boxSizing: "border-box",
  fontSize: "14px",
  color: "#17324d",
  backgroundColor: "#f8fbfe",
  minWidth: 0,
  textOverflow: "ellipsis",
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

const errorTextStyles = {
  margin: "8px 0 0",
  color: "#dc2626",
  fontSize: "12px",
  lineHeight: 1.4,
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

const getEventSortValue = (event) => {
  const sortableDate =
    event?.ended_at || event?.end_date || event?.start_date || event?.created_at;

  if (!sortableDate) {
    return 0;
  }

  const parsedValue = new Date(sortableDate).getTime();
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
};

const getEventCodeSortValue = (event) => {
  const eventCode = String(event?.event_code || "").trim().toUpperCase();
  const match = eventCode.match(/^DE-(\d{4})-(\d{4})$/);

  if (!match) {
    return 0;
  }

  return Number(`${match[1]}${match[2]}`);
};

const sortDisasterEvents = (events = []) => {
  return [...events].sort((left, right) => {
    const codeDifference =
      getEventCodeSortValue(right) - getEventCodeSortValue(left);

    if (codeDifference !== 0) {
      return codeDifference;
    }

    return getEventSortValue(right) - getEventSortValue(left);
  });
};

const InventoryForecastExportModal = ({
  isOpen,
  isSubmitting,
  disasterEvents,
  selectedDisasterEventId,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [exportDisasterEventId, setExportDisasterEventId] = useState("");

  useEffect(() => {
    if (isOpen) {
      setExportDisasterEventId(selectedDisasterEventId || "");
    }
  }, [isOpen, selectedDisasterEventId]);

  const sortedDisasterEvents = useMemo(
    () => sortDisasterEvents(disasterEvents),
    [disasterEvents],
  );

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      disasterEventId: exportDisasterEventId,
    });
  };

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
            Export Details
          </h4>
          <div>
            <label htmlFor="forecast-export-event" style={labelStyles}>
              Disaster Event
            </label>
            <select
              id="forecast-export-event"
              value={exportDisasterEventId}
              onChange={(event) => setExportDisasterEventId(event.target.value)}
              style={inputStyles}
              disabled={isSubmitting}
              required
            >
              <option value="">Select disaster event</option>
              {sortedDisasterEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title || "Untitled disaster event"}
                </option>
              ))}
            </select>
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
            disabled={isSubmitting || !exportDisasterEventId}
            style={{
              ...pageHeaderStyles.primaryButton,
              maxWidth: "100%",
              whiteSpace: "normal",
              opacity: isSubmitting || !exportDisasterEventId ? 0.7 : 1,
              cursor:
                isSubmitting || !exportDisasterEventId
                  ? "not-allowed"
                  : "pointer",
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
