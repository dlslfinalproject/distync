import React, { useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { formatNumericValue } from "../../features/inventory-items/inventoryItemFormatting";

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(21, 40, 63, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1000,
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

const sectionCardStyles = {
  border: "1px solid #d7e2ef",
  borderRadius: "18px",
  padding: "18px 20px",
  backgroundColor: "#ffffff",
};

const sectionTitleStyles = {
  margin: "0 0 14px",
  color: "#17324d",
  fontSize: "16px",
  fontWeight: 700,
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

const lockedInputStyles = {
  ...inputStyles,
  backgroundColor: "#eef5fb",
  color: "#5f7891",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
};

const fieldErrorTextStyles = {
  margin: "6px 0 0",
  color: "#c53030",
  fontSize: "12px",
  lineHeight: 1.4,
};

const errorBoxStyles = {
  marginTop: "4px",
  padding: "12px 14px",
  borderRadius: "12px",
  backgroundColor: "#fff1f2",
  color: "#e11d48",
  fontSize: "13px",
  fontWeight: 500,
  border: "1px solid #ffe4e6",
};

const transactionTypeOptions = [
  { value: "DAMAGED", label: "Damaged" },
  { value: "SPOILED", label: "Spoiled" },
  { value: "STOLEN", label: "Stolen" },
  { value: "MISSING", label: "Missing" },
  { value: "EXPIRED", label: "Expired" },
];

const getTodayDateInputValue = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
};

const formatLoggedByName = (authenticatedUser) => {
  const fullName = [
    authenticatedUser?.first_name,
    authenticatedUser?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || authenticatedUser?.email || "--";
};

const NOT_APPLICABLE_LABEL = "Not Applicable";

const getSourceLabel = (sourceType) => {
  const normalizedSource = String(sourceType || "").trim().toUpperCase();

  if (!normalizedSource) {
    return NOT_APPLICABLE_LABEL;
  }

  if (normalizedSource === "LGU") {
    return "Malvar LGU";
  }

  if (normalizedSource === "DONATED") {
    return "Donated";
  }

  if (normalizedSource === "DSWD") {
    return "DSWD";
  }

  if (normalizedSource === "PURCHASED") {
    return "Purchased";
  }

  return normalizedSource
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
};

const formatBatchExpirationDate = (value) => {
  if (!value) {
    return NOT_APPLICABLE_LABEL;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    const fallbackParsedDate = new Date(`${String(value).slice(0, 10)}T00:00:00`);

    if (Number.isNaN(fallbackParsedDate.getTime())) {
      return NOT_APPLICABLE_LABEL;
    }

    return fallbackParsedDate.toLocaleDateString("en-GB");
  }

  return parsedDate.toLocaleDateString("en-GB");
};

const inferTrackingMethodLabel = (item, selectedBatch) => {
  const explicitTrackingMethod =
    item?.tracking_method ||
    item?.inventory_item?.tracking_method ||
    "";

  if (explicitTrackingMethod) {
    return explicitTrackingMethod;
  }

  const unitOfMeasure =
    item?.unit_of_measure ||
    selectedBatch?.stock_form_unit_of_measure ||
    "";
  const unitOfMeasureValue = Number(
    item?.unit_of_measure_value ||
      selectedBatch?.stock_form_unit_of_measure_value ||
      0,
  );

  if (
    unitOfMeasureValue > 0 &&
    String(unitOfMeasure || "")
      .trim()
      .toLowerCase() !== "pc"
  ) {
    return "Weight/Volume-Based";
  }

  return "Count-Based";
};

const createDefaultForm = (inventoryBatches = []) => ({
  inventory_batch_id: inventoryBatches[0]?.id || "",
  transaction_type: "DAMAGED",
  quantity: "",
  inventoryTransactionReferenceNo: "",
  remarks: "",
  logged_date: getTodayDateInputValue(),
});

const InventoryItemStatusLogModal = ({
  isOpen,
  item,
  inventoryBatches,
  authenticatedUser,
  currentStock = 0,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [formValues, setFormValues] = useState(createDefaultForm(inventoryBatches));
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormValues(createDefaultForm(inventoryBatches));
    setFieldErrors({});
  }, [isOpen, item?.id]);

  const selectedBatch = useMemo(
    () =>
      inventoryBatches.find(
        (batch) => String(batch.id) === String(formValues.inventory_batch_id),
      ) || null,
    [inventoryBatches, formValues.inventory_batch_id],
  );

  const itemName = item?.item_name || item?.name || "Inventory Item";
  const unitLabel =
    item?.unit_of_measure ||
    selectedBatch?.stock_form_unit_of_measure ||
    "pc";
  const itemCategory = item?.category || NOT_APPLICABLE_LABEL;
  const itemTrackingMethod = inferTrackingMethodLabel(item, selectedBatch);
  const loggedByLabel = formatLoggedByName(authenticatedUser);
  const hasAvailableBatch = inventoryBatches.length > 0;
  const selectedBatchAvailableStock = Number(selectedBatch?.quantity_available || 0);
  const selectedBatchPackaging =
    selectedBatch?.stock_form_packaging ||
    selectedBatch?.inventory_item_stock_form?.packaging ||
    NOT_APPLICABLE_LABEL;
  const selectedBatchUnitsPerPackaging =
    Number(
      selectedBatch?.stock_form_units_per_packaging ||
      selectedBatch?.inventory_item_stock_form?.units_per_packaging ||
      0,
    ) || (String(selectedBatchPackaging).toLowerCase() === "piece" ? 1 : 0);

  if (!isOpen) {
    return null;
  }

  const handleChange = (fieldName, value) => {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[fieldName]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldName];
      return nextErrors;
    });

    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }));
  };

  const validateForm = () => {
    const nextErrors = {};
    const parsedQuantity = Number.parseInt(formValues.quantity, 10);

    if (!formValues.inventory_batch_id) {
      nextErrors.inventory_batch_id = "Batch number is required.";
    }

    if (!formValues.transaction_type) {
      nextErrors.transaction_type = "Status type is required.";
    }

    if (!formValues.quantity.trim()) {
      nextErrors.quantity = "Quantity to deduct is required.";
    } else if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      nextErrors.quantity =
        "Quantity to deduct must be a whole number greater than 0.";
    } else if (selectedBatch && parsedQuantity > selectedBatchAvailableStock) {
      nextErrors.quantity =
        "Quantity to deduct cannot be greater than the current batch stock.";
    }

    if (!formValues.remarks.trim()) {
      nextErrors.remarks = "Reason / notes is required.";
    }

    const normalizedReferenceNo =
      formValues.inventoryTransactionReferenceNo.trim().toUpperCase();

    if (!normalizedReferenceNo) {
      nextErrors.inventoryTransactionReferenceNo =
        "Inventory Transaction Reference No. is required.";
    } else if (
      !/^ITR-[0-9]{4}-[0-9]{6}$/.test(normalizedReferenceNo) ||
      normalizedReferenceNo.endsWith("000000")
    ) {
      nextErrors.inventoryTransactionReferenceNo =
        "Use ITR-YYYY-NNNNNN and do not use 000000.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit({
      inventory_batch_id: formValues.inventory_batch_id,
      transaction_type: formValues.transaction_type,
      quantity: Number.parseInt(formValues.quantity, 10),
      inventoryTransactionReferenceNo:
        formValues.inventoryTransactionReferenceNo.trim().toUpperCase(),
      reference_type: "MANUAL",
      reference_id: null,
      disaster_event_id: null,
      performed_by: authenticatedUser?.id || null,
      remarks: formValues.remarks.trim(),
      inventoryStateBasis: selectedBatch?.inventoryStateBasis || null,
    });
  };

  return (
    <div className="inventory-item-status-modal-backdrop" style={overlayStyles}>
      <div className="inventory-item-status-modal" style={modalStyles}>
        <div
          className="inventory-item-status-modal-topbar"
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
              Log Status
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={pageHeaderStyles.secondaryButton}
            aria-label="Close"
          >
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gap: "18px" }}>
            <section className="inventory-item-status-section" style={sectionCardStyles}>
              <h4 style={sectionTitleStyles}>Item Information</h4>
              <div
                className="inventory-item-status-grid inventory-item-status-info-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(280px, 1.8fr) repeat(3, minmax(140px, 1fr))",
                  gap: "18px",
                }}
              >
                <div>
                  <label style={labelStyles}>Item Name</label>
                  <input type="text" value={itemName} readOnly style={lockedInputStyles} />
                </div>
                <div>
                  <label style={labelStyles}>Category</label>
                  <input type="text" value={itemCategory} readOnly style={lockedInputStyles} />
                </div>
                <div>
                  <label style={labelStyles}>Tracking Method</label>
                  <input
                    type="text"
                    value={itemTrackingMethod}
                    readOnly
                    style={lockedInputStyles}
                  />
                </div>
                <div>
                  <label style={labelStyles}>Current Total Stock</label>
                  <input
                    type="text"
                    value={`${formatNumericValue(Number(currentStock || 0))} ${unitLabel}`}
                    readOnly
                    style={lockedInputStyles}
                  />
                </div>
              </div>
            </section>

            <section className="inventory-item-status-section" style={sectionCardStyles}>
              <h4 style={sectionTitleStyles}>Batch Information</h4>
              <div
                className="inventory-item-status-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
                  gap: "18px",
                }}
              >
                <div>
                  <label htmlFor="inventory_batch_id" style={labelStyles}>
                    Batch Number
                  </label>
                  <select
                    id="inventory_batch_id"
                    value={formValues.inventory_batch_id}
                    onChange={(event) =>
                      handleChange("inventory_batch_id", event.target.value)
                    }
                    style={inputStyles}
                    aria-invalid={Boolean(fieldErrors.inventory_batch_id)}
                  >
                    <option value="">Select batch number</option>
                    {inventoryBatches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.batch_no} ({formatNumericValue(Number(batch.quantity_available || 0))}{" "}
                        {unitLabel})
                      </option>
                    ))}
                  </select>
                  {fieldErrors.inventory_batch_id ? (
                    <p style={fieldErrorTextStyles}>
                      {fieldErrors.inventory_batch_id}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label style={labelStyles}>Packaging</label>
                  <input
                    type="text"
                    value={selectedBatchPackaging}
                    readOnly
                    style={lockedInputStyles}
                  />
                </div>

                <div>
                  <label style={labelStyles}>Units per Packaging</label>
                  <input
                    type="text"
                    value={
                      selectedBatch
                        ? formatNumericValue(selectedBatchUnitsPerPackaging)
                        : NOT_APPLICABLE_LABEL
                    }
                    readOnly
                    style={lockedInputStyles}
                  />
                </div>

                <div>
                  <label style={labelStyles}>Current Batch Stock</label>
                  <input
                    type="text"
                    value={
                      selectedBatch
                        ? `${formatNumericValue(selectedBatchAvailableStock)} ${unitLabel}`
                        : `${NOT_APPLICABLE_LABEL} ${unitLabel}`
                    }
                    readOnly
                    style={lockedInputStyles}
                  />
                </div>

                <div>
                  <label style={labelStyles}>Expiration Date</label>
                  <input
                    type="text"
                    value={formatBatchExpirationDate(selectedBatch?.expiration_date)}
                    readOnly
                    style={lockedInputStyles}
                  />
                </div>

                <div>
                  <label style={labelStyles}>Source</label>
                  <input
                    type="text"
                    value={getSourceLabel(selectedBatch?.source_type)}
                    readOnly
                    style={lockedInputStyles}
                  />
                </div>
              </div>
            </section>

            <section className="inventory-item-status-section" style={sectionCardStyles}>
              <h4 style={sectionTitleStyles}>Log Status Details</h4>
              <div
                className="inventory-item-status-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
                  gap: "18px",
                }}
              >
                <div>
                  <label htmlFor="status_type" style={labelStyles}>
                    Status Type
                  </label>
                  <select
                    id="status_type"
                    value={formValues.transaction_type}
                    onChange={(event) =>
                      handleChange("transaction_type", event.target.value)
                    }
                    style={inputStyles}
                    aria-invalid={Boolean(fieldErrors.transaction_type)}
                  >
                    {transactionTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.transaction_type ? (
                    <p style={fieldErrorTextStyles}>{fieldErrors.transaction_type}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="status_quantity" style={labelStyles}>
                    Quantity to Deduct
                  </label>
                  <input
                    id="status_quantity"
                    type="number"
                    min="1"
                    max={selectedBatch?.quantity_available || undefined}
                    value={formValues.quantity}
                    onChange={(event) => handleChange("quantity", event.target.value)}
                    style={inputStyles}
                    placeholder={`Enter quantity in ${unitLabel}`}
                    aria-invalid={Boolean(fieldErrors.quantity)}
                  />
                  {fieldErrors.quantity ? (
                    <p style={fieldErrorTextStyles}>{fieldErrors.quantity}</p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="logged_date" style={labelStyles}>
                    Date Logged
                  </label>
                  <input
                    id="logged_date"
                    type="date"
                    value={formValues.logged_date}
                    readOnly
                    style={lockedInputStyles}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label
                    htmlFor="inventory_transaction_reference_no"
                    style={labelStyles}
                  >
                    Inventory Transaction Reference No.
                  </label>
                  <input
                    id="inventory_transaction_reference_no"
                    type="text"
                    value={formValues.inventoryTransactionReferenceNo}
                    onChange={(event) =>
                      handleChange(
                        "inventoryTransactionReferenceNo",
                        event.target.value.toUpperCase(),
                      )
                    }
                    style={inputStyles}
                    placeholder="ITR-2026-000123"
                    maxLength={15}
                    aria-invalid={Boolean(
                      fieldErrors.inventoryTransactionReferenceNo,
                    )}
                  />
                  {fieldErrors.inventoryTransactionReferenceNo ? (
                    <p style={fieldErrorTextStyles}>
                      {fieldErrors.inventoryTransactionReferenceNo}
                    </p>
                  ) : null}
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="status_remarks" style={labelStyles}>
                    Reason / Notes
                  </label>
                  <textarea
                    id="status_remarks"
                    value={formValues.remarks}
                    onChange={(event) => handleChange("remarks", event.target.value)}
                    style={{ ...inputStyles, minHeight: "100px", resize: "vertical" }}
                    placeholder="State why this quantity is being logged out."
                    aria-invalid={Boolean(fieldErrors.remarks)}
                  />
                  {fieldErrors.remarks ? (
                    <p style={fieldErrorTextStyles}>{fieldErrors.remarks}</p>
                  ) : null}
                </div>

                <div>
                  <label style={labelStyles}>Logged By</label>
                  <input
                    type="text"
                    value={loggedByLabel}
                    readOnly
                    style={lockedInputStyles}
                  />
                </div>
              </div>
            </section>
          </div>

          {errorMessage ? <div style={errorBoxStyles}>{errorMessage}</div> : null}

          {!hasAvailableBatch ? (
            <div style={errorBoxStyles}>
              No available stock can be logged for this item right now.
            </div>
          ) : null}

          <div
            className="inventory-item-status-actions"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "24px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={pageHeaderStyles.secondaryButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !hasAvailableBatch}
              style={{
                ...pageHeaderStyles.primaryButton,
                opacity: isSubmitting || !hasAvailableBatch ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Saving..." : "Log Status"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryItemStatusLogModal;
