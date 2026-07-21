import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { FiEdit2, FiEye, FiTrash2 } from "react-icons/fi";
import { formatDonationDateTime } from "../../features/donations/donationFormatters";
import DonationSyncBadge from "./DonationSyncBadges";
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
    color: "#17324d",
    fontWeight: 700,
    lineHeight: 1.45,
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

const DonationsTab = ({
  isLoading,
  filteredDonations,
  selectedEventLabel,
  onOpenDonationDetail,
  onOpenDonationModal,
  onDeleteDonation,
}) => {
  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "16px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Received Donations</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
          Current filter: {selectedEventLabel}
        </p>
      </div>

      {isLoading ? (
        <p style={shellStyles.mutedText}>Loading donation records...</p>
      ) : filteredDonations.length === 0 ? (
        <p style={shellStyles.mutedText}>
          No matching records found. Try adjusting your search or filters.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                {["Donor", "Item", "Quantity Per Item", "Date", "Sync", "Actions"].map(
                  (label) => (
                    <th
                      key={label}
                      style={tableStyles.headerCell}
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filteredDonations.map((donation) => {
                const itemDetails = getDonationItemDetails(donation);

                return (
                  <tr key={donation.id}>
                    <td style={tableStyles.bodyCell}>
                      <div style={{ fontWeight: 700 }}>{donation.donor_name}</div>
                      <div style={tableStyles.mutedText}>{donation.donor_type}</div>
                    </td>
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
                    <td style={tableStyles.bodyCell}>
                      <div style={tableStyles.stackedList}>
                        {itemDetails.quantityLines.map((line, index) => (
                          <div key={`${donation.id}-quantity-${index}`} style={tableStyles.stackedListRow}>
                            {line}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={tableStyles.bodyCell}>
                      {formatDonationDateTime(donation.received_at)}
                    </td>
                    <td style={tableStyles.bodyCell}>
                      <DonationSyncBadge status={donation.sync_status} />
                    </td>
                    <td
                      style={{
                        ...tableStyles.bodyCell,
                        ...tableStyles.centeredBodyCell,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          minHeight: "36px",
                        }}
                      >
                        <TableActionsMenu
                          row={donation}
                          menuId={`donation-actions-${donation.id}`}
                          disabled={donation.is_local_only}
                          buttonTitle={
                            donation.is_local_only ? "Available after sync" : "Donation actions"
                          }
                          buttonAriaLabel={
                            donation.is_local_only
                              ? "Donation actions unavailable until synced"
                              : "Donation actions"
                          }
                          variant="icon-grid"
                          menuWidth={156}
                          items={[
                            {
                              key: "view-details",
                              label: "View Details",
                              icon: <FiEye size={18} />,
                              onClick: (row) => onOpenDonationDetail(row.id),
                              disabled: donation.is_local_only,
                              title: donation.is_local_only ? "Available after sync" : undefined,
                            },
                            {
                              key: "edit",
                              label: "Edit",
                              icon: <FiEdit2 size={18} />,
                              onClick: (row) => onOpenDonationModal(row.id),
                              disabled: donation.is_local_only,
                              title: donation.is_local_only ? "Available after sync" : undefined,
                            },
                            {
                              key: "delete",
                              label: "Delete",
                              icon: <FiTrash2 size={18} />,
                              tone: "destructive",
                              onClick: (row) => onDeleteDonation(row),
                              disabled: donation.is_local_only,
                              title: donation.is_local_only ? "Available after sync" : undefined,
                            },
                          ]}
                        />
                      </div>
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
