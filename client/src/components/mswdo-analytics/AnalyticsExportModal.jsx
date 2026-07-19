import React, { useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(21, 40, 63, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1300,
};

const modalStyles = {
  width: "min(640px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#eef5fb",
  borderRadius: "22px",
  border: "1px solid #d7e2ef",
  boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  padding: "24px",
  boxSizing: "border-box",
};

const inputStyles = {
  width: "100%",
  minHeight: "48px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #d2deea",
  boxSizing: "border-box",
  fontSize: "14px",
  color: "#21405f",
  backgroundColor: "#ffffff",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
};

const errorTextStyles = {
  margin: "10px 0 0",
  color: "#dc2626",
  fontSize: "13px",
  fontWeight: 500,
};

const closeButtonStyles = {
  border: "1px solid #c6d8ea",
  borderRadius: "14px",
  width: "46px",
  height: "46px",
  backgroundColor: "#f8fbfe",
  color: "#2a4c6f",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const getAffectedBarangayIds = (event) => {
  const barangayRows = event?.affected_barangays || event?.barangays || [];
  const barangayIds = event?.affected_barangay_ids || event?.barangay_ids || [];

  if (Array.isArray(barangayIds) && barangayIds.length > 0) {
    return barangayIds.filter(Boolean);
  }

  if (!Array.isArray(barangayRows)) {
    return [];
  }

  return barangayRows
    .map((barangay) => {
      if (typeof barangay === "string") {
        return barangay;
      }

      return barangay?.id || barangay?.barangay_id || barangay?.barangay?.id || "";
    })
    .filter(Boolean);
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

const AnalyticsExportModal = ({
  isOpen,
  isSubmitting,
  disasterEvents,
  barangays,
  selectedDisasterEventId,
  selectedBarangayId,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [exportDisasterEventId, setExportDisasterEventId] = useState("");
  const [exportBarangayId, setExportBarangayId] = useState("");

  useEffect(() => {
    if (isOpen) {
      setExportDisasterEventId(selectedDisasterEventId || "");
      setExportBarangayId(selectedBarangayId || "");
    }
  }, [isOpen, selectedBarangayId, selectedDisasterEventId]);

  const sortedDisasterEvents = useMemo(
    () => sortDisasterEvents(disasterEvents),
    [disasterEvents],
  );

  const selectedEvent = useMemo(
    () =>
      sortedDisasterEvents.find(
        (event) => event.id === exportDisasterEventId,
      ) || null,
    [exportDisasterEventId, sortedDisasterEvents],
  );

  const availableBarangays = useMemo(() => {
    const affectedBarangayIds = getAffectedBarangayIds(selectedEvent);

    if (affectedBarangayIds.length === 0) {
      return barangays;
    }

    const affectedBarangayIdSet = new Set(affectedBarangayIds);
    return barangays.filter((barangay) => affectedBarangayIdSet.has(barangay.id));
  }, [barangays, selectedEvent]);

  useEffect(() => {
    if (!exportBarangayId) {
      return;
    }

    const isBarangayStillAvailable = availableBarangays.some(
      (barangay) => barangay.id === exportBarangayId,
    );

    if (!isBarangayStillAvailable) {
      setExportBarangayId("");
    }
  }, [availableBarangays, exportBarangayId]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      disasterEventId: exportDisasterEventId,
      barangayId: exportBarangayId || null,
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
          }}
        >
          <h3 style={{ margin: 0, color: "#17324d", fontSize: "24px" }}>
            Evacuee Analytics Report
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={closeButtonStyles}
            aria-label="Close export report modal"
          >
            <FiX size={20} />
          </button>
        </div>

        <section style={{ ...shellStyles.card, marginBottom: "18px" }}>
          <h4 style={{ margin: "0 0 14px", color: "#17324d" }}>
            Export Details
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
            }}
          >
            <div>
              <label htmlFor="analytics-export-event" style={labelStyles}>
                Disaster Event
              </label>
              <select
                id="analytics-export-event"
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

            <div>
              <label htmlFor="analytics-export-barangay" style={labelStyles}>
                Barangay
              </label>
              <select
                id="analytics-export-barangay"
                value={exportBarangayId}
                onChange={(event) => setExportBarangayId(event.target.value)}
                style={inputStyles}
                disabled={isSubmitting || !exportDisasterEventId}
              >
                <option value="">All barangays</option>
                {availableBarangays.map((barangay) => (
                  <option key={barangay.id} value={barangay.id}>
                    {barangay.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {errorMessage ? (
            <p style={errorTextStyles}>{errorMessage}</p>
          ) : null}
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={pageHeaderStyles.secondaryButton}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !exportDisasterEventId}
            style={{
              ...pageHeaderStyles.primaryButton,
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

export default AnalyticsExportModal;
