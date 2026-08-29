import React from "react";
import { FaHandHolding } from "react-icons/fa6";
import { FiEye } from "react-icons/fi";
import { shellStyles } from "../layout/BarangayLayout";
import { DEFAULT_TABLE_PAGE_SIZE } from "../../features/pagination/pagination.mjs";
import { formatOrderedSectorText } from "../../utils/sectorDisplay";
import SyncStatusIcon from "../shared/SyncStatusIcon";
import TablePagination from "../shared/TablePagination";
import QrCodePanel from "./QrCodePanel";

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
    verticalAlign: "middle",
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
  membersBadge: {
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
  archivedRow: {
    backgroundColor: "#f8fbfe",
  },
  archivedBodyCell: {
    color: "#5f7690",
  },
  archivedMembersBadge: {
    backgroundColor: "#eef5fb",
    color: "#6a87a6",
  },
  archivedCheckbox: {
    opacity: 0.65,
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

const formatDisplayStubNo = (row) => {
  if (row.display_stub_no) {
    return row.display_stub_no;
  }

  return row.stub_sequence_no ? `STUB#${row.stub_sequence_no}` : "-";
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
  const householdSize = row?.household?.members_count || row?.members_count || 0;
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

const isArchivedHouseholdRow = (row) => row?.household?.is_active === false;
const isRowBlockedByClaimSync = (row) =>
  row?.is_claim_pending || row?.sync_status === "PENDING" || row?.sync_status === "CONFLICT";

const StubResultsTable = ({
  rows,
  isLoading,
  errorMessage,
  hasSelectedEvent,
  claimingStubId,
  claimErrorMessage,
  onClaimStub,
  isClaimReadOnly = false,
  selectedStubIds,
  onToggleSelect,
  onSelectAll,
  onViewStub = () => {},
  pagination = null,
  onPageChange = () => {},
  onPageSizeChange = () => {},
}) => {
  const safeSelectedStubIds = Array.isArray(selectedStubIds)
    ? selectedStubIds
    : [];

  if (!hasSelectedEvent) {
    return (
      <section className="stub-results-card" style={shellStyles.card}>
        <h3 className="table-card-title">Stub Information</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Please select a disaster event to load the stub information table.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="stub-results-card" style={shellStyles.card}>
        <h3 className="table-card-title">Stub Information</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Loading stub information...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="stub-results-card" style={shellStyles.card}>
        <h3 className="table-card-title">Stub Information</h3>
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
      <section className="stub-results-card" style={shellStyles.card}>
        <h3 className="table-card-title">Stub Information</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No matching records found. Try adjusting your search or filters.
        </p>
      </section>
    );
  }

  const selectableRows = isClaimReadOnly
    ? []
    : rows.filter(
        (row) =>
          row.status === "ISSUED" &&
          !row.is_local_only &&
          !isArchivedHouseholdRow(row) &&
          !isRowBlockedByClaimSync(row),
      );

  const areAllSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => safeSelectedStubIds.includes(row.id));
  const totalItems = Number(pagination?.totalItems ?? rows.length);
  const currentPage = Number(pagination?.page || 1);
  const pageSize = Number(
    pagination?.pageSize || DEFAULT_TABLE_PAGE_SIZE,
  );

  return (
    <section className="stub-results-card" style={shellStyles.card}>
      <h3 className="table-card-title">Stub Information</h3>
      <TablePagination
        totalItems={totalItems}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        ariaLabel="Relief goods distribution pagination"
        previousAriaLabel="Go to previous relief goods distribution page"
        nextAriaLabel="Go to next relief goods distribution page"
      />

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

      <div className="stub-results-table-scroll" style={{ overflowX: "auto" }}>
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
              const isArchivedRow = isArchivedHouseholdRow(row);
              const isSelectable =
                !isClaimReadOnly &&
                row.status === "ISSUED" &&
                !row.is_local_only &&
                !isArchivedRow &&
                !isRowBlockedByClaimSync(row);
              const isSelected = safeSelectedStubIds.includes(row.id);

              return (
                <tr
                  key={row.id}
                  style={isArchivedRow ? tableStyles.archivedRow : undefined}
                >
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...(isArchivedRow ? tableStyles.archivedBodyCell : {}),
                      textAlign: "center",
                      verticalAlign: "middle",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!isSelectable}
                      onChange={() => onToggleSelect(row.id)}
                      style={isArchivedRow ? tableStyles.archivedCheckbox : undefined}
                    />
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...(isArchivedRow ? tableStyles.archivedBodyCell : {}),
                    }}
                  >
                    <div style={tableStyles.familyHeadCell}>
                      <span>{row.household?.family_head_name || "-"}</span>
                      <SyncStatusIcon status={row.sync_status} />
                    </div>
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...(isArchivedRow ? tableStyles.archivedBodyCell : {}),
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        ...tableStyles.membersBadge,
                        ...(isArchivedRow ? tableStyles.archivedMembersBadge : {}),
                      }}
                    >
                      {row.household?.members_count || 0}
                    </span>
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...(isArchivedRow ? tableStyles.archivedBodyCell : {}),
                    }}
                  >
                    {formatOrderedSectorText(row.sectors_text)}
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...(isArchivedRow ? tableStyles.archivedBodyCell : {}),
                    }}
                  >
                    {getReliefPackDisplay(row)}
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...(isArchivedRow ? tableStyles.archivedBodyCell : {}),
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
                      ...(isArchivedRow ? tableStyles.archivedBodyCell : {}),
                      textAlign: "center",
                    }}
                  >
                    <div
                      className="stub-results-qr-cell"
                      style={{ width: "112px", margin: "0 auto" }}
                    >
                      <QrCodePanel
                        value={row.qr_code_value || ""}
                        emptyLabel="QR unavailable"
                        showValue={false}
                      />
                    </div>
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...(isArchivedRow ? tableStyles.archivedBodyCell : {}),
                      textAlign: "center",
                      verticalAlign: "middle",
                    }}
                  >
                    {row.is_local_only ? (
                      <span style={getStatusChipStyles("PENDING_SYNC")}>
                        Pending Sync
                      </span>
                    ) : isRowBlockedByClaimSync(row) ? (
                      <span style={getStatusChipStyles("PENDING_SYNC")}>
                        Pending Sync
                      </span>
                    ) : isClaimReadOnly && row.status === "ISSUED" ? (
                      <span style={getStatusChipStyles("ISSUED")}>
                        Unclaimed
                      </span>
                    ) : row.status === "ISSUED" ? (
                      <button
                        type="button"
                        onClick={() => onClaimStub(row.id)}
                        disabled={claimingStubId === row.id || isArchivedRow}
                        title={
                          isArchivedRow
                            ? "Archived households cannot receive a new relief distribution"
                            : "Mark as Claimed"
                        }
                        style={{
                          ...tableStyles.statusButton,
                          opacity:
                            claimingStubId === row.id || isArchivedRow ? 0.55 : 1,
                          cursor:
                            claimingStubId === row.id
                              ? "wait"
                              : isArchivedRow
                                ? "not-allowed"
                                : "pointer",
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
                      title={row.is_local_only ? "Available after sync" : "View Household Details"}
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

export default StubResultsTable;
