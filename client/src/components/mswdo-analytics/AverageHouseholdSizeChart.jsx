import React, { useEffect, useState } from "react";
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";
import { shellStyles } from "../layout/BarangayLayout";

const MAX_VISIBLE_AVERAGE = 10;

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
  };
};

const AverageHouseholdSizeChart = ({ value }) => {
  const { isNarrow } = useChartViewport();
  const averageValue = Number(value || 0);
  const chartValue = Math.min(averageValue, MAX_VISIBLE_AVERAGE);
  const displayValue = Number.isInteger(averageValue)
    ? averageValue
    : averageValue.toFixed(1);
  const data = [{ name: "Average Household Size", value: chartValue }];

  return (
    <section style={shellStyles.card}>
      <h3
        style={{
          margin: 0,
          color: "#17324d",
          fontSize: "18px",
          lineHeight: 1.3,
          overflowWrap: "anywhere",
        }}
      >
        Average Household Size
      </h3>

      <div
        style={{
          width: "100%",
          minWidth: 0,
          height: isNarrow ? "280px" : "320px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <ResponsiveContainer>
          <RadialBarChart
            data={data}
            cx="50%"
            cy="52%"
            innerRadius="68%"
            outerRadius="92%"
            startAngle={210}
            endAngle={-30}
            barSize={22}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, MAX_VISIBLE_AVERAGE]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background={{ fill: "#d8e5f1" }}
              dataKey="value"
              cornerRadius={18}
              fill="#2f6499"
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            pointerEvents: "none",
          }}
        >
          <strong style={{ color: "#0f2f4f", fontSize: isNarrow ? "36px" : "42px" }}>
            {displayValue}
          </strong>
          <span
            style={{
              color: "#688199",
              fontSize: "13px",
              fontWeight: 700,
              textAlign: "center",
              overflowWrap: "anywhere",
            }}
          >
            persons per household
          </span>
        </div>
      </div>
    </section>
  );
};

export default AverageHouseholdSizeChart;
