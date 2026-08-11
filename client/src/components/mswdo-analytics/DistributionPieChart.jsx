import React from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { shellStyles } from "../layout/BarangayLayout";

const COLORS = [
  "#2f6499",
  "#1f9d8a",
  "#f59e0b",
  "#7c8fd6",
  "#d977a8",
  "#14b8a6",
  "#8b5cf6",
  "#ef4444",
  "#22c55e",
  "#eab308",
  "#0ea5e9",
  "#f97316",
  "#64748b",
  "#06b6d4",
  "#84cc16",
];
const HIGHEST_VALUE_COLOR = "#2f6499";
const DEFAULT_EMPTY_MESSAGE = "No matching data available for this view.";

const emptyStateStyles = {
  wrapper: {
    minHeight: "320px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    color: "#60738a",
  },
  icon: {
    width: "112px",
    height: "112px",
    borderRadius: "999px",
    border: "2px dashed #cfddeb",
    background:
      "conic-gradient(from 40deg, #dbe8f5 0deg 110deg, #eef5fb 110deg 250deg, #f8fbfe 250deg 360deg)",
    boxShadow: "inset 0 0 0 22px #ffffff",
    marginBottom: "18px",
  },
  message: {
    margin: 0,
    color: "#4f6c88",
    fontSize: "15px",
    lineHeight: 1.5,
    maxWidth: "280px",
  },
  hint: {
    margin: "6px 0 0",
    color: "#8aa0b6",
    fontSize: "13px",
    lineHeight: 1.45,
    maxWidth: "300px",
  },
};

const getHighestValue = (data) => {
  return Math.max(...data.map((item) => Number(item.value || 0)));
};

const getSliceColor = ({
  entry,
  index,
  highestValue,
  highestValueFirstIndex,
  colors,
  colorMap,
}) => {
  if (colorMap?.[entry.name]) {
    return colorMap[entry.name];
  }

  if (index === highestValueFirstIndex && Number(entry.value || 0) === highestValue) {
    return HIGHEST_VALUE_COLOR;
  }

  const fallbackColors = colors.filter((color) => color !== HIGHEST_VALUE_COLOR);
  const palette = fallbackColors.length > 0 ? fallbackColors : colors;

  return palette[index % palette.length];
};

const renderOrderedLegend = ({ data, getColorForEntry }) => {
  return (
    <ul
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "8px 14px",
        margin: "8px 0 0",
        padding: 0,
        listStyle: "none",
      }}
    >
      {data.map((entry, index) => (
        <li
          key={`${entry.name}-legend-${index}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: getColorForEntry(entry, index),
            fontSize: "14px",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "12px",
              height: "12px",
              backgroundColor: getColorForEntry(entry, index),
              display: "inline-block",
            }}
          />
          {entry.name}
        </li>
      ))}
    </ul>
  );
};

const DistributionPieChart = ({
  title,
  description,
  data,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  colors = COLORS,
  highlightHighest = true,
  colorMap,
  innerRadius = 58,
}) => {
  const highestValue = data.length > 0 ? getHighestValue(data) : 0;
  const highestValueFirstIndex = data.findIndex(
    (item) => Number(item.value || 0) === highestValue,
  );
  const getColorForEntry = (entry, index) =>
    highlightHighest
      ? getSliceColor({
          entry,
          index,
          highestValue,
          highestValueFirstIndex,
          colors,
          colorMap,
        })
      : colorMap?.[entry.name] || colors[index % colors.length];

  return (
    <section style={shellStyles.card}>
      <h3 style={{ margin: 0, color: "#17324d", fontSize: "18px" }}>
        {title}
      </h3>
      {description ? (
        <p style={{ margin: "8px 0 18px", color: "#60738a", fontSize: "14px" }}>
          {description}
        </p>
      ) : null}

      {data.length > 0 ? (
        <div style={{ width: "100%", height: "320px" }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={innerRadius}
                label
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`${entry.name}-${index}`}
                    fill={getColorForEntry(entry, index)}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend
                content={() =>
                  renderOrderedLegend({ data, getColorForEntry })
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={emptyStateStyles.wrapper}>
          <div aria-hidden="true" style={emptyStateStyles.icon} />
          <p style={emptyStateStyles.message}>{emptyMessage}</p>
          <p style={emptyStateStyles.hint}>
            Try changing the disaster event or barangay filter.
          </p>
        </div>
      )}
    </section>
  );
};

export default DistributionPieChart;
