const {
  createPdfBuilder,
  createPdfDocument,
  PDF_COLORS,
  PDF_IMAGE_REGISTRY,
} = require("./masterlistExport");

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const TOP_Y = PAGE_HEIGHT - 36;
const BOTTOM_Y = 48;
const TABLE_LINE_HEIGHT = 10;

const formatDateTime = (value) => {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
};

const formatNumber = (value) => {
  const numericValue = Number(value || 0);

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(1);
};

const normalizeText = (value) => {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue || "-";
};

const splitLongToken = (word, maxChars) => {
  return word.match(new RegExp(`.{1,${maxChars}}`, "g")) || [word];
};

const wrapText = (value, maxChars) => {
  const normalizedValue = normalizeText(value);
  const lines = [];

  normalizedValue.split(/\r?\n/).forEach((line) => {
    const words = line.split(/\s+/).filter(Boolean);
    let currentLine = "";

    if (words.length === 0) {
      lines.push("");
      return;
    }

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
  });

  return lines.length > 0 ? lines : ["-"];
};

const estimateMaxChars = (width, fontSize = 8) => {
  return Math.max(4, Math.floor(width / (fontSize * 0.52)));
};

const getTableRowLayout = (row, columns) => {
  const cellLines = columns.map((column) =>
    wrapText(row[column.key], estimateMaxChars(column.width - 12)),
  );
  const maxLines = Math.max(...cellLines.map((lines) => lines.length), 1);

  return {
    cellLines,
    rowHeight: Math.max(24, maxLines * TABLE_LINE_HEIGHT + 8),
  };
};

const drawBanner = (page, context, { compact = false } = {}) => {
  const bannerHeight = compact ? 54 : 72;
  const bannerTop = TOP_Y;

  page.fillRect(
    MARGIN_X,
    bannerTop - bannerHeight,
    CONTENT_WIDTH,
    bannerHeight,
    PDF_COLORS.navy,
  );
  page.fillRect(MARGIN_X + 18, bannerTop - bannerHeight + 14, 44, 44, PDF_COLORS.white);

  if (PDF_IMAGE_REGISTRY.distyncLogo) {
    page.drawImage(
      "distyncLogo",
      MARGIN_X + 20,
      bannerTop - bannerHeight + 16,
      40,
      40,
    );
  }

  page.drawText("DISTYNC", MARGIN_X + 74, bannerTop - 24, {
    font: "F2",
    size: compact ? 16 : 18,
    color: PDF_COLORS.white,
  });
  page.drawText(context.sourceName || "MSWDO", MARGIN_X + 74, bannerTop - 42, {
    font: "F2",
    size: compact ? 12 : 14,
    color: PDF_COLORS.white,
  });

  if (!compact) {
    page.drawText("Municipality of Malvar, Batangas", MARGIN_X + 74, bannerTop - 58, {
      font: "F2",
      size: 10,
      color: PDF_COLORS.white,
    });
  }

  wrapText(context.reportTitle, compact ? 30 : 26).forEach((line, lineIndex) => {
    page.drawText(line, MARGIN_X + 338, bannerTop - 30 - lineIndex * 13, {
      font: "F2",
      size: compact ? 11 : 12,
      color: PDF_COLORS.white,
    });
  });

  return bannerHeight;
};

const drawMetaGrid = (page, context, cursorY) => {
  const gap = 8;
  const cardWidth = (CONTENT_WIDTH - gap * 2) / 3;
  const cardHeight = 48;
  const items = [
    { label: "Disaster Event", value: context.eventLabel },
    { label: "Barangay", value: context.barangayLabel },
    { label: "Generated", value: context.generatedAtLabel },
  ];

  items.forEach((item, index) => {
    const x = MARGIN_X + index * (cardWidth + gap);
    page.fillRect(x, cursorY - cardHeight, cardWidth, cardHeight, PDF_COLORS.lightBlue);
    page.strokeRect(x, cursorY - cardHeight, cardWidth, cardHeight, PDF_COLORS.border, 0.8);
    page.drawText(item.label.toUpperCase(), x + 8, cursorY - 14, {
      font: "F2",
      size: 7,
      color: PDF_COLORS.grayText,
    });

    wrapText(item.value, estimateMaxChars(cardWidth - 16, 8))
      .slice(0, 2)
      .forEach((line, lineIndex) => {
        page.drawText(line, x + 8, cursorY - 29 - lineIndex * 9, {
          font: "F2",
          size: 8,
          color: PDF_COLORS.bodyText,
        });
      });
  });

  return cursorY - cardHeight - 14;
};

