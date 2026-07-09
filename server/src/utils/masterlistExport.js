const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const ExcelJS = require("exceljs");

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatStayTypeLabel = (value) => {
  if (!value) {
    return "-";
  }

  if (value === "EVAC_CENTER") {
    return "Evacuation Center";
  }

  if (value === "RELATIVES") {
    return "Staying with Relatives";
  }

  if (value === "OTHER_SAFE_PLACE") {
    return "Other Safe Place";
  }

  return value;
};

const shouldUseStayTypeAsArrivalText = (household) => {
  const stayType = String(household?.current_stay_type || "").toUpperCase();

  return (
    (stayType === "RELATIVES" || stayType === "OTHER_SAFE_PLACE") &&
    !household?.latest_attendance?.time_in
  );
};

const buildSectorsText = (household) => {
  const householdSectorNames = (household.household_sectors || []).map(
    (sector) => sector.name,
  );
  const memberSectorNames = (household.members || []).flatMap((member) =>
    (member.sectors || []).map((sector) => sector.name),
  );

  const uniqueSectorNames = [
    ...new Set([...householdSectorNames, ...memberSectorNames]),
  ];

  return uniqueSectorNames.length > 0 ? uniqueSectorNames.join(", ") : "-";
};

const getHouseholdLocationLabel = (household) => {
  if (household.residency_status === "NON_RESIDENT") {
    return "Non-Resident (Outside Malvar)";
  }

  return household.barangay?.name || "-";
};

const mapHouseholdToExportRow = (household) => {
  const departureTimeValue = household.latest_attendance?.time_out || null;
  const locationLabel = getHouseholdLocationLabel(household);
  const useStayTypeAsArrivalText = shouldUseStayTypeAsArrivalText(household);

  return {
    family_head_name: household.family_head_name || "-",
    address: household.current_address_details || locationLabel || "-",
    members_count: household.members?.length || 0,
    sectors_text: buildSectorsText(household),
    arrival_time_text: useStayTypeAsArrivalText
      ? formatStayTypeLabel(household.current_stay_type)
      : formatDateTime(household.latest_attendance?.time_in),
    departure_time_text: formatDateTime(departureTimeValue),
    barangay_name: household.barangay?.name || "",
    registered_at: household.registered_at || null,
  };
};

const formatSearchValue = (value) => {
  return value ? String(value).toLowerCase() : "";
};

const filterExportRows = (rows, searchTerm) => {
  if (!searchTerm || !searchTerm.trim()) {
    return rows;
  }

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  return rows.filter((row) => {
    const searchableValues = [
      row.family_head_name,
      row.address,
      row.sectors_text,
      row.arrival_time_text,
      row.departure_time_text,
      row.barangay_name,
    ];

    return searchableValues.some((value) =>
      formatSearchValue(value).includes(normalizedSearchTerm),
    );
  });
};

const sortExportRows = (rows, sortOrder = "newest") => {
  const safeRows = Array.isArray(rows) ? [...rows] : [];

  return safeRows.sort((leftRow, rightRow) => {
    if (sortOrder === "oldest" || sortOrder === "newest") {
      const leftTime = new Date(leftRow?.registered_at || 0).getTime();
      const rightTime = new Date(rightRow?.registered_at || 0).getTime();

      if (leftTime !== rightTime) {
        return sortOrder === "oldest"
          ? leftTime - rightTime
          : rightTime - leftTime;
      }
    }

    const leftName = String(leftRow?.family_head_name || "").trim().toUpperCase();
    const rightName = String(rightRow?.family_head_name || "").trim().toUpperCase();

    if (leftName !== rightName) {
      if (sortOrder === "za") {
        return rightName.localeCompare(leftName);
      }

      return leftName.localeCompare(rightName);
    }

    const leftTime = new Date(leftRow?.registered_at || 0).getTime();
    const rightTime = new Date(rightRow?.registered_at || 0).getTime();
    return rightTime - leftTime;
  });
};

const getExportColumns = (includeBarangayColumn = false) => {
  const columns = [];

  if (includeBarangayColumn) {
    columns.push({ key: "barangay_name", label: "Barangay" });
  }

  columns.push(
    { key: "family_head_name", label: "Family Head" },
    { key: "address", label: "Address" },
    { key: "members_count", label: "Members" },
    { key: "sectors_text", label: "Sectors" },
    { key: "arrival_time_text", label: "Arrival Time" },
    { key: "departure_time_text", label: "Departure Time" },
  );

  return columns;
};

const getExcelExportColumns = (includeBarangayColumn) => {
  const columns = [];

  if (includeBarangayColumn) {
    columns.push({
      key: "barangay_name",
      label: "Barangay",
      width: 22,
      alignment: { vertical: "middle", horizontal: "left" },
    });
  }

  columns.push(
    {
      key: "family_head_name",
      label: "Family Head",
      width: 28,
      alignment: { vertical: "middle", horizontal: "left" },
    },
    {
      key: "address",
      label: "Address",
      width: 34,
      alignment: { vertical: "top", horizontal: "left", wrapText: true },
    },
    {
      key: "members_count",
      label: "Members",
      width: 12,
      alignment: { vertical: "middle", horizontal: "center" },
    },
    {
      key: "sectors_text",
      label: "Sectors",
      width: 30,
      alignment: { vertical: "top", horizontal: "left", wrapText: true },
    },
    {
      key: "arrival_time_text",
      label: "Arrival Time",
      width: 22,
      alignment: { vertical: "middle", horizontal: "center", wrapText: true },
    },
    {
      key: "departure_time_text",
      label: "Departure Time",
      width: 22,
      alignment: { vertical: "middle", horizontal: "center", wrapText: true },
    },
  );

  return columns;
};

