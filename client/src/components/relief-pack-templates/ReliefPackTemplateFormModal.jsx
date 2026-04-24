import React, { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";

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

const scrollContainerStyles = {
  flex: 1,
  overflowY: "auto",
  margin: "0",
  paddingRight: "4px",
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

const primaryBtnStyle = {
  ...pageHeaderStyles.primaryButton,
  minHeight: "48px",
  borderRadius: "14px",
  padding: "12px 24px",
  fontWeight: 600,
};

const secondaryBtnStyle = {
  ...pageHeaderStyles.secondaryButton,
  minHeight: "48px",
  borderRadius: "14px",
  padding: "12px 24px",
  fontWeight: 600,
};

const helperTextStyles = {
  margin: "0 0 14px",
  color: "#6b8298",
  fontSize: "14px",
  fontWeight: 500,
};

const itemPreviewWrapStyles = {
  border: "1px solid #d4dfeb",
  borderRadius: "14px",
  backgroundColor: "#f8fbfe",
  padding: "14px 16px",
};

const itemPreviewTitleStyles = {
  margin: "0 0 10px",
  color: "#17324d",
  fontSize: "14px",
  fontWeight: 700,
};

const itemChipStyles = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: "999px",
  border: "1px solid #d4dfeb",
  backgroundColor: "#ffffff",
  color: "#385a7b",
  fontSize: "13px",
  fontWeight: 600,
  marginRight: "8px",
  marginBottom: "8px",
};

const errorTextStyles = {
  margin: 0,
  color: "#9d4d58",
  fontSize: "14px",
  fontWeight: 600,
};

const buildPackItems = (templateData) => {
  return (templateData?.items || []).map((item, index) => ({
    id: item.id || `${item.inventory_item_id}-${index}`,
    inventory_item_id: item.inventory_item_id,
    item: item.inventory_item?.item_name || "Unknown item",
    quantity: String(item.quantity_required || 1),
  }));
};

const buildInitialFormValues = (templateData) => ({
  packName: templateData?.name || "",
  selectedItem: "",
  quantity: "",
  familyPerPack: "1 family",
});

const ReliefPackTemplateFormModal = ({
  isOpen,
  mode = "create",
  templateData,
  inventoryItems = [],
  errorMessage = "",
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [formValues, setFormValues] = useState(buildInitialFormValues(templateData));
  const [packItems, setPackItems] = useState(buildPackItems(templateData));
  const [localErrorMessage, setLocalErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormValues(buildInitialFormValues(templateData));
    setPackItems(buildPackItems(templateData));
    setLocalErrorMessage("");
  }, [isOpen, templateData]);

  if (!isOpen) {
    return null;
  }

  const isEditMode = mode === "edit";

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setLocalErrorMessage("");
    setFormValues((previousValues) => ({
      ...previousValues,
      [name]: value,
    }));
  };

  const handleAddItem = () => {
    const selectedInventoryItem = inventoryItems.find(
      (inventoryItem) => inventoryItem.id === formValues.selectedItem,
    );
    const parsedQuantity = Number.parseInt(formValues.quantity, 10);

    if (!selectedInventoryItem) {
      setLocalErrorMessage("Select an item from inventory first.");
      return;
    }

    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0) {
      setLocalErrorMessage("Quantity must be zero or a positive whole number.");
      return;
    }

    const duplicateItem = packItems.find(
      (packItem) => packItem.inventory_item_id === selectedInventoryItem.id,
    );

    if (duplicateItem && parsedQuantity === 0) {
      setPackItems((previousItems) =>
        previousItems.filter(
          (packItem) => packItem.inventory_item_id !== selectedInventoryItem.id,
        ),
      );
      setFormValues((previousValues) => ({
        ...previousValues,
        selectedItem: "",
        quantity: "",
      }));
      setLocalErrorMessage("");
      return;
    }

    if (duplicateItem) {
      setPackItems((previousItems) =>
        previousItems.map((packItem) =>
          packItem.inventory_item_id === selectedInventoryItem.id
            ? {
                ...packItem,
                quantity: String(parsedQuantity),
              }
            : packItem,
        ),
      );
      setFormValues((previousValues) => ({
        ...previousValues,
        selectedItem: "",
        quantity: "",
      }));
      setLocalErrorMessage("");
      return;
    }

    if (parsedQuantity === 0) {
      setLocalErrorMessage("New items must have a quantity of at least 1.");
      return;
    }

    setPackItems((previousItems) => [
      ...previousItems,
      {
        id: `${selectedInventoryItem.id}-${Date.now()}`,
        inventory_item_id: selectedInventoryItem.id,
        item: selectedInventoryItem.item_name,
        quantity: String(parsedQuantity),
      },
    ]);

    setFormValues((previousValues) => ({
      ...previousValues,
      selectedItem: "",
      quantity: "",
    }));
    setLocalErrorMessage("");
  };

  const handleFinalSubmit = (event) => {
    event.preventDefault();

    if (!formValues.packName.trim()) {
      setLocalErrorMessage("Pack name is required.");
      return;
    }

    const parsedItems = packItems
      .map((packItem) => ({
        inventory_item_id: packItem.inventory_item_id,
        quantity_required: Number.parseInt(packItem.quantity, 10),
      }))
      .filter(
        (packItem) =>
          packItem.inventory_item_id &&
          Number.isInteger(packItem.quantity_required) &&
          packItem.quantity_required > 0,
      );

    if (parsedItems.length === 0) {
      setLocalErrorMessage(
        "Add at least one inventory item so the relief pack stays connected to inventory.",
      );
      return;
    }

    setLocalErrorMessage("");

    onSubmit({
      name: formValues.packName.trim(),
      description: templateData?.description ?? null,
      based_on_family_size: templateData?.based_on_family_size ?? false,
      based_on_sector: templateData?.based_on_sector ?? false,
      is_active: templateData?.is_active ?? true,
      items: parsedItems,
      family_per_pack_label: formValues.familyPerPack,
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
              {isEditMode ? "Edit Relief Pack" : "Add Relief Pack"}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              ...pageHeaderStyles.secondaryButton,
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            <FiX />
          </button>
        </div>

        <div style={scrollContainerStyles} className="custom-scrollbar">
          <form
            onSubmit={handleFinalSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
              <h3 style={{ margin: "0 0 12px", color: "#17324d" }}>
                Pack Information
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "18px",
                }}
              >
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyles} htmlFor="relief-pack-name">
                    Pack Name
                  </label>
                  <input
                    id="relief-pack-name"
                    name="packName"
                    style={inputStyles}
                    value={formValues.packName}
                    onChange={handleInputChange}
                    placeholder="e.g. Standard Food Pack"
                  />
                </div>

                <div>
                  <label style={labelStyles} htmlFor="relief-pack-selected-item">
                    Add Item to Pack
                  </label>
                  <select
                    id="relief-pack-selected-item"
                    name="selectedItem"
                    style={inputStyles}
                    value={formValues.selectedItem}
                    onChange={handleInputChange}
                  >
                    <option value="">Select Item</option>
                    {inventoryItems.map((inventoryItem) => (
                      <option key={inventoryItem.id} value={inventoryItem.id}>
                        {inventoryItem.item_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyles} htmlFor="relief-pack-quantity">
                    Quantity
                  </label>
                  <input
                    id="relief-pack-quantity"
                    name="quantity"
                    type="number"
                    min="0"
                    style={inputStyles}
                    value={formValues.quantity}
                    onChange={handleInputChange}
                    placeholder="0"
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "end",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleAddItem}
                    style={{ ...primaryBtnStyle, width: "100%" }}
                  >
                    + Add Item
                  </button>
                </div>

                <div>
                  <label style={labelStyles} htmlFor="relief-pack-family">
                    Family per Pack
                  </label>
                  <input
                    id="relief-pack-family"
                    name="familyPerPack"
                    style={inputStyles}
                    value={formValues.familyPerPack}
                    onChange={handleInputChange}
                    placeholder="e.g. 1 family"
                  />
                </div>
              </div>
            </section>

            <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
              <h3 style={{ margin: "0 0 12px", color: "#17324d" }}>
                Pack Items
              </h3>

              {packItems.length === 0 ? (
                <p style={helperTextStyles}>No items have been added to this pack yet.</p>
              ) : (
                <div style={itemPreviewWrapStyles}>
                  <h4 style={itemPreviewTitleStyles}>Added Items</h4>
                  <div>
                    {packItems.map((packItem) => (
                      <span key={packItem.id} style={itemChipStyles}>
                        {packItem.item} · {packItem.quantity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {localErrorMessage || errorMessage ? (
              <p style={errorTextStyles}>{localErrorMessage || errorMessage}</p>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                marginTop: "10px",
                flexWrap: "wrap",
              }}
            >
              <button type="button" onClick={onClose} style={secondaryBtnStyle}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  ...primaryBtnStyle,
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting
                  ? isEditMode
                    ? "Saving..."
                    : "Creating..."
                  : isEditMode
                    ? "Save Changes"
                    : "Create Pack"}
              </button>
            </div>
          </form>
        </div>

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
        `}</style>
      </div>
    </div>
  );
};

export default ReliefPackTemplateFormModal;
