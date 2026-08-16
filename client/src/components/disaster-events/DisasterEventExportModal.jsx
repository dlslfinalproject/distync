import React from "react";
import { FiCheckSquare, FiSquare, FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";
import { MASTERLIST_SORT_OPTIONS } from "../../features/masterlist/masterlistService";
import { DISASTER_TYPE_OPTIONS as SHARED_DISASTER_TYPE_OPTIONS } from "../../features/disaster-events/disasterTypeOptions";


const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(23, 50, 77, 0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1500,
};

const modalStyles = {
  width: "min(860px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#ffffff",
  borderRadius: "24px",
  boxShadow: "0 24px 54px rgba(31, 64, 95, 0.22)",
  padding: "28px",
  boxSizing: "border-box",
};

const inputStyles = {
  width: "100%",
  minHeight: "48px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #cbdbea",
  boxSizing: "border-box",
  fontSize: "14px",
  color: "#17324d",
  backgroundColor: "#f8fbfe",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#48627d",
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const errorTextStyles = {
  margin: "8px 0 0",
  color: "#dc2626",
  fontSize: "12px",
  lineHeight: 1.4,
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
  margin: "0 0 14px",
  color: "#17324d",
  fontSize: "18px",
  fontWeight: 800,
};

const closeButtonStyles = {
  border: "1px solid #c6d8ea",
  borderRadius: "14px",
  width: "42px",
  height: "42px",
  backgroundColor: "#f8fbfe",
  color: "#24496e",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
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

const sortBarangaysByName = (barangays = []) =>
  [...barangays].sort((leftBarangay, rightBarangay) =>
    String(leftBarangay?.name || "").localeCompare(
      String(rightBarangay?.name || ""),
    ),
  );

const DisasterEventExportModal = ({
  isOpen,
  isSubmitting,
  barangays,
  availableDisasterTypes,
  availableAffectedBarangayIds,
  selectedRecordStatus,
  selectedSortOrder,
  selectedDisasterTypes,
  selectedAffectedBarangayIds,
  selectedFormat,
  onClose,
  onSubmit,
  onRecordStatusChange,
  onSortOrderChange,
  onDisasterTypeToggle,
  onSelectAllDisasterTypes,
  onClearDisasterTypes,
  onAffectedBarangayToggle,
  onSelectAllBarangays,
  onClearBarangays,
  onFormatChange,
  validationErrors = {},
}) => {
  if (!isOpen) {
    return null;
  }

  const sortedBarangays = sortBarangaysByName(barangays);
  const availableDisasterTypeSet = new Set(availableDisasterTypes || []);
  const availableAffectedBarangayIdSet = new Set(availableAffectedBarangayIds || []);
  const selectableDisasterTypes = SHARED_DISASTER_TYPE_OPTIONS.filter((type) =>
    availableDisasterTypeSet.has(type),
  );
  const areAllDisasterTypesSelected =
    selectableDisasterTypes.length > 0 &&
    selectableDisasterTypes.every((type) => selectedDisasterTypes.includes(type));
  const allBarangayIds = sortedBarangays
    .map((barangay) => barangay.id)
    .filter((barangayId) => availableAffectedBarangayIdSet.has(barangayId));
  const areAllBarangaysSelected =
    allBarangayIds.length > 0 &&
    allBarangayIds.every((barangayId) =>
      selectedAffectedBarangayIds.includes(barangayId),
    );

  return (
    <div className="disaster-event-modal-backdrop" style={overlayStyles}>
      <div className="disaster-event-export-modal" style={modalStyles}>
        <div
          className="disaster-event-modal-topbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div className="disaster-event-modal-heading">
            <h3
              style={{
                margin: 0,
                color: "#17324d",
                fontSize: "26px",
                fontWeight: 800,
              }}
            >
              Disaster Events Report
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={closeButtonStyles}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            <FiX size={20} />
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
              className="disaster-event-export-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              <div>
                <label style={labelStyles}>Registration Record</label>
                <select
                  value={selectedRecordStatus}
                  onChange={(event) => onRecordStatusChange(event.target.value)}
                  style={inputStyles}
                  disabled={isSubmitting}
                >
                  <option value="active">Active</option>
                  <option value="closed">Ended</option>
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
                  {MASTERLIST_SORT_OPTIONS.map((option) => (
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
            <h3 style={sectionTitleStyles}>Disaster Type</h3>

            <div
              className="disaster-event-section-actions"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "12px",
              }}
            >
              <button
                type="button"
                onClick={
                  areAllDisasterTypesSelected
                    ? onClearDisasterTypes
                    : onSelectAllDisasterTypes
                }
                style={toggleActionButtonStyles(areAllDisasterTypesSelected)}
                disabled={isSubmitting || selectableDisasterTypes.length === 0}
              >
                {areAllDisasterTypesSelected ? (
                  <FiCheckSquare size={14} />
                ) : (
                  <FiSquare size={14} />
                )}
                {areAllDisasterTypesSelected ? "Unselect All" : "Select All"}
              </button>
            </div>

            <div
              className="disaster-event-chip-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              {SHARED_DISASTER_TYPE_OPTIONS.map((disasterType) => {
                const isSelected = selectedDisasterTypes.includes(disasterType);
                const isAvailable = availableDisasterTypeSet.has(disasterType);

                if (!isAvailable) {
                  return (
                    <label
                      className="disaster-event-form-chip"
                      key={disasterType}
                      style={mutedChipStyles}
                    >
                      <input type="checkbox" checked={false} disabled />
                      {disasterType}
                    </label>
                  );
                }

                return (
                  <label
                    className="disaster-event-form-chip"
                    key={disasterType}
                    style={chipStyles(isSelected)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onDisasterTypeToggle(disasterType)}
                      disabled={isSubmitting}
                    />
                    {disasterType}
                  </label>
                );
              })}
            </div>

            {validationErrors.disasterTypes ? (
              <p style={errorTextStyles}>{validationErrors.disasterTypes}</p>
            ) : null}
          </section>

          <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={sectionTitleStyles}>Affected Barangay</h3>

            <div
              className="disaster-event-section-actions"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: "12px",
              }}
            >
              <button
                type="button"
                onClick={
                  areAllBarangaysSelected ? onClearBarangays : onSelectAllBarangays
                }
                style={toggleActionButtonStyles(areAllBarangaysSelected)}
                disabled={isSubmitting || allBarangayIds.length === 0}
              >
                {areAllBarangaysSelected ? (
                  <FiCheckSquare size={14} />
                ) : (
                  <FiSquare size={14} />
                )}
                {areAllBarangaysSelected ? "Unselect All" : "Select All"}
              </button>
            </div>

            <div
              className="disaster-event-chip-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              {sortedBarangays.map((barangay) => {
                const isSelected = selectedAffectedBarangayIds.includes(barangay.id);
                const isAvailable = availableAffectedBarangayIdSet.has(barangay.id);

                if (!isAvailable) {
                  return (
                    <label
                      className="disaster-event-form-chip"
                      key={barangay.id}
                      style={mutedChipStyles}
                    >
                      <input type="checkbox" checked={false} disabled />
                      {barangay.name}
                    </label>
                  );
                }

                return (
                  <label
                    className="disaster-event-form-chip"
                    key={barangay.id}
                    style={chipStyles(isSelected)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onAffectedBarangayToggle(barangay.id)}
                      disabled={isSubmitting}
                    />
                    {barangay.name}
                  </label>
                );
              })}
            </div>

            {validationErrors.affectedBarangays ? (
              <p style={errorTextStyles}>{validationErrors.affectedBarangays}</p>
            ) : null}
          </section>

          <div
            className="disaster-event-modal-actions"
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
              disabled={isSubmitting}
              style={{
                ...pageHeaderStyles.primaryButton,
                opacity: isSubmitting ? 0.7 : 1,
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

export default DisasterEventExportModal;
