import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiEdit2, FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import {
  donorTypes,
  inputStyles,
  labelStyles,
  modalStyles,
  overlayStyles,
} from "../../features/donations/donationUi";

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

const fieldGridStyles = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "18px",
};

const categoryOptions = [
  { value: "perishable", label: "Perishable" },
  { value: "non-perishable", label: "Non-Perishable" },
];

const unitOptions = ["pc", "kg", "g", "L", "mL"];
const packagingOptions = ["piece", "pack", "box", "case", "carton", "sack", "bottle"];
const RELIEF_PACK_REMARK_PREFIX = "Relief Pack:";

const getReliefPackItemTotal = (packItem, packQuantity) => {
  const quantityPerReliefPack = Number(packItem?.quantity_required || 0);
  const totalReliefPacks = Number(packQuantity || 0);
  const unitsPerPackaging = isPiecePackaging(packItem?.packaging)
    ? 1
    : Number(packItem?.units_per_packaging || 0);

  return quantityPerReliefPack > 0 && totalReliefPacks > 0 && unitsPerPackaging > 0
    ? quantityPerReliefPack * totalReliefPacks * unitsPerPackaging
    : 0;
};
const getReliefPackItemName = (packItem) =>
  packItem?.item_name || packItem?.inventory_item?.item_name || "Inventory item";
const getReliefPackItemQuantityPerPack = (packItem) =>
  Number(packItem?.quantity_required || 0);
const getSavedDonationItemName = (item) =>
  item?.inventory_item?.item_name || item?.item_name || "Inventory item";
const getSavedDonationItemUnit = (item) =>
  item?.inventory_item?.unit_of_measure || item?.unit_of_measure || "unit(s)";
const getSavedDonationItemQuantity = (item) =>
  `${Number(item?.quantity_received || 0)} ${getSavedDonationItemUnit(item)}`;

const getDonationItemDisplayName = (item) =>
  item?.item_name || item?.inventory_item?.item_name || "Inventory item";

const getDonationItemDisplayUnit = (item) =>
  item?.unit_of_measure || item?.inventory_item?.unit_of_measure || "";

const parseReliefPackRemark = (remarks) => {
  const normalizedRemarks = String(remarks || "").trim();

  if (
    normalizedRemarks &&
    normalizedRemarks.toLowerCase().startsWith(
      RELIEF_PACK_REMARK_PREFIX.toLowerCase(),
    )
  ) {
    const remarkBody = normalizedRemarks
      .slice(RELIEF_PACK_REMARK_PREFIX.length)
      .trim();
    const quantityMatch = remarkBody.match(/^(.*?)(?:\s+x\s+(\d+))$/i);

    if (quantityMatch) {
      return {
        name: quantityMatch[1].trim(),
        quantity: Number(quantityMatch[2]),
      };
    }

    return {
      name: remarkBody,
      quantity: null,
    };
  }

  return null;
};

const summaryCardStyles = {
  border: "1px solid #dbe6f0",
  borderRadius: "14px",
  backgroundColor: "#f8fbff",
  padding: "14px 16px",
};

const getQuantityLabel = (quantity, unit) =>
  `${quantity ?? 0}${unit ? ` ${unit}` : ""}`;

const buildDonationItemGroups = (items) => {
  const groups = [];
  const persistedPackGroups = new Map();
  let packIndex = 0;

  items.forEach((item) => {
    if (item?.entry_type === "RELIEF_PACK") {
      packIndex += 1;
      groups.push({
        key: item.draft_id || item.id || `pack-${packIndex}`,
        type: "pack",
        title: item.relief_pack_name || `Pack ${packIndex}`,
        subtitle: "",
        supportingText: `${item.relief_pack_quantity} relief packs`,
        lines: (item.relief_pack_items || []).map((packItem) => ({
          key: packItem.draft_id || packItem.item_name,
          label: packItem.item_name || "Inventory item",
          quantity: getQuantityLabel(
            getReliefPackItemTotal(packItem, item.relief_pack_quantity),
            packItem.unit_of_measure,
          ),
        })),
        canRemove: !item.id,
        sourceItem: item,
      });
      return;
    }

    const persistedPackMeta = parseReliefPackRemark(item?.remarks);

    if (persistedPackMeta) {
      const persistedPackKey = `${persistedPackMeta.name}::${
        persistedPackMeta.quantity ?? ""
      }`;
      let group = persistedPackGroups.get(persistedPackKey);

      if (!group) {
        packIndex += 1;
        group = {
          key: item.id || `saved-pack-${packIndex}`,
          type: "pack",
          title: persistedPackMeta.name || `Pack ${packIndex}`,
          subtitle: "",
          supportingText: persistedPackMeta.quantity
            ? `${persistedPackMeta.quantity} relief packs`
            : "",
          lines: [],
          canRemove: false,
          sourceItem: item,
        };
        persistedPackGroups.set(persistedPackKey, group);
        groups.push(group);
      }

      group.lines.push({
        key: item.id || `${group.key}-${group.lines.length}`,
        label: getDonationItemDisplayName(item),
        quantity: getQuantityLabel(
          item.quantity_received,
          getDonationItemDisplayUnit(item),
        ),
      });
      return;
    }

    groups.push({
      key: item.draft_id || item.id || getDonationItemDisplayName(item),
      type: "item",
      title: getDonationItemDisplayName(item),
      subtitle: "",
      supportingText: [
        getQuantityLabel(item.quantity_received, getDonationItemDisplayUnit(item)),
        item.per_family_allocation
          ? `${item.per_family_allocation} per family`
          : null,
      ]
        .filter(Boolean)
        .join(" | "),
      lines: [],
      canRemove: !item.id,
      sourceItem: item,
    });
  });

  return groups;
};

const sectionHeaderRowStyles = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const fieldErrorTextStyles = {
  margin: "6px 0 0",
  color: "#c53030",
  fontSize: "12px",
  lineHeight: 1.4,
};

const lockedInputStyles = {
  ...inputStyles,
  backgroundColor: "#eef5fb",
  color: "#5f7891",
  cursor: "not-allowed",
};

const lookupFeedbackTextStyles = {
  margin: "8px 0 0",
  color: "#35597c",
  fontSize: "12px",
  lineHeight: 1.5,
};

const allocationSuggestionTextStyles = {
  margin: "8px 0 0",
  color: "#60738a",
  fontSize: "12px",
  lineHeight: 1.45,
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
};

const getNormalizedInventoryText = (value) =>
  String(value || "").trim().toLowerCase();

const getNormalizedBarcodeValue = (value) =>
  String(value || "").replace(/\s+/g, "").trim().toLowerCase();

const isWeightOrVolumeBased = (trackingMethod) =>
  trackingMethod === "Weight/Volume-Based";

const isPiecePackaging = (packaging) =>
  String(packaging || "").trim().toLowerCase() === "piece";

const parsePositiveNumberOrZero = (value) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return 0;
  }

  return parsedValue;
};

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

const getLooseItemTotalQuantity = (draft) => {
  const packageCount = Number(draft?.packaging_count || 0);
  const unitsPerPackaging = isPiecePackaging(draft?.new_item_packaging)
    ? 1
    : Number(draft?.units_per_packaging || 0);

  return packageCount > 0 && unitsPerPackaging > 0
    ? packageCount * unitsPerPackaging
    : 0;
};

const getEventHouseholdCount = ({ formValues, disasterEvents, portalData }) => {
  const selectedEventId = formValues?.disaster_event_id || "";
  const selectedEvent =
    disasterEvents.find((eventRow) => String(eventRow?.id) === String(selectedEventId)) ||
    null;
  const selectedPortalEvent =
    (portalData?.disaster_events || []).find(
      (eventRow) =>
        String(eventRow?.title || "").trim().toLowerCase() ===
        String(selectedEvent?.title || "").trim().toLowerCase(),
    ) || null;

  return Number(
    selectedEvent?.eligible_unclaimed_households_count ||
      selectedPortalEvent?.eligible_unclaimed_households_count ||
      0,
  );
};

