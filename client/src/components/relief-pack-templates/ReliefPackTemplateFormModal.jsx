import React, { useEffect, useState } from "react";
import {
  FiCheckSquare,
  FiEdit2,
  FiPlus,
  FiSquare,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
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
  width: "min(980px, 100%)",
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

const getInputStyles = (hasError) => ({
  ...inputStyles,
  border: `1px solid ${hasError ? "#c53030" : "#d2deea"}`,
});

const getDisabledInputStyles = (hasError) => ({
  ...getInputStyles(hasError),
  backgroundColor: "#eef3f8",
  color: "#5f748a",
  cursor: "not-allowed",
});

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

const sectionStyles = {
  border: "1px solid #d7e2ef",
  borderRadius: "18px",
  backgroundColor: "#ffffff",
  padding: "20px",
};

const sectionTitleStyles = {
  margin: "0 0 16px",
  color: "#17324d",
  fontSize: "20px",
};

const fieldErrorTextStyles = {
  margin: "6px 0 0",
  color: "#c53030",
  fontSize: "12px",
  lineHeight: 1.4,
};

const itemPreviewWrapStyles = {
  border: "1px solid #d4dfeb",
  borderRadius: "14px",
  backgroundColor: "#f8fbff",
  padding: "14px 16px",
};

const itemPreviewTitleStyles = {
  margin: "0 0 14px",
  color: "#17324d",
  fontSize: "18px",
  fontWeight: 700,
};

const itemRowStyles = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "14px 16px",
  borderRadius: "14px",
  border: "1px solid #d4dfeb",
  backgroundColor: "#ffffff",
  marginBottom: "10px",
};

const itemRowContentStyles = {
  minWidth: 0,
  display: "grid",
  gap: "4px",
};

const itemRowTitleStyles = {
  color: "#17324d",
  fontSize: "14px",
  fontWeight: 800,
  lineHeight: 1.35,
};

const itemRowQuantityStyles = {
  color: "#60738a",
  fontSize: "14px",
  fontWeight: 500,
};

const itemActionGroupStyles = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  flexShrink: 0,
};

