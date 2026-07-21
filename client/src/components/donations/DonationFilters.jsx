import React from "react";
import { FiFileText } from "react-icons/fi";
import SearchBar from "../shared/SearchBar";
import { pageHeaderStyles } from "../layout/PageHeader";
import { inputStyles } from "../../features/donations/donationUi";

const DonationFilters = ({
  activeTab,
  canManageDonations,
  selectedEventId,
  disasterEvents,
  donationSearch,
  onSelectedEventChange,
  onDonationSearchChange,
  onOpenDonationModal,
  onExportDonations,
  isExportingTransparency,
  onOpenTransparencyExport,
  showEventSelector = true,
  showDonationActions = true,
  showTransparencyActions = true,
}) => {
  return (
    <section
      style={{
        display: "grid",
        gap: "20px",
      }}
    >
      {showEventSelector ? (
        <div style={{ maxWidth: "420px" }}>
          <label
            htmlFor="donation-management-disaster-event"
            style={{
              display: "block",
              marginBottom: "8px",
              color: "#58708a",
              fontSize: "12px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Disaster Event
          </label>
          <select
            id="donation-management-disaster-event"
            value={selectedEventId}
            onChange={(event) => onSelectedEventChange(event.target.value)}
            style={{ ...inputStyles, maxWidth: "100%" }}
          >
            <option value="">All Events</option>
            {disasterEvents.map((eventRow) => (
              <option key={eventRow.id} value={eventRow.id}>
                {eventRow.event_code} - {eventRow.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {activeTab === "donations" && showDonationActions ? (
        <div
          style={{
            width: "100%",
            display: "grid",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 620px", minWidth: 0 }}>
              <SearchBar
                value={donationSearch}
                onChange={onDonationSearchChange}
                placeholder="Search donations by donor or event"
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              {canManageDonations ? (
                <button
                  type="button"
                  onClick={onExportDonations}
                  style={pageHeaderStyles.secondaryButton}
                >
                  <FiFileText size={16} />
                  Export
                </button>
              ) : null}

              {canManageDonations ? (
                <button
                  type="button"
                  onClick={onOpenDonationModal}
                  style={pageHeaderStyles.primaryButton}
                >
                  Add Donation
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "transparency" && showTransparencyActions ? (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          {canManageDonations ? (
            <button
              type="button"
              onClick={onOpenTransparencyExport}
              style={pageHeaderStyles.secondaryButton}
              disabled={Boolean(isExportingTransparency)}
            >
              <FiFileText size={16} />
              {isExportingTransparency
                ? `Exporting ${isExportingTransparency.toUpperCase()}...`
                : "Export"}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default DonationFilters;
