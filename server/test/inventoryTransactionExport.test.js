const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { buildExportFile } = require("../src/utils/mswdoReportExport");
const inventoryTransactionRepository = require("../src/repositories/inventoryTransaction.repository");
const inventoryTransactionService = require("../src/services/inventoryTransaction.service");

const columns = [
  {
    key: "movement",
    label: "Movement",
    width: 14,
    pdfWidth: 70,
    alignment: { vertical: "top", horizontal: "center", wrapText: true },
  },
  {
    key: "transaction",
    label: "Transaction",
    width: 22,
    pdfWidth: 105,
    alignment: { vertical: "top", horizontal: "center", wrapText: true },
  },
  { key: "item", label: "Item", width: 30, pdfWidth: 140 },
  { key: "batch_number", label: "Batch Number", width: 28, pdfWidth: 140 },
  {
    key: "date",
    label: "Date",
    width: 22,
    pdfWidth: 105,
    alignment: { vertical: "top", horizontal: "center", wrapText: true },
  },
  {
    key: "performed_by",
    label: "Performed By",
    width: 24,
    pdfWidth: 120,
    alignment: { vertical: "top", horizontal: "center", wrapText: true },
  },
  { key: "remarks", label: "Remarks", width: 40, pdfWidth: 182 },
];

const rows = [
  {
    movement: "Outflow",
    transaction: "Contaminated",
    item: "Rice",
    batch_number: "BATCH-RICE-001",
    date: "Sep 13, 2026, 8:00 AM",
    performed_by: "Kath Alonzo",
    remarks:
      "Contaminated during storage and removed from available stock after inspection.",
  },
];

test("inventory transaction exports use the established branded report builder", async () => {
  const serviceSource = fs.readFileSync(
    path.resolve(__dirname, "../src/services/inventoryTransaction.service.js"),
    "utf8",
  );

  assert.match(
    serviceSource,
    /const reportExport = require\("\.\.\/utils\/mswdoReportExport"\);/,
  );
  assert.match(serviceSource, /worksheetName: "Inventory Tracking"/);
  assert.match(serviceSource, /reportTitle: "Inventory Tracking Report"/);
  assert.doesNotMatch(serviceSource, /label: "Search"/);
  assert.match(serviceSource, /tableTitle: "Inventory Transactions"/);
  assert.match(serviceSource, /sourceName: "Office of the Mayor"/);
  assert.match(serviceSource, /key: "movement",[\s\S]*?label: "Movement"/);
  assert.match(serviceSource, /key: "transaction",[\s\S]*?label: "Transaction"/);
  assert.match(serviceSource, /key: "item", label: "Item"/);
  assert.match(serviceSource, /key: "batch_number", label: "Batch Number"/);
  assert.match(serviceSource, /key: "date",[\s\S]*?label: "Date"/);
  assert.match(serviceSource, /key: "performed_by",[\s\S]*?label: "Performed By"/);
  assert.match(serviceSource, /key: "remarks", label: "Remarks"/);
  assert.doesNotMatch(serviceSource, /key: "reference_type"/);
  assert.doesNotMatch(serviceSource, /key: "other_status", label: "Other Status"/);
  assert.doesNotMatch(serviceSource, /key: "quantity"/);
  assert.doesNotMatch(serviceSource, /key: "inventory_transaction_reference_no"/);

  const excelFile = await buildExportFile({
    filePrefix: "office-mayor-inventory-tracking-test",
    worksheetName: "Inventory Tracking",
    reportTitle: "Inventory Tracking Report",
    tableTitle: "Inventory Transactions",
    sourceName: "Office of the Mayor",
    columns,
    rows,
    format: "excel",
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelFile.buffer);
  const worksheet = workbook.getWorksheet("Inventory Tracking");
  const tableTitleRowNumber = worksheet.getColumn(1).values.findIndex(
    (value) => value === "Inventory Transactions",
  );
  const headerRowNumber = tableTitleRowNumber + 1;

  assert.ok(tableTitleRowNumber > 0);
  assert.deepEqual(
    worksheet.getRow(headerRowNumber).values.slice(1),
    columns.map((column) => column.label),
  );
  assert.equal(worksheet.getRow(headerRowNumber + 1).getCell(1).value, "Outflow");
  assert.equal(worksheet.getRow(headerRowNumber + 1).getCell(2).value, "Contaminated");
  assert.equal(worksheet.getRow(headerRowNumber + 1).getCell(7).value, rows[0].remarks);
  assert.equal(
    worksheet.getRow(headerRowNumber).getCell(1).fill.fgColor.argb,
    "FF2F6499",
  );

  const pdfFile = await buildExportFile({
    filePrefix: "office-mayor-inventory-tracking-test",
    worksheetName: "Inventory Tracking",
    reportTitle: "Inventory Tracking Report",
    tableTitle: "Inventory Transactions",
    sourceName: "Office of the Mayor",
    columns,
    rows,
    format: "pdf",
  });
  const pdfSource = pdfFile.buffer.toString("latin1");

  assert.equal(pdfFile.contentType, "application/pdf");
  assert.match(pdfSource, /MediaBox \[0 0 842 595\]/);
  assert.match(pdfSource, /Inventory Transactions/);
  assert.match(pdfSource, /Movement/);
  assert.match(pdfSource, /Batch Number/);
  assert.doesNotMatch(pdfSource, /Reference Type/);
  assert.doesNotMatch(pdfSource, /Other Status/);
  assert.match(pdfSource, /Contaminated/);
  assert.match(pdfSource, /Remarks/);
});

test("inventory tracking report rows use the table-facing values", async () => {
  const originalGetInventoryTransactions =
    inventoryTransactionRepository.getInventoryTransactions;

  inventoryTransactionRepository.getInventoryTransactions = async () => [
    {
      id: "transaction-1",
      inventory_batch_id: "batch-1",
      transaction_type: "INFLOW",
      quantity: 20,
      reference_type: "DONATION",
      reference_id: null,
      inventory_transaction_reference_no: "ITR-2026-955901",
      performed_by: "user-1",
      performed_at: "2026-09-10T08:21:00.000Z",
      remarks: "Received donation stock.",
      other_status: null,
      created_at: "2026-09-10T08:21:00.000Z",
      batch_no: "DON-GARDENIA-001",
      inventory_item_stock_form_id: null,
      source_type: "DONATED",
      batch_status: "AVAILABLE",
      quantity_available: 20,
      source_donation_id: null,
      source_donor_name: null,
      inventory_item_id: "item-1",
      item_code: "GARDENIA",
      item_name: "Gardenia",
      donation_id: null,
      donor_name: null,
      performed_by_first_name: "Kath",
      performed_by_last_name: "Alonzo",
    },
  ];

  try {
    const file = await inventoryTransactionService.exportInventoryTransactions(
      {},
      "csv",
    );
    const csv = file.buffer.toString("utf8");

    assert.match(
      csv,
      /Movement,Transaction,Item,Batch Number,Date,Performed By,Remarks/,
    );
    assert.match(csv, /Inflow,Donated,Gardenia,DON-GARDENIA-001/);
    assert.match(csv, /Kath Alonzo/);
    assert.match(csv, /Received donation stock\./);
    assert.doesNotMatch(csv, /Reference Type/);
    assert.doesNotMatch(csv, /Other Status/);
  } finally {
    inventoryTransactionRepository.getInventoryTransactions =
      originalGetInventoryTransactions;
  }
});
