import React, { useMemo } from "react";
import { shellStyles } from "../layout/BarangayLayout";
import StatusCard from "../shared/StatusCard";
import StatusPill from "../shared/StatusPill";

const filterStyles = {
  field: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #cfddeb",
    backgroundColor: "#f8fbfe",
    color: "#1f3b57",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
};

const tabButtonStyles = (isActive) => ({
  padding: "12px 24px",
  border: "none",
  background: "none",
  fontSize: "14px",
  fontWeight: 700,
  textTransform: "uppercase",
  color: isActive ? "#17324d" : "#6b8298",
  borderBottom: isActive ? "3px solid #17324d" : "3px solid transparent",
  cursor: "pointer",
});

const formatDisplayDate = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-PH", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const formatReliefPeriod = (event) => {
  if (!event) return "-";

  const start = formatDisplayDate(event.start_date);

  if (!event.end_date && event.status === "ACTIVE") {
    return `${start} - Ongoing`;
  }

  if (event.end_date) {
    return `${start} - ${formatDisplayDate(event.end_date)}`;
  }

  return start;
};

const formatCardValue = (value) => {
  return String(value || 0).padStart(2, "0");
};

const getEventSortValue = (event) => {
  const sortableDate =
    event?.ended_at ||
    event?.end_date ||
    event?.start_date ||
    event?.created_at ||
    null;

  if (!sortableDate) {
    return 0;
  }

  const parsedValue = new Date(sortableDate).getTime();
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
};

const getEventCodeSortValue = (event) => {
  const code = String(event?.event_code || "");
  const match = code.match(/^DE-(\d{4})-(\d{4})$/i);

  if (!match) {
    return 0;
  }

  return Number(`${match[1]}${match[2]}`);
};

const formatDisasterEventTitle = (event) =>
  String(event?.title || "").trim() || "No disaster event selected";

const BarangayDashboardOverview = ({
  accessMode,
  allowFallback,
  eventScope,
  selectedDisasterEventId,
  overrideBarangayId,
  assignedBarangay,
  availableEvents,
  selectedEvent,
  summaryCards,
  devBarangayOptions,
  isLoading,
  errorMessage,
  errorCode,
  hasSelectedEvent,
  hasEvents,
  hasData,
  hasAssignedBarangay,
  isDevOverride,
  setEventScope,
  setSelectedDisasterEventId,
  setOverrideBarangayId,
}) => {
  const scopeLabel = eventScope === "active" ? "Active" : "Ended";
  const showFallbackOverride = allowFallback && !hasAssignedBarangay;
  const sortedAvailableEvents = useMemo(() => {
    return [...(availableEvents || [])].sort((left, right) => {
      const codeDifference =
        getEventCodeSortValue(right) - getEventCodeSortValue(left);

      if (codeDifference !== 0) {
        return codeDifference;
      }

      const dateDifference = getEventSortValue(right) - getEventSortValue(left);

      if (dateDifference !== 0) {
        return dateDifference;
      }

      return String(right?.event_code || "").localeCompare(
        String(left?.event_code || ""),
        undefined,
        { numeric: true, sensitivity: "base" },
      );
    });
  }, [availableEvents]);

  let stateMessage = "";

  if (errorCode === "NO_ASSIGNED_BARANGAY") {
    stateMessage =
      showFallbackOverride && !overrideBarangayId
        ? "Select a fallback barangay to continue."
        : "No assigned barangay. Please contact administrator.";
  } else if (errorMessage) {
    stateMessage = errorMessage;
  } else if (!hasEvents) {
    stateMessage = `No ${scopeLabel.toLowerCase()} disaster events are available for this barangay yet.`;
  } else if (!hasSelectedEvent) {
    stateMessage =
      "Select a disaster event to load the disaster information and analytics.";
  } else if (!hasData) {
    stateMessage =
      "No data available for this barangay and selected disaster event.";
  }

  return (
    <>
      <section style={shellStyles.card}>
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #d6e2ef",
            marginBottom: "24px",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setEventScope("active")}
            style={tabButtonStyles(eventScope === "active")}
          >
            Active Events
          </button>
          <button
            type="button"
            onClick={() => setEventScope("ended")}
            style={tabButtonStyles(eventScope === "ended")}
          >
            Ended Events
          </button>
        </div>

        {/* ✅ GRID (ORDER FIXED HERE) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            alignItems: "end",
          }}
        >
          {/* Event */}
          <div>
            <label
              htmlFor="barangay-dashboard-event"
              style={filterStyles.label}
            >
              {scopeLabel} Disaster Event
            </label>
            <select
              id="barangay-dashboard-event"
              value={selectedDisasterEventId}
              onChange={(event) =>
                setSelectedDisasterEventId(event.target.value)
              }
              disabled={isLoading || !hasEvents}
              style={filterStyles.field}
            >
              <option value="">
                {`Select ${scopeLabel.toLowerCase()} disaster event`}
              </option>
              {sortedAvailableEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {formatDisasterEventTitle(event)}
                </option>
              ))}
            </select>
          </div>

          {/* ✅ Fallback Barangay (NOW 2nd) */}
          {showFallbackOverride ? (
            <div>
              <label
                htmlFor="barangay-dashboard-override"
                style={filterStyles.label}
              >
                {accessMode} Fallback Barangay
              </label>
              <select
                id="barangay-dashboard-override"
                value={overrideBarangayId}
                onChange={(event) =>
                  setOverrideBarangayId(event.target.value)
                }
                style={filterStyles.field}
              >
                <option value="">Select fallback barangay</option>
                {(devBarangayOptions || []).map((barangay) => (
                  <option key={barangay.id} value={barangay.id}>
                    {barangay.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* ✅ Barangay (NOW 3rd) */}
          <div>
            <label style={filterStyles.label}>Barangay</label>
            <div
              style={{
                ...filterStyles.field,
                display: "flex",
                alignItems: "center",
                minHeight: "48px",
                fontWeight: 700,
                color: "#17324d",
              }}
            >
              {assignedBarangay?.name || "No assigned barangay"}
            </div>
          </div>
        </div>
      </section>

      <section style={shellStyles.card}>
        <div
          style={{
            border: "1px solid #d6e2ef",
            borderRadius: "16px",
            padding: "18px 20px",
            backgroundColor: "#f8fbfe",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#17324d",
              fontSize: "18px",
              fontWeight: 800,
            }}
          >
            {formatDisasterEventTitle(selectedEvent)}
          </p>

          <div style={{ display: "flex", gap: "24px", marginTop: "14px" }}>
            <span>Period: {formatReliefPeriod(selectedEvent)}</span>
            <StatusPill status={selectedEvent?.status} />
          </div>
        </div>

        {isLoading && (
          <p style={{ ...shellStyles.mutedText, marginTop: "16px" }}>
            Loading barangay dashboard...
          </p>
        )}

        {!isLoading && stateMessage && (
          <p style={{ ...shellStyles.mutedText, marginTop: "16px" }}>
            {stateMessage}
          </p>
        )}
      </section>

      {hasSelectedEvent && (
        <section style={shellStyles.statGrid}>
          {(summaryCards || []).map((card) => (
            <StatusCard key={card.label} {...card} />
          ))}
        </section>
      )}
    </>
  );
};

export default BarangayDashboardOverview;
