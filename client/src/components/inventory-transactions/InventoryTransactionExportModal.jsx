import React from "react";
import { FiCheckSquare, FiSquare, FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(23, 50, 77, 0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "clamp(12px, 4vw, 24px)",
  zIndex: 1500,
  boxSizing: "border-box",
};

const modalStyles = {
  width: "min(860px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#ffffff",
  borderRadius: "24px",
  boxShadow: "0 24px 54px rgba(31, 64, 95, 0.22)",
  padding: "clamp(18px, 4vw, 28px)",
  boxSizing: "border-box",
  minWidth: 0,
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
  minWidth: 0,
  textOverflow: "ellipsis",
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

const sectionTitleStyles = {
  margin: "0 0 14px",
  color: "#17324d",
  fontSize: "18px",
  fontWeight: 800,
};

const errorTextStyles = {
  margin: "14px 0 0",
  color: "#b42318",
  fontSize: "13px",
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
  flex: "0 0 auto",
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
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
});

const defaultTransactionFilters = {
  inventory_item_id: "",
  inventory_batch_id: "",
  transaction_label: "",
  date_from: "",
  date_to: "",
  source: "",
  stock_form_packaging: [],
};

const transactionTypeOptions = [
  { value: "", label: "All transaction types" },
  { value: "Stock-Up", label: "Stock-Up" },
  { value: "Donated", label: "Donated" },
  { value: "Donation Adjustment", label: "Donation Adjustment" },
  { value: "Distributed", label: "Distributed" },
  { value: "Damaged", label: "Damaged" },
  { value: "Spoiled", label: "Spoiled" },
  { value: "Missing", label: "Missing" },
  { value: "Stolen", label: "Stolen" },
  { value: "Expired", label: "Expired" },
  { value: "Other", label: "Other" },
];

const sourceOptions = [
  { value: "", label: "All sources" },
  { value: "Malvar LGU", label: "Malvar LGU" },
  { value: "Donors", label: "Donors" },
];

const InventoryTransactionExportModal = ({
  isOpen,
  isSubmitting = false,
  inventoryItems = [],
  inventoryBatches = [],
  stockFormOptions = [],
  filters = defaultTransactionFilters,
  selectedFormat = "csv",
  formatOptions = [],
  errorMessage = "",
  onFilterChange,
  onStockFormToggle,
  onSelectAllStockForms,
  onClearStockForms,
  onFormatChange,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) {
    return null;
  }

  const selectedItemId = filters.inventory_item_id || "";
  const selectedStockForms = Array.isArray(filters.stock_form_packaging)
    ? filters.stock_form_packaging
    : [];
  const batchOptions = inventoryBatches
    .filter(
      (batch) =>
        String(batch.inventory_item_id || batch.inventory_item?.id || "") ===
        String(selectedItemId),
    )
    .sort((left, right) =>
      String(left.batch_no || "").localeCompare(String(right.batch_no || "")),
    );
  const allPackagingSelected =
    stockFormOptions.length > 0 &&
    stockFormOptions.every((packaging) => selectedStockForms.includes(packaging));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit?.();
  };

  return (
    <div className="inventory-tracking-export-modal-backdrop" style={overlayStyles}>
      <form
        className="inventory-tracking-export-modal"
        onSubmit={handleSubmit}
        style={modalStyles}
      >
        <div
          className="inventory-tracking-export-modal-topbar"
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
              fontSize: "clamp(21px, 5vw, 26px)",
              fontWeight: 800,
              lineHeight: 1.15,
              overflowWrap: "anywhere",
              minWidth: 0,
            }}
          >
            Inventory Tracking Report
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={closeButtonStyles}
            aria-label="Close inventory tracking report modal"
          >
            <FiX size={20} />
          </button>
        </div>

        <section
          className="inventory-tracking-export-section"
          style={{ ...shellStyles.card, marginBottom: "18px" }}
        >
          <h4 style={sectionTitleStyles}>Export Details</h4>

          <div
            className="inventory-tracking-export-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
              gap: "18px",
              alignItems: "start",
            }}
          >
            <div className="inventory-tracking-export-field inventory-tracking-export-field--half">
              <label htmlFor="tracking-export-item" style={labelStyles}>
                Item
              </label>
              <select
                id="tracking-export-item"
                value={filters.inventory_item_id || ""}
                onChange={(event) =>
                  onFilterChange?.("inventory_item_id", event.target.value)
                }
                style={inputStyles}
                disabled={isSubmitting}
              >
                <option value="">All items</option>
                {[...inventoryItems]
                  .sort((left, right) =>
                    String(left.item_name || "").localeCompare(
                      String(right.item_name || ""),
                    ),
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.item_name || "Unnamed item"}
                    </option>
                  ))}
              </select>
            </div>

            <div className="inventory-tracking-export-field inventory-tracking-export-field--half">
              <label htmlFor="tracking-export-batch" style={labelStyles}>
                Batch
              </label>
              <select
                id="tracking-export-batch"
                value={filters.inventory_batch_id || ""}
                onChange={(event) =>
                  onFilterChange?.("inventory_batch_id", event.target.value)
                }
                style={inputStyles}
                disabled={isSubmitting || !selectedItemId}
              >
                <option value="">
                  {selectedItemId ? "All batches" : "Select an item first"}
                </option>
                {batchOptions.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_no || "Unnamed batch"}
                  </option>
                ))}
              </select>
            </div>

            <div className="inventory-tracking-export-field inventory-tracking-export-field--third">
              <label htmlFor="tracking-export-transaction" style={labelStyles}>
                Transaction
              </label>
              <select
                id="tracking-export-transaction"
                value={filters.transaction_label || ""}
                onChange={(event) =>
                  onFilterChange?.("transaction_label", event.target.value)
                }
                style={inputStyles}
                disabled={isSubmitting}
              >
                {transactionTypeOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="inventory-tracking-export-field inventory-tracking-export-field--third">
              <label htmlFor="tracking-export-date-from" style={labelStyles}>
                Date From
              </label>
              <input
                id="tracking-export-date-from"
                type="date"
                value={filters.date_from || ""}
                onChange={(event) =>
                  onFilterChange?.("date_from", event.target.value)
                }
                style={inputStyles}
                disabled={isSubmitting}
              />
            </div>

            <div className="inventory-tracking-export-field inventory-tracking-export-field--third">
              <label htmlFor="tracking-export-date-to" style={labelStyles}>
                Date To
              </label>
              <input
                id="tracking-export-date-to"
                type="date"
                value={filters.date_to || ""}
                onChange={(event) => onFilterChange?.("date_to", event.target.value)}
                style={inputStyles}
                disabled={isSubmitting}
              />
            </div>

            <div className="inventory-tracking-export-field inventory-tracking-export-field--half">
              <label htmlFor="tracking-export-source" style={labelStyles}>
                Source
              </label>
              <select
                id="tracking-export-source"
                value={filters.source || ""}
                onChange={(event) => onFilterChange?.("source", event.target.value)}
                style={inputStyles}
                disabled={isSubmitting}
              >
                {sourceOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="inventory-tracking-export-field inventory-tracking-export-field--half">
              <label htmlFor="tracking-export-format" style={labelStyles}>
                Format
              </label>
              <select
                id="tracking-export-format"
                value={selectedFormat}
                onChange={(event) => onFormatChange?.(event.target.value)}
                style={inputStyles}
                disabled={isSubmitting}
              >
                {formatOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {errorMessage ? <p style={errorTextStyles}>{errorMessage}</p> : null}
        </section>

        <section
          className="inventory-tracking-export-section"
          style={{ ...shellStyles.card, marginBottom: "18px" }}
        >
          <h4 style={sectionTitleStyles}>Packaging / Stock Form</h4>

          {stockFormOptions.length > 0 ? (
            <>
              <div
                className="inventory-tracking-export-selection-actions"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    allPackagingSelected
                      ? onClearStockForms?.()
                      : onSelectAllStockForms?.()
                  }
                  disabled={isSubmitting}
                  style={toggleActionButtonStyles(allPackagingSelected)}
                >
                  {allPackagingSelected ? (
                    <FiCheckSquare size={14} />
                  ) : (
                    <FiSquare size={14} />
                  )}
                  {allPackagingSelected ? "Unselect All" : "Select All"}
                </button>
              </div>

              <div
                className="inventory-tracking-export-packaging-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px",
                }}
              >
                {stockFormOptions.map((packaging) => {
                  const isSelected = selectedStockForms.includes(packaging);

                  return (
                    <label key={packaging} style={chipStyles(isSelected)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onStockFormToggle?.(packaging)}
                        disabled={isSubmitting}
                        style={{ accentColor: "#2f6499" }}
                      />
                      <span>{packaging}</span>
                    </label>
                  );
                })}
              </div>
            </>
          ) : (
            <p style={{ margin: 0, color: "#5d7188", fontSize: "14px" }}>
              No packaging values are available for the current inventory data.
            </p>
          )}
        </section>

        <div
          className="inventory-tracking-export-actions"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "10px",
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

export default InventoryTransactionExportModal;