const getPdfExportColumns = (includeBarangayColumn) => {
  const columns = [];

  if (includeBarangayColumn) {
    columns.push({ key: "barangay_name", label: "Barangay", width: 88 });
  }

  columns.push(
    { key: "family_head_name", label: "Family Head", width: 110 },
    { key: "address", label: "Address", width: 145 },
    { key: "members_count", label: "Members", width: 42 },
    { key: "sectors_text", label: "Sectors", width: 115 },
    { key: "arrival_time_text", label: "Arrival Time", width: 70 },
    { key: "departure_time_text", label: "Departure Time", width: 70 },
  );

  return columns;
};

const escapeCsvValue = (value) => {
  const stringValue = value === null || value === undefined ? "" : String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes("\"") ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }

  return stringValue;
};

const buildCsvBuffer = ({ titleLines, columns, rows }) => {
  const headerLines = titleLines.map((line) => escapeCsvValue(line));
  const columnLine = columns.map((column) => escapeCsvValue(column.label)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((column) => escapeCsvValue(row[column.key])).join(","),
  );

  const content = [...headerLines, "", columnLine, ...dataLines].join("\r\n");
  return Buffer.from(content, "utf8");
};

const escapeXml = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const buildSpreadsheetCell = (value) => {
  const normalizedValue = value === null || value === undefined ? "" : value;
  const isNumeric =
    typeof normalizedValue === "number" ||
    (typeof normalizedValue === "string" &&
      normalizedValue.trim() !== "" &&
      !Number.isNaN(Number(normalizedValue)));

  if (isNumeric && normalizedValue !== "") {
    return `<Cell><Data ss:Type="Number">${Number(normalizedValue)}</Data></Cell>`;
  }

  return `<Cell><Data ss:Type="String">${escapeXml(normalizedValue)}</Data></Cell>`;
};

const applyExcelCellBorder = (cell) => {
  cell.border = {
    top: { style: "thin", color: { argb: "FFD9E3F0" } },
    left: { style: "thin", color: { argb: "FFD9E3F0" } },
    bottom: { style: "thin", color: { argb: "FFD9E3F0" } },
    right: { style: "thin", color: { argb: "FFD9E3F0" } },
  };
};

const styleSummaryCard = (worksheet, rowNumber, startColumnNumber, label, value) => {
  const labelCell = worksheet.getCell(rowNumber, startColumnNumber);
  const valueCell = worksheet.getCell(rowNumber + 1, startColumnNumber);
  const mergedEndColumn = startColumnNumber + 2;

  worksheet.mergeCells(rowNumber, startColumnNumber, rowNumber, mergedEndColumn);
  worksheet.mergeCells(
    rowNumber + 1,
    startColumnNumber,
    rowNumber + 1,
    mergedEndColumn,
  );

  labelCell.value = label;
  labelCell.font = { bold: true, size: 10, color: { argb: "FF4F6478" } };
  labelCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF0F6FC" },
  };
  labelCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  applyExcelCellBorder(labelCell);

  valueCell.value = value;
  valueCell.font = { bold: true, size: 14, color: { argb: "FF17324D" } };
  valueCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF0F6FC" },
  };
  valueCell.alignment = { vertical: "middle", horizontal: "left" };
  applyExcelCellBorder(valueCell);

  for (let currentColumn = startColumnNumber + 1; currentColumn <= mergedEndColumn; currentColumn += 1) {
    applyExcelCellBorder(worksheet.getCell(rowNumber, currentColumn));
    applyExcelCellBorder(worksheet.getCell(rowNumber + 1, currentColumn));
  }
};

const setWorksheetMargins = (worksheet) => {
  worksheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.35,
      right: 0.35,
      top: 0.5,
      bottom: 0.5,
      header: 0.25,
      footer: 0.25,
    },
  };
};

const addWorkbookLogo = (workbook, worksheet) => {
  if (!fs.existsSync(DISTYNC_LOGO_PATH)) {
    return;
  }

  const logoImageId = workbook.addImage({
    filename: DISTYNC_LOGO_PATH,
    extension: "png",
  });

  worksheet.addImage(logoImageId, {
    tl: { col: 0.2, row: 0.25 },
    ext: { width: 56, height: 56 },
  });
};

