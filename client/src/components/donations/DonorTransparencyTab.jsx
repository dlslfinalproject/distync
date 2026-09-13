import React, { useEffect, useState } from "react";
import { shellStyles } from "../layout/BarangayLayout";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  getTablePaginationState,
  TABLE_PAGE_SIZE_OPTIONS,
} from "../../features/pagination/pagination.mjs";
import TablePagination from "../shared/TablePagination";
import { DONATION_PAGE_PANEL_STYLE } from "./DonationPageTabs";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1080px",
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
    wordBreak: "break-word",
  },
  centeredBodyCell: {
    textAlign: "center",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  disasterEventBodyCell: {
    textAlign: "center",
    verticalAlign: "middle",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },
  mutedText: {
    color: "#6b8298",
    fontSize: "12px",
    lineHeight: 1.45,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },
  stackedList: {
    display: "grid",
    gap: "8px",
  },
  itemNameRow: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    minWidth: 0,
  },
  itemNameText: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value || 0));
const formatQuantityWithUnit = (value, unit) =>
  `${formatNumber(value)} ${unit || "items"}`;
const formatWriteOffReason = (reason) => {
  const normalizedReason = String(reason || "").trim();

  if (!normalizedReason) {
    return "--";
  }

  return normalizedReason
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const DonorTransparencyTab = ({
  portalData,
  transparencyRows: providedTransparencyRows,
  isLoading = false,
  errorMessage = "",
  showDisasterEventColumn = false,
  embedded = false,
  panelId = "donation-management-transparency-panel",
  tabId = "donation-management-transparency-tab",
}) => {
  const transparencyRows = Array.isArray(providedTransparencyRows)
    ? providedTransparencyRows
    : portalData.transparency_summary?.received_vs_distributed || [];
  const safeRows = Array.isArray(transparencyRows) ? transparencyRows : [];
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const pagination = getTablePaginationState({
    totalItems: safeRows.length,
    currentPage,
    pageSize,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
  });
  const paginatedTransparencyRows = safeRows.slice(
    (pagination.currentPage - 1) * pagination.pageSize,
    pagination.currentPage * pagination.pageSize,
  );
  const transparencyColumnWidths = showDisasterEventColumn
    ? ["14%", "15%", "20%", "10%", "17%", "13%", "11%"]
    : ["17%", "25%", "11%", "18%", "14%", "15%"];

  useEffect(() => {
    setCurrentPage(1);
  }, [safeRows]);

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

  const paginationBar = (
    <TablePagination
      totalItems={pagination.totalItems}
      currentPage={pagination.currentPage}
      pageSize={pagination.pageSize}
      pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS}
      onPageChange={setCurrentPage}
      onPageSizeChange={handlePageSizeChange}
      isVisible={!isLoading && !errorMessage && pagination.totalItems > 0}
      ariaLabel="Transparency summary pagination"
      previousAriaLabel="Go to previous transparency summary page"
      nextAriaLabel="Go to next transparency summary page"
    />
  );

  return (
    <section
      id={panelId}
      role="tabpanel"
      aria-labelledby={tabId}
      className="mayor-donation-management-records-card"
      style={embedded ? DONATION_PAGE_PANEL_STYLE : shellStyles.card}
    >
        <div
          style={{
            marginBottom: "20px",
            display: "grid",
            gap: "16px",
          }}
        >
          <h3 style={{ margin: 0, color: "#17324d" }}>
            Donation Item Transparency
          </h3>
        </div>

        {paginationBar}

        {isLoading ? (
          <p style={shellStyles.mutedText}>Loading transparency summary...</p>
        ) : safeRows.length === 0 ? (
          <p style={shellStyles.mutedText}>
            No donated inventory summaries are available yet.
          </p>
        ) : (
          <div className="mayor-donation-management-table-scroll" style={{ overflowX: "auto" }}>
            <table
              className="mayor-donation-management-table mayor-donation-transparency-table"
              style={tableStyles.table}
            >
              <colgroup>
                {transparencyColumnWidths.map((width, index) => (
                  <col key={`transparency-column-${index}`} style={{ width }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th style={tableStyles.headerCell}>Donor</th>
                  {showDisasterEventColumn ? (
                    <th
                      style={{
                        ...tableStyles.headerCell,
                        textAlign: "center",
                      }}
                    >
                      Disaster Event
                    </th>
                  ) : null}
                  <th style={tableStyles.headerCell}>Items</th>
                  <th
                    style={{
                      ...tableStyles.headerCell,
                      textAlign: "center",
                    }}
                  >
                    Received
                  </th>
                  <th
                    style={{
                      ...tableStyles.headerCell,
                      textAlign: "center",
                    }}
                  >
                    Distributed
                  </th>
                  <th
                    style={{
                      ...tableStyles.headerCell,
                      textAlign: "center",
                    }}
                  >
                    Written Off
                  </th>
                  <th
                    style={{
                      ...tableStyles.headerCell,
                      textAlign: "center",
                    }}
                  >
                    Remaining
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransparencyRows.map((row) => (
                  <tr
                    key={row.public_key || `${row.donor_name}-${row.item_name}`}
                  >
                    <td style={tableStyles.bodyCell}>
                      <span style={{ fontWeight: 700 }}>
                        {row.donor_name || "--"}
                      </span>
                    </td>
                    {showDisasterEventColumn ? (
                      <td
                        style={{
                          ...tableStyles.bodyCell,
                          ...tableStyles.disasterEventBodyCell,
                        }}
                      >
                        {row.disaster_event_title || "--"}
                      </td>
                    ) : null}
                    <td style={tableStyles.bodyCell}>
                      <div style={tableStyles.itemNameRow}>
                        <div
                          style={tableStyles.itemNameText}
                          title={row.item_name || "--"}
                        >
                          {row.item_name || "--"}
                        </div>
                      </div>
                    </td>
                    <td
                      style={{
                        ...tableStyles.bodyCell,
                        ...tableStyles.centeredBodyCell,
                      }}
                    >
                      {formatQuantityWithUnit(
                        row.quantity_received,
                        row.unit_of_measure,
                      )}
                    </td>
                    <td
                      style={{
                        ...tableStyles.bodyCell,
                        ...tableStyles.centeredBodyCell,
                      }}
                    >
                      <div style={tableStyles.stackedList}>
                        <div>
                          {formatQuantityWithUnit(
                            row.quantity_distributed,
                            row.unit_of_measure,
                          )}
                        </div>
                        {(row.distribution_event_breakdown || []).map(
                          (eventRow) => (
                            <div
                              key={`${row.public_key}-${eventRow.event_id || "unassigned"}`}
                              style={tableStyles.mutedText}
                            >
                              {eventRow.event_title || "Unassigned disaster event"}: {" "}
                              {formatQuantityWithUnit(
                                eventRow.quantity,
                                row.unit_of_measure,
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </td>
                    <td
                      style={{
                        ...tableStyles.bodyCell,
                        ...tableStyles.centeredBodyCell,
                      }}
                    >
                      <div style={tableStyles.stackedList}>
                        <div>
                          {formatQuantityWithUnit(
                            row.quantity_written_off,
                            row.unit_of_measure,
                          )}
                        </div>
                        {(row.write_off_reasons || []).map((reasonRow) => (
                          <div
                            key={`${row.public_key}-${reasonRow.reason}`}
                            style={tableStyles.mutedText}
                          >
                            {formatWriteOffReason(reasonRow.reason)}:{" "}
                            {formatQuantityWithUnit(
                              reasonRow.quantity,
                              row.unit_of_measure,
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td
                      style={{
                        ...tableStyles.bodyCell,
                        ...tableStyles.centeredBodyCell,
                      }}
                    >
                      <div style={tableStyles.stackedList}>
                        <div>
                          {formatQuantityWithUnit(
                            row.quantity_remaining,
                            row.unit_of_measure,
                          )}
                        </div>
                        {(row.transfer_event_breakdown || []).map(
                          (eventRow) => (
                            <div
                              key={`${row.public_key}-${eventRow.event_id || "unassigned"}`}
                              style={tableStyles.mutedText}
                            >
                              Transferred to {eventRow.event_title || "Unassigned disaster event"}: {" "}
                              {formatQuantityWithUnit(
                                eventRow.quantity,
                                row.unit_of_measure,
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
};

export default DonorTransparencyTab;
