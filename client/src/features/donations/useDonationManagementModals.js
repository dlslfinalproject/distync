import { useEffect, useState } from "react";
import {
  createDonation,
  createDonationItem,
  deleteDonation,
  deleteDonationItem,
  fetchDonationById,
  fetchDonationDetail,
  updateDonation,
  updateDonationItem,
} from "./donationService";
import {
  createDonationForm,
  createDonationItemForm,
} from "./donationUi";
import { normalizeDonorType } from "./donationFormatters";
import { isReliefPackDonationItemRemark } from "./donationType";
import {
  createInventoryItem,
  lookupInventoryItemByBarcode,
} from "../inventory-items/inventoryItemService";

const getMutationData = (response) => response?.data || response;

const createDraftKey = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const buildDonationDefinedItemPayload = (draft) => ({
  item_name: (draft.item_name || draft.new_item_name || "").trim(),
  category: draft.category || draft.new_item_category,
  tracking_method:
    draft.tracking_method || draft.new_item_tracking_method || "Count-Based",
  unit_of_measure: draft.unit_of_measure || draft.new_item_unit_of_measure,
  unit_of_measure_value:
    Number(
      draft.unit_of_measure_value ?? draft.new_item_unit_of_measure_value ?? 1,
    ) || 1,
  packaging: draft.packaging || draft.new_item_packaging,
  packaging_count: Number(draft.packaging_count || 1),
  quantity: Number(draft.units_per_packaging || draft.quantity || 1),
  reorder_level: null,
  expiration_date: draft.expiration_date || null,
  barcode: draft.barcode || null,
  is_active: true,
  skip_opening_stock: true,
});

const normalizeInventoryItemName = (value) =>
  String(value || "").trim().toLowerCase();

const normalizeDonationDonorName = (value) =>
  String(value || "").trim().toLowerCase();

const normalizeDonationCategoryValue = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();

  return normalizedValue === "non-perishable" ? "non-perishable" : "perishable";
};

const findInventoryItemByName = (inventoryItems, itemName) => {
  const normalizedItemName = normalizeInventoryItemName(itemName);

  if (!normalizedItemName) {
    return null;
  }

  return (
    inventoryItems.find(
      (item) => normalizeInventoryItemName(item.item_name) === normalizedItemName,
    ) || null
  );
};

const findInventoryItemById = (inventoryItems, inventoryItemId) => {
  if (!inventoryItemId) {
    return null;
  }

  return (
    inventoryItems.find((item) => String(item?.id) === String(inventoryItemId)) || null
  );
};

const normalizeBarcodeValue = (value) =>
  String(value || "").replace(/\s+/g, "").trim();

const findInventoryItemBarcodeMatch = (inventoryItems, barcode) => {
  const normalizedBarcode = normalizeBarcodeValue(barcode);

  if (!normalizedBarcode) {
    return null;
  }

  for (const item of inventoryItems) {
    if (normalizeBarcodeValue(item?.barcode) === normalizedBarcode) {
      return {
        item,
        stockForm: null,
      };
    }

    if (!Array.isArray(item?.stock_forms)) {
      continue;
    }

    const matchedStockForm =
      item.stock_forms.find(
        (stockForm) =>
          normalizeBarcodeValue(stockForm?.barcode) === normalizedBarcode,
      ) || null;

    if (matchedStockForm) {
      return {
        item,
        stockForm: matchedStockForm,
      };
    }
  }

  return null;
};

const isWeightOrVolumeBased = (trackingMethod) =>
  trackingMethod === "Weight/Volume-Based";

const isPiecePackaging = (packaging) =>
  String(packaging || "").trim().toLowerCase() === "piece";

const parsePositiveNumber = (value) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return 0;
  }

  return parsedValue;
};

const isPositiveIntegerValue = (value) => {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0;
};

const computeDonationQuantityReceived = (draft) => {
  const packageCount = parsePositiveNumber(draft.packaging_count);
  const unitsPerPackaging = isPiecePackaging(draft.new_item_packaging)
    ? 1
    : parsePositiveNumber(draft.units_per_packaging);

  return packageCount > 0 && unitsPerPackaging > 0
    ? packageCount * unitsPerPackaging
    : 0;
};

const computeReliefPackItemTotalQuantity = (packItem, reliefPackQuantity) => {
  const quantityPerReliefPack = parsePositiveNumber(packItem?.quantity_required);
  const totalReliefPacks = parsePositiveNumber(reliefPackQuantity);
  const unitsPerPackaging = isPiecePackaging(packItem?.packaging)
    ? 1
    : parsePositiveNumber(packItem?.units_per_packaging);

  return quantityPerReliefPack > 0 && totalReliefPacks > 0 && unitsPerPackaging > 0
    ? quantityPerReliefPack * totalReliefPacks * unitsPerPackaging
    : 0;
};

const resolveSavedDonationItemStockDetails = (item) => {
  const stockForm = item?.inventory_item_stock_form || {};
  const batch = item?.inventory_batch || {};
  const batchStockForm = batch?.inventory_item_stock_form || {};
  const inventoryItem = item?.inventory_item || {};
  const packaging =
    stockForm.packaging ||
    batchStockForm.packaging ||
    batch.stock_form_packaging ||
    item?.packaging ||
    inventoryItem.packaging ||
    "piece";
  const unitsPerPackaging = isPiecePackaging(packaging)
    ? 1
    : Number(
        stockForm.units_per_packaging ||
          batchStockForm.units_per_packaging ||
          batch.stock_form_units_per_packaging ||
          item?.units_per_packaging ||
          0,
      ) || 0;
  const quantityReceived = Number(
    item?.quantity_received ?? item?.total_quantity_received ?? 0,
  );
  const packagingCount =
    unitsPerPackaging > 0
      ? quantityReceived / unitsPerPackaging
      : quantityReceived;

  return {
    stockFormId:
      batch.inventory_item_stock_form_id ||
      stockForm.id ||
      item?.inventory_item_stock_form_id ||
      "",
    barcode:
      stockForm.barcode ||
      batchStockForm.barcode ||
      batch.stock_form_barcode ||
      item?.barcode ||
      "",
    packaging,
    unitsPerPackaging,
    packagingCount,
    unitOfMeasure:
      inventoryItem.unit_of_measure ||
      stockForm.unit_of_measure ||
      batchStockForm.unit_of_measure ||
      batch.stock_form_unit_of_measure ||
      item?.unit_of_measure ||
      "pc",
    unitOfMeasureValue:
      inventoryItem.unit_of_measure_value ??
      stockForm.unit_of_measure_value ??
      batchStockForm.unit_of_measure_value ??
      batch.stock_form_unit_of_measure_value ??
      item?.unit_of_measure_value ??
      "",
    batchNumber: batch.batch_no || item?.batch_number || "",
    expirationDate: batch.expiration_date
      ? batch.expiration_date.slice(0, 10)
      : item?.expiration_date || "",
  };
};

const resolveDonationInventoryItem = async ({ draft, inventoryItems }) => {
  const existingInventoryItemById = findInventoryItemById(
    inventoryItems,
    draft.inventory_item_id,
  );

  if (existingInventoryItemById?.id) {
    return existingInventoryItemById;
  }

  const itemName = draft.item_name || draft.new_item_name;
  const existingInventoryItem = findInventoryItemByName(inventoryItems, itemName);

  if (existingInventoryItem?.id) {
    return existingInventoryItem;
  }

  return getMutationData(await createInventoryItem(buildDonationDefinedItemPayload(draft)));
};

const buildReliefPackRemark = (templateName, packQuantity) =>
  `Relief Pack: ${templateName} x ${packQuantity}`;

const buildPerFamilyAllocationRemark = (quantity) =>
  `Per Family Allocation: ${Number(quantity || 0)}`;

const parsePerFamilyAllocationRemark = (remark) => {
  const matchedRemark = String(remark || "")
    .trim()
    .match(/^Per Family Allocation:\s*(\d+)$/i);

  if (!matchedRemark) {
    return 0;
  }

  return Number(matchedRemark[1]) || 0;
};

const parseReliefPackRemark = (remark) => {
  const normalizedRemark = String(remark || "").trim();
  const matchedRemark = normalizedRemark.match(/^Relief Pack:\s*(.+?)\s+x\s+(\d+)$/i);

  if (!matchedRemark) {
    return null;
  }

  return {
    relief_pack_name: matchedRemark[1].trim(),
    relief_pack_quantity: Number(matchedRemark[2]) || 0,
  };
};

