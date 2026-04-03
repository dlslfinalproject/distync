import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const BarangaySummaryChart = ({ items, commonSectors }) => {
  const maxValue = items.reduce((max, item) => Math.max(max, item.total), 0);

  return (
    <section style={shellStyles.card}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.2fr) minmax(260px, 0.8fr)",
          gap: "20px",
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: "#17324d" }}>Evacuees Per Barangay</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Simple ranked summary for the current active disaster event.
          </p>

          <div style={{ marginTop: "18px", display: "grid", gap: "14px" }}>
            {items.length === 0 ? (
              <p style={shellStyles.mutedText}>No barangay summary available.</p>
            ) : (
              items.map((item) => (
                <div key={item.name}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      marginBottom: "6px",
                      fontSize: "14px",
                      color: "#21405f",
                    }}
                  >
                    <span>{item.name}</span>
                    <strong>{item.total}</strong>
                  </div>
                  <div
                    style={{
                      height: "10px",
                      borderRadius: "999px",
                      backgroundColor: "#e8f0f8",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${maxValue === 0 ? 0 : (item.total / maxValue) * 100}%`,
                        height: "100%",
                        borderRadius: "999px",
                        background:
                          "linear-gradient(135deg, #2f6499 0%, #4c86be 100%)",
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 style={{ margin: 0, color: "#17324d" }}>Common Sectors</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Most frequent household and member sector tags from the masterlist.
          </p>

          <div style={{ marginTop: "18px", display: "grid", gap: "12px" }}>
            {commonSectors.length === 0 ? (
              <p style={shellStyles.mutedText}>No sector summary available.</p>
            ) : (
              commonSectors.map((sector) => (
                <div
                  key={sector.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    backgroundColor: "#f8fbfe",
                    border: "1px solid #d7e2ef",
                    color: "#21405f",
                    fontSize: "14px",
                  }}
                >
                  <span>{sector.name}</span>
                  <strong>{sector.count}</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BarangaySummaryChart;
