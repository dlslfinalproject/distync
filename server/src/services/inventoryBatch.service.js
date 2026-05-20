const inventoryBatchRepository = require("../repositories/inventoryBatch.repository");
const mayorReportExport = require("../utils/mayorReportExport");

const mapInventoryBatch = (batch) => {
  return {
    id: batch.id,
    inventory_item_id: batch.inventory_item_id,
    batch_no: batch.batch_no,
    supplier_id: batch.supplier_id,
    source_type: batch.source_type,
    quantity_received: batch.quantity_received,
    quantity_available: batch.quantity_available,
    expiration_date: batch.expiration_date,
    received_at: batch.received_at,
    storage_location: batch.storage_location,
    status: batch.status,
    created_by: batch.created_by,
    created_at: batch.created_at,
    updated_at: batch.updated_at,
    inventory_item: {
      id: batch.inventory_item_id,
      item_code: batch.item_code,
      item_name: batch.item_name,
      category: batch.category,
      unit_of_measure: batch.unit_of_measure,
      barcode: batch.barcode,
      is_perishable: batch.is_perishable,
      is_active: batch.is_active,
    },
    supplier: batch.supplier_id
      ? {
          id: batch.supplier_id,
          name: batch.supplier_name,
          contact_person: batch.supplier_contact_person,
          contact_number: batch.supplier_contact_number,
          address: batch.supplier_address,
          has_moa: batch.supplier_has_moa,
          notes: batch.supplier_notes,
        }
      : null,
  };
};

const getInitialStatus = (expirationDate) => {
  if (!expirationDate) {
    return "AVAILABLE";
  }

  const today = new Date();
  const todayDateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const expiration = new Date(expirationDate);

  if (expiration < todayDateOnly) {
    return "EXPIRED";
  }

  return "AVAILABLE";
};

const getInventoryBatches = async (filters) => {
  const batches = await inventoryBatchRepository.getInventoryBatches(filters);
  return batches.map(mapInventoryBatch);
};

const getInventoryBatchById = async (id) => {
  const batch = await inventoryBatchRepository.getInventoryBatchById(id);

  if (!batch) {
    return null;
  }

  return mapInventoryBatch(batch);
};

const createInventoryBatch = async (batchData) => {
  const inventoryItem = await inventoryBatchRepository.getInventoryItemById(
    batchData.inventory_item_id,
  );

  if (!inventoryItem) {
    const error = new Error("inventory_item_id does not refer to an existing inventory item");
    error.statusCode = 400;
    throw error;
  }

  if (batchData.supplier_id) {
    const supplier = await inventoryBatchRepository.getSupplierById(
      batchData.supplier_id,
    );

    if (!supplier) {
      const error = new Error("supplier_id does not refer to an existing supplier");
      error.statusCode = 400;
      throw error;
    }
  }

  const existingBatch =
    await inventoryBatchRepository.getInventoryBatchByItemIdAndBatchNo(
      batchData.inventory_item_id,
      batchData.batch_no,
    );

  if (existingBatch) {
    const error = new Error("batch_no already exists for the selected inventory_item_id");
    error.statusCode = 409;
    throw error;
  }

  const createdBatch = await inventoryBatchRepository.insertInventoryBatch({
    ...batchData,
    quantity_available: batchData.quantity_received,
    status: getInitialStatus(batchData.expiration_date),
  });

  const fullBatch = await inventoryBatchRepository.getInventoryBatchById(
    createdBatch.id,
  );

  return mapInventoryBatch(fullBatch);
};

const exportInventoryBatches = async (filters, format) => {
  const batches = await getInventoryBatches(filters);

  const rows = batches.map((batch) => ({
    batch_no: batch.batch_no || "--",
    item_name: batch.inventory_item?.item_name || "--",
    quantity_received: batch.quantity_received ?? 0,
    quantity_available: batch.quantity_available ?? 0,
    expiration_date: mayorReportExport.formatDateOnly(batch.expiration_date),
    status: batch.status || "--",
    supplier: batch.supplier?.name || "--",
    received_at: mayorReportExport.formatDateTime(batch.received_at),
  }));

  return mayorReportExport.buildExportFile({
    filePrefix: "office-mayor-inventory-batches",
    worksheetName: "Inventory Batches",
    reportTitle: "Inventory Batches Report",
    metadata: [
      { label: "Search", value: filters.search?.trim() || "None" },
      { label: "Source Type", value: filters.source_type || "All" },
      { label: "Status", value: filters.status || "All" },
    ],
    columns: [
      { key: "batch_no", label: "Batch No", width: 24, pdfWidth: 85 },
      { key: "item_name", label: "Item Name", width: 28, pdfWidth: 140 },
      { key: "quantity_received", label: "Quantity Received", width: 20, pdfWidth: 70 },
      { key: "quantity_available", label: "Quantity Available", width: 20, pdfWidth: 70 },
      { key: "expiration_date", label: "Expiration Date", width: 20, pdfWidth: 88 },
      { key: "status", label: "Status", width: 18, pdfWidth: 70 },
      { key: "supplier", label: "Supplier", width: 26, pdfWidth: 130 },
      { key: "received_at", label: "Received At", width: 22, pdfWidth: 109 },
    ],
    rows,
    format,
  });
};

module.exports = {
  getInventoryBatches,
  getInventoryBatchById,
  createInventoryBatch,
  exportInventoryBatches,
};