const buildGroupedReliefPackItem = (item, reliefPackQuantity) => {
  const resolvedUnitsPerPackaging =
    item.inventory_item_stock_form?.units_per_packaging ||
    item.inventory_batch?.inventory_item_stock_form?.units_per_packaging ||
    item.inventory_batch?.stock_form_units_per_packaging ||
    1;
  const resolvedPackaging =
    item.inventory_item_stock_form?.packaging ||
    item.inventory_batch?.inventory_item_stock_form?.packaging ||
    item.inventory_batch?.stock_form_packaging ||
    item.inventory_item?.packaging ||
    "piece";
  const quantityPerPackaging = isPiecePackaging(resolvedPackaging)
    ? 1
    : Number(resolvedUnitsPerPackaging || 1) || 1;

  return {
    draft_id: createDraftKey("saved-pack-item"),
    donation_item_id: item.id,
    inventory_item_id: item.inventory_item_id || "",
    inventory_item_stock_form_id:
      item.inventory_batch?.inventory_item_stock_form_id ||
      item.inventory_item_stock_form?.id ||
      "",
    item_name: item.inventory_item?.item_name || item.item_name || "",
    category: normalizeDonationCategoryValue(item.inventory_item?.category || item.category),
    tracking_method: item.inventory_item?.tracking_method || "Count-Based",
    unit_of_measure: item.inventory_item?.unit_of_measure || item.unit_of_measure || "pc",
    unit_of_measure_value:
      item.inventory_item?.unit_of_measure_value ??
      item.inventory_item_stock_form?.unit_of_measure_value ??
      item.inventory_batch?.stock_form_unit_of_measure_value ??
      "",
    packaging: resolvedPackaging,
    units_per_packaging: Number(resolvedUnitsPerPackaging || 1) || 1,
    barcode:
      item.inventory_item_stock_form?.barcode ||
      item.inventory_batch?.inventory_item_stock_form?.barcode ||
      item.inventory_batch?.stock_form_barcode ||
      "",
    expiration_date: item.inventory_batch?.expiration_date
      ? item.inventory_batch.expiration_date.slice(0, 10)
      : "",
    quantity_required:
      reliefPackQuantity > 0
        ? Number(item.quantity_received || 0) / (reliefPackQuantity * quantityPerPackaging)
        : Number(item.quantity_received || 0),
    batch_number: item.inventory_batch?.batch_no || "",
  };
};

const normalizeDonationFormItems = (items = []) => {
  const normalizedItems = Array.isArray(items) ? items : [];
  const groupedItems = [];

  normalizedItems.forEach((item, index) => {
    const parsedReliefPack = parseReliefPackRemark(item?.remarks);

    if (!parsedReliefPack || parsedReliefPack.relief_pack_quantity <= 0) {
      groupedItems.push({
        ...item,
        per_family_allocation: parsePerFamilyAllocationRemark(item?.remarks),
      });
      return;
    }

    const latestGroupedItem = groupedItems[groupedItems.length - 1];
    const latestGroupedRemark = String(latestGroupedItem?.remarks || "").trim();
    const currentRemark = String(item?.remarks || "").trim();

    if (
      latestGroupedItem?.entry_type === "RELIEF_PACK" &&
      latestGroupedRemark === currentRemark
    ) {
      latestGroupedItem.relief_pack_items.push(
        buildGroupedReliefPackItem(item, latestGroupedItem.relief_pack_quantity),
      );
      return;
    }

    const createdGroup = {
      id: `relief-pack-${item.id || index}`,
      entry_type: "RELIEF_PACK",
      relief_pack_name: parsedReliefPack.relief_pack_name,
      relief_pack_quantity: parsedReliefPack.relief_pack_quantity,
      remarks:
        item.remarks ||
        buildReliefPackRemark(
          parsedReliefPack.relief_pack_name,
          parsedReliefPack.relief_pack_quantity,
        ),
      relief_pack_items: [
        buildGroupedReliefPackItem(item, parsedReliefPack.relief_pack_quantity),
      ],
    };

    groupedItems.push(createdGroup);
  });

  return groupedItems;
};

const inferDonationEntryType = (items = []) => {
  const normalizedItems = Array.isArray(items) ? items : [];

  if (
    normalizedItems.length > 0 &&
    normalizedItems.every((item) =>
      item?.entry_type === "RELIEF_PACK" ||
      isReliefPackDonationItemRemark(item?.remarks),
    )
  ) {
    return "RELIEF_PACK";
  }

  return "ITEM";
};

const buildDonationItemSubmissionPayload = (item) => ({
  inventory_item_id: item.inventory_item_id,
  inventory_item_stock_form_id: item.inventory_item_stock_form_id || null,
  quantity_received: Number(item.quantity_received || 0),
  remarks: item.remarks || null,
  expiration_date: item.expiration_date || null,
  storage_location: null,
  stock_form_barcode: item.barcode || null,
  stock_form_packaging: item.packaging || null,
  stock_form_units_per_packaging: isPiecePackaging(item.packaging)
    ? 1
    : Number(item.units_per_packaging || 0) || null,
  stock_form_unit_of_measure: item.unit_of_measure || null,
  stock_form_unit_of_measure_value:
    item.unit_of_measure_value !== undefined && item.unit_of_measure_value !== null
      ? Number(item.unit_of_measure_value)
      : null,
});

const buildLooseDonationDraft = (draft) => ({
  draft_id: createDraftKey("donation-item"),
  entry_type: "ITEM",
  inventory_item_id: draft.inventory_item_id || "",
  inventory_item_stock_form_id: draft.inventory_item_stock_form_id || "",
  item_name: draft.new_item_name.trim(),
  category: draft.new_item_category,
  tracking_method: draft.new_item_tracking_method || "Count-Based",
  unit_of_measure: draft.new_item_unit_of_measure,
  unit_of_measure_value: Number(draft.new_item_unit_of_measure_value || 1) || 1,
  packaging: draft.new_item_packaging,
  packaging_count: Number(draft.packaging_count || 0),
  units_per_packaging:
    Number(
      draft.new_item_packaging === "piece"
        ? 1
        : draft.units_per_packaging || 0,
    ) || 0,
  quantity_received:
    Number(draft.packaging_count || 0) *
    Number(
      draft.new_item_packaging === "piece"
        ? 1
        : draft.units_per_packaging || 0,
    ),
  barcode: draft.barcode || null,
  expiration_date: draft.expiration_date || null,
  per_family_allocation: Number(draft.per_family_allocation || 0),
  remarks: buildPerFamilyAllocationRemark(draft.per_family_allocation),
});

const buildReliefPackDraft = (draft) => ({
  draft_id: createDraftKey("donation-pack"),
  entry_type: "RELIEF_PACK",
  relief_pack_name: draft.new_pack_name.trim(),
  relief_pack_quantity: Number(draft.relief_pack_quantity),
  expiration_date: draft.expiration_date || null,
  relief_pack_items: draft.relief_pack_items.map((item) => ({
    ...item,
  })),
});

const buildExistingLooseDonationItemPayload = (item) => ({
  id: item.id,
  inventory_item_id: item.inventory_item_id,
  inventory_item_stock_form_id:
    item.inventory_batch?.inventory_item_stock_form_id ||
    item.inventory_item_stock_form?.id ||
    null,
  quantity_received: Number(item.quantity_received || 0),
  remarks:
    item.remarks ||
    buildPerFamilyAllocationRemark(item.per_family_allocation),
  expiration_date:
    item.inventory_batch?.expiration_date?.slice?.(0, 10) ||
    item.expiration_date ||
    null,
  storage_location: null,
  stock_form_barcode:
    item.inventory_item_stock_form?.barcode ||
    item.inventory_batch?.inventory_item_stock_form?.barcode ||
    null,
  stock_form_packaging:
    item.inventory_item_stock_form?.packaging ||
    item.inventory_batch?.inventory_item_stock_form?.packaging ||
    item.inventory_batch?.stock_form_packaging ||
    item.inventory_item?.packaging ||
    null,
  stock_form_units_per_packaging: isPiecePackaging(
    item.inventory_item_stock_form?.packaging ||
      item.inventory_batch?.inventory_item_stock_form?.packaging ||
      item.inventory_batch?.stock_form_packaging ||
      item.inventory_item?.packaging,
  )
    ? 1
    : Number(
        item.inventory_item_stock_form?.units_per_packaging ||
          item.inventory_batch?.inventory_item_stock_form?.units_per_packaging ||
          item.inventory_batch?.stock_form_units_per_packaging ||
          0,
      ) || null,
  stock_form_unit_of_measure: item.inventory_item?.unit_of_measure || null,
  stock_form_unit_of_measure_value:
    item.inventory_item?.unit_of_measure_value !== undefined &&
    item.inventory_item?.unit_of_measure_value !== null &&
    item.inventory_item?.unit_of_measure_value !== ""
      ? Number(item.inventory_item.unit_of_measure_value)
      : null,
});

