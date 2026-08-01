import React, { useEffect, useState } from "react";
import { FiCheckSquare, FiSquare, FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";
import { DISASTER_TYPE_OPTIONS } from "../../features/disaster-events/disasterTypeOptions";

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

const itemChipRemoveButtonStyles = {
  border: "none",
  background: "transparent",
  color: "#6b8298",
  cursor: "pointer",
  padding: 0,
  marginLeft: "8px",
  fontSize: "14px",
  fontWeight: 700,
  lineHeight: 1,
};

const errorTextStyles = {
  margin: 0,
  color: "#9d4d58",
  fontSize: "14px",
  fontWeight: 600,
};

const confirmModalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(18, 34, 51, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1200,
  },
  modal: {
    width: "100%",
    maxWidth: "460px",
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "28px",
    boxShadow: "0 24px 48px rgba(20, 48, 78, 0.2)",
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "22px",
  },
  message: {
    margin: "12px 0 0",
    color: "#5d7188",
    fontSize: "15px",
    lineHeight: 1.6,
  },
  previewSection: {
    marginTop: "20px",
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid #e1eaf3",
    backgroundColor: "#f8fbfe",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  previewCard: {
    width: "100%",
    maxWidth: "220px",
    minHeight: "160px",
    borderRadius: "14px",
    border: "1px solid #d5e0ea",
    backgroundColor: "#f3f8fc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#698099",
    fontSize: "14px",
    fontWeight: 700,
    textAlign: "center",
    padding: "18px",
    boxSizing: "border-box",
  },
  previewName: {
    margin: "12px 0 0",
    color: "#17324d",
    fontWeight: 700,
    textAlign: "center",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
    flexWrap: "wrap",
  },
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
  familyPerPack: templateData?.description || "1 member",
  packType: templateData?.is_additional_pack ? "additional" : "standard",
  sectorId: templateData?.sector_id || "",
  disasterApplicability:
    templateData?.applies_to_all_disasters === false ? "specific" : "all",
  disasterTypes: Array.isArray(templateData?.disaster_types)
    ? templateData.disaster_types
    : [],
});

