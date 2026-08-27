import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { FiEdit2, FiEye, FiRepeat } from "react-icons/fi";
import {
  formatDonationDateTime,
  formatDonorType,
} from "../../features/donations/donationFormatters";
import SyncStatusIcon from "../shared/SyncStatusIcon";
import TableActionsMenu from "../shared/TableActionsMenu";

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
    verticalAlign: "top",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  actionHeaderCell: {
    width: "72px",
    minWidth: "72px",
    textAlign: "center",
  },
  actionBodyCell: {
    width: "72px",
    minWidth: "72px",
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
  const items = donation.items || [];

  if (
    items.length > 0 &&
    items.every((item) => String(item?.remarks || "").startsWith("Relief Pack:"))
  ) {
    return "Relief Pack";
  }

  return "Loose Item";
};

const DonationsTab = ({
  isLoading,
  filteredDonations,
  showDisasterEventColumn = false,
  onOpenDonationDetail,
  onOpenDonationModal,
  onOpenReassignLeftoverStock,
}) => {
  const headerLabels = showDisasterEventColumn
    ? [
        "Donor",
        "Donation Type",
        "Disaster Event",
        "Item Name",
        "Quantity Per Item",
        "Date",
      ]
    : [
        "Donor",
        "Donation Type",
        "Item Name",
        "Quantity Per Item",
        "Date",
      ];

  return (
    <section className="mayor-donation-management-records-card" style={shellStyles.card}>
      <div style={{ marginBottom: "16px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Received Donations</h3>
      </div>

      {isLoading ? (
        <p style={shellStyles.mutedText}>Loading donation records...</p>
      ) : filteredDonations.length === 0 ? (
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
                      label === "Donation Type" ||
                      label === "Disaster Event" ||
                      label === "Quantity Per Item" ||
                      label === "Date"
                        ? {
                            ...tableStyles.headerCell,
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
              {filteredDonations.map((donation) => {
                const itemDetails = getDonationItemDetails(donation);
                const donationTypeLabel = getDonationTypeLabel(donation);

                return (
                  <tr key={donation.id}>
                    <td style={tableStyles.bodyCell}>
                      <div style={tableStyles.donorCell}>
                        <span style={{ fontWeight: 700 }}>{donation.donor_name}</span>
                        <SyncStatusIcon status={donation.sync_status} />
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
                      }}
                    >
                      {donationTypeLabel}
                    </td>
                    {showDisasterEventColumn ? (
                      <td
                        style={{
                          ...tableStyles.bodyCell,
                          ...tableStyles.centeredBodyCell,
                        }}
                      >
                        {donation.disaster_event?.title || "--"}
                      </td>
                    ) : null}
                    <td style={tableStyles.bodyCell}>
                      <div style={tableStyles.stackedList}>
                        {itemDetails.itemLines.map((line, index) => (
                          <div
                            key={`${donation.id}-item-${index}`}
                            style={tableStyles.stackedListRow}
                          >
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
                        disabled={donation.is_local_only}
                        buttonTitle={
                          donation.is_local_only ? "Available after sync" : "Actions"
                        }
                        buttonAriaLabel="Actions"
                        variant="icon-grid"
                        menuWidth={168}
                        items={[
                          {
                            key: "view-details",
                            label: "View Donation Details",
                            icon: <FiEye size={18} />,
                            onClick: (row) => onOpenDonationDetail(row.id),
                            disabled: donation.is_local_only,
                            title: donation.is_local_only ? "Available after sync" : undefined,
                          },
                          {
                            key: "edit",
                            label: "Edit Donation Details",
                            icon: <FiEdit2 size={18} />,
                            onClick: (row) => onOpenDonationModal(row.id),
                            disabled: donation.is_local_only,
                            title: donation.is_local_only ? "Available after sync" : undefined,
                          },
                          {
                            key: "reassign-leftover",
                            label: "Reassign Leftover Stock",
                            icon: <FiRepeat size={18} />,
                            onClick: (row) => onOpenReassignLeftoverStock(row),
                            disabled:
                              donation.is_local_only ||
                              !donation.can_reassign_leftover_stock,
                            title: donation.is_local_only
                              ? "Available after sync"
                              : donation.can_reassign_leftover_stock
                                ? undefined
                                : "Available for remaining donated stock after the event is closed",
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
