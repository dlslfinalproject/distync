const pool = require("../config/db");
const crypto = require("crypto");
const donationRepository = require("../repositories/donation.repository");
const inventoryItemRepository = require("../repositories/inventoryItem.repository");
const inventoryBatchRepository = require("../repositories/inventoryBatch.repository");
const inventoryItemStockFormRepository = require("../repositories/inventoryItemStockForm.repository");
const forecastService = require("./forecast.service");
const mayorReportExport = require("../utils/mayorReportExport");
const notificationService = require("../modules/notifications/notification.service");
const {
  logAuditSafely,
  pickDefined,
  normalizeActor,
} = require("../utils/systemLog");
const systemLogRepository = require("../repositories/systemLog.repository");

const buildFullName = (firstName, lastName) => {
  return [firstName, lastName].filter(Boolean).join(" ");
};

const priorityRank = {
  URGENT: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

const canonicalDonorTypes = new Set([
  "INDIVIDUAL",
  "NGO",
  "PRIVATE_ORGANIZATION",
  "GOVERNMENT_PARTNER",
  "OTHER",
]);
const legacyDonorTypeMap = {
  "PRIVATE ORGANIZATION": "PRIVATE_ORGANIZATION",
  "GOVERNMENT PARTNER": "GOVERNMENT_PARTNER",
};

const normalizeDonationDonorType = (value) => {
  const normalizedValue = String(value || "").trim().toUpperCase();
  return legacyDonorTypeMap[normalizedValue] || normalizedValue;
};

const ensureValidDonationDonorType = (value) => {
  const normalizedDonorType = normalizeDonationDonorType(value);

  if (!canonicalDonorTypes.has(normalizedDonorType)) {
    const error = new Error("Please select a valid donor type.");
    error.statusCode = 400;
    throw error;
  }

  return normalizedDonorType;
};

const normalizeDonationOtherDonorType = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmedValue = String(value).trim();
  return trimmedValue || null;
};

const normalizeDonationDonorName = (value) => String(value || "").trim().toLowerCase();

const neededItemSourceMeta = {
  FORECAST: {
    title: "Forecasted Donation Needs",
    description:
      "These recommendations are generated from DISTYNC's inventory forecasting using the latest available disaster response and inventory data.",
    notice:
      "Suggested donation quantities are generated using the system's forecasting module based on disaster impact, affected population, historical relief distribution, and inventory data. These values are recommendations only and may change when a new forecast is generated.",
  },
  DEFAULT_EMERGENCY: {
    title: "Emergency Donation Needs",
    description:
      "These recommendations are based on the municipality's standard disaster preparedness guidelines while operational data is still being collected.",
    notice:
      "These items are preparedness recommendations, not forecast quantities. They help donors identify commonly needed relief goods before enough operational data is available for forecasting.",
  },
  PUBLISHED_NEEDS: {
    title: "Published Donation Needs",
    description:
      "These recommendations are based on manually published donation needs for the active relief operations.",
    notice:
      "These items were published by authorized LGU users while forecast recommendations are not available.",
  },
  EMPTY: {
    title: "Emergency Donation Needs",
    description:
      "Donation recommendations will appear when preparedness defaults, published needs, or forecast results are available.",
    notice:
      "No public donation suggestions are available yet for the active relief operations.",
  },
};

const createPublicKey = (prefix, value) =>
  `${prefix}-${crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex")
    .slice(0, 16)}`;

