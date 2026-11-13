import React from "react";
import { formatStayTypeLabel } from "../../utils/stayType";
import { formatAgeValueLabel } from "../../utils/ageGroup";

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(19, 34, 51, 0.44)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: "24px",
  boxSizing: "border-box",
  zIndex: 1000,
};

const modalStyles = {
  width: "100%",
  maxWidth: "980px",
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#ffffff",
  borderRadius: "20px",
  border: "1px solid #d5e0ec",
  boxShadow: "0 24px 48px rgba(28, 57, 89, 0.22)",
  padding: "24px",
  boxSizing: "border-box",
};

const sectionStyles = {
  card: {
    border: "1px solid #deebf6",
    borderRadius: "16px",
    backgroundColor: "#f9fbfe",
    padding: "18px",
  },
  title: {
    margin: "0 0 12px",
    color: "#183651",
    fontSize: "16px",
  },
  label: {
    margin: 0,
    color: "#6a8098",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  value: {
    margin: "8px 0 0",
    color: "#213f5d",
    fontSize: "14px",
    lineHeight: 1.6,
  },
};

const formatDateTime = (value) => {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const getSectorNames = (sectors) => {
  if (!sectors || sectors.length === 0) {
    return "—";
  }

  return sectors.map((sector) => sector.name).join(", ");
};

const formatMemberAge = (member) => {
  if (
    Number.isInteger(member.age_value) &&
    member.age_value >= 0 &&
    member.age_unit
  ) {
    return formatAgeValueLabel(member.age_value, member.age_unit);
  }

  if (member.age !== null && member.age !== undefined) {
    return String(member.age);
  }

  return "—";
};

const MswdoHouseholdDetailModal = ({ isOpen, household, onClose }) => {
  if (!isOpen || !household) {
    return null;
  }

  return (
    <div style={overlayStyles} onClick={onClose}>
      <div style={modalStyles} onClick={(event) => event.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                color: "#6e849a",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Household Detail
            </p>
            <h3 style={{ margin: "10px 0 0", color: "#17324d", fontSize: "26px" }}>
              {household.family_head_name}
            </h3>
            <p style={{ margin: "8px 0 0", color: "#5d748b", fontSize: "14px" }}>
              {household.barangay?.name || "—"} • Registered{" "}
              {formatDateTime(household.registered_at)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid #ccdceb",
              borderRadius: "12px",
              backgroundColor: "#f8fbfe",
              color: "#294b6d",
              padding: "10px 14px",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div style={sectionStyles.card}>
            <p style={sectionStyles.label}>Barangay</p>
            <p style={sectionStyles.value}>{household.barangay?.name || "—"}</p>
          </div>
          <div style={sectionStyles.card}>
            <p style={sectionStyles.label}>Household Size</p>
            <p style={sectionStyles.value}>{household.household_size || 0}</p>
          </div>
          <div style={sectionStyles.card}>
            <p style={sectionStyles.label}>Stay Type</p>
            <p style={sectionStyles.value}>
              {formatStayTypeLabel(household.current_stay_type)}
            </p>
          </div>
          <div style={sectionStyles.card}>
            <p style={sectionStyles.label}>Contact Number</p>
            <p style={sectionStyles.value}>{household.contact_number || "—"}</p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div style={sectionStyles.card}>
            <h4 style={sectionStyles.title}>Stub Summary</h4>
            <p style={sectionStyles.label}>Stub Number</p>
            <p style={sectionStyles.value}>{household.stub?.stub_no || "—"}</p>
            <p style={{ ...sectionStyles.label, marginTop: "14px" }}>Serial Number</p>
            <p style={sectionStyles.value}>{household.stub?.serial_no || "—"}</p>
            <p style={{ ...sectionStyles.label, marginTop: "14px" }}>Stub Status</p>
            <p style={sectionStyles.value}>{household.stub?.status || "—"}</p>
          </div>

          <div style={sectionStyles.card}>
            <h4 style={sectionStyles.title}>Latest Attendance</h4>
            <p style={sectionStyles.label}>Status</p>
            <p style={sectionStyles.value}>
              {household.latest_attendance?.status || "—"}
            </p>
            <p style={{ ...sectionStyles.label, marginTop: "14px" }}>Time In</p>
            <p style={sectionStyles.value}>
              {formatDateTime(household.latest_attendance?.time_in)}
            </p>
            <p style={{ ...sectionStyles.label, marginTop: "14px" }}>Time Out</p>
            <p style={sectionStyles.value}>
              {formatDateTime(household.latest_attendance?.time_out)}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div style={sectionStyles.card}>
            <h4 style={sectionStyles.title}>Household Summary</h4>
            <p style={sectionStyles.label}>Current Address</p>
            <p style={sectionStyles.value}>
              {household.current_address_details || "—"}
            </p>
            <p style={{ ...sectionStyles.label, marginTop: "14px" }}>
              Household Sectors
            </p>
            <p style={sectionStyles.value}>
              {getSectorNames(household.household_sectors)}
            </p>
          </div>
        </div>

        <div style={sectionStyles.card}>
          <h4 style={sectionStyles.title}>Members List</h4>

          {household.members && household.members.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 10px",
                        color: "#67809b",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        borderBottom: "1px solid #deebf6",
                      }}
                    >
                      Name
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 10px",
                        color: "#67809b",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        borderBottom: "1px solid #deebf6",
                      }}
                    >
                      Relationship
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 10px",
                        color: "#67809b",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        borderBottom: "1px solid #deebf6",
                      }}
                    >
                      Sex
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 10px",
                        color: "#67809b",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        borderBottom: "1px solid #deebf6",
                      }}
                    >
                      Age
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px 10px",
                        color: "#67809b",
                        fontSize: "12px",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        borderBottom: "1px solid #deebf6",
                      }}
                    >
                      Sectors
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {household.members.map((member) => (
                    <tr key={member.evacuee_id}>
                      <td
                        style={{
                          padding: "14px 10px",
                          borderBottom: "1px solid #ebf2f8",
                          color: "#1f3f5e",
                          fontSize: "14px",
                        }}
                      >
                        {member.full_name}
                        {member.is_family_head ? (
                          <span
                            style={{
                              marginLeft: "8px",
                              display: "inline-block",
                              padding: "4px 8px",
                              borderRadius: "999px",
                              backgroundColor: "#e1eef9",
                              color: "#315c87",
                              fontSize: "11px",
                              fontWeight: 700,
                            }}
                          >
                            Family Head
                          </span>
                        ) : null}
                      </td>
                      <td
                        style={{
                          padding: "14px 10px",
                          borderBottom: "1px solid #ebf2f8",
                          color: "#1f3f5e",
                          fontSize: "14px",
                        }}
                      >
                        {member.relationship_to_head || "—"}
                      </td>
                      <td
                        style={{
                          padding: "14px 10px",
                          borderBottom: "1px solid #ebf2f8",
                          color: "#1f3f5e",
                          fontSize: "14px",
                        }}
                      >
                        {member.sex || "—"}
                      </td>
                      <td
                        style={{
                          padding: "14px 10px",
                          borderBottom: "1px solid #ebf2f8",
                          color: "#1f3f5e",
                          fontSize: "14px",
                        }}
                      >
                        {formatMemberAge(member)}
                      </td>
                      <td
                        style={{
                          padding: "14px 10px",
                          borderBottom: "1px solid #ebf2f8",
                          color: "#1f3f5e",
                          fontSize: "14px",
                        }}
                      >
                        {getSectorNames(member.sectors)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ margin: 0, color: "#617991", fontSize: "14px" }}>
              No household members were returned for this record.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MswdoHouseholdDetailModal;
