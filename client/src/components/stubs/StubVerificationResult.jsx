import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const getResultColors = (result) => {
  if (!result) {
    return {
      backgroundColor: "#f8fbfe",
      borderColor: "#d7e2ef",
      titleColor: "#17324d",
      labelColor: "#60738a",
    };
  }

  if (result.is_valid && result.is_claimable) {
    return {
      backgroundColor: "#edf8f1",
      borderColor: "#cfe8d7",
      titleColor: "#2f6c47",
      labelColor: "#4f7460",
    };
  }

  return {
    backgroundColor: "#fff3f1",
    borderColor: "#f1d2cc",
    titleColor: "#9d4d58",
    labelColor: "#7f6670",
  };
};

const StubVerificationResult = ({ result, selectedStub }) => {
  const palette = getResultColors(result);

  if (!result) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Verification Result</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          {selectedStub
            ? "Select Verify Selected Stub to check if this stub is valid and claimable."
            : "Choose one stub result to prepare verification."}
        </p>
      </section>
    );
  }

  return (
    <section
      style={{
        ...shellStyles.card,
        backgroundColor: palette.backgroundColor,
        borderColor: palette.borderColor,
      }}
    >
      <h3 style={{ marginTop: 0, color: palette.titleColor }}>Verification Result</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
          marginTop: "18px",
        }}
      >
        <div>
          <p style={{ margin: 0, color: palette.labelColor, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Valid
          </p>
          <p style={{ margin: "8px 0 0", color: palette.titleColor, fontSize: "26px", fontWeight: 700 }}>
            {result.is_valid ? "Yes" : "No"}
          </p>
        </div>

        <div>
          <p style={{ margin: 0, color: palette.labelColor, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Claimable
          </p>
          <p style={{ margin: "8px 0 0", color: palette.titleColor, fontSize: "26px", fontWeight: 700 }}>
            {result.is_claimable ? "Yes" : "No"}
          </p>
        </div>
      </div>

      <div style={{ marginTop: "18px" }}>
        <p style={{ margin: 0, color: palette.labelColor, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Message
        </p>
        <p style={{ margin: "8px 0 0", color: palette.titleColor, fontSize: "16px", fontWeight: 700 }}>
          {result.message}
        </p>
        {result.reason ? (
          <p style={{ ...shellStyles.mutedText, marginTop: "8px", color: palette.labelColor }}>
            {result.reason}
          </p>
        ) : null}
      </div>

      {result.stub ? (
        <div
          style={{
            marginTop: "20px",
            padding: "16px",
            borderRadius: "14px",
            backgroundColor: "#ffffff",
            border: "1px solid rgba(133, 156, 181, 0.18)",
          }}
        >
          <p style={{ margin: 0, color: "#60738a", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Stub Summary
          </p>
          <p style={{ margin: "10px 0 0", color: "#17324d", fontWeight: 700 }}>
            {result.household?.family_head_name || "--"}
          </p>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Stub: {result.stub.stub_no} | Serial: {result.stub.serial_no}
          </p>
          <p style={{ ...shellStyles.mutedText, marginTop: "4px" }}>
            Status: {result.stub.status} | Barangay: {result.household?.barangay_name || "--"}
          </p>
        </div>
      ) : null}
    </section>
  );
};

export default StubVerificationResult;
