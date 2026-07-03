import React, { useEffect, useState } from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";
import { FiX } from "react-icons/fi";

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
  outline: "none",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
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

const unitOfMeasureOptions = ["kg", "g", "L", "mL", "pc"];
const packagingOptions = ["sack", "box", "carton", "case", "pack", "bottle"];

const normalizeCategoryValue = (category) => {
  if (typeof category !== "string") {
    return "perishable";
  }

  const normalizedCategory = category.trim().toLowerCase();

  if (normalizedCategory === "non-perishable") {
    return "non-perishable";
  }

  return "perishable";
};

const createDefaultForm = () => ({
  item_name: "",
  barcode: "",
  quantity: "",
  unit_of_measure: "",
  unit_of_measure_value: "",
  packaging: "",
  packaging_count: "",
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
        barcode: itemData.barcode || "",
        quantity: itemData.quantity || "",
        unit_of_measure: itemData.unit_of_measure || itemData.unit || "",
        unit_of_measure_value: itemData.unit_of_measure_value || "",
        packaging: itemData.packaging || "",
        packaging_count: itemData.packaging_count || "",
        category: normalizeCategoryValue(itemData.category),
        expiration_date: itemData.expiration_date ?? itemData.expiryDate ?? "",
        reorder_level: itemData.reorder_level ?? "",
      });
    } else {
      setFormValues(createDefaultForm());
    }
  }, [isOpen, itemData]);

  if (!isOpen) return null;

  const handleChange = (fieldName, value) => {
    setFormValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(formValues);
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
              {mode === "edit" ? "Edit Inventory Item" : "Add Item"}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={pageHeaderStyles.secondaryButton}
          >
            <FiX />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {/* SECTION 1 */}
          <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={{ margin: "0 0 12px", color: "#17324d" }}>
              Item Information
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="item_name" style={labelStyles}>
                  Item Name
                </label>
                <input
                  id="item_name"
                  type="text"
                  placeholder="Enter item name"
                  value={formValues.item_name}
                  onChange={(e) => handleChange("item_name", e.target.value)}
                  style={inputStyles}
                  required
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="barcode" style={labelStyles}>
                  Barcode
                </label>
                <input
                  id="barcode"
                  type="text"
                  placeholder="Scan or enter barcode"
                  value={formValues.barcode}
                  onChange={(e) => handleChange("barcode", e.target.value)}
                  style={inputStyles}
                />
              </div>

              <div>
                <label htmlFor="category" style={labelStyles}>
                  Category
                </label>
                <select
                  id="category"
                  value={formValues.category}
                  onChange={(e) => handleChange("category", e.target.value)}
                  style={inputStyles}
                  required
                >
                  <option value="perishable">Perishable</option>
                  <option value="non-perishable">Non-Perishable</option>
                </select>
              </div>

              <div>
                <label htmlFor="unit_of_measure" style={labelStyles}>
                  Unit of Measure
                </label>
                <select
                  id="unit_of_measure"
                  value={formValues.unit_of_measure}
                  onChange={(e) =>
                    handleChange("unit_of_measure", e.target.value)
                  }
                  style={inputStyles}
                  required
                >
                  <option value="">Select unit of measure</option>
                  {unitOfMeasureOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="unit_of_measure_value" style={labelStyles}>
                  Number for Unit of Measure
                </label>
                <input
                  id="unit_of_measure_value"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Example: 5 for 5 kg"
                  value={formValues.unit_of_measure_value}
                  onChange={(e) =>
                    handleChange("unit_of_measure_value", e.target.value)
                  }
                  style={inputStyles}
                  required
                />
              </div>

              <div>
                <label htmlFor="packaging" style={labelStyles}>
                  Packaging
                </label>
                <select
                  id="packaging"
                  value={formValues.packaging}
                  onChange={(e) => handleChange("packaging", e.target.value)}
                  style={inputStyles}
                  required
                >
                  <option value="">Select packaging</option>
                  {packagingOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* SECTION 2 */}
          <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={{ margin: "0 0 12px", color: "#17324d" }}>
              Stock Details
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              <div>
                <label htmlFor="packaging_count" style={labelStyles}>
                  Number of Packagings
                </label>
                <input
                  id="packaging_count"
                  type="number"
                  min="1"
                  placeholder="How many sacks, boxes, packs, etc."
                  value={formValues.packaging_count}
                  onChange={(e) =>
                    handleChange("packaging_count", e.target.value)
                  }
                  style={inputStyles}
                  required
                />
              </div>

              <div>
                <label htmlFor="quantity" style={labelStyles}>
                  Quantity per Packaging
                </label>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  placeholder="How many items per pack, box, case, etc."
                  value={formValues.quantity}
                  onChange={(e) => handleChange("quantity", e.target.value)}
                  style={inputStyles}
                  required
                />
              </div>

              <div>
                <label htmlFor="reorder_level" style={labelStyles}>
                  Reorder Level
                </label>
                <input
                  id="reorder_level"
                  type="number"
                  min="1"
                  placeholder="Set reorder level"
                  value={formValues.reorder_level}
                  onChange={(e) =>
                    handleChange("reorder_level", e.target.value)
                  }
                  style={inputStyles}
                  required
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
                  onChange={(e) =>
                    handleChange("expiration_date", e.target.value)
                  }
                  style={inputStyles}
                />
              </div>
            </div>
          </section>

          {errorMessage && <div style={errorBoxStyles}>{errorMessage}</div>}

          {/* ACTIONS */}
          <div
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