const drawMetricGrid = (page, summaryMetrics, cursorY) => {
  const gap = 8;
  const cardWidth = (CONTENT_WIDTH - gap * 2) / 3;
  const cardHeight = 48;
  const metrics = [
    ["Total Affected Individuals", summaryMetrics.total_number_of_evacuees_individuals],
    ["Total Affected Families", summaryMetrics.total_number_of_families],
    ["Average Household Size", summaryMetrics.average_household_size],
    ["Currently Admitted Evacuees", summaryMetrics.currently_admitted_evacuees],
    ["Departed Evacuees", summaryMetrics.total_departed_evacuees],
    ["Barangays Covered", summaryMetrics.total_barangays_covered],
  ];

  metrics.forEach(([label, value], index) => {
    const columnIndex = index % 3;
    const rowIndex = Math.floor(index / 3);
    const x = MARGIN_X + columnIndex * (cardWidth + gap);
    const y = cursorY - rowIndex * (cardHeight + gap);

    page.fillRect(x, y - cardHeight, cardWidth, cardHeight, PDF_COLORS.lightBlue);
    page.strokeRect(x, y - cardHeight, cardWidth, cardHeight, PDF_COLORS.border, 0.8);
    page.drawText(label.toUpperCase(), x + 8, y - 14, {
      font: "F2",
      size: 7,
      color: PDF_COLORS.grayText,
    });
    page.drawText(formatNumber(value), x + 8, y - 35, {
      font: "F2",
      size: 15,
      color: PDF_COLORS.navy,
    });
  });

  return cursorY - cardHeight * 2 - gap - 14;
};

const getTableHeaderHeight = (columns) => {
  const headerLines = columns.map((column) =>
    wrapText(column.label, estimateMaxChars(column.width - 12, 8)),
  );

  return {
    headerLines,
    headerHeight: Math.max(...headerLines.map((lines) => lines.length), 1) * 10 + 8,
  };
};

const drawTableHeader = (page, columns, cursorY) => {
  const { headerLines, headerHeight } = getTableHeaderHeight(columns);

  page.fillRect(MARGIN_X, cursorY - headerHeight, CONTENT_WIDTH, headerHeight, PDF_COLORS.blue);
  page.strokeRect(
    MARGIN_X,
    cursorY - headerHeight,
    CONTENT_WIDTH,
    headerHeight,
    PDF_COLORS.border,
    0.8,
  );

  let columnX = MARGIN_X;
  columns.forEach((column, index) => {
    headerLines[index].forEach((line, lineIndex) => {
      page.drawText(line, columnX + 6, cursorY - 13 - lineIndex * 10, {
        font: "F2",
        size: 8,
        color: PDF_COLORS.white,
      });
    });

    columnX += column.width;

    if (index < columns.length - 1) {
      page.drawLine(
        columnX,
        cursorY,
        columnX,
        cursorY - headerHeight,
        PDF_COLORS.border,
        0.6,
      );
    }
  });

  return cursorY - headerHeight;
};

const drawTableRow = (page, row, columns, cursorY, rowIndex) => {
  const { cellLines, rowHeight } = getTableRowLayout(row, columns);
  const backgroundColor = rowIndex % 2 === 0 ? PDF_COLORS.white : PDF_COLORS.lightBlue;

  page.fillRect(MARGIN_X, cursorY - rowHeight, CONTENT_WIDTH, rowHeight, backgroundColor);
  page.strokeRect(
    MARGIN_X,
    cursorY - rowHeight,
    CONTENT_WIDTH,
    rowHeight,
    PDF_COLORS.border,
    0.6,
  );

  let columnX = MARGIN_X;
  columns.forEach((column, index) => {
    cellLines[index].forEach((line, lineIndex) => {
      page.drawText(line, columnX + 6, cursorY - 14 - lineIndex * TABLE_LINE_HEIGHT, {
        size: 8,
        color: PDF_COLORS.bodyText,
      });
    });

    columnX += column.width;

    if (index < columns.length - 1) {
      page.drawLine(
        columnX,
        cursorY,
        columnX,
        cursorY - rowHeight,
        PDF_COLORS.border,
        0.5,
      );
    }
  });

  return cursorY - rowHeight;
};

