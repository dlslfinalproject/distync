import React from "react";
import { FiLogOut } from "react-icons/fi";
import { shellStyles } from "../layout/BarangayLayout";

const MasterlistSelectionBar = ({
  selectedCount,
  isSubmitting,
  onConfirmDeparture,
}) => {
  if (selectedCount <= 0) {
    return null;
  }

  return (
    <section style={shellStyles.card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <p style={{ margin: 0, fontWeight: 700, color: "#24496e" }}>
          {selectedCount} selected
        </p>

        <button
          type="button"
          onClick={onConfirmDeparture}
          disabled={isSubmitting}
          style={{
            border: "1px solid #c6d8ea",
            borderRadius: "12px",
            width: "40px",
            height: "40px",
            backgroundColor: "#f7fbfe",
            color: "#24496e",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isSubmitting ? "not-allowed" : "pointer",
            opacity: isSubmitting ? 0.7 : 1,
          }}
          title="Mark Selected as Departed"
        >
          <FiLogOut size={18} />
        </button>
      </div>
    </section>
  );
};

export default MasterlistSelectionBar;
