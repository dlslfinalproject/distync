import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";

const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(18, 34, 51, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1200,
  },
  modal: {
    width: "100%",
    maxWidth: "560px",
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "28px",
    boxShadow: "0 24px 48px rgba(20, 48, 78, 0.2)",
    display: "grid",
    gap: "16px",
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "22px",
  },
  helper: {
    margin: 0,
    color: "#5d7188",
    fontSize: "15px",
    lineHeight: 1.6,
  },
  label: {
    display: "grid",
    gap: "8px",
    color: "#17324d",
    fontWeight: 700,
    fontSize: "14px",
  },
  field: {
    borderRadius: "14px",
    border: "1px solid #cad8e6",
    padding: "12px 14px",
    fontSize: "14px",
    boxSizing: "border-box",
    width: "100%",
  },
  textarea: {
    minHeight: "120px",
    resize: "vertical",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    flexWrap: "wrap",
  },
};

const EvacuationCorrectionModal = ({
  isOpen,
  isSubmitting,
  hasAttendanceRecord,
  evacuationCenters,
  form,
  onChange,
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <h3 style={modalStyles.title}>Correct Evacuation Record</h3>
        <p style={modalStyles.helper}>
          Update the latest evacuation center, attendance status, and correction
          remarks for this household.
        </p>

        {!hasAttendanceRecord ? (
          <p style={modalStyles.helper}>
            No evacuation record is available to correct for this household.
          </p>
        ) : (
          <>
            <label style={modalStyles.label}>
              Evacuation Center
              <select
                value={form.evacuation_center_id}
                onChange={(event) =>
                  onChange?.("evacuation_center_id", event.target.value)
                }
                style={modalStyles.field}
                disabled={isSubmitting}
              >
                <option value="">No evacuation center</option>
                {evacuationCenters.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={modalStyles.label}>
              Status
              <select
                value={form.status}
                onChange={(event) => onChange?.("status", event.target.value)}
                style={modalStyles.field}
                disabled={isSubmitting}
              >
                <option value="PRESENT">Present</option>
                <option value="LEFT">Left</option>
                <option value="TRANSFERRED">Transferred</option>
              </select>
            </label>

            <label style={modalStyles.label}>
              Correction Remarks
              <textarea
                value={form.correction_remarks}
                onChange={(event) =>
                  onChange?.("correction_remarks", event.target.value)
                }
                placeholder="Add remarks about the correction"
                style={{ ...modalStyles.field, ...modalStyles.textarea }}
                disabled={isSubmitting}
              />
            </label>
          </>
        )}

        <div style={modalStyles.actions}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              ...pageHeaderStyles.secondaryButton,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting || !hasAttendanceRecord}
            style={{
              ...pageHeaderStyles.primaryButton,
              opacity: isSubmitting || !hasAttendanceRecord ? 0.7 : 1,
              cursor: isSubmitting ? "wait" : "pointer",
            }}
          >
            {isSubmitting ? "Saving Correction..." : "Save Correction"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EvacuationCorrectionModal;
