import React, { useEffect, useMemo, useState } from "react";
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
    lineHeight: 1.3,
    minWidth: 0,
    overflowWrap: "anywhere",
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
    minWidth: 0,
    flexWrap: "wrap",
  },
  total: {
    margin: 0,
    color: "#2f6499",
    fontSize: "13px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  emptyWrapper: {
    minHeight: "320px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    color: "#60738a",
  },
  emptyIcon: {
    width: "132px",
    height: "92px",
    borderRadius: "18px",
    border: "2px dashed #cfddeb",
    background:
      "linear-gradient(180deg, transparent 0 22%, #dbe8f5 22% 34%, transparent 34% 48%, #eef5fb 48% 60%, transparent 60% 74%, #f8fbfe 74% 86%, transparent 86%)",
    boxShadow: "inset 0 0 0 14px #ffffff",
    marginBottom: "18px",
  },
  emptyMessage: {
    margin: 0,
    color: "#4f6c88",
    fontSize: "15px",
    lineHeight: 1.5,
    maxWidth: "280px",
  },
  emptyHint: {
    margin: "6px 0 0",
    color: "#8aa0b6",
    fontSize: "13px",
    lineHeight: 1.45,
    maxWidth: "300px",
  },
};

const getViewportWidth = () => {
  return typeof window === "undefined" ? 1440 : window.innerWidth;
};

const useChartViewport = () => {
  const [viewportWidth, setViewportWidth] = useState(getViewportWidth);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return {
    isNarrow: viewportWidth <= 640,
    isCompact: viewportWidth <= 900,
  };
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

const getHighestValue = (data, dataKey) => {
  return Math.max(...data.map((item) => Number(item[dataKey] || 0)));
};

const getFallbackBarColor = (index) => {
  const hue = (index * 47 + 18) % 360;
  return `hsl(${hue}, 62%, 46%)`;
};

const getBarColor = ({ item, index, highestValue, firstHighestIndex, dataKey }) => {
  if (Number(item[dataKey] || 0) === highestValue && index === firstHighestIndex) {
    return HIGHLIGHT_COLOR;
  }

  const paletteIndex = index > firstHighestIndex ? index - 1 : index;
  return BAR_COLORS[paletteIndex] || getFallbackBarColor(paletteIndex);
};

const BarangayBarChart = ({ title, description, data, dataKey, height = 320 }) => {
  const { isCompact, isNarrow } = useChartViewport();
  const highestValue = data.length > 0 ? getHighestValue(data, dataKey) : 0;
  const firstHighestIndex = data.findIndex(
    (item) => Number(item[dataKey] || 0) === highestValue,
  );
  const totalValue = data.reduce(
    (sum, item) => sum + Number(item[dataKey] || 0),
    0,
  );
  const yAxisWidth = isNarrow ? 76 : isCompact ? 96 : 120;
  const chartHeight = isNarrow ? Math.max(height - 40, 300) : height;
  const tickFormatter = useMemo(
    () => (value) => {
      const text = String(value ?? "");
      const maxLength = isNarrow ? 12 : isCompact ? 16 : 22;

      return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
    },
    [isCompact, isNarrow],
  );

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
        <div
          style={{
            width: "100%",
            minWidth: 0,
            height: `${chartHeight}px`,
            overflow: "hidden",
          }}
        >
          <ResponsiveContainer>
            <BarChart
              data={data}
              layout="vertical"
              margin={{
                top: 10,
                right: isNarrow ? 8 : 24,
                left: isNarrow ? 0 : 12,
                bottom: 10,
              }}
            >
              <CartesianGrid stroke="#e4edf6" strokeDasharray="3 3" />
              <XAxis
                type="number"
                tick={{ fill: "#66809c", fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={yAxisWidth}
                tick={{ fill: "#66809c", fontSize: 12 }}
                tickFormatter={tickFormatter}
              />
              <Tooltip wrapperStyle={{ maxWidth: isNarrow ? 220 : 320 }} />
              <Bar dataKey={dataKey} radius={[0, 8, 8, 0]}>
                {data.map((item, index) => (
                  <Cell
                    key={`${item.name}-${index}`}
                    fill={getBarColor({
                      item,
                      index,
                      highestValue,
                      firstHighestIndex,
                      dataKey,
                    })}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={chartStyles.emptyWrapper}>
          <div aria-hidden="true" style={chartStyles.emptyIcon} />
          <p style={chartStyles.emptyMessage}>
            No matching data available for this view.
          </p>
          <p style={chartStyles.emptyHint}>
            Try changing the disaster event or barangay filter.
          </p>
        </div>
      )}
    </section>
  );
};

export default BarangayBarChart;
