import React, { useEffect, useRef, useState } from "react";
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
    padding: "18px 20px",
    borderRadius: "18px",
    border: "1px solid #d7e2ef",
    backgroundColor: "#ffffff",
    boxShadow: "0 16px 34px rgba(23, 50, 77, 0.08)",
    flexWrap: "wrap",
  },
  totalStockLabel: {
    margin: 0,
    color: "#4f677f",
    fontSize: "15px",
  },
  footerActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    flexWrap: "wrap",
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

const getUnitsPerPackageValue = (itemOrStockForm) => {
  if (getNormalizedInventoryText(itemOrStockForm?.packaging) === "piece") {
    return 1;
  }

  const isMeasurementBased = getNormalizedInventoryText(
    itemOrStockForm?.tracking_method,
  ).includes("measurement");

  const candidateValues = isMeasurementBased
    ? [
        itemOrStockForm?.unit_of_measure_value,
        itemOrStockForm?.units_per_package,
        itemOrStockForm?.quantity_per_package,
        itemOrStockForm?.units_per_packaging,
        itemOrStockForm?.quantity_per_packaging,
        itemOrStockForm?.quantity,
      ]
    : [
        itemOrStockForm?.units_per_package,
        itemOrStockForm?.quantity_per_package,
        itemOrStockForm?.units_per_packaging,
        itemOrStockForm?.quantity_per_packaging,
        itemOrStockForm?.quantity,
        itemOrStockForm?.unit_of_measure_value,
      ];

  return getFirstPositiveNumber(candidateValues) || 1;
};

const getItemUnitLabel = (item, stockForm = null) => {
  return (
    stockForm?.unit_of_measure ||
    item?.unit_of_measure ||
    item?.base_unit ||
    "pc"
  );
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

const getCalculatedAddedStock = (scanForm, item, stockForm = null) => {
  const packageCount = Number(scanForm.quantityOnHand || 0);

  if (!Number.isFinite(packageCount) || packageCount <= 0) {
    return 0;
  }

  return packageCount * getUnitsPerPackageValue(stockForm || item);
};

const isBlank = (value) => String(value ?? "").trim() === "";

const getTodayDateInputValue = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

const isValidDateInput = (value) => {
  const normalizedValue = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return false;
  }

  const parsedDate = new Date(`${normalizedValue}T00:00:00`);
  return !Number.isNaN(parsedDate.getTime());
};