const buildExcelHeaderSection = ({
  worksheet,
  lastColumnLetter,
  eventLabel,
  barangayLabel,
  searchTerm,
  generatedAtLabel,
  totalRows,
}) => {
  worksheet.mergeCells(`B1:${lastColumnLetter}1`);
  worksheet.getCell("B1").value = "DISTYNC";
  worksheet.getCell("B1").font = {
    bold: true,
    size: 18,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getCell("B1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF17324D" },
  };
  worksheet.getCell("B1").alignment = {
    vertical: "middle",
    horizontal: "left",
  };

  worksheet.mergeCells(`B2:${lastColumnLetter}2`);
  worksheet.getCell("B2").value = "MSWDO Evacuee Masterlist Report";
  worksheet.getCell("B2").font = {
    bold: true,
    size: 14,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getCell("B2").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF17324D" },
  };
  worksheet.getCell("B2").alignment = {
    vertical: "middle",
    horizontal: "left",
  };

  worksheet.getRow(1).height = 28;
  worksheet.getRow(2).height = 24;

  const contextRows = [
    ["Disaster Event", eventLabel],
    ["Barangay Filter", barangayLabel],
    ["Generated", generatedAtLabel],
    ["Total Rows Exported", totalRows],
  ];

  if (searchTerm && searchTerm.trim()) {
    contextRows.splice(2, 0, ["Search Filter", searchTerm.trim()]);
  }

  let currentRowNumber = 4;
  contextRows.forEach(([label, value]) => {
    worksheet.getCell(`A${currentRowNumber}`).value = label;
    worksheet.getCell(`A${currentRowNumber}`).font = {
      bold: true,
      color: { argb: "FF4F6478" },
    };
    worksheet.mergeCells(`B${currentRowNumber}:${lastColumnLetter}${currentRowNumber}`);
    worksheet.getCell(`B${currentRowNumber}`).value = value;
    worksheet.getCell(`B${currentRowNumber}`).alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };
    currentRowNumber += 1;
  });

  return currentRowNumber;
};

const populateMasterlistSheetRows = ({
  worksheet,
  columns,
  tableHeaderRowNumber,
  rows,
  lastColumnLetter,
}) => {
  const tableHeaderRow = worksheet.getRow(tableHeaderRowNumber);
  columns.forEach((column, index) => {
    const cell = tableHeaderRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F86BE" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    applyExcelCellBorder(cell);
  });
  tableHeaderRow.height = 24;

  let tableEndRowNumber = tableHeaderRowNumber;

  if (rows.length === 0) {
    worksheet.mergeCells(
      `A${tableHeaderRowNumber + 1}:${lastColumnLetter}${tableHeaderRowNumber + 1}`,
    );
    const emptyStateCell = worksheet.getCell(`A${tableHeaderRowNumber + 1}`);
    emptyStateCell.value = "No data available for the selected filters.";
    emptyStateCell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    emptyStateCell.font = {
      italic: true,
      color: { argb: "FF6B7E90" },
    };
    applyExcelCellBorder(emptyStateCell);
    tableEndRowNumber = tableHeaderRowNumber + 1;
  } else {
    rows.forEach((row, rowIndex) => {
      const worksheetRowNumber = tableHeaderRowNumber + 1 + rowIndex;
      const worksheetRow = worksheet.getRow(worksheetRowNumber);

      columns.forEach((column, columnIndex) => {
        worksheetRow.getCell(columnIndex + 1).value = row[column.key];
      });

      worksheetRow.eachCell((cell, columnNumber) => {
        cell.alignment = columns[columnNumber - 1].alignment;
        applyExcelCellBorder(cell);
        if (rowIndex % 2 === 1) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FBFE" },
          };
        }
      });

      const estimatedHeight = columns.reduce((maxHeight, column) => {
        const cellValue = String(row[column.key] ?? "");
        if (!column.alignment?.wrapText) {
          return maxHeight;
        }

        const charactersPerLine = Math.max(
          12,
          Math.floor((column.width || 20) * 1.15),
        );
        const lineCount = Math.max(1, Math.ceil(cellValue.length / charactersPerLine));
        return Math.max(maxHeight, lineCount * 15);
      }, 22);

      worksheetRow.height = Math.min(Math.max(estimatedHeight, 22), 60);
      worksheetRow.commit();
    });

    tableEndRowNumber = tableHeaderRowNumber + rows.length;
    worksheet.autoFilter = {
      from: {
        row: tableHeaderRowNumber,
        column: 1,
      },
      to: {
        row: tableEndRowNumber,
        column: columns.length,
      },
    };
  }

  return tableEndRowNumber;
};