const buildMswdoAnalyticsPdfBuffer = ({
  dashboard,
  eventLabel,
  eventCode,
  barangayLabel,
  sourceName = "MSWDO",
  reportTitle = "Evacuee Analytics Report",
}) => {
  const summaryMetrics = dashboard?.summary_metrics || {};
  const charts = dashboard?.charts || {};
  const context = {
    eventLabel: normalizeText(eventLabel),
    eventCode: normalizeText(eventCode),
    barangayLabel: normalizeText(barangayLabel),
    generatedAtLabel: formatDateTime(new Date()),
    reportTitle,
    sourceName,
  };
  const sections = [
    {
      title: "Affected Individuals and Families per Barangay",
      columns: [
        { key: "barangay", label: "Barangay", width: 112 },
        { key: "individuals", label: "Affected Individuals", width: 104 },
        { key: "families", label: "Affected Families", width: 98 },
        { key: "admitted", label: "Admitted Evacuees", width: 100 },
        { key: "departed", label: "Departed Evacuees", width: 109 },
      ],
      rows: (Array.isArray(charts.per_barangay) ? charts.per_barangay : []).map((item) => ({
        barangay: item.barangay_name || "Unknown",
        individuals: Number(item.evacuees_count || 0),
        families: Number(item.families_count || 0),
        admitted: Number(item.admitted_evacuees_count || 0),
        departed: Number(item.departed_evacuees_count || 0),
      })),
    },
    {
      title: "Sex Distribution",
      columns: [
        { key: "name", label: "Category", width: 366 },
        { key: "value", label: "Count", width: 157 },
      ],
      rows: Array.isArray(charts.sex_distribution) ? charts.sex_distribution : [],
    },
    {
      title: "Sector and Household Condition Distribution",
      columns: [
        { key: "name", label: "Category", width: 366 },
        { key: "value", label: "Count", width: 157 },
      ],
      rows: Array.isArray(charts.sector_distribution) ? charts.sector_distribution : [],
    },
    {
      title: "Stay Type Distribution",
      columns: [
        { key: "name", label: "Category", width: 366 },
        { key: "value", label: "Count", width: 157 },
      ],
      rows: Array.isArray(charts.stay_type_distribution)
        ? charts.stay_type_distribution
        : [],
    },
    {
      title: "Evacuees per Evacuation Center (Accumulated)",
      columns: [
        { key: "name", label: "Evacuation Center", width: 366 },
        { key: "value", label: "Count", width: 157 },
      ],
      rows: Array.isArray(charts.evacuation_center_distribution)
        ? charts.evacuation_center_distribution
        : [],
    },
  ];
  const pages = [];
  let page;
  let cursorY;

  const startPage = ({ detailed = false } = {}) => {
    page = createPdfBuilder({ width: PAGE_WIDTH, height: PAGE_HEIGHT });
    pages.push(page);
    cursorY = TOP_Y - drawBanner(page, context, { compact: !detailed }) - 12;

    if (detailed) {
      cursorY = drawMetaGrid(page, context, cursorY);
      cursorY = drawMetricGrid(page, summaryMetrics, cursorY);
    }
  };

  const drawSectionHeader = (section) => {
    page.drawText(section.title, MARGIN_X, cursorY, {
      font: "F2",
      size: 12,
      color: PDF_COLORS.navy,
    });
    cursorY -= 16;
    cursorY = drawTableHeader(page, section.columns, cursorY);
  };

  startPage({ detailed: true });

  sections.forEach((section) => {
    const { headerHeight } = getTableHeaderHeight(section.columns);
    const minimumSectionHeight = 16 + headerHeight + 24;

    if (cursorY - minimumSectionHeight < BOTTOM_Y) {
      startPage();
    }

    drawSectionHeader(section);

    if (section.rows.length === 0) {
      if (cursorY - 32 < BOTTOM_Y) {
        startPage();
        drawSectionHeader(section);
      }

      page.drawText("No data available for the selected filters.", MARGIN_X + 6, cursorY - 18, {
        size: 9,
        color: PDF_COLORS.grayText,
      });
      cursorY -= 32;
      return;
    }

    section.rows.forEach((row, rowIndex) => {
      const { rowHeight } = getTableRowLayout(row, section.columns);

      if (cursorY - rowHeight < BOTTOM_Y) {
        startPage();
        drawSectionHeader(section);
      }

      cursorY = drawTableRow(page, row, section.columns, cursorY, rowIndex);
    });

    cursorY -= 16;
  });

  pages.forEach((currentPage, pageIndex) => {
    currentPage.drawLine(
      MARGIN_X,
      34,
      MARGIN_X + CONTENT_WIDTH,
      34,
      PDF_COLORS.border,
      0.8,
    );
    currentPage.drawText(`${context.eventCode} | ${context.barangayLabel}`, MARGIN_X, 20, {
      size: 8,
      color: PDF_COLORS.grayText,
    });
    currentPage.drawText(`Page ${pageIndex + 1} of ${pages.length}`, PAGE_WIDTH - 100, 20, {
      size: 8,
      color: PDF_COLORS.grayText,
    });
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

const buildMswdoAnalyticsPdfFilename = ({
  eventCode,
  eventTitle,
  barangayName,
}) => {
  const dateStamp = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  })
    .format(new Date())
    .replace(/-/g, "");

  return `mswdo-evacuee-analytics-${slugifyFilePart(
    eventCode || eventTitle,
    "report",
  )}-${slugifyFilePart(barangayName, "all-barangays")}-${dateStamp}.pdf`;
};

module.exports = {
  buildMswdoAnalyticsPdfBuffer,
  buildMswdoAnalyticsPdfFilename,
};
