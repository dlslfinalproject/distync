import React from "react";
import { FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";

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
  width: "min(760px, 100%)",
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

const closeButtonStyles = {
  border: "1px solid #c6d8ea",
  borderRadius: "14px",
  width: "42px",
  height: "42px",
  backgroundColor: "#f8fbfe",
  color: "#24496e",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const InventoryExportModal = ({
  isOpen,
  isSubmitting,
  selectedCategory,
  selectedStatus,
  selectedFormat,
  errorMessage,
  onCategoryChange,
  onStatusChange,
  onFormatChange,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="inventory-export-modal-backdrop" style={overlayStyles}>
      <form className="inventory-export-modal" onSubmit={onSubmit} style={modalStyles}>
        <div
          className="inventory-export-modal-topbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <h3
            style={{
              margin: 0,
              color: "#17324d",
              fontSize: "26px",
              fontWeight: 800,
            }}
          >
            Inventory Items Report
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={closeButtonStyles}
            aria-label="Close export report modal"
          >
            <FiX size={20} />
          </button>
        </div>

        <section className="inventory-export-section" style={{ ...shellStyles.card, marginBottom: "18px" }}>
          <h4
            style={{
              margin: "0 0 14px",
              color: "#17324d",
              fontSize: "18px",
              fontWeight: 800,
            }}
          >
            Export Details
          </h4>
          <div
            className="inventory-export-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "16px",
              alignItems: "start",
            }}
          >
            <div>
              <label htmlFor="inventory-export-category" style={labelStyles}>
                Item Category
              </label>
              <select
                id="inventory-export-category"
                value={selectedCategory}
                onChange={(event) => onCategoryChange?.(event.target.value)}
                style={inputStyles}
                disabled={isSubmitting}
              >
                <option value="All">All</option>
                <option value="Perishable">Perishable</option>
                <option value="Non-Perishable">Non-Perishable</option>
              </select>
            </div>

            <div>
              <label htmlFor="inventory-export-status" style={labelStyles}>
                Stock Status
              </label>
              <select
                id="inventory-export-status"
                value={selectedStatus}
                onChange={(event) => onStatusChange?.(event.target.value)}
                style={inputStyles}
                disabled={isSubmitting}
              >
                <option value="All">All</option>
                <option value="Available">Available</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Near Expiry">Near Expiry</option>
                <option value="Expired">Expired</option>
                <option value="Depleted">Depleted</option>
              </select>
            </div>

            <div>
              <label htmlFor="inventory-export-format" style={labelStyles}>
                Format
              </label>
              <select
                id="inventory-export-format"
                value={selectedFormat}
                onChange={(event) => onFormatChange?.(event.target.value)}
                style={inputStyles}
                disabled={isSubmitting}
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
          </div>

          {errorMessage ? <p style={errorTextStyles}>{errorMessage}</p> : null}
        </section>

        <div
          className="inventory-export-actions"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={pageHeaderStyles.secondaryButton}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              ...pageHeaderStyles.primaryButton,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Exporting..." : "Export"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InventoryExportModal;