const buildExcelBuffer = async ({
  worksheetName,
  rows,
  summaryMetrics,
  eventLabel,
  barangayLabel,
  searchTerm,
  includeBarangayColumn,
}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DISTYNC";
  workbook.company = "DISTYNC";
  workbook.created = new Date();
  workbook.modified = new Date();
  const summaryWorksheet = workbook.addWorksheet("Summary", {
    properties: {
      defaultRowHeight: 20,
    },
  });
  const masterlistWorksheet = workbook.addWorksheet(worksheetName, {
    properties: {
      defaultRowHeight: 20,
    },
  });
  const columns = getExcelExportColumns(includeBarangayColumn);
  summaryWorksheet.columns = [
    { width: 20 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
    { width: 22 },
  ];
  masterlistWorksheet.columns = columns.map((column) => ({
    key: column.key,
    width: column.width,
    style: {
      alignment: column.alignment,
    },
  }));

  const generatedAtLabel = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

  setWorksheetMargins(summaryWorksheet);
  setWorksheetMargins(masterlistWorksheet);
  addWorkbookLogo(workbook, summaryWorksheet);
  addWorkbookLogo(workbook, masterlistWorksheet);

  const summaryLastColumnLetter = summaryWorksheet.getColumn(6).letter;
  let currentRowNumber = buildExcelHeaderSection({
    worksheet: summaryWorksheet,
    lastColumnLetter: summaryLastColumnLetter,
    eventLabel,
    barangayLabel,
    searchTerm,
    generatedAtLabel,
    totalRows: rows.length,
  });

  currentRowNumber += 1;
  summaryWorksheet.mergeCells(
    `A${currentRowNumber}:${summaryLastColumnLetter}${currentRowNumber}`,
  );
  summaryWorksheet.getCell(`A${currentRowNumber}`).value = "Summary";
  summaryWorksheet.getCell(`A${currentRowNumber}`).font = {
    bold: true,
    size: 13,
    color: { argb: "FF17324D" },
  };
  currentRowNumber += 1;

  const summaryCards = [
    [
      "Total Number of Evacuees (Individuals)",
      Number(summaryMetrics.total_number_of_evacuees_individuals || 0),
    ],
    [
      "Total Number of Families",
      Number(summaryMetrics.total_number_of_families || 0),
    ],
    [
      "Average Household Size",
      Number(summaryMetrics.average_household_size || 0).toFixed(1),
    ],
    [
      "Currently Admitted Evacuees",
      Number(summaryMetrics.currently_admitted_evacuees || 0),
    ],
    [
      "Total Departed Evacuees",
      Number(summaryMetrics.total_departed_evacuees || 0),
    ],
    [
      "Total Barangays Covered",
      Number(summaryMetrics.total_barangays_covered || 0),
    ],
  ];

  const summaryStartRow = currentRowNumber;
  summaryCards.forEach((card, index) => {
    const rowOffset = Math.floor(index / 2) * 3;
    const startColumnNumber = index % 2 === 0 ? 1 : 4;

    styleSummaryCard(
      summaryWorksheet,
      summaryStartRow + rowOffset,
      startColumnNumber,
      card[0],
      card[1],
    );
  });

  summaryWorksheet.views = [
    {
      state: "frozen",
      ySplit: 3,
    },
  ];
  summaryWorksheet.headerFooter.oddFooter =
    "&LDISTYNC MSWDO Summary&RPage &P of &N";

  const masterlistLastColumnLetter =
    masterlistWorksheet.getColumn(columns.length).letter;
  buildExcelHeaderSection({
    worksheet: masterlistWorksheet,
    lastColumnLetter: masterlistLastColumnLetter,
    eventLabel,
    barangayLabel,
    searchTerm,
    generatedAtLabel,
    totalRows: rows.length,
  });

  const tableTitleRowNumber = 9;
  masterlistWorksheet.mergeCells(
    `A${tableTitleRowNumber}:${masterlistLastColumnLetter}${tableTitleRowNumber}`,
  );
  masterlistWorksheet.getCell(`A${tableTitleRowNumber}`).value =
    "Registered Family Masterlist";
  masterlistWorksheet.getCell(`A${tableTitleRowNumber}`).font = {
    bold: true,
    size: 13,
    color: { argb: "FF17324D" },
  };
  const tableHeaderRowNumber = tableTitleRowNumber + 1;
  populateMasterlistSheetRows({
    worksheet: masterlistWorksheet,
    columns,
    tableHeaderRowNumber,
    rows,
    lastColumnLetter: masterlistLastColumnLetter,
  });

  masterlistWorksheet.views = [
    {
      state: "frozen",
      ySplit: tableHeaderRowNumber,
    },
  ];
  masterlistWorksheet.headerFooter.oddFooter =
    "&LMSWDO Registered Family Masterlist&RPage &P of &N";

  const excelBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(excelBuffer);
};

const PDF_COLORS = {
  navy: "0.09 0.20 0.34",
  blue: "0.31 0.53 0.75",
  lightBlue: "0.93 0.96 0.99",
  border: "0.82 0.88 0.93",
  grayText: "0.38 0.46 0.54",
  bodyText: "0.10 0.20 0.32",
  white: "1 1 1",
};

const PNG_COLOR_TYPE_RGBA = 6;
const PNG_FILTER_NONE = 0;
const PNG_FILTER_SUB = 1;
const PNG_FILTER_UP = 2;
const PNG_FILTER_AVERAGE = 3;
const PNG_FILTER_PAETH = 4;
const DISTYNC_LOGO_PATH = path.resolve(
  __dirname,
  "../../../client/src/assets/distync-logo.png",
);

const escapePdfText = (value) => {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
};

const splitLongToken = (word, maxChars) => {
  return word.match(new RegExp(`.{1,${maxChars}}`, "g")) || [word];
};

const wrapPdfText = (text, maxChars) => {
  const normalized = String(text ?? "").trim();

  if (!normalized) {
    return [""];
  }

  const words = normalized.split(/\s+/);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    if (word.length > maxChars) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }

      const chunks = splitLongToken(word, maxChars);
      lines.push(...chunks.slice(0, -1));
      currentLine = chunks[chunks.length - 1];
      return;
    }

    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length <= maxChars) {
      currentLine = candidate;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const estimateMaxChars = (width, fontSize) => {
  return Math.max(4, Math.floor(width / (fontSize * 0.52)));
};

const paethPredictor = (left, up, upLeft) => {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }

  if (upDistance <= upLeftDistance) {
    return up;
  }

  return upLeft;
};

