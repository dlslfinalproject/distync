import React, { useEffect, useMemo, useState } from "react";
import { pageHeaderStyles } from "../layout/PageHeader";

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
  width: "min(640px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#ffffff",
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

const transactionTypeOptions = [
  { value: "DAMAGED", label: "Damaged" },
  { value: "SPOILED", label: "Spoiled" },
  { value: "STOLEN", label: "Stolen" },
  { value: "MISSING", label: "Missing" },
  { value: "EXPIRED", label: "Expired" },
];

const createDefaultForm = (inventoryBatches = []) => ({
  inventory_batch_id: inventoryBatches[0]?.id || "",
  transaction_type: "DAMAGED",
  quantity: "",
  remarks: "",
});

const InventoryItemStatusLogModal = ({
  isOpen,
  item,
  inventoryBatches,
  availableQuantity = 0,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [formValues, setFormValues] = useState(createDefaultForm(inventoryBatches));

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormValues(createDefaultForm(inventoryBatches));
  }, [isOpen, inventoryBatches]);

  if (!isOpen) {
    return null;
  }

  const itemName = item?.item_name || item?.name || "Inventory Item";
  const hasAvailableStock = Number(availableQuantity || 0) > 0;

  const handleChange = (fieldName, value) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    onSubmit({
      inventory_batch_id: formValues.inventory_batch_id || null,
      inventory_item_id: item?.id || null,
      transaction_type: formValues.transaction_type,
      quantity: Number.parseInt(formValues.quantity, 10),
      reference_type: "MANUAL",
      reference_id: null,
      disaster_event_id: null,
      remarks: formValues.remarks.trim() || null,
    });
  };

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
              Log Inventory Status
            </h3>
            <p
              style={{
                margin: "8px 0 0",
                color: "#60738a",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              {itemName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={pageHeaderStyles.secondaryButton}
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
            }}
          >
            <div>
              <label htmlFor="status_type" style={labelStyles}>
                Status to Log
              </label>
              <select
                id="status_type"
                value={formValues.transaction_type}
                onChange={(event) =>
                  handleChange("transaction_type", event.target.value)
                }
                style={inputStyles}
              >
                {transactionTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="status_quantity" style={labelStyles}>
                Quantity
              </label>
              <input
                id="status_quantity"
                type="number"
                min="1"
                max={availableQuantity || undefined}
                value={formValues.quantity}
                onChange={(event) => handleChange("quantity", event.target.value)}
                style={inputStyles}
                placeholder="Enter quantity"
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="status_remarks" style={labelStyles}>
                Notes
              </label>
              <textarea
                id="status_remarks"
                value={formValues.remarks}
                onChange={(event) => handleChange("remarks", event.target.value)}
                style={{ ...inputStyles, minHeight: "100px", resize: "vertical" }}
                placeholder="Add a short note for audit trail"
              />
            </div>
          </div>

          {errorMessage ? (
            <div
              style={{
                marginTop: "18px",
                padding: "14px 16px",
                borderRadius: "14px",
                backgroundColor: "#fff3f1",
                border: "1px solid #f1d2cc",
                color: "#9d4d58",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {errorMessage}
            </div>
          ) : null}

          {!hasAvailableStock ? (
            <div
              style={{
                marginTop: "18px",
                padding: "14px 16px",
                borderRadius: "14px",
                backgroundColor: "#fff3f1",
                border: "1px solid #f1d2cc",
                color: "#9d4d58",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              No available stock can be logged for this item right now.
            </div>
          ) : null}

          <div
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
              disabled={isSubmitting || !hasAvailableStock}
              style={{
                ...pageHeaderStyles.primaryButton,
                opacity: isSubmitting || !hasAvailableStock ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Saving..." : "Save Status Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryItemStatusLogModal;
