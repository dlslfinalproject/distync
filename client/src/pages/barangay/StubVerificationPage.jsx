import React from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";

const infoCardStyles = {
  label: {
    margin: 0,
    color: "#6b8197",
    fontSize: "13px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  value: {
    margin: "10px 0 0",
    color: "#17324d",
    fontSize: "20px",
    fontWeight: 700,
  },
};

const StubVerificationPage = () => {
  return (
    <>
      <PageHeader
        eyebrow="Barangay Workspace"
        title="Stub Verification"
        description="Shared verification screen shell for searching a stub, checking household details, and preparing the next claim flow. The layout is ready for API integration once the frontend wiring starts."
        actions={[
          { label: "Scan Barcode" },
          { label: "Manual Search", variant: "secondary" },
        ]}
      />

      <section style={shellStyles.card}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 1.2fr) minmax(220px, 0.8fr)",
            gap: "16px",
          }}
        >
          <div
            style={{
              border: "1px solid #d9e4ef",
              borderRadius: "16px",
              padding: "16px",
              backgroundColor: "#f7fbfe",
              color: "#6b8197",
              fontSize: "14px",
            }}
          >
            Search by stub number, serial number, contact number, or family head
            name
          </div>
          <button
            type="button"
            style={{
              border: "none",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #2f6499 0%, #4c86be 100%)",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "15px",
              cursor: "pointer",
              minHeight: "56px",
            }}
          >
            Verify Stub
          </button>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "18px",
        }}
      >
        <div style={shellStyles.card}>
          <p style={infoCardStyles.label}>Stub status</p>
          <p style={infoCardStyles.value}>Waiting for input</p>
          <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
            This card can display `ISSUED`, `CLAIMED`, `VOID`, or
            `CANCELLED`.
          </p>
        </div>

        <div style={shellStyles.card}>
          <p style={infoCardStyles.label}>Household summary</p>
          <p style={infoCardStyles.value}>No stub selected</p>
          <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
            Placeholder area for linked household and family head details.
          </p>
        </div>

        <div style={shellStyles.card}>
          <p style={infoCardStyles.label}>Next action</p>
          <p style={infoCardStyles.value}>Ready for claim flow</p>
          <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
            This panel can later connect to distribution verification and claim
            release steps.
          </p>
        </div>
      </section>
    </>
  );
};

export default StubVerificationPage;
