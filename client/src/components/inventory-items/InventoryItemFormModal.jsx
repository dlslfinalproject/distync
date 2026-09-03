import React, { useCallback, useEffect, useRef, useState } from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";
import { FiX } from "react-icons/fi";
import {
  isValidInventoryBarcode,
  normalizeInventoryBarcode,
} from "../../features/inventory-items/inventoryBarcode";

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

const autocompleteStyles = {
  wrap: {
    position: "relative",
  },
  list: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    right: 0,
    margin: 0,
    padding: "8px",
    listStyle: "none",
    borderRadius: "16px",
    border: "1px solid #d2deea",
    backgroundColor: "#ffffff",
    boxShadow: "0 18px 36px rgba(31, 64, 95, 0.14)",
    zIndex: 20,
    display: "grid",
    gap: "6px",
    maxHeight: "220px",
    overflowY: "auto",
    boxSizing: "border-box",
  },
  itemButton: {
    width: "100%",
    border: "none",
    borderRadius: "12px",
    backgroundColor: "#ffffff",
    color: "#17324d",
    textAlign: "left",
    padding: "10px 12px",
    fontSize: "14px",
    cursor: "pointer",
  },
  itemMeta: {
    display: "block",
    marginTop: "4px",
    color: "#5f7891",
    fontSize: "12px",
    fontWeight: 600,
  },
  actionMeta: {
    display: "block",
    marginTop: "4px",
    color: "#1d648c",
    fontSize: "12px",
    fontWeight: 700,
  },
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

const getItemStockForms = (item, { activeOnly = false } = {}) => {
  const stockForms = Array.isArray(item?.stock_forms) ? item.stock_forms : [];

  return activeOnly
    ? stockForms.filter((stockForm) => stockForm?.is_active !== false)
    : stockForms;
};

const getComparableNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const haveSameOptionalNumber = (leftValue, rightValue) =>
  getComparableNumber(leftValue) === getComparableNumber(rightValue);

const findMatchingStockFormByDefinition = (item, formValues) => {
  const packaging = getNormalizedInventoryText(formValues.packaging);

  if (!packaging) {
    return null;
  }

  const unitsPerPackaging =
    packaging === "piece" ? 1 : getComparableNumber(formValues.quantity);
  const unitOfMeasure = getNormalizedInventoryText(
    formValues.unit_of_measure ||
      (formValues.tracking_method === "Count-Based" ? "pc" : ""),
  );
  const unitOfMeasureValue =
    formValues.unit_of_measure_value ||
    (formValues.tracking_method === "Count-Based" ? "1" : null);

  if (!unitsPerPackaging || !unitOfMeasure) {
    return null;
  }

  return (
    getItemStockForms(item, { activeOnly: true }).find((stockForm) => {
      return (
        stockForm?.is_active !== false &&
        getNormalizedInventoryText(stockForm?.packaging) === packaging &&
        Number(stockForm?.units_per_packaging || 0) === unitsPerPackaging &&
        getNormalizedInventoryText(stockForm?.unit_of_measure) === unitOfMeasure &&
        haveSameOptionalNumber(
          stockForm?.unit_of_measure_value,
          unitOfMeasureValue,
        )
      );
    }) || null
  );
};

const formatPackagingLabel = (packaging) => {
  if (!packaging) {
    return "Packaging";
  }

  return packaging.charAt(0).toUpperCase() + packaging.slice(1);
};

const getUnitsPerPackagingForDisplay = (item, stockForm, packaging) => {
  if (packaging === "piece") {
    return 1;
  }

  const candidateValues = [
    stockForm?.units_per_packaging,
    stockForm?.units_per_package,
    stockForm?.quantity_per_packaging,
    stockForm?.quantity_per_package,
    item?.units_per_packaging,
    item?.units_per_package,
    item?.quantity_per_packaging,
    item?.quantity_per_package,
    item?.quantity,
  ];

  return (
    candidateValues
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value) && value > 0) || null
  );
};

const formatPackagingUnit = (unitOfMeasure) => {
  const normalizedUnit = getNormalizedInventoryText(unitOfMeasure);

  if (["pc", "pcs", "piece", "pieces"].includes(normalizedUnit)) {
    return "pieces";
  }

  return normalizedUnit || "units";
};

