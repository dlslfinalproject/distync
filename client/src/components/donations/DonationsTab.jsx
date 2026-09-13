import React, { useEffect, useState } from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { FiEdit2, FiEye, FiPower } from "react-icons/fi";
import {
  formatDonationDateTime,
  formatDonorType,
} from "../../features/donations/donationFormatters";
import { getDonationTypeKey } from "../../features/donations/donationType";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  getTablePaginationState,
  TABLE_PAGE_SIZE_OPTIONS,
} from "../../features/pagination/pagination.mjs";
import TableActionsMenu from "../shared/TableActionsMenu";
import TablePagination from "../shared/TablePagination";
import { DONATION_PAGE_PANEL_STYLE } from "./DonationPageTabs";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "980px",
  },
  headerCell: {
    boxSizing: "border-box",
    padding: "14px 16px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "nowrap",
  },
  donorHeaderCell: {
    width: "180px",
    minWidth: "180px",
  },
  bodyCell: {
    boxSizing: "border-box",
    padding: "16px",
    color: "#21405f",
    borderBottom: "1px solid #edf3f8",
    fontSize: "14px",
    verticalAlign: "top",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  donorBodyCell: {
    width: "180px",
    minWidth: "180px",
    wordBreak: "normal",
  },
  itemsHeaderCell: {
    width: "21%",
    minWidth: "210px",
  },
  itemsBodyCell: {
    width: "21%",
    minWidth: "210px",
  },
  disasterEventHeaderCell: {
    width: "210px",
    minWidth: "210px",
  },
  disasterEventBodyCell: {
    width: "210px",
    minWidth: "210px",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },
  quantityHeaderCell: {
    width: "100px",
    minWidth: "100px",
    padding: "14px 8px",
  },
  quantityBodyCell: {
    width: "100px",
    minWidth: "100px",
    padding: "16px 8px",
  },
  dateHeaderCell: {
    width: "154px",
    minWidth: "154px",
    padding: "14px 8px",
  },
  dateBodyCell: {
    width: "154px",
    minWidth: "154px",
    padding: "16px 8px",
  },
  actionHeaderCell: {
    width: "86px",
    minWidth: "86px",
    padding: "14px 8px",
    textAlign: "center",
  },
  actionBodyCell: {
    width: "86px",
    minWidth: "86px",
    padding: "16px 8px",
    textAlign: "center",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  mutedText: {
    color: "#6b8298",
    fontSize: "13px",
  },
  centeredBodyCell: {
    textAlign: "center",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  stackedList: {
    display: "grid",
    gap: "8px",
  },
  stackedListRow: {
    color: "#21405f",
    fontWeight: 400,
    lineHeight: 1.5,
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
  donorCell: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
};

const getDonationItemDetails = (donation) => {
  const items = donation.items || [];

  if (items.length === 0) {
    return {
      itemLines: ["--"],
      quantityLines: ["0"],
    };
  }

  const itemLines = items.map(
    (item) => item.inventory_item?.item_name || "Inventory item",
  );
  const quantityLines = items.map(
    (item) =>
      `${item.quantity_received} ${item.inventory_item?.unit_of_measure || "unit(s)"}`,
  );

  return {
    itemLines,
    quantityLines,
  };
};

const getDonationTypeLabel = (donation) => {
  return getDonationTypeKey(donation?.items) === "RELIEF_PACK"
    ? "Relief Pack"
    : "Loose Item";
};

const DonationsTab = ({
  isLoading,
  errorMessage = "",
  filteredDonations,
  showDisasterEventColumn = false,
  embedded = false,
  panelId = "donation-management-donations-panel",
  tabId = "donation-management-donations-tab",
  onOpenDonationDetail,
  onOpenDonationModal,
  onOpenDonorNameVisibility,
}) => {
  const safeRows = Array.isArray(filteredDonations) ? filteredDonations : [];
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
  const pagination = getTablePaginationState({
    totalItems: safeRows.length,
    currentPage,
    pageSize,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
  });
  const paginatedDonations = safeRows.slice(
    (pagination.currentPage - 1) * pagination.pageSize,
    pagination.currentPage * pagination.pageSize,
  );

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
      ariaLabel="Donations pagination"
      previousAriaLabel="Go to previous donations page"
      nextAriaLabel="Go to next donations page"
    />
  );

  const headerLabels = showDisasterEventColumn
    ? [
        "Donor",
        "Donation Form",
        "Disaster Event",
        "Items",
        "Quantity",
        "Date",
      ]
    : [
        "Donor",
        "Donation Form",
        "Items",
        "Quantity",
        "Date",
      ];

  return (
    <section
      id={panelId}
      role="tabpanel"
      aria-labelledby={tabId}
      className="mayor-donation-management-records-card"
      style={embedded ? DONATION_PAGE_PANEL_STYLE : shellStyles.card}
    >
      <div style={{ marginBottom: "16px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Received Donations</h3>
      </div>

      {paginationBar}

      {isLoading ? (
        <p style={shellStyles.mutedText}>Loading donation records...</p>
      ) : safeRows.length === 0 ? (
        <p style={shellStyles.mutedText}>
          No matching records found. Try adjusting your search or filters.
        </p>
      ) : (
        <div className="mayor-donation-management-table-scroll" style={{ overflowX: "auto" }}>
          <table className="mayor-donation-management-table" style={tableStyles.table}>
            <thead>
              <tr>
                {headerLabels.map((label) => (
                  <th
                    key={label}
                    style={
                      label === "Donor"
                        ? {
                            ...tableStyles.headerCell,
                            ...tableStyles.donorHeaderCell,
                          }
                        : label === "Items"
                        ? {
                            ...tableStyles.headerCell,
                            ...tableStyles.itemsHeaderCell,
                          }
                        : label === "Donation Form" ||
                            label === "Disaster Event" ||
                            label === "Quantity" ||
                            label === "Date"
                        ? {
                            ...tableStyles.headerCell,
                            ...(label === "Disaster Event"
                              ? tableStyles.disasterEventHeaderCell
                              : label === "Quantity"
                              ? tableStyles.quantityHeaderCell
                              : label === "Date"
                              ? tableStyles.dateHeaderCell
                              : {}),
                            textAlign: "center",
                          }
                        : tableStyles.headerCell
                    }
                  >
                    {label}
                  </th>
                ))}
                <th
                  style={{
                    ...tableStyles.headerCell,
                    ...tableStyles.actionHeaderCell,
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedDonations.map((donation) => {
                const itemDetails = getDonationItemDetails(donation);
                const donationTypeLabel = getDonationTypeLabel(donation);

                return (
                  <tr key={donation.id}>
                    <td
                      style={{
                        ...tableStyles.bodyCell,
                        ...tableStyles.donorBodyCell,
                      }}
                    >
                      <div style={tableStyles.donorCell}>
                        <span style={{ fontWeight: 700 }}>{donation.donor_name}</span>
                      </div>
                      <div style={tableStyles.mutedText}>
                        {formatDonorType(
                          donation.donor_type,
                          donation.donor_type_other,
                        )}
                      </div>
                    </td>
                    <td
                      style={{
                        ...tableStyles.bodyCell,
                        ...tableStyles.centeredBodyCell,
                        ...tableStyles.quantityBodyCell,
                      }}
                    >
                      {donationTypeLabel}
                    </td>
                    {showDisasterEventColumn ? (
                      <td
                        style={{
                          ...tableStyles.bodyCell,
                          ...tableStyles.centeredBodyCell,
                          ...tableStyles.disasterEventBodyCell,
                        }}
                      >
                        {donation.disaster_event?.title || "--"}
                      </td>
                    ) : null}
                    <td
                      style={{
                        ...tableStyles.bodyCell,
                        ...tableStyles.itemsBodyCell,
                      }}
                    >
                      <div style={tableStyles.stackedList}>
                        {itemDetails.itemLines.map((line, index) => (
                          <div
                            key={`${donation.id}-item-${index}`}
                            style={tableStyles.itemNameRow}
                          >
                            <div style={tableStyles.itemNameText} title={line}>
                              {line}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td
                      style={{
                        ...tableStyles.bodyCell,
                        ...tableStyles.centeredBodyCell,
                        ...tableStyles.dateBodyCell,
                      }}
                    >
                      <div style={tableStyles.stackedList}>
                        {itemDetails.quantityLines.map((line, index) => (
                          <div key={`${donation.id}-quantity-${index}`} style={tableStyles.stackedListRow}>
                            {line}
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
                      {formatDonationDateTime(donation.received_at)}
                    </td>
                    <td
                      style={{
                        ...tableStyles.bodyCell,
                        ...tableStyles.actionBodyCell,
                      }}
                    >
                      <TableActionsMenu
                        row={donation}
                        menuId={`donation-actions-${donation.id}`}
                        buttonTitle="Actions"
                        buttonAriaLabel="Actions"
                        variant="icon-grid"
                        menuWidth={168}
                        items={[
                          {
                            key: "view-details",
                            label: "View Donation Details",
                            icon: <FiEye size={18} />,
                            onClick: (row) => onOpenDonationDetail(row.id),
                          },
                          {
                            key: "edit",
                            label: "Edit Donation Details",
                            icon: <FiEdit2 size={18} />,
                            onClick: (row) => onOpenDonationModal(row.id),
                          },
                          {
                            key: "donor-name-visibility",
                            label:
                              donation.donor_name_public === true
                                ? "Unpublish Donor Name"
                                : "Publish Donor Name",
                            icon: <FiPower size={18} />,
                            onClick: (row) => onOpenDonorNameVisibility(row),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default DonationsTab;
