import React, { useEffect, useRef } from "react";
import { FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";

const COLORS = {
  muted: "#6b8298",
};

const scanModalOverlayStyle = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(21, 40, 63, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1200,
};

const scanModalStyle = {
  width: "min(720px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#eef5fb",
  borderRadius: "22px",
  border: "1px solid #d7e2ef",
  boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  padding: "24px",
  boxSizing: "border-box",
};

const scanModalInputStyle = {
  width: "100%",
  minHeight: "52px",
  padding: "14px 16px",
  borderRadius: "14px",
  border: "1px solid #d2deea",
  boxSizing: "border-box",
  fontSize: "16px",
  color: "#21405f",
  backgroundColor: "#ffffff",
  outline: "none",
};

const scanModalLockedInputStyle = {
  ...scanModalInputStyle,
  backgroundColor: "#eef5fb",
  color: "#5f7891",
  cursor: "not-allowed",
};

const scanModalLabelStyle = {
  display: "block",
  marginBottom: "8px",
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
};

const styles = {
  scanModalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "20px",
  },
  scanModalTitle: {
    margin: 0,
    color: "#17324d",
    fontSize: "26px",
  },
  scanModalSectionTitle: {
    margin: "0 0 12px",
    color: "#17324d",
  },
  scanModalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "10px",
    flexWrap: "wrap",
  },
  helperText: {
    margin: "10px 0 0",
    color: "#4f677f",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  feedbackText: {
    margin: "10px 0 0",
    color: "#17324d",
    fontSize: "13px",
    fontWeight: 600,
  },
  scannerHintCard: {
    padding: "18px 20px",
    backgroundColor: "#f8fbfe",
    border: "1px solid #d7e2ef",
    borderRadius: "18px",
  },
  itemSummaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "16px",
  },
  itemSummaryLabel: {
    margin: "0 0 6px",
    color: "#5f7891",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  itemSummaryValue: {
    margin: 0,
    color: "#17324d",
    fontSize: "16px",
    fontWeight: 700,
  },
  totalStockCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    marginTop: "4px",
    padding: "18px 20px",
    border: "1px solid #d7e2ef",
    borderRadius: "18px",
    backgroundColor: "#f8fbfe",
  },
  totalStockLabel: {
    margin: 0,
    color: "#4f677f",
    fontSize: "15px",
  },
  totalStockValue: {
    margin: 0,
    color: "#17324d",
    fontSize: "20px",
    fontWeight: 800,
  },
  errorText: {
    margin: "8px 0 0",
    color: "#dc2626",
    fontSize: "13px",
    lineHeight: 1.5,
  },
};

const normalizeBarcodeInput = (value) => {
  return String(value || "").replace(/\s+/g, "").trim();
};

const formatLabel = (value) => {
  const normalizedValue = String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalizedValue) {
    return "--";
  }

  return normalizedValue.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  return value;
};

const getNormalizedInventoryText = (value) => {
  return String(value || "").trim().toLowerCase();
};

const getFirstPositiveNumber = (values) => {
  for (const value of values) {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }
  }

  return null;
};

const getUnitsPerPackageValue = (item) => {
  if (getNormalizedInventoryText(item?.packaging) === "piece") {
    return 1;
  }

  const isMeasurementBased = getNormalizedInventoryText(
    item?.tracking_method,
  ).includes("measurement");

  const candidateValues = isMeasurementBased
    ? [
        item?.unit_of_measure_value,
        item?.quantity,
        item?.units_per_package,
        item?.quantity_per_package,
      ]
    : [
        item?.quantity,
        item?.units_per_package,
        item?.quantity_per_package,
        item?.unit_of_measure_value,
      ];

  return getFirstPositiveNumber(candidateValues) || 1;
};

const getItemUnitLabel = (item) => {
  return item?.unit_of_measure || item?.base_unit || "pc";
};

const getTrackingMethodLabel = (item) => {
  if (item?.tracking_method) {
    return item.tracking_method;
  }

  return String(getItemUnitLabel(item)).trim().toLowerCase() === "pc"
    ? "Count-Based"
    : "Measurement-Based";
};

const isPerishableInventoryItem = (item) => {
  return (
    String(item?.category || "").trim().toUpperCase() === "PERISHABLE" ||
    Boolean(item?.is_perishable)
  );
};

const getCalculatedAddedStock = (scanForm, item) => {
  const packageCount = Number(scanForm.quantityOnHand || 0);

  if (!Number.isFinite(packageCount) || packageCount <= 0) {
    return 0;
  }

  return packageCount * getUnitsPerPackageValue(item);
};