const formatStockFormMeta = (item, stockForm) => {
  const rawPackaging = getNormalizedInventoryText(
    stockForm?.packaging || item?.packaging || "piece",
  );
  const packaging = formatPackagingLabel(
    rawPackaging,
  );
  const unitsPerPackaging = getUnitsPerPackagingForDisplay(
    item,
    stockForm,
    rawPackaging,
  );
  const packagingQuantity =
    rawPackaging !== "piece" && unitsPerPackaging
      ? ` - ${unitsPerPackaging} ${formatPackagingUnit(
          stockForm?.unit_of_measure || item?.unit_of_measure,
        )}/${rawPackaging}`
      : "";

  return `${item.category || "Item"} (${packaging}${packagingQuantity})`;
};

const buildAddPackagingSuggestion = (item) => ({
  key: `item-${item.id}-add-packaging`,
  item,
  stockForm: null,
  isAddPackagingAction: true,
  meta: "+ Add another packaging",
});

const buildAutocompleteSuggestions = (items, query, { collapseBarcodeVariants = false } = {}) => {
  const normalizedQuery = getNormalizedInventoryText(query);

  if (!normalizedQuery) {
    return [];
  }

  return items
    .filter((item) =>
      getNormalizedInventoryText(item?.item_name).includes(normalizedQuery),
    )
    .sort((leftItem, rightItem) =>
      String(leftItem?.item_name || "").localeCompare(
        String(rightItem?.item_name || ""),
        undefined,
        { sensitivity: "base" },
      ),
    )
    .flatMap((item) => {
      const stockForms = getItemStockForms(item, { activeOnly: true });
      const addPackagingSuggestion = buildAddPackagingSuggestion(item);

      if (collapseBarcodeVariants) {
        return [
          {
            key: `item-${item.id}`,
            item,
            stockForm: null,
            meta: item.category || "Item",
          },
        ];
      }

      return [
        ...stockForms.map((stockForm, index) => ({
          key: `item-${item.id}-stock-form-${stockForm?.id || index}`,
          item,
          stockForm,
          meta: formatStockFormMeta(item, stockForm),
        })),
        addPackagingSuggestion,
      ];
    })
    .slice(0, 8);
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

const isPositiveInteger = (value) => {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0;
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
  const [selectedExistingItemId, setSelectedExistingItemId] = useState(null);
  const [selectedExistingStockFormId, setSelectedExistingStockFormId] = useState(null);
  const [isAddingNewStockForm, setIsAddingNewStockForm] = useState(false);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const itemNameInputRef = useRef(null);
  const barcodeInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const previousMatchedItemKeyRef = useRef("");

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

    setSelectedExistingItemId(itemData?.id || null);
    setSelectedExistingStockFormId(itemData?.inventory_item_stock_form_id || null);
    setIsAddingNewStockForm(false);
    setIsAutocompleteOpen(false);
    setFieldErrors({});
  }, [isOpen, itemData]);

  const trimmedItemName = formValues.item_name.trim();
  const eligibleExistingItems = mode === "create" ? inventoryItems : [];
  const scannedBarcode =
    source === "scan" ? normalizeInventoryBarcode(itemData?.barcode) : "";
  const getEffectiveBarcode = (values) =>
    source === "scan"
      ? normalizeInventoryBarcode(scannedBarcode || values.barcode)
      : normalizeInventoryBarcode(values.barcode);
  const rawTrimmedBarcode = getEffectiveBarcode(formValues);
  const exactNameDuplicateItem =
    mode === "create" && trimmedItemName
      ? eligibleExistingItems.find(
          (item) =>
            getNormalizedInventoryText(item?.item_name) ===
            getNormalizedInventoryText(trimmedItemName),
        ) || null
      : null;
  const exactNameMatchedExistingItem =
    mode === "create" && trimmedItemName && !isAutocompleteOpen
      ? eligibleExistingItems.find(
          (item) =>
            getNormalizedInventoryText(item?.item_name) ===
              getNormalizedInventoryText(trimmedItemName) &&
            getItemStockForms(item, { activeOnly: true }).length <= 1,
        ) || null
      : null;
  const matchedExistingItem =
    mode === "create" && selectedExistingItemId
      ? eligibleExistingItems.find(
          (item) => String(item?.id) === String(selectedExistingItemId),
        ) || null
      : exactNameMatchedExistingItem;
  const hasUnselectedDuplicateName = Boolean(
    exactNameDuplicateItem && !selectedExistingItemId && !matchedExistingItem,
  );
  const duplicateNameMessage = hasUnselectedDuplicateName
    ? "This item already exists. Select an existing packaging or choose add another packaging."
    : "";
  const matchedExistingItemStockForms = getItemStockForms(matchedExistingItem, {
    activeOnly: true,
  });
  const isBarcodeManagedItem =
    Boolean(String(matchedExistingItem?.barcode || "").trim()) ||
    matchedExistingItemStockForms.some((stockForm) =>
      Boolean(String(stockForm?.barcode || "").trim()),
    );
  const hasScannedBarcode = source === "scan" && Boolean(rawTrimmedBarcode);
  const matchedExistingStockForm =
    matchedExistingItem && selectedExistingStockFormId != null
      ? matchedExistingItemStockForms.find(
          (stockForm) =>
            String(stockForm?.id) === String(selectedExistingStockFormId),
        ) || null
      : !isAddingNewStockForm &&
          !hasScannedBarcode &&
          matchedExistingItemStockForms.length === 1
        ? matchedExistingItemStockForms[0]
        : null;
  const isExactBarcodeStockFormMatch =
    source === "scan" &&
    Boolean(rawTrimmedBarcode) &&
    Boolean(matchedExistingStockForm);
  const isScannedNewBarcodeStockForm =
    source === "scan" &&
    Boolean(rawTrimmedBarcode) &&
    Boolean(matchedExistingItem) &&
    !matchedExistingStockForm;
  const isAddingBarcodeStockForm =
    isScannedNewBarcodeStockForm ||
    (isAddingNewStockForm && isBarcodeManagedItem);
  const isAddingStockFormMode =
    isScannedNewBarcodeStockForm || isAddingNewStockForm;
  const isRestockMode = mode === "create" && Boolean(matchedExistingItem);
  const matchedBarcodeValue = matchedExistingStockForm
    ? matchedExistingStockForm.barcode || ""
    : isAddingNewStockForm
      ? matchedExistingItem?.barcode ||
        matchedExistingItemStockForms.find((stockForm) =>
          Boolean(String(stockForm?.barcode || "").trim()),
        )?.barcode ||
        ""
      : matchedExistingItem?.barcode || "";
  const shouldShowBarcodeField =
    source === "scan" ||
    mode === "edit" ||
    (mode === "create" &&
      (!isRestockMode ||
        isAddingBarcodeStockForm ||
        Boolean(String(matchedBarcodeValue).trim())));
  const trimmedBarcode = shouldShowBarcodeField
    ? normalizeInventoryBarcode(formValues.barcode)
    : "";
  const autocompleteSuggestions =
    mode === "create"
      ? buildAutocompleteSuggestions(eligibleExistingItems, trimmedItemName, {
          collapseBarcodeVariants:
            source === "scan" &&
            Boolean(rawTrimmedBarcode) &&
            !matchedExistingStockForm,
        })
      : [];
  const matchingStockFormByDefinition =
    isAddingStockFormMode && rawTrimmedBarcode
      ? findMatchingStockFormByDefinition(matchedExistingItem, formValues)
      : null;
  const matchingStockFormBarcode = normalizeInventoryBarcode(
    matchingStockFormByDefinition?.barcode,
  );
  const hasBarcodePackagingConflict = Boolean(
    matchingStockFormBarcode && matchingStockFormBarcode !== rawTrimmedBarcode,
  );
  const scannedBarcodeAlreadyMatchesPackaging = Boolean(
    matchingStockFormBarcode && matchingStockFormBarcode === rawTrimmedBarcode,
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const focusTimer = window.setTimeout(() => {
      if (shouldShowBarcodeField && (source === "scan" || isRestockMode || mode === "edit")) {
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else {
        itemNameInputRef.current?.focus();
      }
    }, 50);

    return () => window.clearTimeout(focusTimer);
  }, [isOpen, isRestockMode, mode, shouldShowBarcodeField, source]);

  useEffect(() => {
    if (!isOpen || mode !== "create") {
      previousMatchedItemKeyRef.current = "";
      return;
    }

    const matchedItemKey = `${matchedExistingItem?.id || ""}:${
      selectedExistingStockFormId || ""
    }:${isAddingNewStockForm ? "new-stock-form" : "existing-stock-form"}`;

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

    const selectedStockForm = matchedExistingStockForm;

    setFormValues((prev) => ({
      ...prev,
      item_name: matchedExistingItem.item_name || prev.item_name,
      barcode:
        isAddingNewStockForm && isBarcodeManagedItem
          ? ""
          : source === "scan" && !isExactBarcodeStockFormMatch
          ? prev.barcode
          : isExactBarcodeStockFormMatch
            ? prev.barcode
            : selectedStockForm
              ? selectedStockForm.barcode || ""
              : matchedExistingItem.barcode || prev.barcode,
      category: normalizeCategoryValue(matchedExistingItem.category),
      tracking_method: resolvedTrackingMethod,
      unit_of_measure:
        resolvedTrackingMethod === "Count-Based"
          ? "pc"
          : resolvedUnitOfMeasure || prev.unit_of_measure,
      unit_of_measure_value:
        selectedStockForm?.unit_of_measure_value ||
        matchedExistingItem.unit_of_measure_value ||
        prev.unit_of_measure_value,
      packaging: isAddingStockFormMode
        ? ""
        : selectedStockForm?.packaging ||
          matchedExistingItem.packaging ||
          prev.packaging,
      quantity: isAddingStockFormMode
        ? ""
        : String(
            selectedStockForm?.units_per_packaging ||
              matchedExistingItem.quantity ||
              ((selectedStockForm?.packaging || matchedExistingItem.packaging) ===
              "piece"
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
  }, [
    isExactBarcodeStockFormMatch,
    isOpen,
    matchedExistingItem,
    matchedExistingStockForm,
    mode,
    selectedExistingStockFormId,
    isAddingNewStockForm,
    isAddingStockFormMode,
    isBarcodeManagedItem,
  ]);

  useEffect(() => {
    if (!isOpen || mode !== "create") {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (
        itemNameInputRef.current?.contains(event.target) ||
        autocompleteRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsAutocompleteOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen, mode]);

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
      if (fieldName === "item_name") {
        return {
          ...prev,
          item_name: value,
        };
      }

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

  const handleItemNameChange = (value) => {
    if (selectedExistingItemId) {
      setSelectedExistingItemId(null);
      setSelectedExistingStockFormId(null);
      setIsAddingNewStockForm(false);
      previousMatchedItemKeyRef.current = "";
    }

    handleChange("item_name", value);
    setIsAutocompleteOpen(Boolean(value.trim()));
  };

  const handleSelectExistingItem = (suggestion) => {
    setSelectedExistingItemId(suggestion.item.id);
    setSelectedExistingStockFormId(
      suggestion.isAddPackagingAction ? null : suggestion.stockForm?.id || null,
    );
    setIsAddingNewStockForm(Boolean(suggestion.isAddPackagingAction));
    previousMatchedItemKeyRef.current = "";
    setFormValues((prev) => ({
      ...prev,
      item_name: suggestion.item.item_name || prev.item_name,
    }));
    setFieldErrors((prev) => {
      const nextErrors = { ...prev };
      delete nextErrors.item_name;
      return nextErrors;
    });
    setIsAutocompleteOpen(false);
  };

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
      : isAddingStockFormMode
        ? isAddingBarcodeStockForm
          ? "Add Barcode Stock Form"
          : "Add Packaging Stock Form"
        : isRestockMode
          ? isExactBarcodeStockFormMatch
            ? "Add Barcode Stock Form"
            : "Restock Existing Item"
          : "Add Item";
  const stockSectionTitle = isEditMode
    ? "Item Settings"
    : isAddingStockFormMode
      ? "Stock Form Details"
      : isRestockMode
        ? "Restock Details"
        : "Stock Details";
  const identityFieldStyles =
    isRestockMode && !isEditMode ? lockedInputStyles : inputStyles;
  const hasExistingBarcode = Boolean(
    normalizeInventoryBarcode(itemData?.barcode),
  );
  const isBarcodeLocked =
    (isEditMode && hasExistingBarcode) ||
    hasScannedBarcode ||
    isExactBarcodeStockFormMatch ||
    (!isAddingBarcodeStockForm &&
      isRestockMode &&
      Boolean(String(matchedBarcodeValue).trim()));
  const barcodeFieldStyles =
    isBarcodeLocked
      ? lockedInputStyles
      : inputStyles;
  const shouldLockRestockStockFormFields =
    isEditMode ||
    isExactBarcodeStockFormMatch ||
    (isRestockMode && Boolean(matchedExistingStockForm)) ||
    Boolean(matchingStockFormByDefinition && !hasBarcodePackagingConflict);
  const packagingFieldStyles =
    shouldLockRestockStockFormFields
      ? lockedInputStyles
      : inputStyles;
  const quantityFieldStyles =
    shouldLockRestockStockFormFields
      ? lockedInputStyles
      : inputStyles;
  const reorderLevelFieldStyles = isRestockMode && !isEditMode
    ? matchedExistingItem?.requires_reorder_level_before_restock
      ? inputStyles
      : lockedInputStyles
    : inputStyles;
  const isReorderLevelLocked =
    isRestockMode &&
    !isEditMode &&
    !matchedExistingItem?.requires_reorder_level_before_restock;
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
    } else if (hasUnselectedDuplicateName) {
      nextErrors.item_name = duplicateNameMessage;
    }

    if (isBlank(values.category)) {
      nextErrors.category = "Category is required.";
    }

    if (isBlank(values.tracking_method)) {
      nextErrors.tracking_method = "Tracking method is required.";
    }

    if (
      !isEditMode &&
      resolvedUsesWeightOrVolume &&
      isBlank(values.unit_of_measure)
    ) {
      nextErrors.unit_of_measure = "Unit of measure is required.";
    }

    const effectiveBarcode = getEffectiveBarcode(values);

    if (!isEditMode && isAddingBarcodeStockForm && isBlank(effectiveBarcode)) {
      nextErrors.barcode = "Barcode is required for this packaging.";
    } else if (!isBlank(effectiveBarcode) && !isValidInventoryBarcode(effectiveBarcode)) {
      nextErrors.barcode = "Barcode must contain 8 to 18 digits.";
    }

    if (hasBarcodePackagingConflict) {
      nextErrors.packaging =
        "This packaging already has a different barcode. Choose different packaging details.";
    }

    if (!isEditMode) {
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
      } else if (!isPositiveInteger(values.packaging_count)) {
        nextErrors.packaging_count =
          "Quantity on hand must be a whole number greater than 0.";
      }

      if (!resolvedIsPiecePackaging) {
        if (isBlank(values.quantity)) {
          nextErrors.quantity = "Units per packaging is required.";
        } else if (!isPositiveInteger(values.quantity)) {
          nextErrors.quantity =
            "Units per packaging must be a whole number greater than 0.";
        }
      }
    }

    if (
      !isRestockMode ||
      isEditMode ||
      matchedExistingItem?.requires_reorder_level_before_restock
    ) {
      if (isBlank(values.reorder_level)) {
        nextErrors.reorder_level = "Reorder level is required.";
      } else if (!isPositiveInteger(values.reorder_level)) {
        nextErrors.reorder_level =
          "Reorder level must be a whole number greater than 0.";
      }
    }

    if (!isEditMode && resolvedIsPerishable && isBlank(values.expiration_date)) {
      nextErrors.expiration_date = "Expiration date is required.";
    } else if (!isEditMode && !isBlank(values.expiration_date)) {
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

    const effectiveBarcode = getEffectiveBarcode(formValues);
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
      expiration_date: isEditMode
        ? null
        : isBlank(formValues.expiration_date)
          ? null
          : formValues.expiration_date,
      barcode: isBlank(effectiveBarcode)
        ? null
        : effectiveBarcode,
      existing_item_id: matchedExistingItem?.id || null,
      inventory_item_stock_form_id:
        matchingStockFormByDefinition && !hasBarcodePackagingConflict
          ? matchingStockFormByDefinition.id
          : matchedExistingStockForm?.id || null,
    };

    onSubmit(normalizedFormValues);
  };

  const handleCancel = () => {
    if (isRestockMode) {
      setFormValues(createDefaultForm());
      setFieldErrors({});
      setSelectedExistingItemId(null);
      setSelectedExistingStockFormId(null);
      setIsAddingNewStockForm(false);
      setIsAutocompleteOpen(false);
      previousMatchedItemKeyRef.current = "";
      return;
    }

    onClose();
  };

  return (
    <div className="inventory-item-form-modal-backdrop" style={overlayStyles}>
      <div className="inventory-item-form-modal" style={modalStyles}>
        <div
          className="inventory-item-form-modal-topbar"
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
          <section className="inventory-item-form-section" style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={{ margin: "0 0 12px", color: "#17324d" }}>
              Item Information
            </h3>

            <div
              className="inventory-item-form-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              <div style={{ ...autocompleteStyles.wrap, gridColumn: "1 / -1" }}>
                <label htmlFor="item_name" style={labelStyles}>
                  Item Name
                </label>
                <input
                  ref={itemNameInputRef}
                  id="item_name"
                  type="text"
                  placeholder="Enter item name"
                  value={formValues.item_name}
                  onChange={(e) => handleItemNameChange(e.target.value)}
                  onFocus={() => {
                    if (!isEditMode && !isRestockMode && autocompleteSuggestions.length > 0) {
                      setIsAutocompleteOpen(true);
                    }
                  }}
                  style={identityFieldStyles}
                  disabled={isRestockMode && !isEditMode}
                  aria-invalid={Boolean(fieldErrors.item_name)}
                  autoComplete="off"
                />
                {fieldErrors.item_name || duplicateNameMessage ? (
                  <p style={fieldErrorTextStyles}>
                    {fieldErrors.item_name || duplicateNameMessage}
                  </p>
                ) : null}
                {!isEditMode && !isRestockMode && isAutocompleteOpen && autocompleteSuggestions.length > 0 ? (
                  <ul ref={autocompleteRef} style={autocompleteStyles.list}>
                    {autocompleteSuggestions.map((suggestion) => (
                      <li key={suggestion.key}>
                        <button
                          type="button"
                          onClick={() => handleSelectExistingItem(suggestion)}
                          style={{
                            ...autocompleteStyles.itemButton,
                            ...(suggestion.isAddPackagingAction
                              ? {
                                  backgroundColor: "#f4f9fd",
                                  border: "1px solid #d7eaf5",
                                }
                              : {}),
                          }}
                        >
                          <span>{suggestion.item.item_name}</span>
                          <span
                            style={
                              suggestion.isAddPackagingAction
                                ? autocompleteStyles.actionMeta
                                : autocompleteStyles.itemMeta
                            }
                          >
                            {suggestion.meta}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {shouldShowBarcodeField ? (
                <div
                  className="inventory-item-form-grid inventory-item-form-identity-grid"
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
                      inputMode="numeric"
                      placeholder={
                        isEditMode && !formValues.barcode.trim()
                          ? "No barcode assigned"
                          : !isRestockMode
                            ? "Optional barcode"
                            : "Scan or enter barcode"
                      }
                      value={
                        source === "scan" && scannedBarcode
                          ? scannedBarcode
                          : formValues.barcode
                      }
                      onChange={(e) => handleChange("barcode", e.target.value)}
                      style={barcodeFieldStyles}
                      disabled={isBarcodeLocked}
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
                  className="inventory-item-form-grid inventory-item-form-identity-grid"
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
                  className="inventory-item-form-grid inventory-item-form-stock-grid"
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
                      disabled={shouldLockRestockStockFormFields}
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

          <section className="inventory-item-form-section" style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={{ margin: "0 0 12px", color: "#17324d" }}>
              {stockSectionTitle}
            </h3>

            <div
              className="inventory-item-form-grid"
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
                        disabled={shouldLockRestockStockFormFields}
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
                  disabled={isReorderLevelLocked}
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

            {matchingStockFormByDefinition && !hasBarcodePackagingConflict ? (
              <div
                style={{
                  marginTop: "16px",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  border: "1px solid #cfe3f1",
                  backgroundColor: "#f4f9fd",
                }}
              >
                <p
                  style={{
                    margin: "0 0 10px",
                    color: "#21405f",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  {formatPackagingLabel(matchingStockFormByDefinition.packaging)} packaging
                  matches the existing packaging definition.
                </p>

                <p
                  style={{
                    margin: 0,
                    color: "#21405f",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  {scannedBarcodeAlreadyMatchesPackaging
                    ? "This barcode is already linked to this packaging."
                    : "The scanned barcode will be assigned to this packaging."}
                </p>
              </div>
            ) : null}

            {hasBarcodePackagingConflict ? (
              <div
                style={{
                  marginTop: "16px",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  border: "1px solid #f0b8b8",
                  backgroundColor: "#fff6f6",
                  color: "#9f2d2d",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                This packaging already has a different barcode. Choose different packaging
                details.
              </div>
            ) : null}
          </section>

          {errorMessage && <div style={errorBoxStyles}>{errorMessage}</div>}

          <div
            className="inventory-item-form-footer"
            style={isEditMode ? editFooterActionsStyles : formFooterStyles}
          >
            {!isEditMode ? (
              <p style={footerTotalStyles}>
                {computedTotalLabel}: <strong>{computedTotalDisplay}</strong>
              </p>
            ) : null}

            <div className="inventory-item-form-footer-actions" style={footerActionsStyles}>
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
                    : isAddingStockFormMode
                      ? "Add Stock Form"
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
