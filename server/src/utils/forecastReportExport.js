const reportExport = require("./masterlistExport");

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN_X = 28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const CARD_GAP = 8;

const MODEL_LABELS = {
  MOVING_AVERAGE: "Moving Average",
  EXPONENTIAL_SMOOTHING: "Exponential Smoothing",
  TREND_PROJECTION: "Trend Projection",
};

const PIECE_UNITS = new Set(["pc", "pcs", "piece", "pieces", "unit", "units"]);

const formatNumber = (value) => {
  const numericValue = Number(value || 0);

  return Number.isInteger(numericValue)
    ? new Intl.NumberFormat("en-PH").format(numericValue)
    : new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(
        numericValue,
      );
};

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(parsedValue);
};

const formatDate = (value) => {
  if (!value) {
    return "--";
  }

  const parsedValue = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);

  if (Number.isNaN(parsedValue.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(parsedValue);
};

const formatQuantity = (value, unitOfMeasure, roundUp = false) => {
  const numericValue = Number(value || 0);
  const normalizedUnit = String(unitOfMeasure || "units").trim() || "units";
  const isPieceBased = PIECE_UNITS.has(normalizedUnit.toLowerCase());
  const displayValue = isPieceBased
    ? roundUp
      ? Math.ceil(Math.max(numericValue, 0))
      : Math.round(numericValue)
    : numericValue;

  return `${formatNumber(displayValue)} ${normalizedUnit}`;
};

const wrapText = (value, maxChars) => {
  const normalizedValue = String(value ?? "--").trim();

  if (!normalizedValue) {
    return ["--"];
  }

  const safeMaxChars = Math.max(4, Number(maxChars) || 4);
  const lines = [];
  let currentLine = "";

  normalizedValue.split(/\s+/).forEach((word) => {
    if (word.length > safeMaxChars) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }

      for (let index = 0; index < word.length; index += safeMaxChars) {
        const chunk = word.slice(index, index + safeMaxChars);

        if (chunk.length === safeMaxChars || index + safeMaxChars < word.length) {
          lines.push(chunk);
        } else {
          currentLine = chunk;
        }
      }
      return;
    }

    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length <= safeMaxChars) {
      currentLine = candidate;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length ? lines : ["--"];
};

const getRiskPriority = (riskLevel) => {
  return {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  }[String(riskLevel || "").toUpperCase()] || 0;
};

const getDepletionPriority = (daysUntilDepletion) => {
  if (daysUntilDepletion === null || daysUntilDepletion === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  return Number(daysUntilDepletion);
};

const sortPriorityRows = (rows = []) => {
  return [...rows].sort((left, right) => {
    const riskDifference =
      getRiskPriority(right.risk_level) - getRiskPriority(left.risk_level);

    if (riskDifference !== 0) {
      return riskDifference;
    }

    const depletionDifference =
      getDepletionPriority(left.days_until_depletion) -
      getDepletionPriority(right.days_until_depletion);

    if (depletionDifference !== 0) {
      return depletionDifference;
    }

    return (
      Number(right.recommended_reorder_quantity || 0) -
      Number(left.recommended_reorder_quantity || 0)
    );
  });
};

const sanitizeFilenamePart = (value) => {
  const normalizedValue = String(value || "selected-disaster-event")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return normalizedValue || "selected-disaster-event";
};

const getDateStamp = () => {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  })
    .format(new Date())
    .replace(/-/g, "");
};

const buildFilename = (eventName) =>
  `inventory-forecast-${sanitizeFilenamePart(eventName)}-${getDateStamp()}.pdf`;

const getDashboardParts = (payload = {}) => {
  const dashboard = payload.dashboard || {};
  const summary = dashboard.summary || {};
  const forecastRun = payload.forecast_run || {};
  const results = Array.isArray(payload.results) ? payload.results : [];
  const charts = dashboard.charts || {};
  const usageRows = Array.isArray(charts.inventory_usage_trend)
    ? charts.inventory_usage_trend.slice(-14)
    : [];

  return {
    dashboard,
    summary,
    forecastRun,
    results,
    demandRows: Array.isArray(charts.forecasted_demand)
      ? charts.forecasted_demand
      : [],
    stockRows: Array.isArray(charts.projected_stock_levels)
      ? charts.projected_stock_levels
      : [],
    usageRows,
  };
};

