const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const test = require("node:test");

const { buildExportFile } = require("../src/utils/mayorReportExport");

const RECEIVED_COLUMNS = [
  { key: "donor_name", label: "Donor Name", width: 24, pdfWidth: 94 },
  { key: "donor_type", label: "Donor Type", width: 20, pdfWidth: 78 },
  { key: "donation_type", label: "Donation Type", width: 18, pdfWidth: 74 },
  { key: "disaster_event", label: "Disaster Event", width: 28, pdfWidth: 112 },
  { key: "item_name", label: "Item Name", width: 30, pdfWidth: 120 },
  {
    key: "quantity_per_item",
    label: "Quantity Per Item",
    width: 22,
    pdfWidth: 98,
  },
  {
    key: "total_quantity_received",
    label: "Total Quantity Received",
    width: 18,
    pdfWidth: 100,
  },
  { key: "date_received", label: "Date Received", width: 22, pdfWidth: 86 },
];

const TRANSPARENCY_COLUMNS = [
  { key: "donor_name", label: "Donor Name", width: 24, pdfWidth: 100 },
  { key: "disaster_event", label: "Disaster Event", width: 28, pdfWidth: 118 },
  {
    key: "distribution_event_details",
    label: "Distribution Details",
    width: 32,
    pdfWidth: 154,
  },
  {
    key: "transfer_event_details",
    label: "Transfer Details",
    width: 30,
    pdfWidth: 140,
  },
  { key: "item_name", label: "Item Name", width: 28, pdfWidth: 124 },
  { key: "unit_of_measure", label: "Unit", width: 14, pdfWidth: 64 },
  { key: "quantity_received", label: "Received", width: 14, pdfWidth: 70 },
  { key: "quantity_distributed", label: "Distributed", width: 14, pdfWidth: 78 },
  { key: "quantity_written_off", label: "Written Off", width: 14, pdfWidth: 78 },
  {
    key: "write_off_reasons",
    label: "Write-Off Reason",
    width: 24,
    pdfWidth: 126,
  },
  {
    key: "remaining_stock",
    label: "Remaining Balance",
    width: 18,
    pdfWidth: 68,
  },
];

const receivedRows = [
  {
    donor_name: "PB King",
    donor_type: "Individual",
    donation_type: "Loose Item",
    disaster_event: "Typhoon Response Josi",
    item_name: "Emergency Water",
    quantity_per_item: 200,
    total_quantity_received: 200,
    date_received: "Sep 3, 2026, 8:00 AM",
  },
];

const transparencyRows = [
  {
    donor_name: "DLSL Donations",
    disaster_event: "Typhoon Response Josi",
    distribution_event_details: "To Typhoon Response Josi: 120 pc; To Typhoon Response Odette: 40 pc",
    transfer_event_details: "Transferred to Typhoon Response Odette: 25 pc",
    item_name: "Emergency Water",
    unit_of_measure: "pc",
    quantity_received: 400,
    quantity_distributed: 120,
    quantity_written_off: 5,
    write_off_reasons: "Damaged packaging",
    remaining_stock: 275,
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

const buildOptions = ({
  worksheetName,
  reportTitle,
  columns,
  rows,
  format,
  metadata = [{ label: "Disaster Event Filter", value: "All" }],
}) => ({
  filePrefix: "office-mayor-donation-test",
  worksheetName,
  reportTitle,
  metadata,
  columns,
  rows,
  format,
  pdfLayout: "wide",
  excelLayout: "wide",
});

test("donation report Excel exports keep the inventory report styling and headers", async () => {
  const file = await buildExportFile(
    buildOptions({
      worksheetName: "Received Donations",
      reportTitle: "Received Donations Report",
      columns: RECEIVED_COLUMNS,
      rows: receivedRows,
      format: "excel",
      metadata: [
        { label: "Disaster Event Filter", value: "All" },
        { label: "Donation Type", value: "All" },
        { label: "Donor Type", value: "All" },
        { label: "Order List", value: "Newest First" },
      ],
    }),
  );

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer);
  const worksheet = workbook.getWorksheet("Received Donations");
  const headerRow = worksheet.getRow(12);

  assert.deepEqual(
    headerRow.values.slice(1),
    RECEIVED_COLUMNS.map((column) => column.label),
  );
  assert.equal(worksheet.getCell("A4").value, "Received Donations Report");
  assert.equal(worksheet.getCell("A6").value, "Disaster Event Filter");
  assert.equal(worksheet.getCell("B6").value, "All");
  assert.equal(headerRow.getCell(1).font.bold, true);
  assert.equal(headerRow.getCell(1).fill.fgColor.argb, "FF2F6499");
  assert.equal(worksheet.autoFilter, "A12:H12");
  assert.equal(worksheet.views[0].ySplit, 12);

  const transparencyFile = await buildExportFile(
    buildOptions({
      worksheetName: "Item Transparency",
      reportTitle: "Donation Item Transparency Report",
      columns: TRANSPARENCY_COLUMNS,
      rows: transparencyRows,
      format: "excel",
    }),
  );
  const transparencyWorkbook = new ExcelJS.Workbook();
  await transparencyWorkbook.xlsx.load(transparencyFile.buffer);
  const transparencyWorksheet = transparencyWorkbook.getWorksheet("Item Transparency");

  assert.equal(transparencyWorksheet.getRow(11).getCell(1).value, "DLSL Donations");
});

test("donation transparency CSV keeps the donor name in its data row", async () => {
  const file = await buildExportFile(
    buildOptions({
      worksheetName: "Item Transparency",
      reportTitle: "Donation Item Transparency Report",
      columns: TRANSPARENCY_COLUMNS,
      rows: transparencyRows,
      format: "csv",
    }),
  );

  assert.match(file.buffer.toString("utf8"), /DLSL Donations/);
});

test("donation PDF exports use the inventory-style wide layout for both reports", async () => {
  const reportCases = [
    {
      worksheetName: "Received Donations",
      reportTitle: "Received Donations Report",
      columns: RECEIVED_COLUMNS,
      rows: [
        ...receivedRows,
        { ...receivedRows[0], donor_name: "Another Donor" },
      ],
    },
    {
      worksheetName: "Item Transparency",
      reportTitle: "Donation Item Transparency Report",
      columns: TRANSPARENCY_COLUMNS,
      rows: [
        ...transparencyRows,
        { ...transparencyRows[0], donor_name: "Another Donor" },
      ],
    },
  ];

  for (const reportCase of reportCases) {
    const file = await buildExportFile(
      buildOptions({ ...reportCase, format: "pdf" }),
    );
    const pdfText = parsePdfTextFragments(file.buffer).join(" ");
    const pdfSource = file.buffer.toString("latin1");

    assert.equal(file.contentType, "application/pdf");
    assert.match(pdfSource, /MediaBox \[0 0 1191 842\]/);
    assert.match(pdfSource, /0\.31 0\.53 0\.75 rg/);
    assert.match(pdfSource, /0\.97 0\.98 0\.99 rg/);
    assert.match(pdfText, new RegExp(reportCase.reportTitle));
    assert.match(
      pdfText,
      new RegExp(reportCase.rows[0].donor_name),
    );
    reportCase.columns.forEach((column) => {
      assert.match(pdfText, new RegExp(column.label));
    });
  }
});
