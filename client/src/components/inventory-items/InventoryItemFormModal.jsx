import React, { useCallback, useEffect, useRef, useState } from "react";
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

const lockedInputStyles = {
  ...inputStyles,
  backgroundColor: "#eef5fb",
  color: "#5f7891",
  cursor: "not-allowed",
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

const fieldErrorTextStyles = {
  margin: "6px 0 0",
  color: "#c53030",
  fontSize: "12px",
  lineHeight: 1.4,
};

const matchNoticeStyles = {
  margin: "10px 0 0",
  color: "#17324d",
  fontSize: "13px",
  fontWeight: 600,
};

const formFooterStyles = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "18px 20px",
  borderRadius: "18px",
  border: "1px solid #d7e2ef",
  backgroundColor: "#ffffff",
  boxShadow: "0 16px 34px rgba(23, 50, 77, 0.08)",
  flexWrap: "wrap",
};

const footerTotalStyles = {
  margin: 0,
  color: "#4f677f",
  fontSize: "15px",
};

const footerActionsStyles = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  flexWrap: "wrap",
};

const editFooterActionsStyles = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  flexWrap: "wrap",
};

const unitOfMeasureOptions = ["kg", "g", "L", "mL", "pc"];
const packagingOptions = ["piece", "pack", "box", "case", "carton", "sack", "bottle"];

const weightOrVolumeUnits = new Set(["kg", "g", "L", "mL"]);

const getNormalizedInventoryText = (value) =>
  String(value || "").trim().toLowerCase();

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
  tracking_method: "Count-Based",
});

const inferTrackingMethod = (unitOfMeasure) => {
  return weightOrVolumeUnits.has(unitOfMeasure)
    ? "Weight/Volume-Based"
    : "Count-Based";
};

const isWeightOrVolumeBased = (trackingMethod) =>
  trackingMethod === "Weight/Volume-Based";

const formatPackagingLabel = (packaging) => {
  if (!packaging) {
    return "Packaging";
  }

  return packaging.charAt(0).toUpperCase() + packaging.slice(1);
};

const formatPackagingExample = (packaging) => {
  if (!packaging) {
    return "Enter quantity on hand";
  }

  if (packaging === "piece") {
    return "Example: 20 pieces";
  }

  if (packaging === "box") {
    return "Example: 20 boxes";
  }

  return `Example: 20 ${packaging}s`;
};

const getStockMultiplierValue = (formValues, isPiecePackaging) => {
  if (isPiecePackaging) {
    return 1;
  }

  return parsePositiveNumberOrZero(formValues.quantity);
};

const parsePositiveNumberOrZero = (value) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return 0;
  }

  return parsedValue;
};

const isBlank = (value) => String(value ?? "").trim() === "";

const isPositiveNumber = (value) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0;
};

const isValidDateValue = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const getTodayDateInputValue = () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
};

