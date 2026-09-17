import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { scheduleScrollToFirstError } from "../../utils/scrollToFirstError";

const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(23, 50, 77, 0.42)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1500,
  },
  modal: {
    width: "min(560px, 100%)",
    backgroundColor: "#ffffff",
    borderRadius: "24px",
    boxShadow: "0 24px 54px rgba(31, 64, 95, 0.22)",
    padding: "28px",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "22px",
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "26px",
    fontWeight: 800,
  },
  closeButton: {
    border: "1px solid #c6d8ea",
    borderRadius: "14px",
    width: "42px",
    height: "42px",
    backgroundColor: "#f8fbfe",
    color: "#24496e",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "16px",
  },
  fullWidth: {
    gridColumn: "1 / -1",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#48627d",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  select: {
    width: "100%",
    minHeight: "48px",
    border: "1px solid #cbdbea",
    borderRadius: "14px",
    padding: "12px 14px",
    backgroundColor: "#f8fbfe",
    color: "#17324d",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  error: {
    margin: "8px 0 0",
    color: "#dc2626",
    fontSize: "12px",
    lineHeight: 1.4,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "26px",
  },
};

const stubStatusOptions = [
  { value: "", label: "All Stub Statuses" },
  { value: "ISSUED", label: "Unclaimed" },
  { value: "CLAIMED", label: "Claimed" },
];

const orderOptions = [
  { value: "newest_oldest", label: "Newest-Oldest" },
  { value: "oldest_newest", label: "Oldest-Newest" },
  { value: "az", label: "Sort A-Z" },
  { value: "za", label: "Sort Z-A" },
];

const ALL_BARANGAYS = "__ALL_BARANGAYS__";

const formatEventOptionLabel = (event) => {
  const title = String(event?.title || event?.event_name || "").trim();
  const titleWithoutBackendCode = title
    .replace(/^DE-\d{4}-\d{4}\s*[-:]\s*/i, "")
    .trim();

  return titleWithoutBackendCode || "Unnamed disaster event";
};

const getAffectedBarangayIds = (event) => {
  if (!Array.isArray(event?.affected_barangays)) {
    return [];
  }

  return event.affected_barangays
    .map((barangay) => {
      if (typeof barangay === "string") {
        return barangay;
      }

      return barangay?.id || barangay?.barangay_id || "";
    })
    .filter(Boolean);
};

