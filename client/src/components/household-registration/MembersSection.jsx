import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { pageHeaderStyles } from "../layout/PageHeader";
import DuplicateRegistrationSuggestionsSection from "./DuplicateRegistrationSuggestionsSection";
import { AGE_UNIT_OPTIONS } from "../../utils/ageGroup";
import {
  AGE_BASED_MEMBER_SECTOR_CODES,
  RELATIONSHIP_OPTIONS,
  formatMemberSectorLabel,
  getCanonicalMemberSectorCode,
  isAgeBasedMemberSectorCode,
} from "../../utils/registrationOptions";
import { FiUserPlus, FiUserMinus } from "react-icons/fi";

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
  errorText: {
    margin: "6px 0 0",
    color: "#c53030",
    fontSize: "12px",
    lineHeight: 1.4,
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
  checkboxLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    color: "#4a6480",
    fontSize: "13px",
    fontWeight: 600,
  },
};

const MembersSection = ({ form, onViewSuggestedHousehold }) => {
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
            {form.isEditMode
              ? "Add, update, or remove members here. Removed members are deactivated after you save the household."
              : "Add members only if the family head is not the only evacuee in the household."}
          </p>
        </div>
        <button
          type="button"
          onClick={form.addMember}
          style={{
            ...pageHeaderStyles.secondaryButton,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FiUserPlus size={16} />
          Add Member
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {form.members.length === 0 ? (
          <div
            style={{
              border: "1px dashed #d3dfeb",
              borderRadius: "18px",
              padding: "20px",
              backgroundColor: "#f9fbfe",
              color: "#5f7690",
              fontSize: "14px",
            }}
          >
            {form.isEditMode
              ? "No additional members are recorded yet. Add one here if the household needs another registered evacuee."
              : "No additional members yet. Add one only if the family head is not the only evacuee in the household."}
          </div>
        ) : null}

        {form.members.map((member, index) => {
          const nonAgeBasedSectors = form.memberSectorOptions.filter(
            (sector) =>
              !isAgeBasedMemberSectorCode(
                getCanonicalMemberSectorCode(sector.code),
              ),
          );
          const memberSuggestionGroups = Array.isArray(form.duplicateSuggestions.groups)
            ? form.duplicateSuggestions.groups.filter(
                (group) => group.person_key === `member_${index}`,
              )
            : [];

          return (
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
                <button
                  type="button"
                  onClick={() => form.removeMember(index)}
                  style={{
                    ...pageHeaderStyles.secondaryButton,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <FiUserMinus size={14} />
                  Remove
                </button>
              </div>

              <div
                style={{
                  ...fieldStyles.grid,
                  gridTemplateColumns: "repeat(4, 1fr)",
                }}
              >
                <label style={fieldStyles.field}>
                  <span style={fieldStyles.label}>First Name</span>
                  <input
                    type="text"
                    value={member.first_name}
                    onChange={(event) =>
                      form.updateMemberField(
                        index,
                        "first_name",
                        event.target.value,
                      )
                    }
                    style={fieldStyles.input}
                  />
                  {form.validationErrors.members[index]?.first_name ? (
                    <p style={fieldStyles.errorText}>
                      {form.validationErrors.members[index].first_name}
                    </p>
                  ) : null}
                </label>

                <label style={fieldStyles.field}>
                  <span style={fieldStyles.label}>Middle Name</span>
                  <input
                    type="text"
                    value={member.middle_name}
                    onChange={(event) =>
                      form.updateMemberField(
                        index,
                        "middle_name",
                        event.target.value,
                      )
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
                      form.updateMemberField(
                        index,
                        "last_name",
                        event.target.value,
                      )
                    }
                    style={fieldStyles.input}
                  />
                  {form.validationErrors.members[index]?.last_name ? (
                    <p style={fieldStyles.errorText}>
                      {form.validationErrors.members[index].last_name}
                    </p>
                  ) : null}
                </label>

                <label style={fieldStyles.field}>
                  <span style={fieldStyles.label}>Suffix (If Applicable)</span>
                  <input
                    type="text"
                    value={member.suffix}
                    onChange={(event) =>
                      form.updateMemberField(
                        index,
                        "suffix",
                        event.target.value,
                      )
                    }
                    style={fieldStyles.input}
                  />
                </label>
              </div>

              <div style={{ marginTop: "14px" }}>
                <DuplicateRegistrationSuggestionsSection
                  groups={memberSuggestionGroups}
                  isLoading={form.isLoadingDuplicateSuggestions}
                  errorMessage={form.duplicateSuggestionsError}
                  onViewHousehold={onViewSuggestedHousehold}
                />
              </div>

              <div
                style={{
                  ...fieldStyles.grid,
                  marginTop: "14px",
                  gridTemplateColumns: "repeat(4, minmax(140px, 1fr))",
                }}
              >
                <label style={fieldStyles.field}>
                  <span style={fieldStyles.label}>Age</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={member.age_value}
                    onChange={(event) =>
                      form.updateMemberField(
                        index,
                        "age_value",
                        event.target.value,
                      )
                    }
                    style={fieldStyles.input}
                  />
                  {form.validationErrors.members[index]?.age_value ? (
                    <p style={fieldStyles.errorText}>
                      {form.validationErrors.members[index].age_value}
                    </p>
                  ) : null}
                </label>

                <label style={fieldStyles.field}>
                  <span style={fieldStyles.label}>Age Unit</span>
                  <select
                    value={member.age_unit}
                    onChange={(event) =>
                      form.updateMemberField(
                        index,
                        "age_unit",
                        event.target.value,
                      )
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
                  <span style={fieldStyles.label}>Relationship to Head</span>
                  <select
                    value={member.relationship_option}
                    onChange={(event) =>
                      form.updateMemberField(
                        index,
                        "relationship_option",
                        event.target.value,
                      )
                    }
                    style={fieldStyles.input}
                  >
                    <option value="">Select relationship</option>
                    {RELATIONSHIP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {form.validationErrors.members[index]?.relationship_option ? (
                    <p style={fieldStyles.errorText}>
                      {form.validationErrors.members[index].relationship_option}
                    </p>
                  ) : null}
                </label>
              </div>

              {member.relationship_option === "OTHERS" ? (
                <div style={{ marginTop: "14px", maxWidth: "320px" }}>
                  <label style={fieldStyles.field}>
                    <span style={fieldStyles.label}>Relationship</span>
                    <input
                      type="text"
                      value={member.custom_relationship}
                      onChange={(event) =>
                        form.updateMemberField(
                          index,
                          "custom_relationship",
                          event.target.value,
                        )
                      }
                      style={fieldStyles.input}
                    />
                    {form.validationErrors.members[index]?.custom_relationship ? (
                      <p style={fieldStyles.errorText}>
                        {form.validationErrors.members[index].custom_relationship}
                      </p>
                    ) : null}
                  </label>
                </div>
              ) : null}

              <div style={{ marginTop: "16px" }}>
                <p style={{ ...shellStyles.mutedText, fontWeight: 700 }}>
                  Member Sectors
                </p>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    marginTop: "10px",
                  }}
                >
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}
                  >
                    {AGE_BASED_MEMBER_SECTOR_CODES.map((sectorCode) => {
                      const isChecked =
                        sectorCode === member.derived_age_sector_code;

                      return (
                        <label
                          key={sectorCode}
                          style={{
                            ...fieldStyles.checkboxLabel,
                            opacity: isChecked ? 1 : 0.8,
                          }}
                        >
                          <input type="checkbox" checked={isChecked} disabled />
                          {formatMemberSectorLabel(sectorCode)}
                        </label>
                      );
                    })}
                  </div>

                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}
                  >
                    {nonAgeBasedSectors.map((sector) => {
                      const isChecked = member.sector_ids.includes(sector.id);

                      return (
                        <label
                          key={sector.id}
                          style={fieldStyles.checkboxLabel}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() =>
                              form.toggleMemberSector(index, sector.id)
                            }
                          />
                          {formatMemberSectorLabel(sector)}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default MembersSection;