const formatComputedValue = (value) => {
  if (!Number.isFinite(value)) {
    return "--";
  }

  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const InventoryItemFormModal = ({
  isOpen,
  mode,
  source = "manual",
  itemData,
  inventoryItems = [],
  getCurrentStockForItem = null,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [formValues, setFormValues] = useState(createDefaultForm());
  const [fieldErrors, setFieldErrors] = useState({});
  const barcodeInputRef = useRef(null);
  const previousMatchedItemKeyRef = useRef("");
  const shouldShowBarcodeField = source === "scan" || mode === "edit";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (itemData) {
      const resolvedUnitOfMeasure = itemData.unit_of_measure || itemData.unit || "";
      setFormValues({
        item_name: itemData.item_name || itemData.name || "",
        barcode: itemData.barcode || "",
        quantity: itemData.quantity || "",
        unit_of_measure: resolvedUnitOfMeasure,
        unit_of_measure_value: itemData.unit_of_measure_value || "",
        packaging: itemData.packaging || "",
        packaging_count: itemData.packaging_count || "",
        category: normalizeCategoryValue(itemData.category),
        expiration_date: itemData.expiration_date ?? itemData.expiryDate ?? "",
        reorder_level: itemData.reorder_level ?? "",
        tracking_method:
          itemData.tracking_method || inferTrackingMethod(resolvedUnitOfMeasure),
      });
    } else {
      setFormValues(createDefaultForm());
    }

    setFieldErrors({});
  }, [isOpen, itemData]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const focusTimer = window.setTimeout(() => {
      if (shouldShowBarcodeField) {
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      }
    }, 50);

    return () => window.clearTimeout(focusTimer);
  }, [isOpen, shouldShowBarcodeField]);

  const trimmedBarcode = shouldShowBarcodeField ? formValues.barcode.trim() : "";
  const trimmedItemName = formValues.item_name.trim();

  const matchedExistingItem =
    mode === "create" && trimmedItemName
      ? inventoryItems.find((item) => {
          const hasBarcodeStockForm = Array.isArray(item?.stock_forms)
            ? item.stock_forms.some((stockForm) => String(stockForm?.barcode || "").trim())
            : false;
          const isSameItemName =
            getNormalizedInventoryText(item?.item_name) ===
            getNormalizedInventoryText(trimmedItemName);

          if (!isSameItemName) {
            return false;
          }

          if (source === "scan" && trimmedBarcode) {
            return true;
          }

          return (
            !String(item?.barcode || "").trim() &&
            !hasBarcodeStockForm
          );
        }) || null
      : null;

  const isBarcodeStockFormMode =
    source === "scan" && Boolean(trimmedBarcode) && Boolean(matchedExistingItem);
  const isNameMatchedRestock = Boolean(matchedExistingItem);
  const isRestockMode = mode === "create" && Boolean(matchedExistingItem);

  useEffect(() => {
    if (!isOpen || mode !== "create") {
      previousMatchedItemKeyRef.current = "";
      return;
    }

    const matchedItemKey = matchedExistingItem?.id || "";

    if (previousMatchedItemKeyRef.current === matchedItemKey) {
      return;
    }

    previousMatchedItemKeyRef.current = matchedItemKey;

    if (!matchedExistingItem) {
      return;
    }

    const resolvedUnitOfMeasure =
      matchedExistingItem.unit_of_measure || matchedExistingItem.unit || "";
    const resolvedTrackingMethod =
      matchedExistingItem.tracking_method ||
      inferTrackingMethod(resolvedUnitOfMeasure);

    const defaultStockForm =
      Array.isArray(matchedExistingItem.stock_forms) &&
      matchedExistingItem.stock_forms.length > 0
        ? matchedExistingItem.stock_forms[0]
        : null;

    setFormValues((prev) => ({
      ...prev,
      item_name: matchedExistingItem.item_name || prev.item_name,
      barcode: isBarcodeStockFormMode
        ? prev.barcode
        : matchedExistingItem.barcode || prev.barcode,
      category: normalizeCategoryValue(matchedExistingItem.category),
      tracking_method: resolvedTrackingMethod,
      unit_of_measure:
        resolvedTrackingMethod === "Count-Based"
          ? "pc"
          : resolvedUnitOfMeasure || prev.unit_of_measure,
      unit_of_measure_value:
        matchedExistingItem.unit_of_measure_value || prev.unit_of_measure_value,
      packaging:
        defaultStockForm?.packaging ||
        matchedExistingItem.packaging ||
        prev.packaging,
      quantity: String(
        defaultStockForm?.units_per_packaging ||
          matchedExistingItem.quantity ||
          ((defaultStockForm?.packaging || matchedExistingItem.packaging) === "piece"
            ? 1
            : ""),
      ),
      reorder_level:
        matchedExistingItem.reorder_level != null
          ? String(matchedExistingItem.reorder_level)
          : prev.reorder_level,
      expiration_date: "",
    }));
    setFieldErrors({});
  }, [isBarcodeStockFormMode, isOpen, matchedExistingItem, mode]);

  const handleChange = useCallback((fieldName, value) => {
    setFieldErrors((prev) => {
      const fieldsToClear = [fieldName];

      if (fieldName === "category") {
        fieldsToClear.push("expiration_date");
      }

      if (fieldName === "tracking_method") {
        fieldsToClear.push("unit_of_measure", "unit_of_measure_value");
      }

      if (fieldName === "packaging") {
        fieldsToClear.push("packaging_count", "quantity");
      }

      const nextErrors = { ...prev };
      fieldsToClear.forEach((field) => {
        delete nextErrors[field];
      });
      return nextErrors;
    });

    setFormValues((prev) => {
      if (fieldName === "tracking_method") {
        const nextValues = {
          ...prev,
          tracking_method: value,
        };

        if (value === "Count-Based") {
          nextValues.unit_of_measure = "pc";
          nextValues.unit_of_measure_value = "";
        }

        return nextValues;
      }

      if (fieldName === "unit_of_measure" && prev.tracking_method === "Count-Based") {
        return {
          ...prev,
          unit_of_measure: "pc",
        };
      }

      if (fieldName === "packaging") {
        return {
          ...prev,
          packaging: value,
          quantity: value === "piece" ? "1" : prev.quantity,
        };
      }

      return { ...prev, [fieldName]: value };
    });
  }, []);

  if (!isOpen) {
    return null;
  }

  const trackingMethod = formValues.tracking_method || "Count-Based";
  const isEditMode = mode === "edit";
  const usesWeightOrVolume = isWeightOrVolumeBased(trackingMethod);
  const isPerishable = normalizeCategoryValue(formValues.category) === "perishable";
  const selectedPackagingLabel = formatPackagingLabel(formValues.packaging);
  const isPiecePackaging = formValues.packaging === "piece";
  const shouldShowUnitsPerPackagingField = !isPiecePackaging;
  const unitValueLabel = usesWeightOrVolume
    ? "Amount per Piece/Container"
    : "Units per Packaging";
  const unitValuePlaceholder = usesWeightOrVolume
    ? `Example: 25 ${formValues.unit_of_measure || "kg"} per piece/container`
    : "";
  const quantityFieldLabel = usesWeightOrVolume
    ? "Items per Package"
    : `Units per ${selectedPackagingLabel}`;
  const quantityFieldPlaceholder = usesWeightOrVolume
    ? `Example: 1 ${formValues.packaging || "package"} contains 1 item`
    : `Example: 12 pieces per ${formValues.packaging || "package"}`;
  const quantityOnHandLabel = usesWeightOrVolume
    ? "Packages Received"
    : "Quantity on Hand";
  const quantityOnHandPlaceholder = usesWeightOrVolume
    ? formatPackagingExample(formValues.packaging).replace(
        /^Example:\s*/i,
        "Example: received ",
      )
    : formatPackagingExample(formValues.packaging);
  const computedTotalLabel = usesWeightOrVolume
    ? "Total Measured Stock"
    : "Total Added Stock";
  const packageCountValue = parsePositiveNumberOrZero(formValues.packaging_count);
  const quantityPerPackageValue = getStockMultiplierValue(
    formValues,
    isPiecePackaging,
  );
  const computedTotalStock =
    packageCountValue > 0 && quantityPerPackageValue > 0
      ? packageCountValue * quantityPerPackageValue
      : 0;
  const hasComputedTotalInputs = packageCountValue > 0 && quantityPerPackageValue > 0;
  const computedTotalUnit =
    trackingMethod === "Count-Based"
      ? formValues.unit_of_measure || "pc"
      : formValues.unit_of_measure || "";
  const titleText =
    isEditMode
      ? "Edit Inventory Item"
      : isRestockMode
        ? isBarcodeStockFormMode
          ? "Add Barcode Stock Form"
          : "Restock Existing Item"
        : "Add Item";
  const stockSectionTitle = isEditMode
    ? "Item Settings"
    : isRestockMode
      ? "Restock Details"
      : "Stock Details";
  const matchedItemLabel = matchedExistingItem?.item_name || trimmedItemName;
  const identityFieldStyles =
    isRestockMode && !isEditMode ? lockedInputStyles : inputStyles;
  const barcodeFieldStyles =
    isEditMode || isBarcodeStockFormMode ? lockedInputStyles : inputStyles;
  const packagingFieldStyles = isEditMode ? lockedInputStyles : inputStyles;
  const quantityFieldStyles = isEditMode ? lockedInputStyles : inputStyles;
  const reorderLevelFieldStyles = isRestockMode && !isEditMode
    ? lockedInputStyles
    : inputStyles;
  const currentStockValue =
    matchedExistingItem && typeof getCurrentStockForItem === "function"
      ? Number(getCurrentStockForItem(matchedExistingItem) || 0)
      : 0;
  const currentStockUnit =
    trackingMethod === "Count-Based"
      ? matchedExistingItem?.unit_of_measure || formValues.unit_of_measure || "pc"
      : matchedExistingItem?.unit_of_measure || formValues.unit_of_measure || "";
  const currentStockDisplay = `${formatComputedValue(currentStockValue)}${
    currentStockUnit ? ` ${currentStockUnit}` : ""
  }`;
  const computedTotalDisplay = `${formatComputedValue(
    hasComputedTotalInputs ? computedTotalStock : 0,
  )}${computedTotalUnit ? ` ${computedTotalUnit}` : ""}`;

  const validateFormValues = (values) => {
    const nextErrors = {};
    const resolvedTrackingMethod = values.tracking_method || "Count-Based";
    const resolvedUsesWeightOrVolume =
      isWeightOrVolumeBased(resolvedTrackingMethod);
    const resolvedIsPiecePackaging = values.packaging === "piece";
    const resolvedIsPerishable =
      normalizeCategoryValue(values.category) === "perishable";

    if (isBlank(values.item_name)) {
      nextErrors.item_name = "Item name is required.";
    }

    if (isBlank(values.category)) {
      nextErrors.category = "Category is required.";
    }

    if (isBlank(values.tracking_method)) {
      nextErrors.tracking_method = "Tracking method is required.";
    }

    if (resolvedUsesWeightOrVolume && isBlank(values.unit_of_measure)) {
      nextErrors.unit_of_measure = "Unit of measure is required.";
    }

      if (resolvedUsesWeightOrVolume) {
        if (isBlank(values.unit_of_measure_value)) {
        nextErrors.unit_of_measure_value =
          "Amount per piece/container is required.";
        } else if (!isPositiveNumber(values.unit_of_measure_value)) {
          nextErrors.unit_of_measure_value =
          "Amount per piece/container must be greater than 0.";
        }
      }

    if (isBlank(values.packaging)) {
      nextErrors.packaging = "Packaging is required.";
    }

    if (isBlank(values.packaging_count)) {
      nextErrors.packaging_count = "Quantity on hand is required.";
    } else if (!isPositiveNumber(values.packaging_count)) {
      nextErrors.packaging_count = "Quantity on hand must be greater than 0.";
    }

    if (!resolvedIsPiecePackaging) {
      if (isBlank(values.quantity)) {
        nextErrors.quantity = "Units per packaging is required.";
      } else if (!isPositiveNumber(values.quantity)) {
        nextErrors.quantity = "Units per packaging must be greater than 0.";
      }
    }

    if (!isRestockMode || isEditMode) {
      if (isBlank(values.reorder_level)) {
        nextErrors.reorder_level = "Reorder level is required.";
      } else if (!isPositiveNumber(values.reorder_level)) {
        nextErrors.reorder_level = "Reorder level must be greater than 0.";
      }
    }

    if (resolvedIsPerishable && isBlank(values.expiration_date)) {
      nextErrors.expiration_date = "Expiration date is required.";
    } else if (!isBlank(values.expiration_date)) {
      if (!isValidDateValue(values.expiration_date)) {
        nextErrors.expiration_date = "Enter a valid expiration date.";
      } else if (values.expiration_date < getTodayDateInputValue()) {
        nextErrors.expiration_date =
          "Expiration date cannot be earlier than today.";
      }
    }

    return nextErrors;
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextFieldErrors = validateFormValues(formValues);
    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    const normalizedFormValues = {
      ...formValues,
      unit_of_measure:
        formValues.unit_of_measure ||
        (trackingMethod === "Count-Based" ? "pc" : ""),
      unit_of_measure_value:
        formValues.unit_of_measure_value ||
        (trackingMethod === "Count-Based" ? "1" : ""),
      quantity:
        isPiecePackaging ? "1" : formValues.quantity,
      existing_item_id: matchedExistingItem?.id || null,
      restock_match_type: isBarcodeStockFormMode
        ? "barcode_stock_form"
        : isNameMatchedRestock
          ? "item_name"
          : null,
    };

    onSubmit(normalizedFormValues);
  };

  const handleCancel = () => {
    if (isRestockMode) {
      setFormValues(createDefaultForm());
      setFieldErrors({});
      previousMatchedItemKeyRef.current = "";
      return;
    }

    onClose();
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
              {titleText}
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
          noValidate
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
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
                  style={identityFieldStyles}
                  disabled={isRestockMode && !isEditMode}
                  aria-invalid={Boolean(fieldErrors.item_name)}
                />
                {fieldErrors.item_name ? (
                  <p style={fieldErrorTextStyles}>{fieldErrors.item_name}</p>
                ) : null}
                {isRestockMode ? (
                  <p style={matchNoticeStyles}>
                    Existing item found: <strong>{matchedItemLabel}</strong>
                  </p>
                ) : null}
              </div>

              {shouldShowBarcodeField ? (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "grid",
                    gridTemplateColumns: isEditMode
                      ? "repeat(2, minmax(220px, 1fr))"
                      : "minmax(260px, 2fr) minmax(180px, 1fr)",
                    gap: "18px",
                  }}
                >
                  <div>
                    <label htmlFor="barcode" style={labelStyles}>
                      Barcode
                    </label>
                    <input
                      ref={barcodeInputRef}
                      id="barcode"
                      type="text"
                      placeholder={
                        isEditMode && !formValues.barcode.trim()
                          ? "No barcode assigned"
                          : "Scan or enter barcode"
                      }
                      value={formValues.barcode}
                      onChange={(e) => handleChange("barcode", e.target.value)}
                      style={barcodeFieldStyles}
                      disabled={isEditMode || isBarcodeStockFormMode}
                      aria-invalid={Boolean(fieldErrors.barcode)}
                    />
                    {fieldErrors.barcode ? (
                      <p style={fieldErrorTextStyles}>{fieldErrors.barcode}</p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor="category" style={labelStyles}>
                      Category
                    </label>
                    <select
                      id="category"
                      value={formValues.category}
                      onChange={(e) => handleChange("category", e.target.value)}
                      style={identityFieldStyles}
                      disabled={isRestockMode && !isEditMode}
                      aria-invalid={Boolean(fieldErrors.category)}
                    >
                      <option value="perishable">Perishable</option>
                      <option value="non-perishable">Non-Perishable</option>
                    </select>
                    {fieldErrors.category ? (
                      <p style={fieldErrorTextStyles}>{fieldErrors.category}</p>
                    ) : null}
                  </div>

                  <div style={isEditMode ? undefined : { gridColumn: "1 / -1" }}>
                    <label htmlFor="tracking_method" style={labelStyles}>
                      Tracking Method
                    </label>
                    <select
                      id="tracking_method"
                      value={trackingMethod}
                      onChange={(e) => handleChange("tracking_method", e.target.value)}
                      style={identityFieldStyles}
                      disabled={isRestockMode || isEditMode}
                      aria-invalid={Boolean(fieldErrors.tracking_method)}
                    >
                      <option value="Count-Based">Count-Based</option>
                      <option value="Weight/Volume-Based">Weight/Volume-Based</option>
                    </select>
                    {fieldErrors.tracking_method ? (
                      <p style={fieldErrorTextStyles}>
                        {fieldErrors.tracking_method}
                      </p>
                    ) : null}
                  </div>

                  {isEditMode ? (
                    <div>
                      <label htmlFor="edit_unit_of_measure" style={labelStyles}>
                        {usesWeightOrVolume ? "Base Unit" : "Unit of Measure"}
                      </label>
                      <input
                        id="edit_unit_of_measure"
                        type="text"
                        value={formValues.unit_of_measure || "pc"}
                        readOnly
                        style={lockedInputStyles}
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
                    gap: "18px",
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
                      style={identityFieldStyles}
                      disabled={isRestockMode && !isEditMode}
                      aria-invalid={Boolean(fieldErrors.category)}
                    >
                      <option value="perishable">Perishable</option>
                      <option value="non-perishable">Non-Perishable</option>
                    </select>
                    {fieldErrors.category ? (
                      <p style={fieldErrorTextStyles}>{fieldErrors.category}</p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor="tracking_method" style={labelStyles}>
                      Tracking Method
                    </label>
                    <select
                      id="tracking_method"
                      value={trackingMethod}
                      onChange={(e) => handleChange("tracking_method", e.target.value)}
                      style={identityFieldStyles}
                      disabled={isRestockMode || isEditMode}
                      aria-invalid={Boolean(fieldErrors.tracking_method)}
                    >
                      <option value="Count-Based">Count-Based</option>
                      <option value="Weight/Volume-Based">Weight/Volume-Based</option>
                    </select>
                    {fieldErrors.tracking_method ? (
                      <p style={fieldErrorTextStyles}>
                        {fieldErrors.tracking_method}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              {!isEditMode ? (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "grid",
                    gridTemplateColumns: usesWeightOrVolume
                      ? "repeat(3, minmax(180px, 1fr))"
                      : "repeat(2, minmax(180px, 1fr))",
                    gap: "18px",
                  }}
                >
                  <div>
                    <label htmlFor="unit_of_measure" style={labelStyles}>
                      {usesWeightOrVolume ? "Base Unit" : "Unit of Measure"}
                    </label>
                    <select
                      id="unit_of_measure"
                      value={formValues.unit_of_measure}
                      onChange={(e) =>
                        handleChange("unit_of_measure", e.target.value)
                      }
                      style={isRestockMode || isEditMode ? lockedInputStyles : inputStyles}
                      disabled={!usesWeightOrVolume || isRestockMode || isEditMode}
                      aria-invalid={Boolean(fieldErrors.unit_of_measure)}
                    >
                      {usesWeightOrVolume ? (
                        <>
                          <option value="">Select base unit</option>
                          {unitOfMeasureOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </>
                      ) : (
                        <option value="pc">pc</option>
                      )}
                    </select>
                    {fieldErrors.unit_of_measure ? (
                      <p style={fieldErrorTextStyles}>
                        {fieldErrors.unit_of_measure}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor="packaging" style={labelStyles}>
                      Packaging
                    </label>
                    <select
                      id="packaging"
                      value={formValues.packaging}
                      onChange={(e) => handleChange("packaging", e.target.value)}
                      style={packagingFieldStyles}
                      disabled={isEditMode}
                      aria-invalid={Boolean(fieldErrors.packaging)}
                    >
                      <option value="">Select packaging</option>
                      {packagingOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.packaging ? (
                      <p style={fieldErrorTextStyles}>{fieldErrors.packaging}</p>
                    ) : null}
                  </div>
                  {usesWeightOrVolume ? (
                  <div>
                    <label htmlFor="unit_of_measure_value" style={labelStyles}>
                      {unitValueLabel}
                    </label>
                    <input
                      id="unit_of_measure_value"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder={unitValuePlaceholder}
                      value={formValues.unit_of_measure_value}
                      onChange={(e) =>
                        handleChange("unit_of_measure_value", e.target.value)
                      }
                      style={isRestockMode || isEditMode ? lockedInputStyles : inputStyles}
                      disabled={isRestockMode || isEditMode}
                      aria-invalid={Boolean(fieldErrors.unit_of_measure_value)}
                    />
                    {fieldErrors.unit_of_measure_value ? (
                      <p style={fieldErrorTextStyles}>
                        {fieldErrors.unit_of_measure_value}
                      </p>
                    ) : null}
                  </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={{ margin: "0 0 12px", color: "#17324d" }}>
              {stockSectionTitle}
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              {!isEditMode ? (
                <>
                  <div>
                    <label htmlFor="batch_number" style={labelStyles}>
                      Batch Number
                    </label>
                    <input
                      id="batch_number"
                      type="text"
                      value="Auto-generated after saving"
                      readOnly
                      style={lockedInputStyles}
                    />
                  </div>

                  <div>
                    <label htmlFor="packaging_count" style={labelStyles}>
                      {quantityOnHandLabel}
                    </label>
                    <input
                      id="packaging_count"
                      type="number"
                      min="1"
                      placeholder={quantityOnHandPlaceholder}
                      value={formValues.packaging_count}
                      onChange={(e) =>
                        handleChange("packaging_count", e.target.value)
                      }
                      style={inputStyles}
                      aria-invalid={Boolean(fieldErrors.packaging_count)}
                    />
                    {fieldErrors.packaging_count ? (
                      <p style={fieldErrorTextStyles}>
                        {fieldErrors.packaging_count}
                      </p>
                    ) : null}
                  </div>

                  {shouldShowUnitsPerPackagingField ? (
                    <div>
                      <label htmlFor="quantity" style={labelStyles}>
                        {quantityFieldLabel}
                      </label>
                      <input
                        id="quantity"
                        type="number"
                        min="1"
                        placeholder={quantityFieldPlaceholder}
                        value={formValues.quantity}
                        onChange={(e) => handleChange("quantity", e.target.value)}
                        style={quantityFieldStyles}
                        aria-invalid={Boolean(fieldErrors.quantity)}
                      />
                      {fieldErrors.quantity ? (
                        <p style={fieldErrorTextStyles}>{fieldErrors.quantity}</p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}

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
                  style={reorderLevelFieldStyles}
                  disabled={isRestockMode && !isEditMode}
                  aria-invalid={Boolean(fieldErrors.reorder_level)}
                />
                {fieldErrors.reorder_level ? (
                  <p style={fieldErrorTextStyles}>
                    {fieldErrors.reorder_level}
                  </p>
                ) : null}
              </div>

              {!isEditMode ? (
                <div>
                  <label htmlFor="expiration_date" style={labelStyles}>
                    {isPerishable
                      ? "Expiration Date"
                      : "Expiration Date (If Applicable)"}
                  </label>
                  <input
                    id="expiration_date"
                    type="date"
                    value={formValues.expiration_date}
                    onChange={(e) =>
                      handleChange("expiration_date", e.target.value)
                    }
                    style={inputStyles}
                    aria-invalid={Boolean(fieldErrors.expiration_date)}
                  />
                  {fieldErrors.expiration_date ? (
                    <p style={fieldErrorTextStyles}>
                      {fieldErrors.expiration_date}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {isRestockMode ? (
                <div>
                  <label htmlFor="current_stock" style={labelStyles}>
                    Current Stock
                  </label>
                  <input
                    id="current_stock"
                    type="text"
                    value={currentStockDisplay}
                    readOnly
                    style={lockedInputStyles}
                  />
                </div>
              ) : null}
            </div>
          </section>

          {errorMessage && <div style={errorBoxStyles}>{errorMessage}</div>}

          <div style={isEditMode ? editFooterActionsStyles : formFooterStyles}>
            {!isEditMode ? (
              <p style={footerTotalStyles}>
                {computedTotalLabel}: <strong>{computedTotalDisplay}</strong>
              </p>
            ) : null}

            <div style={footerActionsStyles}>
              <button
                type="button"
                onClick={handleCancel}
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
                    : isRestockMode
                      ? "Add Restock Entry"
                      : "Add"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryItemFormModal;
