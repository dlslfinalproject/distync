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

const buildHeaderLines = ({ reportTitle, metadata = [], totalRows }) => {
  return [
    "DISTYNC",
    "Office of the Mayor",
    "Municipality of Malvar, Batangas",
    reportTitle,
    ...metadata.map((item) => `${item.label}: ${item.value}`),
    `Generated: ${formatDateTime(new Date())}`,
    `Total Rows: ${totalRows}`,
  ];
};

const normalizeSheetName = (value) => {
  const normalizedValue = String(value || "Report").trim();
  return normalizedValue.slice(0, 31);
};

const buildFilename = (filePrefix, format) => {
  const extensionMap = {
    csv: "csv",
    excel: "xlsx",
    pdf: "pdf",
  };

  return `${filePrefix}-${getDateStamp()}.${extensionMap[format]}`;
};

const buildCsvBuffer = ({ reportTitle, metadata, columns, rows }) => {
  const titleLines = buildHeaderLines({
    reportTitle,
    metadata,
    totalRows: rows.length,
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
  excelLayout = "compact",
}) => {
  const useWideLayout = excelLayout === "wide";
  const contextEntries = [
    ...metadata,
    { label: "Generated", value: formatDateTime(new Date()) },
    { label: "Total Rows", value: rows.length },
  ];
  const headerRowNumber = useWideLayout
    ? Math.max(10, contextEntries.length + 6)
    : 10;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DISTYNC";
  workbook.company = "DISTYNC";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(normalizeSheetName(worksheetName), {
    views: [{ state: "frozen", ySplit: headerRowNumber }],
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
  [1, 2, 3, 4].forEach((rowNumber) => {
    for (let columnIndex = 1; columnIndex <= lastColumnIndex; columnIndex += 1) {
      worksheet.getCell(rowNumber, columnIndex).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF17324D" },
      };
    }
  });

  if (useWideLayout) {
    [1, 2, 3, 4].forEach((rowNumber) => {
      worksheet.mergeCells(rowNumber, 1, rowNumber, lastColumnIndex);
    });

    worksheet.getCell("A1").value = "DISTYNC";
    worksheet.getCell("A1").font = {
      bold: true,
      size: 18,
      color: { argb: "FFFFFFFF" },
    };
    worksheet.getCell("A1").alignment = {
      horizontal: "left",
      vertical: "middle",
      indent: 7,
    };

    worksheet.getCell("A2").value = "Office of the Mayor";
    worksheet.getCell("A2").font = {
      bold: true,
      size: 14,
      color: { argb: "FFFFFFFF" },
    };
    worksheet.getCell("A2").alignment = {
      horizontal: "left",
      vertical: "middle",
      indent: 7,
    };

    worksheet.getCell("A3").value = "Municipality of Malvar, Batangas";
    worksheet.getCell("A3").font = {
      bold: true,
      size: 12,
      color: { argb: "FFFFFFFF" },
    };
    worksheet.getCell("A3").alignment = {
      horizontal: "left",
      vertical: "middle",
      indent: 7,
    };

    worksheet.getCell("A4").value = reportTitle;
    worksheet.getCell("A4").font = {
      bold: true,
      size: 12,
      color: { argb: "FFFFFFFF" },
    };
    worksheet.getCell("A4").alignment = {
      horizontal: "left",
      vertical: "middle",
      indent: 7,
    };
  } else {
    worksheet.mergeCells(1, 2, 1, lastColumnIndex);
    worksheet.getCell("B1").value = "DISTYNC";
    worksheet.getCell("B1").font = {
      bold: true,
      size: 18,
      color: { argb: "FFFFFFFF" },
    };
    worksheet.getCell("B1").alignment = { horizontal: "left", vertical: "middle" };

    worksheet.mergeCells(2, 2, 2, lastColumnIndex);
    worksheet.getCell("B2").value = "Office of the Mayor";
    worksheet.getCell("B2").font = {
      bold: true,
      size: 14,
      color: { argb: "FFFFFFFF" },
    };
    worksheet.getCell("B2").alignment = { horizontal: "left", vertical: "middle" };

    worksheet.mergeCells(3, 2, 3, lastColumnIndex);
    worksheet.getCell("B3").value = "Municipality of Malvar, Batangas";
    worksheet.getCell("B3").font = {
      bold: true,
      size: 12,
      color: { argb: "FFFFFFFF" },
    };
    worksheet.getCell("B3").alignment = { horizontal: "left", vertical: "middle" };

    worksheet.mergeCells(4, 2, 4, lastColumnIndex);
    worksheet.getCell("B4").value = reportTitle;
    worksheet.getCell("B4").font = {
      bold: true,
      size: 12,
      color: { argb: "FFFFFFFF" },
    };
    worksheet.getCell("B4").alignment = { horizontal: "left", vertical: "middle" };
  }

  worksheet.getRow(1).height = 28;
  worksheet.getRow(2).height = 24;
  worksheet.getRow(3).height = 20;
  worksheet.getRow(4).height = 20;

  if (useWideLayout) {
    contextEntries.forEach((entry, index) => {
      const row = worksheet.getRow(index + 6);
      row.getCell(1).value = entry.label;
      row.getCell(1).font = { bold: true, color: { argb: "FF40617F" } };
      row.getCell(2).value = entry.value;
    });
  } else {
    const contextLines = [
      ...metadata.map((item) => `${item.label}: ${item.value}`),
      `Generated: ${formatDateTime(new Date())}`,
      `Total Rows: ${rows.length}`,
    ];

    contextLines.forEach((line, index) => {
      const row = worksheet.getRow(index + 6);
      row.getCell(1).value = line;
      row.getCell(1).font = { bold: index === 0 };
    });
  }

  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.height = 32;
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

const buildPdfBuffer = ({ reportTitle, metadata, columns, rows }) => {
  const pages = [];
  let page = null;
  let cursorY = 555;

  const pageWidth = 842;
  const marginX = 40;
  const contentWidth = 762;
  const columnWidths = columns.map((column) => column.pdfWidth || 110);

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
    addText("Office of the Mayor", 112, 529, {
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
    columns.forEach((column, index) => {
      addText(column.label, headerX + 4, cursorY, { bold: true });
      headerX += columnWidths[index];
    });
    cursorY -= 14;
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

const buildWidePdfBuffer = ({ reportTitle, metadata, columns, rows }) => {
  const pages = [];
  let page = null;
  let cursorY = 0;

  const pageWidth = 1191;
  const pageHeight = 842;
  const marginX = 24;
  const contentWidth = 1143;
  const baseColumnWidths = columns.map((column) => column.pdfWidth || 110);
  const totalBaseColumnWidth = baseColumnWidths.reduce(
    (sum, width) => sum + width,
    0,
  );
  const scaleFactor =
    totalBaseColumnWidth > 0 ? contentWidth / totalBaseColumnWidth : 1;
  const columnWidths = baseColumnWidths.map((width) => width * scaleFactor);
  const bodyLineHeight = 10;
  const headerLineHeight = 9;
  const contextEntries = [
    ...metadata,
    { label: "Generated", value: formatDateTime(new Date()) },
    { label: "Total Rows", value: rows.length },
  ];

  const addText = (text, x, y, options = {}) => {
    page.drawText(String(text ?? ""), x, y, {
      font: options.bold ? "F2" : "F1",
      size: options.size || 7.5,
      color: options.color || reportExport.PDF_COLORS.bodyText,
    });
  };

  const drawMetadataLine = (entries, startY) => {
    const segmentWidth = contentWidth / entries.length;

    entries.forEach((entry, index) => {
      addText(`${entry.label}: ${entry.value}`, marginX + segmentWidth * index, startY, {
        size: 9,
      });
    });
  };

  const drawHeader = () => {
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
    addText(reportTitle, pageWidth - 250, 767, {
      bold: true,
      size: 12,
      color: reportExport.PDF_COLORS.white,
    });

    cursorY = 712;
    for (let index = 0; index < contextEntries.length; index += 3) {
      drawMetadataLine(contextEntries.slice(index, index + 3), cursorY);
      cursorY -= 16;
    }
    cursorY -= 22;

    const wrappedHeaders = columns.map((column, index) =>
      wrapText(column.label, Math.max(8, Math.floor(columnWidths[index] / 5.8))),
    );
    const headerHeight =
      Math.max(...wrappedHeaders.map((lines) => lines.length), 1) * headerLineHeight + 4;

    page.fillRect(
      marginX,
      cursorY - headerHeight,
      contentWidth,
      headerHeight,
      reportExport.PDF_COLORS.blue,
    );
    page.strokeRect(
      marginX,
      cursorY - headerHeight,
      contentWidth,
      headerHeight,
      reportExport.PDF_COLORS.border,
      0.8,
    );

    let headerX = marginX;
    wrappedHeaders.forEach((lines, index) => {
      const textStartY =
        cursorY -
        (headerHeight - lines.length * headerLineHeight) / 2 -
        7;

      lines.forEach((line, lineIndex) => {
        addText(line, headerX + 3, textStartY - lineIndex * headerLineHeight, {
          bold: true,
          size: 7.2,
          color: reportExport.PDF_COLORS.white,
        });
      });

      if (index < wrappedHeaders.length - 1) {
        page.drawLine(
          headerX + columnWidths[index],
          cursorY,
          headerX + columnWidths[index],
          cursorY - headerHeight,
          reportExport.PDF_COLORS.border,
          0.6,
        );
      }

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

  rows.forEach((row, rowIndex) => {
    const wrappedCells = columns.map((column, index) =>
      wrapText(row[column.key], Math.max(8, Math.floor(columnWidths[index] / 5.8))),
    );
    const rowHeight =
      Math.max(...wrappedCells.map((lines) => lines.length), 1) * bodyLineHeight + 8;

    if (cursorY - rowHeight < 42) {
      finishPage();
      drawHeader();
    }

    const rowBackgroundColor =
      rowIndex % 2 === 0 ? reportExport.PDF_COLORS.white : "0.97 0.98 0.99";

    page.fillRect(
      marginX,
      cursorY - rowHeight,
      contentWidth,
      rowHeight,
      rowBackgroundColor,
    );
    page.strokeRect(
      marginX,
      cursorY - rowHeight,
      contentWidth,
      rowHeight,
      reportExport.PDF_COLORS.border,
      0.6,
    );

    let cellX = marginX;
    wrappedCells.forEach((lines, index) => {
      if (index < wrappedCells.length - 1) {
        page.drawLine(
          cellX + columnWidths[index],
          cursorY,
          cellX + columnWidths[index],
          cursorY - rowHeight,
          reportExport.PDF_COLORS.border,
          0.5,
        );
      }

      lines.forEach((line, lineIndex) => {
        addText(line, cellX + 3, cursorY - 13 - lineIndex * bodyLineHeight, {
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

const buildExportFile = async ({
  filePrefix,
  worksheetName,
  reportTitle,
  metadata = [],
  columns = [],
  rows = [],
  format,
  pdfLayout = "compact",
  excelLayout = "compact",
}) => {
  const builders = {
    csv: buildCsvBuffer,
    excel: buildExcelBuffer,
    pdf: pdfLayout === "wide" ? buildWidePdfBuffer : buildPdfBuffer,
  };

  const buffer = await builders[format]({
    worksheetName,
    reportTitle,
    metadata,
    columns,
    rows,
    pdfLayout,
    excelLayout,
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
