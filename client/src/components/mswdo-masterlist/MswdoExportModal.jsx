import React from "react";
import { FiX, FiCheckSquare, FiSquare } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(21, 40, 63, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1300,
};

const modalStyles = {
  width: "min(860px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#eef5fb",
  borderRadius: "22px",
  border: "1px solid #d7e2ef",
  boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  padding: "24px",
  boxSizing: "border-box",
};

const inputStyles = {
  width: "100%",
  minHeight: "48px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #d2deea",
  boxSizing: "border-box",
  fontSize: "14px",
  color: "#21405f",
  backgroundColor: "#ffffff",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
};

const chipStyles = (isSelected) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  border: isSelected ? "1px solid #4c86be" : "1px solid #d4dfeb",
  borderRadius: "999px",
  padding: "10px 14px",
  backgroundColor: isSelected ? "#eef5fb" : "#f8fbfe",
  color: isSelected ? "#21405f" : "#385a7b",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
});

const mutedChipStyles = {
  border: "1px solid #dbe5ef",
  borderRadius: "999px",
  padding: "10px 14px",
  backgroundColor: "#f5f8fb",
  color: "#89a0b6",
  fontSize: "13px",
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  cursor: "not-allowed",
  opacity: 0.82,
};

const sectionTitleStyles = {
  margin: "0 0 12px",
  color: "#17324d",
};

const toggleActionButtonStyles = (isSelected) => ({
  border: isSelected ? "none" : "1px solid #c6d8ea",
  borderRadius: "14px",
  padding: "10px 16px",
  background: isSelected
    ? "linear-gradient(135deg, #2f6499 0%, #4c86be 100%)"
    : "#f8fbfe",
  color: isSelected ? "#ffffff" : "#2a4c6f",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "6px",
});

const getEventSortValue = (event) => {
  const sortableDate =
    event?.ended_at || event?.end_date || event?.start_date || event?.created_at;

  if (!sortableDate) {
    return 0;
  }

  const parsedValue = new Date(sortableDate).getTime();
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
};

const getEventCodeSortValue = (event) => {
  const eventCode = String(event?.event_code || "").trim().toUpperCase();
  const match = eventCode.match(/^DE-(\d{4})-(\d{4})$/);

  if (!match) {
    return 0;
  }

  return Number(`${match[1]}${match[2]}`);
};

const sortDisasterEvents = (events = []) => {
  return [...events].sort((left, right) => {
    const codeDifference =
      getEventCodeSortValue(right) - getEventCodeSortValue(left);

    if (codeDifference !== 0) {
      return codeDifference;
    }

    const dateDifference = getEventSortValue(right) - getEventSortValue(left);

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return String(right?.event_code || "").localeCompare(
      String(left?.event_code || ""),
    );
  });
};