const parsePngChunks = (buffer) => {
  const signature = buffer.slice(0, 8).toString("hex");

  if (signature !== "89504e470d0a1a0a") {
    throw new Error("Invalid PNG signature");
  }

  const chunks = [];
  let offset = 8;

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;

    const type = buffer.slice(offset, offset + 4).toString("ascii");
    offset += 4;

    const data = buffer.slice(offset, offset + length);
    offset += length;
    offset += 4;

    chunks.push({ type, data });

    if (type === "IEND") {
      break;
    }
  }

  return chunks;
};

const decodePngImage = (filePath) => {
  const pngBuffer = fs.readFileSync(filePath);
  const chunks = parsePngChunks(pngBuffer);
  const headerChunk = chunks.find((chunk) => chunk.type === "IHDR");

  if (!headerChunk) {
    throw new Error("PNG header chunk is missing");
  }

  const width = headerChunk.data.readUInt32BE(0);
  const height = headerChunk.data.readUInt32BE(4);
  const bitDepth = headerChunk.data.readUInt8(8);
  const colorType = headerChunk.data.readUInt8(9);
  const interlaceMethod = headerChunk.data.readUInt8(12);

  if (bitDepth !== 8 || colorType !== PNG_COLOR_TYPE_RGBA || interlaceMethod !== 0) {
    throw new Error("Only 8-bit RGBA non-interlaced PNG images are supported");
  }

  const imageData = Buffer.concat(
    chunks
      .filter((chunk) => chunk.type === "IDAT")
      .map((chunk) => chunk.data),
  );
  const inflatedData = zlib.inflateSync(imageData);
  const bytesPerPixel = 4;
  const bytesPerRow = width * bytesPerPixel;
  const rgbaPixels = Buffer.alloc(width * height * bytesPerPixel);

  let inputOffset = 0;
  let outputOffset = 0;

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filterType = inflatedData.readUInt8(inputOffset);
    inputOffset += 1;

    for (let columnIndex = 0; columnIndex < bytesPerRow; columnIndex += 1) {
      const encodedByte = inflatedData.readUInt8(inputOffset);
      inputOffset += 1;

      const left =
        columnIndex >= bytesPerPixel
          ? rgbaPixels.readUInt8(outputOffset + columnIndex - bytesPerPixel)
          : 0;
      const up =
        rowIndex > 0
          ? rgbaPixels.readUInt8(outputOffset + columnIndex - bytesPerRow)
          : 0;
      const upLeft =
        rowIndex > 0 && columnIndex >= bytesPerPixel
          ? rgbaPixels.readUInt8(
              outputOffset + columnIndex - bytesPerRow - bytesPerPixel,
            )
          : 0;

      let decodedByte = encodedByte;

      if (filterType === PNG_FILTER_SUB) {
        decodedByte = (encodedByte + left) & 0xff;
      } else if (filterType === PNG_FILTER_UP) {
        decodedByte = (encodedByte + up) & 0xff;
      } else if (filterType === PNG_FILTER_AVERAGE) {
        decodedByte = (encodedByte + Math.floor((left + up) / 2)) & 0xff;
      } else if (filterType === PNG_FILTER_PAETH) {
        decodedByte = (encodedByte + paethPredictor(left, up, upLeft)) & 0xff;
      } else if (filterType !== PNG_FILTER_NONE) {
        throw new Error(`Unsupported PNG filter type: ${filterType}`);
      }

      rgbaPixels.writeUInt8(decodedByte, outputOffset + columnIndex);
    }

    outputOffset += bytesPerRow;
  }

  const rgbPixels = Buffer.alloc(width * height * 3);
  const alphaPixels = Buffer.alloc(width * height);

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const rgbaOffset = pixelIndex * 4;
    const rgbOffset = pixelIndex * 3;

    rgbPixels.writeUInt8(rgbaPixels.readUInt8(rgbaOffset), rgbOffset);
    rgbPixels.writeUInt8(rgbaPixels.readUInt8(rgbaOffset + 1), rgbOffset + 1);
    rgbPixels.writeUInt8(rgbaPixels.readUInt8(rgbaOffset + 2), rgbOffset + 2);
    alphaPixels.writeUInt8(rgbaPixels.readUInt8(rgbaOffset + 3), pixelIndex);
  }

  return {
    width,
    height,
    rgbData: zlib.deflateSync(rgbPixels),
    alphaData: zlib.deflateSync(alphaPixels),
  };
};

const loadPdfImageRegistry = () => {
  try {
    return {
      distyncLogo: decodePngImage(DISTYNC_LOGO_PATH),
    };
  } catch (_error) {
    return {};
  }
};

const PDF_IMAGE_REGISTRY = loadPdfImageRegistry();