const buildAllocationStatusLines = ({ quantity, allocation, households }) => {
  if (quantity <= 0 || allocation <= 0 || households <= 0) {
    return [];
  }

  if (quantity < allocation * households) {
    const reachable = Math.floor(quantity / allocation);
    const leftover = quantity % allocation;
    const lines = [
      `Allocation: Only covers first ${reachable} of ${households} household(s) by FCFS at ${allocation} per family.`,
    ];

    if (leftover > 0) {
      lines.push(
        `Estimated remaining stock after allocation: ${leftover} item(s).`,
      );
    }

    return lines;
  }

  const estimatedRemainingStock = quantity - allocation * households;

  return [
    `Allocation: Covers all households at ${allocation} per family.`,
    `Estimated remaining stock after allocation: ${estimatedRemainingStock} item(s).`,
  ];
};

const buildPerFamilyAllocationGuidance = ({
  totalQuantity,
  perFamilyAllocation,
  householdCount,
  hasSelectedDisasterEvent,
}) => {
  const quantity = Number(totalQuantity || 0);
  const allocation = Number(perFamilyAllocation || 0);
  const households = Number(householdCount || 0);

  if (!hasSelectedDisasterEvent) {
    return ["Select a disaster event first to load the current eligible households."];
  }

  if (quantity <= 0) {
    return ["Enter the donated quantity first to calculate family coverage."];
  }

  if (households <= 0) {
    return [
      "Current Number of Household: 0.",
      "No eligible unclaimed evacuee household is currently present in the evacuation center.",
    ];
  }

  return [
    `Current Number of Household: ${households}.`,
    ...buildAllocationStatusLines({
      quantity,
      allocation,
      households,
    }),
  ].filter(Boolean);
};

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
      const stockForms = Array.isArray(item?.stock_forms) ? item.stock_forms : [];
      const barcodedStockForms = stockForms.filter((stockForm) =>
        Boolean(String(stockForm?.barcode || "").trim()),
      );
      const itemHasBarcode =
        Boolean(String(item?.barcode || "").trim()) || barcodedStockForms.length > 0;

      if (collapseBarcodeVariants || !itemHasBarcode) {
        return [
          {
            key: `item-${item.id}`,
            item,
            stockForm: null,
            meta: item.category || "Item",
          },
        ];
      }

      const packagingSuggestions =
        barcodedStockForms.length > 0
          ? barcodedStockForms
          : [
              {
                id: "item-barcode",
                barcode: item.barcode,
                packaging: item.packaging,
              },
            ];

      return packagingSuggestions.map((stockForm, index) => ({
        key: `item-${item.id}-stock-form-${stockForm?.id || index}`,
        item,
        stockForm,
        meta: `${item.category || "Item"} (${formatPackagingLabel(
          stockForm?.packaging || item?.packaging || "piece",
        )})`,
      }));
    })
    .slice(0, 8);
};

const buildDonorSuggestions = (donors, query) => {
  const normalizedQuery = getNormalizedInventoryText(query);

  if (!normalizedQuery) {
    return [];
  }

  return donors
    .filter((donor) =>
      getNormalizedInventoryText(donor?.donor_name).includes(normalizedQuery),
    )
    .sort((leftDonor, rightDonor) =>
      String(leftDonor?.donor_name || "").localeCompare(
        String(rightDonor?.donor_name || ""),
        undefined,
        { sensitivity: "base" },
      ),
    )
    .slice(0, 8);
};