const buildExistingReliefPackDonationItemPayloads = (item) => {
  const reliefPackRemark = buildReliefPackRemark(
    item.relief_pack_name,
    Number(item.relief_pack_quantity || 0),
  );

  return (item.relief_pack_items || []).map((packItem) => ({
    id: packItem.donation_item_id,
    inventory_item_id: packItem.inventory_item_id,
    inventory_item_stock_form_id: packItem.inventory_item_stock_form_id || null,
    quantity_received: computeReliefPackItemTotalQuantity(
      packItem,
      item.relief_pack_quantity,
    ),
    remarks: reliefPackRemark,
    expiration_date: packItem.expiration_date || null,
    storage_location: null,
    stock_form_barcode: packItem.barcode || null,
    stock_form_packaging: packItem.packaging || null,
    stock_form_units_per_packaging: isPiecePackaging(packItem.packaging)
      ? 1
      : Number(packItem.units_per_packaging || 0) || null,
    stock_form_unit_of_measure: packItem.unit_of_measure || null,
    stock_form_unit_of_measure_value:
      packItem.unit_of_measure_value !== undefined &&
      packItem.unit_of_measure_value !== null &&
      packItem.unit_of_measure_value !== ""
        ? Number(packItem.unit_of_measure_value)
        : null,
  }));
};

const resolveReliefPackDonationItemPayloads = async ({
  reliefPackName,
  reliefPackQuantity,
  reliefPackExpirationDate,
  reliefPackItems,
  inventoryItems,
}) => {
  const resolvedDonationItems = [];

  for (const packItem of reliefPackItems || []) {
    const createdInventoryItem = await resolveDonationInventoryItem({
      draft: {
        ...packItem,
        expiration_date: packItem.expiration_date || reliefPackExpirationDate,
      },
      inventoryItems,
    });

    if (!createdInventoryItem?.id) {
      throw new Error(`Failed to create inventory item for ${packItem.item_name}.`);
    }

    resolvedDonationItems.push(
      buildDonationItemSubmissionPayload({
        inventory_item_id: createdInventoryItem.id,
        inventory_item_stock_form_id: packItem.inventory_item_stock_form_id || null,
        quantity_received: computeReliefPackItemTotalQuantity(
          packItem,
          reliefPackQuantity,
        ),
        remarks: buildReliefPackRemark(
          reliefPackName,
          Number(reliefPackQuantity || 0),
        ),
        expiration_date:
          packItem.expiration_date || reliefPackExpirationDate || null,
        packaging: packItem.packaging || null,
        units_per_packaging: packItem.units_per_packaging || null,
        unit_of_measure: packItem.unit_of_measure || null,
        unit_of_measure_value: packItem.unit_of_measure_value ?? null,
        barcode: packItem.barcode || null,
      }),
    );
  }

  return resolvedDonationItems;
};

