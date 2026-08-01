import React from "react";
import { FaHandHolding } from "react-icons/fa6";
import { FiEye } from "react-icons/fi";
import { shellStyles } from "../layout/BarangayLayout";
import { formatOrderedSectorText } from "../../utils/sectorDisplay";
import SyncStatusIcon from "../shared/SyncStatusIcon";
import QrCodePanel from "./QrCodePanel";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "980px",
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
    verticalAlign: "middle",
    lineHeight: 1.5,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
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
  actionButton: {
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
  stubSequenceText: {
    color: "#17324d",
    fontSize: "14px",
    fontWeight: 700,
  },
  stubCodeText: {
    marginTop: "6px",
    color: "#69839c",
    fontSize: "12px",
    lineHeight: 1.4,
  },
  familyHeadCell: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
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

const formatDisplayStubNo = (row) => {
  if (row.display_stub_no) {
    return row.display_stub_no;
  }

  const sequenceNo = Number(row.stub_sequence_no || row.stub_number || 0);

  return sequenceNo > 0 ? `STUB#${sequenceNo}` : "-";
};

const getTemplateFamilySizeCoverage = (template) => {
  const parsedCoverage = Number.parseInt(String(template?.description || "").trim(), 10);
  return Number.isInteger(parsedCoverage) && parsedCoverage > 0 ? parsedCoverage : 0;
};

const getReliefPackQuantityMultiplier = (template, householdSize) => {
  if (!template?.based_on_family_size) {
    return 1;
  }

  const normalizedHouseholdSize = Number.parseInt(String(householdSize || 0), 10);
  const familySizeCoverage = getTemplateFamilySizeCoverage(template);

  if (
    !Number.isInteger(normalizedHouseholdSize) ||
    normalizedHouseholdSize <= 0 ||
    familySizeCoverage <= 0
  ) {
    return 1;
  }

  return Math.max(1, Math.ceil(normalizedHouseholdSize / familySizeCoverage));
};

const getPrimaryAssignedReliefPackTemplate = (row) => {
  const assignedTemplates = Array.isArray(row?.assigned_relief_packs)
    ? row.assigned_relief_packs
    : [];

  return (
    assignedTemplates.find((template) => !template?.is_additional_pack) ||
    assignedTemplates[0] ||
    null
  );
};

const getReliefPackDisplay = (row) => {
  const primaryTemplate = getPrimaryAssignedReliefPackTemplate(row);
  const householdSize = row?.members_count || 0;
  const packMultiplier = getReliefPackQuantityMultiplier(
    primaryTemplate,
    householdSize,
  );
  const baseDisplay = row?.relief_pack_name || "--";

  return packMultiplier > 1 ? `${baseDisplay} (${packMultiplier})` : baseDisplay;
};

const getStatusLabel = (status) => {
  if (status === "PENDING_SYNC") {
    return "Pending Sync";
  }

  if (status === "FAILED_SYNC") {
    return "Sync Failed";
  }

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
  onViewStub = () => {},
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
          No matching records found. Try adjusting your search or filters.
        </p>
      </section>
    );
  }

  const selectableRows = isClaimReadOnly
    ? []
    : rows.filter((row) => row.status === "ISSUED" && !row.is_local_only);

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
              <th
                style={{
                  ...tableStyles.headerCell,
                  textAlign: "center",
                }}
              >
                Household Size
              </th>
              <th style={tableStyles.headerCell}>Sectors</th>
              <th style={tableStyles.headerCell}>Relief Pack</th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  textAlign: "center",
                }}
              >
                Stub Number
              </th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  textAlign: "center",
                }}
              >
                QR Stub
              </th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  textAlign: "center",
                }}
              >
                Status
              </th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  textAlign: "center",
                }}
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelectable =
                !isClaimReadOnly && row.status === "ISSUED" && !row.is_local_only;
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
                  <td style={tableStyles.bodyCell}>
                    <div style={tableStyles.familyHeadCell}>
                      <span>{row.family_head_name}</span>
                      <SyncStatusIcon status={row.sync_status} />
                    </div>
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                    }}
                  >
                    <span style={tableStyles.stubBadge}>{row.members_count || 0}</span>
                  </td>
                  <td style={tableStyles.bodyCell}>
                    {formatOrderedSectorText(row.sectors_text)}
                  </td>
                  <td style={tableStyles.bodyCell}>
                    {getReliefPackDisplay(row)}
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                    }}
                  >
                    <div style={tableStyles.stubSequenceText}>
                      {formatDisplayStubNo(row)}
                    </div>
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ width: "112px", margin: "0 auto" }}>
                      <QrCodePanel
                        value={row.qr_code_value}
                        emptyLabel="QR unavailable"
                      />
                    </div>
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                      verticalAlign: "middle",
                    }}
                  >
                    {row.is_local_only ? (
                      <span style={getStatusChipStyles("PENDING_SYNC")}>
                        Pending Sync
                      </span>
                    ) : row.status === "ISSUED" && !isClaimReadOnly ? (
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
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                      verticalAlign: "middle",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onViewStub(row)}
                      title={row.is_local_only ? "Available after sync" : "View Details"}
                      aria-label="View Details"
                      disabled={row.is_local_only}
                      style={{
                        ...tableStyles.actionButton,
                        cursor: row.is_local_only ? "not-allowed" : "pointer",
                        opacity: row.is_local_only ? 0.55 : 1,
                      }}
                    >
                      <FiEye size={18} />
                    </button>
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
