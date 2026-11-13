import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const HouseholdConditionsSection = ({ form }) => {
  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Household Conditions</h3>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
        {form.householdSectors.map((sector) => (
          <label
            key={sector.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              border: "1px solid #d4dfeb",
              borderRadius: "999px",
              padding: "10px 14px",
              backgroundColor: "#f8fbfe",
              color: "#385a7b",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={form.householdSectorIds.includes(sector.id)}
              onChange={() => form.toggleHouseholdSector(sector.id)}
            />
            {sector.name}
          </label>
        ))}
      </div>
    </section>
  );
};

export default HouseholdConditionsSection;
