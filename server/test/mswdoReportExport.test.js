const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");

const { buildExportFile } = require("../src/utils/mswdoReportExport");

const columns = [
  { key: "family_head_name", label: "Family Head", width: 28, pdfWidth: 120 },
  { key: "barangay_name", label: "Barangay", width: 20, pdfWidth: 80 },
  { key: "relief_pack_summary", label: "Relief Pack", width: 36, pdfWidth: 150 },
  { key: "status_label", label: "Status", width: 16, pdfWidth: 65 },
];

const rows = [
  {
    family_head_name: "Juan Dela Cruz",
    barangay_name: "Santiago",
    relief_pack_summary: "Standard Relief Pack; Donor #1 Donation",
    status_label: "Claimed",
  },
];

test("MSWDO report exports use the masterlist-style Excel and PDF layout", async () => {
  const exportOptions = {
    filePrefix: "inventory-distribution",
    worksheetName: "Inventory Distribution",
    reportTitle: "Inventory Distribution Report",
    tableTitle: "Household Distribution Records",
    sourceName: "Office of the Mayor",
    metadata: [
      { label: "Disaster Event", value: "Typhoon Response Josi" },
      { label: "Barangay", value: "Santiago" },
    ],
    columns,
    rows,
  };

  const excelFile = await buildExportFile({ ...exportOptions, format: "excel" });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelFile.buffer);
  const worksheet = workbook.getWorksheet("Inventory Distribution");
  const tableTitleCell = worksheet.getColumn(1).values.find(
    (value) => value === "Household Distribution Records",
  );

  assert.equal(excelFile.contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(worksheet.getCell("B1").value, "DISTYNC");
  assert.equal(worksheet.getCell("B4").value, "Inventory Distribution Report");
  assert.equal(tableTitleCell, "Household Distribution Records");

  const titleRowNumber = worksheet.getColumn(1).values.findIndex(
    (value) => value === "Household Distribution Records",
  );
  const headerRow = worksheet.getRow(titleRowNumber + 1);
  assert.deepEqual(headerRow.values.slice(1, 5), [
    "Family Head",
    "Barangay",
    "Relief Pack",
    "Status",
  ]);
  assert.equal(headerRow.getCell(1).font.bold, true);
  assert.equal(worksheet.views[0].ySplit, titleRowNumber + 1);
  assert.equal(
    worksheet.autoFilter,
    `A${titleRowNumber + 1}:D${titleRowNumber + 2}`,
  );

  const pdfFile = await buildExportFile({ ...exportOptions, format: "pdf" });
  const pdfText = pdfFile.buffer.toString("latin1");

  assert.equal(pdfFile.contentType, "application/pdf");
  assert.match(pdfText, /Household Distribution Records/);
  assert.match(pdfText, /Family Head/);
  assert.match(pdfText, /0\.31 0\.53 0\.75 rg/);
  assert.match(pdfText, /0\.82 0\.88 0\.93 RG/);
  assert.match(pdfText, /Page 1/);
});
