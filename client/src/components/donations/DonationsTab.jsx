import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { formatDonationDateTime } from "../../features/donations/donationFormatters";
import DonationStatusBadge from "./DonationStatusBadge";
import DonationSyncBadge from "./DonationSyncBadges";
import TableActionsMenu from "../shared/TableActionsMenu";

const getDonationItemSummary = (donation) => {
  const items = donation.items || [];

  if (items.length === 0) {
    return {
      label: "--",
      detail: "No item entries",
      quantityLabel: "0",
    };
  }

  const reliefPackRemarks = items
    .map((item) => item.remarks || "")
    .filter((remarks) => remarks.startsWith("Relief Pack:"));

  if (reliefPackRemarks.length === items.length) {
    const reliefPackLabel = reliefPackRemarks[0]
      .replace("Relief Pack:", "")
      .split(".")[0]
      .trim();
    const packQuantity = reliefPackLabel.match(/\sx\s(\d+)$/i)?.[1];
    const reliefPackName = reliefPackLabel.replace(/\sx\s\d+$/i, "").trim();

    return {
      label: reliefPackName || "Relief Pack",
      detail: `${items.length} inventory item(s) from donor`,
      quantityLabel: packQuantity
        ? `${packQuantity} relief pack(s)`
        : `${donation.total_quantity_received} item unit(s)`,
    };
  }

  if (items.length === 1) {
    return {
      label: items[0].inventory_item?.item_name || "Inventory item",
      detail: "Donated item",
      quantityLabel: `${items[0].quantity_received} ${
        items[0].inventory_item?.unit_of_measure || "unit(s)"
      }`,
    };
  }

  return {
    label: `${items.length} donated item entries`,
    detail: items
      .slice(0, 3)
      .map((item) => item.inventory_item?.item_name)
      .filter(Boolean)
      .join(", "),
    quantityLabel: `${donation.total_quantity_received} item unit(s)`,
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
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Received At", "Donor", "Item / Relief Pack", "Quantity", "Source", "Status", "Actions"].map(
                  (label) => (
                    <th
                      key={label}
                      style={{
                        padding: "12px 14px",
                        textAlign: "left",
                        fontSize: "12px",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#66809c",
                        borderBottom: "1px solid #e0eaf4",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filteredDonations.map((donation) => {
                const itemSummary = getDonationItemSummary(donation);

                return (
                  <tr key={donation.id}>
                    <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                      {formatDonationDateTime(donation.received_at)}
                    </td>
                    <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                      <div style={{ fontWeight: 700 }}>{donation.donor_name}</div>
                      <div style={{ color: "#60738a", fontSize: "13px" }}>{donation.donor_type}</div>
                    </td>
                    <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                      <div style={{ fontWeight: 700 }}>{itemSummary.label}</div>
                      <div style={{ color: "#60738a", fontSize: "13px" }}>{itemSummary.detail}</div>
                    </td>
                    <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8", fontWeight: 800 }}>
                      {itemSummary.quantityLabel}
                    </td>
                    <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                      Donor
                    </td>
                    <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                      <div style={{ display: "grid", gap: "6px" }}>
                        <DonationStatusBadge label={donation.status} />
                        <DonationSyncBadge status={donation.sync_status} />
                      </div>
                    </td>
                    <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
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
                          items={[
                            {
                              key: "view-details",
                              label: "View Details",
                              onClick: (row) => onOpenDonationDetail(row.id),
                              disabled: donation.is_local_only,
                              title: donation.is_local_only ? "Available after sync" : undefined,
                            },
                            {
                              key: "edit",
                              label: "Edit",
                              onClick: (row) => onOpenDonationModal(row.id),
                              disabled: donation.is_local_only,
                              title: donation.is_local_only ? "Available after sync" : undefined,
                            },
                            {
                              key: "delete",
                              label: "Delete",
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