const buildGoogleMapsSearchUrl = (locationName, addressLines) => {
  const query = [locationName, ...addressLines].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

const getPublicContactConfig = () => {
  const locationName =
    process.env.PUBLIC_DONATION_LOCATION_NAME || "Municipal Hall of Malvar";
  const addressLines = [
    process.env.PUBLIC_DONATION_ADDRESS_LINE_1 || "J. Leviste Street",
    process.env.PUBLIC_DONATION_ADDRESS_LINE_2 ||
      "Poblacion, Malvar, Batangas 4233",
  ].filter(Boolean);

  return {
    system_name: "DISTYNC",
    municipality: "Municipality of Malvar, Batangas",
    drop_off: {
      location_name: locationName,
      address_lines: addressLines,
      office_lines: [
        process.env.PUBLIC_DONATION_OFFICE_LINE_1 ||
          "Office of the Municipal Mayor",
        process.env.PUBLIC_DONATION_OFFICE_LINE_2 ||
          "Donation Coordination Desk",
      ].filter(Boolean),
      receiving_hours: [
        process.env.PUBLIC_DONATION_RECEIVING_DAYS || "Monday-Friday",
        process.env.PUBLIC_DONATION_RECEIVING_TIME || "8:00 AM-5:00 PM",
      ].filter(Boolean),
      phone: process.env.PUBLIC_DONATION_PHONE || "+63 43 778 5101",
      email:
        process.env.PUBLIC_DONATION_EMAIL || "lgumalvarbatangas@gmail.com",
      maps_url:
        process.env.PUBLIC_DONATION_MAPS_URL ||
        buildGoogleMapsSearchUrl(locationName, addressLines),
    },
    notices: {
      privacy:
        "Public information is aggregated and does not include private beneficiary records.",
      in_kind_only:
        "DISTYNC provides information for in-kind relief donations only. Cash donations and online payments are not processed through this portal.",
    },
  };
};

const mapDonationNeed = (row) => {
  return {
    id: row.id,
    disaster_event_id: row.disaster_event_id,
    inventory_item_id: row.inventory_item_id,
    quantity_needed: row.quantity_needed,
    priority_level: row.priority_level,
    notes: row.notes,
    is_active: row.is_active,
    published_by: row.published_by,
    published_at: row.published_at,
    updated_at: row.updated_at,
    disaster_event: {
      id: row.disaster_event_id,
      event_code: row.event_code,
      title: row.disaster_event_title,
    },
    inventory_item: {
      id: row.inventory_item_id,
      item_code: row.item_code,
      item_name: row.item_name,
      category: row.category,
      unit_of_measure: row.unit_of_measure,
    },
    publisher: row.published_by
      ? {
          id: row.published_by,
          full_name: buildFullName(
            row.published_by_first_name,
            row.published_by_last_name,
          ),
        }
      : null,
  };
};

const mapDonationItem = (row) => {
  return {
    id: row.id,
    donation_id: row.donation_id,
    inventory_item_id: row.inventory_item_id,
    inventory_batch_id: row.inventory_batch_id,
    quantity_received: row.quantity_received,
    remarks: row.remarks,
    created_at: row.created_at,
    updated_at: row.updated_at,
    inventory_item: {
      id: row.inventory_item_id,
      item_code: row.item_code,
      item_name: row.item_name,
      category: row.category,
      unit_of_measure: row.unit_of_measure,
    },
    inventory_batch: row.inventory_batch_id
      ? {
          id: row.inventory_batch_id,
          inventory_item_stock_form_id: row.inventory_item_stock_form_id,
          batch_no: row.batch_no,
          source_type: row.source_type,
          quantity_available: row.quantity_available,
          expiration_date: row.expiration_date,
          storage_location: row.storage_location,
          stock_form_barcode: row.stock_form_barcode,
          stock_form_packaging: row.stock_form_packaging,
          stock_form_units_per_packaging: row.stock_form_units_per_packaging,
          stock_form_unit_of_measure: row.stock_form_unit_of_measure,
          stock_form_unit_of_measure_value: row.stock_form_unit_of_measure_value,
        }
      : null,
    inventory_item_stock_form: row.inventory_item_stock_form_id
      ? {
          id: row.inventory_item_stock_form_id,
          barcode: row.stock_form_barcode,
          packaging: row.stock_form_packaging,
          units_per_packaging: row.stock_form_units_per_packaging,
          unit_of_measure: row.stock_form_unit_of_measure,
          unit_of_measure_value: row.stock_form_unit_of_measure_value,
        }
      : null,
  };
};

const mapDonation = (row, items = []) => {
  return {
    id: row.id,
    disaster_event_id: row.disaster_event_id,
    donor_name: row.donor_name,
    donor_type: row.donor_type,
    donor_type_other: row.donor_type_other,
    contact_information: row.contact_information,
    received_by: row.received_by,
    received_at: row.received_at,
    status: row.status,
    remarks: row.remarks,
    created_at: row.created_at,
    updated_at: row.updated_at,
    disaster_event: {
      id: row.disaster_event_id,
      event_code: row.event_code,
      title: row.disaster_event_title,
    },
    receiver: row.received_by
      ? {
          id: row.received_by,
          full_name: buildFullName(
            row.received_by_first_name,
            row.received_by_last_name,
          ),
        }
      : null,
    items,
    item_count: items.length,
    total_quantity_received: items.reduce(
      (total, item) => total + Number(item.quantity_received || 0),
      0,
    ),
  };
};

const summarizeDonation = (donation) =>
  pickDefined(donation, [
    "disaster_event_id",
    "donor_name",
    "donor_type",
    "donor_type_other",
    "contact_information",
    "received_by",
    "received_at",
    "status",
    "remarks",
    "item_count",
    "total_quantity_received",
  ]);

const summarizeDonationItem = (donationItem) => ({
  ...pickDefined(donationItem, [
    "donation_id",
    "inventory_item_id",
    "inventory_batch_id",
    "quantity_received",
    "remarks",
  ]),
  ...pickDefined(donationItem?.inventory_item || {}, ["item_name", "category"]),
  ...pickDefined(donationItem?.inventory_batch || {}, [
    "batch_no",
    "expiration_date",
    "quantity_available",
  ]),
});

const summarizeDonationInventoryBatch = (batch) =>
  pickDefined(batch, [
    "inventory_item_id",
    "batch_no",
    "source_type",
    "quantity_received",
    "quantity_available",
    "expiration_date",
    "received_at",
    "storage_location",
    "status",
    "created_by",
  ]);

const summarizeDonationInventoryTransaction = (transaction) =>
  pickDefined(transaction, [
    "disaster_event_id",
    "inventory_batch_id",
    "transaction_type",
    "quantity",
    "reference_type",
    "reference_id",
    "performed_by",
    "performed_at",
    "remarks",
  ]);

const mapAuditLogRow = (row) => ({
  id: row.id,
  action: row.action,
  entity_type: row.entity_type,
  entity_id: row.entity_id,
  role_code: row.role_code,
  created_at: row.created_at,
  actor_name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.email || "Unknown User",
  old_values_json: row.old_values_json || {},
  new_values_json: row.new_values_json || {},
});

const resolvePublicDonorName = (donorName, index) => {
  const trimmedDonorName = String(donorName || "").trim();

  if (/anonymous|anon/i.test(trimmedDonorName)) {
    return "Anonymous Donor";
  }

  return `Donor #${index + 1}`;
};

const mapPublicDisasterSummary = (row) => ({
  public_key: createPublicKey("event", row.id),
  event_code: row.event_code,
  title: row.title,
  disaster_type: row.disaster_type,
  description: row.description,
  start_date: row.start_date,
  end_date: row.end_date,
  status: row.status,
  created_at: row.created_at,
  updated_at: row.updated_at,
  affected_barangays: Array.isArray(row.affected_barangays)
    ? row.affected_barangays.map((barangay) => ({
        public_key: createPublicKey("barangay", barangay.id || barangay.name),
        name: barangay.name,
      }))
    : [],
  affected_barangays_count: Number(row.affected_barangays_count || 0),
  registered_households_count: Number(row.registered_households_count || 0),
  affected_individuals_count: Number(row.affected_individuals_count || 0),
});

const mapPublicDonationSummary = (row, index) => ({
  public_key: row.public_key || `donation-${index + 1}`,
  donor_name: resolvePublicDonorName(row.donor_name, index),
  donor_type: row.donor_type || "OTHER",
  recipient_barangay: row.recipient_barangay_name || "Not specified",
  donation_date: row.received_at,
  status: row.status,
  item_count: Number(row.item_count || 0),
  total_quantity_received: Number(row.total_quantity_received || 0),
  items: Array.isArray(row.items)
    ? row.items.map((item) => ({
        item_name: item.item_name || "Donation item",
        quantity_received: Number(item.quantity_received || 0),
        unit_of_measure: item.unit_of_measure || "items",
      }))
    : [],
});

const combinePublicForecastSuggestions = (latestForecasts) => {
  const combinedSuggestions = new Map();

  latestForecasts
    .filter(Boolean)
    .flatMap((forecast) => forecastService.buildPublicForecastSuggestions(forecast))
    .forEach((suggestion) => {
      const suggestionKey =
        suggestion.public_key ||
        `${suggestion.item_name || "item"}:${suggestion.unit_of_measure || "items"}`;
      const existingSuggestion = combinedSuggestions.get(suggestionKey);

      if (!existingSuggestion) {
        combinedSuggestions.set(suggestionKey, { ...suggestion });
        return;
      }

      const existingPriorityRank =
        priorityRank[existingSuggestion.priority_level] || priorityRank.LOW;
      const incomingPriorityRank =
        priorityRank[suggestion.priority_level] || priorityRank.LOW;
      const latestForecastedAt =
        new Date(suggestion.forecasted_at || 0).getTime() >
        new Date(existingSuggestion.forecasted_at || 0).getTime()
          ? suggestion.forecasted_at
          : existingSuggestion.forecasted_at;

      combinedSuggestions.set(suggestionKey, {
        ...existingSuggestion,
        suggested_quantity:
          Number(existingSuggestion.suggested_quantity || 0) +
          Number(suggestion.suggested_quantity || 0),
        priority_level:
          incomingPriorityRank < existingPriorityRank
            ? suggestion.priority_level
            : existingSuggestion.priority_level,
        note: "Combined recommendation across active relief operations.",
        forecasted_at: latestForecastedAt,
      });
    });

  return Array.from(combinedSuggestions.values()).sort((left, right) => {
    const priorityDifference =
      (priorityRank[left.priority_level] || priorityRank.LOW) -
      (priorityRank[right.priority_level] || priorityRank.LOW);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const quantityDifference =
      Number(right.suggested_quantity || 0) -
      Number(left.suggested_quantity || 0);

    if (quantityDifference !== 0) {
      return quantityDifference;
    }

    return String(left.item_name || "").localeCompare(
      String(right.item_name || ""),
    );
  });
};

const resolvePublicDonationNeedPriority = (priorityLevel) => {
  const normalizedPriorityLevel = String(priorityLevel || "").toUpperCase();

  if (normalizedPriorityLevel === "URGENT" || normalizedPriorityLevel === "HIGH") {
    return "HIGH";
  }

  if (normalizedPriorityLevel === "MEDIUM") {
    return "MEDIUM";
  }

  return "LOW";
};

const buildPublicDonationNeedSuggestions = (donationNeeds) => {
  const combinedNeeds = new Map();

  (donationNeeds || []).forEach((need) => {
    const quantityNeeded = Math.max(0, Number(need.quantity_needed || 0));

    if (quantityNeeded <= 0 || !need.inventory_item?.item_name) {
      return;
    }

    const itemKey =
      need.inventory_item?.id ||
      `${need.inventory_item.item_name}:${need.inventory_item.unit_of_measure}`;
    const existingNeed = combinedNeeds.get(itemKey);
    const priorityLevel = resolvePublicDonationNeedPriority(need.priority_level);

    if (!existingNeed) {
      combinedNeeds.set(itemKey, {
        public_key: createPublicKey("published-need-item", itemKey),
        item_name: need.inventory_item.item_name,
        category: need.inventory_item.category,
        unit_of_measure: need.inventory_item.unit_of_measure || "items",
        suggested_quantity: Math.ceil(quantityNeeded),
        priority_level: priorityLevel,
        note:
          "Published donation need shown while forecast recommendations are not available.",
        forecasted_at: need.updated_at || need.published_at || null,
      });
      return;
    }

    const existingPriorityRank =
      priorityRank[existingNeed.priority_level] || priorityRank.LOW;
    const incomingPriorityRank = priorityRank[priorityLevel] || priorityRank.LOW;
    const latestUpdatedAt =
      new Date(need.updated_at || need.published_at || 0).getTime() >
      new Date(existingNeed.forecasted_at || 0).getTime()
        ? need.updated_at || need.published_at || null
        : existingNeed.forecasted_at;

    combinedNeeds.set(itemKey, {
      ...existingNeed,
      suggested_quantity:
        Number(existingNeed.suggested_quantity || 0) + Math.ceil(quantityNeeded),
      priority_level:
        incomingPriorityRank < existingPriorityRank
          ? priorityLevel
          : existingNeed.priority_level,
      forecasted_at: latestUpdatedAt,
    });
  });

  return Array.from(combinedNeeds.values()).sort((left, right) => {
    const priorityDifference =
      (priorityRank[left.priority_level] || priorityRank.LOW) -
      (priorityRank[right.priority_level] || priorityRank.LOW);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const quantityDifference =
      Number(right.suggested_quantity || 0) -
      Number(left.suggested_quantity || 0);

    if (quantityDifference !== 0) {
      return quantityDifference;
    }

    return String(left.item_name || "").localeCompare(
      String(right.item_name || ""),
    );
  });
};

const buildDefaultEmergencySuggestions = (defaultNeeds) => {
  const combinedDefaults = new Map();

  (defaultNeeds || []).forEach((need) => {
    if (!need.item_name) {
      return;
    }

    const itemKey =
      need.inventory_item_id ||
      `${need.item_name}:${need.unit_of_measure || "items"}`;
    const existingDefault = combinedDefaults.get(itemKey);
    const priorityLevel = resolvePublicDonationNeedPriority(need.priority_level);
    const suggestedQuantity =
      need.suggested_quantity === null || need.suggested_quantity === undefined
        ? null
        : Math.max(0, Number(need.suggested_quantity || 0));

    if (existingDefault) {
      return;
    }

    combinedDefaults.set(itemKey, {
      public_key: createPublicKey("default-emergency-item", itemKey),
      item_name: need.item_name,
      category: need.category,
      unit_of_measure: need.unit_of_measure || "items",
      suggested_quantity: suggestedQuantity,
      priority_level: priorityLevel,
      note: need.notes || "Standard emergency preparedness item.",
      forecasted_at: need.updated_at || null,
    });
  });

  return Array.from(combinedDefaults.values()).sort((left, right) => {
    const priorityDifference =
      (priorityRank[left.priority_level] || priorityRank.LOW) -
      (priorityRank[right.priority_level] || priorityRank.LOW);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return String(left.item_name || "").localeCompare(
      String(right.item_name || ""),
    );
  });
};

const buildNeededItemsPayload = (sourceType, suggestions) => {
  const resolvedSourceType = neededItemSourceMeta[sourceType]
    ? sourceType
    : "EMPTY";
  const meta = neededItemSourceMeta[resolvedSourceType];

  return {
    source_type: resolvedSourceType,
    title: meta.title,
    description: meta.description,
    notice: meta.notice,
    suggestions: suggestions || [],
  };
};

const resolvePublicNeededItems = ({
  latestForecasts,
  defaultEmergencyNeeds,
  publicDonationNeeds,
}) => {
  const forecastSuggestions = combinePublicForecastSuggestions(latestForecasts);

  if (forecastSuggestions.length > 0) {
    return buildNeededItemsPayload("FORECAST", forecastSuggestions);
  }

  const defaultEmergencySuggestions =
    buildDefaultEmergencySuggestions(defaultEmergencyNeeds);

  if (defaultEmergencySuggestions.length > 0) {
    return buildNeededItemsPayload(
      "DEFAULT_EMERGENCY",
      defaultEmergencySuggestions,
    );
  }

  const publishedNeedSuggestions =
    buildPublicDonationNeedSuggestions(publicDonationNeeds);

  if (publishedNeedSuggestions.length > 0) {
    return buildNeededItemsPayload("PUBLISHED_NEEDS", publishedNeedSuggestions);
  }

  return buildNeededItemsPayload("EMPTY", []);
};

const getBatchStatus = (expirationDate, quantityAvailable) => {
  if (expirationDate) {
    const today = new Date();
    const todayDateOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const parsedExpiration = new Date(expirationDate);

    if (parsedExpiration < todayDateOnly) {
      return "EXPIRED";
    }
  }

  if (quantityAvailable === 0) {
    return "DEPLETED";
  }

  if (quantityAvailable > 0 && quantityAvailable <= 10) {
    return "LOW_STOCK";
  }

  return "AVAILABLE";
};

const buildUpdatedItemStockSnapshot = (inventoryItem, onHandQuantity) => {
  const normalizedOnHandQuantity = Math.max(Number(onHandQuantity || 0), 0);
  const normalizedPackaging = String(inventoryItem?.packaging || "").toLowerCase();
  const unitsPerPackage = Number(inventoryItem?.quantity || 0);
  const existingPackagingCount = Number(inventoryItem?.packaging_count || 0);

  if (normalizedPackaging === "piece" || unitsPerPackage <= 1) {
    return {
      quantity: 1,
      packaging_count:
        normalizedOnHandQuantity > 0 ? normalizedOnHandQuantity : null,
    };
  }

  if (normalizedOnHandQuantity === 0) {
    return {
      quantity: inventoryItem?.quantity || null,
      packaging_count: null,
    };
  }

  if (normalizedOnHandQuantity % unitsPerPackage === 0) {
    return {
      quantity: inventoryItem?.quantity || null,
      packaging_count: normalizedOnHandQuantity / unitsPerPackage,
    };
  }

  return {
    quantity: inventoryItem?.quantity || null,
    packaging_count: existingPackagingCount > 0 ? existingPackagingCount : null,
  };
};

const refreshInventoryItemStockSnapshot = async (inventoryItemId, dbClient) => {
  const inventoryItem = await inventoryItemRepository.getInventoryItemByIdForUpdate(
    inventoryItemId,
    dbClient,
  );

  if (!inventoryItem) {
    return null;
  }

  const recomputedQuantityResult = await dbClient.query(
    `
      SELECT COALESCE(SUM(quantity_available), 0)::integer AS total_quantity
      FROM inventory_batches
      WHERE inventory_item_id = $1
    `,
    [inventoryItemId],
  );

  const nextItemQuantity = Number(
    recomputedQuantityResult.rows[0]?.total_quantity || 0,
  );

  return inventoryItemRepository.updateInventoryItemStockSnapshot(
    inventoryItemId,
    buildUpdatedItemStockSnapshot(inventoryItem, nextItemQuantity),
    dbClient,
  );
};

const buildDonationBatchPrefix = (inventoryItem) => {
  const normalizedItemCode = String(
    inventoryItem?.item_code || inventoryItem?.id || "ITEM",
  )
    .replace(/[^A-Z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();

  return `DON-${normalizedItemCode}-BATCH-`;
};

const buildDonationBatchNumber = async ({ inventoryItem, dbClient }) => {
  const batchPrefix = buildDonationBatchPrefix(inventoryItem);
  const result = await dbClient.query(
    `
      SELECT batch_no
      FROM inventory_batches
      WHERE inventory_item_id = $1
        AND source_type = 'DONATED'
        AND batch_no ILIKE 'DON-%'
    `,
    [inventoryItem.id],
  );

  const existingSequences = result.rows
    .map((row) => {
      const batchNumber = String(row?.batch_no || "").toUpperCase();
      const matchedSequence = batchNumber.match(/-BATCH-(\d+)$/);
      const parsedValue = matchedSequence ? Number(matchedSequence[1]) : null;
      return Number.isInteger(parsedValue) && parsedValue > 0
        ? parsedValue
        : null;
    })
    .filter(Boolean);

  const nextSequence = Math.max(result.rows.length, 0, ...existingSequences) + 1;

  return `${batchPrefix}${String(nextSequence).padStart(3, "0")}`;
};

const normalizeDonationStockFormDefinition = (
  donationItemPayload,
  inventoryItem,
) => {
  const packaging = String(
    donationItemPayload.stock_form_packaging || inventoryItem.packaging || "piece",
  )
    .trim()
    .toLowerCase();
  const unitsPerPackaging = Number(
    donationItemPayload.stock_form_units_per_packaging ??
      (packaging === "piece" ? 1 : null),
  );
  const unitOfMeasure = String(
    donationItemPayload.stock_form_unit_of_measure ||
      inventoryItem.unit_of_measure ||
      "pc",
  ).trim();
  const rawUnitValue =
    donationItemPayload.stock_form_unit_of_measure_value ??
    inventoryItem.unit_of_measure_value ??
    null;
  const unitOfMeasureValue =
    rawUnitValue === null || rawUnitValue === undefined || rawUnitValue === ""
      ? null
      : Number(rawUnitValue);

  if (!packaging) {
    return null;
  }

  if (!Number.isInteger(unitsPerPackaging) || unitsPerPackaging <= 0) {
    return null;
  }

  if (!unitOfMeasure) {
    return null;
  }

  if (
    unitOfMeasureValue !== null &&
    (!Number.isFinite(unitOfMeasureValue) || unitOfMeasureValue <= 0)
  ) {
    return null;
  }

  return {
    inventory_item_id: inventoryItem.id,
    barcode: donationItemPayload.stock_form_barcode || null,
    packaging,
    units_per_packaging: unitsPerPackaging,
    unit_of_measure: unitOfMeasure,
    unit_of_measure_value: unitOfMeasureValue,
    is_active: true,
  };
};

const ensureDisasterEvent = async (
  disasterEventId,
  dbClient,
  { requireActive = false } = {},
) => {
  const disasterEvent = await donationRepository.getDisasterEventById(
    disasterEventId,
    dbClient,
  );

  if (!disasterEvent) {
    const error = new Error("disaster_event_id does not refer to an existing disaster event");
    error.statusCode = 400;
    throw error;
  }

  if (requireActive) {
    const normalizedStatus = String(disasterEvent.status || "").trim().toUpperCase();

    if (!["ACTIVE", "ONGOING"].includes(normalizedStatus)) {
      const error = new Error(
        "disaster_event_id must refer to an active disaster event",
      );
      error.statusCode = 400;
      throw error;
    }
  }

  return disasterEvent;
};

const ensureInventoryItem = async (inventoryItemId, dbClient) => {
  const inventoryItem = await donationRepository.getInventoryItemById(
    inventoryItemId,
    dbClient,
  );

  if (!inventoryItem) {
    const error = new Error("inventory_item_id does not refer to an existing inventory item");
    error.statusCode = 400;
    throw error;
  }

  return inventoryItem;
};

const ensureUser = async (userId, fieldName, dbClient) => {
  const user = await donationRepository.getUserById(userId, dbClient);

  if (!user) {
    const error = new Error(`${fieldName} does not refer to an existing user`);
    error.statusCode = 400;
    throw error;
  }

  return user;
};

const attachDonationItems = async (donationId, dbClient = pool) => {
  const items = await donationRepository.getDonationItemsByDonationId(
    donationId,
    dbClient,
  );

  return items.map(mapDonationItem);
};

const buildInventoryTransactionRemarks = ({
  donationName,
  inventoryItemName,
  action,
  remarks,
}) => {
  const baseMessage = `${action} donation stock for ${inventoryItemName} from ${donationName}`;

  if (!remarks) {
    return baseMessage;
  }

  return `${baseMessage}. ${remarks}`;
};

const createOrAttachDonationBatch = async ({
  donation,
  inventoryItem,
  donationItemPayload,
  createdBy,
  dbClient,
}) => {
  if (donationItemPayload.inventory_batch_id) {
    const error = new Error(
      "Donation receipts must create a new donated batch for each received entry",
    );
    error.statusCode = 400;
    throw error;
  }

  let resolvedStockFormId = donationItemPayload.inventory_item_stock_form_id || null;

  if (resolvedStockFormId) {
    const stockForm =
      await inventoryItemStockFormRepository.getInventoryItemStockFormById(
        resolvedStockFormId,
        dbClient,
      );

    if (!stockForm) {
      const error = new Error(
        "inventory_item_stock_form_id does not refer to an existing stock form",
      );
      error.statusCode = 400;
      throw error;
    }

    if (String(stockForm.inventory_item_id) !== String(inventoryItem.id)) {
      const error = new Error(
        "inventory_item_stock_form_id does not belong to the selected inventory item",
      );
      error.statusCode = 400;
      throw error;
    }
  } else {
    const stockForms =
      await inventoryItemStockFormRepository.getInventoryItemStockFormsByItemId(
        inventoryItem.id,
        dbClient,
      );

    const stockFormDefinition = normalizeDonationStockFormDefinition(
      donationItemPayload,
      inventoryItem,
    );

    if (stockFormDefinition) {
      const matchedStockForm =
        await inventoryItemStockFormRepository.getInventoryItemStockFormByDefinition(
          stockFormDefinition,
          dbClient,
        );

      if (matchedStockForm) {
        resolvedStockFormId = matchedStockForm.id;
      } else {
        const createdStockForm =
          await inventoryItemStockFormRepository.insertInventoryItemStockForm(
            stockFormDefinition,
            dbClient,
          );
        resolvedStockFormId = createdStockForm.id;
      }
    } else if (stockForms.length === 1) {
      resolvedStockFormId = stockForms[0].id;
    } else if (stockForms.length > 1) {
      const error = new Error(
        "inventory_item_stock_form_id is required when the selected inventory item has multiple stock forms",
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const createdBatch = await inventoryBatchRepository.insertInventoryBatch(
    {
      inventory_item_id: inventoryItem.id,
      inventory_item_stock_form_id: resolvedStockFormId,
      batch_no: await buildDonationBatchNumber({
        inventoryItem,
        dbClient,
      }),
      supplier_id: null,
      source_type: "DONATED",
      quantity_received: donationItemPayload.quantity_received,
      quantity_available: donationItemPayload.quantity_received,
      expiration_date: donationItemPayload.expiration_date,
      received_at: donation.received_at,
      storage_location: donationItemPayload.storage_location,
      status: getBatchStatus(
        donationItemPayload.expiration_date,
        donationItemPayload.quantity_received,
      ),
      created_by: createdBy,
    },
    dbClient,
  );

  return createdBatch.id;
};

const createDonationItemWithInventory = async ({
  donation,
  donationItemPayload,
  performedBy,
  dbClient,
}) => {
  const inventoryItem = await ensureInventoryItem(
    donationItemPayload.inventory_item_id,
    dbClient,
  );

  const inventoryBatchId = await createOrAttachDonationBatch({
    donation,
    inventoryItem,
    donationItemPayload,
    createdBy: performedBy,
    dbClient,
  });

  const createdDonationItem = await donationRepository.insertDonationItem(
    {
      donation_id: donation.id,
      inventory_item_id: inventoryItem.id,
      inventory_batch_id: inventoryBatchId,
      quantity_received: donationItemPayload.quantity_received,
      remarks: donationItemPayload.remarks,
    },
    dbClient,
  );

  await donationRepository.insertInventoryTransaction(
    {
      disaster_event_id: donation.disaster_event_id,
      inventory_batch_id: inventoryBatchId,
      transaction_type: "INFLOW",
      quantity: donationItemPayload.quantity_received,
      reference_type: "DONATION",
      reference_id: createdDonationItem.id,
      performed_by: performedBy,
      remarks: buildInventoryTransactionRemarks({
        donationName: donation.donor_name,
        inventoryItemName: inventoryItem.item_name,
        action: "Received",
        remarks: donationItemPayload.remarks,
      }),
    },
    dbClient,
  );

  await refreshInventoryItemStockSnapshot(inventoryItem.id, dbClient);

  return createdDonationItem.id;
};

const removeDonationItemWithinTransaction = async ({
  donationItem,
  donation,
  performedBy,
  dbClient,
}) => {
  const batch = await donationRepository.getInventoryBatchByIdForUpdate(
    donationItem.inventory_batch_id,
    dbClient,
  );

  if (!batch) {
    const error = new Error("Linked inventory batch not found");
    error.statusCode = 404;
    throw error;
  }

  const quantityReceived = Number(donationItem.quantity_received);
  const currentAvailable = Number(batch.quantity_available);

  if (currentAvailable < quantityReceived) {
    const error = new Error(
      "This donation item can no longer be deleted because part of the donated stock has already been distributed or used",
    );
    error.statusCode = 409;
    throw error;
  }

  const nextAvailable = currentAvailable - quantityReceived;
  const nextReceived = Number(batch.quantity_received) - quantityReceived;

  await donationRepository.updateInventoryBatchStock(
    batch.id,
    {
      quantity_received: nextReceived,
      quantity_available: nextAvailable,
      expiration_date: batch.expiration_date,
      storage_location: batch.storage_location,
      status: getBatchStatus(batch.expiration_date, nextAvailable),
    },
    dbClient,
  );

  const inventoryItem = await ensureInventoryItem(
    donationItem.inventory_item_id,
    dbClient,
  );

  await donationRepository.insertInventoryTransaction(
    {
      disaster_event_id: donation.disaster_event_id,
      inventory_batch_id: batch.id,
      transaction_type: "OUTFLOW",
      quantity: quantityReceived,
      reference_type: "DONATION",
      reference_id: donationItem.id,
      performed_by: performedBy,
      remarks: buildInventoryTransactionRemarks({
        donationName: donation.donor_name,
        inventoryItemName: inventoryItem.item_name,
        action: "Removed",
        remarks: donationItem.remarks,
      }),
    },
    dbClient,
  );

  await refreshInventoryItemStockSnapshot(inventoryItem.id, dbClient);

  await donationRepository.deleteDonationItem(donationItem.id, dbClient);

  return {
    batchId: batch.id,
    batchNo: batch.batch_no,
    previousQuantityAvailable: currentAvailable,
    previousStatus: batch.status,
    nextQuantityAvailable: nextAvailable,
    nextStatus: getBatchStatus(batch.expiration_date, nextAvailable),
    expirationDate: batch.expiration_date,
    itemName: inventoryItem.item_name,
    quantityRemoved: quantityReceived,
    disasterEventId: donation.disaster_event_id,
  };
};

const getDonationNeeds = async (filters = {}) => {
  const donationNeeds = await donationRepository.getDonationNeeds(filters);
  return donationNeeds.map(mapDonationNeed);
};

const createDonationNeed = async (payload, publishedBy) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await ensureDisasterEvent(payload.disaster_event_id, client);
    await ensureInventoryItem(payload.inventory_item_id, client);
    await ensureUser(publishedBy, "published_by", client);

    const createdNeed = await donationRepository.insertDonationNeed(
      {
        ...payload,
        published_by: publishedBy,
      },
      client,
    );

    await client.query("COMMIT");

    const donationNeed = await donationRepository.getDonationNeedById(
      createdNeed.id,
      pool,
    );

    return mapDonationNeed(donationNeed);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updateDonationNeed = async (id, payload) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingNeed = await donationRepository.getDonationNeedById(id, client);

    if (!existingNeed) {
      const error = new Error("Donation need not found");
      error.statusCode = 404;
      throw error;
    }

    await ensureDisasterEvent(payload.disaster_event_id, client);
    await ensureInventoryItem(payload.inventory_item_id, client);

    await donationRepository.updateDonationNeed(id, payload, client);
    await client.query("COMMIT");

    const donationNeed = await donationRepository.getDonationNeedById(id, pool);
    return mapDonationNeed(donationNeed);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const deleteDonationNeed = async (id) => {
  const deletedNeed = await donationRepository.deleteDonationNeed(id, pool);

  if (!deletedNeed) {
    const error = new Error("Donation need not found");
    error.statusCode = 404;
    throw error;
  }

  return deletedNeed;
};

const getDonations = async (filters = {}) => {
  const donations = await donationRepository.getDonations(filters);

  return Promise.all(
    donations.map(async (donation) => {
      const items = await attachDonationItems(donation.id);
      return mapDonation(donation, items);
    }),
  );
};

const getDonationById = async (id) => {
  const donation = await donationRepository.getDonationById(id);

  if (!donation) {
    return null;
  }

  const items = await attachDonationItems(id);
  return mapDonation(donation, items);
};

const getDonationDetail = async (id) => {
  const [donation, stockUpdateHistory, auditLogs] = await Promise.all([
    getDonationById(id),
    donationRepository.getDonationInventoryTransactions(id),
    systemLogRepository.getAuditLogsByEntity({
      entityType: "DONATION",
      entityId: id,
      limit: 20,
    }),
  ]);

  if (!donation) {
    return null;
  }

  return {
    donation,
    stock_update_history: stockUpdateHistory,
    audit_history: auditLogs.map(mapAuditLogRow),
  };
};

const createDonation = async (payload, actor) => {
  const normalizedActor = normalizeActor(actor);
  const receivedBy = normalizedActor.userId;
  const normalizedDonorType = ensureValidDonationDonorType(payload.donor_type);
  const normalizedDonorTypeOther = normalizeDonationOtherDonorType(
    payload.donor_type_other,
  );
  const normalizedPayload = {
    ...payload,
    donor_type: normalizedDonorType,
    donor_type_other:
      normalizedDonorType === "OTHER" ? normalizedDonorTypeOther : null,
  };
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await ensureDisasterEvent(normalizedPayload.disaster_event_id, client, {
      requireActive: true,
    });
    await ensureUser(receivedBy, "received_by", client);

    const createdDonation = await donationRepository.insertDonation(
      {
        ...normalizedPayload,
        received_by: receivedBy,
      },
      client,
    );

    const donationRecord = await donationRepository.getDonationByIdForUpdate(
      createdDonation.id,
      client,
    );

    for (const item of normalizedPayload.items || []) {
      await createDonationItemWithInventory({
        donation: donationRecord,
        donationItemPayload: item,
        performedBy: receivedBy,
        dbClient: client,
      });
    }

    await client.query("COMMIT");
    const createdDonationRecord = await getDonationById(createdDonation.id);

    await notificationService.emitSafely(async () => {
      await notificationService.emitDonationSummaryUpdate({
        donorName: createdDonationRecord.donor_name,
        itemCount: createdDonationRecord.items.length,
        disasterEventId: createdDonationRecord.disaster_event_id,
        referenceId: createdDonationRecord.id,
      });

      for (const item of createdDonationRecord.items) {
        await notificationService.emitBatchAlerts({
          batch: {
            id: item.inventory_batch?.id,
            batch_no: item.inventory_batch?.batch_no,
            quantity_available: item.inventory_batch?.quantity_available,
            status: item.inventory_batch?.source_type === "DONATED"
              ? getBatchStatus(
                  item.inventory_batch?.expiration_date,
                  item.inventory_batch?.quantity_available,
                )
              : null,
            expiration_date: item.inventory_batch?.expiration_date,
            item_name: item.inventory_item?.item_name,
          },
          disasterEventId: createdDonationRecord.disaster_event_id,
        });
      }
    });

    await logAuditSafely({
      actor: normalizedActor,
      action: "DONATION_CREATE",
      entityType: "DONATION",
      entityId: createdDonationRecord.id,
      oldValues: {},
      newValues: summarizeDonation(createdDonationRecord),
    });

    return createdDonationRecord;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updateDonation = async (id, payload, actor = null) => {
  const normalizedActor = normalizeActor(actor);
  const normalizedDonorType = ensureValidDonationDonorType(payload.donor_type);
  const normalizedDonorTypeOther = normalizeDonationOtherDonorType(
    payload.donor_type_other,
  );
  const normalizedPayload = {
    ...payload,
    donor_type: normalizedDonorType,
    donor_type_other:
      normalizedDonorType === "OTHER" ? normalizedDonorTypeOther : null,
  };
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingDonation = await donationRepository.getDonationByIdForUpdate(
      id,
      client,
    );

    if (!existingDonation) {
      const error = new Error("Donation not found");
      error.statusCode = 404;
      throw error;
    }

    const previousDonationSummary = summarizeDonation(existingDonation);
    const donorNameChanged =
      normalizeDonationDonorName(existingDonation.donor_name) !==
      normalizeDonationDonorName(normalizedPayload.donor_name);

    await ensureDisasterEvent(normalizedPayload.disaster_event_id, client, {
      requireActive: true,
    });

    let renamedDonationRows = [];

    if (donorNameChanged) {
      renamedDonationRows = await donationRepository.renameDonorAcrossDonations(
        {
          previousDonorName: existingDonation.donor_name,
          nextDonorName: normalizedPayload.donor_name,
          donorType: existingDonation.donor_type,
          donorTypeOther: existingDonation.donor_type_other || null,
        },
        client,
      );
    }

    await donationRepository.updateDonation(id, normalizedPayload, client);

    const syncTargets = new Map();

    renamedDonationRows.forEach((row) => {
      syncTargets.set(String(row.id), {
        disaster_event_id: row.disaster_event_id,
        received_at: row.received_at || null,
      });
    });

    syncTargets.set(String(id), {
      disaster_event_id: normalizedPayload.disaster_event_id,
      received_at: normalizedPayload.received_at || null,
    });

    for (const [donationId, syncPayload] of syncTargets.entries()) {
      await donationRepository.syncDonationInventoryTransactions(
        donationId,
        syncPayload,
        client,
      );
    }

    await client.query("COMMIT");

    const updatedDonation = await getDonationById(id);

    await logAuditSafely({
      actor: normalizedActor,
      action: "DONATION_UPDATE",
      entityType: "DONATION",
      entityId: id,
      oldValues: previousDonationSummary,
      newValues: summarizeDonation(updatedDonation),
    });

    if (donorNameChanged) {
      const propagatedOldValues = pickDefined(existingDonation, [
        "donor_name",
        "donor_type",
        "donor_type_other",
      ]);
      const propagatedNewValues = pickDefined(updatedDonation, [
        "donor_name",
        "donor_type",
        "donor_type_other",
      ]);

      for (const renamedDonationRow of renamedDonationRows) {
        if (String(renamedDonationRow.id) === String(id)) {
          continue;
        }

        await logAuditSafely({
          actor: normalizedActor,
          action: "DONATION_UPDATE",
          entityType: "DONATION",
          entityId: renamedDonationRow.id,
          oldValues: propagatedOldValues,
          newValues: propagatedNewValues,
        });
      }
    }

    return updatedDonation;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const createDonationItem = async (donationId, payload, performedBy) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const donation = await donationRepository.getDonationByIdForUpdate(
      donationId,
      client,
    );

    if (!donation) {
      const error = new Error("Donation not found");
      error.statusCode = 404;
      throw error;
    }

    await ensureUser(performedBy, "performed_by", client);

    const createdDonationItemId = await createDonationItemWithInventory({
      donation,
      donationItemPayload: payload,
      performedBy,
      dbClient: client,
    });

    await client.query("COMMIT");

    const donationItem = await donationRepository.getDonationItemById(
      createdDonationItemId,
      pool,
    );
    const mappedDonationItem = mapDonationItem(donationItem);

    await notificationService.emitSafely(async () => {
      await notificationService.emitDonationStockUpdate({
        donorName: donation.donor_name,
        itemName: mappedDonationItem.inventory_item?.item_name || "Donation item",
        quantity: mappedDonationItem.quantity_received,
        disasterEventId: donation.disaster_event_id,
        referenceId: mappedDonationItem.id,
        actionLabel: "received",
      });

      await notificationService.emitBatchAlerts({
        batch: {
          id: mappedDonationItem.inventory_batch?.id,
          batch_no: mappedDonationItem.inventory_batch?.batch_no,
          quantity_available: mappedDonationItem.inventory_batch?.quantity_available,
          status: getBatchStatus(
            mappedDonationItem.inventory_batch?.expiration_date,
            mappedDonationItem.inventory_batch?.quantity_available,
          ),
          expiration_date: mappedDonationItem.inventory_batch?.expiration_date,
          item_name: mappedDonationItem.inventory_item?.item_name,
        },
        disasterEventId: donation.disaster_event_id,
      });
    });

    return mappedDonationItem;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updateDonationItem = async (id, payload, performedBy) => {
  const normalizedActor = normalizeActor(performedBy);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingDonationItem =
      await donationRepository.getDonationItemByIdForUpdate(id, client);

    if (!existingDonationItem) {
      const error = new Error("Donation item not found");
      error.statusCode = 404;
      throw error;
    }

    const donation = await donationRepository.getDonationByIdForUpdate(
      existingDonationItem.donation_id,
      client,
    );

    if (!donation) {
      const error = new Error("Parent donation not found");
      error.statusCode = 404;
      throw error;
    }

    if (
      payload.inventory_item_id &&
      payload.inventory_item_id !== existingDonationItem.inventory_item_id
    ) {
      const error = new Error(
        "inventory_item_id cannot be changed for an existing donation item",
      );
      error.statusCode = 400;
      throw error;
    }

    const batch = await donationRepository.getInventoryBatchByIdForUpdate(
      existingDonationItem.inventory_batch_id,
      client,
    );

    if (!batch) {
      const error = new Error("Linked inventory batch not found");
      error.statusCode = 404;
      throw error;
    }

    const existingDonationItemRecord = await donationRepository.getDonationItemById(
      id,
      client,
    );
    const previousDonationItemSummary = summarizeDonationItem(
      mapDonationItem(existingDonationItemRecord),
    );
    const previousBatchSummary = summarizeDonationInventoryBatch(batch);

    const nextQuantity = payload.quantity_received;
    const quantityDelta = nextQuantity - Number(existingDonationItem.quantity_received);
    const currentAvailable = Number(batch.quantity_available);
    const currentReceived = Number(batch.quantity_received);

    let nextAvailable = currentAvailable;
    let nextReceived = currentReceived;

    if (quantityDelta > 0) {
      nextAvailable += quantityDelta;
      nextReceived += quantityDelta;
    }

    if (quantityDelta < 0) {
      const quantityToRemove = Math.abs(quantityDelta);

      if (currentAvailable < quantityToRemove) {
        const error = new Error(
          "Unable to reduce the donated quantity because part of the donated stock has already been distributed or used",
        );
        error.statusCode = 409;
        throw error;
      }

      nextAvailable -= quantityToRemove;
      nextReceived -= quantityToRemove;
    }

    await donationRepository.updateInventoryBatchStock(
      batch.id,
      {
        quantity_received: nextReceived,
        quantity_available: nextAvailable,
        expiration_date: payload.expiration_date || batch.expiration_date,
        storage_location: payload.storage_location || batch.storage_location,
        status: getBatchStatus(
          payload.expiration_date || batch.expiration_date,
          nextAvailable,
        ),
      },
      client,
    );

    await donationRepository.updateDonationItem(
      id,
      {
        quantity_received: nextQuantity,
        remarks: payload.remarks,
      },
      client,
    );

    let adjustmentTransactionId = null;
    let adjustmentTransactionSummary = null;

    if (quantityDelta !== 0) {
      const inventoryItem = await ensureInventoryItem(
        existingDonationItem.inventory_item_id,
        client,
      );

      adjustmentTransactionSummary = {
        disaster_event_id: donation.disaster_event_id,
        inventory_batch_id: batch.id,
        transaction_type: quantityDelta > 0 ? "INFLOW" : "OUTFLOW",
        quantity: Math.abs(quantityDelta),
        reference_type: "DONATION",
        reference_id: id,
        performed_by: performedBy,
        performed_at: donation.received_at || new Date().toISOString(),
        remarks: buildInventoryTransactionRemarks({
          donationName: donation.donor_name,
          inventoryItemName: inventoryItem.item_name,
          action: quantityDelta > 0 ? "Adjusted up" : "Adjusted down",
          remarks: payload.remarks,
        }),
      };

      const createdAdjustmentTransaction =
        await donationRepository.insertInventoryTransaction(
          adjustmentTransactionSummary,
          client,
        );

      adjustmentTransactionId = createdAdjustmentTransaction.id;
    }

    await refreshInventoryItemStockSnapshot(
      existingDonationItem.inventory_item_id,
      client,
    );

    await client.query("COMMIT");

    const donationItem = await donationRepository.getDonationItemById(id, pool);
    const mappedDonationItem = mapDonationItem(donationItem);
    const nextDonationItemSummary = summarizeDonationItem(mappedDonationItem);
    const nextBatchSummary = summarizeDonationInventoryBatch({
      ...batch,
      ...pickDefined(mappedDonationItem?.inventory_batch || {}, [
        "batch_no",
        "expiration_date",
        "quantity_available",
      ]),
      quantity_received: nextReceived,
      quantity_available: nextAvailable,
      expiration_date:
        mappedDonationItem?.inventory_batch?.expiration_date ||
        payload.expiration_date ||
        batch.expiration_date,
      storage_location: payload.storage_location || batch.storage_location,
      status: getBatchStatus(
        mappedDonationItem?.inventory_batch?.expiration_date ||
          payload.expiration_date ||
          batch.expiration_date,
        nextAvailable,
      ),
    });

    await logAuditSafely({
      actor: normalizedActor,
      action: "DONATION_ITEM_UPDATE",
      entityType: "DONATION_ITEM",
      entityId: id,
      oldValues: previousDonationItemSummary,
      newValues: nextDonationItemSummary,
    });

    await logAuditSafely({
      actor: normalizedActor,
      action: "INVENTORY_BATCH_UPDATE",
      entityType: "INVENTORY_BATCH",
      entityId: batch.id,
      oldValues: previousBatchSummary,
      newValues: nextBatchSummary,
    });

    if (adjustmentTransactionId && adjustmentTransactionSummary) {
      await logAuditSafely({
        actor: normalizedActor,
        action: "INVENTORY_TRANSACTION_CREATE",
        entityType: "INVENTORY_TRANSACTION",
        entityId: adjustmentTransactionId,
        oldValues: {},
        newValues: summarizeDonationInventoryTransaction(
          adjustmentTransactionSummary,
        ),
      });
    }

    if (quantityDelta !== 0) {
      await notificationService.emitSafely(async () => {
        await notificationService.emitDonationStockUpdate({
          donorName: donation.donor_name,
          itemName: mappedDonationItem.inventory_item?.item_name || "Donation item",
          quantity: Math.abs(quantityDelta),
          disasterEventId: donation.disaster_event_id,
          referenceId: mappedDonationItem.id,
          actionLabel: quantityDelta > 0 ? "adjusted upward" : "adjusted downward",
          severity: quantityDelta > 0 ? "INFO" : "WARNING",
          anomaly: quantityDelta < 0,
        });

        await notificationService.emitBatchAlerts({
          batch: {
            id: mappedDonationItem.inventory_batch?.id,
            batch_no: mappedDonationItem.inventory_batch?.batch_no,
            quantity_available: mappedDonationItem.inventory_batch?.quantity_available,
            status: getBatchStatus(
              mappedDonationItem.inventory_batch?.expiration_date,
              mappedDonationItem.inventory_batch?.quantity_available,
            ),
            expiration_date: mappedDonationItem.inventory_batch?.expiration_date,
            item_name: mappedDonationItem.inventory_item?.item_name,
          },
          previousQuantityAvailable: currentAvailable,
          previousStatus: batch.status,
          disasterEventId: donation.disaster_event_id,
        });
      });
    }

    return mappedDonationItem;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const deleteDonationItem = async (id, performedBy) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingDonationItem =
      await donationRepository.getDonationItemByIdForUpdate(id, client);

    if (!existingDonationItem) {
      const error = new Error("Donation item not found");
      error.statusCode = 404;
      throw error;
    }

    const donation = await donationRepository.getDonationByIdForUpdate(
      existingDonationItem.donation_id,
      client,
    );

    if (!donation) {
      const error = new Error("Parent donation not found");
      error.statusCode = 404;
      throw error;
    }

    const removalSummary = await removeDonationItemWithinTransaction({
      donationItem: existingDonationItem,
      donation,
      performedBy,
      dbClient: client,
    });
    await client.query("COMMIT");

    await notificationService.emitSafely(async () => {
      await notificationService.emitDonationStockUpdate({
        donorName: donation.donor_name,
        itemName: removalSummary.itemName,
        quantity: removalSummary.quantityRemoved,
        disasterEventId: donation.disaster_event_id,
        referenceId: id,
        actionLabel: "removed",
        severity: "WARNING",
        anomaly: true,
      });

      await notificationService.emitBatchAlerts({
        batch: {
          id: removalSummary.batchId,
          batch_no: removalSummary.batchNo,
          quantity_available: removalSummary.nextQuantityAvailable,
          status: removalSummary.nextStatus,
          expiration_date: removalSummary.expirationDate,
          item_name: removalSummary.itemName,
        },
        previousQuantityAvailable: removalSummary.previousQuantityAvailable,
        previousStatus: removalSummary.previousStatus,
        disasterEventId: removalSummary.disasterEventId,
      });
    });

    return { id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const deleteDonationRecord = async (id, performedBy) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const donation = await donationRepository.getDonationByIdForUpdate(id, client);

    if (!donation) {
      const error = new Error("Donation not found");
      error.statusCode = 404;
      throw error;
    }

    const donationItems = await donationRepository.getDonationItemsByDonationId(
      id,
      client,
    );

    for (const donationItem of donationItems) {
      await removeDonationItemWithinTransaction({
        donationItem,
        donation,
        performedBy,
        dbClient: client,
      });
    }

    await donationRepository.deleteDonation(id, client);
    await client.query("COMMIT");

    await notificationService.emitSafely(() =>
      notificationService.emitDonationStockUpdate({
        donorName: donation.donor_name,
        itemName: "donation record items",
        quantity: donationItems.length,
        disasterEventId: donation.disaster_event_id,
        referenceId: id,
        actionLabel: "removed",
        severity: "WARNING",
        anomaly: true,
      }),
    );

    return { id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getPublicDonationPortal = async (disasterEventId = null) => {
  const activeDisasterSummaries =
    await donationRepository.getPublicDonationDisasterSummaries(disasterEventId);
  const selectedDisasterEventId = activeDisasterSummaries[0]?.id || null;
  const activeDisasterEventIds = activeDisasterSummaries.map((event) => event.id);

  const [
    summaryTotals,
    perItemSummary,
    recentDonationRows,
    latestForecasts,
    defaultEmergencyNeedRows,
    publicDonationNeedRows,
  ] = activeDisasterEventIds.length > 0
    ? await Promise.all([
        donationRepository.getDonationSummaryTotals(activeDisasterEventIds),
        donationRepository.getDonationItemTransparencySummary(
          activeDisasterEventIds,
        ),
        donationRepository.getPublicRecentDonationSummaries(
          activeDisasterEventIds,
          6,
        ),
        Promise.all(
          activeDisasterEventIds.map((activeDisasterEventId) =>
            forecastService.getLatestInventoryForecast(activeDisasterEventId),
          ),
        ),
        donationRepository.getDefaultEmergencyDonationNeeds(
          activeDisasterSummaries.map((event) => event.disaster_type),
        ),
        donationRepository.getPublicDonationNeeds(activeDisasterEventIds),
      ])
    : [
        {
          total_donations_received: 0,
          total_quantity_received: 0,
          total_donated_items_distributed: 0,
          remaining_donated_inventory: 0,
        },
        [],
        [],
        [],
        [],
        [],
      ];

  const neededItems = resolvePublicNeededItems({
    latestForecasts,
    defaultEmergencyNeeds: defaultEmergencyNeedRows,
    publicDonationNeeds: publicDonationNeedRows,
  });

  return {
    public_contact_config: getPublicContactConfig(),
    disaster_events: activeDisasterSummaries.map(mapPublicDisasterSummary),
    selected_disaster_event_key: selectedDisasterEventId
      ? createPublicKey("event", selectedDisasterEventId)
      : null,
    needed_items: neededItems,
    forecast_suggestions: neededItems.suggestions,
    recent_donations: recentDonationRows.map(mapPublicDonationSummary),
    transparency_summary: {
      ...summaryTotals,
      received_vs_distributed: perItemSummary.map((row) => ({
        public_key: createPublicKey("utilization-item", row.inventory_item_id),
        item_name: row.item_name,
        unit_of_measure: row.unit_of_measure,
        quantity_received: row.quantity_received,
        quantity_distributed: row.quantity_distributed,
        quantity_remaining: row.quantity_remaining,
      })),
    },
  };
};

const exportDonationTransparencyReport = async (disasterEventId = null, format) => {
  const rows = await donationRepository.getDonationTransparencyExportRows(
    disasterEventId,
  );

  if (rows.length === 0) {
    const error = new Error("No donation transparency records are available to export.");
    error.statusCode = 404;
    throw error;
  }

  return mayorReportExport.buildExportFile({
    filePrefix: "office-mayor-donor-transparency-summary",
    worksheetName: "Donor Transparency",
    reportTitle: "Donor Transparency Summary",
    metadata: [
      { label: "Disaster Event Filter", value: disasterEventId || "All" },
    ],
    columns: [
      { key: "donor_name", label: "Donor Name", width: 28, pdfWidth: 150 },
      { key: "item_name", label: "Item Name", width: 28, pdfWidth: 150 },
      { key: "quantity_received", label: "Quantity Received", width: 18, pdfWidth: 72 },
      { key: "quantity_distributed", label: "Quantity Distributed", width: 18, pdfWidth: 72 },
      { key: "remaining_stock", label: "Remaining Stock", width: 18, pdfWidth: 72 },
    ],
    rows,
    format,
  });
};

module.exports = {
  getDonationNeeds,
  createDonationNeed,
  updateDonationNeed,
  deleteDonationNeed,
  getDonations,
  getDonationById,
  getDonationDetail,
  createDonation,
  updateDonation,
  createDonationItem,
  updateDonationItem,
  deleteDonationItem,
  deleteDonationRecord,
  getPublicDonationPortal,
  exportDonationTransparencyReport,
};
