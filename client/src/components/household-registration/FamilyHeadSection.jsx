import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { deriveAgeGroup } from "../../utils/ageGroup";
import {
  formatMemberSectorLabel,
  getCanonicalMemberSectorCode,
  isAgeBasedMemberSectorCode,
} from "../../utils/registrationOptions";

const fieldStyles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    color: "#55718b",
    fontSize: "13px",
    fontWeight: 700,
  },
  input: {
    minHeight: "44px",
    border: "1px solid #d0ddeb",
    borderRadius: "14px",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#1f405f",
    backgroundColor: "#ffffff",
    boxSizing: "border-box",
  },
};

const FamilyHeadSection = ({ form }) => {
  const derivedFamilyHeadAgeSector = deriveAgeGroup(
    Number.isInteger(form.familyHead.age_value) ? form.familyHead.age_value : null,
    "YEARS",
  );

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Family Head Information</h3>
        
      </div>

      <div style={fieldStyles.grid}>
        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>First Name</span>
          <input
            type="text"
            value={form.familyHead.first_name}
            onChange={(event) =>
              form.updateFamilyHeadField("first_name", event.target.value)
            }
            style={fieldStyles.input}
          />
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Middle Name</span>
          <input
            type="text"
            value={form.familyHead.middle_name}
            onChange={(event) =>
              form.updateFamilyHeadField("middle_name", event.target.value)
            }
            style={fieldStyles.input}
          />
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Last Name</span>
          <input
            type="text"
            value={form.familyHead.last_name}
            onChange={(event) =>
              form.updateFamilyHeadField("last_name", event.target.value)
            }
            style={fieldStyles.input}
          />
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Suffix (If Applicable) </span>
          <input
            type="text"
            value={form.familyHead.suffix}
            onChange={(event) =>
              form.updateFamilyHeadField("suffix", event.target.value)
            }
            style={fieldStyles.input}
          />
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Sex</span>
          <select
            value={form.familyHead.sex}
            onChange={(event) =>
              form.updateFamilyHeadField("sex", event.target.value)
            }
            style={fieldStyles.input}
          >
            <option value="MALE">MALE</option>
            <option value="FEMALE">FEMALE</option>
          </select>
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Age</span>
          <input
            type="number"
            min="0"
            value={form.familyHead.age_value}
            onChange={(event) =>
              form.updateFamilyHeadField("age_value", event.target.value)
            }
            style={fieldStyles.input}
          />
        </label>

      </div>

      <div style={{ marginTop: "18px" }}>
        <p style={{ ...shellStyles.mutedText, margin: "0 0 10px", fontWeight: 700 }}>
          Member Sectors
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {form.memberSectorOptions.map((sector) => {
            const sectorCode = getCanonicalMemberSectorCode(sector.code);
            const isAgeBasedSector = isAgeBasedMemberSectorCode(sectorCode);
            const isChecked = isAgeBasedSector
              ? sectorCode === derivedFamilyHeadAgeSector
              : form.familyHead.sector_ids.includes(sector.id);

            return (
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
                opacity: isAgeBasedSector && !isChecked ? 0.8 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isAgeBasedSector}
                onChange={() => form.toggleFamilyHeadSector(sector.id)}
              />
              {formatMemberSectorLabel(sector)}
            </label>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FamilyHeadSection;
