const ExcelJS = require("exceljs");
const reportExport = require("./masterlistExport");

const EXPORT_COLUMNS = [
  { key: "item_name", label: "Item Name", width: 30 },
  { key: "category", label: "Category", width: 20 },
  { key: "quantity", label: "Quantity", width: 42 },
  { key: "expiration_date", label: "Expiry Date", width: 18 },
  { key: "status", label: "Status", width: 16 },
];

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

const getDateStamp = () => {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/-/g, "");
};

const buildFilename = (format) => {
  const extensionMap = {
    csv: "csv",
    excel: "xlsx",
    pdf: "pdf",
  };

  return `office-mayor-inventory-items-${getDateStamp()}.${
    extensionMap[format]
  }`;
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

const buildTitleLines = ({ filters, totalRows }) => {
  const searchLabel = filters.search?.trim() || "None";
  const categoryLabel =
    filters.is_perishable === true
      ? "Perishable"
      : filters.is_perishable === false
        ? "Non-Perishable"
        : filters.category || "All";

  return [
    "DISTYNC",
    "Office of the Mayor",
    "Municipality of Malvar, Batangas",
    "Inventory Items Report",
    `Search: ${searchLabel}`,
    `Category: ${categoryLabel || "All"}`,
    `Status: ${filters.status || "All"}`,
    `Generated: ${formatGeneratedAt()}`,
    `Total Rows: ${totalRows}`,
  ];
};

const buildCsvBuffer = ({ rows, filters }) => {
  const titleLines = buildTitleLines({
    filters,
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

const buildExcelBuffer = async ({ rows, filters }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DISTYNC";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Inventory Items", {
    views: [{ state: "frozen", ySplit: 12 }],
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
  worksheet.getCell("B2").value = "Office of the Mayor";
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
  worksheet.mergeCells(3, 2, 3, EXPORT_COLUMNS.length);
  worksheet.getCell("B3").value = "Municipality of Malvar, Batangas";
  worksheet.getCell("B3").font = {
    bold: true,
    size: 12,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getCell("B3").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF17324D" },
  };
  worksheet.getCell("B3").alignment = { horizontal: "left", vertical: "middle" };
  worksheet.mergeCells(4, 2, 4, EXPORT_COLUMNS.length);
  worksheet.getCell("B4").value = "Inventory Items Report";
  worksheet.getCell("B4").font = {
    bold: true,
    size: 12,
    color: { argb: "FF17324D" },
  };
  worksheet.getCell("B4").alignment = { horizontal: "left", vertical: "middle" };
  worksheet.getRow(1).height = 28;
  worksheet.getRow(2).height = 24;
  worksheet.getRow(3).height = 20;
  worksheet.getRow(4).height = 20;

  buildTitleLines({ filters, totalRows: rows.length })
    .slice(4)
    .forEach((line, index) => {
      const row = worksheet.getRow(index + 6);
      row.getCell(1).value = line;
      row.getCell(1).font = { bold: index === 0 };
    });

  const headerRowNumber = 12;
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

  rows.forEach((itemRow, index) => {
    const row = worksheet.getRow(headerRowNumber + 1 + index);

    EXPORT_COLUMNS.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.value = itemRow[column.key];
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

  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: EXPORT_COLUMNS.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

const buildPdfBuffer = ({ rows, filters }) => {
  const pages = [];
  let page = null;
  let cursorY = 555;

  const addText = (text, x, y, options = {}) => {
    page.drawText(text, x, y, {
      font: options.bold ? "F2" : "F1",
      size: options.size || 8,
      color: options.color || reportExport.PDF_COLORS.bodyText,
    });
  };

  const finishPage = () => {
    addText(`Page ${pages.length + 1}`, 760, 24);
    pages.push(page);
    cursorY = 555;
  };

  const startPage = () => {
    const titleLines = buildTitleLines({ filters, totalRows: rows.length });

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
    addText("Office of the Mayor", 112, 527, {
      bold: true,
      size: 14,
      color: reportExport.PDF_COLORS.white,
    });
    addText("Municipality of Malvar, Batangas", 112, 512, {
      bold: true,
      size: 11,
      color: reportExport.PDF_COLORS.white,
    });
    addText("Inventory Items Report", 430, 527, {
      bold: true,
      size: 12,
      color: reportExport.PDF_COLORS.white,
    });
    cursorY = 480;
    titleLines.slice(4, 8).forEach((line) => {
      addText(line, 40, cursorY, { size: 9 });
      cursorY -= 12;
    });
    cursorY -= 10;

    EXPORT_COLUMNS.forEach((column, index) => {
      addText(column.label, [40, 190, 285, 560, 670][index], cursorY, {
        bold: true,
      });
    });
    cursorY -= 14;
  };

  startPage();

  rows.forEach((row) => {
    const nameLines = wrapText(row.item_name, 24).slice(0, 2);
    const categoryLines = wrapText(row.category, 16).slice(0, 2);
    const quantityLines = wrapText(row.quantity, 38).slice(0, 3);
    const rowHeight =
      Math.max(nameLines.length, categoryLines.length, quantityLines.length, 1) * 11 + 8;

    if (cursorY - rowHeight < 42) {
      finishPage();
      startPage();
    }

    nameLines.forEach((line, index) => addText(line, 40, cursorY - index * 11));
    categoryLines.forEach((line, index) =>
      addText(line, 190, cursorY - index * 11),
    );
    quantityLines.forEach((line, index) =>
      addText(line, 285, cursorY - index * 11),
    );
    addText(row.expiration_date, 560, cursorY);
    addText(row.status, 670, cursorY);
    cursorY -= rowHeight;
  });

  finishPage();

  return reportExport.createPdfDocument(pages, reportExport.PDF_IMAGE_REGISTRY);
};

const buildExportFile = async ({ rows, filters, format }) => {
  const builders = {
    csv: buildCsvBuffer,
    excel: buildExcelBuffer,
    pdf: buildPdfBuffer,
  };
  const buffer = await builders[format]({ rows, filters });

  return {
    buffer,
    contentType: CONTENT_TYPES[format],
    filename: buildFilename(format),
  };
};

module.exports = {
  buildExportFile,
  formatDate,
};
