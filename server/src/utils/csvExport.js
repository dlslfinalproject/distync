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

const formatDateStamp = () => {
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

const buildCsvBuffer = ({ titleLines = [], columns = [], rows = [] }) => {
  const columnLine = columns.map((column) => escapeCsvValue(column.label)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((column) => escapeCsvValue(row[column.key])).join(","),
  );
  const content = [...titleLines, "", columnLine, ...dataLines].join("\r\n");

  return Buffer.from(content, "utf8");
};

const buildCsvFile = ({ filePrefix, titleLines, columns, rows }) => {
  return {
    buffer: buildCsvBuffer({ titleLines, columns, rows }),
    contentType: "text/csv; charset=utf-8",
    filename: `${filePrefix}-${formatDateStamp()}.csv`,
  };
};

module.exports = {
  formatDateOnly,
  formatDateTime,
  buildCsvFile,
};