const ReliefPackTemplateFormModal = ({
  isOpen,
  mode = "create",
  templateData,
  inventoryItems = [],
  sectorOptions = [],
  errorMessage = "",
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [formValues, setFormValues] = useState(buildInitialFormValues(templateData));
  const [packItems, setPackItems] = useState(buildPackItems(templateData));
  const [localErrorMessage, setLocalErrorMessage] = useState("");
  const [pendingRemovalItem, setPendingRemovalItem] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormValues(buildInitialFormValues(templateData));
    setPackItems(buildPackItems(templateData));
    setLocalErrorMessage("");
    setPendingRemovalItem(null);
  }, [isOpen, templateData]);

  if (!isOpen) {
    return null;
  }

  const isEditMode = mode === "edit";
  const isViewMode = mode === "view";
  const areAllDisasterTypesSelected =
    formValues.disasterTypes.length === DISASTER_TYPE_OPTIONS.length;

  const handleInputChange = (event) => {
    if (isViewMode) {
      return;
    }

    const { name, value } = event.target;
    setLocalErrorMessage("");
    setFormValues((previousValues) => ({
      ...previousValues,
      [name]: value,
      ...(name === "disasterApplicability" && value === "all"
        ? { disasterTypes: [] }
        : {}),
    }));
  };

  const handleDisasterTypeToggle = (disasterType, isChecked) => {
    if (isViewMode) {
      return;
    }

    setLocalErrorMessage("");
    setFormValues((previousValues) => {
      const currentTypes = Array.isArray(previousValues.disasterTypes)
        ? previousValues.disasterTypes
        : [];

      return {
        ...previousValues,
        disasterTypes: isChecked
          ? [...currentTypes, disasterType].sort((leftType, rightType) =>
              leftType.localeCompare(rightType),
            )
          : currentTypes.filter((currentType) => currentType !== disasterType),
      };
    });
  };

  const handleToggleAllDisasterTypes = () => {
    if (isViewMode) {
      return;
    }

    setLocalErrorMessage("");
    setFormValues((previousValues) => ({
      ...previousValues,
      disasterTypes: areAllDisasterTypesSelected ? [] : [...DISASTER_TYPE_OPTIONS],
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

  const handleRemoveItem = (packItem) => {
    setPendingRemovalItem(packItem);
  };

  const handleCancelRemoveItem = () => {
    setPendingRemovalItem(null);
  };

  const handleConfirmRemoveItem = () => {
    if (!pendingRemovalItem) {
      return;
    }

    setPackItems((previousItems) =>
      previousItems.filter((currentItem) => currentItem.id !== pendingRemovalItem.id),
    );
    setPendingRemovalItem(null);
    setLocalErrorMessage("");
  };

  const handleFinalSubmit = (event) => {
    event.preventDefault();

    if (!formValues.packName.trim()) {
      setLocalErrorMessage("Pack name is required.");
      return;
    }

    if (formValues.packType === "additional" && !formValues.sectorId) {
      setLocalErrorMessage("Select the sector that should automatically receive this additional pack.");
      return;
    }

    if (
      formValues.disasterApplicability === "specific" &&
      (!Array.isArray(formValues.disasterTypes) || formValues.disasterTypes.length === 0)
    ) {
      setLocalErrorMessage("Select at least one disaster type for this relief pack.");
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
      description: formValues.familyPerPack.trim() || null,
      based_on_family_size: formValues.packType === "standard",
      based_on_sector: formValues.packType === "additional",
      is_additional_pack: formValues.packType === "additional",
      sector_id:
        formValues.packType === "additional" && formValues.sectorId
          ? formValues.sectorId
          : null,
      applies_to_all_disasters: formValues.disasterApplicability !== "specific",
      disaster_types:
        formValues.disasterApplicability === "specific"
          ? formValues.disasterTypes
          : [],
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
              {isViewMode
                ? "View Relief Pack"
                : isEditMode
                  ? "Edit Relief Pack"
                  : "Add Relief Pack"}
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
                    disabled={isViewMode}
                  />
                </div>

                <div>
                  <label style={labelStyles} htmlFor="relief-pack-type">
                    Pack Type
                  </label>
                  <select
                    id="relief-pack-type"
                    name="packType"
                    style={inputStyles}
                    value={formValues.packType}
                    onChange={handleInputChange}
                    disabled={isViewMode}
                  >
                    <option value="standard">Standard Pack</option>
                    <option value="additional">Additional Pack</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyles} htmlFor="relief-pack-family">
                    Family Size Covered
                  </label>
                  <input
                    id="relief-pack-family"
                    name="familyPerPack"
                    type="number"
                    min="0"
                    style={inputStyles}
                    value={formValues.familyPerPack}
                    onChange={handleInputChange}
                    placeholder="e.g. 5 members"
                    disabled={isViewMode}
                  />
                </div>

                {formValues.packType === "additional" ? (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyles} htmlFor="relief-pack-sector">
                      Sector Match
                    </label>
                    <select
                      id="relief-pack-sector"
                      name="sectorId"
                      style={inputStyles}
                      value={formValues.sectorId}
                      onChange={handleInputChange}
                      disabled={isViewMode}
                    >
                      <option value="">Select sector</option>
                      {sectorOptions.map((sector) => (
                        <option key={sector.id} value={sector.id}>
                          {sector.display_name || sector.name}
                        </option>
                      ))}
                    </select>
                    <p style={helperTextStyles}>
                      Applies to families tagged with this sector.
                    </p>
                  </div>
                ) : null}

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyles} htmlFor="relief-pack-disaster-applicability">
                    Disaster Applicability
                  </label>
                  <select
                    id="relief-pack-disaster-applicability"
                    name="disasterApplicability"
                    style={inputStyles}
                    value={formValues.disasterApplicability}
                    onChange={handleInputChange}
                    disabled={isViewMode}
                  >
                    <option value="all">All disaster types</option>
                    <option value="specific">Only selected disaster types</option>
                  </select>
                  <p style={helperTextStyles}>
                    Use this to mark whether the pack can be used for every disaster event or only for selected types.
                  </p>
                </div>

                {formValues.disasterApplicability === "specific" ? (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyles}>Applicable Disaster Types</label>
                    {isViewMode ? null : (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          marginBottom: "12px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={handleToggleAllDisasterTypes}
                          style={{
                            border: areAllDisasterTypesSelected
                              ? "none"
                              : "1px solid #c6d8ea",
                            borderRadius: "12px",
                            padding: "8px 14px",
                            background: areAllDisasterTypesSelected
                              ? "linear-gradient(135deg, #2f6499 0%, #4c86be 100%)"
                              : "#f8fbfe",
                            color: areAllDisasterTypesSelected ? "#ffffff" : "#2a4c6f",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          {areAllDisasterTypesSelected ? (
                            <FiCheckSquare size={14} />
                          ) : (
                            <FiSquare size={14} />
                          )}

                          {areAllDisasterTypesSelected ? "Unselect All" : "Select All"}
                        </button>
                      </div>
                    )}

                    <p style={helperTextStyles}>
                      Selected disaster types will be the only events where this pack applies.
                    </p>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "12px",
                      }}
                    >
                      {DISASTER_TYPE_OPTIONS.map((disasterType) => (
                        <label
                          key={disasterType}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            border: "1px solid #d4dfeb",
                            borderRadius: "999px",
                            padding: "10px 14px",
                            backgroundColor: "#f8fbfe",
                            color: "#385a7b",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: isViewMode ? "default" : "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={formValues.disasterTypes.includes(disasterType)}
                            onChange={(event) =>
                              handleDisasterTypeToggle(
                                disasterType,
                                event.target.checked,
                              )
                            }
                            disabled={isViewMode}
                          />
                          {disasterType}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

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
                    disabled={isViewMode}
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
                    Quantity per Pack
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
                    disabled={isViewMode}
                  />
                </div>

                {isViewMode ? null : (
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
                )}

              </div>
            </section>

            <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
              <h3 style={{ margin: "0 0 12px", color: "#17324d" }}>
                Items in Pack
              </h3>

              {packItems.length === 0 ? (
                <p style={helperTextStyles}>
                  No items have been added to this pack yet.
                </p>
              ) : (
                <div style={itemPreviewWrapStyles}>
                  <h4 style={itemPreviewTitleStyles}>Added Items</h4>
                  <div>
                    {packItems.map((packItem) => (
                      <span key={packItem.id} style={itemChipStyles}>
                        {packItem.item} - {packItem.quantity}
                        {isViewMode ? null : (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(packItem)}
                            style={itemChipRemoveButtonStyles}
                            title={`Remove ${packItem.item}`}
                            aria-label={`Remove ${packItem.item}`}
                          >
                            x
                          </button>
                        )}
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
                {isViewMode ? "Close" : "Cancel"}
              </button>
              {isViewMode ? null : (
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
              )}
            </div>
          </form>
        </div>

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
        `}</style>
      </div>

      {pendingRemovalItem ? (
        <div style={confirmModalStyles.overlay}>
          <div style={confirmModalStyles.modal}>
            <h3 style={confirmModalStyles.title}>Confirm Removal</h3>

            <p style={confirmModalStyles.message}>
              Are you sure you want to remove this item from the relief pack?
            </p>

            <div style={confirmModalStyles.actions}>
              <button
                type="button"
                onClick={handleCancelRemoveItem}
                style={secondaryBtnStyle}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRemoveItem}
                style={primaryBtnStyle}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ReliefPackTemplateFormModal;
