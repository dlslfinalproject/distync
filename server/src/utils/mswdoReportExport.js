const ExcelJS = require("exceljs");
const reportExport = require("./masterlistExport");

const CONTENT_TYPES = {
  csv: "text/csv; charset=utf-8",
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

const ALLOWED_EXPORT_FORMATS = ["csv", "excel", "pdf"];

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatDateOnly = (value) => {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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

const buildHeaderLines = ({
  reportTitle,
  metadata = [],
  totalRows,
  sourceName = "MSWDO",
}) => {
  return [
    "DISTYNC",
    sourceName,
    "Municipality of Malvar, Batangas",
    reportTitle,
    ...metadata.map((item) => `${item.label}: ${item.value}`),
    `Generated: ${formatDateTime(new Date())}`,
    `Total Rows: ${totalRows}`,
  ];
};

const normalizeSheetName = (value) => {
  return String(value || "Report").trim().slice(0, 31);
};

const buildFilename = (filePrefix, format) => {
  const extensionMap = {
    csv: "csv",
    excel: "xlsx",
    pdf: "pdf",
  };

  return `${filePrefix}-${getDateStamp()}.${extensionMap[format]}`;
};

const buildCsvBuffer = ({ reportTitle, metadata, columns, rows, sourceName }) => {
  const titleLines = buildHeaderLines({
    reportTitle,
    metadata,
    totalRows: rows.length,
    sourceName,
  });
  const columnLine = columns.map((column) => escapeCsvValue(column.label)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((column) => escapeCsvValue(row[column.key])).join(","),
  );

  return Buffer.from([...titleLines, "", columnLine, ...dataLines].join("\r\n"), "utf8");
};

const applyCellBorder = (cell) => {
  cell.border = {
    top: { style: "thin", color: { argb: "FFD9E3F0" } },
    left: { style: "thin", color: { argb: "FFD9E3F0" } },
    bottom: { style: "thin", color: { argb: "FFD9E3F0" } },
    right: { style: "thin", color: { argb: "FFD9E3F0" } },
  };
};

const buildExcelBuffer = async ({
  worksheetName,
  reportTitle,
  metadata,
  columns,
  rows,
  sourceName = "MSWDO",
}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DISTYNC";
  workbook.company = "DISTYNC";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(normalizeSheetName(worksheetName), {
    views: [{ state: "frozen", ySplit: 10 }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  worksheet.columns = columns.map((column) => ({
    key: column.key,
    width: column.width || 24,
  }));

  reportExport.addWorkbookLogo(workbook, worksheet);

  const lastColumnIndex = Math.max(columns.length, 6);
  const headerEndRowNumber = reportExport.buildExcelReportHeader({
    worksheet,
    lastColumnIndex,
    sourceName,
    reportTitle,
    metadata: [
      ...metadata,
      { label: "Generated", value: formatDateTime(new Date()) },
      { label: "Total Rows", value: rows.length },
    ],
  });

  const headerRowNumber = headerEndRowNumber + 1;
  worksheet.views = [{ state: "frozen", ySplit: headerRowNumber }];
  const headerRow = worksheet.getRow(headerRowNumber);
  columns.forEach((column, index) => {
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

  rows.forEach((row, rowIndex) => {
    const worksheetRow = worksheet.getRow(headerRowNumber + 1 + rowIndex);

    columns.forEach((column, columnIndex) => {
      const cell = worksheetRow.getCell(columnIndex + 1);
      cell.value = row[column.key];
      cell.alignment = {
        vertical: "top",
        horizontal: "left",
        wrapText: true,
      };
      applyCellBorder(cell);

      if (rowIndex % 2 === 1) {
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
    to: { row: headerRowNumber, column: columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

const wrapText = (value, maxLength) => {
  const chunkLongToken = (token, maxTokenLength) => {
    if (token.length <= maxTokenLength) {
      return [token];
    }

    const chunks = [];
    let remainingToken = token;

    while (remainingToken.length > maxTokenLength) {
      chunks.push(remainingToken.slice(0, maxTokenLength));
      remainingToken = remainingToken.slice(maxTokenLength);
    }

    if (remainingToken) {
      chunks.push(remainingToken);
    }

    return chunks;
  };

  const words = String(value ?? "--")
    .split(/\s+/)
    .flatMap((word) => chunkLongToken(word, Math.max(8, maxLength)));
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

const buildPdfBuffer = ({ reportTitle, metadata, columns, rows, sourceName = "MSWDO" }) => {
  const pages = [];
  let page = null;
  let cursorY = 555;
  const pageWidth = 842;
  const marginX = 40;
  const contentWidth = 762;
  const baseColumnWidths = columns.map((column) => column.pdfWidth || 110);
  const totalColumnWidth = baseColumnWidths.reduce(
    (total, width) => total + width,
    0,
  );
  const widthScale =
    totalColumnWidth > 0 ? contentWidth / totalColumnWidth : 1;
  const columnWidths = baseColumnWidths.map((width) => width * widthScale);

  const addText = (text, x, y, options = {}) => {
    page.drawText(text, x, y, {
      font: options.bold ? "F2" : "F1",
      size: options.size || 8,
      color: options.color || reportExport.PDF_COLORS.bodyText,
    });
  };

  const drawHeader = () => {
    const titleLines = buildHeaderLines({
      reportTitle,
      metadata,
      totalRows: rows.length,
      sourceName,
    });

    page = reportExport.createPdfBuilder({ width: pageWidth, height: 595 });
    page.fillRect(marginX, 505, contentWidth, 70, reportExport.PDF_COLORS.navy);
    page.fillRect(58, 519, 40, 40, reportExport.PDF_COLORS.white);

    if (reportExport.PDF_IMAGE_REGISTRY.distyncLogo) {
      page.drawImage("distyncLogo", 60, 521, 36, 36);
    }

    addText("DISTYNC", 112, 547, {
      bold: true,
      size: 18,
      color: reportExport.PDF_COLORS.white,
    });
    addText(sourceName, 112, 529, {
      bold: true,
      size: 14,
      color: reportExport.PDF_COLORS.white,
    });
    addText("Municipality of Malvar, Batangas", 112, 514, {
      bold: true,
      size: 11,
      color: reportExport.PDF_COLORS.white,
    });
    addText(reportTitle, 420, 529, {
      bold: true,
      size: 12,
      color: reportExport.PDF_COLORS.white,
    });

    cursorY = 485;
    titleLines.slice(4).forEach((line) => {
      addText(line, marginX, cursorY, { size: 9 });
      cursorY -= 12;
    });

    cursorY -= 10;
    let headerX = marginX;
    const wrappedHeaders = columns.map((column, index) =>
      wrapText(
        column.label,
        Math.max(8, Math.floor(columnWidths[index] / 5.5)),
      ),
    );
    const headerHeight =
      Math.max(...wrappedHeaders.map((lines) => lines.length), 1) * 11 + 6;

    columns.forEach((column, index) => {
      wrappedHeaders[index].forEach((line, lineIndex) => {
        addText(line, headerX + 4, cursorY - lineIndex * 11, { bold: true });
      });
      headerX += columnWidths[index];
    });
    cursorY -= headerHeight;
  };

  const finishPage = () => {
    addText(`Page ${pages.length + 1}`, 760, 24, { size: 8 });
    pages.push(page);
    cursorY = 555;
  };

  drawHeader();

  rows.forEach((row) => {
    const wrappedCells = columns.map((column, index) =>
      wrapText(row[column.key], Math.max(8, Math.floor(columnWidths[index] / 5.5))),
    );
    const rowHeight =
      Math.max(...wrappedCells.map((lines) => lines.length), 1) * 11 + 8;

    if (cursorY - rowHeight < 42) {
      finishPage();
      drawHeader();
    }

    let cellX = marginX;
    wrappedCells.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => {
        addText(line, cellX + 4, cursorY - lineIndex * 11);
      });
      cellX += columnWidths[index];
    });

    cursorY -= rowHeight;
  });

  finishPage();

  return reportExport.createPdfDocument(pages, reportExport.PDF_IMAGE_REGISTRY);
};

const buildExportFile = async ({
  filePrefix,
  worksheetName,
  reportTitle,
  sourceName = "MSWDO",
  metadata = [],
  columns = [],
  rows = [],
  format,
}) => {
  const builders = {
    csv: buildCsvBuffer,
    excel: buildExcelBuffer,
    pdf: buildPdfBuffer,
  };

  const buffer = await builders[format]({
    worksheetName,
    reportTitle,
    metadata,
    columns,
    rows,
    sourceName,
  });

  return {
    buffer,
    contentType: CONTENT_TYPES[format],
    filename: buildFilename(filePrefix, format),
  };
};

module.exports = {
  ALLOWED_EXPORT_FORMATS,
  buildExportFile,
  formatDateOnly,
  formatDateTime,
};
