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

const mapHouseholdToExportRow = (household) => {
  const departureTimeValue = household.latest_attendance?.time_out || null;

  return {
    family_head_name: household.family_head_name || "-",
    address:
      household.current_address_details ||
      household.barangay?.name ||
      "-",
    members_count: household.members?.length || 0,
    sectors_text: buildSectorsText(household),
    arrival_time_text: formatDateTime(household.latest_attendance?.time_in),
    departure_time_text: formatDateTime(departureTimeValue),
    barangay_name: household.barangay?.name || "",
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

const getExportColumns = () => {
  return [
    { key: "family_head_name", label: "Family Head" },
    { key: "address", label: "Address" },
    { key: "members_count", label: "Members" },
    { key: "sectors_text", label: "Sectors" },
    { key: "arrival_time_text", label: "Arrival Time" },
    { key: "departure_time_text", label: "Departure Time" },
  ];
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

const buildExcelBuffer = ({ worksheetName, titleLines, columns, rows }) => {
  const titleRows = titleLines
    .map(
      (line) =>
        `<Row>${buildSpreadsheetCell(line)}${"<Cell/>".repeat(
          Math.max(columns.length - 1, 0),
        )}</Row>`,
    )
    .join("");

  const headerRow = `<Row>${columns
    .map((column) => buildSpreadsheetCell(column.label))
    .join("")}</Row>`;

  const dataRows = rows
    .map(
      (row) =>
        `<Row>${columns
          .map((column) => buildSpreadsheetCell(row[column.key]))
          .join("")}</Row>`,
    )
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="${escapeXml(worksheetName)}">
    <Table>
      ${titleRows}
      <Row></Row>
      ${headerRow}
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

  return Buffer.from(xml, "utf8");
};

const escapePdfText = (value) => {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
};

const wrapText = (text, maxLength) => {
  const words = String(text || "").split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [""];
  }

  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length <= maxLength) {
      currentLine = candidate;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    if (word.length <= maxLength) {
      currentLine = word;
      return;
    }

    const chunks = word.match(new RegExp(`.{1,${maxLength}}`, "g")) || [word];
    lines.push(...chunks.slice(0, -1));
    currentLine = chunks[chunks.length - 1];
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const buildPdfPages = ({ titleLines, rows }) => {
  const pages = [];
  let currentPage = [];
  let remainingLines = 42;

  const pushLine = (line = "") => {
    if (remainingLines === 0) {
      pages.push(currentPage);
      currentPage = [];
      remainingLines = 42;
    }

    currentPage.push(line);
    remainingLines -= 1;
  };

  titleLines.forEach((line) => pushLine(line));
  pushLine("");

  if (rows.length === 0) {
    pushLine("No masterlist rows are available for the selected export filters.");
  }

  rows.forEach((row, index) => {
    const rowLines = [
      `#${index + 1}  ${row.family_head_name}`,
      `Address: ${row.address}`,
      `Members: ${row.members_count} | Sectors: ${row.sectors_text}`,
      `Arrival: ${row.arrival_time_text} | Departure: ${row.departure_time_text}`,
      "",
    ];

    rowLines.forEach((line) => {
      wrapText(line, 96).forEach((wrappedLine) => pushLine(wrappedLine));
    });
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
};

const buildPdfBuffer = ({ titleLines, rows }) => {
  const pages = buildPdfPages({ titleLines, rows });
  const objects = [];

  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds = [];

  pages.forEach((lines) => {
    const contentLines = ["BT", "/F1 10 Tf", "14 TL", "50 790 Td"];

    lines.forEach((line, index) => {
      if (index === 0) {
        contentLines.push(`(${escapePdfText(line)}) Tj`);
      } else {
        contentLines.push("T*");
        contentLines.push(`(${escapePdfText(line)}) Tj`);
      }
    });

    contentLines.push("ET");
    const stream = contentLines.join("\n");
    const contentId = addObject(
      `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    );

    pageIds.push(
      addObject(
        `<< /Type /Page /Parent PAGES_ID 0 R /MediaBox [0 0 612 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
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
    offsets.push(Buffer.byteLength(output, "utf8"));
    output += `${index + 1} 0 obj\n${objectContent}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(output, "utf8");
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";

  offsets.slice(1).forEach((offset) => {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });

  output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
  output += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(output, "utf8");
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
  buildCsvBuffer,
  buildExcelBuffer,
  buildExportColumns: getExportColumns,
  buildExportFilename,
  buildExportTitleLines,
  buildPdfBuffer,
  filterExportRows,
  mapHouseholdToExportRow,
};
