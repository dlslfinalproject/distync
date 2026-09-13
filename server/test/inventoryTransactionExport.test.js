const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { buildExportFile } = require("../src/utils/mswdoReportExport");

const columns = [
  { key: "transaction_type", label: "Transaction Type", width: 20, pdfWidth: 95 },
  { key: "quantity", label: "Quantity", width: 12, pdfWidth: 55 },
  {
    key: "inventory_transaction_reference_no",
    label: "ITR No.",
    width: 18,
    pdfWidth: 85,
  },
  { key: "reference_type", label: "Reference Type", width: 18, pdfWidth: 90 },
  { key: "performed_by", label: "Performed By", width: 24, pdfWidth: 120 },
  { key: "performed_at", label: "Performed At", width: 22, pdfWidth: 95 },
  { key: "other_status", label: "Other Status", width: 20, pdfWidth: 95 },
  { key: "remarks", label: "Remarks", width: 34, pdfWidth: 300 },
];

const rows = [
  {
    transaction_type: "OTHER",
    quantity: 2,
    inventory_transaction_reference_no: "ITR-2026-955900",
    reference_type: "MANUAL",
    performed_by: "Kath Alonzo",
    performed_at: "Sep 13, 2026, 8:00 AM",
    other_status: "Contaminated",
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
  assert.match(serviceSource, /tableTitle: "Inventory Transactions"/);
  assert.match(serviceSource, /sourceName: "Office of the Mayor"/);
  assert.match(
    serviceSource,
    /key: "other_status", label: "Other Status"/,
  );

  const excelFile = await buildExportFile({
    filePrefix: "office-mayor-inventory-transactions-test",
    worksheetName: "Inventory Transactions",
    reportTitle: "Inventory Transactions Report",
    tableTitle: "Inventory Transactions",
    sourceName: "Office of the Mayor",
    columns,
    rows,
    format: "excel",
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelFile.buffer);
  const worksheet = workbook.getWorksheet("Inventory Transactions");
  const tableTitleRowNumber = worksheet.getColumn(1).values.findIndex(
    (value) => value === "Inventory Transactions",
  );
  const headerRowNumber = tableTitleRowNumber + 1;

  assert.ok(tableTitleRowNumber > 0);
  assert.deepEqual(
    worksheet.getRow(headerRowNumber).values.slice(1),
    columns.map((column) => column.label),
  );
  assert.equal(worksheet.getRow(headerRowNumber + 1).getCell(7).value, "Contaminated");
  assert.equal(worksheet.getRow(headerRowNumber + 1).getCell(8).value, rows[0].remarks);
  assert.equal(
    worksheet.getRow(headerRowNumber).getCell(1).fill.fgColor.argb,
    "FF2F6499",
  );

  const pdfFile = await buildExportFile({
    filePrefix: "office-mayor-inventory-transactions-test",
    worksheetName: "Inventory Transactions",
    reportTitle: "Inventory Transactions Report",
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
  assert.match(pdfSource, /Other Status/);
  assert.match(pdfSource, /Contaminated/);
  assert.match(pdfSource, /Remarks/);
});
