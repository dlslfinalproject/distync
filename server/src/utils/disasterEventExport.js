const ExcelJS = require("exceljs");
const reportExport = require("./masterlistExport");

const EXPORT_COLUMNS = [
  { key: "name", label: "Name", width: 32 },
  { key: "disaster_type", label: "Disaster Type", width: 24 },
  { key: "affected_barangays", label: "Affected Barangays", width: 42 },
  { key: "start_date", label: "Start Date", width: 16 },
  { key: "end_date", label: "End Date", width: 16 },
  { key: "status", label: "Status", width: 14 },
];

const SCOPE_LABELS = {
  active: "Active Events",
  closed: "Ended Events",
  all: "All Events",
};

const CONTENT_TYPES = {
  csv: "text/csv; charset=utf-8",
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

const formatDate = (value) => {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const formatGeneratedAt = () => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
};

const slugifyFilePart = (value, fallback) => {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
};

const getDateStamp = () => {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/-/g, "");
};

const buildFilename = ({ scope, format, eventLabel }) => {
  const extensionMap = {
    csv: "csv",
    excel: "xlsx",
    pdf: "pdf",
  };

  const reportScope = eventLabel || SCOPE_LABELS[scope];

  return `mswdo-disaster-events-${slugifyFilePart(
    reportScope,
    "all-events",
  )}-${getDateStamp()}.${extensionMap[format]}`;
};

const getReportTitle = (eventLabel) =>
  eventLabel ? "Disaster Event Report" : "Disaster Events Report";

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

const wrapText = (value, maxLength) => {
  const words = String(value ?? "--").split(/\s+/);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length > maxLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }

    currentLine = nextLine;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length ? lines : ["--"];
};

const buildTitleLines = ({ scope, search, eventLabel, totalRows }) => {
  return [
    "DISTYNC",
    "Municipality of Malvar Disaster Relief Management System",
    getReportTitle(eventLabel),
    ...(eventLabel ? [`Disaster Event: ${eventLabel}`] : []),
    `Tab: ${SCOPE_LABELS[scope] || SCOPE_LABELS.all}`,
    `Search: ${search?.trim() || "None"}`,
    `Generated: ${formatGeneratedAt()}`,
    `Total Rows: ${totalRows}`,
  ];
};

const buildCsvBuffer = ({ rows, scope, search, eventLabel }) => {
  const titleLines = buildTitleLines({
    scope,
    search,
    eventLabel,
    totalRows: rows.length,
  });
  const columnLine = EXPORT_COLUMNS.map((column) =>
    escapeCsvValue(column.label),
  ).join(",");
  const dataLines = rows.map((row) =>
    EXPORT_COLUMNS.map((column) => escapeCsvValue(row[column.key])).join(","),
  );
  const content = [...titleLines, "", columnLine, ...dataLines].join("\r\n");

  return Buffer.from(content, "utf8");
};

