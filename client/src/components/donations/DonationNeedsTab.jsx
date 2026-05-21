import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { compactButtonStyles } from "../../features/donations/donationUi";
import DonationStatusBadge from "./DonationStatusBadge";
import DonationSyncBadge from "./DonationSyncBadges";

const destructiveButtonStyles = {
  ...compactButtonStyles,
  color: "#b91c1c",
  borderColor: "#f1d2cc",
};

const DonationNeedsTab = ({
  isLoading,
  filteredDonationNeeds,
  selectedEventLabel,
  canManageDonations,
  onOpenNeedModal,
  onDeleteDonationNeed,
}) => {
  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "16px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Published Donation Needs</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
          Current filter: {selectedEventLabel}
        </p>
      </div>

      {isLoading ? (
        <p style={shellStyles.mutedText}>Loading donation needs...</p>
      ) : filteredDonationNeeds.length === 0 ? (
        <p style={shellStyles.mutedText}>
          No donation needs are available for the current filters.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  "Event",
                  "Item",
                  "Quantity Needed",
                  "Priority",
                  "Visibility",
                  "Sync",
                  "Notes",
                  ...(canManageDonations ? ["Actions"] : []),
                ].map((label) => (
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
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDonationNeeds.map((need) => (
                <tr key={need.id}>
                  <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                    {need.disaster_event?.event_code} - {need.disaster_event?.title}
                  </td>
                  <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                    {need.inventory_item?.item_name}
                  </td>
                  <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                    {need.quantity_needed}
                  </td>
                  <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                    <DonationStatusBadge label={need.priority_level} />
                  </td>
                  <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                    <DonationStatusBadge label={need.is_active ? "ACTIVE" : "INACTIVE"} />
                  </td>
                  <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                    <DonationSyncBadge status={need.sync_status} />
                  </td>
                  <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                    {need.notes || "--"}
                  </td>
                  {canManageDonations ? (
                    <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => onOpenNeedModal(need)}
                          style={compactButtonStyles}
                          disabled={need.is_local_only}
                          title={need.is_local_only ? "Available after sync" : undefined}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteDonationNeed(need)}
                          style={destructiveButtonStyles}
                          disabled={need.is_local_only}
                          title={need.is_local_only ? "Available after sync" : undefined}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default DonationNeedsTab;
