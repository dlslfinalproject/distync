import React, { useEffect, useState } from "react";
import { FiEye } from "react-icons/fi";
import { shellStyles } from "../layout/BarangayLayout";
import EmptyState from "../shared/EmptyState";
import ErrorState from "../shared/ErrorState";
import LoadingState from "../shared/LoadingState";
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
    tableLayout: "fixed",
  },
  tableWithAddress: {
    minWidth: "1040px",
    maxWidth: "none",
  },
  tableWithoutAddress: {
    minWidth: "880px",
    maxWidth: "none",
  },
  familyHeadColumn: {
    width: "220px",
  },
  familyHeadColumnWide: {
    width: "250px",
  },
  addressColumn: {
    width: "180px",
  },
  sectorsColumn: {
    width: "300px",
  },
  sectorsColumnWide: {
    width: "300px",
  },
  reliefPackColumn: {
    width: "260px",
  },
  reliefPackColumnWide: {
    width: "260px",
  },
  statusColumn: {
    width: "170px",
  },
  authorizedByColumn: {
    width: "260px",
  },
  actionColumn: {
    width: "96px",
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
    lineHeight: 1.5,
    overflowWrap: "break-word",
    wordBreak: "normal",
  },
  centeredCell: {
    textAlign: "center",
  },
  statusCell: {
    textAlign: "center",
    verticalAlign: "top",
  },
  statusContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
  },
  authorizedByCell: {
    textAlign: "center",
    verticalAlign: "top",
  },
  authorizedByContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: "36px",
  },
  actionButton: {
    border: "1px solid #c6d8ea",
    borderRadius: "12px",
    width: "36px",
    height: "36px",
    padding: 0,
    backgroundColor: "#f8fbfe",
    color: "#2a4c6f",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  mutedText: {
    color: "#6b8298",
    fontSize: "13px",
  },
  claimedDate: {
    display: "block",
    marginTop: "6px",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.35,
  },
};

const formatClaimedDateTime = (value) => {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
};

const getStatusMeta = (status, label) => {
  if (status === "CLAIMED") {
    return {
      label: label || "Claimed",
      style: {
        backgroundColor: "#e6f5ec",
        color: "#2d7a4f",
        border: "1px solid transparent",
      },
    };
  }

  if (status === "ISSUED") {
    return {
      label: label || "For Claim",
      style: {
        backgroundColor: "#eef5fc",
        color: "#295f92",
        border: "1px solid transparent",
      },
    };
  }

  return {
    label: label || "--",
    style: {
      backgroundColor: "#f6ebeb",
      color: "#9d4d58",
      border: "1px solid transparent",
    },
  };
};

const buildReliefPackLines = (row) => {
  const lineMap = new Map();

  const addLine = (value) => {
    const label = String(value || "").trim();

    if (!label || label === "--") {
      return;
    }

    const key = label.toUpperCase();

    if (!lineMap.has(key)) {
      lineMap.set(key, label);
    }
  };

  if (Array.isArray(row.relief_pack_templates)) {
    row.relief_pack_templates.forEach((template) => {
      addLine(template.name || "Relief Pack");
    });
  }

  if (Array.isArray(row.donated_relief_packs)) {
    row.donated_relief_packs.forEach((pack) => {
      addLine(pack.name);
    });
  }

  if (Array.isArray(row.donated_loose_items)) {
    row.donated_loose_items.forEach((item) => {
      const donorName = String(item.donor_name || "").trim();
      addLine(donorName ? `${donorName} Donation` : "Donor Donation");
    });
  }

  if (lineMap.size === 0) {
    addLine(row.relief_pack_name);
  }

  return [...lineMap.values()];
};

const renderReliefPackItems = (row) => {
  const reliefPackLines = buildReliefPackLines(row);

  if (reliefPackLines.length === 0) {
    return (
      <span style={tableStyles.mutedText}>
        Relief pack allocation will appear here once assigned.
      </span>
    );
  }

  return (
    <div style={{ display: "grid", gap: "6px" }}>
      {reliefPackLines.map((line) => (
        <div key={line} style={{ fontWeight: 400 }}>
          {line}
        </div>
      ))}
    </div>
  );
};

