const pool = require("../config/db");
const inventoryItemRepository = require("../repositories/inventoryItem.repository");
const inventoryItemStockFormRepository = require("../repositories/inventoryItemStockForm.repository");
const inventoryBatchRepository = require("../repositories/inventoryBatch.repository");
const inventoryTransactionRepository = require("../repositories/inventoryTransaction.repository");
const forecastRepository = require("../repositories/forecast.repository");
const systemLogRepository = require("../repositories/systemLog.repository");
const inventoryItemExport = require("../utils/inventoryItemExport");
const mayorReportExport = require("../utils/mayorReportExport");
const { logAuditSafely, pickDefined } = require("../utils/systemLog");

const OPEN_FOOD_FACTS_API_BASE_URL =
  process.env.OPEN_FOOD_FACTS_API_BASE_URL ||
  "https://world.openfoodfacts.org";

const buildItemCodeSeed = (itemName) => {
  const normalizedName = itemName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  return normalizedName || "ITEM";
};

const generateInventoryItemCode = async (itemName) => {
  const itemCodeSeed = buildItemCodeSeed(itemName);
  let sequenceNumber = 1;

  while (true) {
    const candidateCode = `INV-${itemCodeSeed}-${String(sequenceNumber).padStart(3, "0")}`;
    const existingItem = await inventoryItemRepository.getInventoryItemByCode(
      candidateCode,
    );

    if (!existingItem) {
      return candidateCode;
    }

    sequenceNumber += 1;
  }
};

const ensureUniqueFields = async (itemData, currentItemId = null) => {
  const existingItemByCode = await inventoryItemRepository.getInventoryItemByCode(
    itemData.item_code,
  );

  if (existingItemByCode && existingItemByCode.id !== currentItemId) {
    const error = new Error("item_code already exists");
    error.statusCode = 409;
    throw error;
  }

  const existingItemByName = await inventoryItemRepository.getInventoryItemByName(
    itemData.item_name,
  );

  if (existingItemByName && existingItemByName.id !== currentItemId) {
    const error = new Error("item_name already exists");
    error.statusCode = 409;
    throw error;
  }
};

const summarizeInventoryItem = (item) =>
  pickDefined(item, [
    "item_code",
    "item_name",
    "category",
    "unit_of_measure",
    "unit_of_measure_value",
    "packaging",
    "packaging_count",
    "quantity",
    "reorder_level",
    "expiration_date",
    "barcode",
    "is_perishable",
    "is_active",
  ]);

const summarizeInventoryItemStockForm = (stockForm) =>
  pickDefined(stockForm, [
    "inventory_item_id",
    "barcode",
    "packaging",
    "units_per_packaging",
    "unit_of_measure",
    "unit_of_measure_value",
    "is_active",
  ]);

const summarizeInventoryBatch = (batch) =>
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

const summarizeInventoryTransaction = (transaction) =>
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

const getInitialBatchStatus = (expirationDate) => {
  if (!expirationDate) {
    return "AVAILABLE";
  }

  const today = new Date();
  const todayDateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const resolvedExpirationDate = new Date(expirationDate);

  if (resolvedExpirationDate < todayDateOnly) {
    return "EXPIRED";
  }

  return "AVAILABLE";
};

const buildOpeningBatchNumber = (itemCode) => {
  const timestamp = Date.now();
  const normalizedItemCode = String(itemCode || "ITEM")
    .replace(/[^A-Z0-9-]+/gi, "-")
    .toUpperCase();

  return `${normalizedItemCode}-OPEN-${timestamp}`;
};

