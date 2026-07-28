import React from "react";
import DetailsModalShell from "../shared/DetailsModalShell";
import EmptyState from "../shared/EmptyState";
import ErrorState from "../shared/ErrorState";
import LoadingState from "../shared/LoadingState";
import { formatDonorType } from "../../features/donations/donationFormatters";

const modalStyles = {
  summaryCard: {
    borderRadius: "18px",
    border: "1px solid #d6e2ee",
    backgroundColor: "#ffffff",
    padding: "18px 16px",
    minHeight: "96px",
  },
  sectionCard: {
    borderRadius: "18px",
    border: "1px solid #d6e2ee",
    backgroundColor: "#ffffff",
    padding: "16px",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "14px",
  },
  sectionTitle: {
    margin: 0,
    color: "#17324d",
    fontSize: "17px",
    fontWeight: 800,
  },
  label: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    marginBottom: "6px",
  },
  value: {
    color: "#21405f",
    fontSize: "15px",
    lineHeight: 1.6,
    wordBreak: "break-word",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "10px 12px",
    textAlign: "left",
    fontSize: "12px",
    color: "#66809c",
    borderBottom: "1px solid #dfe8f2",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #edf3f8",
    color: "#21405f",
    fontSize: "14px",
    verticalAlign: "top",
  },
};

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const DonationDetailModal = ({
  isOpen,
  isLoading,
  errorMessage,
  detail,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  const donation = detail?.donation || null;
  const stockUpdateHistory = detail?.stock_update_history || [];
  const auditHistory = detail?.audit_history || [];
  const items = donation?.items || [];
  const eventLabel = [donation?.disaster_event?.event_code, donation?.disaster_event?.title]
    .filter(Boolean)
    .join(" - ");

  return (
    <DetailsModalShell
      isOpen={isOpen}
      title="Donation Detail"
      onClose={onClose}
      maxWidth="980px"
    >
      {isLoading ? (
        <LoadingState message="Loading donation detail..." />
      ) : errorMessage ? (
        <ErrorState compact message={errorMessage} />
      ) : !donation ? (
        <EmptyState compact message="Donation detail is unavailable." />
      ) : (
        <div style={{ display: "grid", gap: "18px" }}>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {[
              ["Donor", donation.donor_name || "--"],
              ["Donor Type", formatDonorType(donation.donor_type)],
              ["Contact Info", donation.contact_information || "--"],
              ["Status", donation.status || "--"],
              ["Received At", formatDateTime(donation.received_at)],
              ["Event", eventLabel || "--"],
            ].map(([label, value]) => (
              <div key={label} style={modalStyles.summaryCard}>
                <div style={modalStyles.label}>{label}</div>
                <div style={modalStyles.value}>{value}</div>
              </div>
            ))}
          </section>

          <section style={modalStyles.sectionCard}>
            <div style={modalStyles.sectionHeader}>
              <h4 style={modalStyles.sectionTitle}>Donation Items</h4>
            </div>
            {items.length === 0 ? (
              <EmptyState compact message="No donation items yet." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={modalStyles.table}>
                  <thead>
                    <tr>
                      <th style={modalStyles.th}>Item</th>
                      <th style={modalStyles.th}>Quantity</th>
                      <th style={modalStyles.th}>Linked Batch</th>
                      <th style={modalStyles.th}>Batch Source</th>
                      <th style={modalStyles.th}>Available Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td style={modalStyles.td}>{item.inventory_item?.item_name || "--"}</td>
                        <td style={modalStyles.td}>{item.quantity_received ?? 0}</td>
                        <td style={modalStyles.td}>{item.inventory_batch?.batch_no || "--"}</td>
                        <td style={modalStyles.td}>{item.inventory_batch?.source_type || "--"}</td>
                        <td style={modalStyles.td}>{item.inventory_batch?.quantity_available ?? "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section style={modalStyles.sectionCard}>
            <div style={modalStyles.sectionHeader}>
              <h4 style={modalStyles.sectionTitle}>Stock Update History</h4>
            </div>
            {stockUpdateHistory.length === 0 ? (
              <EmptyState compact message="No stock update history yet." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={modalStyles.table}>
                  <thead>
                    <tr>
                      <th style={modalStyles.th}>Transaction Type</th>
                      <th style={modalStyles.th}>Item</th>
                      <th style={modalStyles.th}>Batch</th>
                      <th style={modalStyles.th}>Quantity</th>
                      <th style={modalStyles.th}>Performed By</th>
                      <th style={modalStyles.th}>Date</th>
                      <th style={modalStyles.th}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockUpdateHistory.map((entry) => (
                      <tr key={entry.id}>
                        <td style={modalStyles.td}>{entry.transaction_type || "--"}</td>
                        <td style={modalStyles.td}>{entry.item_name || "--"}</td>
                        <td style={modalStyles.td}>{entry.batch_no || "--"}</td>
                        <td style={modalStyles.td}>{entry.quantity ?? 0}</td>
                        <td style={modalStyles.td}>
                          {[entry.performed_by_first_name, entry.performed_by_last_name]
                            .filter(Boolean)
                            .join(" ") || "--"}
                        </td>
                        <td style={modalStyles.td}>{formatDateTime(entry.performed_at)}</td>
                        <td style={modalStyles.td}>{entry.remarks || "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section style={modalStyles.sectionCard}>
            <div style={modalStyles.sectionHeader}>
              <h4 style={modalStyles.sectionTitle}>Audit History</h4>
            </div>
            {auditHistory.length === 0 ? (
              <EmptyState compact message="No audit history yet." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={modalStyles.table}>
                  <thead>
                    <tr>
                      <th style={modalStyles.th}>Action</th>
                      <th style={modalStyles.th}>Performed By</th>
                      <th style={modalStyles.th}>Role</th>
                      <th style={modalStyles.th}>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditHistory.map((entry) => (
                      <tr key={entry.id}>
                        <td style={modalStyles.td}>{entry.action || "--"}</td>
                        <td style={modalStyles.td}>{entry.actor_name || "--"}</td>
                        <td style={modalStyles.td}>{entry.role_code || "--"}</td>
                        <td style={modalStyles.td}>{formatDateTime(entry.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </DetailsModalShell>
  );
};

export default DonationDetailModal;