const DonationModal = ({
  isOpen,
  formValues,
  itemDraft,
  inventoryItems,
  donorSuggestions = [],
  disasterEvents,
  portalData = {},
  isSubmitting,
  errorMessage,
  fieldErrors = {},
  itemErrorMessage,
  isBarcodeLookupLoading = false,
  itemFieldErrors = {},
  editingItemId,
  onClose,
  onFormChange,
  onItemDraftChange,
  onReliefPackDraftItemChange,
  onSelectExistingInventoryItem,
  onClearSelectedExistingInventoryItem,
  onAddItemDraft,
  onEditExistingItem,
  onRemoveDraftItem,
  onAddPackItemDraft,
  onRemovePackItemDraft,
  onStartEditItem,
  onCancelEditItem,
  onSubmit,
}) => {
  const activeDisasterEvents = Array.isArray(disasterEvents)
    ? disasterEvents.filter((eventRow) => {
        const normalizedStatus = String(eventRow?.status || "").trim().toUpperCase();
        return normalizedStatus === "ACTIVE" || normalizedStatus === "ONGOING";
      })
    : [];
  const isEditingDonation = Boolean(formValues.id);
  const isAddingReliefPack = itemDraft.entry_type === "RELIEF_PACK";
  const isDefiningNewItem = !editingItemId && !isAddingReliefPack;
  const isDefiningNewPack = !editingItemId && isAddingReliefPack;
  const isEditingReliefPack = Boolean(editingItemId) && isAddingReliefPack;
  const selectedReliefPackItems = itemDraft.relief_pack_items;
  const selectedReliefPackName = itemDraft.new_pack_name || "New Relief Pack";
  const selectedPackQuantity = Number(itemDraft.relief_pack_quantity || 0);
  const isOtherDonorType = formValues.donor_type === "OTHER";
  const isLooseItemPerishable =
    String(itemDraft.new_item_category || "").trim().toLowerCase() === "perishable";
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [isDonorAutocompleteOpen, setIsDonorAutocompleteOpen] = useState(false);
  const autocompleteRef = useRef(null);
  const itemNameInputRef = useRef(null);
  const donorAutocompleteRef = useRef(null);
  const donorNameInputRef = useRef(null);
  const selectedExistingInventoryItem = useMemo(
    () =>
      inventoryItems.find(
        (item) => String(item?.id) === String(itemDraft.inventory_item_id || ""),
      ) || null,
    [inventoryItems, itemDraft.inventory_item_id],
  );
  const selectedExistingStockForm = useMemo(() => {
    if (!selectedExistingInventoryItem || !itemDraft.inventory_item_stock_form_id) {
      return null;
    }

    const stockForms = Array.isArray(selectedExistingInventoryItem.stock_forms)
      ? selectedExistingInventoryItem.stock_forms
      : [];

    return (
      stockForms.find(
        (stockForm) =>
          String(stockForm?.id) === String(itemDraft.inventory_item_stock_form_id),
      ) || null
    );
  }, [
    itemDraft.inventory_item_stock_form_id,
    selectedExistingInventoryItem,
  ]);
  const getReliefPackDraftFieldError = (packItem, fieldName) =>
    itemFieldErrors[
      `relief_pack_item_${
        packItem.draft_id || packItem.donation_item_id || packItem.item_name
      }_${fieldName}`
    ] || "";
  const inventorySearchSuggestions = useMemo(() => {
    if (editingItemId) {
      return [];
    }

    return buildAutocompleteSuggestions(inventoryItems, itemDraft.new_item_name, {
      collapseBarcodeVariants:
        itemDraft.item_entry_method === "BARCODE" &&
        Boolean(String(itemDraft.barcode || "").trim()) &&
        !selectedExistingStockForm,
    });
  }, [
    editingItemId,
    inventoryItems,
    isAddingReliefPack,
    itemDraft.barcode,
    itemDraft.item_entry_method,
    itemDraft.new_item_name,
    selectedExistingStockForm,
  ]);
  const donorNameSuggestions = useMemo(() => {
    return buildDonorSuggestions(donorSuggestions, formValues.donor_name);
  }, [donorSuggestions, formValues.donor_name]);
  const matchedRecordedDonor = useMemo(() => {
    const normalizedDonorName = getNormalizedInventoryText(formValues.donor_name);

    if (!normalizedDonorName) {
      return null;
    }

    return (
      donorSuggestions.find(
        (donor) =>
          getNormalizedInventoryText(donor?.donor_name) === normalizedDonorName,
      ) || null
    );
  }, [donorSuggestions, formValues.donor_name]);
  const trackingMethod = itemDraft.new_item_tracking_method || "Count-Based";
  const usesWeightOrVolume = isWeightOrVolumeBased(trackingMethod);
  const selectedPackagingLabel = formatPackagingLabel(itemDraft.new_item_packaging);
  const shouldShowUnitsPerPackagingField = !isPiecePackaging(itemDraft.new_item_packaging);
  const lockIdentityFields = Boolean(selectedExistingInventoryItem) || Boolean(editingItemId);
  const isEditingSavedDonationItem = Boolean(editingItemId);
  const isEditingSavedLooseItem = isEditingSavedDonationItem && !isAddingReliefPack;
  const hasExactBarcodeStockFormMatch = useMemo(() => {
    if (
      itemDraft.item_entry_method !== "BARCODE" ||
      !selectedExistingInventoryItem
    ) {
      return false;
    }

    const normalizedDraftBarcode = getNormalizedBarcodeValue(itemDraft.barcode);

    if (!normalizedDraftBarcode) {
      return false;
    }

    if (
      getNormalizedBarcodeValue(selectedExistingStockForm?.barcode) ===
      normalizedDraftBarcode
    ) {
      return true;
    }

    return (
      getNormalizedBarcodeValue(selectedExistingInventoryItem?.barcode) ===
      normalizedDraftBarcode
    );
  }, [
    itemDraft.barcode,
    itemDraft.item_entry_method,
    selectedExistingInventoryItem,
    selectedExistingStockForm,
  ]);
  const lockStockFormFields = hasExactBarcodeStockFormMatch || isEditingSavedDonationItem;
  const lockDonorTypeFields = Boolean(matchedRecordedDonor);
  const showDonationItemBuilder = !isEditingDonation || Boolean(editingItemId);
  const quantityOnHandLabel = isEditingSavedLooseItem
    ? `Quantity Received (${selectedPackagingLabel})`
    : usesWeightOrVolume
      ? "Packages Received"
      : "Quantity on Hand";
  const quantityOnHandPlaceholder = isEditingSavedLooseItem
    ? `Enter quantity received in ${selectedPackagingLabel}`
    : usesWeightOrVolume
      ? formatPackagingExample(itemDraft.new_item_packaging).replace(
          /^Example:\s*/i,
          "Example: received ",
        )
      : formatPackagingExample(itemDraft.new_item_packaging);
  const unitsPerPackagingLabel = usesWeightOrVolume
    ? "Items per Package"
    : `Units per ${selectedPackagingLabel}`;
  const unitsPerPackagingPlaceholder = usesWeightOrVolume
    ? `Example: 1 ${itemDraft.new_item_packaging || "package"} contains 1 item`
    : `Example: 12 pieces per ${itemDraft.new_item_packaging || "package"}`;
  const lockDisasterEventField = isEditingDonation;
  const lockDonationEntryTypeField = isEditingDonation;
  const editingDonationItem =
    formValues.items.find((item) => String(item.id) === String(editingItemId)) || null;
  const editingInventoryItem =
    inventoryItems.find(
      (item) => String(item.id) === String(itemDraft.inventory_item_id || ""),
    ) || null;
  const editingInventoryItemName = editingDonationItem
    ? getDonationItemDisplayName(editingDonationItem)
    : editingInventoryItem?.item_name || "";
  const donationItemGroups = buildDonationItemGroups(formValues.items);
  const looseItemTotalQuantity = getLooseItemTotalQuantity(itemDraft);
  const currentHouseholdCount = getEventHouseholdCount({
    formValues,
    disasterEvents,
    portalData,
  });
  const perFamilyAllocationGuidance = buildPerFamilyAllocationGuidance({
    totalQuantity: looseItemTotalQuantity,
    perFamilyAllocation: itemDraft.per_family_allocation,
    householdCount: currentHouseholdCount,
    hasSelectedDisasterEvent: Boolean(formValues.disaster_event_id),
  });

  useEffect(() => {
    if (!isOpen) {
      setIsAutocompleteOpen(false);
      setIsDonorAutocompleteOpen(false);
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (
        itemNameInputRef.current?.contains(event.target) ||
        autocompleteRef.current?.contains(event.target)
      ) {
      } else {
        setIsAutocompleteOpen(false);
      }

      if (
        donorNameInputRef.current?.contains(event.target) ||
        donorAutocompleteRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsDonorAutocompleteOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div style={overlayStyles}>
      <div style={{ ...modalStyles, backgroundColor: "#eef5fb" }}>
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
              {isEditingDonation ? "Edit Donation" : "Receive Donation"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              ...pageHeaderStyles.secondaryButton,
              minWidth: "44px",
              width: "44px",
              height: "44px",
              padding: 0,
              borderRadius: "14px",
            }}
            aria-label="Close donation modal"
          >
            <FiX />
          </button>
        </div>

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <section style={sectionStyles}>
            <h3 style={sectionTitleStyles}>Donation Information</h3>

            <div style={fieldGridStyles}>
              <div style={autocompleteStyles.wrap}>
                <label htmlFor="donor_name" style={labelStyles}>
                  Donor Name
                </label>
                <input
                  ref={donorNameInputRef}
                  id="donor_name"
                  value={formValues.donor_name}
                  onChange={(event) => {
                    onFormChange("donor_name", event.target.value);
                    setIsDonorAutocompleteOpen(Boolean(event.target.value.trim()));
                  }}
                  style={inputStyles}
                  placeholder="Enter donor name"
                  aria-invalid={Boolean(fieldErrors.donor_name)}
                  autoComplete="off"
                />
                {fieldErrors.donor_name ? (
                  <p style={fieldErrorTextStyles}>{fieldErrors.donor_name}</p>
                ) : null}
                {isDonorAutocompleteOpen && donorNameSuggestions.length ? (
                  <ul
                    ref={donorAutocompleteRef}
                    style={autocompleteStyles.list}
                  >
                    {donorNameSuggestions.map((donor) => (
                      <li key={donor.donor_name}>
                        <button
                          type="button"
                          style={autocompleteStyles.itemButton}
                          onClick={() => {
                            onFormChange("donor_name", donor.donor_name);
                            setIsDonorAutocompleteOpen(false);
                          }}
                        >
                          {donor.donor_name}
                          <span style={autocompleteStyles.itemMeta}>
                            {donor.donor_type_label}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div>
                <label htmlFor="donation_event" style={labelStyles}>
                  Disaster Event
                </label>
                <select
                  id="donation_event"
                  value={formValues.disaster_event_id}
                  onChange={(event) => onFormChange("disaster_event_id", event.target.value)}
                  style={lockDisasterEventField ? lockedInputStyles : inputStyles}
                  aria-invalid={Boolean(fieldErrors.disaster_event_id)}
                  disabled={lockDisasterEventField}
                >
                  <option value="">Select disaster event</option>
                  {activeDisasterEvents.map((eventRow) => (
                    <option key={eventRow.id} value={eventRow.id}>
                      {eventRow.title}
                    </option>
                  ))}
                </select>
                {fieldErrors.disaster_event_id ? (
                  <p style={fieldErrorTextStyles}>{fieldErrors.disaster_event_id}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="received_at" style={labelStyles}>
                  Received Date
                </label>
                <input
                  id="received_at"
                  type="date"
                  value={formValues.received_at}
                  onChange={(event) => onFormChange("received_at", event.target.value)}
                  style={inputStyles}
                  aria-invalid={Boolean(fieldErrors.received_at)}
                />
                {fieldErrors.received_at ? (
                  <p style={fieldErrorTextStyles}>{fieldErrors.received_at}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="donor_type" style={labelStyles}>
                  Donor Type
                </label>
                <select
                  id="donor_type"
                  value={formValues.donor_type}
                  onChange={(event) => onFormChange("donor_type", event.target.value)}
                  style={lockDonorTypeFields ? lockedInputStyles : inputStyles}
                  aria-invalid={Boolean(fieldErrors.donor_type)}
                  disabled={lockDonorTypeFields}
                >
                  {donorTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.donor_type ? (
                  <p style={fieldErrorTextStyles}>{fieldErrors.donor_type}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="donation_entry_type" style={labelStyles}>
                  Donation Type
                </label>
                <select
                  id="donation_entry_type"
                  value={itemDraft.entry_type}
                  onChange={(event) => onItemDraftChange("entry_type", event.target.value)}
                  style={
                    lockDonationEntryTypeField || Boolean(editingItemId)
                      ? lockedInputStyles
                      : inputStyles
                  }
                  aria-invalid={Boolean(fieldErrors.entry_type)}
                  disabled={lockDonationEntryTypeField || Boolean(editingItemId)}
                >
                  <option value="ITEM">Loose Item</option>
                  <option value="RELIEF_PACK">Relief Pack</option>
                </select>
                {fieldErrors.entry_type ? (
                  <p style={fieldErrorTextStyles}>{fieldErrors.entry_type}</p>
                ) : null}
              </div>

              {isOtherDonorType ? (
                <div>
                  <label htmlFor="donor_type_other" style={labelStyles}>
                    Specify Donor Type
                  </label>
                  <input
                    id="donor_type_other"
                    value={formValues.donor_type_other || ""}
                    onChange={(event) =>
                      onFormChange("donor_type_other", event.target.value)
                    }
                    style={lockDonorTypeFields ? lockedInputStyles : inputStyles}
                    placeholder="Enter donor type"
                    aria-invalid={Boolean(fieldErrors.donor_type_other)}
                    disabled={lockDonorTypeFields}
                  />
                  {fieldErrors.donor_type_other ? (
                    <p style={fieldErrorTextStyles}>{fieldErrors.donor_type_other}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <section style={sectionStyles}>
            <div style={sectionHeaderRowStyles}>
              <h3 style={{ ...sectionTitleStyles, margin: 0 }}>Donation Items</h3>
            </div>

            {showDonationItemBuilder ? (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "16px",
                  }}
                >
              {isDefiningNewItem ? (
                <div>
                  <label htmlFor="item_entry_method" style={labelStyles}>
                    Item Entry Method
                  </label>
                  <select
                    id="item_entry_method"
                    value={itemDraft.item_entry_method || "MANUAL"}
                    onChange={(event) =>
                      onItemDraftChange("item_entry_method", event.target.value)
                    }
                    style={inputStyles}
                  >
                    <option value="MANUAL">Manual Search</option>
                    <option value="BARCODE">Barcode</option>
                  </select>
                </div>
              ) : null}

              {isDefiningNewItem && itemDraft.item_entry_method === "BARCODE" ? (
                <div>
                  <label htmlFor="donation_item_barcode" style={labelStyles}>
                    Barcode Number
                  </label>
                  <input
                    id="donation_item_barcode"
                    value={itemDraft.barcode || ""}
                    onChange={(event) =>
                      onItemDraftChange("barcode", event.target.value)
                    }
                    style={lockStockFormFields ? lockedInputStyles : inputStyles}
                    disabled={lockStockFormFields}
                    placeholder="Scan or enter barcode"
                    aria-invalid={Boolean(itemFieldErrors.barcode)}
                  />
                  {itemFieldErrors.barcode ? (
                    <p style={fieldErrorTextStyles}>{itemFieldErrors.barcode}</p>
                  ) : null}
                </div>
              ) : null}

              <div>
                <label
                  htmlFor={isAddingReliefPack ? "new_pack_name" : "new_item_name"}
                  style={labelStyles}
                >
                  {isAddingReliefPack ? "Relief Pack Name" : "Inventory Item"}
                </label>
                {isDefiningNewItem ? (
                  <div style={{ ...autocompleteStyles.wrap }}>
                    <input
                      ref={itemNameInputRef}
                      id="new_item_name"
                      value={itemDraft.new_item_name}
                      onChange={(event) => {
                        onItemDraftChange("new_item_name", event.target.value);
                        setIsAutocompleteOpen(Boolean(event.target.value.trim()));
                      }}
                      onFocus={() => {
                        if (inventorySearchSuggestions.length > 0) {
                          setIsAutocompleteOpen(true);
                        }
                      }}
                      style={lockIdentityFields ? lockedInputStyles : inputStyles}
                      placeholder="Search inventory item or enter a new item name"
                      aria-invalid={Boolean(itemFieldErrors.new_item_name)}
                    />

                    {isAutocompleteOpen && inventorySearchSuggestions.length > 0 ? (
                      <ul ref={autocompleteRef} style={autocompleteStyles.list}>
                        {inventorySearchSuggestions.map((suggestion) => (
                          <li key={suggestion.key}>
                            <button
                              type="button"
                              onClick={() => {
                                onSelectExistingInventoryItem(suggestion);
                                setIsAutocompleteOpen(false);
                              }}
                              style={autocompleteStyles.itemButton}
                            >
                              {suggestion.item.item_name}
                              <span style={autocompleteStyles.itemMeta}>
                                {suggestion.meta}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {itemFieldErrors.new_item_name ? (
                      <p style={fieldErrorTextStyles}>{itemFieldErrors.new_item_name}</p>
                    ) : null}

                  </div>
                ) : isDefiningNewPack || isEditingReliefPack ? (
                  <>
                    <input
                      id="new_pack_name"
                      value={itemDraft.new_pack_name}
                      onChange={(event) => onItemDraftChange("new_pack_name", event.target.value)}
                      style={isEditingReliefPack ? lockedInputStyles : inputStyles}
                      placeholder="Enter relief pack name"
                      aria-invalid={Boolean(itemFieldErrors.new_pack_name)}
                      disabled={isEditingReliefPack}
                    />
                    {itemFieldErrors.new_pack_name ? (
                      <p style={fieldErrorTextStyles}>{itemFieldErrors.new_pack_name}</p>
                    ) : null}
                  </>
                ) : editingItemId && !isAddingReliefPack ? (
                  <input
                    id="item_inventory_item_id"
                    value={editingInventoryItemName}
                    style={{
                      ...inputStyles,
                      backgroundColor: "#f4f8fc",
                      color: "#4f677f",
                    }}
                    readOnly
                  />
                ) : (
                  <select
                    id="item_inventory_item_id"
                    value={itemDraft.inventory_item_id}
                    onChange={(event) => onItemDraftChange("inventory_item_id", event.target.value)}
                    style={inputStyles}
                    disabled={Boolean(editingItemId)}
                  >
                    <option value="">Select inventory item</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.item_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {isDefiningNewItem ? (
                <>
                  <div>
                    <label htmlFor="new_item_category" style={labelStyles}>
                      Category
                    </label>
                    <select
                      id="new_item_category"
                      value={itemDraft.new_item_category}
                      onChange={(event) =>
                        onItemDraftChange("new_item_category", event.target.value)
                      }
                      style={lockIdentityFields ? lockedInputStyles : inputStyles}
                      disabled={lockIdentityFields}
                      aria-invalid={Boolean(itemFieldErrors.new_item_category)}
                    >
                      {categoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {itemFieldErrors.new_item_category ? (
                      <p style={fieldErrorTextStyles}>{itemFieldErrors.new_item_category}</p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor="new_item_tracking_method" style={labelStyles}>
                      Tracking Method
                    </label>
                    <select
                      id="new_item_tracking_method"
                      value={trackingMethod}
                      onChange={(event) =>
                        onItemDraftChange(
                          "new_item_tracking_method",
                          event.target.value,
                        )
                      }
                      style={lockIdentityFields ? lockedInputStyles : inputStyles}
                      disabled={lockIdentityFields}
                      aria-invalid={Boolean(itemFieldErrors.new_item_tracking_method)}
                    >
                      <option value="Count-Based">Count-Based</option>
                      <option value="Weight/Volume-Based">Weight/Volume-Based</option>
                    </select>
                    {itemFieldErrors.new_item_tracking_method ? (
                      <p style={fieldErrorTextStyles}>
                        {itemFieldErrors.new_item_tracking_method}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor="new_item_unit" style={labelStyles}>
                      {usesWeightOrVolume ? "Base Unit" : "Unit of Measure"}
                    </label>
                    <select
                      id="new_item_unit"
                      value={itemDraft.new_item_unit_of_measure}
                      onChange={(event) =>
                        onItemDraftChange("new_item_unit_of_measure", event.target.value)
                      }
                      style={lockIdentityFields ? lockedInputStyles : inputStyles}
                      disabled={lockIdentityFields}
                      aria-invalid={Boolean(itemFieldErrors.new_item_unit_of_measure)}
                    >
                      {usesWeightOrVolume ? (
                        <>
                          <option value="">Select base unit</option>
                          {unitOptions.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </>
                      ) : (
                        <option value="pc">pc</option>
                      )}
                    </select>
                    {itemFieldErrors.new_item_unit_of_measure ? (
                      <p style={fieldErrorTextStyles}>
                        {itemFieldErrors.new_item_unit_of_measure}
                      </p>
                    ) : null}
                  </div>

                  {usesWeightOrVolume ? (
                    <div>
                      <label htmlFor="new_item_unit_of_measure_value" style={labelStyles}>
                        Amount per Piece/Container
                      </label>
                      <input
                        id="new_item_unit_of_measure_value"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={itemDraft.new_item_unit_of_measure_value}
                        onChange={(event) =>
                          onItemDraftChange(
                            "new_item_unit_of_measure_value",
                            event.target.value,
                          )
                        }
                        style={lockIdentityFields ? lockedInputStyles : inputStyles}
                        disabled={lockIdentityFields}
                        placeholder={`Example: 25 ${itemDraft.new_item_unit_of_measure || "kg"} per piece/container`}
                        aria-invalid={Boolean(itemFieldErrors.new_item_unit_of_measure_value)}
                      />
                      {itemFieldErrors.new_item_unit_of_measure_value ? (
                        <p style={fieldErrorTextStyles}>
                          {itemFieldErrors.new_item_unit_of_measure_value}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div>
                    <label htmlFor="new_item_packaging" style={labelStyles}>
                      Packaging
                    </label>
                    <select
                      id="new_item_packaging"
                      value={itemDraft.new_item_packaging}
                      onChange={(event) =>
                        onItemDraftChange("new_item_packaging", event.target.value)
                      }
                      style={lockStockFormFields ? lockedInputStyles : inputStyles}
                      disabled={lockStockFormFields}
                      aria-invalid={Boolean(itemFieldErrors.new_item_packaging)}
                    >
                      <option value="">Select packaging</option>
                      {packagingOptions.map((packaging) => (
                        <option key={packaging} value={packaging}>
                          {packaging}
                        </option>
                      ))}
                    </select>
                    {itemFieldErrors.new_item_packaging ? (
                      <p style={fieldErrorTextStyles}>
                        {itemFieldErrors.new_item_packaging}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}

              {!isAddingReliefPack ? (
                <div>
                  <label htmlFor="batch_number" style={labelStyles}>
                    Batch Number
                  </label>
                  <input
                    id="batch_number"
                    type="text"
                    value={itemDraft.batch_number || "Auto-generated after saving"}
                    readOnly
                    style={lockedInputStyles}
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="item_quantity" style={labelStyles}>
                    Number of Relief Packs Received
                  </label>
                  <input
                    id="item_quantity"
                    type="number"
                    min="1"
                    value={itemDraft.relief_pack_quantity}
                    onChange={(event) =>
                      onItemDraftChange("relief_pack_quantity", event.target.value)
                    }
                    style={inputStyles}
                    aria-invalid={Boolean(itemFieldErrors.relief_pack_quantity)}
                  />
                  {itemFieldErrors.relief_pack_quantity ? (
                    <p style={fieldErrorTextStyles}>
                      {itemFieldErrors.relief_pack_quantity}
                    </p>
                  ) : null}
                </div>
              )}

              {!isAddingReliefPack ? (
                <div>
                  <label htmlFor="packaging_count" style={labelStyles}>
                    {quantityOnHandLabel}
                  </label>
                  <input
                    id="packaging_count"
                    type="number"
                    min="1"
                    value={itemDraft.packaging_count}
                    onChange={(event) =>
                      onItemDraftChange("packaging_count", event.target.value)
                    }
                    style={inputStyles}
                    placeholder={quantityOnHandPlaceholder}
                    aria-invalid={Boolean(itemFieldErrors.packaging_count)}
                  />
                  {itemFieldErrors.packaging_count ? (
                    <p style={fieldErrorTextStyles}>{itemFieldErrors.packaging_count}</p>
                  ) : null}
                </div>
              ) : null}

              {!isAddingReliefPack && shouldShowUnitsPerPackagingField ? (
                <div>
                  <label htmlFor="units_per_packaging" style={labelStyles}>
                    {unitsPerPackagingLabel}
                  </label>
                  <input
                    id="units_per_packaging"
                    type="number"
                    min="1"
                    value={itemDraft.units_per_packaging}
                    onChange={(event) =>
                      onItemDraftChange("units_per_packaging", event.target.value)
                    }
                    style={lockStockFormFields ? lockedInputStyles : inputStyles}
                    disabled={lockStockFormFields}
                    placeholder={unitsPerPackagingPlaceholder}
                    aria-invalid={Boolean(itemFieldErrors.units_per_packaging)}
                  />
                  {itemFieldErrors.units_per_packaging ? (
                    <p style={fieldErrorTextStyles}>{itemFieldErrors.units_per_packaging}</p>
                  ) : null}
                </div>
              ) : null}

              {!isAddingReliefPack ? (
                <div>
                  <label htmlFor="item_expiration_date" style={labelStyles}>
                    {isLooseItemPerishable
                      ? "Expiration Date"
                      : "Expiration Date (If Applicable)"}
                  </label>
                  <input
                    id="item_expiration_date"
                    type="date"
                    value={itemDraft.expiration_date}
                    onChange={(event) => onItemDraftChange("expiration_date", event.target.value)}
                    style={inputStyles}
                    aria-invalid={Boolean(itemFieldErrors.expiration_date)}
                  />
                  {itemFieldErrors.expiration_date ? (
                    <p style={fieldErrorTextStyles}>{itemFieldErrors.expiration_date}</p>
                  ) : null}
                </div>
              ) : null}

              {!isAddingReliefPack ? (
                <div>
                  <label htmlFor="per_family_allocation" style={labelStyles}>
                    Per Family Allocation
                  </label>
                  <input
                    id="per_family_allocation"
                    type="number"
                    inputMode="numeric"
                    pattern="[1-9][0-9]*"
                    min="1"
                    step="1"
                    value={itemDraft.per_family_allocation || ""}
                    onChange={(event) =>
                      onItemDraftChange("per_family_allocation", event.target.value)
                    }
                    style={
                      formValues.disaster_event_id ? inputStyles : lockedInputStyles
                    }
                    placeholder="Example: 2 per family"
                    disabled={!formValues.disaster_event_id}
                    aria-invalid={Boolean(itemFieldErrors.per_family_allocation)}
                  />
                  <div style={allocationSuggestionTextStyles}>
                    {perFamilyAllocationGuidance.map((line) => (
                      <p key={line} style={{ margin: 0 }}>
                        {line}
                      </p>
                    ))}
                  </div>
                  {itemFieldErrors.per_family_allocation ? (
                    <p style={fieldErrorTextStyles}>
                      {itemFieldErrors.per_family_allocation}
                    </p>
                  ) : null}
                </div>
              ) : null}

            </div>

                {!isAddingReliefPack ? (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "12px",
                      marginTop: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    {editingItemId ? (
                      <button
                        type="button"
                        onClick={onCancelEditItem}
                        style={pageHeaderStyles.secondaryButton}
                      >
                        Cancel Item Edit
                      </button>
                    ) : selectedExistingInventoryItem ? (
                      <button
                        type="button"
                        onClick={onClearSelectedExistingInventoryItem}
                        style={pageHeaderStyles.secondaryButton}
                      >
                        Cancel Selected Item
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={editingItemId ? onEditExistingItem : onAddItemDraft}
                      style={{
                        ...pageHeaderStyles.primaryButton,
                        minHeight: "48px",
                      }}
                    >
                      {editingItemId ? "Save Item" : "+ Add Item"}
                    </button>
                  </div>
                ) : null}

            {isDefiningNewPack || isEditingReliefPack ? (
              <div
                style={{
                  marginTop: "16px",
                  paddingTop: "16px",
                  borderTop: "1px solid #dbe6f0",
                }}
              >
                <h4
                  style={{
                    margin: "0 0 14px",
                    color: "#17324d",
                    fontSize: "16px",
                  }}
                >
                  Items Included in This Relief Pack
                </h4>

                {isEditingReliefPack ? (
                  <div style={{ display: "grid", gap: "14px" }}>
                    {selectedReliefPackItems.length === 0 ? (
                      <p style={{ margin: 0, color: "#60738a", fontSize: "14px" }}>
                        No items are saved in this relief pack.
                      </p>
                    ) : (
                      selectedReliefPackItems.map((packItem) => {
                        const packItemKey =
                          packItem.draft_id || packItem.donation_item_id || packItem.item_name;
                        const quantityPerPackError = getReliefPackDraftFieldError(
                          packItem,
                          "quantity_required",
                        );
                        const expirationDateError = getReliefPackDraftFieldError(
                          packItem,
                          "expiration_date",
                        );
                        const isPackItemPerishable =
                          String(packItem.category || "").trim().toLowerCase() ===
                          "perishable";
                        const totalQuantityReceived =
                          selectedPackQuantity > 0
                            ? getReliefPackItemTotal(packItem, selectedPackQuantity)
                            : 0;
                        const resolvedPackItemPackaging =
                          formatPackagingLabel(packItem.packaging) || "Piece";

                        return (
                          <div key={packItemKey} style={summaryCardStyles}>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                gap: "16px",
                              }}
                            >
                              <div>
                                <label style={labelStyles}>Inventory Item</label>
                                <input
                                  type="text"
                                  value={getReliefPackItemName(packItem)}
                                  readOnly
                                  style={lockedInputStyles}
                                />
                              </div>
                              <div>
                                <label style={labelStyles}>Category</label>
                                <input
                                  type="text"
                                  value={
                                    String(packItem.category || "").trim().toLowerCase() ===
                                    "non-perishable"
                                      ? "Non-Perishable"
                                      : "Perishable"
                                  }
                                  readOnly
                                  style={lockedInputStyles}
                                />
                              </div>
                              <div>
                                <label style={labelStyles}>Tracking Method</label>
                                <input
                                  type="text"
                                  value={packItem.tracking_method || "Count-Based"}
                                  readOnly
                                  style={lockedInputStyles}
                                />
                              </div>
                              <div>
                                <label style={labelStyles}>Unit of Measure</label>
                                <input
                                  type="text"
                                  value={packItem.unit_of_measure || "pc"}
                                  readOnly
                                  style={lockedInputStyles}
                                />
                              </div>
                              <div>
                                <label style={labelStyles}>Packaging</label>
                                <input
                                  type="text"
                                  value={resolvedPackItemPackaging}
                                  readOnly
                                  style={lockedInputStyles}
                                />
                              </div>
                              <div>
                                <label style={labelStyles}>Units per Pack</label>
                                <input
                                  type="text"
                                  value={String(packItem.units_per_packaging || 1)}
                                  readOnly
                                  style={lockedInputStyles}
                                />
                              </div>
                              <div>
                                <label style={labelStyles}>Batch Number</label>
                                <input
                                  type="text"
                                  value={packItem.batch_number || "--"}
                                  readOnly
                                  style={lockedInputStyles}
                                />
                              </div>
                              <div>
                                <label style={labelStyles}>Quantity per Relief Pack</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={packItem.quantity_required || ""}
                                  onChange={(event) =>
                                    onReliefPackDraftItemChange(
                                      packItemKey,
                                      "quantity_required",
                                      event.target.value,
                                    )
                                  }
                                  style={inputStyles}
                                  aria-invalid={Boolean(quantityPerPackError)}
                                />
                                {quantityPerPackError ? (
                                  <p style={fieldErrorTextStyles}>{quantityPerPackError}</p>
                                ) : null}
                              </div>
                              <div>
                                <label style={labelStyles}>Total Quantity Received</label>
                                <input
                                  type="text"
                                  value={`${totalQuantityReceived} ${packItem.unit_of_measure || "unit(s)"}`}
                                  readOnly
                                  style={lockedInputStyles}
                                />
                              </div>
                              <div>
                                <label style={labelStyles}>
                                  {isPackItemPerishable
                                    ? "Expiration Date"
                                    : "Expiration Date (If Applicable)"}
                                </label>
                                <input
                                  type="date"
                                  value={packItem.expiration_date || ""}
                                  onChange={(event) =>
                                    onReliefPackDraftItemChange(
                                      packItemKey,
                                      "expiration_date",
                                      event.target.value,
                                    )
                                  }
                                  style={inputStyles}
                                  aria-invalid={Boolean(expirationDateError)}
                                />
                                {expirationDateError ? (
                                  <p style={fieldErrorTextStyles}>{expirationDateError}</p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "12px",
                        marginTop: "4px",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        onClick={onCancelEditItem}
                        style={pageHeaderStyles.secondaryButton}
                      >
                        Cancel Item Edit
                      </button>
                      <button
                        type="button"
                        onClick={onEditExistingItem}
                        style={{
                          ...pageHeaderStyles.primaryButton,
                          minHeight: "48px",
                        }}
                      >
                        Save Relief Pack
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                  <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "16px",
                  }}
                >
                  <div>
                    <label htmlFor="pack_item_entry_method" style={labelStyles}>
                      Item Entry Method
                    </label>
                    <select
                      id="pack_item_entry_method"
                      value={itemDraft.item_entry_method || "MANUAL"}
                      onChange={(event) =>
                        onItemDraftChange("item_entry_method", event.target.value)
                      }
                      style={inputStyles}
                    >
                      <option value="MANUAL">Manual Search</option>
                      <option value="BARCODE">Barcode</option>
                    </select>
                  </div>

                  {itemDraft.item_entry_method === "BARCODE" ? (
                    <div>
                      <label htmlFor="pack_item_barcode" style={labelStyles}>
                        Barcode Number
                      </label>
                      <input
                        id="pack_item_barcode"
                        value={itemDraft.barcode || ""}
                        onChange={(event) =>
                          onItemDraftChange("barcode", event.target.value)
                        }
                        style={lockStockFormFields ? lockedInputStyles : inputStyles}
                        disabled={lockStockFormFields}
                        placeholder="Scan or enter barcode"
                        aria-invalid={Boolean(itemFieldErrors.barcode)}
                      />
                      {itemFieldErrors.barcode ? (
                        <p style={fieldErrorTextStyles}>{itemFieldErrors.barcode}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <div>
                    <label htmlFor="pack_item_name" style={labelStyles}>
                      Inventory Item
                    </label>
                    <div style={autocompleteStyles.wrap}>
                      <input
                        ref={itemNameInputRef}
                        id="pack_item_name"
                        value={itemDraft.new_item_name}
                        onChange={(event) => {
                          onItemDraftChange("new_item_name", event.target.value);
                          setIsAutocompleteOpen(Boolean(event.target.value.trim()));
                        }}
                        onFocus={() => {
                          if (inventorySearchSuggestions.length > 0) {
                            setIsAutocompleteOpen(true);
                          }
                        }}
                        style={lockIdentityFields ? lockedInputStyles : inputStyles}
                        disabled={lockIdentityFields}
                        placeholder="Search inventory item or enter a new item name"
                        aria-invalid={Boolean(itemFieldErrors.new_item_name)}
                      />

                      {isAutocompleteOpen && inventorySearchSuggestions.length > 0 ? (
                        <ul ref={autocompleteRef} style={autocompleteStyles.list}>
                          {inventorySearchSuggestions.map((suggestion) => (
                            <li key={suggestion.key}>
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectExistingInventoryItem(suggestion);
                                  setIsAutocompleteOpen(false);
                                }}
                                style={autocompleteStyles.itemButton}
                              >
                                {suggestion.item.item_name}
                                <span style={autocompleteStyles.itemMeta}>
                                  {suggestion.meta}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {itemFieldErrors.new_item_name ? (
                        <p style={fieldErrorTextStyles}>{itemFieldErrors.new_item_name}</p>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="pack_item_category" style={labelStyles}>
                      Category
                    </label>
                    <select
                      id="pack_item_category"
                      value={itemDraft.new_item_category}
                      onChange={(event) =>
                        onItemDraftChange("new_item_category", event.target.value)
                      }
                      style={lockIdentityFields ? lockedInputStyles : inputStyles}
                      disabled={lockIdentityFields}
                      aria-invalid={Boolean(itemFieldErrors.new_item_category)}
                    >
                      {categoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {itemFieldErrors.new_item_category ? (
                      <p style={fieldErrorTextStyles}>{itemFieldErrors.new_item_category}</p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor="pack_item_tracking_method" style={labelStyles}>
                      Tracking Method
                    </label>
                    <select
                      id="pack_item_tracking_method"
                      value={trackingMethod}
                      onChange={(event) =>
                        onItemDraftChange(
                          "new_item_tracking_method",
                          event.target.value,
                        )
                      }
                      style={lockIdentityFields ? lockedInputStyles : inputStyles}
                      disabled={lockIdentityFields}
                      aria-invalid={Boolean(itemFieldErrors.new_item_tracking_method)}
                    >
                      <option value="Count-Based">Count-Based</option>
                      <option value="Weight/Volume-Based">Weight/Volume-Based</option>
                    </select>
                    {itemFieldErrors.new_item_tracking_method ? (
                      <p style={fieldErrorTextStyles}>
                        {itemFieldErrors.new_item_tracking_method}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor="pack_item_unit" style={labelStyles}>
                      {usesWeightOrVolume ? "Base Unit" : "Unit of Measure"}
                    </label>
                    <select
                      id="pack_item_unit"
                      value={itemDraft.new_item_unit_of_measure}
                      onChange={(event) =>
                        onItemDraftChange("new_item_unit_of_measure", event.target.value)
                      }
                      style={lockIdentityFields ? lockedInputStyles : inputStyles}
                      disabled={lockIdentityFields}
                      aria-invalid={Boolean(itemFieldErrors.new_item_unit_of_measure)}
                    >
                      {usesWeightOrVolume ? (
                        <>
                          <option value="">Select base unit</option>
                          {unitOptions.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </>
                      ) : (
                        <option value="pc">pc</option>
                      )}
                    </select>
                    {itemFieldErrors.new_item_unit_of_measure ? (
                      <p style={fieldErrorTextStyles}>
                        {itemFieldErrors.new_item_unit_of_measure}
                      </p>
                    ) : null}
                  </div>

                  {usesWeightOrVolume ? (
                    <div>
                      <label
                        htmlFor="pack_item_unit_of_measure_value"
                        style={labelStyles}
                      >
                        Amount per Piece/Container
                      </label>
                      <input
                        id="pack_item_unit_of_measure_value"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={itemDraft.new_item_unit_of_measure_value}
                        onChange={(event) =>
                          onItemDraftChange(
                            "new_item_unit_of_measure_value",
                            event.target.value,
                          )
                        }
                        style={lockIdentityFields ? lockedInputStyles : inputStyles}
                        disabled={lockIdentityFields}
                        placeholder={`Example: 25 ${itemDraft.new_item_unit_of_measure || "kg"} per piece/container`}
                        aria-invalid={Boolean(
                          itemFieldErrors.new_item_unit_of_measure_value,
                        )}
                      />
                      {itemFieldErrors.new_item_unit_of_measure_value ? (
                        <p style={fieldErrorTextStyles}>
                          {itemFieldErrors.new_item_unit_of_measure_value}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div>
                    <label htmlFor="pack_item_packaging" style={labelStyles}>
                      Packaging
                    </label>
                    <select
                      id="pack_item_packaging"
                      value={itemDraft.new_item_packaging}
                      onChange={(event) =>
                        onItemDraftChange("new_item_packaging", event.target.value)
                      }
                      style={lockStockFormFields ? lockedInputStyles : inputStyles}
                      disabled={lockStockFormFields}
                      aria-invalid={Boolean(itemFieldErrors.new_item_packaging)}
                    >
                      <option value="">Select packaging</option>
                      {packagingOptions.map((packaging) => (
                        <option key={packaging} value={packaging}>
                          {packaging}
                        </option>
                      ))}
                    </select>
                    {itemFieldErrors.new_item_packaging ? (
                      <p style={fieldErrorTextStyles}>
                        {itemFieldErrors.new_item_packaging}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor="pack_item_quantity_required" style={labelStyles}>
                      Quantity per Relief Pack
                    </label>
                    <input
                      id="pack_item_quantity_required"
                      type="number"
                      min="1"
                      value={itemDraft.pack_item_quantity_required}
                      onChange={(event) =>
                        onItemDraftChange(
                          "pack_item_quantity_required",
                          event.target.value,
                        )
                      }
                      style={inputStyles}
                      placeholder={quantityOnHandPlaceholder}
                      aria-invalid={Boolean(itemFieldErrors.pack_item_quantity_required)}
                    />
                    {itemFieldErrors.pack_item_quantity_required ? (
                      <p style={fieldErrorTextStyles}>
                        {itemFieldErrors.pack_item_quantity_required}
                      </p>
                    ) : null}
                  </div>

                  {shouldShowUnitsPerPackagingField ? (
                    <div>
                      <label htmlFor="pack_item_units_per_packaging" style={labelStyles}>
                        {unitsPerPackagingLabel}
                      </label>
                      <input
                        id="pack_item_units_per_packaging"
                        type="number"
                        min="1"
                        value={itemDraft.units_per_packaging}
                        onChange={(event) =>
                          onItemDraftChange("units_per_packaging", event.target.value)
                        }
                        style={lockStockFormFields ? lockedInputStyles : inputStyles}
                        disabled={lockStockFormFields}
                        placeholder={unitsPerPackagingPlaceholder}
                        aria-invalid={Boolean(itemFieldErrors.units_per_packaging)}
                      />
                      {itemFieldErrors.units_per_packaging ? (
                        <p style={fieldErrorTextStyles}>
                          {itemFieldErrors.units_per_packaging}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div>
                    <label htmlFor="pack_item_expiration_date" style={labelStyles}>
                      {isLooseItemPerishable
                        ? "Expiration Date"
                        : "Expiration Date (If Applicable)"}
                    </label>
                    <input
                      id="pack_item_expiration_date"
                      type="date"
                      value={itemDraft.expiration_date}
                      onChange={(event) =>
                        onItemDraftChange("expiration_date", event.target.value)
                      }
                      style={inputStyles}
                      aria-invalid={Boolean(itemFieldErrors.expiration_date)}
                    />
                    {itemFieldErrors.expiration_date ? (
                      <p style={fieldErrorTextStyles}>{itemFieldErrors.expiration_date}</p>
                    ) : null}
                  </div>

                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "12px",
                    marginTop: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  {editingItemId ? (
                    <button
                      type="button"
                      onClick={onCancelEditItem}
                      style={pageHeaderStyles.secondaryButton}
                    >
                      Cancel Item Edit
                    </button>
                  ) : selectedExistingInventoryItem ? (
                    <button
                      type="button"
                      onClick={onClearSelectedExistingInventoryItem}
                      style={pageHeaderStyles.secondaryButton}
                    >
                      Cancel Selected Item
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onAddPackItemDraft}
                    style={{
                      ...pageHeaderStyles.primaryButton,
                      minHeight: "48px",
                    }}
                  >
                    + Add Item to Pack
                  </button>
                  </div>
                  </>
                )}

              </div>
            ) : null}

                {showDonationItemBuilder && isAddingReliefPack && isDefiningNewPack ? (
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "14px 16px",
                      borderRadius: "14px",
                      backgroundColor: "#f8fbff",
                      border: "1px solid #dbe6f0",
                    }}
                  >
                    <strong style={{ color: "#17324d" }}>{selectedReliefPackName}</strong>
                    {selectedReliefPackItems.length === 0 ? (
                      <p style={{ margin: "8px 0 0", color: "#60738a", fontSize: "14px" }}>
                        No items have been added to this relief pack yet.
                      </p>
                    ) : (
                      <div style={{ display: "grid", gap: "12px", marginTop: "10px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {selectedReliefPackItems.map((templateItem) => (
                            <span
                              key={templateItem.draft_id || templateItem.item_name}
                              style={{
                                borderRadius: "999px",
                                backgroundColor: "#ffffff",
                                border: "1px solid #dbe6f0",
                                padding: "7px 10px",
                                color: "#2f4e6d",
                                fontSize: "13px",
                                fontWeight: 700,
                              }}
                            >
                              {getReliefPackItemName(templateItem)} x{" "}
                              {getReliefPackItemQuantityPerPack(templateItem)} per relief pack
                              {selectedPackQuantity > 0
                                ? ` | ${getReliefPackItemTotal(
                                    templateItem,
                                    selectedPackQuantity,
                                  )} total`
                                : ""}
                              {isDefiningNewPack ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onRemovePackItemDraft(
                                      templateItem.draft_id || templateItem.item_name,
                                    )
                                  }
                                  style={{
                                    marginLeft: "8px",
                                    border: "none",
                                    background: "transparent",
                                    color: "#6b8298",
                                    cursor: "pointer",
                                    fontWeight: 800,
                                  }}
                                  aria-label={`Remove ${
                                    getReliefPackItemName(templateItem)
                                  }`}
                                >
                                  x
                                </button>
                              ) : null}
                            </span>
                          ))}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: "12px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            onClick={editingItemId ? onEditExistingItem : onAddItemDraft}
                            style={{
                              ...pageHeaderStyles.primaryButton,
                              minHeight: "48px",
                            }}
                          >
                            {editingItemId ? "Save Relief Pack" : "+ Add Relief Pack"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}

            {donationItemGroups.length > 0 ? (
              <div
                style={{
                  marginTop: "18px",
                  display: "grid",
                  gap: "12px",
                }}
              >
                <h4 style={{ margin: 0, color: "#17324d", fontSize: "16px" }}>
                  Items Added to This Donation
                </h4>
                {donationItemGroups.map((group) => (
                  <div
                    key={group.key}
                    style={{
                      ...summaryCardStyles,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "16px",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "grid", gap: "6px" }}>
                      {group.type === "pack" ? (
                        <>
                          <strong style={{ color: "#17324d" }}>
                            {group.title}
                          </strong>
                          {group.subtitle ? (
                            <span style={{ color: "#60738a", fontSize: "14px" }}>
                              {group.subtitle}
                            </span>
                          ) : null}
                          {group.supportingText ? (
                            <span style={{ color: "#60738a", fontSize: "14px" }}>
                              {group.supportingText}
                            </span>
                          ) : null}
                          <div
                            style={{
                              display: "grid",
                              gap: "8px",
                              marginTop: "4px",
                            }}
                          >
                            {group.lines.map((line) => (
                              <div
                                key={line.key}
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "8px",
                                  color: "#2f4e6d",
                                  fontSize: "14px",
                                }}
                              >
                                <span style={{ fontWeight: 700 }}>{line.label}</span>
                                <span style={{ color: "#60738a" }}>
                                  - {line.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <strong style={{ color: "#17324d" }}>
                            {group.title}
                          </strong>
                          <span style={{ color: "#60738a", fontSize: "14px" }}>
                            {group.supportingText}
                          </span>
                        </>
                      )}
                    </div>

                    {isEditingDonation && group.sourceItem?.id ? (
                      <button
                        type="button"
                        onClick={() => onStartEditItem(group.sourceItem)}
                        style={{
                          ...pageHeaderStyles.secondaryButton,
                          minWidth: "44px",
                          width: "44px",
                          height: "44px",
                          padding: 0,
                          borderRadius: "14px",
                        }}
                        title="Edit"
                        aria-label="Edit"
                      >
                        <FiEdit2 size={16} />
                      </button>
                    ) : group.canRemove ? (
                      <button
                        type="button"
                        onClick={() => onRemoveDraftItem(group.sourceItem)}
                        style={pageHeaderStyles.secondaryButton}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {showDonationItemBuilder && itemErrorMessage ? (
              <div
                style={{
                  marginTop: "16px",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  backgroundColor: "#fff3f1",
                  border: "1px solid #f1d2cc",
                  color: "#9d4d58",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                {itemErrorMessage}
              </div>
            ) : null}

            {showDonationItemBuilder && itemFieldErrors.relief_pack_items ? (
              <p style={fieldErrorTextStyles}>{itemFieldErrors.relief_pack_items}</p>
            ) : null}

            {!isEditingDonation && fieldErrors.items ? (
              <p style={fieldErrorTextStyles}>{fieldErrors.items}</p>
            ) : null}

          </section>

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
            <button type="button" onClick={onClose} style={pageHeaderStyles.secondaryButton}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ ...pageHeaderStyles.primaryButton, opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting
                ? "Saving..."
                : isEditingDonation
                  ? "Edit Donation"
                  : "Add Donation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DonationModal;