const InventoryItemScanModal = ({
  isOpen,
  scanForm,
  matchedItem,
  matchedStockForm,
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
  const [fieldErrors, setFieldErrors] = useState({});

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

  useEffect(() => {
    if (isOpen) {
      setFieldErrors({});
    }
  }, [isOpen, matchedItem?.id]);

  if (!isOpen) {
    return null;
  }

  const trimmedBarcode = normalizeBarcodeInput(scanForm.barcodeNumber);
  const hasMatchedItem = Boolean(matchedItem?.id);
  const isPerishable = isPerishableInventoryItem(matchedItem);
  const unitLabel = getItemUnitLabel(matchedItem, matchedStockForm);
  const unitsPerPackage = getUnitsPerPackageValue(matchedStockForm || matchedItem);
  const totalAddedStock = hasMatchedItem
    ? getCalculatedAddedStock(scanForm, matchedItem, matchedStockForm)
    : 0;
  const generatedBatchDisplay =
    generatedBatchNumber || "Auto-generated after saving";
  const submitLabel = hasMatchedItem
    ? isSubmitting
      ? "Adding Stock..."
      : "Add Stock"
    : "Continue to Add Item";

  const clearFieldError = (fieldName) => {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[fieldName]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldName];
      return nextErrors;
    });
  };

  const handleInputChange = (fieldName, value) => {
    clearFieldError(fieldName);
    onInputChange(fieldName, value);
  };

  const validateScanForm = () => {
    const nextErrors = {};

    if (isBlank(trimmedBarcode)) {
      nextErrors.barcodeNumber = "Barcode number is required.";
    }

    if (hasMatchedItem) {
      const quantityOnHand = Number(scanForm.quantityOnHand);

      if (isBlank(scanForm.quantityOnHand)) {
        nextErrors.quantityOnHand = "Quantity on hand is required.";
      } else if (!Number.isInteger(quantityOnHand) || quantityOnHand < 1) {
        nextErrors.quantityOnHand = "Quantity on hand must be at least 1.";
      }

      if (matchedItem?.requires_reorder_level_before_restock) {
        const reorderLevel = Number(scanForm.reorderLevel);

        if (isBlank(scanForm.reorderLevel)) {
          nextErrors.reorderLevel = "Reorder level is required.";
        } else if (!Number.isInteger(reorderLevel) || reorderLevel < 1) {
          nextErrors.reorderLevel = "Reorder level must be greater than 0.";
        }
      }

      if (isPerishable && isBlank(scanForm.expirationDate)) {
        nextErrors.expirationDate = "Expiration date is required.";
      } else if (!isBlank(scanForm.expirationDate)) {
        if (!isValidDateInput(scanForm.expirationDate)) {
          nextErrors.expirationDate = "Enter a valid expiration date.";
        } else if (scanForm.expirationDate < getTodayDateInputValue()) {
          nextErrors.expirationDate =
            "Expiration date cannot be earlier than today.";
        }
      }
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateScanForm()) {
      return;
    }

    onSubmit();
  };

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
                    handleInputChange(
                      "barcodeNumber",
                      normalizeBarcodeInput(event.target.value),
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSubmit();
                    }
                  }}
                  style={scanModalInputStyle}
                  placeholder="Scan or enter barcode"
                  aria-invalid={Boolean(fieldErrors.barcodeNumber)}
                />

                {fieldErrors.barcodeNumber && (
                  <p style={styles.errorText}>{fieldErrors.barcodeNumber}</p>
                )}

                {matchedItemName && (
                  <p style={styles.feedbackText}>
                    Existing item found: <strong>{matchedItemName}</strong>
                  </p>
                )}

                {!matchedItemName && trimmedBarcode && (
                  <p style={{ ...styles.feedbackText, color: COLORS.muted }}>
                    No matching item yet. Continue to register this barcode.
                  </p>
                )}

                {!fieldErrors.barcodeNumber && !hasMatchedItem && errorMessage && (
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
                    gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
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
                      value={formatValue(
                        matchedStockForm?.barcode || matchedItem.barcode || trimmedBarcode,
                      )}
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
                      value={formatLabel(
                        matchedStockForm?.packaging || matchedItem.packaging,
                      )}
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
                        handleInputChange("quantityOnHand", event.target.value)
                      }
                      style={scanModalInputStyle}
                      placeholder="Enter quantity"
                      aria-invalid={Boolean(fieldErrors.quantityOnHand)}
                    />
                    {fieldErrors.quantityOnHand && (
                      <p style={styles.errorText}>
                        {fieldErrors.quantityOnHand}
                      </p>
                    )}
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
                      type={
                        matchedItem?.requires_reorder_level_before_restock
                          ? "number"
                          : "text"
                      }
                      min={
                        matchedItem?.requires_reorder_level_before_restock
                          ? "1"
                          : undefined
                      }
                      value={
                        matchedItem?.requires_reorder_level_before_restock
                          ? scanForm.reorderLevel || ""
                          : formatValue(
                              matchedItem.reorder_level_display ??
                                matchedItem.reorder_level,
                            )
                      }
                      onChange={(event) =>
                        handleInputChange("reorderLevel", event.target.value)
                      }
                      readOnly={!matchedItem?.requires_reorder_level_before_restock}
                      style={
                        matchedItem?.requires_reorder_level_before_restock
                          ? scanModalInputStyle
                          : scanModalLockedInputStyle
                      }
                      placeholder={
                        matchedItem?.requires_reorder_level_before_restock
                          ? "Set reorder level"
                          : undefined
                      }
                      aria-invalid={Boolean(fieldErrors.reorderLevel)}
                    />
                    {fieldErrors.reorderLevel && (
                      <p style={styles.errorText}>{fieldErrors.reorderLevel}</p>
                    )}
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
                        handleInputChange("expirationDate", event.target.value)
                      }
                      style={scanModalInputStyle}
                      aria-invalid={Boolean(fieldErrors.expirationDate)}
                    />
                    {fieldErrors.expirationDate && (
                      <p style={styles.errorText}>
                        {fieldErrors.expirationDate}
                      </p>
                    )}
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

                {errorMessage && <p style={styles.errorText}>{errorMessage}</p>}
              </section>
            </>
          )}

          {hasMatchedItem ? (
            <div style={styles.totalStockCard}>
              <p style={styles.totalStockLabel}>
                Total Added Stock:{" "}
                <strong>
                  {totalAddedStock} {unitLabel}
                </strong>
              </p>

              <div style={styles.footerActions}>
                <button
                  type="button"
                  onClick={onClose}
                  style={pageHeaderStyles.secondaryButton}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  style={{
                    ...pageHeaderStyles.primaryButton,
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {submitLabel}
                </button>
              </div>
            </div>
          ) : (
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
                style={{
                  ...pageHeaderStyles.primaryButton,
                  opacity: isSubmitting ? 0.7 : 1,
                }}
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {submitLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryItemScanModal;
