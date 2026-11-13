import React, { useRef } from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import FormModalShell from "../shared/FormModalShell";

const modalBodyStyles = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  padding: "4px 0 0",
};

const titleStyles = {
  margin: 0,
  color: "#1f2937",
  fontSize: "18px",
  fontWeight: 700,
};

const bodyTextStyles = {
  margin: "12px 0 0",
  color: "#6b7280",
  fontSize: "14px",
  lineHeight: 1.6,
  maxWidth: "320px",
};

const eventListStyles = {
  margin: "12px 0 0",
  padding: 0,
  color: "#24496e",
  fontSize: "14px",
  lineHeight: 1.6,
  maxWidth: "320px",
  listStylePosition: "inside",
};

const footerButtonStyles = {
  ...pageHeaderStyles.primaryButton,
  width: "100%",
  minHeight: "40px",
  borderRadius: "8px",
  padding: "0 18px",
  fontSize: "15px",
  fontWeight: 700,
};

const ActiveCrossEventInformationModal = ({ eventTitles, onClose }) => {
  const okayButtonRef = useRef(null);
  const safeEventTitles = Array.isArray(eventTitles) ? eventTitles : [];

  return (
    <FormModalShell
      isOpen={safeEventTitles.length > 0}
      onClose={onClose}
      showCloseButton={false}
      initialFocusRef={okayButtonRef}
      maxWidth="420px"
      bodyStyle={{ marginTop: 0 }}
      footer={
        <button
          ref={okayButtonRef}
          type="button"
          onClick={onClose}
          style={footerButtonStyles}
        >
          Okay
        </button>
      }
    >
      <div style={modalBodyStyles}>
        <p style={titleStyles}>Household Registered Successfully</p>
        {safeEventTitles.length === 1 ? (
          <p style={bodyTextStyles}>
            This household is also registered under the active disaster event
            &ldquo;{safeEventTitles[0]}&rdquo;.
          </p>
        ) : (
          <>
            <p style={bodyTextStyles}>
              This household is also registered under the following active
              disaster events:
            </p>
            <ul style={eventListStyles}>
              {safeEventTitles.map((eventTitle) => (
                <li key={eventTitle}>{eventTitle}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </FormModalShell>
  );
};

export default ActiveCrossEventInformationModal;