const itemIconButtonStyles = {
  border: "1px solid #c6d8ea",
  borderRadius: "12px",
  width: "38px",
  height: "38px",
  padding: 0,
  backgroundColor: "#f8fbfe",
  color: "#24496e",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const itemDeleteButtonStyles = {
  ...itemIconButtonStyles,
  color: "#9d3442",
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

const normalizeComparableList = (values) =>
  [...(Array.isArray(values) ? values : [])]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .sort((leftValue, rightValue) => leftValue.localeCompare(rightValue));

const areListsEqual = (leftValues, rightValues) => {
  const normalizedLeftValues = normalizeComparableList(leftValues);
  const normalizedRightValues = normalizeComparableList(rightValues);

  return (
    normalizedLeftValues.length === normalizedRightValues.length &&
    normalizedLeftValues.every(
      (leftValue, index) => leftValue === normalizedRightValues[index],
    )
  );
};

const normalizeComparablePackItems = (items) =>
  [...(Array.isArray(items) ? items : [])]
    .map((item) => ({
      inventory_item_id: String(item.inventory_item_id || "").trim(),
      quantity: Number.parseInt(
        String(item.quantity || item.quantity_required || 0),
        10,
      ),
    }))
    .filter((item) => item.inventory_item_id)
    .sort((leftItem, rightItem) =>
      leftItem.inventory_item_id.localeCompare(rightItem.inventory_item_id),
    );

const arePackItemsEqual = (leftItems, rightItems) => {
  const normalizedLeftItems = normalizeComparablePackItems(leftItems);
  const normalizedRightItems = normalizeComparablePackItems(rightItems);

  return (
    normalizedLeftItems.length === normalizedRightItems.length &&
    normalizedLeftItems.every((leftItem, index) => {
      const rightItem = normalizedRightItems[index];

      return (
        leftItem.inventory_item_id === rightItem.inventory_item_id &&
        leftItem.quantity === rightItem.quantity
      );
    })
  );
};

const noticeStyles = {
  margin: "0 0 16px",
  border: "1px solid #d0ddeb",
  borderRadius: "14px",
  backgroundColor: "#f8fbfe",
  color: "#385a7b",
  padding: "12px 14px",
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: 1.5,
};

const getFamilyCoverageValue = (value) => {
  const parsedCoverage = Number.parseInt(String(value || "").trim(), 10);
  return Number.isInteger(parsedCoverage) && parsedCoverage > 0
    ? String(parsedCoverage)
    : "1";
};

const buildInitialFormValues = (templateData) => ({
  packName: templateData?.name || "",
  selectedItem: "",
  quantity: "",
  familyPerPack: getFamilyCoverageValue(templateData?.description),
  packType: templateData?.is_additional_pack ? "additional" : "standard",
  sectorIds: Array.isArray(templateData?.sector_ids)
    ? templateData.sector_ids
    : templateData?.sector_id
      ? [templateData.sector_id]
      : [],
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
  const [fieldErrors, setFieldErrors] = useState({});
  const [pendingRemovalItem, setPendingRemovalItem] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormValues(buildInitialFormValues(templateData));
    setPackItems(buildPackItems(templateData));
    setLocalErrorMessage("");
    setFieldErrors({});
    setPendingRemovalItem(null);
  }, [isOpen, templateData]);

  if (!isOpen) {
    return null;
  }

  const isEditMode = mode === "edit";
  const isViewMode = mode === "view";
  const usageSummary = templateData?.usage_summary || {};
  const isTemplateUsed = Boolean(usageSummary.is_used);
  const lockedDisasterTypeOptions = Array.isArray(
    usageSummary.locked_disaster_type_options,
  )
    ? usageSummary.locked_disaster_type_options
    : [];
  const isPackTypeLocked = isEditMode || isViewMode;
  const areTemplateDefinitionFieldsLocked = isViewMode || isTemplateUsed;
  const areItemFieldsLocked = isViewMode || isTemplateUsed;
  const areAllDisasterTypesSelected =
    formValues.disasterTypes.length === DISASTER_TYPE_OPTIONS.length;
  const areAllSectorsSelected =
    sectorOptions.length > 0 && formValues.sectorIds.length === sectorOptions.length;

  const handleInputChange = (event) => {
    if (isViewMode) {
      return;
    }

    const { name, value } = event.target;

    if (
      (name === "packName" && areTemplateDefinitionFieldsLocked) ||
      (name === "familyPerPack" && areTemplateDefinitionFieldsLocked) ||
      (name === "packType" && isPackTypeLocked) ||
      ((name === "selectedItem" || name === "quantity") && areItemFieldsLocked)
    ) {
      return;
    }

    setLocalErrorMessage("");
    setFieldErrors((previousErrors) => ({
      ...previousErrors,
      [name]: "",
      ...(name === "packType" ? { sectorIds: "" } : {}),
      ...(name === "disasterApplicability" ? { disasterTypes: "" } : {}),
    }));
    setFormValues((previousValues) => ({
      ...previousValues,
      [name]: value,
      ...(name === "packType" && value === "standard" ? { sectorIds: [] } : {}),
      ...(name === "disasterApplicability" && value === "all"
        ? { disasterTypes: [] }
        : {}),
      ...(name === "disasterApplicability" &&
      value === "specific" &&
      previousValues.disasterApplicability === "all"
        ? { disasterTypes: [...DISASTER_TYPE_OPTIONS] }
        : {}),
    }));
  };

  const handleSectorToggle = (sectorId, isChecked) => {
    if (areTemplateDefinitionFieldsLocked) {
      return;
    }

    setLocalErrorMessage("");
    setFieldErrors((previousErrors) => ({
      ...previousErrors,
      sectorIds: "",
    }));
    setFormValues((previousValues) => {
      const currentSectorIds = Array.isArray(previousValues.sectorIds)
        ? previousValues.sectorIds
        : [];

      return {
        ...previousValues,
        sectorIds: isChecked
          ? [...currentSectorIds, sectorId].sort((leftSectorId, rightSectorId) =>
              leftSectorId.localeCompare(rightSectorId),
            )
          : currentSectorIds.filter((currentSectorId) => currentSectorId !== sectorId),
      };
    });
  };

  const handleToggleAllSectors = () => {
    if (areTemplateDefinitionFieldsLocked) {
      return;
    }

    setLocalErrorMessage("");
    setFieldErrors((previousErrors) => ({
      ...previousErrors,
      sectorIds: "",
    }));
    setFormValues((previousValues) => ({
      ...previousValues,
      sectorIds: areAllSectorsSelected
        ? []
        : sectorOptions.map((sector) => sector.id).filter(Boolean),
    }));
  };

  const handleDisasterTypeToggle = (disasterType, isChecked) => {
    if (isViewMode) {
      return;
    }

    if (!isChecked && lockedDisasterTypeOptions.includes(disasterType)) {
      return;
    }

    setLocalErrorMessage("");
    setFieldErrors((previousErrors) => ({
      ...previousErrors,
      disasterTypes: "",
    }));
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
    setFieldErrors((previousErrors) => ({
      ...previousErrors,
      disasterTypes: "",
    }));
    setFormValues((previousValues) => ({
      ...previousValues,
      disasterTypes: areAllDisasterTypesSelected
        ? lockedDisasterTypeOptions
        : [...DISASTER_TYPE_OPTIONS],
    }));
  };

  const handleAddItem = () => {
    if (areItemFieldsLocked) {
      return;
    }

    const selectedInventoryItem = inventoryItems.find(
      (inventoryItem) => inventoryItem.id === formValues.selectedItem,
    );
    const parsedQuantity = Number.parseInt(formValues.quantity, 10);
    const nextErrors = {};

    if (!selectedInventoryItem) {
      nextErrors.selectedItem = "Inventory item is required.";
    }

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      nextErrors.quantity = "Quantity per pack is required.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors((previousErrors) => ({
        ...previousErrors,
        ...nextErrors,
      }));
      setLocalErrorMessage("");
      return;
    }

    const duplicateItem = packItems.find(
      (packItem) => packItem.inventory_item_id === selectedInventoryItem.id,
    );

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
      setFieldErrors((previousErrors) => ({
        ...previousErrors,
        selectedItem: "",
        quantity: "",
        packItems: "",
      }));
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
    setFieldErrors((previousErrors) => ({
      ...previousErrors,
      selectedItem: "",
      quantity: "",
      packItems: "",
    }));
  };

  const handleEditPackItem = (packItem) => {
    if (areItemFieldsLocked) {
      return;
    }

    setPackItems((previousItems) =>
      previousItems.filter((currentItem) => currentItem.id !== packItem.id),
    );
    setFormValues((previousValues) => ({
      ...previousValues,
      selectedItem: packItem.inventory_item_id,
      quantity: packItem.quantity,
    }));
    setLocalErrorMessage("");
    setFieldErrors((previousErrors) => ({
      ...previousErrors,
      selectedItem: "",
      quantity: "",
      packItems: "",
    }));
  };

  const handleRemoveItem = (packItem) => {
    if (areItemFieldsLocked) {
      return;
    }

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
    const nextErrors = {};
    const familyCoverage = Number.parseInt(formValues.familyPerPack, 10);
    const originalFormValues = buildInitialFormValues(templateData);
    const originalPackItems = buildPackItems(templateData);
    const packTypeChanged =
      isEditMode && formValues.packType !== originalFormValues.packType;

    if (!formValues.packName.trim()) {
      nextErrors.packName = "Pack name is required.";
    }

    if (packTypeChanged) {
      nextErrors.packType = "Pack type cannot be changed after creation.";
    }

    if (
      formValues.packType === "standard" &&
      (!Number.isInteger(familyCoverage) || familyCoverage <= 0)
    ) {
      nextErrors.familyPerPack = "Family size covered is required.";
    }

    if (
      formValues.packType === "additional" &&
      (!Array.isArray(formValues.sectorIds) || formValues.sectorIds.length === 0)
    ) {
      nextErrors.sectorIds = "Sector match is required.";
    }

    if (
      formValues.disasterApplicability === "specific" &&
      (!Array.isArray(formValues.disasterTypes) || formValues.disasterTypes.length === 0)
    ) {
      nextErrors.disasterTypes = "Select at least one disaster type.";
    }

    if (formValues.disasterApplicability === "specific") {
      const removedLockedDisasterTypes = lockedDisasterTypeOptions.filter(
        (disasterType) => !formValues.disasterTypes.includes(disasterType),
      );

      if (removedLockedDisasterTypes.length > 0) {
        nextErrors.disasterTypes =
          "Used disaster types cannot be removed from this relief pack.";
      }
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
      nextErrors.packItems = "Add at least one inventory item.";
    }

    if (isTemplateUsed) {
      const templateDefinitionChanged =
        formValues.packName.trim() !== originalFormValues.packName.trim() ||
        formValues.familyPerPack !== originalFormValues.familyPerPack ||
        !areListsEqual(formValues.sectorIds, originalFormValues.sectorIds);

      if (templateDefinitionChanged) {
        setFieldErrors(nextErrors);
        setLocalErrorMessage(
          "This relief pack already has distribution records, so pack details and rules cannot be changed.",
        );
        return;
      }

      if (!arePackItemsEqual(packItems, originalPackItems)) {
        setFieldErrors(nextErrors);
        setLocalErrorMessage(
          "This relief pack already has distribution records, so included items and quantities cannot be changed.",
        );
        return;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setLocalErrorMessage("");
      return;
    }

    setLocalErrorMessage("");
    setFieldErrors({});

    onSubmit({
      name: formValues.packName.trim(),
      description:
        formValues.packType === "standard"
          ? formValues.familyPerPack.trim() || null
          : null,
      based_on_family_size: formValues.packType === "standard",
      based_on_sector: formValues.packType === "additional",
      is_additional_pack: formValues.packType === "additional",
      sector_ids:
        formValues.packType === "additional" ? formValues.sectorIds : [],
      sector_id:
        formValues.packType === "additional" && formValues.sectorIds.length > 0
          ? formValues.sectorIds[0]
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
            noValidate
            onSubmit={handleFinalSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            <section style={sectionStyles}>
              <h3 style={sectionTitleStyles}>
                Pack Information
              </h3>

              {isEditMode && isTemplateUsed ? (
                <p style={noticeStyles}>
                  This relief pack already has distribution records. Pack details,
                  rules, and items are locked; only unused disaster applicability
                  options can be changed.
                </p>
              ) : null}

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
                    style={
                      areTemplateDefinitionFieldsLocked
                        ? getDisabledInputStyles(Boolean(fieldErrors.packName))
                        : getInputStyles(Boolean(fieldErrors.packName))
                    }
                    value={formValues.packName}
                    onChange={handleInputChange}
                    placeholder="e.g. Standard Food Pack"
                    disabled={areTemplateDefinitionFieldsLocked}
                    aria-invalid={Boolean(fieldErrors.packName)}
                  />
                  {fieldErrors.packName ? (
                    <p style={fieldErrorTextStyles}>{fieldErrors.packName}</p>
                  ) : null}
                </div>

                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "18px",
                  }}
                >
                  <div>
                    <label style={labelStyles} htmlFor="relief-pack-type">
                      Pack Type
                    </label>
                    <select
                      id="relief-pack-type"
                      name="packType"
                      style={
                        isPackTypeLocked
                          ? getDisabledInputStyles(false)
                          : inputStyles
                      }
                      value={formValues.packType}
                      onChange={handleInputChange}
                      disabled={isPackTypeLocked}
                    >
                      <option value="standard">Standard Pack</option>
                      <option value="additional">Additional Pack</option>
                    </select>
                    {fieldErrors.packType ? (
                      <p style={fieldErrorTextStyles}>{fieldErrors.packType}</p>
                    ) : null}
                  </div>

                  {formValues.packType === "standard" ? (
                    <div>
                      <label style={labelStyles} htmlFor="relief-pack-family">
                        Family Size Covered
                      </label>
                      <input
                        id="relief-pack-family"
                        name="familyPerPack"
                        type="number"
                        min="1"
                        style={
                          areTemplateDefinitionFieldsLocked
                            ? getDisabledInputStyles(Boolean(fieldErrors.familyPerPack))
                            : getInputStyles(Boolean(fieldErrors.familyPerPack))
                        }
                        value={formValues.familyPerPack}
                        onChange={handleInputChange}
                        placeholder="e.g. 5"
                        disabled={areTemplateDefinitionFieldsLocked}
                        aria-invalid={Boolean(fieldErrors.familyPerPack)}
                      />
                      {fieldErrors.familyPerPack ? (
                        <p style={fieldErrorTextStyles}>{fieldErrors.familyPerPack}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {formValues.packType === "additional" ? (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyles}>Sector Match</label>
                    {areTemplateDefinitionFieldsLocked ? null : (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          marginBottom: "12px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={handleToggleAllSectors}
                          style={{
                            border: areAllSectorsSelected
                              ? "none"
                              : "1px solid #c6d8ea",
                            borderRadius: "12px",
                            padding: "8px 14px",
                            background: areAllSectorsSelected
                              ? "linear-gradient(135deg, #2f6499 0%, #4c86be 100%)"
                              : "#f8fbfe",
                            color: areAllSectorsSelected ? "#ffffff" : "#2a4c6f",
                            fontSize: "13px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          {areAllSectorsSelected ? (
                            <FiCheckSquare size={14} />
                          ) : (
                            <FiSquare size={14} />
                          )}

                          {areAllSectorsSelected ? "Unselect All" : "Select All"}
                        </button>
                      </div>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "12px",
                      }}
                    >
                      {sectorOptions.map((sector) => (
                        <label
                          key={sector.id}
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
                            checked={formValues.sectorIds.includes(sector.id)}
                            onChange={(event) =>
                              handleSectorToggle(sector.id, event.target.checked)
                            }
                            disabled={areTemplateDefinitionFieldsLocked}
                          />
                          {sector.display_name || sector.name}
                        </label>
                      ))}
                    </div>
                    {fieldErrors.sectorIds ? (
                      <p style={fieldErrorTextStyles}>{fieldErrors.sectorIds}</p>
                    ) : null}
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

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "12px",
                      }}
                    >
                      {DISASTER_TYPE_OPTIONS.map((disasterType) => {
                        const isDisasterTypeLocked =
                          lockedDisasterTypeOptions.includes(disasterType);

                        return (
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
                              cursor:
                                isViewMode || isDisasterTypeLocked
                                  ? "default"
                                  : "pointer",
                              opacity: isDisasterTypeLocked ? 0.75 : 1,
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
                              disabled={isViewMode || isDisasterTypeLocked}
                            />
                            {disasterType}
                            {isDisasterTypeLocked ? " (used)" : ""}
                          </label>
                        );
                      })}
                    </div>
                    {fieldErrors.disasterTypes ? (
                      <p style={fieldErrorTextStyles}>{fieldErrors.disasterTypes}</p>
                    ) : null}
                  </div>
                ) : null}

                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "18px",
                  }}
                >
                  <div>
                    <label style={labelStyles} htmlFor="relief-pack-selected-item">
                      Add Item to Pack
                    </label>
                    <select
                      id="relief-pack-selected-item"
                      name="selectedItem"
                      style={
                        areItemFieldsLocked
                          ? getDisabledInputStyles(Boolean(fieldErrors.selectedItem))
                          : getInputStyles(Boolean(fieldErrors.selectedItem))
                      }
                      value={formValues.selectedItem}
                      onChange={handleInputChange}
                      disabled={areItemFieldsLocked}
                      aria-invalid={Boolean(fieldErrors.selectedItem)}
                    >
                      <option value="">Select Item</option>
                      {inventoryItems.map((inventoryItem) => (
                        <option key={inventoryItem.id} value={inventoryItem.id}>
                          {inventoryItem.item_name}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.selectedItem ? (
                      <p style={fieldErrorTextStyles}>{fieldErrors.selectedItem}</p>
                    ) : null}
                  </div>

                  <div>
                    <label style={labelStyles} htmlFor="relief-pack-quantity">
                      Quantity per Pack
                    </label>
                    <input
                      id="relief-pack-quantity"
                      name="quantity"
                      type="number"
                      min="1"
                      style={
                        areItemFieldsLocked
                          ? getDisabledInputStyles(Boolean(fieldErrors.quantity))
                          : getInputStyles(Boolean(fieldErrors.quantity))
                      }
                      value={formValues.quantity}
                      onChange={handleInputChange}
                      placeholder="0"
                      disabled={areItemFieldsLocked}
                      aria-invalid={Boolean(fieldErrors.quantity)}
                    />
                    {fieldErrors.quantity ? (
                      <p style={fieldErrorTextStyles}>{fieldErrors.quantity}</p>
                    ) : null}
                  </div>
                </div>

                {areItemFieldsLocked ? null : (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      marginTop: "-6px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        type="button"
                        onClick={handleAddItem}
                        style={{
                          ...pageHeaderStyles.primaryButton,
                          minWidth: "128px",
                        }}
                      >
                        <FiPlus size={16} />
                        Add Item
                      </button>
                    </div>
                    {fieldErrors.packItems ? (
                      <p style={fieldErrorTextStyles}>{fieldErrors.packItems}</p>
                    ) : null}
                  </div>
                )}

              </div>
            </section>

            <section style={sectionStyles}>
              <div style={itemPreviewWrapStyles}>
                <h4 style={itemPreviewTitleStyles}>
                  {formValues.packName.trim() || "New Relief Pack"}
                </h4>
                {packItems.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      color: "#60738a",
                      fontSize: "14px",
                    }}
                  >
                    No items have been added to this relief pack yet.
                  </p>
                ) : (
                  <div>
                    {packItems.map((packItem) => (
                      <div key={packItem.id} style={itemRowStyles}>
                        <div style={itemRowContentStyles}>
                          <span style={itemRowTitleStyles}>{packItem.item}</span>
                          <span style={itemRowQuantityStyles}>
                            {packItem.quantity} per relief pack
                          </span>
                        </div>

                        {areItemFieldsLocked ? null : (
                          <div style={itemActionGroupStyles}>
                            <button
                              type="button"
                              onClick={() => handleEditPackItem(packItem)}
                              style={itemIconButtonStyles}
                              title={`Edit ${packItem.item}`}
                              aria-label={`Edit ${packItem.item}`}
                            >
                              <FiEdit2 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(packItem)}
                              style={itemDeleteButtonStyles}
                              title={`Remove ${packItem.item}`}
                              aria-label={`Remove ${packItem.item}`}
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                      : "Create"}
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
