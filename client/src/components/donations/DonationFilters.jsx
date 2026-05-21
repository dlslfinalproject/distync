import React from "react";
import { FiFileText } from "react-icons/fi";
import SearchBar from "../shared/SearchBar";
import { pageHeaderStyles } from "../layout/PageHeader";
import { inputStyles } from "../../features/donations/donationUi";
import DonationExportModal from "./DonationExportModal";

const DonationFilters = ({
  activeTab,
  canManageDonations,
  selectedEventId,
  disasterEvents,
  needSearch,
  donationSearch,
  onSelectedEventChange,
  onNeedSearchChange,
  onDonationSearchChange,
  onRefresh,
  onOpenNeedModal,
  onOpenDonationModal,
  isExportingTransparency,
  isTransparencyExportMenuOpen,
  onToggleTransparencyExportMenu,
  onExportTransparency,
  transparencyExportOptions,
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

        {activeTab === "needs" ? (
          <SearchBar
            value={needSearch}
            onChange={onNeedSearchChange}
            placeholder="Search needs by item, event, or notes"
          />
        ) : activeTab === "donations" ? (
          <SearchBar
            value={donationSearch}
            onChange={onDonationSearchChange}
            placeholder="Search donations by donor, event, or remarks"
          />
        ) : null}
      </div>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button type="button" onClick={onRefresh} style={pageHeaderStyles.secondaryButton}>
          Refresh
        </button>
        {canManageDonations && activeTab === "transparency" ? (
          <DonationExportModal
            isOpen={isTransparencyExportMenuOpen}
            isExporting={Boolean(isExportingTransparency)}
            exportLabel={
              isExportingTransparency
                ? `Exporting ${isExportingTransparency.toUpperCase()}...`
                : "Export"
            }
            icon={<FiFileText size={16} />}
            options={transparencyExportOptions}
            onToggle={onToggleTransparencyExportMenu}
            onSelectOption={onExportTransparency}
          />
        ) : null}
        {canManageDonations && activeTab === "needs" ? (
          <button type="button" onClick={onOpenNeedModal} style={pageHeaderStyles.primaryButton}>
            Create Donation Need
          </button>
        ) : canManageDonations && activeTab === "donations" ? (
          <button
            type="button"
            onClick={onOpenDonationModal}
            style={pageHeaderStyles.primaryButton}
          >
            Record Donation
          </button>
        ) : null}
      </div>
    </section>
  );
};

export default DonationFilters;