export const useDonationManagementModals = ({
  selectedEventId,
  inventoryItems,
  donorSuggestions = [],
  loadPageData,
  setSuccessMessage,
  setPageErrorMessage,
  setExportFeedback,
}) => {
  const [donationFieldErrors, setDonationFieldErrors] = useState({});
  const [donationItemFieldErrors, setDonationItemFieldErrors] = useState({});
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [isDonationDetailModalOpen, setIsDonationDetailModalOpen] =
    useState(false);
  const [isDonationDetailLoading, setIsDonationDetailLoading] = useState(false);
  const [donationDetailErrorMessage, setDonationDetailErrorMessage] =
    useState("");
  const [selectedDonationDetail, setSelectedDonationDetail] = useState(null);
  const [donationForm, setDonationForm] = useState(createDonationForm());
  const [donationErrorMessage, setDonationErrorMessage] = useState("");
  const [donationItemErrorMessage, setDonationItemErrorMessage] = useState("");
  const [donationItemLookupMessage, setDonationItemLookupMessage] = useState("");
  const [isDonationItemBarcodeLookupLoading, setIsDonationItemBarcodeLookupLoading] =
    useState(false);
  const [isDonationSubmitting, setIsDonationSubmitting] = useState(false);
  const [donationItemDraft, setDonationItemDraft] = useState(
    createDonationItemForm(),
  );
  const [editingDonationItemId, setEditingDonationItemId] = useState("");

  const clearDonationFieldError = (fieldName) => {
    setDonationFieldErrors((currentErrors) => {
      if (!currentErrors[fieldName]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldName];
      return nextErrors;
    });
  };

  const clearDonationItemFieldError = (fieldName) => {
    setDonationItemFieldErrors((currentErrors) => {
      if (!currentErrors[fieldName]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[fieldName];
      return nextErrors;
    });
  };

  useEffect(() => {
    if (editingDonationItemId) {
      return;
    }

    if (donationItemDraft.item_entry_method !== "BARCODE") {
      return;
    }

    const trimmedBarcode = String(donationItemDraft.barcode || "")
      .replace(/\s+/g, "")
      .trim();

    if (!trimmedBarcode) {
      setDonationItemLookupMessage("");
      setDonationItemErrorMessage("");
      return;
    }

    const barcodeMatch = findInventoryItemBarcodeMatch(inventoryItems, trimmedBarcode);
    const matchedItem = barcodeMatch?.item || null;
    const matchedStockForm = barcodeMatch?.stockForm || null;

    if (matchedItem?.id) {
      const alreadyAppliedMatch =
        String(donationItemDraft.inventory_item_id || "") === String(matchedItem.id) &&
        String(donationItemDraft.inventory_item_stock_form_id || "") ===
          String(matchedStockForm?.id || "") &&
        String(donationItemDraft.barcode || "").trim() === trimmedBarcode;

      if (!alreadyAppliedMatch) {
        applyExistingInventoryItemToDraft(matchedItem, {
          barcode: trimmedBarcode,
          stockForm: matchedStockForm,
        });
      }

      setDonationItemLookupMessage("");
      return;
    }

    setDonationItemDraft((currentValues) => {
      const currentBarcode = String(currentValues.barcode || "")
        .replace(/\s+/g, "")
        .trim();
      const hasSelectedExistingItem = Boolean(currentValues.inventory_item_id);
      const hasSelectedStockForm = Boolean(currentValues.inventory_item_stock_form_id);

      if (
        currentBarcode === trimmedBarcode &&
        (!hasSelectedStockForm || hasSelectedExistingItem)
      ) {
        return currentValues;
      }

      return {
        ...currentValues,
        barcode: trimmedBarcode,
        inventory_item_stock_form_id: "",
        item_definition_mode: hasSelectedExistingItem ? "EXISTING" : "NEW",
        new_item_name:
          currentBarcode === trimmedBarcode
            ? currentValues.new_item_name
            : hasSelectedExistingItem
              ? currentValues.new_item_name
              : "",
        new_item_category:
          currentBarcode === trimmedBarcode
            ? currentValues.new_item_category
            : hasSelectedExistingItem
              ? currentValues.new_item_category
              : "perishable",
        new_item_tracking_method: hasSelectedExistingItem
          ? currentValues.new_item_tracking_method
          : "Count-Based",
        new_item_unit_of_measure: hasSelectedExistingItem
          ? currentValues.new_item_unit_of_measure
          : "pc",
        new_item_unit_of_measure_value: hasSelectedExistingItem
          ? currentValues.new_item_unit_of_measure_value
          : "",
        new_item_packaging: hasSelectedExistingItem
          ? currentValues.new_item_packaging
          : "pack",
        packaging_count: hasSelectedExistingItem
          ? currentValues.packaging_count
          : "",
        units_per_packaging: hasSelectedExistingItem
          ? currentValues.units_per_packaging
          : "",
        expiration_date: hasSelectedExistingItem
          ? currentValues.expiration_date
          : "",
      };
    });

    setDonationItemLookupMessage("");
  }, [
    donationItemDraft.barcode,
    donationItemDraft.entry_type,
    donationItemDraft.item_entry_method,
    editingDonationItemId,
    inventoryItems,
  ]);

  useEffect(() => {
    if (editingDonationItemId) {
      return undefined;
    }

    if (donationItemDraft.item_entry_method !== "BARCODE") {
      return undefined;
    }

    const trimmedBarcode = String(donationItemDraft.barcode || "")
      .replace(/\s+/g, "")
      .trim();

    if (!trimmedBarcode || donationItemDraft.inventory_item_id) {
      return undefined;
    }

    let isCancelled = false;
    const lookupTimer = window.setTimeout(async () => {
      setIsDonationItemBarcodeLookupLoading(true);

      try {
        const lookupResponse = await lookupInventoryItemByBarcode(trimmedBarcode);
        const suggestedItem = lookupResponse?.data?.item || null;

        if (isCancelled || !suggestedItem?.item_name) {
          return;
        }

        setDonationItemDraft((currentValues) => {
          const currentBarcode = String(currentValues.barcode || "")
            .replace(/\s+/g, "")
            .trim();

          if (currentBarcode !== trimmedBarcode || currentValues.inventory_item_id) {
            return currentValues;
          }

          return {
            ...currentValues,
            new_item_name: suggestedItem.item_name,
            new_item_category:
              String(suggestedItem.category || "").trim().toLowerCase() ===
              "perishable"
                ? "perishable"
                : "non-perishable",
          };
        });
      } catch (_error) {
      } finally {
        if (!isCancelled) {
          setIsDonationItemBarcodeLookupLoading(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(lookupTimer);
    };
  }, [
    donationItemDraft.barcode,
    donationItemDraft.entry_type,
    donationItemDraft.item_entry_method,
    editingDonationItemId,
  ]);

  useEffect(() => {
    if (editingDonationItemId) {
      return;
    }

    if (donationItemDraft.item_entry_method !== "BARCODE") {
      return;
    }

    const normalizedItemName = normalizeInventoryItemName(
      donationItemDraft.new_item_name,
    );

    if (!normalizedItemName) {
      return;
    }

    const matchedInventoryItem =
      inventoryItems.find(
        (item) => normalizeInventoryItemName(item?.item_name) === normalizedItemName,
      ) || null;

    if (!matchedInventoryItem?.id) {
      return;
    }

    const normalizedDraftBarcode = normalizeBarcodeValue(donationItemDraft.barcode);
    const matchedStockForm =
      (Array.isArray(matchedInventoryItem.stock_forms)
        ? matchedInventoryItem.stock_forms.find(
            (stockForm) =>
              normalizeBarcodeValue(stockForm?.barcode) === normalizedDraftBarcode,
          )
        : null) || null;
    const shouldUseItemLevelBarcode =
      !matchedStockForm &&
      normalizeBarcodeValue(matchedInventoryItem.barcode) === normalizedDraftBarcode;

    const nextStockFormId = matchedStockForm?.id || "";
    const alreadyAppliedMatch =
      String(donationItemDraft.inventory_item_id || "") ===
        String(matchedInventoryItem.id) &&
      String(donationItemDraft.inventory_item_stock_form_id || "") ===
        String(nextStockFormId);

    if (alreadyAppliedMatch) {
      return;
    }

    applyExistingInventoryItemToDraft(matchedInventoryItem, {
      barcode: normalizedDraftBarcode || donationItemDraft.barcode,
      stockForm: matchedStockForm,
      useItemLevelBarcode: shouldUseItemLevelBarcode,
    });
  }, [
    donationItemDraft.barcode,
    donationItemDraft.entry_type,
    donationItemDraft.item_entry_method,
    donationItemDraft.new_item_name,
    editingDonationItemId,
    inventoryItems,
  ]);

  const findRecordedDonorByName = (donorName) => {
    const normalizedDonorName = normalizeDonationDonorName(donorName);

    if (!normalizedDonorName) {
      return null;
    }

    return (
      donorSuggestions.find(
        (donor) =>
          normalizeDonationDonorName(donor?.donor_name) === normalizedDonorName,
      ) || null
    );
  };

  const handleDonationFormChange = (fieldName, value) => {
    setDonationForm((currentValues) => {
      const nextValues = {
        ...currentValues,
        ...(fieldName === "donor_type" && value !== "OTHER"
          ? { donor_type_other: "" }
          : {}),
        [fieldName]: value,
      };

      if (fieldName === "donor_name") {
        const matchedRecordedDonor = findRecordedDonorByName(value);

        if (matchedRecordedDonor) {
          nextValues.donor_name = matchedRecordedDonor.donor_name;
          nextValues.donor_type = matchedRecordedDonor.donor_type || "INDIVIDUAL";
          nextValues.donor_type_other =
            matchedRecordedDonor.donor_type === "OTHER"
              ? matchedRecordedDonor.donor_type_other || ""
              : "";
        }
      }

      return nextValues;
    });

    clearDonationFieldError(fieldName);

    if (fieldName === "donor_type" && value !== "OTHER") {
      clearDonationFieldError("donor_type_other");
    }
  };

  const handleDonationItemDraftChange = (fieldName, value) => {
    setDonationItemDraft((currentValues) => {
      const nextValues = {
        ...currentValues,
        [fieldName]: value,
      };

      if (fieldName === "item_entry_method") {
        nextValues.barcode = "";
        nextValues.inventory_item_id = "";
        nextValues.inventory_item_stock_form_id = "";
        nextValues.item_definition_mode = "NEW";
        nextValues.new_item_name = "";
        nextValues.packaging_count = "";
        nextValues.units_per_packaging = "";
      }

      if (fieldName === "new_item_tracking_method") {
        if (value === "Count-Based") {
          nextValues.new_item_unit_of_measure = "pc";
          nextValues.new_item_unit_of_measure_value = "";
        }
      }

      if (
        fieldName === "new_item_unit_of_measure" &&
        currentValues.new_item_tracking_method === "Count-Based"
      ) {
        nextValues.new_item_unit_of_measure = "pc";
      }

      if (fieldName === "new_item_packaging" && value === "piece") {
        nextValues.units_per_packaging = "1";
      }

      if (
        fieldName === "new_item_name" &&
        currentValues.inventory_item_id &&
        normalizeInventoryItemName(value) !==
          normalizeInventoryItemName(currentValues.new_item_name)
      ) {
        nextValues.inventory_item_id = "";
        nextValues.inventory_item_stock_form_id = "";
        nextValues.item_definition_mode = "NEW";
      }

      return nextValues;
    });

    clearDonationItemFieldError(fieldName);

    if (fieldName === "new_item_category" || fieldName === "expiration_date") {
      clearDonationItemFieldError("expiration_date");
    }

    if (fieldName === "new_item_tracking_method") {
      clearDonationItemFieldError("new_item_unit_of_measure");
      clearDonationItemFieldError("new_item_unit_of_measure_value");
    }

    if (fieldName === "new_item_packaging") {
      clearDonationItemFieldError("units_per_packaging");
      clearDonationItemFieldError("packaging_count");
    }

    if (fieldName === "per_family_allocation") {
      clearDonationItemFieldError("per_family_allocation");
    }

    if (fieldName === "entry_type") {
      setDonationItemFieldErrors({});
      setDonationItemErrorMessage("");
      setDonationItemLookupMessage("");
    }

    if (fieldName === "item_entry_method" || fieldName === "barcode") {
      setDonationItemLookupMessage("");
    }
  };

  const handleReliefPackDraftItemChange = (draftId, fieldName, value) => {
    setDonationItemDraft((currentValues) => ({
      ...currentValues,
      relief_pack_items: currentValues.relief_pack_items.map((item) =>
        String(item.draft_id || item.donation_item_id || item.item_name) === String(draftId)
          ? {
              ...item,
              [fieldName]: value,
            }
          : item,
      ),
    }));

    clearDonationItemFieldError(`relief_pack_item_${draftId}_${fieldName}`);
  };

  const applyExistingInventoryItemToDraft = (item, options = {}) => {
    if (!item?.id) {
      return;
    }

    const resolvedUnitOfMeasure = item.unit_of_measure || item.unit || "pc";
    const selectedStockForm = options.stockForm || null;
    const resolvedTrackingMethod = item.tracking_method || "Count-Based";
    const resolvedPackaging =
      selectedStockForm?.packaging ||
      item.packaging ||
      (Array.isArray(item.stock_forms) && item.stock_forms.length > 0
        ? item.stock_forms[0]?.packaging || "pack"
        : "pack");
    const resolvedUnitsPerPackaging =
      selectedStockForm?.units_per_packaging ||
      item.quantity ||
      (isPiecePackaging(resolvedPackaging) ? 1 : "");

    setDonationItemDraft((currentValues) => ({
      ...currentValues,
      inventory_item_id: item.id,
      inventory_item_stock_form_id: selectedStockForm?.id || "",
      item_definition_mode: "EXISTING",
      new_item_name: item.item_name || currentValues.new_item_name,
      new_item_category: normalizeDonationCategoryValue(
        item.category || currentValues.new_item_category,
      ),
      new_item_tracking_method:
        resolvedTrackingMethod || currentValues.new_item_tracking_method,
      new_item_unit_of_measure:
        resolvedUnitOfMeasure || currentValues.new_item_unit_of_measure,
      new_item_unit_of_measure_value:
        item.unit_of_measure_value ?? currentValues.new_item_unit_of_measure_value,
      new_item_packaging: resolvedPackaging || currentValues.new_item_packaging,
      units_per_packaging: String(
        resolvedUnitsPerPackaging || currentValues.units_per_packaging || "",
      ),
      barcode:
        options.barcode ??
        (currentValues.item_entry_method === "BARCODE" && !selectedStockForm
          ? currentValues.barcode
          : selectedStockForm?.barcode ??
            (options.useItemLevelBarcode ? item.barcode : null) ??
            currentValues.barcode ??
            ""),
      packaging_count: "",
    }));

    clearDonationItemFieldError("new_item_name");
    clearDonationItemFieldError("barcode");
  };

  const handleSelectExistingInventoryItem = (selection) => {
    const selectedItem = selection?.item || selection;
    const selectedStockForm = selection?.stockForm || null;

    applyExistingInventoryItemToDraft(selectedItem, {
      stockForm: selectedStockForm,
    });
    setDonationItemLookupMessage("");
  };

  const clearSelectedExistingInventoryItem = () => {
    setDonationItemDraft((currentValues) => ({
      ...currentValues,
      inventory_item_id: "",
      inventory_item_stock_form_id: "",
      item_definition_mode: "NEW",
      new_item_name: "",
      new_item_category: "perishable",
      new_item_tracking_method: "Count-Based",
      new_item_unit_of_measure: "pc",
      new_item_unit_of_measure_value: "",
      new_item_packaging: "pack",
      packaging_count: "",
      units_per_packaging: "",
      barcode: currentValues.item_entry_method === "BARCODE" ? currentValues.barcode : "",
      expiration_date: "",
    }));
    setDonationItemLookupMessage("");
    setDonationItemFieldErrors({});
  };

  const lookupDonationItemBarcode = async () => {
    const trimmedBarcode = String(donationItemDraft.barcode || "")
      .replace(/\s+/g, "")
      .trim();

    if (!trimmedBarcode) {
      setDonationItemFieldErrors((currentErrors) => ({
        ...currentErrors,
        barcode: "Barcode number is required.",
      }));
      return;
    }

    clearDonationItemFieldError("barcode");
    setDonationItemLookupMessage("");
    setDonationItemErrorMessage("");
    setIsDonationItemBarcodeLookupLoading(true);

    try {
      const barcodeMatch = findInventoryItemBarcodeMatch(
        inventoryItems,
        trimmedBarcode,
      );
      const matchedItem = barcodeMatch?.item || null;

      if (matchedItem?.id) {
        applyExistingInventoryItemToDraft(matchedItem, {
          barcode: trimmedBarcode,
          stockForm: barcodeMatch?.stockForm || null,
        });
        setDonationItemLookupMessage("");
        return;
      }

      setDonationItemDraft((currentValues) => ({
        ...currentValues,
        barcode: trimmedBarcode,
        inventory_item_id: "",
        inventory_item_stock_form_id: "",
        item_definition_mode: "NEW",
      }));
      setDonationItemLookupMessage("");
    } catch (error) {
      setDonationItemErrorMessage(
        error.message || "Failed to check the current inventory barcode match.",
      );
    } finally {
      setIsDonationItemBarcodeLookupLoading(false);
    }
  };

  const isPerishableCategory = (value) =>
    String(value || "").trim().toLowerCase() === "perishable";

  const isEarlierThanToday = (value) => {
    const normalizedValue = String(value || "").trim();

    if (!normalizedValue) {
      return false;
    }

    const parsedDate = new Date(`${normalizedValue}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return false;
    }

    const today = new Date();
    const todayDateOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    return parsedDate < todayDateOnly;
  };

  const validateDonationForm = ({ itemsForSubmission }) => {
    const nextErrors = {};

    if (!donationForm.donor_name.trim()) {
      nextErrors.donor_name = "Donor name is required.";
    }

    if (!donationForm.disaster_event_id) {
      nextErrors.disaster_event_id = "Select an active disaster event.";
    }

    if (!donationForm.received_at) {
      nextErrors.received_at = "Received date is required.";
    }

    if (!normalizeDonorType(donationForm.donor_type)) {
      nextErrors.donor_type = "Donor type is required.";
    }

    if (
      normalizeDonorType(donationForm.donor_type) === "OTHER" &&
      !donationForm.donor_type_other.trim()
    ) {
      nextErrors.donor_type_other = "Specify the donor type.";
    }

    if (!itemsForSubmission.length) {
      nextErrors.items = "Add at least one donated item before saving.";
    }

    return nextErrors;
  };

  const validateDonationItemDraft = ({ isExistingDonationItem = false } = {}) => {
    const nextErrors = {};

    if (donationItemDraft.entry_type === "RELIEF_PACK") {
      if (!donationItemDraft.new_pack_name.trim()) {
        nextErrors.new_pack_name = "Enter the relief pack name.";
      }

      if (Number(donationItemDraft.relief_pack_quantity || 0) <= 0) {
        nextErrors.relief_pack_quantity =
          "Enter the number of relief packs received.";
      }

      if (donationItemDraft.relief_pack_items.length === 0) {
        nextErrors.relief_pack_items =
          "Add at least one item to the relief pack.";
      }

      donationItemDraft.relief_pack_items.forEach((packItem) => {
        const packItemKey = String(
          packItem.draft_id || packItem.donation_item_id || packItem.item_name,
        );

        if (parsePositiveNumber(packItem.quantity_required) <= 0) {
          nextErrors[`relief_pack_item_${packItemKey}_quantity_required`] =
            "Enter the item quantity per relief pack.";
        }

        if (
          !isPiecePackaging(packItem.packaging) &&
          parsePositiveNumber(packItem.units_per_packaging) <= 0
        ) {
          nextErrors[`relief_pack_item_${packItemKey}_units_per_packaging`] =
            "Units per packaging is required.";
        }

        if (
          isPerishableCategory(packItem.category) &&
          !String(packItem.expiration_date || "").trim()
        ) {
          nextErrors[`relief_pack_item_${packItemKey}_expiration_date`] =
            "Expiration date is required.";
        }

        if (isEarlierThanToday(packItem.expiration_date)) {
          nextErrors[`relief_pack_item_${packItemKey}_expiration_date`] =
            "Expiration date cannot be earlier than today.";
        }
      });

      if (isEarlierThanToday(donationItemDraft.expiration_date)) {
        nextErrors.expiration_date =
          "Expiration date cannot be earlier than today.";
      }

      return nextErrors;
    }

    if (isExistingDonationItem) {
      const quantityReceived = computeDonationQuantityReceived(donationItemDraft);
      const perFamilyAllocation = parsePositiveNumber(
        donationItemDraft.per_family_allocation,
      );

      if (!donationForm.disaster_event_id) {
        nextErrors.per_family_allocation =
          "Select a disaster event before setting per family allocation.";
      }

      if (parsePositiveNumber(donationItemDraft.packaging_count) <= 0) {
        nextErrors.packaging_count = "Quantity on hand is required.";
      }

      if (
        !isPiecePackaging(donationItemDraft.new_item_packaging) &&
        parsePositiveNumber(donationItemDraft.units_per_packaging) <= 0
      ) {
        nextErrors.units_per_packaging = "Units per packaging is required.";
      }

      if (isEarlierThanToday(donationItemDraft.expiration_date)) {
        nextErrors.expiration_date =
          "Expiration date cannot be earlier than today.";
      }

      if (perFamilyAllocation <= 0) {
        nextErrors.per_family_allocation = "Per family allocation is required.";
      } else if (!isPositiveIntegerValue(donationItemDraft.per_family_allocation)) {
        nextErrors.per_family_allocation =
          "Per family allocation must be a whole number.";
      } else if (quantityReceived > 0 && perFamilyAllocation > quantityReceived) {
        nextErrors.per_family_allocation =
          "Per family allocation cannot exceed quantity on hand.";
      }

      return nextErrors;
    }

    if (!donationItemDraft.new_item_name.trim()) {
      nextErrors.new_item_name = "Enter the item name.";
    }

    if (!donationForm.disaster_event_id) {
      nextErrors.per_family_allocation =
        "Select a disaster event before setting per family allocation.";
    }

    if (!donationItemDraft.new_item_tracking_method) {
      nextErrors.new_item_tracking_method = "Tracking method is required.";
    }

    if (
      isWeightOrVolumeBased(donationItemDraft.new_item_tracking_method) &&
      !donationItemDraft.new_item_unit_of_measure
    ) {
      nextErrors.new_item_unit_of_measure = "Unit of measure is required.";
    }

    if (
      isWeightOrVolumeBased(donationItemDraft.new_item_tracking_method) &&
      parsePositiveNumber(donationItemDraft.new_item_unit_of_measure_value) <= 0
    ) {
      nextErrors.new_item_unit_of_measure_value =
        "Amount per piece/container is required.";
    }

    if (!donationItemDraft.new_item_packaging) {
      nextErrors.new_item_packaging = "Packaging is required.";
    }

    if (parsePositiveNumber(donationItemDraft.packaging_count) <= 0) {
      nextErrors.packaging_count = "Quantity on hand is required.";
    }

    if (
      !isPiecePackaging(donationItemDraft.new_item_packaging) &&
      parsePositiveNumber(donationItemDraft.units_per_packaging) <= 0
    ) {
      nextErrors.units_per_packaging = "Units per packaging is required.";
    }

    const quantityReceived = computeDonationQuantityReceived(donationItemDraft);
    const perFamilyAllocation = parsePositiveNumber(
      donationItemDraft.per_family_allocation,
    );

    if (quantityReceived <= 0) {
      nextErrors.packaging_count = nextErrors.packaging_count || "Quantity on hand is required.";
    }

    if (
      isPerishableCategory(donationItemDraft.new_item_category) &&
      !donationItemDraft.expiration_date
    ) {
      nextErrors.expiration_date = "Expiration date is required.";
    }

    if (isEarlierThanToday(donationItemDraft.expiration_date)) {
      nextErrors.expiration_date =
        "Expiration date cannot be earlier than today.";
    }

    if (perFamilyAllocation <= 0) {
      nextErrors.per_family_allocation = "Per family allocation is required.";
    } else if (!isPositiveIntegerValue(donationItemDraft.per_family_allocation)) {
      nextErrors.per_family_allocation =
        "Per family allocation must be a whole number.";
    } else if (quantityReceived > 0 && perFamilyAllocation > quantityReceived) {
      nextErrors.per_family_allocation =
        "Per family allocation cannot exceed quantity on hand.";
    }

    return nextErrors;
  };

  const openDonationModal = async (donationId = null) => {
    setDonationErrorMessage("");
    setDonationItemErrorMessage("");
    setDonationItemLookupMessage("");
    setDonationFieldErrors({});
    setDonationItemFieldErrors({});
    setEditingDonationItemId("");
    setDonationItemDraft(createDonationItemForm());

    if (!donationId) {
      setDonationForm({
        ...createDonationForm(),
        disaster_event_id: selectedEventId || "",
      });
      setIsDonationModalOpen(true);
      return;
    }

    try {
      const donation = await fetchDonationById(donationId);
      const existingItems = normalizeDonationFormItems(donation.items || []);
      setDonationForm({
        id: donation.id,
        disaster_event_id: donation.disaster_event_id,
        donor_name: donation.donor_name,
        donor_type: normalizeDonorType(donation.donor_type),
        donor_type_other: donation.donor_type_other || "",
        contact_information: donation.contact_information || "",
        received_at: donation.received_at
          ? new Date(donation.received_at).toISOString().slice(0, 10)
          : "",
        status: donation.status,
        remarks: donation.remarks || "",
        items: existingItems,
      });
      setDonationItemDraft({
        ...createDonationItemForm(),
        entry_type: inferDonationEntryType(existingItems),
      });
      setIsDonationModalOpen(true);
    } catch (error) {
      setPageErrorMessage(error.message || "Failed to load donation details.");
    }
  };

  const closeDonationModal = () => {
    setIsDonationModalOpen(false);
    setDonationForm(createDonationForm());
    setDonationErrorMessage("");
    setDonationItemErrorMessage("");
    setDonationItemLookupMessage("");
    setDonationFieldErrors({});
    setDonationItemFieldErrors({});
    setDonationItemDraft(createDonationItemForm());
    setEditingDonationItemId("");
  };

  const openDonationDetailModal = async (donationId) => {
    setIsDonationDetailModalOpen(true);
    setIsDonationDetailLoading(true);
    setDonationDetailErrorMessage("");
    setSelectedDonationDetail(null);

    try {
      const response = await fetchDonationDetail(donationId);
      setSelectedDonationDetail(response?.data || null);
    } catch (error) {
      setDonationDetailErrorMessage(error.message || "Failed to load donation detail.");
    } finally {
      setIsDonationDetailLoading(false);
    }
  };

  const closeDonationDetailModal = () => {
    setIsDonationDetailModalOpen(false);
    setSelectedDonationDetail(null);
    setDonationDetailErrorMessage("");
  };

  const submitDonation = async () => {
    setIsDonationSubmitting(true);
    setDonationErrorMessage("");
    setDonationFieldErrors({});

    try {
      const itemsForSubmission = donationForm.items;

      const nextFieldErrors = validateDonationForm({ itemsForSubmission });

      if (Object.keys(nextFieldErrors).length > 0) {
        setDonationFieldErrors(nextFieldErrors);
        setIsDonationSubmitting(false);
        return;
      }

      const payload = {
        disaster_event_id: donationForm.disaster_event_id,
        donor_name: donationForm.donor_name.trim(),
        donor_type: normalizeDonorType(donationForm.donor_type),
        donor_type_other:
          normalizeDonorType(donationForm.donor_type) === "OTHER"
            ? donationForm.donor_type_other.trim()
            : null,
        contact_information: null,
        received_at: donationForm.received_at || null,
        status: donationForm.status,
        remarks: null,
      };

      if (!donationForm.id) {
        const resolvedDonationItems = [];

        for (const item of itemsForSubmission) {
          if (item.entry_type === "RELIEF_PACK") {
            const expandedReliefPackItems =
              await resolveReliefPackDonationItemPayloads({
                reliefPackName: item.relief_pack_name,
                reliefPackQuantity: item.relief_pack_quantity,
                reliefPackExpirationDate: item.expiration_date || null,
                reliefPackItems: item.relief_pack_items || [],
                inventoryItems,
              });

            resolvedDonationItems.push(...expandedReliefPackItems);
            continue;
          }

          const createdInventoryItem = await resolveDonationInventoryItem({
            draft: {
              ...item,
              expiration_date: item.expiration_date,
            },
            inventoryItems,
          });

          if (!createdInventoryItem?.id) {
            throw new Error(`Failed to create inventory item for ${item.item_name}.`);
          }

          resolvedDonationItems.push(
            buildDonationItemSubmissionPayload({
              ...item,
              inventory_item_id: createdInventoryItem.id,
            }),
          );
        }

        const response = await createDonation({
          ...payload,
          items: resolvedDonationItems,
        });
        setSuccessMessage("Donation recorded successfully.");
        if (!response?.queued_offline) {
          await loadPageData(selectedEventId);
        }
      } else {
        const response = await updateDonation(donationForm.id, payload);
        if (!response?.queued_offline) {
          for (const item of itemsForSubmission) {
            if (item.entry_type === "RELIEF_PACK") {
              const reliefPackItemPayloads = buildExistingReliefPackDonationItemPayloads(item);

              for (const reliefPackItemPayload of reliefPackItemPayloads) {
                await updateDonationItem(reliefPackItemPayload.id, reliefPackItemPayload);
              }
              continue;
            }

            const stagedLooseItemPayload = buildExistingLooseDonationItemPayload(item);
            await updateDonationItem(stagedLooseItemPayload.id, stagedLooseItemPayload);
          }
        }
        setSuccessMessage("Donation updated successfully.");
        if (!response?.queued_offline) {
          await loadPageData(selectedEventId);
        }
      }

      closeDonationModal();
    } catch (error) {
      setDonationErrorMessage(error.message || "Failed to save donation.");
    } finally {
      setIsDonationSubmitting(false);
    }
  };

  const addPackItemToDraft = () => {
    setDonationItemErrorMessage("");
    setDonationItemFieldErrors({});

    const quantityRequired = Number(donationItemDraft.pack_item_quantity_required || 0);
    const nextFieldErrors = {};

    if (!donationItemDraft.new_pack_name.trim()) {
      nextFieldErrors.new_pack_name = "Enter the relief pack name.";
    }

    if (!donationItemDraft.new_item_name.trim()) {
      nextFieldErrors.new_item_name = "Enter the item name for this relief pack.";
    }

    if (!donationItemDraft.new_item_tracking_method) {
      nextFieldErrors.new_item_tracking_method = "Tracking method is required.";
    }

    if (
      isWeightOrVolumeBased(donationItemDraft.new_item_tracking_method) &&
      !donationItemDraft.new_item_unit_of_measure
    ) {
      nextFieldErrors.new_item_unit_of_measure = "Unit of measure is required.";
    }

    if (
      isWeightOrVolumeBased(donationItemDraft.new_item_tracking_method) &&
      parsePositiveNumber(donationItemDraft.new_item_unit_of_measure_value) <= 0
    ) {
      nextFieldErrors.new_item_unit_of_measure_value =
        "Amount per piece/container is required.";
    }

    if (!donationItemDraft.new_item_packaging) {
      nextFieldErrors.new_item_packaging = "Packaging is required.";
    }

    if (quantityRequired <= 0) {
      nextFieldErrors.pack_item_quantity_required =
        "Enter the item quantity per relief pack.";
    }

    if (
      !isPiecePackaging(donationItemDraft.new_item_packaging) &&
      parsePositiveNumber(donationItemDraft.units_per_packaging) <= 0
    ) {
      nextFieldErrors.units_per_packaging = "Units per packaging is required.";
    }

    if (
      isPerishableCategory(donationItemDraft.new_item_category) &&
      !donationItemDraft.expiration_date
    ) {
      nextFieldErrors.expiration_date = "Expiration date is required.";
    }

    if (isEarlierThanToday(donationItemDraft.expiration_date)) {
      nextFieldErrors.expiration_date =
        "Expiration date cannot be earlier than today.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setDonationItemFieldErrors(nextFieldErrors);
      return;
    }

    setDonationItemDraft((currentDraft) => {
      const existingItem = currentDraft.relief_pack_items.find(
        (item) =>
          currentDraft.inventory_item_id
            ? String(item.inventory_item_id || "") ===
              String(currentDraft.inventory_item_id)
            : item.item_name.toLowerCase() ===
              currentDraft.new_item_name.trim().toLowerCase(),
      );

      const nextPackItems = existingItem
        ? currentDraft.relief_pack_items.map((item) =>
            currentDraft.inventory_item_id
              ? String(item.inventory_item_id || "") ===
                String(currentDraft.inventory_item_id)
              : item.item_name.toLowerCase() ===
                currentDraft.new_item_name.trim().toLowerCase()
              ? {
                  ...item,
                  inventory_item_id: currentDraft.inventory_item_id || "",
                  inventory_item_stock_form_id:
                    currentDraft.inventory_item_stock_form_id || "",
                  item_name: currentDraft.new_item_name.trim(),
                  category: currentDraft.new_item_category,
                  tracking_method: currentDraft.new_item_tracking_method,
                  unit_of_measure: currentDraft.new_item_unit_of_measure,
                  unit_of_measure_value:
                    currentDraft.new_item_unit_of_measure_value !== ""
                      ? Number(currentDraft.new_item_unit_of_measure_value)
                      : null,
                  packaging: currentDraft.new_item_packaging,
                  units_per_packaging: isPiecePackaging(
                    currentDraft.new_item_packaging,
                  )
                    ? 1
                    : Number(currentDraft.units_per_packaging || 0) || 0,
                  barcode: currentDraft.barcode || null,
                  expiration_date: currentDraft.expiration_date || null,
                  quantity_required: quantityRequired,
                }
              : item,
          )
        : [
            ...currentDraft.relief_pack_items,
            {
              draft_id: createDraftKey("pack-item"),
              inventory_item_id: currentDraft.inventory_item_id || "",
              inventory_item_stock_form_id:
                currentDraft.inventory_item_stock_form_id || "",
              item_name: currentDraft.new_item_name.trim(),
              category: currentDraft.new_item_category,
              tracking_method: currentDraft.new_item_tracking_method,
              unit_of_measure: currentDraft.new_item_unit_of_measure,
              unit_of_measure_value:
                currentDraft.new_item_unit_of_measure_value !== ""
                  ? Number(currentDraft.new_item_unit_of_measure_value)
                  : null,
              packaging: currentDraft.new_item_packaging,
              units_per_packaging: isPiecePackaging(currentDraft.new_item_packaging)
                ? 1
                : Number(currentDraft.units_per_packaging || 0) || 0,
              barcode: currentDraft.barcode || null,
              expiration_date: currentDraft.expiration_date || null,
              quantity_required: quantityRequired,
            },
          ];

      return {
        ...currentDraft,
        relief_pack_items: nextPackItems,
        inventory_item_id: "",
        inventory_item_stock_form_id: "",
        item_definition_mode: "NEW",
        barcode: "",
        new_item_name: "",
        new_item_category: "perishable",
        new_item_tracking_method: "Count-Based",
        new_item_unit_of_measure: "pc",
        new_item_unit_of_measure_value: "",
        new_item_packaging: "pack",
        units_per_packaging: "",
        pack_item_quantity_required: "1",
        expiration_date: "",
      };
    });
  };

  const removePackItemFromDraft = (draftId) => {
    setDonationItemDraft((currentDraft) => ({
      ...currentDraft,
      relief_pack_items: currentDraft.relief_pack_items.filter(
        (item) => (item.draft_id || item.item_name) !== draftId,
      ),
    }));
  };

  const addDraftDonationItem = async () => {
    setDonationItemErrorMessage("");
    setDonationItemFieldErrors({});

    const nextFieldErrors = validateDonationItemDraft();

    if (Object.keys(nextFieldErrors).length > 0) {
      setDonationItemFieldErrors(nextFieldErrors);
      return;
    }

    if (donationItemDraft.entry_type === "RELIEF_PACK") {

      setDonationForm((currentForm) => ({
        ...currentForm,
        items: [
          ...currentForm.items,
          buildReliefPackDraft(donationItemDraft),
        ],
      }));
      clearDonationFieldError("items");
      setDonationItemDraft(createDonationItemForm());
      setDonationItemFieldErrors({});
      setDonationItemLookupMessage("");
      return;
    }

    setDonationForm((currentForm) => ({
      ...currentForm,
      items: [
        ...currentForm.items,
        buildLooseDonationDraft(donationItemDraft),
      ],
    }));
    clearDonationFieldError("items");
    setDonationItemDraft(createDonationItemForm());
    setDonationItemFieldErrors({});
    setDonationItemLookupMessage("");
  };

  const startEditDonationItem = (item) => {
    setEditingDonationItemId(item.id);
    const savedItemStockDetails = resolveSavedDonationItemStockDetails(item);

    if (item.entry_type === "RELIEF_PACK") {
      setDonationItemDraft({
        ...createDonationItemForm(),
        entry_type: "RELIEF_PACK",
        new_pack_name: item.relief_pack_name || "",
        relief_pack_quantity: String(item.relief_pack_quantity || 1),
        relief_pack_items: (item.relief_pack_items || []).map((packItem) => ({
          ...packItem,
          draft_id:
            packItem.draft_id ||
            `saved-pack-item-${packItem.donation_item_id || packItem.item_name}`,
          quantity_required: String(packItem.quantity_required || 1),
          expiration_date: packItem.expiration_date || "",
        })),
      });
      return;
    }

    setDonationItemDraft({
        entry_type: "ITEM",
        inventory_item_id: item.inventory_item_id,
        inventory_item_stock_form_id: savedItemStockDetails.stockFormId,
        relief_pack_template_id: "",
        relief_pack_quantity: "1",
        item_entry_method: savedItemStockDetails.barcode ? "BARCODE" : "MANUAL",
        barcode: savedItemStockDetails.barcode,
        new_item_name: item.inventory_item?.item_name || item.item_name || "",
        new_item_category: normalizeDonationCategoryValue(
          item.inventory_item?.category || item.category,
        ),
        new_item_tracking_method:
          item.inventory_item?.tracking_method || item.tracking_method || "Count-Based",
        new_item_unit_of_measure: savedItemStockDetails.unitOfMeasure,
        new_item_unit_of_measure_value:
          savedItemStockDetails.unitOfMeasureValue !== ""
            ? String(savedItemStockDetails.unitOfMeasureValue)
            : "",
        new_item_packaging: savedItemStockDetails.packaging,
        batch_number: savedItemStockDetails.batchNumber,
        packaging_count:
          savedItemStockDetails.packagingCount > 0
            ? String(savedItemStockDetails.packagingCount)
            : "",
        units_per_packaging: String(savedItemStockDetails.unitsPerPackaging || ""),
        remarks: "",
        per_family_allocation: String(
          item.per_family_allocation ||
            parsePerFamilyAllocationRemark(item.remarks) ||
            "",
        ),
        expiration_date: savedItemStockDetails.expirationDate,
        storage_location: "",
    });
  };

  const cancelEditDonationItem = () => {
    setEditingDonationItemId("");
    setDonationItemDraft(createDonationItemForm());
    setDonationItemErrorMessage("");
    setDonationItemFieldErrors({});
  };

  const saveExistingDonationItem = async () => {
    if (!editingDonationItemId) {
      return;
    }

    setDonationItemErrorMessage("");
    setDonationItemFieldErrors({});

    const nextFieldErrors = validateDonationItemDraft({
      isExistingDonationItem: true,
    });

    if (Object.keys(nextFieldErrors).length > 0) {
      setDonationItemFieldErrors(nextFieldErrors);
      return;
    }

    setDonationForm((currentForm) => {
      const nextItems = currentForm.items.map((item) => {
        if (String(item.id) !== String(editingDonationItemId)) {
          return item;
        }

        if (donationItemDraft.entry_type === "RELIEF_PACK") {
          return {
            ...item,
            entry_type: "RELIEF_PACK",
            relief_pack_name: donationItemDraft.new_pack_name.trim(),
            relief_pack_quantity: Number(donationItemDraft.relief_pack_quantity || 0),
            expiration_date: donationItemDraft.expiration_date || null,
            relief_pack_items: donationItemDraft.relief_pack_items.map((packItem) => ({
              ...packItem,
              quantity_required: String(packItem.quantity_required || 1),
              expiration_date: packItem.expiration_date || "",
            })),
          };
        }

        const nextPackaging = donationItemDraft.new_item_packaging || item.packaging || "piece";
        const nextUnitsPerPackaging = isPiecePackaging(nextPackaging)
          ? 1
          : Number(donationItemDraft.units_per_packaging || 0) || null;
        const nextExpirationDate = donationItemDraft.expiration_date || null;
        const nextQuantityReceived = computeDonationQuantityReceived(donationItemDraft);
        const nextPerFamilyAllocation = Number(
          donationItemDraft.per_family_allocation || 0,
        );

        return {
          ...item,
          quantity_received: nextQuantityReceived,
          remarks: buildPerFamilyAllocationRemark(nextPerFamilyAllocation),
          per_family_allocation: nextPerFamilyAllocation,
          expiration_date: nextExpirationDate,
          inventory_item: {
            ...item.inventory_item,
            item_name: donationItemDraft.new_item_name || item.inventory_item?.item_name || "",
            category: donationItemDraft.new_item_category || item.inventory_item?.category,
            tracking_method:
              donationItemDraft.new_item_tracking_method ||
              item.inventory_item?.tracking_method,
            unit_of_measure:
              donationItemDraft.new_item_unit_of_measure ||
              item.inventory_item?.unit_of_measure,
            unit_of_measure_value:
              donationItemDraft.new_item_unit_of_measure_value !== ""
                ? Number(donationItemDraft.new_item_unit_of_measure_value)
                : item.inventory_item?.unit_of_measure_value,
          },
          inventory_item_stock_form: {
            ...(item.inventory_item_stock_form || {}),
            id:
              donationItemDraft.inventory_item_stock_form_id ||
              item.inventory_item_stock_form?.id ||
              null,
            barcode: donationItemDraft.barcode || item.inventory_item_stock_form?.barcode || "",
            packaging: nextPackaging,
            units_per_packaging: nextUnitsPerPackaging,
          },
          inventory_batch: {
            ...(item.inventory_batch || {}),
            inventory_item_stock_form_id:
              donationItemDraft.inventory_item_stock_form_id ||
              item.inventory_batch?.inventory_item_stock_form_id ||
              null,
            expiration_date: nextExpirationDate,
            stock_form_packaging: nextPackaging,
            stock_form_units_per_packaging: nextUnitsPerPackaging,
          },
        };
      });

      return {
        ...currentForm,
        items: nextItems,
      };
    });

    setSuccessMessage("Donation item changes staged. Click Update Donation to save.");
    cancelEditDonationItem();
  };

  const removeDraftDonationItem = (itemToRemove) => {
    setDonationForm((currentForm) => ({
      ...currentForm,
      items: currentForm.items.filter((item) => item !== itemToRemove),
    }));

    if (donationForm.items.length > 1) {
      clearDonationFieldError("items");
    }
  };

  const removeExistingDonationItem = async (item) => {
    setDeleteConfirmation({
      type: "donation-item",
      payload: item,
      title: "Delete Donation Item",
      message: "Remove this donation item from the donation record?",
      confirmLabel: "Delete",
    });
  };

  const addExistingDonationItem = async () => {
    if (!donationForm.id) {
      await addDraftDonationItem();
      return;
    }

    setDonationItemErrorMessage("");
    setDonationItemFieldErrors({});

    try {
      const nextFieldErrors = validateDonationItemDraft();

      if (Object.keys(nextFieldErrors).length > 0) {
        setDonationItemFieldErrors(nextFieldErrors);
        return;
      }

      if (donationItemDraft.entry_type === "RELIEF_PACK") {
        const expandedReliefPackItems =
          await resolveReliefPackDonationItemPayloads({
            reliefPackName: donationItemDraft.new_pack_name.trim(),
            reliefPackQuantity: donationItemDraft.relief_pack_quantity,
            reliefPackExpirationDate: donationItemDraft.expiration_date || null,
            reliefPackItems: donationItemDraft.relief_pack_items,
            inventoryItems,
          });

        for (const expandedItem of expandedReliefPackItems) {
          await createDonationItem(donationForm.id, expandedItem);
        }
      } else {
        const createdInventoryItem = await resolveDonationInventoryItem({
          draft: donationItemDraft,
          inventoryItems,
        });
        const inventoryItemId = createdInventoryItem?.id;

        if (!inventoryItemId) {
          throw new Error("Define the inventory item before adding it.");
        }

        await createDonationItem(donationForm.id, {
          ...buildDonationItemSubmissionPayload({
            inventory_item_id: inventoryItemId,
            inventory_item_stock_form_id:
              donationItemDraft.inventory_item_stock_form_id || null,
            quantity_received: computeDonationQuantityReceived(donationItemDraft),
            remarks: buildPerFamilyAllocationRemark(
              donationItemDraft.per_family_allocation,
            ),
            expiration_date: donationItemDraft.expiration_date || null,
            packaging: donationItemDraft.new_item_packaging,
            units_per_packaging: donationItemDraft.units_per_packaging,
            unit_of_measure: donationItemDraft.new_item_unit_of_measure,
            unit_of_measure_value:
              donationItemDraft.new_item_unit_of_measure_value,
            barcode: donationItemDraft.barcode || null,
          }),
        });
      }

      const refreshedDonation = await fetchDonationById(donationForm.id);
      setDonationForm((currentForm) => ({
        ...currentForm,
        items: normalizeDonationFormItems(refreshedDonation.items || []),
      }));
      setDonationItemDraft(createDonationItemForm());
      setDonationItemFieldErrors({});
      setDonationItemLookupMessage("");
      setSuccessMessage("Donation item added successfully.");
      await loadPageData(selectedEventId);
    } catch (error) {
      setDonationItemErrorMessage(error.message || "Failed to add donation item.");
    }
  };

  const handleDeleteDonation = async (donation) => {
    setDeleteConfirmation({
      type: "donation",
      payload: donation,
      title: "Delete Donation Record",
      message: `Delete the donation record for ${donation.donor_name}?`,
      confirmLabel: "Delete",
    });
  };

  const handleCancelDeleteConfirmation = () => {
    if (isDeleteSubmitting) {
      return;
    }

    setDeleteConfirmation(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation || isDeleteSubmitting) {
      return;
    }

    setIsDeleteSubmitting(true);

    try {
      if (deleteConfirmation.type === "donation-item") {
        await deleteDonationItem(deleteConfirmation.payload.id);
        const refreshedDonation = await fetchDonationById(donationForm.id);
        setDonationForm((currentForm) => ({
          ...currentForm,
          items: normalizeDonationFormItems(refreshedDonation.items || []),
        }));
        cancelEditDonationItem();
        await loadPageData(selectedEventId);
        setExportFeedback({
          type: "success",
          message: "Donation item deleted successfully.",
        });
      } else if (deleteConfirmation.type === "donation") {
        await deleteDonation(deleteConfirmation.payload.id);
        await loadPageData(selectedEventId);
        setExportFeedback({
          type: "success",
          message: "Donation deleted successfully.",
        });
      }

      setDeleteConfirmation(null);
    } catch (error) {
      if (deleteConfirmation.type === "donation-item") {
        setExportFeedback({
          type: "error",
          message: error.message || "Failed to delete donation item.",
        });
      } else {
        setExportFeedback({
          type: "error",
          message:
            error.message ||
            (deleteConfirmation.type === "donation"
              ? "Failed to delete donation."
              : "Failed to delete donation item."),
        });
      }
    } finally {
      setIsDeleteSubmitting(false);
    }
  };

  return {
    deleteConfirmation,
    isDeleteSubmitting,
    isDonationModalOpen,
    isDonationDetailModalOpen,
    isDonationDetailLoading,
    donationDetailErrorMessage,
    selectedDonationDetail,
    donationForm,
    donationErrorMessage,
    donationFieldErrors,
    donationItemErrorMessage,
    donationItemLookupMessage,
    isDonationItemBarcodeLookupLoading,
    donationItemFieldErrors,
    isDonationSubmitting,
    donationItemDraft,
    editingDonationItemId,
    setDonationForm,
    setDonationItemDraft,
    handleDonationFormChange,
    handleDonationItemDraftChange,
    handleReliefPackDraftItemChange,
    handleSelectExistingInventoryItem,
    clearSelectedExistingInventoryItem,
    lookupDonationItemBarcode,
    openDonationModal,
    closeDonationModal,
    openDonationDetailModal,
    closeDonationDetailModal,
    submitDonation,
    addDraftDonationItem,
    addPackItemToDraft,
    removePackItemFromDraft,
    startEditDonationItem,
    cancelEditDonationItem,
    saveExistingDonationItem,
    removeDraftDonationItem,
    removeExistingDonationItem,
    addExistingDonationItem,
    handleDeleteDonation,
    handleCancelDeleteConfirmation,
    handleConfirmDelete,
  };
};
