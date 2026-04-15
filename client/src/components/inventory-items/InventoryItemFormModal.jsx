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
  backdropFilter: "blur(4px)",
};

const modalStyles = {
  width: "min(780px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#ffffff",
  borderRadius: "24px",
  border: "1px solid #d7e2ef",
  boxShadow: "0 24px 60px rgba(23, 50, 77, 0.22)",
  padding: "32px",
  boxSizing: "border-box",
};

const inputStyles = {
  width: "100%",
  minHeight: "48px",
  padding: "12px 16px",
  borderRadius: "12px",
  border: "1.5px solid #e2e8f0",
  boxSizing: "border-box",
  fontSize: "15px",
  color: "#1e293b",
  backgroundColor: "#f8fafc",
  transition: "border-color 0.2s ease",
  outline: "none",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#475569",
  fontSize: "13px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.025em",
};

const createDefaultForm = () => ({
  item_name: "",
  quantity: "",
  unit_of_measure: "",
  category: "perishable",
  expiration_date: "",
  reorder_level: "",
});

const InventoryItemFormModal = ({
  isOpen,
  mode,
  itemData,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [formValues, setFormValues] = useState(createDefaultForm());

  useEffect(() => {
    if (!isOpen) return;
    if (itemData) {
      setFormValues({
        item_name: itemData.item_name || "",
        quantity: itemData.quantity || "",
        unit_of_measure: itemData.unit_of_measure || "",
        category: itemData.category || "perishable",
        expiration_date: itemData.expiration_date || "",
        reorder_level: itemData.reorder_level || "",
      });
    } else {
      setFormValues(createDefaultForm());
    }
  }, [isOpen, itemData]);

  if (!isOpen) return null;

  const handleChange = (fieldName, value) => {
    setFormValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formValues);
  };

  return (
    <div style={overlayStyles} onClick={onClose}>
      <div style={modalStyles} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ marginBottom: "32px", borderBottom: "1px solid #f1f5f9", paddingBottom: "20px" }}>
          <h3 style={{ margin: 0, color: "#0f172a", fontSize: "24px", fontWeight: 700 }}>
            {mode === "edit" ? "Edit Inventory Item" : "Add Item"}
          </h3>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "14px" }}>
            Item Information
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Row 1: Item Name */}
            <div>
              <label htmlFor="item_name" style={labelStyles}>Item Name</label>
              <input
                id="item_name"
                placeholder="e.g. Canned Goods"
                value={formValues.item_name}
                onChange={(e) => handleChange("item_name", e.target.value)}
                style={inputStyles}
                required
              />
            </div>

            {/* Row 2: Quantity, UOM, Reorder Level */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <div>
                <label htmlFor="quantity" style={labelStyles}>Quantity</label>
                <input
                  id="quantity"
                  type="number"
                  placeholder="0"
                  value={formValues.quantity}
                  onChange={(e) => handleChange("quantity", e.target.value)}
                  style={inputStyles}
                  required
                />
              </div>
              <div>
                <label htmlFor="unit_of_measure" style={labelStyles}>Unit (UOM)</label>
                <input
                  id="unit_of_measure"
                  placeholder="pcs, kg, etc."
                  value={formValues.unit_of_measure}
                  onChange={(e) => handleChange("unit_of_measure", e.target.value)}
                  style={inputStyles}
                />
              </div>
              <div>
                <label htmlFor="reorder_level" style={labelStyles}>Reorder Level</label>
                <input
                  id="reorder_level"
                  type="number"
                  placeholder="Low stock alert"
                  value={formValues.reorder_level}
                  onChange={(e) => handleChange("reorder_level", e.target.value)}
                  style={inputStyles}
                />
              </div>
            </div>

            {/* Row 3: Category & Expiration Date */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label htmlFor="category" style={labelStyles}>Category</label>
                <select
                  id="category"
                  value={formValues.category}
                  onChange={(e) => handleChange("category", e.target.value)}
                  style={{ ...inputStyles, cursor: "pointer" }}
                >
                  <option value="perishable">Perishable</option>
                  <option value="non-perishable">Non-Perishable</option>
                </select>
              </div>
              <div>
                <label htmlFor="expiration_date" style={labelStyles}>Expiration Date</label>
                <input
                  id="expiration_date"
                  type="date"
                  value={formValues.expiration_date}
                  onChange={(e) => handleChange("expiration_date", e.target.value)}
                  style={inputStyles}
                />
              </div>
            </div>
          </div>

          {errorMessage && (
            <div style={{ marginTop: "24px", padding: "12px", borderRadius: "8px", backgroundColor: "#fff1f2", color: "#e11d48", fontSize: "14px", border: "1px solid #ffe4e6" }}>
              {errorMessage}
            </div>
          )}

          {/* Footer Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "40px", borderTop: "1px solid #f1f5f9", paddingTop: "24px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                ...pageHeaderStyles.secondaryButton,
                padding: "12px 24px",
                borderRadius: "12px",
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                ...pageHeaderStyles.primaryButton,
                padding: "12px 32px",
                borderRadius: "12px",
                fontWeight: 600,
                backgroundColor: "#2563eb",
                color: "#fff",
                border: "none",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Processing..." : mode === "edit" ? "Save Changes" : "Add to Inventory"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryItemFormModal;