import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import {
  AGE_UNIT_OPTIONS,
  deriveAgeGroup,
  formatAgeGroupLabel,
} from "../../utils/ageGroup";

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
  const derivedFamilyHeadAgeGroup = deriveAgeGroup(
    Number.isInteger(form.familyHead.age_value) ? form.familyHead.age_value : null,
    form.familyHead.age_unit,
  );

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Family Head Info</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
          This information auto-fills Household Member 1 so you do not need to
          type the same family head details twice.
        </p>
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
          <span style={fieldStyles.label}>Suffix</span>
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
          <span style={fieldStyles.label}>Age Value</span>
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
          <span style={fieldStyles.label}>Age Unit</span>
          <select
            value={form.familyHead.age_unit}
            onChange={(event) =>
              form.updateFamilyHeadField("age_unit", event.target.value)
            }
            style={fieldStyles.input}
          >
            {AGE_UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Derived Age Group</span>
          <input
            type="text"
            value={formatAgeGroupLabel(derivedFamilyHeadAgeGroup)}
            disabled
            style={{
              ...fieldStyles.input,
              backgroundColor: "#f4f8fc",
              color: "#48627e",
            }}
          />
        </label>
      </div>
    </section>
  );
};

export default FamilyHeadSection;