const createPdfBuilder = ({ width, height }) => {
  const operations = [];
  const images = new Set();

  const add = (line) => {
    operations.push(line);
  };

  const fillRect = (x, y, rectWidth, rectHeight, color) => {
    add("q");
    add(`${color} rg`);
    add(`${x.toFixed(2)} ${y.toFixed(2)} ${rectWidth.toFixed(2)} ${rectHeight.toFixed(2)} re f`);
    add("Q");
  };

  const strokeRect = (x, y, rectWidth, rectHeight, color, lineWidth = 1) => {
    add("q");
    add(`${color} RG`);
    add(`${lineWidth.toFixed(2)} w`);
    add(`${x.toFixed(2)} ${y.toFixed(2)} ${rectWidth.toFixed(2)} ${rectHeight.toFixed(2)} re S`);
    add("Q");
  };

  const drawLine = (x1, y1, x2, y2, color, lineWidth = 1) => {
    add("q");
    add(`${color} RG`);
    add(`${lineWidth.toFixed(2)} w`);
    add(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
    add("Q");
  };

  const drawText = (text, x, y, options = {}) => {
    const {
      font = "F1",
      size = 10,
      color = PDF_COLORS.bodyText,
    } = options;

    add("BT");
    add(`/${font} ${size} Tf`);
    add(`${color} rg`);
    add(`1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm`);
    add(`(${escapePdfText(text)}) Tj`);
    add("ET");
  };

  const drawImage = (imageName, x, y, imageWidth, imageHeight) => {
    images.add(imageName);
    add("q");
    add(
      `${imageWidth.toFixed(2)} 0 0 ${imageHeight.toFixed(2)} ${x.toFixed(
        2,
      )} ${y.toFixed(2)} cm`,
    );
    add(`/${imageName} Do`);
    add("Q");
  };

  const getStream = () => operations.join("\n");

  return {
    add,
    drawLine,
    drawImage,
    drawText,
    fillRect,
    getStream,
    height,
    images,
    strokeRect,
    width,
  };
};

const createPdfDocument = (pages, imageRegistry = {}) => {
  const objects = [];

  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const fontRegularId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  );
  const fontBoldId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  );
  const imageObjectMap = {};

  Object.entries(imageRegistry).forEach(([imageName, image]) => {
    const alphaObjectId = addObject(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${image.alphaData.length} >>\nstream\n${image.alphaData.toString(
        "binary",
      )}\nendstream`,
    );
    const imageObjectId = addObject(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask ${alphaObjectId} 0 R /Length ${image.rgbData.length} >>\nstream\n${image.rgbData.toString(
        "binary",
      )}\nendstream`,
    );

    imageObjectMap[imageName] = imageObjectId;
  });

  const pageIds = [];

  pages.forEach((page) => {
    const stream = page.getStream();
    const contentId = addObject(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    );

    const imageResources = [...page.images]
      .filter((imageName) => imageObjectMap[imageName])
      .map((imageName) => `/${imageName} ${imageObjectMap[imageName]} 0 R`)
      .join(" ");
    const xObjectDictionary = imageResources
      ? `/XObject << ${imageResources} >> `
      : "";

    pageIds.push(
      addObject(
        `<< /Type /Page /Parent PAGES_ID 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> ${xObjectDictionary}>> >>`,
      ),
    );
  });

  const pagesId = addObject(
    `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] >>`,
  );

  pageIds.forEach((pageId) => {
    objects[pageId - 1] = objects[pageId - 1].replace("PAGES_ID", String(pagesId));
  });

  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let output = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((objectContent, index) => {
    offsets.push(Buffer.byteLength(output, "latin1"));
    output += `${index + 1} 0 obj\n${objectContent}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(output, "latin1");
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";

  offsets.slice(1).forEach((offset) => {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });

  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
  output += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(output, "latin1");
};

const drawSummaryGrid = (page, items, layout) => {
  const cardWidth = (layout.contentWidth - layout.cardGap) / 2;
  const cardHeight = 58;
  const startX = layout.marginX;
  let currentY = layout.cursorY;

  items.forEach((item, index) => {
    const columnIndex = index % 2;
    const rowIndex = Math.floor(index / 2);
    const x = startX + columnIndex * (cardWidth + layout.cardGap);
    const y = currentY - rowIndex * (cardHeight + layout.cardGap);

    page.fillRect(x, y - cardHeight, cardWidth, cardHeight, PDF_COLORS.lightBlue);
    page.strokeRect(x, y - cardHeight, cardWidth, cardHeight, PDF_COLORS.border, 0.8);
    page.drawText(item.label, x + 10, y - 18, {
      font: "F2",
      size: 9,
      color: PDF_COLORS.grayText,
    });
    page.drawText(String(item.value), x + 10, y - 40, {
      font: "F2",
      size: 16,
      color: PDF_COLORS.navy,
    });
  });

  layout.cursorY =
    currentY -
    Math.ceil(items.length / 2) * cardHeight -
    Math.max(Math.ceil(items.length / 2) - 1, 0) * layout.cardGap -
    18;
};

const drawHeader = (page, context, layout) => {
  page.fillRect(layout.marginX, layout.cursorY - 72, layout.contentWidth, 72, PDF_COLORS.navy);
  page.fillRect(layout.marginX + 18, layout.cursorY - 58, 44, 44, PDF_COLORS.white);

  if (context.logoImageName) {
    page.drawImage(context.logoImageName, layout.marginX + 20, layout.cursorY - 56, 40, 40);
  }

  page.drawText("DISTYNC", layout.marginX + 74, layout.cursorY - 24, {
    font: "F2",
    size: 18,
    color: PDF_COLORS.white,
  });
  page.drawText("MSWDO Evacuee Masterlist Report", layout.marginX + 74, layout.cursorY - 46, {
    font: "F2",
    size: 16,
    color: PDF_COLORS.white,
  });

  let infoY = layout.cursorY - 95;
  const metaRows = [
    `Disaster Event: ${context.eventLabel}`,
    `Barangay Filter: ${context.barangayLabel}`,
    `Generated: ${context.generatedAtLabel}`,
    `Total Rows Exported: ${context.totalRows}`,
  ];

  if (context.searchTerm) {
    metaRows.splice(2, 0, `Search Filter: ${context.searchTerm}`);
  }

  metaRows.forEach((line) => {
    page.drawText(line, layout.marginX, infoY, {
      size: 10,
      color: PDF_COLORS.bodyText,
    });
    infoY -= 14;
  });

  layout.cursorY = infoY - 12;
};

const drawSummarySection = (page, summaryMetrics, layout) => {
  page.drawText("Summary", layout.marginX, layout.cursorY, {
    font: "F2",
    size: 13,
    color: PDF_COLORS.navy,
  });
  layout.cursorY -= 12;
  page.drawLine(layout.marginX, layout.cursorY, layout.marginX + layout.contentWidth, layout.cursorY, PDF_COLORS.border, 1);
  layout.cursorY -= 12;

  drawSummaryGrid(
    page,
    [
      {
        label: "Total Number of Evacuees (Individuals)",
        value: summaryMetrics.total_number_of_evacuees_individuals,
      },
      {
        label: "Total Number of Families",
        value: summaryMetrics.total_number_of_families,
      },
      {
        label: "Average Household Size",
        value: Number(summaryMetrics.average_household_size || 0).toFixed(1),
      },
      {
        label: "Currently Admitted Evacuees",
        value: summaryMetrics.currently_admitted_evacuees,
      },
      {
        label: "Total Departed Evacuees",
        value: summaryMetrics.total_departed_evacuees,
      },
      {
        label: "Total Barangays Covered",
        value: summaryMetrics.total_barangays_covered,
      },
    ],
    layout,
  );
};

const drawTableHeader = (page, columns, layout) => {
  const headerHeight = 24;
  page.fillRect(layout.marginX, layout.cursorY - headerHeight, layout.contentWidth, headerHeight, PDF_COLORS.blue);
  page.strokeRect(layout.marginX, layout.cursorY - headerHeight, layout.contentWidth, headerHeight, PDF_COLORS.border, 0.8);

  let columnX = layout.marginX;
  columns.forEach((column, index) => {
    page.drawText(column.label, columnX + 6, layout.cursorY - 16, {
      font: "F2",
      size: 8,
      color: PDF_COLORS.white,
    });

    if (index < columns.length - 1) {
      page.drawLine(
        columnX + column.width,
        layout.cursorY,
        columnX + column.width,
        layout.cursorY - headerHeight,
        PDF_COLORS.border,
        0.6,
      );
    }

    columnX += column.width;
  });

  layout.cursorY -= headerHeight;
};

const calculateRowLayout = (row, columns) => {
  const lineHeight = 10;
  const cellLines = columns.map((column) => {
    const value = row[column.key] === null || row[column.key] === undefined
      ? "-"
      : row[column.key];
    const wrappedLines = wrapPdfText(
      String(value),
      estimateMaxChars(column.width - 12, 8),
    );

    return wrappedLines;
  });

  const maxLines = Math.max(...cellLines.map((lines) => lines.length), 1);
  const rowHeight = Math.max(24, maxLines * lineHeight + 8);

  return {
    cellLines,
    lineHeight,
    rowHeight,
  };
};

const drawTableRow = (page, row, columns, layout, rowIndex) => {
  const { cellLines, lineHeight, rowHeight } = calculateRowLayout(row, columns);
  const backgroundColor = rowIndex % 2 === 0 ? PDF_COLORS.white : "0.97 0.98 0.99";

  page.fillRect(layout.marginX, layout.cursorY - rowHeight, layout.contentWidth, rowHeight, backgroundColor);
  page.strokeRect(layout.marginX, layout.cursorY - rowHeight, layout.contentWidth, rowHeight, PDF_COLORS.border, 0.6);

  let columnX = layout.marginX;
  columns.forEach((column, index) => {
    if (index < columns.length - 1) {
      page.drawLine(
        columnX + column.width,
        layout.cursorY,
        columnX + column.width,
        layout.cursorY - rowHeight,
        PDF_COLORS.border,
        0.5,
      );
    }

    cellLines[index].forEach((line, lineIndex) => {
      page.drawText(line, columnX + 6, layout.cursorY - 14 - lineIndex * lineHeight, {
        size: 8,
        color: PDF_COLORS.bodyText,
      });
    });

    columnX += column.width;
  });

  layout.cursorY -= rowHeight;
};

const drawFooter = (page, context, pageNumber, totalPages, layout) => {
  page.drawLine(layout.marginX, 34, layout.marginX + layout.contentWidth, 34, PDF_COLORS.border, 0.8);
  page.drawText(
    `${context.eventCode || "EVENT"} | ${context.barangayLabel}`,
    layout.marginX,
    20,
    {
      size: 8,
      color: PDF_COLORS.grayText,
    },
  );
  page.drawText(
    `Page ${pageNumber} of ${totalPages}`,
    layout.marginX + layout.contentWidth - 60,
    20,
    {
      size: 8,
      color: PDF_COLORS.grayText,
    },
  );
};

const buildPdfPages = ({ rows, summaryMetrics, context, columns }) => {
  const pageWidth = 842;
  const pageHeight = 595;
  const layout = {
    marginX: 36,
    topY: pageHeight - 36,
    bottomY: 48,
    contentWidth: pageWidth - 72,
    cardGap: 12,
  };

  const pages = [];
  let page = createPdfBuilder({ width: pageWidth, height: pageHeight });
  let pageLayout = {
    ...layout,
    cursorY: layout.topY,
  };
  let rowIndex = 0;

  const startNewPage = () => {
    page = createPdfBuilder({ width: pageWidth, height: pageHeight });
    pageLayout = {
      ...layout,
      cursorY: layout.topY,
    };
    pages.push(page);
  };

  startNewPage();
  drawHeader(page, context, pageLayout);
  drawSummarySection(page, summaryMetrics, pageLayout);
  page.drawText("Registered Family Masterlist", layout.marginX, pageLayout.cursorY, {
    font: "F2",
    size: 13,
    color: PDF_COLORS.navy,
  });
  pageLayout.cursorY -= 12;
  drawTableHeader(page, columns, pageLayout);

  if (rows.length === 0) {
    page.drawText("No data available for the selected filters.", layout.marginX, pageLayout.cursorY - 18, {
      size: 10,
      color: PDF_COLORS.grayText,
    });
    pageLayout.cursorY -= 36;
  }

  rows.forEach((row) => {
    const projectedRow = calculateRowLayout(row, columns);

    if (pageLayout.cursorY - projectedRow.rowHeight < layout.bottomY) {
      startNewPage();
      drawHeader(page, context, pageLayout);
      page.drawText("Registered Family Masterlist", layout.marginX, pageLayout.cursorY, {
        font: "F2",
        size: 13,
        color: PDF_COLORS.navy,
      });
      pageLayout.cursorY -= 12;
      drawTableHeader(page, columns, pageLayout);
    }

    drawTableRow(page, row, columns, pageLayout, rowIndex);
    rowIndex += 1;
  });

  pages.forEach((currentPage, index) => {
    drawFooter(currentPage, context, index + 1, pages.length, layout);
  });

  return pages;
};

const buildPdfBuffer = ({
  rows,
  summaryMetrics,
  eventLabel,
  eventCode,
  barangayLabel,
  searchTerm,
  includeBarangayColumn,
}) => {
  const generatedAtLabel = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

  const columns = getPdfExportColumns(includeBarangayColumn);
  const pages = buildPdfPages({
    rows,
    summaryMetrics,
    context: {
      eventCode,
      eventLabel,
      barangayLabel,
      generatedAtLabel,
      logoImageName: PDF_IMAGE_REGISTRY.distyncLogo ? "distyncLogo" : null,
      searchTerm,
      totalRows: rows.length,
    },
    columns,
  });

  return createPdfDocument(pages, PDF_IMAGE_REGISTRY);
};

const slugifyFilePart = (value, fallback) => {
  const normalizedValue = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedValue || fallback;
};

const buildExportFilename = ({ eventCode, barangayName, format }) => {
  const normalizedEvent = slugifyFilePart(eventCode, "masterlist");
  const normalizedBarangay = slugifyFilePart(barangayName, "all-barangays");
  const extensionMap = {
    csv: "csv",
    excel: "xls",
    pdf: "pdf",
  };

  return `mswdo-evacuee-masterlist-${normalizedEvent}-${normalizedBarangay}.${extensionMap[format]}`;
};

const buildPdfFilename = ({ eventCode, barangayName }) => {
  const dateStamp = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/-/g, "");

  return `mswdo_evacuee_masterlist_${slugifyFilePart(
    eventCode,
    "masterlist",
  )}_${slugifyFilePart(barangayName, "all-barangays")}_${dateStamp}.pdf`;
};

const buildExcelFilename = ({ eventCode, barangayName }) => {
  const dateStamp = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/-/g, "");

  return `mswdo_evacuee_masterlist_${slugifyFilePart(
    eventCode,
    "masterlist",
  )}_${slugifyFilePart(barangayName, "all-barangays")}_${dateStamp}.xlsx`;
};

const buildExportTitleLines = ({ eventLabel, barangayLabel, searchTerm }) => {
  const titleLines = [
    "DISTYNC MSWDO Evacuee Masterlist Report",
    `Disaster Event: ${eventLabel}`,
    `Barangay Filter: ${barangayLabel}`,
  ];

  if (searchTerm && searchTerm.trim()) {
    titleLines.push(`Search Filter: ${searchTerm.trim()}`);
  }

  titleLines.push(
    `Generated: ${new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date())}`,
  );

  return titleLines;
};

module.exports = {
  addWorkbookLogo,
  buildCsvBuffer,
  buildExcelBuffer,
  buildExportColumns: getExportColumns,
  buildExportFilename,
  buildExportTitleLines,
  buildExcelFilename,
  createPdfBuilder,
  createPdfDocument,
  PDF_COLORS,
  PDF_IMAGE_REGISTRY,
  buildPdfBuffer,
  buildPdfFilename,
  filterExportRows,
  sortExportRows,
  mapHouseholdToExportRow,
};
