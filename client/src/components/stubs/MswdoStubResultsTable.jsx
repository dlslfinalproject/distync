import React, { useEffect, useState } from "react";
import { FaHandHolding } from "react-icons/fa6";
import { FiEye } from "react-icons/fi";
import { shellStyles } from "../layout/BarangayLayout";
import { formatOrderedSectorText } from "../../utils/sectorDisplay";
import SyncStatusIcon from "../shared/SyncStatusIcon";
import QrCodePanel from "./QrCodePanel";
import {
  getStubClaimUnavailableMessage,
  isCurrentlyPresentStubRow,
  isSelectableClaimStubRow,
} from "../../features/stubs/stubEligibility";
import { STUB_PRESENTATION_STATUSES } from "../../features/stubs/stubPresentation.js";
import TablePagination from "../shared/TablePagination";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  getTablePaginationState,
  TABLE_PAGE_SIZE_OPTIONS,
} from "../../features/pagination/pagination.mjs";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1040px",
    maxWidth: "none",
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
  pillHeaderCell: {
    textAlign: "center",
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
  pillBodyCell: {
    textAlign: "center",
    verticalAlign: "middle",
  },
  qrStubColumn: {
    width: "88px",
    minWidth: "88px",
  },
  statusColumn: {
    minWidth: "128px",
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
    whiteSpace: "nowrap",
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

const getReliefPackNames = (row) => {
  const assignedPackNames = [
    ...(Array.isArray(row?.assigned_relief_packs)
      ? row.assigned_relief_packs
      : []),
    ...(Array.isArray(row?.assigned_donated_relief_packs)
      ? row.assigned_donated_relief_packs
      : []),
  ]
    .map((pack) => pack?.name || pack?.pack_name || "")
    .map((name) => String(name).trim())
    .filter(Boolean);
  const fallbackNames = String(row?.relief_pack_name || "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name && name !== "--");

  return [...new Set([...assignedPackNames, ...fallbackNames])];
};

const getReliefPackDisplay = (row) => {
  const primaryTemplate = getPrimaryAssignedReliefPackTemplate(row);
  const householdSize = row?.members_count || 0;
  const packMultiplier = getReliefPackQuantityMultiplier(
    primaryTemplate,
    householdSize,
  );
  const packNames = getReliefPackNames(row);

  if (packNames.length === 0) {
    return "--";
  }

  return packNames
    .map((name, index) =>
      index === 0 && packMultiplier > 1 ? `${name} (${packMultiplier})` : name,
    )
    .join(";\n");
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
    return "For Claim";
  }

  if (status === "NOT_PRESENT") {
    return "Unclaimed";
  }

  return status || "-";
};

const isRowBlockedByClaimSync = (row) =>
  row?.is_claim_pending ||
  ["PENDING", "FAILED", "CONFLICT"].includes(
    String(row?.sync_status || "").toUpperCase(),
  );

const getClaimSyncStatusLabel = (status) => {
  if (status === "FAILED") return "Sync Failed";
  if (status === "CONFLICT") return "Conflict";
  return "Pending Sync";
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
  isEndedEvent = false,
  selectedStubIds,
  onToggleSelect,
  onSelectAll,
  onViewStub = () => {},
  isOffline = false,
  pagination: controlledPagination = null,
  onPageChange = () => {},
  onPageSizeChange = () => {},
  showBarangayColumn = false,
}) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeSelectedStubIds = Array.isArray(selectedStubIds) ? selectedStubIds : [];
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const localPagination = getTablePaginationState({
    totalItems: safeRows.length,
    currentPage,
    pageSize,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
  });
  const pagination = controlledPagination
    ? getTablePaginationState({
        totalItems: controlledPagination.totalItems,
        currentPage: controlledPagination.currentPage,
        pageSize: controlledPagination.pageSize,
        pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
      })
    : localPagination;
  const paginatedRows = controlledPagination
    ? safeRows
    : safeRows.slice(
        (pagination.currentPage - 1) * pagination.pageSize,
        pagination.currentPage * pagination.pageSize,
      );

  useEffect(() => {
    setCurrentPage(1);
  }, [rows]);

  useEffect(() => {
    setCurrentPage((previousPage) => {
      if (pagination.totalPages === 0) {
        return 1;
      }

      return Math.min(Math.max(previousPage, 1), pagination.totalPages);
    });
  }, [pagination.totalPages]);

  const handlePageSizeChange = (value) => {
    const nextPageSize = Number(value);

    if (!TABLE_PAGE_SIZE_OPTIONS.includes(nextPageSize)) {
      return;
    }

    setPageSize(nextPageSize);
    setCurrentPage(1);
  };

  const handleControlledPageSizeChange = (value) => {
    const nextPageSize = Number(value);

    if (!TABLE_PAGE_SIZE_OPTIONS.includes(nextPageSize)) {
      return;
    }

    onPageSizeChange(nextPageSize);
  };

  if (!hasSelectedEvent) {
    return (
      <section
        className="stub-results-card mswdo-stub-results-card"
        style={shellStyles.card}
      >
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Stub Information</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Please select a disaster event to load the stub information table.
        </p>
      </section>
    );
  }

  if (!hasSelectedBarangay) {
    return (
      <section
        className="stub-results-card mswdo-stub-results-card"
        style={shellStyles.card}
      >
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Stub Information</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Please select a barangay to view the stub distribution progress.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section
        className="stub-results-card mswdo-stub-results-card"
        style={shellStyles.card}
      >
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Stub Information</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Loading stub information...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section
        className="stub-results-card mswdo-stub-results-card"
        style={shellStyles.card}
      >
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

  if (safeRows.length === 0) {
    return (
      <section
        className="stub-results-card mswdo-stub-results-card"
        style={shellStyles.card}
      >
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Stub Information</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No matching records found. Try adjusting your search or filters.
        </p>
      </section>
    );
  }

  const selectableRows = isClaimReadOnly
    ? []
    : safeRows.filter((row) => isSelectableClaimStubRow(row));

  const areAllSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => safeSelectedStubIds.includes(row.id));

  return (
    <section
      className="stub-results-card mswdo-stub-results-card"
      style={shellStyles.card}
    >
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Stub Information</h3>
      </div>

      <TablePagination
        totalItems={pagination.totalItems}
        currentPage={pagination.currentPage}
        pageSize={pagination.pageSize}
        pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS}
        onPageChange={controlledPagination ? onPageChange : setCurrentPage}
        onPageSizeChange={
          controlledPagination
            ? handleControlledPageSizeChange
            : handlePageSizeChange
        }
        isVisible={!isLoading && !errorMessage && pagination.totalItems > 0}
        ariaLabel="Relief goods distribution pagination"
        previousAriaLabel="Go to previous relief goods distribution page"
        nextAriaLabel="Go to next relief goods distribution page"
      />

      {claimErrorMessage ? (
        <p
          role="alert"
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

      <div
        className="stub-results-table-scroll mswdo-stub-results-table-scroll"
        style={{ overflowX: "auto" }}
      >
        <table
          style={{
            ...tableStyles.table,
            ...(showBarangayColumn ? { minWidth: "1160px" } : {}),
          }}
          className="stub-results-table mswdo-stub-results-table"
        >
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
              {showBarangayColumn ? (
                <th style={tableStyles.headerCell}>Barangay</th>
              ) : null}
              <th
                style={{
                  ...tableStyles.headerCell,
                  ...tableStyles.qrStubColumn,
                  ...tableStyles.pillHeaderCell,
                }}
              >
                Household Size
              </th>
              <th style={tableStyles.headerCell}>Sectors</th>
              <th style={tableStyles.headerCell}>Relief Pack</th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  ...tableStyles.statusColumn,
                  ...tableStyles.pillHeaderCell,
                }}
              >
                Stub Number
              </th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  ...tableStyles.qrStubColumn,
                  ...tableStyles.pillHeaderCell,
                }}
              >
                QR Stub
              </th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  ...tableStyles.pillHeaderCell,
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
            {paginatedRows.map((row) => {
              const isSelectable =
                !isClaimReadOnly &&
                isSelectableClaimStubRow(row);
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
                      <span style={{ fontWeight: 700 }}>{row.family_head_name}</span>
                      {!isEndedEvent &&
                      row.sync_status &&
                      (row.sync_status !== "SYNCED" || isOffline) ? (
                        <SyncStatusIcon status={row.sync_status} />
                      ) : null}
                    </div>
                  </td>
                  {showBarangayColumn ? (
                    <td style={tableStyles.bodyCell}>
                      {row.barangay_name || row.barangay?.name || "-"}
                    </td>
                  ) : null}
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...tableStyles.pillBodyCell,
                    }}
                  >
                    <span style={tableStyles.stubBadge}>{row.members_count || 0}</span>
                  </td>
                  <td style={tableStyles.bodyCell}>
                    {formatOrderedSectorText(row.sectors_text)}
                  </td>
                  <td style={{ ...tableStyles.bodyCell, whiteSpace: "pre-line" }}>
                    {getReliefPackDisplay(row)}
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...tableStyles.statusColumn,
                      ...tableStyles.pillBodyCell,
                    }}
                  >
                    <div style={tableStyles.stubSequenceText}>
                      {formatDisplayStubNo(row)}
                    </div>
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...tableStyles.qrStubColumn,
                      ...tableStyles.pillBodyCell,
                    }}
                  >
                    <div
                      className="stub-results-qr-cell"
                      style={{ width: "88px", margin: "0 auto" }}
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
                      ...tableStyles.statusColumn,
                      ...tableStyles.pillBodyCell,
                    }}
                  >
                    {row.is_local_only ? (
                      <span style={getStatusChipStyles("PENDING_SYNC")}>
                        Pending Sync
                      </span>
                    ) : isRowBlockedByClaimSync(row) ? (
                      <span
                        style={getStatusChipStyles(
                          row.sync_status === "FAILED"
                            ? "FAILED_SYNC"
                            : row.sync_status === "CONFLICT"
                              ? "CONFLICT"
                              : "PENDING_SYNC",
                        )}
                      >
                        {getClaimSyncStatusLabel(row.sync_status)}
                      </span>
                    ) : row.presentation_status === STUB_PRESENTATION_STATUSES.NOT_PRESENT ? (
                      <span
                        style={getStatusChipStyles("NOT_PRESENT")}
                        title={getStubClaimUnavailableMessage(row)}
                        aria-label={`Unclaimed. ${getStubClaimUnavailableMessage(row)}`}
                      >
                        Unclaimed
                      </span>
                    ) : row.status === "ISSUED" && !isClaimReadOnly ? (
                      <button
                        type="button"
                        onClick={() => onClaimStub(row.id)}
                        disabled={
                          claimingStubId === row.id ||
                          !isCurrentlyPresentStubRow(row)
                        }
                        title={
                          !isCurrentlyPresentStubRow(row)
                            ? getStubClaimUnavailableMessage(row)
                            : "Mark as Claimed"
                        }
                        aria-label={
                          !isCurrentlyPresentStubRow(row)
                            ? getStubClaimUnavailableMessage(row)
                            : `Mark relief distribution as claimed for ${row.family_head_name || "this household"}`
                        }
                        style={{
                          ...tableStyles.statusButton,
                          opacity:
                            claimingStubId === row.id ||
                            !isCurrentlyPresentStubRow(row)
                              ? 0.55
                              : 1,
                          cursor:
                            claimingStubId === row.id ||
                            !isCurrentlyPresentStubRow(row)
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

export default MswdoStubResultsTable;
