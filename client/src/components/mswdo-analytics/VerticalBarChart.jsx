import React from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shellStyles } from "../layout/BarangayLayout";

const chartStyles = {
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "18px",
  },
  helper: {
    margin: "8px 0 18px",
    color: "#60738a",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  total: {
    margin: 0,
    color: "#2f6499",
    fontSize: "13px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
};

const HIGHLIGHT_COLOR = "#2f6499";
const BAR_COLORS = [
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
  "#ec4899",
  "#6366f1",
  "#10b981",
  "#f43f5e",
];

const getHighestValue = (data) => {
  return Math.max(...data.map((item) => Number(item.value || 0)));
};

const getFallbackBarColor = (index) => {
  const hue = (index * 47 + 18) % 360;
  return `hsl(${hue}, 62%, 46%)`;
};

const getBarColor = ({ item, index, highestValue, firstHighestIndex }) => {
  if (Number(item.value || 0) === highestValue && index === firstHighestIndex) {
    return HIGHLIGHT_COLOR;
  }

  const paletteIndex = index > firstHighestIndex ? index - 1 : index;
  return BAR_COLORS[paletteIndex] || getFallbackBarColor(paletteIndex);
};

const VerticalBarChart = ({ title, description, data }) => {
  const highestValue = data.length > 0 ? getHighestValue(data) : 0;
  const firstHighestIndex = data.findIndex(
    (item) => Number(item.value || 0) === highestValue,
  );
  const totalValue = data.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <section style={shellStyles.card}>
      <div style={chartStyles.header}>
        <h3 style={chartStyles.title}>{title}</h3>
        {data.length > 0 ? (
          <p style={chartStyles.total}>Total: {totalValue}</p>
        ) : null}
      </div>
      {description ? <p style={chartStyles.helper}>{description}</p> : null}

      {data.length > 0 ? (
        <div style={{ width: "100%", height: "320px" }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 36 }}>
              <CartesianGrid stroke="#e4edf6" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                interval={0}
                angle={-12}
                textAnchor="end"
                height={56}
                tick={{ fill: "#66809c", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "#66809c", fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {data.map((item, index) => (
                  <Cell
                    key={`${item.name}-${index}`}
                    fill={getBarColor({
                      item,
                      index,
                      highestValue,
                      firstHighestIndex,
                    })}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p style={shellStyles.mutedText}>No chart data available for this view.</p>
      )}
    </section>
  );
};

export default VerticalBarChart;
