import React from "react";
import { FaHandHolding } from "react-icons/fa6";
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
    border: "1px solid #c6d8ea",
    borderRadius: "12px",
    width: "40px",
    height: "40px",
    backgroundColor: "#f7fbfe",
    color: "#24496e",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  stubBadge: {
    display: "inline-block",
    minWidth: "36px",
    textAlign: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    backgroundColor: "#e5f1fb",
    color: "#356592",
    fontSize: "12px",
    fontWeight: 700,
  },
};

const getStatusChipStyles = (status) => {
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
    padding: "7px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1,
    ...palette,
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

const MswdoStubResultsTable = ({
  rows,
  isLoading,
  errorMessage,
  hasSelectedEvent,
  hasSelectedBarangay,
  claimingStubId,
  claimErrorMessage,
  onClaimStub,
  isClaimReadOnly = false,
  selectedStubIds,
  onToggleSelect,
  onSelectAll,
}) => {
  const safeSelectedStubIds = Array.isArray(selectedStubIds) ? selectedStubIds : [];

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

  if (!hasSelectedBarangay) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Stub Information</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Please select a barangay to view the stub distribution progress.
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
        <p
          style={{
            ...shellStyles.mutedText,
            marginTop: "10px",
            color: "#a14d58",
          }}
        >
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

  const selectableRows = isClaimReadOnly
    ? []
    : rows.filter((row) => row.status === "ISSUED");

  const areAllSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => safeSelectedStubIds.includes(row.id));

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Stub Information</h3>
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
              <th
                style={{
                  ...tableStyles.headerCell,
                  width: "56px",
                  textAlign: "center",
                }}
              >
                <input
                  type="checkbox"
                  checked={areAllSelected}
                  onChange={onSelectAll}
                  disabled={!selectableRows.length}
                />
              </th>
              <th style={tableStyles.headerCell}>Family Head</th>
              <th style={tableStyles.headerCell}>Address</th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  textAlign: "center",
                }}
              >
                Stub Number
              </th>
              <th style={tableStyles.headerCell}>Sectors</th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  textAlign: "center",
                }}
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelectable = !isClaimReadOnly && row.status === "ISSUED";
              const isSelected = safeSelectedStubIds.includes(row.id);

              return (
                <tr key={row.id}>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                      verticalAlign: "middle",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!isSelectable}
                      onChange={() => onToggleSelect(row.id)}
                    />
                  </td>
                  <td style={tableStyles.bodyCell}>{row.family_head_name}</td>
                  <td style={tableStyles.bodyCell}>{row.address}</td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                    }}
                  >
                    <span style={tableStyles.stubBadge}>{row.stub_number}</span>
                  </td>
                  <td style={tableStyles.bodyCell}>{row.sectors_text}</td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                      verticalAlign: "middle",
                    }}
                  >
                    {row.status === "ISSUED" && !isClaimReadOnly ? (
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
                        <FaHandHolding size={18} />
                      </button>
                    ) : (
                      <span style={getStatusChipStyles(row.status)}>
                        {getStatusLabel(row.status)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default MswdoStubResultsTable;
