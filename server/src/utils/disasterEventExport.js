const ExcelJS = require("exceljs");

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

const buildFilename = ({ scope, format }) => {
  const extensionMap = {
    csv: "csv",
    excel: "xlsx",
    pdf: "pdf",
  };

  return `mswdo-disaster-events-${slugifyFilePart(
    SCOPE_LABELS[scope],
    "all-events",
  )}-${getDateStamp()}.${extensionMap[format]}`;
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

const escapePdfText = (value) => {
  return String(value ?? "")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ");
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

const buildTitleLines = ({ scope, search, totalRows }) => {
  return [
    "DISTYNC - MSWDO Disaster Events",
    `Tab: ${SCOPE_LABELS[scope] || SCOPE_LABELS.all}`,
    `Search: ${search?.trim() || "None"}`,
    `Generated: ${formatGeneratedAt()}`,
    `Total Rows: ${totalRows}`,
  ];
};

const buildCsvBuffer = ({ rows, scope, search }) => {
  const titleLines = buildTitleLines({
    scope,
    search,
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

const buildExcelBuffer = async ({ rows, scope, search }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DISTYNC";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Disaster Events", {
    views: [{ state: "frozen", ySplit: 8 }],
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

  worksheet.mergeCells(1, 1, 1, EXPORT_COLUMNS.length);
  worksheet.getCell("A1").value = "DISTYNC - MSWDO Disaster Events";
  worksheet.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF17324D" },
  };
  worksheet.getCell("A1").alignment = { horizontal: "center" };

  buildTitleLines({ scope, search, totalRows: rows.length })
    .slice(1)
    .forEach((line, index) => {
      const row = worksheet.getRow(index + 2);
      row.getCell(1).value = line;
      row.getCell(1).font = { bold: index === 0 };
    });

  const headerRowNumber = 7;
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
    worksheet.mergeCells(8, 1, 8, EXPORT_COLUMNS.length);
    worksheet.getCell("A8").value = "No data available for the selected filters.";
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

const createPdfDocument = (pages) => {
  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  );
  const pageObjectIds = [];

  pages.forEach((content) => {
    const stream = `${content}\n`;
    const streamId = addObject(
      `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    );
    const pageId = addObject(
      `<< /Type /Page /Parent PAGES_REF 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${streamId} 0 R >>`,
    );
    pageObjectIds.push(pageId);
  });

  const pagesId = addObject(
    `<< /Type /Pages /Kids [${pageObjectIds
      .map((pageId) => `${pageId} 0 R`)
      .join(" ")}] /Count ${pageObjectIds.length} >>`,
  );
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const resolvedObjects = objects.map((content) =>
    content.replace(/PAGES_REF/g, String(pagesId)),
  );
  const offsets = [0];
  let output = "%PDF-1.4\n";

  resolvedObjects.forEach((content, index) => {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${content}\nendobj\n`;
  });

  const xrefOffset = output.length;
  output += `xref\n0 ${resolvedObjects.length + 1}\n`;
  output += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  output += `trailer\n<< /Size ${resolvedObjects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(output, "ascii");
};

const buildPdfBuffer = ({ rows, scope, search }) => {
  const pages = [];
  let operations = [];
  let cursorY = 555;

  const addText = (text, x, y, options = {}) => {
    operations.push(
      `BT /${options.bold ? "F2" : "F1"} ${options.size || 9} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(text)}) Tj ET`,
    );
  };
  const finishPage = () => {
    addText(`Page ${pages.length + 1}`, 760, 24);
    pages.push(operations.join("\n"));
    operations = [];
    cursorY = 555;
  };
  const startPage = () => {
    addText("DISTYNC - MSWDO Disaster Events", 40, cursorY, {
      bold: true,
      size: 16,
    });
    cursorY -= 22;
    addText(`Tab: ${SCOPE_LABELS[scope] || SCOPE_LABELS.all}`, 40, cursorY);
    addText(`Search: ${search?.trim() || "None"}`, 250, cursorY);
    addText(`Rows: ${rows.length}`, 490, cursorY);
    addText(`Generated: ${formatGeneratedAt()}`, 610, cursorY);
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
    const affectedLines = wrapText(row.affected_barangays, 35).slice(0, 3);
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

  return createPdfDocument(pages);
};

const buildExportFile = async ({ rows, scope, search, format }) => {
  const builders = {
    csv: buildCsvBuffer,
    excel: buildExcelBuffer,
    pdf: buildPdfBuffer,
  };

  const buffer = await builders[format]({ rows, scope, search });

  return {
    buffer,
    contentType: CONTENT_TYPES[format],
    filename: buildFilename({ scope, format }),
  };
};

module.exports = {
  buildExportFile,
  formatDate,
};