const InventoryItemScanModal = ({
  isOpen,
  scanForm,
  matchedItem,
  matchedItemName,
  currentStock = 0,
  generatedBatchNumber = "",
  errorMessage = "",
  isSubmitting = false,
  onClose,
  onSubmit,
  onInputChange,
}) => {
  const barcodeInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      barcodeInputRef.current?.focus();
      barcodeInputRef.current?.select();
    }, 50);

    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const trimmedBarcode = normalizeBarcodeInput(scanForm.barcodeNumber);
  const hasMatchedItem = Boolean(matchedItem?.id);
  const isPerishable = isPerishableInventoryItem(matchedItem);
  const unitLabel = getItemUnitLabel(matchedItem);
  const unitsPerPackage = getUnitsPerPackageValue(matchedItem);
  const totalAddedStock = hasMatchedItem
    ? getCalculatedAddedStock(scanForm, matchedItem)
    : 0;
  const generatedBatchDisplay =
    generatedBatchNumber || "Auto-generated after saving";
  const submitLabel = hasMatchedItem
    ? isSubmitting
      ? "Adding Stock..."
      : "Add Stock"
    : "Continue to Add Item";

  return (
    <div style={scanModalOverlayStyle}>
      <div style={scanModalStyle}>
        <div style={styles.scanModalHeader}>
          <div>
            <h3 style={styles.scanModalTitle}>Scan Item</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={pageHeaderStyles.secondaryButton}
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
          <section style={styles.scannerHintCard}>
            <h3 style={styles.scanModalSectionTitle}>Ready to Scan</h3>
          </section>

          <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={styles.scanModalSectionTitle}>Barcode Details</h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={scanModalLabelStyle}>Barcode Number</label>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={scanForm.barcodeNumber}
                  onChange={(event) =>
                    onInputChange(
                      "barcodeNumber",
                      normalizeBarcodeInput(event.target.value),
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && trimmedBarcode) {
                      event.preventDefault();
                      onSubmit();
                    }
                  }}
                  style={scanModalInputStyle}
                  placeholder="Scan or enter barcode"
                />

                {matchedItemName && (
                  <p style={styles.feedbackText}>
                    Existing item found: {matchedItemName}
                  </p>
                )}

                {!matchedItemName && trimmedBarcode && (
                  <p style={{ ...styles.feedbackText, color: COLORS.muted }}>
                    No matching item yet. Continue to register this barcode.
                  </p>
                )}

                {!hasMatchedItem && errorMessage && (
                  <p style={styles.errorText}>{errorMessage}</p>
                )}
              </div>
            </div>
          </section>

          {hasMatchedItem && (
            <>
              <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
                <h3 style={styles.scanModalSectionTitle}>Item Information</h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr",
                    gap: "18px",
                  }}
                >
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={scanModalLabelStyle}>Item Name</label>
                    <input
                      type="text"
                      value={formatValue(matchedItem.item_name)}
                      readOnly
                      style={scanModalLockedInputStyle}
                    />
                  </div>

                  <div>
                    <label style={scanModalLabelStyle}>Barcode</label>
                    <input
                      type="text"
                      value={formatValue(matchedItem.barcode || trimmedBarcode)}
                      readOnly
                      style={scanModalLockedInputStyle}
                    />
                  </div>

                  <div>
                    <label style={scanModalLabelStyle}>Category</label>
                    <input
                      type="text"
                      value={formatLabel(matchedItem.category)}
                      readOnly
                      style={scanModalLockedInputStyle}
                    />
                  </div>

                  <div>
                    <label style={scanModalLabelStyle}>Tracking Method</label>
                    <input
                      type="text"
                      value={formatLabel(getTrackingMethodLabel(matchedItem))}
                      readOnly
                      style={scanModalLockedInputStyle}
                    />
                  </div>

                  <div>
                    <label style={scanModalLabelStyle}>Unit of Measure</label>
                    <input
                      type="text"
                      value={unitLabel}
                      readOnly
                      style={scanModalLockedInputStyle}
                    />
                  </div>

                  <div>
                    <label style={scanModalLabelStyle}>Packaging</label>
                    <input
                      type="text"
                      value={formatLabel(matchedItem.packaging)}
                      readOnly
                      style={scanModalLockedInputStyle}
                    />
                  </div>
                </div>
              </section>

              <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
                <h3 style={styles.scanModalSectionTitle}>Stock Details</h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "18px",
                  }}
                >
                  <div>
                    <label style={scanModalLabelStyle}>Batch Number</label>
                    <input
                      type="text"
                      value={generatedBatchDisplay}
                      readOnly
                      style={scanModalLockedInputStyle}
                    />
                  </div>

                  <div>
                    <label style={scanModalLabelStyle}>Quantity on Hand</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={scanForm.quantityOnHand || ""}
                      onChange={(event) =>
                        onInputChange("quantityOnHand", event.target.value)
                      }
                      style={scanModalInputStyle}
                      placeholder="Enter quantity"
                    />
                  </div>

                  <div>
                    <label style={scanModalLabelStyle}>Units per Package</label>
                    <input
                      type="text"
                      value={unitsPerPackage}
                      readOnly
                      style={scanModalLockedInputStyle}
                    />
                  </div>

                  <div>
                    <label style={scanModalLabelStyle}>Reorder Level</label>
                    <input
                      type="text"
                      value={formatValue(matchedItem.reorder_level)}
                      readOnly
                      style={scanModalLockedInputStyle}
                    />
                  </div>

                  <div>
                    <label style={scanModalLabelStyle}>
                      {isPerishable
                        ? "Expiration Date"
                        : "Expiration Date (If Applicable)"}
                    </label>
                    <input
                      type="date"
                      value={scanForm.expirationDate || ""}
                      onChange={(event) =>
                        onInputChange("expirationDate", event.target.value)
                      }
                      style={scanModalInputStyle}
                    />
                  </div>

                  <div>
                    <label style={scanModalLabelStyle}>Current Stock</label>
                    <input
                      type="text"
                      value={`${currentStock} ${unitLabel}`}
                      readOnly
                      style={scanModalLockedInputStyle}
                    />
                  </div>
                </div>

                <div style={styles.totalStockCard}>
                  <p style={styles.totalStockLabel}>Total Added Stock:</p>
                  <p style={styles.totalStockValue}>
                    {totalAddedStock} {unitLabel}
                  </p>
                </div>

                {errorMessage && <p style={styles.errorText}>{errorMessage}</p>}
              </section>
            </>
          )}

          <div style={styles.scanModalFooter}>
            <button
              type="button"
              onClick={onClose}
              style={pageHeaderStyles.secondaryButton}
            >
              Cancel
            </button>

            <button
              type="button"
              style={pageHeaderStyles.primaryButton}
              onClick={onSubmit}
              disabled={!trimmedBarcode || isSubmitting}
            >
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryItemScanModal;
