import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { pageHeaderStyles } from "../layout/PageHeader";

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
  selectedRow: {
    backgroundColor: "#eef6fd",
  },
};

const getStatusChipStyles = (status) => {
  const paletteByStatus = {
    ISSUED: {
      backgroundColor: "#e6f1fb",
      color: "#295f92",
    },
    CLAIMED: {
      backgroundColor: "#e6f5ec",
      color: "#2d7a4f",
    },
    VOID: {
      backgroundColor: "#f6ebeb",
      color: "#9d4d58",
    },
    CANCELLED: {
      backgroundColor: "#f6ebeb",
      color: "#9d4d58",
    },
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    ...(paletteByStatus[status] || {
      backgroundColor: "#eef2f6",
      color: "#5f7288",
    }),
  };
};

const StubResultsTable = ({
  rows,
  isLoading,
  errorMessage,
  hasSearched,
  selectedStubId,
  onSelectStub,
  onVerifySelected,
  isVerifying,
}) => {
  if (isLoading) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Search Results</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Searching stubs...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Search Results</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px", color: "#a14d58" }}>
          {errorMessage}
        </p>
      </section>
    );
  }

  if (!hasSearched) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Search Results</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Search by stub number, serial number, or family head to load results.
        </p>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Search Results</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No matching stubs were found for the current search.
        </p>
      </section>
    );
  }

  return (
    <section style={shellStyles.card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: "#17324d" }}>Search Results</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Select one stub result, then run verification.
          </p>
        </div>

        <button
          type="button"
          onClick={onVerifySelected}
          disabled={!selectedStubId || isVerifying}
          style={{
            ...pageHeaderStyles.primaryButton,
            opacity: !selectedStubId || isVerifying ? 0.7 : 1,
            cursor: !selectedStubId || isVerifying ? "not-allowed" : "pointer",
          }}
        >
          {isVerifying ? "Verifying..." : "Verify Selected Stub"}
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.headerCell}>Family Head</th>
              <th style={tableStyles.headerCell}>Stub Number</th>
              <th style={tableStyles.headerCell}>Affected By</th>
              <th style={tableStyles.headerCell}>Sectors</th>
              <th style={tableStyles.headerCell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onSelectStub(row)}
                style={row.id === selectedStubId ? tableStyles.selectedRow : undefined}
              >
                <td style={{ ...tableStyles.bodyCell, cursor: "pointer" }}>
                  <strong style={{ display: "block", marginBottom: "4px" }}>
                    {row.household.family_head_name}
                  </strong>
                  <span style={{ color: "#69839c" }}>{row.serial_no}</span>
                </td>
                <td style={{ ...tableStyles.bodyCell, cursor: "pointer" }}>
                  {row.stub_no}
                </td>
                <td style={{ ...tableStyles.bodyCell, cursor: "pointer" }}>
                  {row.disaster_event?.title || "--"}
                </td>
                <td style={{ ...tableStyles.bodyCell, cursor: "pointer" }}>
                  --
                </td>
                <td style={{ ...tableStyles.bodyCell, cursor: "pointer" }}>
                  <span style={getStatusChipStyles(row.status)}>{row.status}</span>
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
