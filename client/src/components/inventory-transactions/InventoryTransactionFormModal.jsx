import React, { useEffect, useState } from "react";
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
  width: "min(760px, 100%)",
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

const transactionTypes = [
  "INFLOW",
  "OUTFLOW",
  "ADJUSTMENT",
  "EXPIRED",
  "MISSING",
  "DAMAGED",
  "RETURN",
];

const createDefaultForm = () => ({
  inventory_batch_id: "",
  transaction_type: "OUTFLOW",
  quantity: 1,
  inventoryTransactionReferenceNo: "",
  reference_type: "MANUAL",
  remarks: "",
});

const InventoryTransactionFormModal = ({
  isOpen,
  inventoryBatches,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [formValues, setFormValues] = useState(createDefaultForm());

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormValues(createDefaultForm());
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleChange = (fieldName, value) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    onSubmit({
      disaster_event_id: null,
      inventory_batch_id: formValues.inventory_batch_id,
      transaction_type: formValues.transaction_type,
      quantity: Number.parseInt(formValues.quantity, 10),
      inventoryTransactionReferenceNo:
        formValues.inventoryTransactionReferenceNo.trim().toUpperCase(),
      reference_type: "MANUAL",
      reference_id: null,
      performed_by: null,
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
              Create Inventory Transaction
            </h3>
            <p
              style={{
                margin: "8px 0 0",
                color: "#60738a",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              Record one stock movement against a specific inventory batch.
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
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="inventory_batch_id" style={labelStyles}>
                Inventory Batch
              </label>
              <select
                id="inventory_batch_id"
                value={formValues.inventory_batch_id}
                onChange={(event) =>
                  handleChange("inventory_batch_id", event.target.value)
                }
                style={inputStyles}
              >
                <option value="">Select inventory batch</option>
                {inventoryBatches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_no} - {batch.inventory_item?.item_name || "--"} (
                    {batch.quantity_available} available)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="transaction_type" style={labelStyles}>
                Transaction Type
              </label>
              <select
                id="transaction_type"
                value={formValues.transaction_type}
                onChange={(event) =>
                  handleChange("transaction_type", event.target.value)
                }
                style={inputStyles}
              >
                {transactionTypes.map((transactionType) => (
                  <option key={transactionType} value={transactionType}>
                    {transactionType}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="quantity" style={labelStyles}>
                Quantity
              </label>
              <input
                id="quantity"
                type="number"
                min="1"
                value={formValues.quantity}
                onChange={(event) => handleChange("quantity", event.target.value)}
                style={inputStyles}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="inventory_transaction_reference_no" style={labelStyles}>
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
                required
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="remarks" style={labelStyles}>
                Remarks
              </label>
              <textarea
                id="remarks"
                value={formValues.remarks}
                onChange={(event) => handleChange("remarks", event.target.value)}
                style={{ ...inputStyles, minHeight: "110px", resize: "vertical" }}
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
              disabled={isSubmitting}
              style={{
                ...pageHeaderStyles.primaryButton,
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Recording..." : "Create Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryTransactionFormModal;
