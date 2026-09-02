const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");

const { buildExportFile } = require("../src/utils/inventoryItemExport");

const EXPECTED_HEADERS = [
  "Item Name",
  "Category",
  "Tracking Method",
  "Barcode",
  "Packaging",
  "Units per Packaging",
  "Unit of Measure",
  "Batch Number",
  "Current Stock",
  "Reorder Level",
  "Expiration Date",
  "Source",
  "Stock Status",
];

const buildRows = () => [
  {
    item_name: "Emergency Water",
    category: "Non-Perishable",
    tracking_method: "Batch",
    barcode: "4800000000001",
    packaging: "Bottle",
    units_per_packaging: 12,
    unit_of_measure: "pc",
    batch_no: "BATCH-001",
    current_stock: "24 pc",
    reorder_level: 10,
    expiration_date: "Not Applicable",
    source: "Donation",
    stock_status: "Available",
  },
];

const parsePdfTextFragments = (buffer) => {
  const fragments = [];
  const pdfText = buffer.toString("latin1");
  const textPattern = /\(((?:\\.|[^\\)])*)\) Tj/g;

  for (const match of pdfText.matchAll(textPattern)) {
    fragments.push(match[1].replace(/\\([\\()])/g, "$1"));
  }

  return fragments;
};

test("inventory item exports keep the specified headers and report title in CSV, Excel, and PDF", async () => {
  const filters = {
    category: "Perishable",
    status: "Available",
    search: "water",
  };
  const rows = buildRows();

  const csvFile = await buildExportFile({ rows, filters, format: "csv" });
  const csvLines = csvFile.buffer.toString("utf8").split("\r\n");
  assert.equal(csvFile.contentType, "text/csv; charset=utf-8");
  assert.equal(csvLines[3], "Inventory Items Report");
  assert.equal(csvLines[10], EXPECTED_HEADERS.join(","));

  const excelFile = await buildExportFile({ rows, filters, format: "excel" });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelFile.buffer);
  const worksheet = workbook.getWorksheet("Inventory Items");
  const headerRow = worksheet.getRow(11);
  assert.deepEqual(headerRow.values.slice(1), EXPECTED_HEADERS);
  assert.equal(worksheet.getCell("A4").value, "Inventory Items Report");
  assert.ok(headerRow.height >= 30);
  assert.equal(headerRow.getCell(1).font.bold, true);

  const pdfFile = await buildExportFile({ rows, filters, format: "pdf" });
  const pdfText = parsePdfTextFragments(pdfFile.buffer).join(" ");
  assert.equal(pdfFile.contentType, "application/pdf");
  assert.match(pdfText, /Inventory Items Report/);
  EXPECTED_HEADERS.forEach((header) => {
    assert.match(pdfText, new RegExp(header));
  });
  assert.match(pdfFile.buffer.toString("latin1"), /0\.31 0\.53 0\.75 rg/);
});