const buildUsageSummary = (rows = []) => {
  const totalUsed = rows.reduce(
    (sum, row) => sum + Number(row.total_quantity || 0),
    0,
  );
  const activeDays = rows.filter(
    (row) => Number(row.total_quantity || 0) > 0,
  ).length;
  const peakRow = rows.reduce(
    (highest, row) =>
      Number(row.total_quantity || 0) > Number(highest?.total_quantity || 0)
        ? row
        : highest,
    rows[0] || null,
  );

  return {
    totalUsed,
    activeDays,
    averageDailyUse: rows.length ? totalUsed / rows.length : 0,
    peakDate: peakRow?.usage_date || null,
    peakQuantity: Number(peakRow?.total_quantity || 0),
  };
};

const buildPdfBuffer = (payload = {}) => {
  const {
    summary,
    forecastRun,
    results,
    demandRows,
    stockRows,
    usageRows,
  } = getDashboardParts(payload);
  const eventName =
    forecastRun.disaster_event?.title ||
    payload.dashboard?.disaster_event?.title ||
    "Selected disaster event";
  const modelLabel =
    MODEL_LABELS[forecastRun.model_name] ||
    forecastRun.model_name ||
    "Moving Average";
  const pages = [];
  let page = null;
  let cursorY = 0;

  const addText = (text, x, y, options = {}) => {
    page.drawText(String(text ?? ""), x, y, {
      font: options.bold ? "F2" : "F1",
      size: options.size || 8,
      color: options.color || reportExport.PDF_COLORS.bodyText,
    });
  };

  const startPage = (sectionTitle = null) => {
    page = reportExport.createPdfBuilder({
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
    });
    page.fillRect(
      MARGIN_X,
      PAGE_HEIGHT - 58,
      CONTENT_WIDTH,
      40,
      reportExport.PDF_COLORS.navy,
    );
    page.fillRect(MARGIN_X + 12, PAGE_HEIGHT - 51, 26, 26, reportExport.PDF_COLORS.white);

    if (reportExport.PDF_IMAGE_REGISTRY.distyncLogo) {
      page.drawImage(
        "distyncLogo",
        MARGIN_X + 14,
        PAGE_HEIGHT - 49,
        22,
        22,
      );
    }

    addText("DISTYNC", MARGIN_X + 48, PAGE_HEIGHT - 32, {
      bold: true,
      size: 15,
      color: reportExport.PDF_COLORS.white,
    });
    addText("Office of the Mayor", MARGIN_X + 48, PAGE_HEIGHT - 45, {
      bold: true,
      size: 8,
      color: reportExport.PDF_COLORS.white,
    });
    addText("Inventory Forecasting Report", PAGE_WIDTH - 220, PAGE_HEIGHT - 38, {
      bold: true,
      size: 10,
      color: reportExport.PDF_COLORS.white,
    });

    cursorY = PAGE_HEIGHT - 78;

    if (sectionTitle) {
      addText(sectionTitle, MARGIN_X, cursorY, {
        bold: true,
        size: 13,
        color: reportExport.PDF_COLORS.navy,
      });
      cursorY -= 20;
    }
  };

  const finishPage = () => {
    addText(`Page ${pages.length + 1}`, PAGE_WIDTH - 58, 17, { size: 7 });
    pages.push(page);
  };

  const drawCard = (x, topY, width, height, label, value, valueSize = 9) => {
    page.fillRect(x, topY - height, width, height, reportExport.PDF_COLORS.lightBlue);
    page.strokeRect(
      x,
      topY - height,
      width,
      height,
      reportExport.PDF_COLORS.border,
      0.7,
    );
    addText(label, x + 7, topY - 12, {
      bold: true,
      size: 6.2,
      color: reportExport.PDF_COLORS.grayText,
    });
    addText(value, x + 7, topY - 27, {
      bold: true,
      size: valueSize,
      color: reportExport.PDF_COLORS.navy,
    });
  };

  const drawGrid = (items, topY, cardHeight, valueSize = 9) => {
    const columnCount = 3;
    const cardWidth = (CONTENT_WIDTH - CARD_GAP * (columnCount - 1)) / columnCount;
    const rowCount = Math.ceil(items.length / columnCount);

    items.forEach((item, index) => {
      const columnIndex = index % columnCount;
      const rowIndex = Math.floor(index / columnCount);
      const x = MARGIN_X + columnIndex * (cardWidth + CARD_GAP);
      const y = topY - rowIndex * (cardHeight + CARD_GAP);

      drawCard(x, y, cardWidth, cardHeight, item.label, item.value, valueSize);
    });

    return topY - rowCount * cardHeight - (rowCount - 1) * CARD_GAP;
  };

  const drawSectionCard = (title, topY, height) => {
    page.fillRect(
      MARGIN_X,
      topY - height,
      CONTENT_WIDTH,
      height,
      reportExport.PDF_COLORS.white,
    );
    page.strokeRect(
      MARGIN_X,
      topY - height,
      CONTENT_WIDTH,
      height,
      reportExport.PDF_COLORS.border,
      0.8,
    );
    addText(title, MARGIN_X + 10, topY - 16, {
      bold: true,
      size: 10,
      color: reportExport.PDF_COLORS.navy,
    });
  };

  const drawDemandChart = (rows, topY) => {
    const chartRows = rows.slice(0, 6);
    const chartX = MARGIN_X + 170;
    const chartWidth = CONTENT_WIDTH - 260;
    const maxValue = Math.max(
      ...chartRows.map((row) => Number(row.forecasted_usage || 0)),
      1,
    );

    chartRows.forEach((row, index) => {
      const rowY = topY - index * 24;
      const value = Number(row.forecasted_usage || 0);
      const barWidth = Math.max(4, (value / maxValue) * chartWidth);
      const labelLines = wrapText(row.item_name || "Unknown", 26);

      addText(labelLines[0], MARGIN_X + 10, rowY - 4, { size: 7 });
      page.fillRect(
        chartX,
        rowY - 10,
        chartWidth,
        9,
        reportExport.PDF_COLORS.lightBlue,
      );
      page.fillRect(chartX, rowY - 10, barWidth, 9, "0.81 0.49 0.18");
      addText(formatQuantity(value, row.unit_of_measure, true), chartX + chartWidth + 8, rowY - 5, {
        size: 7,
      });
    });

    if (!chartRows.length) {
      addText("No chart data available.", MARGIN_X + 10, topY - 5, {
        size: 8,
        color: reportExport.PDF_COLORS.grayText,
      });
    }
  };

  const drawStockChart = (rows, topY) => {
    const chartRows = rows.slice(0, 8);
    const chartX = MARGIN_X + 170;
    const chartWidth = CONTENT_WIDTH - 260;
    const maxValue = Math.max(
      ...chartRows.flatMap((row) => [
        Number(row.current_available_stock || 0),
        Number(row.projected_remaining_stock || 0),
      ]),
      1,
    );

    chartRows.forEach((row, index) => {
      const rowY = topY - index * 42;
      const currentStock = Number(row.current_available_stock || 0);
      const remainingStock = Number(row.projected_remaining_stock || 0);
      const labelLines = wrapText(row.item_name || "Unknown", 26);

      addText(labelLines[0], MARGIN_X + 10, rowY - 8, { size: 7 });
      addText("Current", chartX, rowY - 4, { size: 6, color: reportExport.PDF_COLORS.grayText });
      addText("After", chartX, rowY - 18, { size: 6, color: reportExport.PDF_COLORS.grayText });
      page.fillRect(chartX + 32, rowY - 8, chartWidth - 70, 7, reportExport.PDF_COLORS.lightBlue);
      page.fillRect(
        chartX + 32,
        rowY - 8,
        Math.max(3, (currentStock / maxValue) * (chartWidth - 70)),
        7,
        "0.19 0.39 0.60",
      );
      page.fillRect(chartX + 32, rowY - 22, chartWidth - 70, 7, reportExport.PDF_COLORS.lightBlue);
      page.fillRect(
        chartX + 32,
        rowY - 22,
        Math.max(3, (remainingStock / maxValue) * (chartWidth - 70)),
        7,
        "0.19 0.54 0.34",
      );
      addText(formatQuantity(currentStock, row.unit_of_measure), chartX + chartWidth - 32, rowY - 4, { size: 6 });
      addText(formatQuantity(remainingStock, row.unit_of_measure), chartX + chartWidth - 32, rowY - 18, { size: 6 });
    });

    if (!chartRows.length) {
      addText("No chart data available.", MARGIN_X + 10, topY - 5, {
        size: 8,
        color: reportExport.PDF_COLORS.grayText,
      });
    }
  };

  const drawTableHeader = (columns, columnWidths, topY) => {
    const headerLineHeight = 8;
    const wrappedHeaders = columns.map((column, index) =>
      wrapText(column.label, Math.max(6, Math.floor(columnWidths[index] / 5.4))),
    );
    const headerHeight =
      Math.max(...wrappedHeaders.map((lines) => lines.length), 1) * headerLineHeight + 6;

    page.fillRect(
      MARGIN_X,
      topY - headerHeight,
      CONTENT_WIDTH,
      headerHeight,
      reportExport.PDF_COLORS.blue,
    );
    page.strokeRect(
      MARGIN_X,
      topY - headerHeight,
      CONTENT_WIDTH,
      headerHeight,
      reportExport.PDF_COLORS.border,
      0.7,
    );

    let currentX = MARGIN_X;
    wrappedHeaders.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => {
        addText(line, currentX + 3, topY - 11 - lineIndex * headerLineHeight, {
          bold: true,
          size: 6.5,
          color: reportExport.PDF_COLORS.white,
        });
      });

      if (index < wrappedHeaders.length - 1) {
        page.drawLine(
          currentX + columnWidths[index],
          topY,
          currentX + columnWidths[index],
          topY - headerHeight,
          reportExport.PDF_COLORS.border,
          0.5,
        );
      }

      currentX += columnWidths[index];
    });

    return headerHeight;
  };

  const drawTableSection = (
    title,
    columns,
    rows,
    columnWidths,
    { reuseCurrentPage = false } = {},
  ) => {
    const safeRows = rows.length ? rows : [{}];
    const rowFallback = rows.length ? null : "No data available.";
    let rowIndex = 0;

    const drawSectionPage = () => {
      if (reuseCurrentPage) {
        addText(title, MARGIN_X, cursorY, {
          bold: true,
          size: 10,
          color: reportExport.PDF_COLORS.navy,
        });
        cursorY -= 16;
        reuseCurrentPage = false;
      } else {
        startPage(title);
      }

      cursorY -= drawTableHeader(columns, columnWidths, cursorY);
      cursorY -= 4;
    };

    drawSectionPage();

    while (rowIndex < safeRows.length) {
      const row = safeRows[rowIndex];
      const wrappedCells = rowFallback
        ? [wrapText(rowFallback, 100)]
        : columns.map((column, index) =>
            wrapText(column.render(row), Math.max(6, Math.floor(columnWidths[index] / 5.4))),
          );
      const rowHeight = Math.max(...wrappedCells.map((lines) => lines.length), 1) * 9 + 7;

      if (cursorY - rowHeight < 34) {
        finishPage();
        drawSectionPage();
        continue;
      }

      const rowBackgroundColor =
        rowIndex % 2 === 0 ? reportExport.PDF_COLORS.white : "0.97 0.98 0.99";
      page.fillRect(
        MARGIN_X,
        cursorY - rowHeight,
        CONTENT_WIDTH,
        rowHeight,
        rowBackgroundColor,
      );
      page.strokeRect(
        MARGIN_X,
        cursorY - rowHeight,
        CONTENT_WIDTH,
        rowHeight,
        reportExport.PDF_COLORS.border,
        0.5,
      );

      let currentX = MARGIN_X;
      wrappedCells.forEach((lines, index) => {
        if (index < wrappedCells.length - 1) {
          page.drawLine(
            currentX + columnWidths[index],
            cursorY,
            currentX + columnWidths[index],
            cursorY - rowHeight,
            reportExport.PDF_COLORS.border,
            0.4,
          );
        }

        lines.forEach((line, lineIndex) => {
          addText(line, currentX + 3, cursorY - 12 - lineIndex * 9, {
            size: 6.5,
          });
        });
        currentX += columnWidths[index] || 0;
      });

      cursorY -= rowHeight;
      rowIndex += 1;
    }

    finishPage();
  };

  startPage();
  const metadata = [
    { label: "Disaster Event", value: eventName },
    { label: "Forecast Model", value: modelLabel },
    { label: "Generated", value: formatDateTime(new Date()) },
    { label: "Forecast Run", value: formatDateTime(forecastRun.run_at) },
    {
      label: "Forecast Horizon",
      value: `${forecastRun.parameters_json?.forecast_horizon_days || 14} days`,
    },
    {
      label: "Lookback",
      value: `${forecastRun.parameters_json?.lookback_days || 30} days`,
    },
  ];
  cursorY = drawGrid(metadata, cursorY, 32, 7.3) - 12;
  cursorY = drawGrid(
    [
      { label: "Items Checked", value: formatNumber(results.length) },
      { label: "Needs Restock", value: formatNumber(summary.shortage_item_count) },
      {
        label: "Recommended Restock",
        value: formatNumber(Math.ceil(Number(summary.total_recommended_reorder || 0))),
      },
      { label: "7-Day Risk", value: formatNumber(summary.seven_day_shortage_count) },
      { label: "Eligible Families", value: formatNumber(summary.eligible_household_count) },
      {
        label: "Not Yet Received",
        value: formatNumber(summary.unclaimed_eligible_household_count),
      },
    ],
    cursorY,
    38,
    11,
  ) - 14;
  const demandCardHeight = 170;
  drawSectionCard("Top Forecasted Needs", cursorY, demandCardHeight);
  drawDemandChart(demandRows, cursorY - 28);
  finishPage();

  startPage("Stock After Forecast");
  const stockCardHeight = 430;
  drawSectionCard("Current Stock Compared With Projected Remaining Stock", cursorY, stockCardHeight);
  drawStockChart(stockRows, cursorY - 34);
  finishPage();

  startPage("Recent Inventory Usage");
  const usageSummary = buildUsageSummary(usageRows);
  cursorY = drawGrid(
    [
      { label: "Total Used", value: formatNumber(usageSummary.totalUsed) },
      { label: "Daily Average", value: formatNumber(usageSummary.averageDailyUse) },
      { label: "Peak Day", value: formatDate(usageSummary.peakDate) },
      { label: "Peak Quantity", value: formatNumber(usageSummary.peakQuantity) },
      { label: "Days With Usage", value: `${usageSummary.activeDays} of ${usageRows.length}` },
    ],
    cursorY,
    38,
    9,
  ) - 14;
  addText(
    "Inventory released during the last 14 recorded days for the selected disaster event.",
    MARGIN_X,
    cursorY,
    { size: 7, color: reportExport.PDF_COLORS.grayText },
  );
  cursorY -= 14;
  const usageColumns = [
    { label: "Date", render: (row) => formatDate(row.usage_date) },
    { label: "Total Quantity Used", render: (row) => formatNumber(row.total_quantity) },
    {
      label: "Activity",
      render: (row) => (Number(row.total_quantity || 0) > 0 ? "Usage recorded" : "No usage"),
    },
  ];
  drawTableSection("Usage Records", usageColumns, usageRows, [220, 260, 306], {
    reuseCurrentPage: true,
  });

  const priorityRows = sortPriorityRows(results);
  const stockPriorityRows = priorityRows.filter(
    (row) =>
      Number(row.recommended_reorder_quantity || 0) > 0 ||
      Number(row.forecasted_usage || 0) > 0 ||
      String(row.risk_level || "").toUpperCase() !== "LOW",
  );
  const displayedPriorityRows =
    stockPriorityRows.length > 0 ? stockPriorityRows : priorityRows.slice(0, 10);
  const priorityColumns = [
    { label: "Item Name", render: (row) => row.item_name },
    {
      label: "Eligible Stock",
      render: (row) => formatQuantity(row.current_available_stock, row.unit_of_measure),
    },
    {
      label: "Forecast Need",
      render: (row) => formatQuantity(row.forecasted_usage, row.unit_of_measure, true),
    },
    {
      label: "Add Stock",
      render: (row) => formatQuantity(row.recommended_reorder_quantity, row.unit_of_measure, true),
    },
    {
      label: "After Forecast",
      render: (row) => formatQuantity(row.projected_remaining_stock, row.unit_of_measure),
    },
    { label: "Risk", render: (row) => row.risk_level || "LOW" },
  ];
  drawTableSection(
    "Stock-Up Priorities",
    priorityColumns,
    displayedPriorityRows,
    [170, 118, 112, 100, 120, 166],
  );

  const detailColumns = [
    { label: "Item Name", render: (row) => row.item_name },
    {
      label: "Assigned Pack Demand",
      render: (row) => formatQuantity(row.projected_household_demand, row.unit_of_measure, true),
    },
    {
      label: "Forecast Need",
      render: (row) => formatQuantity(row.forecasted_usage, row.unit_of_measure, true),
    },
    {
      label: "Recommended Restock",
      render: (row) => formatQuantity(row.recommended_reorder_quantity, row.unit_of_measure, true),
    },
    { label: "Projected Depletion", render: (row) => formatDate(row.projected_depletion_date) },
    {
      label: "Shortage",
      render: (row) =>
        row.shortage_within_seven_days
          ? `Shortage in ${row.days_until_depletion || 0} day(s)`
          : row.days_until_depletion === null
            ? "No short-term shortage"
            : `${row.days_until_depletion} day(s) remaining`,
    },
    { label: "Risk", render: (row) => row.risk_level || "LOW" },
  ];
  drawTableSection(
    "Detailed Forecast Results by Item",
    detailColumns,
    priorityRows,
    [145, 105, 100, 112, 100, 145, 79],
  );

  return reportExport.createPdfDocument(pages, reportExport.PDF_IMAGE_REGISTRY);
};

const buildExportFile = (payload) => ({
  buffer: buildPdfBuffer(payload),
  contentType: "application/pdf",
  filename: buildFilename(
    payload?.forecast_run?.disaster_event?.title ||
      payload?.dashboard?.disaster_event?.title,
  ),
});

module.exports = {
  buildExportFile,
  buildFilename,
  buildPdfBuffer,
};
