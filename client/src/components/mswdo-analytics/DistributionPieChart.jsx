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
  emptyMessage,
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
        <p style={shellStyles.mutedText}>{emptyMessage}</p>
      )}
    </section>
  );
};

export default DistributionPieChart;
