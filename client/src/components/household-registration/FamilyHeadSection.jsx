import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

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
  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Family Head Info</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
          Keep this section aligned with the one member marked as family head.
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
            <option value="OTHER">OTHER</option>
          </select>
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Birth Date</span>
          <input
            type="date"
            value={form.familyHead.birth_date}
            onChange={(event) =>
              form.updateFamilyHeadField("birth_date", event.target.value)
            }
            style={fieldStyles.input}
          />
        </label>
      </div>
    </section>
  );
};

export default FamilyHeadSection;
