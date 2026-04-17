import React, { useEffect, useState } from "react";

const COLORS = {
  primary: "#17324d",
  secondary: "#334155",
  muted: "#6b8298",
  label: "#475569",
  border: "#dce7f3",
  borderSoft: "#e2e8f0",
  bg: "#ffffff",
  bgSoft: "#f8fbff",
  bgInput: "#f8fafc",
  overlay: "rgba(15, 23, 42, 0.42)",
  dangerBg: "#fff1f2",
  dangerText: "#e11d48",
  dangerBorder: "#ffe4e6",
  primaryBtn: "#3d4f78",
  secondaryBtn: "#e5e7eb",
};

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: COLORS.overlay,
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
  backgroundColor: COLORS.bg,
  borderRadius: "20px",
  border: `1px solid ${COLORS.border}`,
  boxShadow: "0 24px 60px rgba(23, 50, 77, 0.22)",
  padding: "28px 28px 24px",
  boxSizing: "border-box",
};

const inputStyles = {
  width: "100%",
  minHeight: "46px",
  padding: "12px 14px",
  borderRadius: "12px",
  border: `1px solid ${COLORS.borderSoft}`,
  boxSizing: "border-box",
  fontSize: "14px",
  fontWeight: 500,
  color: COLORS.secondary,
  backgroundColor: COLORS.bgInput,
  outline: "none",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: COLORS.label,
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const sectionHeaderStyles = {
  marginBottom: "28px",
  borderBottom: "1px solid #edf2f7",
  paddingBottom: "18px",
};

const titleStyles = {
  margin: 0,
  color: COLORS.primary,
  fontSize: "24px",
  fontWeight: 700,
  lineHeight: 1.2,
};

const subtitleStyles = {
  margin: "6px 0 0",
  color: COLORS.muted,
  fontSize: "14px",
  fontWeight: 500,
};

const footerStyles = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "36px",
  borderTop: "1px solid #edf2f7",
  paddingTop: "22px",
  flexWrap: "wrap",
};

const cancelButtonStyles = {
  border: "none",
  borderRadius: "999px",
  padding: "12px 22px",
  backgroundColor: COLORS.secondaryBtn,
  color: COLORS.secondary,
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  minWidth: "120px",
};

const submitButtonStyles = (isSubmitting) => ({
  border: "none",
  borderRadius: "999px",
  padding: "12px 24px",
  backgroundColor: COLORS.primaryBtn,
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  cursor: isSubmitting ? "not-allowed" : "pointer",
  opacity: isSubmitting ? 0.7 : 1,
  minWidth: "160px",
});

const errorBoxStyles = {
  marginTop: "22px",
  padding: "12px 14px",
  borderRadius: "10px",
  backgroundColor: COLORS.dangerBg,
  color: COLORS.dangerText,
  fontSize: "13px",
  fontWeight: 500,
  border: `1px solid ${COLORS.dangerBorder}`,
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
        item_name: itemData.item_name || itemData.name || "",
        quantity: itemData.quantity || "",
        unit_of_measure: itemData.unit_of_measure || itemData.unit || "",
        category: itemData.category || "perishable",
        expiration_date: itemData.expiration_date || itemData.expiryDate || "",
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
        <div style={sectionHeaderStyles}>
          <h3 style={titleStyles}>
            {mode === "edit" ? "Edit Inventory Item" : "Add Item"}
          </h3>
          <p style={subtitleStyles}>Item Information</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
            <div>
              <label htmlFor="item_name" style={labelStyles}>
                Item Name
              </label>
              <input
                id="item_name"
                placeholder="e.g. Canned Goods"
                value={formValues.item_name}
                onChange={(e) => handleChange("item_name", e.target.value)}
                style={inputStyles}
                required
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "16px",
              }}
            >
              <div>
                <label htmlFor="quantity" style={labelStyles}>
                  Quantity
                </label>
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
                <label htmlFor="unit_of_measure" style={labelStyles}>
                  Unit (UOM)
                </label>
                <input
                  id="unit_of_measure"
                  placeholder="pcs, kg, etc."
                  value={formValues.unit_of_measure}
                  onChange={(e) =>
                    handleChange("unit_of_measure", e.target.value)
                  }
                  style={inputStyles}
                />
              </div>

              <div>
                <label htmlFor="reorder_level" style={labelStyles}>
                  Reorder Level
                </label>
                <input
                  id="reorder_level"
                  type="number"
                  placeholder="Low stock alert"
                  value={formValues.reorder_level}
                  onChange={(e) =>
                    handleChange("reorder_level", e.target.value)
                  }
                  style={inputStyles}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "16px",
              }}
            >
              <div>
                <label htmlFor="category" style={labelStyles}>
                  Category
                </label>
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
                <label htmlFor="expiration_date" style={labelStyles}>
                  Expiration Date
                </label>
                <input
                  id="expiration_date"
                  type="date"
                  value={formValues.expiration_date}
                  onChange={(e) =>
                    handleChange("expiration_date", e.target.value)
                  }
                  style={inputStyles}
                />
              </div>
            </div>
          </div>

          {errorMessage && <div style={errorBoxStyles}>{errorMessage}</div>}

          <div style={footerStyles}>
            <button
              type="button"
              onClick={onClose}
              style={cancelButtonStyles}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={submitButtonStyles(isSubmitting)}
            >
              {isSubmitting
                ? "Processing..."
                : mode === "edit"
                ? "Save Changes"
                : "Add to Inventory"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryItemFormModal; 