const buildExcelBuffer = async ({ rows, scope, search, eventLabel }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DISTYNC";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Disaster Events", {
    views: [{ state: "frozen", ySplit: 9 }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  worksheet.columns = EXPORT_COLUMNS.map((column) => ({
    key: column.key,
    width: column.width,
  }));
  reportExport.addWorkbookLogo(workbook, worksheet);

  worksheet.mergeCells(1, 2, 1, EXPORT_COLUMNS.length);
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
  worksheet.getCell("B1").alignment = { horizontal: "left", vertical: "middle" };
  worksheet.mergeCells(2, 2, 2, EXPORT_COLUMNS.length);
  worksheet.getCell("B2").value = getReportTitle(eventLabel);
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
  worksheet.getCell("B2").alignment = { horizontal: "left", vertical: "middle" };
  worksheet.getRow(1).height = 28;
  worksheet.getRow(2).height = 24;

  buildTitleLines({ scope, search, eventLabel, totalRows: rows.length })
    .slice(3)
    .forEach((line, index) => {
      const row = worksheet.getRow(index + 4);
      row.getCell(1).value = line;
      row.getCell(1).font = { bold: index === 0 };
    });

  const headerRowNumber = 9;
  const headerRow = worksheet.getRow(headerRowNumber);
  EXPORT_COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2F6499" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  if (rows.length === 0) {
    worksheet.mergeCells(headerRowNumber + 1, 1, headerRowNumber + 1, EXPORT_COLUMNS.length);
    worksheet.getCell(`A${headerRowNumber + 1}`).value =
      "No data available for the selected filters.";
  } else {
    rows.forEach((eventRow, index) => {
      const row = worksheet.getRow(headerRowNumber + 1 + index);

      EXPORT_COLUMNS.forEach((column, columnIndex) => {
        const cell = row.getCell(columnIndex + 1);
        cell.value = eventRow[column.key];
        cell.alignment = {
          vertical: "top",
          horizontal: column.key === "status" ? "center" : "left",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD9E3F0" } },
          left: { style: "thin", color: { argb: "FFD9E3F0" } },
          bottom: { style: "thin", color: { argb: "FFD9E3F0" } },
          right: { style: "thin", color: { argb: "FFD9E3F0" } },
        };
      });
    });
  }

  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: EXPORT_COLUMNS.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

const buildPdfBuffer = ({ rows, scope, search, eventLabel }) => {
  const pages = [];
  let page = null;
  let cursorY = 555;

  const addText = (text, x, y, options = {}) => {
    page.drawText(text, x, y, {
      font: options.bold ? "F2" : "F1",
      size: options.size || 9,
      color: options.color || reportExport.PDF_COLORS.bodyText,
    });
  };
  const finishPage = () => {
    addText(`Page ${pages.length + 1}`, 760, 24);
    pages.push(page);
    cursorY = 555;
  };
  const startPage = () => {
    page = reportExport.createPdfBuilder({ width: 842, height: 595 });
    page.fillRect(40, 505, 762, 64, reportExport.PDF_COLORS.navy);
    page.fillRect(58, 519, 40, 40, reportExport.PDF_COLORS.white);
    if (reportExport.PDF_IMAGE_REGISTRY.distyncLogo) {
      page.drawImage("distyncLogo", 60, 521, 36, 36);
    }
    addText("DISTYNC", 112, 545, {
      bold: true,
      size: 18,
      color: reportExport.PDF_COLORS.white,
    });
    addText(`MSWDO ${getReportTitle(eventLabel)}`, 112, 524, {
      bold: true,
      size: 14,
      color: reportExport.PDF_COLORS.white,
    });
    cursorY = 480;
    addText(`Tab: ${SCOPE_LABELS[scope] || SCOPE_LABELS.all}`, 40, cursorY);
    addText(`Search: ${search?.trim() || "None"}`, 230, cursorY);
    addText(`Rows: ${rows.length}`, 460, cursorY);
    addText(`Generated: ${formatGeneratedAt()}`, 580, cursorY);
    if (eventLabel) {
      cursorY -= 14;
      addText(`Disaster Event: ${eventLabel}`, 40, cursorY, { bold: true });
    }
    cursorY -= 24;

    EXPORT_COLUMNS.forEach((column, index) => {
      addText(column.label, [40, 190, 300, 555, 635, 710][index], cursorY, {
        bold: true,
      });
    });
    cursorY -= 14;
  };

  startPage();

  if (rows.length === 0) {
    addText("No data available for the selected filters.", 40, cursorY);
  }

  rows.forEach((row) => {
    const nameLines = wrapText(row.name, 22).slice(0, 2);
    const typeLines = wrapText(row.disaster_type, 18).slice(0, 2);
    const affectedLines = wrapText(row.affected_barangays, 35);
    const rowHeight =
      Math.max(nameLines.length, typeLines.length, affectedLines.length, 1) * 11 + 8;

    if (cursorY - rowHeight < 42) {
      finishPage();
      startPage();
    }

    nameLines.forEach((line, index) => addText(line, 40, cursorY - index * 11));
    typeLines.forEach((line, index) => addText(line, 190, cursorY - index * 11));
    affectedLines.forEach((line, index) =>
      addText(line, 300, cursorY - index * 11),
    );
    addText(row.start_date, 555, cursorY);
    addText(row.end_date, 635, cursorY);
    addText(row.status, 710, cursorY);
    cursorY -= rowHeight;
  });

  finishPage();

  return reportExport.createPdfDocument(pages, reportExport.PDF_IMAGE_REGISTRY);
};

const buildExportFile = async ({ rows, scope, search, eventLabel, format }) => {
  const builders = {
    csv: buildCsvBuffer,
    excel: buildExcelBuffer,
    pdf: buildPdfBuffer,
  };

  const buffer = await builders[format]({ rows, scope, search, eventLabel });

  return {
    buffer,
    contentType: CONTENT_TYPES[format],
    filename: buildFilename({ scope, format, eventLabel }),
  };
};

module.exports = {
  buildExportFile,
  formatDate,
};