const MswdoExportModal = ({
  isOpen,
  isSubmitting,
  disasterEvents,
  barangays,
  sectors,
  selectedDisasterEventId,
  selectedBarangayIds,
  selectedRecordStatus,
  selectedSortOrder,
  selectedSectorIds,
  availableSectorIds,
  availableBarangayIds,
  selectedFormat,
  onClose,
  onSubmit,
  onDisasterEventChange,
  onBarangayToggle,
  onSelectAllBarangays,
  onClearBarangays,
  onRecordStatusChange,
  onSortOrderChange,
  onSectorToggle,
  onClearSectors,
  onFormatChange,
  sortOptions,
}) => {
  if (!isOpen) {
    return null;
  }

  const sortedEvents = sortDisasterEvents(disasterEvents);
  const selectedEvent = sortedEvents.find(
    (event) => event.id === selectedDisasterEventId,
  );
  const availableSectorIdSet = new Set(availableSectorIds || []);
  const availableBarangayIdSet = new Set(availableBarangayIds || []);
  const selectableSectorIds = sectors
    .map((sector) => sector.id)
    .filter((sectorId) => availableSectorIdSet.has(sectorId));
  const areAllSectorsSelected =
    selectableSectorIds.length > 0 &&
    selectableSectorIds.every((sectorId) => selectedSectorIds.includes(sectorId));
  const selectableBarangayIds = barangays
    .map((barangay) => barangay.id)
    .filter((barangayId) => availableBarangayIdSet.has(barangayId));
  const areAllApplicableBarangaysSelected =
    selectableBarangayIds.length > 0 &&
    selectableBarangayIds.every((barangayId) =>
      selectedBarangayIds.includes(barangayId),
    );

  return (
    <div style={overlayStyles}>
      <div style={modalStyles}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: "#17324d", fontSize: "26px" }}>
              Export MSWDO Report
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={pageHeaderStyles.secondaryButton}
            disabled={isSubmitting}
          >
            <FiX />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={sectionTitleStyles}>Export Details</h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyles}>Disaster Event</label>
                <select
                  value={selectedDisasterEventId}
                  onChange={(event) => onDisasterEventChange(event.target.value)}
                  style={inputStyles}
                  disabled={isSubmitting}
                >
                  <option value="">Select disaster event</option>
                  {sortedEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.event_code} - {event.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyles}>Registration Record</label>
                <select
                  value={selectedRecordStatus}
                  onChange={(event) => onRecordStatusChange(event.target.value)}
                  style={inputStyles}
                  disabled={isSubmitting}
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="all">All</option>
                </select>
              </div>

              <div>
                <label style={labelStyles}>Order List</label>
                <select
                  value={selectedSortOrder}
                  onChange={(event) => onSortOrderChange(event.target.value)}
                  style={inputStyles}
                  disabled={isSubmitting}
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyles}>Format</label>
                <select
                  value={selectedFormat}
                  onChange={(event) => onFormatChange(event.target.value)}
                  style={inputStyles}
                  disabled={isSubmitting}
                >
                  <option value="csv">CSV</option>
                  <option value="excel">Excel</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>
            </div>
          </section>

          <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={sectionTitleStyles}>Sectors</h3>
            <p
              style={{
                margin: "0 0 12px",
                color: "#5f7890",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              Leave blank to include all records. Selecting one or more sectors
              will include records that match any of the selected sectors.
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "12px",
              }}
            >
              <button
                type="button"
                onClick={areAllSectorsSelected ? onClearSectors : () => {
                  selectableSectorIds.forEach((sectorId) => {
                    if (!selectedSectorIds.includes(sectorId)) {
                      onSectorToggle(sectorId);
                    }
                  });
                }}
                style={toggleActionButtonStyles(areAllSectorsSelected)}
                disabled={isSubmitting || selectableSectorIds.length === 0}
              >
                {areAllSectorsSelected ? (
                  <FiCheckSquare size={14} />
                ) : (
                  <FiSquare size={14} />
                )}
                {areAllSectorsSelected ? "Unselect All" : "Select All"}
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              {sectors.map((sector) => {
                const isSelected = selectedSectorIds.includes(sector.id);
                const isAvailable = availableSectorIdSet.has(sector.id);

                if (!isAvailable) {
                  return (
                    <label key={sector.id} style={mutedChipStyles}>
                      <input type="checkbox" checked={false} disabled />
                      {sector.display_name || sector.name}
                    </label>
                  );
                }

                return (
                  <label key={sector.id} style={chipStyles(isSelected)}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSectorToggle(sector.id)}
                      disabled={isSubmitting}
                    />
                    {sector.display_name || sector.name}
                  </label>
                );
              })}
            </div>
          </section>

          <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={sectionTitleStyles}>Barangay</h3>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "12px",
              }}
            >
              <button
                type="button"
                onClick={
                  areAllApplicableBarangaysSelected
                    ? onClearBarangays
                    : onSelectAllBarangays
                }
                style={toggleActionButtonStyles(areAllApplicableBarangaysSelected)}
                disabled={isSubmitting || selectableBarangayIds.length === 0}
              >
                {areAllApplicableBarangaysSelected ? (
                  <FiCheckSquare size={14} />
                ) : (
                  <FiSquare size={14} />
                )}
                {areAllApplicableBarangaysSelected ? "Unselect All" : "Select All"}
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              {barangays.map((barangay) => {
                const isApplicable = availableBarangayIdSet.has(barangay.id);
                const isSelected = selectedBarangayIds.includes(barangay.id);

                if (!isApplicable) {
                  return (
                    <label key={barangay.id} style={mutedChipStyles}>
                      <input type="checkbox" checked={false} disabled />
                      {barangay.name}
                    </label>
                  );
                }

                return (
                  <label key={barangay.id} style={chipStyles(isSelected)}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onBarangayToggle(barangay.id)}
                      disabled={isSubmitting}
                    />
                    {barangay.name}
                  </label>
                );
              })}
            </div>
          </section>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "10px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={pageHeaderStyles.secondaryButton}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={
                isSubmitting ||
                !selectedDisasterEventId ||
                selectedBarangayIds.length === 0
              }
              style={{
                ...pageHeaderStyles.primaryButton,
                opacity:
                  isSubmitting ||
                  !selectedDisasterEventId ||
                  selectedBarangayIds.length === 0
                    ? 0.7
                    : 1,
              }}
            >
              {isSubmitting ? "Exporting..." : "Export"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MswdoExportModal;
