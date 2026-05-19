import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import QrCodePanel from "../stubs/QrCodePanel";

const labelStyles = {
  margin: 0,
  color: "#6b8197",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 700,
};

const valueStyles = {
  margin: "8px 0 0",
  color: "#17324d",
  fontSize: "18px",
  fontWeight: 700,
};

const photoStyles = {
  card: {
    marginTop: "18px",
    paddingTop: "18px",
    borderTop: "1px solid #e3edf6",
  },
  photoPreview: {
    width: "100%",
    maxWidth: "220px",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "16px",
    border: "1px solid #d5e1eb",
    backgroundColor: "#eaf2f8",
  },
  photoPlaceholder: {
    width: "100%",
    maxWidth: "220px",
    aspectRatio: "4 / 3",
    borderRadius: "16px",
    border: "1px dashed #cad9e8",
    backgroundColor: "#f4f8fb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6b8198",
    fontSize: "13px",
    fontWeight: 600,
    textAlign: "center",
    padding: "16px",
    boxSizing: "border-box",
  },
};

const formatPhotoCapturedAt = (value) => {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
};

const StubSummaryCard = ({ stubContext, isLoadingStubDetails = false }) => {
  if (!stubContext) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Selected Stub</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Open this page from Stub Verification after selecting a valid and
          claimable stub.
        </p>
      </section>
    );
  }

  return (
    <section style={shellStyles.card}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
        }}
      >
        <div>
          <p style={labelStyles}>Family Head</p>
          <p style={valueStyles}>{stubContext.family_head_name}</p>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Barangay: {stubContext.barangay_name || "--"}
          </p>
        </div>

        <div>
          <p style={labelStyles}>Stub Number</p>
          <p style={valueStyles}>{stubContext.stub_no}</p>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Serial: {stubContext.serial_no || "--"}
          </p>
        </div>

        <div>
          <p style={labelStyles}>Stub Status</p>
          <p style={valueStyles}>{stubContext.status}</p>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Members: {stubContext.household_size || "--"}
          </p>
        </div>
      </div>

      <div style={photoStyles.card}>
        <p style={labelStyles}>Family Head Photo Verification</p>

        <div style={{ marginTop: "12px" }}>
          {isLoadingStubDetails ? (
            <p style={{ ...shellStyles.mutedText, marginTop: 0 }}>
              Loading registered family head photo...
            </p>
          ) : stubContext.family_head_photo_url ? (
            <img
              src={stubContext.family_head_photo_url}
              alt="Registered family head"
              style={photoStyles.photoPreview}
            />
          ) : (
            <div style={photoStyles.photoPlaceholder}>No photo available</div>
          )}
        </div>

        {stubContext.photo_captured_at ? (
          <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
            Captured: {formatPhotoCapturedAt(stubContext.photo_captured_at)}
          </p>
        ) : null}

        {stubContext.photo_verification_notes ? (
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Notes: {stubContext.photo_verification_notes}
          </p>
        ) : null}

        <div style={{ marginTop: "18px" }}>
          <p style={labelStyles}>Stub QR</p>
          <div style={{ marginTop: "12px" }}>
            <QrCodePanel
              value={stubContext.qr_code_value || ""}
              emptyLabel="No QR available"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default StubSummaryCard;
