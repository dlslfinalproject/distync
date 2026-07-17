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
  isExportingTransparency,
  onOpenTransparencyExport,
}) => {
  return (
    <section
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", flex: "1 1 760px" }}>
        <select
          value={selectedEventId}
          onChange={(event) => onSelectedEventChange(event.target.value)}
          style={{ ...inputStyles, maxWidth: "340px" }}
        >
          <option value="">All Events</option>
          {disasterEvents.map((eventRow) => (
            <option key={eventRow.id} value={eventRow.id}>
              {eventRow.event_code} - {eventRow.title}
            </option>
          ))}
        </select>

        {activeTab === "donations" ? (
          <SearchBar
            value={donationSearch}
            onChange={onDonationSearchChange}
            placeholder="Search donations by donor or event"
          />
        ) : null}
      </div>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {canManageDonations && activeTab === "transparency" ? (
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
        {canManageDonations && activeTab === "donations" ? (
          <button
            type="button"
            onClick={onOpenDonationModal}
            style={pageHeaderStyles.primaryButton}
          >
            Add Donation
          </button>
        ) : null}
      </div>
    </section>
  );
};

export default DonationFilters;
