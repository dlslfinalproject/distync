import React from "react";
import { FiX } from "react-icons/fi";
import FormModalShell from "../shared/FormModalShell";

const blockedModalBodyStyles = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  padding: "4px 0 0",
};

const blockedModalIconStyles = {
  width: "48px",
  height: "48px",
  borderRadius: "999px",
  backgroundColor: "#fee2e2",
  color: "#c53030",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "28px",
  lineHeight: 1,
  marginBottom: "14px",
};

const blockedModalTitleStyles = {
  margin: 0,
  color: "#1f2937",
  fontSize: "18px",
  fontWeight: 700,
};

const blockedModalMessageStyles = {
  margin: "12px 0 0",
  color: "#6b7280",
  fontSize: "14px",
  lineHeight: 1.6,
  maxWidth: "320px",
};

const blockedModalButtonStyles = {
  width: "100%",
  minHeight: "40px",
  border: "none",
  borderRadius: "8px",
  backgroundColor: "#c53030",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
};

const ReliefPackTemplateDeactivationBlockedModal = ({
  isOpen,
  message,
  onClose,
}) => (
  <FormModalShell
    isOpen={isOpen}
    maxWidth="420px"
    bodyStyle={{ marginTop: 0 }}
    footer={
      <button
        type="button"
        onClick={onClose}
        style={blockedModalButtonStyles}
      >
        OK
      </button>
    }
  >
    <div style={blockedModalBodyStyles} role="alert" aria-live="assertive">
      <div aria-hidden="true" style={blockedModalIconStyles}>
        <FiX />
      </div>
      <p style={blockedModalTitleStyles}>Cannot Deactivate</p>
      <p style={blockedModalMessageStyles}>
        {message ||
          "This relief pack cannot be deactivated while an event is active or a distribution is ongoing."}
      </p>
    </div>
  </FormModalShell>
);

export default ReliefPackTemplateDeactivationBlockedModal;
