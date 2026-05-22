import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { formatDonationDateTime } from "../../features/donations/donationFormatters";
import DonationStatusBadge from "./DonationStatusBadge";
import DonationSyncBadge from "./DonationSyncBadges";
import TableActionsMenu from "../shared/TableActionsMenu";

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
          No donations are available for the current filters yet.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Received At", "Donor", "Event", "Status", "Sync", "Items", "Quantity", "Actions"].map(
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
              {filteredDonations.map((donation) => (
                <tr key={donation.id}>
                  <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                    {formatDonationDateTime(donation.received_at)}
                  </td>
                  <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                    <div style={{ fontWeight: 700 }}>{donation.donor_name}</div>
                    <div style={{ color: "#60738a", fontSize: "13px" }}>{donation.donor_type}</div>
                  </td>
                  <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                    {donation.disaster_event?.event_code} - {donation.disaster_event?.title}
                  </td>
                  <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                    <DonationStatusBadge label={donation.status} />
                  </td>
                  <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                    <DonationSyncBadge status={donation.sync_status} />
                  </td>
                  <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                    {donation.item_count}
                  </td>
                  <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                    {donation.total_quantity_received}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default DonationsTab;
