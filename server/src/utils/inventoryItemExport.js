const ExcelJS = require("exceljs");
const reportExport = require("./masterlistExport");

const EXPORT_COLUMNS = [
  { key: "item_name", label: "Item Name", width: 28, pdfWidth: 86 },
  { key: "category", label: "Category", width: 16, pdfWidth: 58 },
  { key: "tracking_method", label: "Tracking Method", width: 18, pdfWidth: 48 },
  { key: "barcode", label: "Barcode", width: 22, pdfWidth: 56 },
  { key: "packaging", label: "Packaging", width: 16, pdfWidth: 40 },
  { key: "units_per_packaging", label: "Units per Packaging", width: 18, pdfWidth: 52 },
  { key: "unit_of_measure", label: "Unit of Measure", width: 16, pdfWidth: 46 },
  { key: "batch_no", label: "Batch Number", width: 22, pdfWidth: 56 },
  { key: "current_stock", label: "Current Stock", width: 16, pdfWidth: 42 },
  { key: "reorder_level", label: "Reorder Level", width: 16, pdfWidth: 42 },
  { key: "expiration_date", label: "Expiration Date", width: 18, pdfWidth: 50 },
  { key: "source", label: "Source", width: 18, pdfWidth: 44 },
  { key: "stock_status", label: "Stock Status", width: 18, pdfWidth: 46 },
];