const StubPrintSheetModal = ({
  isOpen,
  disasterEvents = [],
  barangays = [],
  selectedDisasterEventId = "",
  selectedBarangayId = "",
  showBarangaySelection = true,
  allowAllBarangays = false,
  isOnline = true,
  onClose,
  onPrint,
}) => {
  const [formValues, setFormValues] = useState({
    disasterEventId: "",
    barangayId: "",
    stubStatus: "",
    orderList: "oldest_newest",
  });
  const [errors, setErrors] = useState({});
  const modalRef = useRef(null);

  const selectedEvent = useMemo(
    () =>
      disasterEvents.find(
        (event) => event.id === formValues.disasterEventId,
      ) || null,
    [disasterEvents, formValues.disasterEventId],
  );

  const selectableBarangays = useMemo(() => {
    if (!showBarangaySelection) {
      return barangays;
    }

    const affectedBarangayIds = getAffectedBarangayIds(selectedEvent);

    if (affectedBarangayIds.length === 0) {
      return [];
    }

    const affectedBarangays = barangays.filter((barangay) =>
      affectedBarangayIds.includes(barangay.id),
    );

    return allowAllBarangays
      ? [{ id: ALL_BARANGAYS, name: "All Barangays" }, ...affectedBarangays]
      : affectedBarangays;
  }, [allowAllBarangays, barangays, selectedEvent, showBarangaySelection]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setErrors({});
    setFormValues({
      disasterEventId: selectedDisasterEventId || disasterEvents[0]?.id || "",
      barangayId:
        selectedBarangayId ||
        (allowAllBarangays ? ALL_BARANGAYS : barangays[0]?.id) ||
        "",
      stubStatus: "",
      orderList: "oldest_newest",
    });
  }, [
    barangays,
    disasterEvents,
    isOpen,
    allowAllBarangays,
    selectedBarangayId,
    selectedDisasterEventId,
  ]);

  useEffect(() => {
    if (!isOpen || !showBarangaySelection) {
      return;
    }

    if (
      formValues.barangayId &&
      selectableBarangays.some((barangay) => barangay.id === formValues.barangayId)
    ) {
      return;
    }

    setFormValues((currentValues) => ({
      ...currentValues,
      barangayId: selectableBarangays[0]?.id || "",
    }));
  }, [formValues.barangayId, isOpen, selectableBarangays, showBarangaySelection]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (fieldName, value) => {
    setErrors((currentErrors) => ({
      ...currentErrors,
      [fieldName]: "",
    }));
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }));
  };

  const handleSubmit = () => {
    if (!isOnline) {
      setErrors({ offline: "Connect to the internet to print stubs." });
      scheduleScrollToFirstError(modalRef);
      return;
    }

    const nextErrors = {};

    if (!formValues.disasterEventId) {
      nextErrors.disasterEventId = "Disaster event is required.";
    }

    if (!formValues.barangayId) {
      nextErrors.barangayId = "Barangay is required.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      scheduleScrollToFirstError(modalRef);
      return;
    }

    onPrint(formValues);
  };

  return (
    <div style={modalStyles.overlay}>
      <div ref={modalRef} style={modalStyles.modal}>
        <div style={modalStyles.header}>
          <h2 style={modalStyles.title}>Print QR Stub Sheet</h2>
          <button type="button" onClick={onClose} style={modalStyles.closeButton}>
            <FiX size={18} />
          </button>
        </div>

        <div style={modalStyles.formGrid}>
          <label style={modalStyles.fullWidth}>
            <span style={modalStyles.label}>Disaster Event</span>
            <select
              value={formValues.disasterEventId}
              onChange={(event) =>
                handleChange("disasterEventId", event.target.value)
              }
              aria-invalid={Boolean(errors.disasterEventId)}
              style={modalStyles.select}
            >
              <option value="">Select disaster event</option>
              {disasterEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {formatEventOptionLabel(event)}
                </option>
              ))}
            </select>
            {errors.disasterEventId ? (
              <p style={modalStyles.error}>{errors.disasterEventId}</p>
            ) : null}
          </label>

          {showBarangaySelection ? (
            <label style={modalStyles.fullWidth}>
              <span style={modalStyles.label}>Barangay</span>
              <select
                value={formValues.barangayId}
                onChange={(event) =>
                  handleChange("barangayId", event.target.value)
                }
                aria-invalid={Boolean(errors.barangayId)}
                style={modalStyles.select}
              >
                <option value="">Select barangay</option>
                {selectableBarangays.map((barangay) => (
                  <option key={barangay.id} value={barangay.id}>
                    {barangay.name}
                  </option>
                ))}
              </select>
              {errors.barangayId ? (
                <p style={modalStyles.error}>{errors.barangayId}</p>
              ) : null}
            </label>
          ) : null}

          <label>
            <span style={modalStyles.label}>Stub Status</span>
            <select
              value={formValues.stubStatus}
              onChange={(event) => handleChange("stubStatus", event.target.value)}
              style={modalStyles.select}
            >
              {stubStatusOptions.map((statusOption) => (
                <option key={statusOption.value || "all"} value={statusOption.value}>
                  {statusOption.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span style={modalStyles.label}>Order List</span>
            <select
              value={formValues.orderList}
              onChange={(event) => handleChange("orderList", event.target.value)}
              style={modalStyles.select}
            >
              {orderOptions.map((orderOption) => (
                <option key={orderOption.value} value={orderOption.value}>
                  {orderOption.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {errors.offline ? (
          <p style={modalStyles.error}>{errors.offline}</p>
        ) : null}

        <div style={modalStyles.actions}>
          <button type="button" onClick={onClose} style={pageHeaderStyles.secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isOnline}
            title={!isOnline ? "Connect to the internet to print stubs." : undefined}
            style={{
              ...pageHeaderStyles.primaryButton,
              opacity: !isOnline ? 0.7 : 1,
            }}
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
};

export default StubPrintSheetModal;
