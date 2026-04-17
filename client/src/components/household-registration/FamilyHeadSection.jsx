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
  nameGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "16px",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 220px) minmax(180px, 220px)",
    gap: "16px",
    marginTop: "18px",
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
    width: "100%",
  },
  checkboxLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    color: "#4a6480",
    fontSize: "13px",
    fontWeight: 600,
  },
};

const FamilyHeadSection = ({ form }) => {
  const derivedFamilyHeadAgeSector = deriveAgeGroup(
    Number.isInteger(form.familyHead.age_value) ? form.familyHead.age_value : null,
    "YEARS",
  );

  const ageBasedSectors = form.memberSectorOptions.filter((sector) =>
    isAgeBasedMemberSectorCode(getCanonicalMemberSectorCode(sector.code)),
  );

  const nonAgeBasedSectors = form.memberSectorOptions.filter(
    (sector) =>
      !isAgeBasedMemberSectorCode(getCanonicalMemberSectorCode(sector.code)),
  );

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Family Head Information</h3>
      </div>

      <div style={fieldStyles.nameGrid}>
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
          <span style={fieldStyles.label}>Suffix (If Applicable)</span>
          <input
            type="text"
            value={form.familyHead.suffix}
            onChange={(event) =>
              form.updateFamilyHeadField("suffix", event.target.value)
            }
            style={fieldStyles.input}
          />
        </label>
      </div>

      <div style={fieldStyles.detailGrid}>
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
      </div>

      <div style={{ marginTop: "18px" }}>
        <p style={{ ...shellStyles.mutedText, margin: "0 0 10px", fontWeight: 700 }}>
          Member Sectors
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {ageBasedSectors.map((sector) => {
              const sectorCode = getCanonicalMemberSectorCode(sector.code);
              const isChecked = sectorCode === derivedFamilyHeadAgeSector;

              return (
                <label
                  key={sector.id}
                  style={{
                    ...fieldStyles.checkboxLabel,
                    opacity: isChecked ? 1 : 0.8,
                  }}
                >
                  <input type="checkbox" checked={isChecked} disabled />
                  {formatMemberSectorLabel(sector)}
                </label>
              );
            })}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {nonAgeBasedSectors.map((sector) => {
              const isChecked = form.familyHead.sector_ids.includes(sector.id);

              return (
                <label
                  key={sector.id}
                  style={fieldStyles.checkboxLabel}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => form.toggleFamilyHeadSector(sector.id)}
                  />
                  {formatMemberSectorLabel(sector)}
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FamilyHeadSection;