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

const getReportTableTitle = (reportTitle, tableTitle) => {
  if (tableTitle && String(tableTitle).trim()) {
    return String(tableTitle).trim();
  }

  return (
    String(reportTitle || "Report")
      .replace(/\s+Report\s*$/i, "")
      .trim() || "Report"
  );
};

const getColumnAlignment = (column) => {
  if (column.alignment) {
    return column.alignment;
  }

  const centeredColumn = /(count|members|status|date|time)/i.test(
    String(column.key || ""),
  );

  return {
    vertical: "top",
    horizontal: centeredColumn ? "center" : "left",
    wrapText: true,
  };
};

const buildExcelBuffer = async ({
  worksheetName,
  reportTitle,
  tableTitle,
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

  const normalizedColumns = columns.map((column) => ({
    ...column,
    alignment: getColumnAlignment(column),
  }));
  const worksheet = workbook.addWorksheet(normalizeSheetName(worksheetName), {
    properties: { defaultRowHeight: 20 },
  });

  worksheet.columns = normalizedColumns.map((column) => ({
    key: column.key,
    width: column.width || 24,
    style: { alignment: column.alignment },
  }));

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

  reportExport.addWorkbookLogo(workbook, worksheet);

  const lastColumnIndex = Math.max(normalizedColumns.length, 6);
  const lastColumnLetter = worksheet.getColumn(lastColumnIndex).letter;
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

  const tableTitleRowNumber = headerEndRowNumber + 1;
  worksheet.mergeCells(
    `A${tableTitleRowNumber}:${lastColumnLetter}${tableTitleRowNumber}`,
  );
  const tableTitleCell = worksheet.getCell(`A${tableTitleRowNumber}`);
  tableTitleCell.value = getReportTableTitle(reportTitle, tableTitle);
  tableTitleCell.font = {
    bold: true,
    size: 13,
    color: { argb: "FF17324D" },
  };
  tableTitleCell.alignment = { vertical: "middle", horizontal: "left" };
  worksheet.getRow(tableTitleRowNumber).height = 24;

  const headerRowNumber = tableTitleRowNumber + 1;
  worksheet.views = [{ state: "frozen", ySplit: headerRowNumber }];
  const headerRow = worksheet.getRow(headerRowNumber);
  normalizedColumns.forEach((column, index) => {
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
  headerRow.height = 24;

  rows.forEach((row, rowIndex) => {
    const worksheetRow = worksheet.getRow(headerRowNumber + 1 + rowIndex);

    normalizedColumns.forEach((column, columnIndex) => {
      const cell = worksheetRow.getCell(columnIndex + 1);
      cell.value = row[column.key];
      cell.alignment = column.alignment;
      applyCellBorder(cell);

      if (rowIndex % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FBFE" },
        };
      }
    });

    const estimatedHeight = normalizedColumns.reduce((maxHeight, column) => {
      if (!column.alignment?.wrapText) {
        return maxHeight;
      }

      const cellValue = String(row[column.key] ?? "");
      const charactersPerLine = Math.max(
        12,
        Math.floor((column.width || 20) * 1.15),
      );
      const lineCount = Math.max(
        1,
        Math.ceil(cellValue.length / charactersPerLine),
      );
      return Math.max(maxHeight, lineCount * 15);
    }, 22);

    worksheetRow.height = Math.min(Math.max(estimatedHeight, 22), 60);
    worksheetRow.commit();
  });

  if (rows.length > 0) {
    worksheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber + rows.length, column: normalizedColumns.length },
    };
  }

  worksheet.headerFooter.oddFooter =
    `&L${getReportTableTitle(reportTitle, tableTitle)}&RPage &P of &N`;

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

const buildPdfBuffer = ({
  reportTitle,
  tableTitle,
  metadata,
  columns,
  rows,
  sourceName = "MSWDO",
}) => {
  const pages = [];
  let page = null;
  let cursorY = 0;
  const pageWidth = 842;
  const pageHeight = 595;
  const marginX = 40;
  const contentWidth = 762;
  const bottomY = 48;
  const baseColumnWidths = columns.map((column) => column.pdfWidth || 110);
  const totalColumnWidth = baseColumnWidths.reduce(
    (total, width) => total + width,
    0,
  );
  const widthScale =
    totalColumnWidth > 0 ? contentWidth / totalColumnWidth : 1;
  const columnWidths = baseColumnWidths.map((width) => width * widthScale);
  const normalizedTableTitle = getReportTableTitle(reportTitle, tableTitle);

  const addText = (text, x, y, options = {}) => {
    page.drawText(text, x, y, {
      font: options.bold ? "F2" : "F1",
      size: options.size || 8,
      color: options.color || reportExport.PDF_COLORS.bodyText,
    });
  };

  const drawTableHeader = () => {
    const wrappedHeaders = columns.map((column, index) =>
      wrapText(
        column.label,
        Math.max(8, Math.floor(columnWidths[index] / 5.5)),
      ),
    );
    const headerHeight =
      Math.max(...wrappedHeaders.map((lines) => lines.length), 1) * 11 + 8;
    const headerTop = cursorY;

    page.fillRect(
      marginX,
      headerTop - headerHeight,
      contentWidth,
      headerHeight,
      reportExport.PDF_COLORS.blue,
    );
    page.strokeRect(
      marginX,
      headerTop - headerHeight,
      contentWidth,
      headerHeight,
      reportExport.PDF_COLORS.border,
      0.8,
    );

    let headerX = marginX;
    wrappedHeaders.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => {
        addText(line, headerX + 4, headerTop - 13 - lineIndex * 11, {
          bold: true,
          color: reportExport.PDF_COLORS.white,
        });
      });
      headerX += columnWidths[index];
      if (index < columns.length - 1) {
        page.drawLine(
          headerX,
          headerTop,
          headerX,
          headerTop - headerHeight,
          reportExport.PDF_COLORS.border,
          0.6,
        );
      }
    });

    cursorY = headerTop - headerHeight;
  };

  const getWrappedPdfCells = (row) =>
    columns.map((column, index) =>
      wrapText(
        row[column.key],
        Math.max(8, Math.floor(columnWidths[index] / 5.5)),
      ),
    );

  const getPdfRowHeight = (wrappedCells, bottomPadding = 9) =>
    Math.max(...wrappedCells.map((lines) => lines.length), 1) * 11 + bottomPadding;

  const drawHeader = () => {
    const titleLines = buildHeaderLines({
      reportTitle,
      metadata,
      totalRows: rows.length,
      sourceName,
    });

    page = reportExport.createPdfBuilder({ width: pageWidth, height: pageHeight });
    page.fillRect(marginX, 503, contentWidth, 72, reportExport.PDF_COLORS.navy);
    page.fillRect(58, 517, 44, 44, reportExport.PDF_COLORS.white);

    if (reportExport.PDF_IMAGE_REGISTRY.distyncLogo) {
      page.drawImage("distyncLogo", 62, 521, 36, 36);
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
    wrapText(reportTitle, 42).forEach((line, lineIndex) =>
      addText(line, 420, 535 - lineIndex * 13, {
        bold: true,
        size: 12,
        color: reportExport.PDF_COLORS.white,
      }),
    );

    cursorY = 485;
    titleLines.slice(4).forEach((line) => {
      wrapText(line, 118).forEach((wrappedLine) => {
        addText(wrappedLine, marginX, cursorY, { size: 9 });
        cursorY -= 12;
      });
    });

    cursorY -= 8;
    addText(normalizedTableTitle, marginX, cursorY, {
      bold: true,
      size: 13,
      color: reportExport.PDF_COLORS.navy,
    });
    cursorY -= 15;
    drawTableHeader();
  };

  const drawTableRow = (row, rowIndex) => {
    const wrappedCells = getWrappedPdfCells(row);
    const rowHeight = getPdfRowHeight(wrappedCells);
    const rowTop = cursorY;
    const rowBottom = rowTop - rowHeight;

    page.fillRect(
      marginX,
      rowBottom,
      contentWidth,
      rowHeight,
      rowIndex % 2 === 0 ? reportExport.PDF_COLORS.white : reportExport.PDF_COLORS.lightBlue,
    );
    page.strokeRect(
      marginX,
      rowBottom,
      contentWidth,
      rowHeight,
      reportExport.PDF_COLORS.border,
      0.6,
    );

    let cellX = marginX;
    wrappedCells.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => {
        addText(line, cellX + 4, rowTop - 14 - lineIndex * 11, { size: 8 });
      });
      cellX += columnWidths[index];
      if (index < columns.length - 1) {
        page.drawLine(
          cellX,
          rowTop,
          cellX,
          rowBottom,
          reportExport.PDF_COLORS.border,
          0.5,
        );
      }
    });

    cursorY = rowBottom;
  };

  const drawEmptyTableRow = () => {
    const rowHeight = 32;
    const rowTop = cursorY;
    const rowBottom = rowTop - rowHeight;

    page.fillRect(
      marginX,
      rowBottom,
      contentWidth,
      rowHeight,
      reportExport.PDF_COLORS.white,
    );
    page.strokeRect(
      marginX,
      rowBottom,
      contentWidth,
      rowHeight,
      reportExport.PDF_COLORS.border,
      0.6,
    );
    addText(
      "No data available for the selected filters.",
      marginX + 6,
      rowTop - 20,
      { size: 9, color: reportExport.PDF_COLORS.grayText },
    );
    cursorY = rowBottom;
  };

  const finishPage = () => {
    page.drawLine(
      marginX,
      34,
      marginX + contentWidth,
      34,
      reportExport.PDF_COLORS.border,
      0.8,
    );
    addText(normalizedTableTitle, marginX, 22, {
      size: 8,
      color: reportExport.PDF_COLORS.grayText,
    });
    addText(`Page ${pages.length + 1}`, 760, 22, {
      size: 8,
      color: reportExport.PDF_COLORS.grayText,
    });
    pages.push(page);
  };

  drawHeader();

  if (rows.length === 0) {
    drawEmptyTableRow();
  }

  rows.forEach((row, rowIndex) => {
    const wrappedCells = getWrappedPdfCells(row);
    const rowHeight = getPdfRowHeight(wrappedCells);

    if (cursorY - rowHeight < bottomY) {
      finishPage();
      drawHeader();
    }

    drawTableRow(row, rowIndex);
  });

  finishPage();

  return reportExport.createPdfDocument(pages, reportExport.PDF_IMAGE_REGISTRY);
};

const buildExportFile = async ({
  filePrefix,
  worksheetName,
  reportTitle,
  tableTitle,
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
    tableTitle,
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