const InventoryDistributionTable = ({
  rows,
  isLoading,
  errorMessage,
  hasSelectedEvent,
  showBarangayColumn = false,
  onViewDetails,
}) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const pagination = getTablePaginationState({
    totalItems: safeRows.length,
    currentPage,
    pageSize,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
  });
  const paginatedRows = safeRows.slice(
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

  const showPagination =
    !isLoading && !errorMessage && pagination.totalItems > 0;
  const paginationBar = (
    <TablePagination
      totalItems={pagination.totalItems}
      currentPage={pagination.currentPage}
      pageSize={pagination.pageSize}
      pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS}
      onPageChange={setCurrentPage}
      onPageSizeChange={handlePageSizeChange}
      isVisible={showPagination}
      ariaLabel="Family distribution records pagination"
      previousAriaLabel="Go to previous family distribution records page"
      nextAriaLabel="Go to next family distribution records page"
    />
  );

  if (!hasSelectedEvent) {
    return (
      <section className="inventory-distribution-records-card" style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Distribution</h3>
        <div style={{ marginTop: "10px" }}>
          <EmptyState
            compact
            message="Please select a disaster event to load distribution records."
          />
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="inventory-distribution-records-card" style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Distribution</h3>
        <div style={{ marginTop: "10px" }}>
          <LoadingState message="Loading distribution records..." />
        </div>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="inventory-distribution-records-card" style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Distribution</h3>
        <div style={{ marginTop: "10px" }}>
          <ErrorState compact message={errorMessage} />
        </div>
      </section>
    );
  }

  if (safeRows.length === 0) {
    return (
      <section className="inventory-distribution-records-card" style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Distribution</h3>
        <div style={{ marginTop: "10px" }}>
          <EmptyState
            compact
            message="No matching records found. Try adjusting your search or filters."
          />
        </div>
      </section>
    );
  }

  return (
    <section className="inventory-distribution-records-card" style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Family Distribution Records</h3>
      </div>

      {paginationBar}

      <div
        className="inventory-distribution-table-scroll"
        style={{ overflowX: "auto" }}
      >
        <table
          className="inventory-distribution-table"
          style={{
            ...tableStyles.table,
            ...(showBarangayColumn
              ? tableStyles.tableWithAddress
              : tableStyles.tableWithoutAddress),
          }}
        >
          <colgroup>
            {showBarangayColumn ? (
              <>
                <col style={tableStyles.familyHeadColumn} />
                <col style={tableStyles.addressColumn} />
                <col style={tableStyles.sectorsColumn} />
                <col style={tableStyles.reliefPackColumn} />
                <col style={tableStyles.statusColumn} />
                <col style={tableStyles.authorizedByColumn} />
                <col style={tableStyles.actionColumn} />
              </>
            ) : (
              <>
                <col style={tableStyles.familyHeadColumnWide} />
                <col style={tableStyles.sectorsColumnWide} />
                <col style={tableStyles.reliefPackColumnWide} />
                <col style={tableStyles.statusColumn} />
                <col style={tableStyles.authorizedByColumn} />
                <col style={tableStyles.actionColumn} />
              </>
            )}
          </colgroup>
          <thead>
            <tr>
              <th
                className="inventory-distribution-header-cell"
                style={tableStyles.headerCell}
              >
                Family Head
              </th>
              {showBarangayColumn ? (
                <th
                  className="inventory-distribution-header-cell"
                  style={tableStyles.headerCell}
                >
                  Address
                </th>
              ) : null}
              <th
                className="inventory-distribution-header-cell"
                style={tableStyles.headerCell}
              >
                Sectors
              </th>
              <th
                className="inventory-distribution-header-cell"
                style={tableStyles.headerCell}
              >
                Relief Pack
              </th>
              <th
                className="inventory-distribution-header-cell inventory-distribution-status-cell"
                style={{
                  ...tableStyles.headerCell,
                  ...tableStyles.statusCell,
                }}
              >
                Status
              </th>
              <th
                className="inventory-distribution-header-cell"
                style={{
                  ...tableStyles.headerCell,
                  ...tableStyles.authorizedByCell,
                }}
              >
                Authorized By
              </th>
              <th
                className="inventory-distribution-header-cell inventory-distribution-actions-cell"
                style={{
                  ...tableStyles.headerCell,
                  ...tableStyles.centeredCell,
                }}
              >
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row) => {
              const statusMeta = getStatusMeta(
                row.distribution_status,
                row.distribution_status_label,
              );
              const claimedDateTime =
                row.distribution_status === "CLAIMED"
                  ? formatClaimedDateTime(row.claimed_at)
                  : "";

              return (
                <tr
                  key={
                    row.masterlist_record_id || row.stub_id || row.household_id
                  }
                >
                  <td
                    className="inventory-distribution-table-cell inventory-distribution-text-cell"
                    style={tableStyles.bodyCell}
                  >
                    <div style={{ fontWeight: 700 }}>{row.family_head_name}</div>
                  </td>
                  {showBarangayColumn ? (
                    <td
                      className="inventory-distribution-table-cell inventory-distribution-text-cell"
                      style={tableStyles.bodyCell}
                    >
                      {row.address || row.barangay_name || "-"}
                    </td>
                  ) : null}
                  <td
                    className="inventory-distribution-table-cell inventory-distribution-text-cell"
                    style={tableStyles.bodyCell}
                  >
                    {row.sectors_text && row.sectors_text !== "-" ? (
                      row.sectors_text
                    ) : (
                      <span style={tableStyles.mutedText}>No sector tags</span>
                    )}
                  </td>
                  <td
                    className="inventory-distribution-table-cell inventory-distribution-text-cell"
                    style={tableStyles.bodyCell}
                  >
                    {renderReliefPackItems(row)}
                  </td>
                  <td
                    className="inventory-distribution-table-cell inventory-distribution-status-cell"
                    style={{
                      ...tableStyles.bodyCell,
                      ...tableStyles.statusCell,
                    }}
                  >
                    <div style={tableStyles.statusContent}>
                      <span
                        className="inventory-distribution-status-badge"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          padding: "7px 12px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 700,
                          lineHeight: 1,
                          ...statusMeta.style,
                        }}
                      >
                        {statusMeta.label}
                      </span>
                      {claimedDateTime ? (
                        <span style={tableStyles.claimedDate}>
                          {claimedDateTime}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td
                    className="inventory-distribution-table-cell inventory-distribution-text-cell"
                    style={{
                      ...tableStyles.bodyCell,
                      ...tableStyles.authorizedByCell,
                    }}
                  >
                    <div style={tableStyles.authorizedByContent}>
                      {row.authorized_by_name ? (
                        row.authorized_by_name
                      ) : (
                        <span style={tableStyles.mutedText}>--</span>
                      )}
                    </div>
                  </td>
                  <td
                    className="inventory-distribution-table-cell inventory-distribution-actions-cell"
                    style={{
                      ...tableStyles.bodyCell,
                      ...tableStyles.centeredCell,
                    }}
                  >
                    <button
                      className="inventory-distribution-action-button"
                      type="button"
                      onClick={() => onViewDetails?.(row)}
                      style={tableStyles.actionButton}
                      title="View Details"
                      aria-label="View Details"
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

export default InventoryDistributionTable;
