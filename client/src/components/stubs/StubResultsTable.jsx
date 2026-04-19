import React from "react";
import { FiPackage } from "react-icons/fi";
import { shellStyles } from "../layout/BarangayLayout";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  headerCell: {
    padding: "14px 16px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "nowrap",
  },
  bodyCell: {
    padding: "16px",
    color: "#21405f",
    borderBottom: "1px solid #edf3f8",
    fontSize: "14px",
    verticalAlign: "top",
  },
  statusButton: {
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: "pointer",
  },
};

const getStatusChipStyles = (status, isActionable = false) => {
  const paletteByStatus = {
    ISSUED: {
      backgroundColor: "#eef5fc",
      color: "#295f92",
      border: "1px solid #c8dbee",
    },
    CLAIMED: {
      backgroundColor: "#e6f5ec",
      color: "#2d7a4f",
      border: "1px solid transparent",
    },
    VOID: {
      backgroundColor: "#f6ebeb",
      color: "#9d4d58",
      border: "1px solid transparent",
    },
    CANCELLED: {
      backgroundColor: "#f6ebeb",
      color: "#9d4d58",
      border: "1px solid transparent",
    },
  };

  const palette = paletteByStatus[status] || {
    backgroundColor: "#eef2f6",
    color: "#5f7288",
    border: "1px solid transparent",
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "7px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1,
    ...palette,
    boxShadow: isActionable ? "0 2px 8px rgba(75, 101, 132, 0.06)" : "none",
  };
};

const getStatusLabel = (status) => {
  if (status === "CLAIMED") {
    return "Claimed";
  }

  if (status === "ISSUED") {
    return "Unclaimed";
  }

  return status || "-";
};

const StubResultsTable = ({
  rows,
  isLoading,
  errorMessage,
  hasSelectedEvent,
  claimingStubId,
  claimErrorMessage,
  onClaimStub,
}) => {
  if (!hasSelectedEvent) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Stub Information</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Please select a disaster event to load the stub information table.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Stub Information</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Loading stub information...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Stub Information</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px", color: "#a14d58" }}>
          {errorMessage}
        </p>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Stub Information</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No stub records were found for the selected disaster event and barangay.
        </p>
      </section>
    );
  }

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <div>
          <h3 style={{ margin: 0, color: "#17324d" }}>Stub Information</h3>
        </div>
      </div>

      {claimErrorMessage ? (
        <p
          style={{
            ...shellStyles.mutedText,
            marginTop: 0,
            marginBottom: "16px",
            color: "#a14d58",
          }}
        >
          {claimErrorMessage}
        </p>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.headerCell}>Family Head</th>
              <th style={tableStyles.headerCell}>Stub Number</th>
              <th style={tableStyles.headerCell}>Sectors</th>
              <th style={tableStyles.headerCell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={tableStyles.bodyCell}>
                  <strong style={{ display: "block", marginBottom: "4px" }}>
                    {row.household.family_head_name}
                  </strong>
                  <span style={{ color: "#69839c" }}>
                    {row.household.members_count || 0} members
                  </span>
                </td>
                <td style={tableStyles.bodyCell}>{row.stub_sequence_no}</td>
                <td style={tableStyles.bodyCell}>{row.sectors_text}</td>
                <td style={tableStyles.bodyCell}>
                  {row.status === "ISSUED" ? (
                    <button
                      type="button"
                      onClick={() => onClaimStub(row.id)}
                      disabled={claimingStubId === row.id}
                      title="Mark as Claimed"
                      style={{
                        ...tableStyles.statusButton,
                        opacity: claimingStubId === row.id ? 0.7 : 1,
                        cursor: claimingStubId === row.id ? "wait" : "pointer",
                      }}
                    >
                      <span style={getStatusChipStyles(row.status, true)}>
                        <FiPackage size={14} />
                        {claimingStubId === row.id ? "Claiming..." : getStatusLabel(row.status)}
                      </span>
                    </button>
                  ) : (
                    <span style={getStatusChipStyles(row.status)}>
                      {getStatusLabel(row.status)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default StubResultsTable;