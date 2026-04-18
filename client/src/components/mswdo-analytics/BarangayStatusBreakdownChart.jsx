import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
};

const BarangayStatusBreakdownChart = ({ data }) => {
  return (
    <section style={shellStyles.card}>
      <h3 style={chartStyles.title}>Barangay-Level Admission Breakdown</h3>
      <p style={chartStyles.helper}>
        Latest-log admitted and departed evacuee counts for each barangay in the
        current MSWDO view.
      </p>

      {data.length > 0 ? (
        <div style={{ width: "100%", height: "320px" }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid stroke="#e4edf6" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-20}
                textAnchor="end"
                interval={0}
                height={70}
                tick={{ fill: "#66809c", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "#66809c", fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="admitted" name="Currently Admitted" fill="#4f86be" radius={[6, 6, 0, 0]} />
              <Bar dataKey="departed" name="Departed" fill="#95b7d8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p style={shellStyles.mutedText}>
          No barangay-level status breakdown is available for this view.
        </p>
      )}
    </section>
  );
};

export default BarangayStatusBreakdownChart;
