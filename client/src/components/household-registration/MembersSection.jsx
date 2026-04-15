import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { pageHeaderStyles } from "../layout/PageHeader";
import {
  AGE_UNIT_OPTIONS,
  formatAgeGroupLabel,
} from "../../utils/ageGroup";

const fieldStyles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    color: "#55718b",
    fontSize: "12px",
    fontWeight: 700,
  },
  input: {
    minHeight: "42px",
    border: "1px solid #d0ddeb",
    borderRadius: "12px",
    padding: "9px 11px",
    fontSize: "14px",
    color: "#1f405f",
    backgroundColor: "#ffffff",
    boxSizing: "border-box",
  },
  checkboxRow: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    marginTop: "12px",
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

const MembersSection = ({ form }) => {
  return (
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
          <h3 style={{ margin: 0, color: "#17324d" }}>Household Members</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Household Member 1 starts as the family head. You can keep it synced
            with the Family Head Info section for faster encoding.
          </p>
        </div>
        <button
          type="button"
          onClick={form.addMember}
          style={pageHeaderStyles.secondaryButton}
        >
          Add Household Member
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {form.members.map((member, index) => (
          <div
            key={`member-${index}`}
            style={{
              border: "1px solid #d9e4ef",
              borderRadius: "18px",
              padding: "18px",
              backgroundColor: "#f9fbfe",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
                marginBottom: "14px",
              }}
            >
              <h4 style={{ margin: 0, color: "#234260" }}>
                Member {index + 1}
              </h4>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {index === 0 && !form.isPrimaryMemberSynced ? (
                  <button
                    type="button"
                    onClick={form.resetPrimaryMemberFromFamilyHead}
                    style={pageHeaderStyles.secondaryButton}
                  >
                    Reset from Family Head
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => form.removeMember(index)}
                  disabled={form.members.length === 1}
                  style={{
                    ...pageHeaderStyles.secondaryButton,
                    opacity: form.members.length === 1 ? 0.6 : 1,
                  }}
                >
                  Remove
                </button>
              </div>
            </div>

            {index === 0 ? (
              <div
                style={{
                  marginBottom: "14px",
                  padding: "12px 14px",
                  borderRadius: "14px",
                  backgroundColor: form.isPrimaryMemberSynced ? "#edf6ff" : "#fff8ea",
                  border: form.isPrimaryMemberSynced
                    ? "1px solid #d1e4f6"
                    : "1px solid #f0dfb7",
                  color: form.isPrimaryMemberSynced ? "#345d84" : "#8a621f",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                {form.isPrimaryMemberSynced
                  ? "Member 1 is auto-filled from Family Head Info."
                  : "Member 1 was edited manually, so it will no longer be overwritten by Family Head Info."}
              </div>
            ) : null}

            <div style={fieldStyles.grid}>
              <label style={fieldStyles.field}>
                <span style={fieldStyles.label}>First Name</span>
                <input
                  type="text"
                  value={member.first_name}
                  onChange={(event) =>
                    form.updateMemberField(index, "first_name", event.target.value)
                  }
                  style={fieldStyles.input}
                />
              </label>
              <label style={fieldStyles.field}>
                <span style={fieldStyles.label}>Middle Name</span>
                <input
                  type="text"
                  value={member.middle_name}
                  onChange={(event) =>
                    form.updateMemberField(index, "middle_name", event.target.value)
                  }
                  style={fieldStyles.input}
                />
              </label>
              <label style={fieldStyles.field}>
                <span style={fieldStyles.label}>Last Name</span>
                <input
                  type="text"
                  value={member.last_name}
                  onChange={(event) =>
                    form.updateMemberField(index, "last_name", event.target.value)
                  }
                  style={fieldStyles.input}
                />
              </label>
              <label style={fieldStyles.field}>
                <span style={fieldStyles.label}>Suffix</span>
                <input
                  type="text"
                  value={member.suffix}
                  onChange={(event) =>
                    form.updateMemberField(index, "suffix", event.target.value)
                  }
                  style={fieldStyles.input}
                />
              </label>
              <label style={fieldStyles.field}>
                <span style={fieldStyles.label}>Sex</span>
                <select
                  value={member.sex}
                  onChange={(event) =>
                    form.updateMemberField(index, "sex", event.target.value)
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
                  value={member.age_value}
                  onChange={(event) =>
                    form.updateMemberField(index, "age_value", event.target.value)
                  }
                  style={fieldStyles.input}
                />
              </label>
              <label style={fieldStyles.field}>
                <span style={fieldStyles.label}>Age Unit</span>
                <select
                  value={member.age_unit}
                  onChange={(event) =>
                    form.updateMemberField(index, "age_unit", event.target.value)
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
                  value={formatAgeGroupLabel(member.age_group)}
                  disabled
                  style={{
                    ...fieldStyles.input,
                    backgroundColor: "#f4f8fc",
                    color: "#48627e",
                  }}
                />
              </label>
              <label style={fieldStyles.field}>
                <span style={fieldStyles.label}>Relationship to Head</span>
                <input
                  type="text"
                  value={member.relationship_to_head}
                  onChange={(event) =>
                    form.updateMemberField(
                      index,
                      "relationship_to_head",
                      event.target.value,
                    )
                  }
                  style={fieldStyles.input}
                />
              </label>
            </div>

            <div style={fieldStyles.checkboxRow}>
              <label style={fieldStyles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={member.is_family_head}
                  onChange={(event) =>
                    form.updateMemberField(
                      index,
                      "is_family_head",
                      event.target.checked,
                    )
                  }
                />
                Family Head
              </label>
              <label style={fieldStyles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={member.is_pregnant}
                  onChange={(event) =>
                    form.updateMemberField(
                      index,
                      "is_pregnant",
                      event.target.checked,
                    )
                  }
                />
                Pregnant
              </label>
              <label style={fieldStyles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={member.is_lactating}
                  onChange={(event) =>
                    form.updateMemberField(
                      index,
                      "is_lactating",
                      event.target.checked,
                    )
                  }
                />
                Lactating
              </label>
              <label style={fieldStyles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={member.has_disability}
                  onChange={(event) =>
                    form.updateMemberField(
                      index,
                      "has_disability",
                      event.target.checked,
                    )
                  }
                />
                Has Disability
              </label>
            </div>

            <div style={{ marginTop: "16px" }}>
              <p style={{ ...shellStyles.mutedText, fontWeight: 700 }}>
                Person Sectors
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginTop: "10px",
                }}
              >
                {Object.entries(form.groupedPersonSectors).map(
                  ([groupName, sectors]) => (
                    <div key={groupName}>
                      <p
                        style={{
                          margin: "0 0 8px",
                          color: "#5b7690",
                          fontSize: "12px",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        {groupName}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "10px",
                        }}
                      >
                        {sectors.map((sector) => (
                          <label
                            key={sector.id}
                            style={fieldStyles.checkboxLabel}
                          >
                            <input
                              type="checkbox"
                              checked={member.sector_ids.includes(sector.id)}
                              onChange={() =>
                                form.toggleMemberSector(index, sector.id)
                              }
                            />
                            {sector.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default MembersSection;