const CONTENT_TYPES = {
  csv: "text/csv; charset=utf-8",
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

const formatDate = (value) => {
  if (!value) {
    return "Not Applicable";
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

  return `office-mayor-inventory-items-${getDateStamp()}.${extensionMap[format]}`;
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
  const normalizedValue = String(value ?? "--");

  if (normalizedValue === "Non-Perishable") {
    return [normalizedValue];
  }

  const normalizeWordChunks = (word) => {
    const safeWord = String(word || "");

    if (safeWord.length <= maxLength) {
      return [safeWord];
    }

    const chunks = [];

    for (let index = 0; index < safeWord.length; index += maxLength) {
      chunks.push(safeWord.slice(index, index + maxLength));
    }

    return chunks;
  };

  const words = normalizedValue
    .split(/\s+/)
    .flatMap(normalizeWordChunks);
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

const resolveCategoryLabel = (filters = {}) => {
  if (filters.is_perishable === true) {
    return "Perishable";
  }

  if (filters.is_perishable === false) {
    return "Non-Perishable";
  }

  return filters.category || "All";
};

const buildMetadata = ({ filters, totalRows }) => {
  return [
    { label: "Category", value: resolveCategoryLabel(filters) },
    { label: "Stock Status", value: filters.status || "All" },
    { label: "Search", value: filters.search?.trim() || "None" },
    { label: "Rows", value: totalRows },
    { label: "Generated", value: formatGeneratedAt() },
  ];
};

const buildCsvBuffer = ({ rows, filters }) => {
  const metadata = buildMetadata({ filters, totalRows: rows.length });
  const headerLines = [
    "DISTYNC",
    "Office of the Mayor",
    "Municipality of Malvar, Batangas",
    "Inventory Items report",
    ...metadata.map((item) => `${item.label}: ${item.value}`),
  ];
  const columnLine = EXPORT_COLUMNS.map((column) =>
    escapeCsvValue(column.label),
  ).join(",");
  const dataLines = rows.map((row) =>
    EXPORT_COLUMNS.map((column) => escapeCsvValue(row[column.key])).join(","),
  );

  return Buffer.from([...headerLines, "", columnLine, ...dataLines].join("\r\n"), "utf8");
};

const applyCellBorder = (cell) => {
  cell.border = {
    top: { style: "thin", color: { argb: "FFD9E3F0" } },
    left: { style: "thin", color: { argb: "FFD9E3F0" } },
    bottom: { style: "thin", color: { argb: "FFD9E3F0" } },
    right: { style: "thin", color: { argb: "FFD9E3F0" } },
  };
};

const buildExcelBuffer = async ({ rows, filters }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DISTYNC";
  workbook.company = "DISTYNC";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet("Inventory Items", {
    views: [{ state: "frozen", ySplit: 11 }],
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

  const lastColumnIndex = EXPORT_COLUMNS.length;

  [1, 2, 3, 4].forEach((rowNumber) => {
    worksheet.mergeCells(rowNumber, 1, rowNumber, lastColumnIndex);
    for (let columnIndex = 1; columnIndex <= lastColumnIndex; columnIndex += 1) {
      worksheet.getCell(rowNumber, columnIndex).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF17324D" },
      };
    }
  });

  worksheet.getCell("A1").value = "DISTYNC";
  worksheet.getCell("A1").font = {
    bold: true,
    size: 18,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getCell("A1").alignment = { horizontal: "left", vertical: "middle", indent: 7 };

  worksheet.getCell("A2").value = "Office of the Mayor";
  worksheet.getCell("A2").font = {
    bold: true,
    size: 14,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getCell("A2").alignment = { horizontal: "left", vertical: "middle", indent: 7 };

  worksheet.getCell("A3").value = "Municipality of Malvar, Batangas";
  worksheet.getCell("A3").font = {
    bold: true,
    size: 12,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getCell("A3").alignment = { horizontal: "left", vertical: "middle", indent: 7 };

  worksheet.getCell("A4").value = "Inventory Items report";
  worksheet.getCell("A4").font = {
    bold: true,
    size: 12,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getCell("A4").alignment = { horizontal: "left", vertical: "middle", indent: 7 };

  worksheet.getRow(1).height = 28;
  worksheet.getRow(2).height = 24;
  worksheet.getRow(3).height = 20;
  worksheet.getRow(4).height = 22;

  const metadata = buildMetadata({ filters, totalRows: rows.length });
  metadata.forEach((item, index) => {
    const row = worksheet.getRow(index + 6);
    row.getCell(1).value = item.label;
    row.getCell(1).font = { bold: true, color: { argb: "FF40617F" } };
    row.getCell(2).value = item.value;
  });

  const headerRowNumber = 11;
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
    applyCellBorder(cell);
  });

  rows.forEach((reportRow, index) => {
    const row = worksheet.getRow(headerRowNumber + 1 + index);

    EXPORT_COLUMNS.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.value = reportRow[column.key];
      cell.alignment = {
        vertical: "top",
        horizontal:
          column.key === "reorder_level" || column.key === "stock_status"
            ? "center"
            : "left",
        wrapText: true,
      };
      applyCellBorder(cell);

      if (index % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FBFE" },
        };
      }
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
  let cursorY = 0;

  const pageWidth = 1191;
  const pageHeight = 842;
  const marginX = 24;
  const contentWidth = 1143;
  const baseColumnWidths = EXPORT_COLUMNS.map((column) => column.pdfWidth);
  const totalBaseColumnWidth = baseColumnWidths.reduce((sum, width) => sum + width, 0);
  const scaleFactor =
    totalBaseColumnWidth > 0 ? contentWidth / totalBaseColumnWidth : 1;
  const columnWidths = baseColumnWidths.map((width) => width * scaleFactor);
  const bodyLineHeight = 10;
  const headerLineHeight = 9;

  const addText = (text, x, y, options = {}) => {
    page.drawText(String(text ?? ""), x, y, {
      font: options.bold ? "F2" : "F1",
      size: options.size || 7.5,
      color: options.color || reportExport.PDF_COLORS.bodyText,
    });
  };

  const drawMetadataLine = (entries, startY) => {
    const availableWidth = contentWidth;
    const segmentWidth = availableWidth / entries.length;

    entries.forEach((entry, index) => {
      addText(`${entry.label}: ${entry.value}`, marginX + segmentWidth * index, startY, {
        size: 9,
      });
    });
  };

  const drawHeader = () => {
    const metadata = buildMetadata({ filters, totalRows: rows.length });

    page = reportExport.createPdfBuilder({ width: pageWidth, height: pageHeight });
    page.fillRect(marginX, 742, contentWidth, 76, reportExport.PDF_COLORS.navy);
    page.fillRect(42, 758, 40, 40, reportExport.PDF_COLORS.white);

    if (reportExport.PDF_IMAGE_REGISTRY.distyncLogo) {
      page.drawImage("distyncLogo", 44, 760, 36, 36);
    }

    addText("DISTYNC", 96, 785, {
      bold: true,
      size: 18,
      color: reportExport.PDF_COLORS.white,
    });
    addText("Office of the Mayor", 96, 767, {
      bold: true,
      size: 14,
      color: reportExport.PDF_COLORS.white,
    });
    addText("Municipality of Malvar, Batangas", 96, 752, {
      bold: true,
      size: 11,
      color: reportExport.PDF_COLORS.white,
    });
    addText("Inventory Items report", pageWidth - 250, 767, {
      bold: true,
      size: 12,
      color: reportExport.PDF_COLORS.white,
    });

    cursorY = 712;
    drawMetadataLine(metadata.slice(0, 3), cursorY);
    cursorY -= 16;
    drawMetadataLine(metadata.slice(3), cursorY);
    cursorY -= 22;

    let headerX = marginX;
    const wrappedHeaders = EXPORT_COLUMNS.map((column, index) =>
      wrapText(column.label, Math.max(8, Math.floor(columnWidths[index] / 5.8))),
    );
    const headerHeight =
      Math.max(...wrappedHeaders.map((lines) => lines.length), 1) * headerLineHeight + 4;

    wrappedHeaders.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => {
        addText(line, headerX + 3, cursorY - lineIndex * headerLineHeight, {
          bold: true,
          size: 7.2,
        });
      });
      headerX += columnWidths[index];
    });
    cursorY -= headerHeight;
  };

  const finishPage = () => {
    addText(`Page ${pages.length + 1}`, pageWidth - 52, 20, { size: 8 });
    pages.push(page);
    cursorY = pageHeight - 40;
  };

  drawHeader();

  rows.forEach((row) => {
    const wrappedCells = EXPORT_COLUMNS.map((column, index) =>
      wrapText(row[column.key], Math.max(8, Math.floor(columnWidths[index] / 5.8))),
    );
    const rowHeight =
      Math.max(...wrappedCells.map((lines) => lines.length), 1) * bodyLineHeight + 8;

    if (cursorY - rowHeight < 42) {
      finishPage();
      drawHeader();
    }

    let cellX = marginX;
    wrappedCells.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => {
        addText(line, cellX + 3, cursorY - lineIndex * bodyLineHeight, {
          size: 7.2,
        });
      });
      cellX += columnWidths[index];
    });

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
