import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(21, 40, 63, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1000,
};

const modalStyles = {
  width: "min(760px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#ffffff",
  borderRadius: "22px",
  border: "1px solid #d7e2ef",
  boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  padding: "24px",
  boxSizing: "border-box",
};

const detailLabelStyles = {
  margin: 0,
  color: "#60738a",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 700,
};

const detailValueStyles = {
  margin: "8px 0 0",
  color: "#17324d",
  fontSize: "16px",
  fontWeight: 700,
};

const formatDate = (value) => {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const DisasterEventDetailModal = ({
  isOpen,
  eventData,
  isLoading,
  errorMessage,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="disaster-event-modal-backdrop" style={overlayStyles}>
      <div className="disaster-event-detail-modal" style={modalStyles}>
        <div
          className="disaster-event-modal-topbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div className="disaster-event-modal-heading">
            <h3 style={{ margin: 0, color: "#17324d", fontSize: "26px" }}>
              Disaster Event Detail
            </h3>
            <p
              style={{
                margin: "8px 0 0",
                color: "#60738a",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              Inspect the selected event record and affected barangays for future
              monitoring and filtering.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={pageHeaderStyles.secondaryButton}
          >
            Close
          </button>
        </div>

        {isLoading ? (
          <p style={{ color: "#60738a", margin: 0 }}>Loading event details...</p>
        ) : null}

        {errorMessage ? (
          <p style={{ color: "#9d4d58", margin: 0 }}>{errorMessage}</p>
        ) : null}

        {!isLoading && !errorMessage && eventData ? (
          <>
            <div
              className="disaster-event-detail-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              <div>
                <p style={detailLabelStyles}>Title</p>
                <p className="disaster-event-detail-value" style={detailValueStyles}>{eventData.title}</p>
              </div>
              <div>
                <p style={detailLabelStyles}>Disaster Type</p>
                <p className="disaster-event-detail-value" style={detailValueStyles}>{eventData.disaster_type}</p>
              </div>
              <div>
                <p style={detailLabelStyles}>Status</p>
                <p className="disaster-event-detail-value" style={detailValueStyles}>{eventData.status}</p>
              </div>
              <div>
                <p style={detailLabelStyles}>Start Date</p>
                <p className="disaster-event-detail-value" style={detailValueStyles}>{formatDate(eventData.start_date)}</p>
              </div>
              <div>
                <p style={detailLabelStyles}>End Date</p>
                <p className="disaster-event-detail-value" style={detailValueStyles}>{formatDate(eventData.end_date)}</p>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <p style={detailLabelStyles}>Description</p>
                <p className="disaster-event-detail-value" style={detailValueStyles}>
                  {eventData.description || "No description provided."}
                </p>
              </div>
            </div>

            <div style={{ marginTop: "24px" }}>
              <p style={detailLabelStyles}>Affected Barangays</p>
              <div
                className="disaster-event-detail-barangay-grid"
                style={{
                  marginTop: "12px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px",
                }}
              >
                {(eventData.affected_barangays || []).length === 0 ? (
                  <p style={{ color: "#60738a", margin: 0 }}>
                    No affected barangays assigned.
                  </p>
                ) : (
                  eventData.affected_barangays.map((barangay) => (
                    <div
                      className="disaster-event-detail-chip"
                      key={barangay.id}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "14px",
                        border: "1px solid #d7e2ef",
                        backgroundColor: "#f8fbfe",
                        color: "#21405f",
                        fontSize: "14px",
                      }}
                    >
                      {barangay.name}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default DisasterEventDetailModal;
