import React from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  headerCell: {
    padding: "14px 16px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
  },
  bodyCell: {
    padding: "16px",
    color: "#21405f",
    borderBottom: "1px solid #edf3f8",
    fontSize: "14px",
  },
  badge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    backgroundColor: "#e5f1fb",
    color: "#356592",
    fontSize: "12px",
    fontWeight: 700,
  },
};

const sampleRows = [
  {
    familyHead: "Juan Dela Cruz",
    barangay: "Bagong Pook",
    householdSize: 5,
    stayType: "EVAC_CENTER",
    status: "Ready for table data",
  },
  {
    familyHead: "Maria Santos",
    barangay: "San Juan",
    householdSize: 3,
    stayType: "RELATIVES",
    status: "Placeholder record",
  },
];

const BarangayMasterlistPage = () => {
  return (
    <>
      <PageHeader
        eyebrow="Barangay Workspace"
        title="Evacuee Registration"
        description="Shared page shell for the barangay masterlist view. This placeholder gives the team a clean header, stat cards, and table container ready for live household and evacuee data."
        actions={[
          { label: "Add Household" },
          { label: "Export Placeholder", variant: "secondary" },
        ]}
      />

      <section style={shellStyles.statGrid}>
        <div style={shellStyles.card}>
          <p style={shellStyles.mutedText}>Registered households</p>
          <p style={shellStyles.statValue}>0</p>
        </div>
        <div style={shellStyles.card}>
          <p style={shellStyles.mutedText}>Active stubs</p>
          <p style={shellStyles.statValue}>0</p>
        </div>
        <div style={shellStyles.card}>
          <p style={shellStyles.mutedText}>Pending verifications</p>
          <p style={shellStyles.statValue}>0</p>
        </div>
      </section>

      <section style={shellStyles.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: "#17324d" }}>Masterlist Table</h3>
            <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
              Placeholder content for `/barangay/masterlist`.
            </p>
          </div>
          <div
            style={{
              minWidth: "240px",
              border: "1px solid #d7e2ef",
              borderRadius: "14px",
              padding: "12px 14px",
              backgroundColor: "#f8fbfe",
              color: "#7a8ea4",
              fontSize: "14px",
            }}
          >
            Search households or family heads
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.headerCell}>Family Head</th>
                <th style={tableStyles.headerCell}>Barangay</th>
                <th style={tableStyles.headerCell}>Household Size</th>
                <th style={tableStyles.headerCell}>Stay Type</th>
                <th style={tableStyles.headerCell}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sampleRows.map((row) => (
                <tr key={`${row.familyHead}-${row.barangay}`}>
                  <td style={tableStyles.bodyCell}>{row.familyHead}</td>
                  <td style={tableStyles.bodyCell}>{row.barangay}</td>
                  <td style={tableStyles.bodyCell}>{row.householdSize}</td>
                  <td style={tableStyles.bodyCell}>{row.stayType}</td>
                  <td style={tableStyles.bodyCell}>
                    <span style={tableStyles.badge}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
};

export default BarangayMasterlistPage;