const getUnitsPerPackagingValue = (itemData) => {
  const parsedValue = Number(itemData.quantity || 0);

  if (Number.isInteger(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return 1;
};

const buildStockFormPayloadFromItem = (item, itemData = item) => ({
  inventory_item_id: item.id,
  barcode: itemData.barcode || null,
  packaging: itemData.packaging || "piece",
  units_per_packaging: getUnitsPerPackagingValue(itemData),
  unit_of_measure: itemData.unit_of_measure || item.unit_of_measure,
  unit_of_measure_value: itemData.unit_of_measure_value || null,
  is_active: itemData.is_active ?? item.is_active ?? true,
});

const inferCategoryFromLookup = (lookupPayload) => {
  const categoryText = [
    lookupPayload?.categories,
    Array.isArray(lookupPayload?.categories_tags)
      ? lookupPayload.categories_tags.join(" ")
      : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    categoryText.includes("fresh") ||
    categoryText.includes("meat") ||
    categoryText.includes("fish") ||
    categoryText.includes("vegetable") ||
    categoryText.includes("fruit") ||
    categoryText.includes("dairy")
  ) {
    return "Perishable";
  }

  return "Non-Perishable";
};

const buildLookupDisplayName = (lookupPayload) => {
  const nameParts = [
    lookupPayload?.product_name,
    lookupPayload?.brands,
  ].filter(Boolean);

  return nameParts.join(" - ") || lookupPayload?.generic_name || null;
};

const buildInventoryTrackingMap = (inventoryItems, inventoryBatches, inventoryTransactions) => {
  const trackingMap = new Map();

  inventoryItems.forEach((item) => {
    trackingMap.set(item.id, {
      onHand: 0,
      distributed: 0,
      expired: 0,
      expiredOnHand: 0,
      damaged: 0,
      missing: 0,
      spoiled: 0,
      stolen: 0,
      nearestExpirationDate: item.expiration_date || null,
    });
  });

  inventoryBatches.forEach((batch) => {
    const tracking = trackingMap.get(batch.inventory_item_id);

    if (!tracking) {
      return;
    }

    const quantityAvailable = Number(batch.quantity_available || 0);
    tracking.onHand += quantityAvailable;

    if (batch.expiration_date) {
      if (
        !tracking.nearestExpirationDate ||
        new Date(batch.expiration_date) < new Date(tracking.nearestExpirationDate)
      ) {
        tracking.nearestExpirationDate = batch.expiration_date;
      }
    }

    if (batch.status === "EXPIRED") {
      tracking.expiredOnHand += quantityAvailable;
    }
  });

  inventoryTransactions.forEach((transaction) => {
    const tracking = trackingMap.get(transaction.inventory_item?.id);

    if (!tracking) {
      return;
    }

    const quantity = Number(transaction.quantity || 0);

    if (transaction.reference_type === "DISTRIBUTION") {
      tracking.distributed += quantity;
    }

    if (transaction.transaction_type === "EXPIRED") {
      tracking.expired += quantity;
    }

    if (transaction.transaction_type === "DAMAGED") {
      tracking.damaged += quantity;
    }

    if (transaction.transaction_type === "MISSING") {
      tracking.missing += quantity;
    }

    if (transaction.transaction_type === "SPOILED") {
      tracking.spoiled += quantity;
    }

    if (transaction.transaction_type === "STOLEN") {
      tracking.stolen += quantity;
    }
  });

  return trackingMap;
};

const isNearExpiryDate = (value, thresholdDays) => {
  if (!value) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const comparisonDate = new Date(value);
  comparisonDate.setHours(0, 0, 0, 0);

  if (Number.isNaN(comparisonDate.getTime()) || comparisonDate < today) {
    return false;
  }

  const differenceInDays =
    (comparisonDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

  return differenceInDays <= thresholdDays;
};

const buildInventoryConditionRows = async ({
  report_type,
  near_expiry_days = 14,
  filters,
}) => {
  const [inventoryItems, inventoryBatches, inventoryTransactions] = await Promise.all([
    inventoryItemRepository.getInventoryItems(filters),
    inventoryBatchRepository.getInventoryBatches({}),
    inventoryTransactionRepository.getInventoryTransactions({}),
  ]);

  const trackingMap = buildInventoryTrackingMap(
    inventoryItems,
    inventoryBatches,
    inventoryTransactions,
  );

  if (report_type === "LOW_STOCK") {
    return inventoryBatches
      .filter((batch) => batch.status === "LOW_STOCK")
      .map((batch) => ({
        item_name: batch.item_name || "--",
        batch_no: batch.batch_no || "--",
        status: batch.status || "--",
        quantity_available: batch.quantity_available ?? 0,
        expiration_date: mayorReportExport.formatDateOnly(batch.expiration_date),
      }));
  }

  if (report_type === "NEAR_EXPIRY") {
    return inventoryBatches
      .filter((batch) => isNearExpiryDate(batch.expiration_date, near_expiry_days))
      .map((batch) => ({
        item_name: batch.item_name || "--",
        batch_no: batch.batch_no || "--",
        expiration_date: mayorReportExport.formatDateOnly(batch.expiration_date),
        quantity_available: batch.quantity_available ?? 0,
        status: batch.status || "--",
      }));
  }

  if (report_type === "EXPIRED") {
    return inventoryBatches
      .filter((batch) => batch.status === "EXPIRED")
      .map((batch) => ({
        item_name: batch.item_name || "--",
        batch_no: batch.batch_no || "--",
        expiration_date: mayorReportExport.formatDateOnly(batch.expiration_date),
        quantity_available: batch.quantity_available ?? 0,
        status: batch.status || "--",
      }));
  }

  return inventoryItems
    .map((item) => {
      const tracking = trackingMap.get(item.id);

      return {
        item_name: item.item_name || "--",
        damaged: tracking?.damaged || 0,
        missing: tracking?.missing || 0,
        spoiled: tracking?.spoiled || 0,
        stolen: tracking?.stolen || 0,
      };
    })
    .filter(
      (row) => row.damaged > 0 || row.missing > 0 || row.spoiled > 0 || row.stolen > 0,
    );
};

const getInventoryItems = async (filters) => {
  const inventoryItems = await inventoryItemRepository.getInventoryItems(filters);

  return Promise.all(
    inventoryItems.map(async (item) => ({
      ...item,
      stock_forms:
        await inventoryItemStockFormRepository.getInventoryItemStockFormsByItemId(
          item.id,
        ),
    })),
  );
};

const lookupInventoryItemByBarcode = async (barcode) => {
  const response = await fetch(
    `${OPEN_FOOD_FACTS_API_BASE_URL}/api/v3/product/${encodeURIComponent(barcode)}.json`,
    {
      method: "GET",
      headers: {
        "User-Agent": "DISTYNC/1.0 (inventory-barcode-lookup)",
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const error = new Error("Failed to fetch barcode details from online catalog");
    error.statusCode = 502;
    throw error;
  }

  const payload = await response.json().catch(() => null);
  const product = payload?.product || null;

  if (!product) {
    return {
      found: false,
      barcode,
      source: "OPEN_FOOD_FACTS",
      item: null,
    };
  }

  return {
    found: true,
    barcode,
    source: "OPEN_FOOD_FACTS",
    item: {
      barcode,
      item_name: buildLookupDisplayName(product),
      category: inferCategoryFromLookup(product),
      brand: product.brands || null,
      packaging: product.packaging || null,
      quantity_label: product.quantity || null,
      image_url: product.image_front_url || null,
    },
  };
};

const exportInventoryItems = async (filters) => {
  const [inventoryItems, inventoryBatches] = await Promise.all([
    inventoryItemRepository.getInventoryItems({
      ...filters,
      search: null,
    }),
    inventoryBatchRepository.getInventoryBatches({}),
  ]);

  const itemMap = new Map(
    inventoryItems.map((item) => [String(item.id), item]),
  );
  const batchesByItemId = inventoryBatches.reduce((lookup, batch) => {
    const itemId = String(batch.inventory_item_id || "");

    if (!itemMap.has(itemId)) {
      return lookup;
    }

    if (!lookup.has(itemId)) {
      lookup.set(itemId, []);
    }

    lookup.get(itemId).push(batch);
    return lookup;
  }, new Map());

  const normalizeText = (value) => String(value || "").trim().toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const inferTrackingMethodLabel = (item, batch) => {
    const unitOfMeasure = item?.unit_of_measure || batch?.stock_form_unit_of_measure || "";
    const unitOfMeasureValue = Number(
      item?.unit_of_measure_value || batch?.stock_form_unit_of_measure_value || 0,
    );

    if (unitOfMeasureValue > 0 && normalizeText(unitOfMeasure) !== "pc") {
      return "Weight/Volume-Based";
    }

    return "Count-Based";
  };

  const formatSourceLabel = (sourceType) => {
    const normalizedSource = String(sourceType || "").trim().toUpperCase();

    if (!normalizedSource || normalizedSource === "LGU") {
      return "Malvar LGU";
    }

    if (normalizedSource === "DONATED") {
      return "Donated";
    }

    if (normalizedSource === "DSWD") {
      return "DSWD";
    }

    if (normalizedSource === "PURCHASED") {
      return "Purchased";
    }

    return normalizedSource
      .split("_")
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(" ");
  };

  const getBatchStatus = (batch, itemTotalStock, reorderLevel) => {
    const quantityAvailable = Number(batch?.quantity_available || 0);

    if (quantityAvailable <= 0) {
      return "Depleted";
    }

    if (batch?.expiration_date) {
      const expirationDate = new Date(batch.expiration_date);
      expirationDate.setHours(0, 0, 0, 0);

      if (!Number.isNaN(expirationDate.getTime())) {
        if (expirationDate.getTime() <= today.getTime()) {
          return "Expired";
        }

        const daysUntilExpiration =
          (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

        if (daysUntilExpiration > 0 && daysUntilExpiration <= 30) {
          return "Near Expiry";
        }
      }
    }

    if (reorderLevel > 0 && itemTotalStock > 0 && itemTotalStock <= reorderLevel) {
      return "Low Stock";
    }

    return "Available";
  };

  const searchTerm = normalizeText(filters.search);
  const selectedStatus = String(filters.status || "All").trim().toLowerCase();

  const exportRows = [...batchesByItemId.entries()].flatMap(([itemId, batches]) => {
    const item = itemMap.get(itemId);

    if (!item) {
      return [];
    }

    const sortedBatches = [...batches].sort((leftBatch, rightBatch) => {
      const leftTimestamp = new Date(
        leftBatch?.received_at || leftBatch?.created_at || 0,
      ).getTime();
      const rightTimestamp = new Date(
        rightBatch?.received_at || rightBatch?.created_at || 0,
      ).getTime();

      return leftTimestamp - rightTimestamp;
    });

    const itemTotalStock = sortedBatches.reduce((sum, batch) => {
      return sum + Number(batch.quantity_available || 0);
    }, 0);
    const reorderLevel = Number(item.reorder_level || 0);

    return sortedBatches
      .map((batch) => {
        const stockStatus = getBatchStatus(batch, itemTotalStock, reorderLevel);

        return {
          item_name: item.item_name || "--",
          category: item.category || "--",
          tracking_method: inferTrackingMethodLabel(item, batch),
          barcode: batch?.stock_form_barcode || item?.barcode || "Not Applicable",
          packaging:
            batch?.stock_form_packaging || item?.packaging || "Not Applicable",
          units_per_packaging:
            Number(batch?.stock_form_units_per_packaging || item?.quantity || 0) ||
            (normalizeText(batch?.stock_form_packaging || item?.packaging) === "piece"
              ? 1
              : "Not Applicable"),
          unit_of_measure:
            batch?.stock_form_unit_of_measure || item?.unit_of_measure || "pc",
          batch_no: batch.batch_no || "--",
          current_stock: `${Number(batch.quantity_available || 0)} ${item.unit_of_measure || "pc"}`,
          reorder_level: reorderLevel > 0 ? reorderLevel : "Not Applicable",
          expiration_date: inventoryItemExport.formatDate(batch.expiration_date),
          source: formatSourceLabel(batch.source_type),
          stock_status: stockStatus,
        };
      })
      .filter((row) => {
        const matchesStatus =
          selectedStatus === "all" ||
          normalizeText(row.stock_status) === selectedStatus;
        const searchableValues = [
          row.item_name,
          row.category,
          row.tracking_method,
          row.barcode,
          row.packaging,
          row.units_per_packaging,
          row.unit_of_measure,
          row.batch_no,
          row.current_stock,
          row.expiration_date,
          row.source,
          row.stock_status,
        ];
        const matchesSearch =
          !searchTerm ||
          searchableValues.some((value) => normalizeText(value).includes(searchTerm));

        return matchesStatus && matchesSearch;
      });
  });

  if (exportRows.length === 0) {
    const error = new Error(
      "No inventory items are available to export for the current filters.",
    );
    error.statusCode = 404;
    throw error;
  }

  return inventoryItemExport.buildExportFile({
    rows: exportRows,
    filters,
    format: filters.format,
  });
};

const exportInventoryConditionReport = async ({
  report_type,
  near_expiry_days,
  filters,
  format,
}) => {
  const rows = await buildInventoryConditionRows({
    report_type,
    near_expiry_days,
    filters,
  });

  if (rows.length === 0) {
    const error = new Error("No records are available for the selected condition report.");
    error.statusCode = 404;
    throw error;
  }

  const reportConfig = {
    LOW_STOCK: {
      filePrefix: "office-mayor-low-stock-report",
      title: "Office of the Mayor Low Stock Report",
      worksheetName: "Low Stock",
      columns: [
        { key: "item_name", label: "Item Name", width: 28, pdfWidth: 170 },
        { key: "batch_no", label: "Batch No", width: 22, pdfWidth: 95 },
        { key: "status", label: "Status", width: 16, pdfWidth: 70 },
        { key: "quantity_available", label: "Quantity Available", width: 18, pdfWidth: 90 },
        { key: "expiration_date", label: "Expiration Date", width: 18, pdfWidth: 88 },
      ],
    },
    NEAR_EXPIRY: {
      filePrefix: "office-mayor-near-expiry-report",
      title: "Office of the Mayor Near Expiry Report",
      worksheetName: "Near Expiry",
      columns: [
        { key: "item_name", label: "Item Name", width: 28, pdfWidth: 170 },
        { key: "batch_no", label: "Batch No", width: 22, pdfWidth: 95 },
        { key: "expiration_date", label: "Expiration Date", width: 18, pdfWidth: 88 },
        { key: "quantity_available", label: "Quantity Available", width: 18, pdfWidth: 90 },
        { key: "status", label: "Status", width: 16, pdfWidth: 70 },
      ],
    },
    EXPIRED: {
      filePrefix: "office-mayor-expired-items-report",
      title: "Office of the Mayor Expired Items Report",
      worksheetName: "Expired Items",
      columns: [
        { key: "item_name", label: "Item Name", width: 28, pdfWidth: 170 },
        { key: "batch_no", label: "Batch No", width: 22, pdfWidth: 95 },
        { key: "expiration_date", label: "Expiration Date", width: 18, pdfWidth: 88 },
        { key: "quantity_available", label: "Quantity Available", width: 18, pdfWidth: 90 },
        { key: "status", label: "Status", width: 16, pdfWidth: 70 },
      ],
    },
    INCIDENT_LOSS: {
      filePrefix: "office-mayor-damaged-missing-spoiled-stolen-report",
      title: "Office of the Mayor Inventory Loss Report",
      worksheetName: "Inventory Loss",
      columns: [
        { key: "item_name", label: "Item Name", width: 28, pdfWidth: 210 },
        { key: "damaged", label: "Damaged", width: 14, pdfWidth: 65 },
        { key: "missing", label: "Missing", width: 14, pdfWidth: 65 },
        { key: "spoiled", label: "Spoiled", width: 14, pdfWidth: 65 },
        { key: "stolen", label: "Stolen", width: 14, pdfWidth: 65 },
      ],
    },
  }[report_type];

  return mayorReportExport.buildExportFile({
    filePrefix: reportConfig.filePrefix,
    worksheetName: reportConfig.worksheetName,
    reportTitle: reportConfig.title,
    metadata: [
      { label: "Search", value: filters.search?.trim() || "None" },
      ...(report_type === "NEAR_EXPIRY"
        ? [{ label: "Threshold", value: `${near_expiry_days} days` }]
        : []),
    ],
    columns: reportConfig.columns,
    rows,
    format,
  });
};

const getInventoryItemById = async (id) => {
  return inventoryItemRepository.getInventoryItemById(id);
};

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

const getInventoryItemDetail = async (id) => {
  const [item, relatedBatches, relatedTransactions, auditLogs, latestForecast] =
    await Promise.all([
      inventoryItemRepository.getInventoryItemById(id),
      inventoryBatchRepository.getInventoryBatches({ inventory_item_id: id }),
      inventoryTransactionRepository.getInventoryTransactions({ inventory_item_id: id }),
      systemLogRepository.getAuditLogsByEntity({
        entityType: "INVENTORY_ITEM",
        entityId: id,
        limit: 20,
      }),
      forecastRepository.getLatestForecastResultByInventoryItem(id),
    ]);

  if (!item) {
    return null;
  }

  const currentStock = relatedBatches.reduce(
    (total, batch) => total + Number(batch.quantity_available || 0),
    0,
  );

  let forecastSummary = null;

  if (latestForecast) {
    let parsedNotes = {};

    try {
      parsedNotes = latestForecast.confidence_notes
        ? JSON.parse(latestForecast.confidence_notes)
        : {};
    } catch (_error) {
      parsedNotes = {};
    }

    forecastSummary = {
      forecast_run_id: latestForecast.forecast_run_id,
      disaster_event_id: latestForecast.disaster_event_id,
      disaster_event: {
        event_code: latestForecast.event_code,
        title: latestForecast.disaster_event_title,
      },
      model_name: latestForecast.model_name,
      run_at: latestForecast.run_at,
      average_daily_usage: Number(parsedNotes.average_daily_usage || 0),
      forecasted_usage: Number(latestForecast.predicted_quantity_needed || 0),
      projected_depletion_date: latestForecast.predicted_depletion_date,
      recommended_reorder_quantity: Number(
        latestForecast.recommended_reorder_quantity || 0,
      ),
      risk_level: parsedNotes.risk_level || "LOW",
    };
  }

  return {
    item: {
      ...item,
      current_stock: currentStock,
      low_stock_threshold: item.reorder_level ?? null,
    },
    stock_forms: await inventoryItemStockFormRepository.getInventoryItemStockFormsByItemId(
      id,
    ),
    related_batches: relatedBatches,
    related_transactions: relatedTransactions,
    forecast_summary: forecastSummary,
    audit_history: auditLogs.map(mapAuditLogRow),
  };
};

const createInventoryItem = async (itemData, actor = null) => {
  const inventoryItemToCreate = {
    ...itemData,
    item_code: itemData.item_code || await generateInventoryItemCode(itemData.item_name),
  };

  await ensureUniqueFields(inventoryItemToCreate);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const createdItem =
      await inventoryItemRepository.insertInventoryItem(inventoryItemToCreate, client);

    const createdStockForm =
      await inventoryItemStockFormRepository.insertInventoryItemStockForm(
        buildStockFormPayloadFromItem(createdItem, inventoryItemToCreate),
        client,
      );

    if (itemData.skip_opening_stock) {
      await client.query("COMMIT");

      await logAuditSafely({
        actor,
        action: "INVENTORY_ITEM_CREATE",
        entityType: "INVENTORY_ITEM",
        entityId: createdItem.id,
        oldValues: {},
        newValues: summarizeInventoryItem(createdItem),
      });

      await logAuditSafely({
        actor,
        action: "INVENTORY_ITEM_STOCK_FORM_CREATE",
        entityType: "INVENTORY_ITEM_STOCK_FORM",
        entityId: createdStockForm.id,
        oldValues: {},
        newValues: summarizeInventoryItemStockForm(createdStockForm),
      });

      return createdItem;
    }

    const totalInitialQuantity =
      Number(createdItem.packaging_count || 0) * Number(createdItem.quantity || 0);

    const createdBatch = await inventoryBatchRepository.insertInventoryBatch(
      {
        inventory_item_id: createdItem.id,
        inventory_item_stock_form_id: createdStockForm.id,
        batch_no: buildOpeningBatchNumber(createdItem.item_code),
        supplier_id: null,
        source_type: "LGU",
        quantity_received: totalInitialQuantity,
        quantity_available: totalInitialQuantity,
        expiration_date: createdItem.expiration_date || null,
        storage_location: "Mayor's Office Inventory",
        status: getInitialBatchStatus(createdItem.expiration_date),
        created_by: actor?.userId || null,
      },
      client,
    );

    const createdTransaction =
      await inventoryTransactionRepository.insertInventoryTransaction(
        {
          disaster_event_id: null,
          inventory_batch_id: createdBatch.id,
          transaction_type: "INFLOW",
          quantity: totalInitialQuantity,
          reference_type: "MANUAL",
          reference_id: createdItem.id,
          performed_by: actor?.userId || null,
          remarks: "Opening stock recorded during inventory item creation",
        },
        client,
      );

    await client.query("COMMIT");

    await logAuditSafely({
      actor,
      action: "INVENTORY_ITEM_CREATE",
      entityType: "INVENTORY_ITEM",
      entityId: createdItem.id,
      oldValues: {},
      newValues: summarizeInventoryItem(createdItem),
    });

    await logAuditSafely({
      actor,
      action: "INVENTORY_BATCH_CREATE",
      entityType: "INVENTORY_BATCH",
      entityId: createdBatch.id,
      oldValues: {},
      newValues: summarizeInventoryBatch(createdBatch),
    });

    await logAuditSafely({
      actor,
      action: "INVENTORY_ITEM_STOCK_FORM_CREATE",
      entityType: "INVENTORY_ITEM_STOCK_FORM",
      entityId: createdStockForm.id,
      oldValues: {},
      newValues: summarizeInventoryItemStockForm(createdStockForm),
    });

    await logAuditSafely({
      actor,
      action: "INVENTORY_TRANSACTION_CREATE",
      entityType: "INVENTORY_TRANSACTION",
      entityId: createdTransaction.id,
      oldValues: {},
      newValues: summarizeInventoryTransaction(createdTransaction),
    });

    return createdItem;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updateInventoryItem = async (id, itemData, actor = null) => {
  const existingItem = await inventoryItemRepository.getInventoryItemById(id);

  if (!existingItem) {
    const error = new Error("Inventory item not found");
    error.statusCode = 404;
    throw error;
  }

  const inventoryItemToUpdate = {
    ...itemData,
    item_code: itemData.item_code || existingItem.item_code,
  };

  await ensureUniqueFields(inventoryItemToUpdate, id);

  const updatedItem = await inventoryItemRepository.updateInventoryItem(
    id,
    inventoryItemToUpdate,
  );

  const existingStockForms =
    await inventoryItemStockFormRepository.getInventoryItemStockFormsByItemId(id);
  const primaryStockForm = existingStockForms[0] || null;
  const nextStockFormPayload = buildStockFormPayloadFromItem(
    updatedItem,
    inventoryItemToUpdate,
  );

  if (primaryStockForm) {
    await inventoryItemStockFormRepository.updateInventoryItemStockForm(
      primaryStockForm.id,
      nextStockFormPayload,
    );
  } else {
    await inventoryItemStockFormRepository.insertInventoryItemStockForm(
      nextStockFormPayload,
    );
  }

  await logAuditSafely({
    actor,
    action: "INVENTORY_ITEM_UPDATE",
    entityType: "INVENTORY_ITEM",
    entityId: updatedItem.id,
    oldValues: summarizeInventoryItem(existingItem),
    newValues: summarizeInventoryItem(updatedItem),
  });

  return updatedItem;
};

module.exports = {
  getInventoryItems,
  lookupInventoryItemByBarcode,
  exportInventoryItems,
  exportInventoryConditionReport,
  getInventoryItemById,
  getInventoryItemDetail,
  createInventoryItem,
  updateInventoryItem,
};
