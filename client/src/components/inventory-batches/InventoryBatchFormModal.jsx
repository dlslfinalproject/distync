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

const sourceTypes = ["PURCHASED", "DONATED", "DSWD", "LGU", "OTHER"];

const createDefaultForm = () => ({
  inventory_item_id: "",
  batch_no: "",
  supplier_id: "",
  source_type: "DONATED",
  quantity_received: 1,
  expiration_date: "",
  storage_location: "",
  created_by: "",
});

const InventoryBatchFormModal = ({
  isOpen,
  inventoryItems,
  suppliers,
  initialInventoryItemId,
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

    setFormValues({
      ...createDefaultForm(),
      inventory_item_id: initialInventoryItemId || "",
    });
  }, [initialInventoryItemId, isOpen]);

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
      inventory_item_id: formValues.inventory_item_id,
      batch_no: formValues.batch_no.trim(),
      supplier_id: formValues.supplier_id || null,
      source_type: formValues.source_type,
      quantity_received: Number.parseInt(formValues.quantity_received, 10),
      expiration_date: formValues.expiration_date || null,
      storage_location: formValues.storage_location.trim() || null,
      created_by: formValues.created_by.trim() || null,
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
              Create Inventory Batch
            </h3>
            <p
              style={{
                margin: "8px 0 0",
                color: "#60738a",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              Record a new stock intake batch using the existing backend fields.
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
              <label htmlFor="inventory_item_id" style={labelStyles}>
                Inventory Item
              </label>
              <select
                id="inventory_item_id"
                value={formValues.inventory_item_id}
                onChange={(event) =>
                  handleChange("inventory_item_id", event.target.value)
                }
                style={inputStyles}
              >
                <option value="">Select inventory item</option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name} ({item.item_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="batch_no" style={labelStyles}>
                Batch No
              </label>
              <input
                id="batch_no"
                type="text"
                value={formValues.batch_no}
                onChange={(event) => handleChange("batch_no", event.target.value)}
                style={inputStyles}
              />
            </div>

            <div>
              <label htmlFor="supplier_id" style={labelStyles}>
                Supplier
              </label>
              <select
                id="supplier_id"
                value={formValues.supplier_id}
                onChange={(event) => handleChange("supplier_id", event.target.value)}
                style={inputStyles}
              >
                <option value="">No supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="source_type" style={labelStyles}>
                Source Type
              </label>
              <select
                id="source_type"
                value={formValues.source_type}
                onChange={(event) => handleChange("source_type", event.target.value)}
                style={inputStyles}
              >
                {sourceTypes.map((sourceType) => (
                  <option key={sourceType} value={sourceType}>
                    {sourceType}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="quantity_received" style={labelStyles}>
                Quantity Received
              </label>
              <input
                id="quantity_received"
                type="number"
                min="1"
                value={formValues.quantity_received}
                onChange={(event) =>
                  handleChange("quantity_received", event.target.value)
                }
                style={inputStyles}
              />
            </div>

            <div>
              <label htmlFor="expiration_date" style={labelStyles}>
                Expiration Date
              </label>
              <input
                id="expiration_date"
                type="date"
                value={formValues.expiration_date}
                onChange={(event) =>
                  handleChange("expiration_date", event.target.value)
                }
                style={inputStyles}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="storage_location" style={labelStyles}>
                Storage Location
              </label>
              <input
                id="storage_location"
                type="text"
                value={formValues.storage_location}
                onChange={(event) =>
                  handleChange("storage_location", event.target.value)
                }
                style={inputStyles}
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
              {isSubmitting ? "Creating..." : "Create Batch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryBatchFormModal;
