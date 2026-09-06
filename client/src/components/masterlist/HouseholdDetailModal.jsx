import React from "react";
import { FiX } from "react-icons/fi";
import { shellStyles } from "../layout/BarangayLayout";
import { pageHeaderStyles } from "../layout/PageHeader";
import {
  DISPLAY_MEMBER_SECTOR_CODES,
  formatMemberSectorLabel,
  getCanonicalMemberSectorCode,
} from "../../utils/registrationOptions";
import { formatStayTypeLabel } from "../../utils/stayType";

const modalStyles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(16, 35, 52, 0.48)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "28px",
    boxSizing: "border-box",
    zIndex: 1200,
  },
  modal: {
    width: "min(1040px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    borderRadius: "24px",
    backgroundColor: "#f7fbff",
    boxShadow: "0 24px 48px rgba(18, 39, 60, 0.22)",
    border: "1px solid #d4e0ec",
    padding: "clamp(18px, 2vw, 28px)",
    boxSizing: "border-box",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "20px",
  },
  closeButton: {
    border: "1px solid #c4d6e8",
    backgroundColor: "#ffffff",
    color: "#2a4c6f",
    borderRadius: "14px",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "18px",
  },
  label: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#68819a",
  },
  value: {
    margin: "8px 0 0",
    color: "#17324d",
    fontSize: "15px",
    lineHeight: 1.6,
    wordBreak: "break-word",
  },
  photo: {
    width: "100%",
    maxWidth: "280px",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "16px",
    border: "1px solid #d7e2ef",
    backgroundColor: "#eaf2f8",
  },
  placeholder: {
    width: "100%",
    maxWidth: "280px",
    aspectRatio: "4 / 3",
    borderRadius: "16px",
    border: "1px dashed #cbd9e7",
    backgroundColor: "#f3f8fc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#698099",
    fontSize: "13px",
    fontWeight: 600,
    textAlign: "center",
    padding: "14px",
    boxSizing: "border-box",
  },
  list: {
    display: "grid",
    gap: "12px",
    marginTop: "14px",
  },
  listItem: {
    border: "1px solid #dbe5ef",
    borderRadius: "16px",
    backgroundColor: "#ffffff",
    padding: "14px 16px",
  },
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
};

const formatContactNumber = (value) => {
  if (!value) {
    return "--";
  }

  const digitsOnly = String(value).replace(/\D/g, "");

  if (digitsOnly.length === 12 && digitsOnly.startsWith("63")) {
    const localNumber = digitsOnly.slice(2);

    return `+63 ${localNumber.slice(0, 3)} ${localNumber.slice(3, 6)} ${localNumber.slice(6)}`;
  }

  return value;
};

const formatPrivacyStatus = (privacyConsent) => {
  if (!privacyConsent) {
    return "Not recorded (legacy or no linked acknowledgment)";
  }

  const status = String(privacyConsent.consent_status || "").toUpperCase();

  if (status === "ACKNOWLEDGED") {
    return "Acknowledged";
  }

  if (status === "WITHDRAWN") {
    return "Withdrawn";
  }

  if (status === "DECLINED") {
    return "Declined";
  }

  return status || "--";
};

const formatEvacuationStatus = (status) => {
  const normalizedStatus = String(status || "").toUpperCase();

  if (!normalizedStatus) {
    return "No attendance record yet";
  }

  if (normalizedStatus === "LEFT") {
    return "DEPARTED";
  }

  return normalizedStatus;
};

const buildFullName = (person) => {
  if (!person) {
    return "--";
  }

  return [
    person.first_name,
    person.middle_name,
    person.last_name,
    person.suffix,
  ]
    .filter(Boolean)
    .join(" ");
};

const buildSectorsText = (sectors = []) => {
  if (!Array.isArray(sectors) || sectors.length === 0) {
    return "No sector indicated.";
  }

  const uniqueSectors = [];
  const seenSectorKeys = new Set();

  sectors.forEach((sector) => {
    const canonicalCode = getCanonicalMemberSectorCode(sector?.code);
    const sectorKey = canonicalCode || sector?.id || sector?.name;

    if (!sectorKey || seenSectorKeys.has(sectorKey)) {
      return;
    }

    seenSectorKeys.add(sectorKey);
    uniqueSectors.push(sector);
  });

  const orderedSectorLabels = DISPLAY_MEMBER_SECTOR_CODES.map((sectorCode) =>
    uniqueSectors.find(
      (sector) => getCanonicalMemberSectorCode(sector.code) === sectorCode,
    ),
  )
    .filter(Boolean)
    .map((sector) => formatMemberSectorLabel(sector));

  const remainingSectorLabels = uniqueSectors
    .filter(
      (sector) =>
        !DISPLAY_MEMBER_SECTOR_CODES.includes(
          getCanonicalMemberSectorCode(sector.code),
        ),
    )
    .map((sector) => sector.name)
    .filter(Boolean);

  return [...orderedSectorLabels, ...remainingSectorLabels].join(", ");
};

const isNonAdmittedResidentHousehold = (household, latestAttendance) => {
  const stayType = String(household?.current_stay_type || "").toUpperCase();
  const latestStatus = String(latestAttendance?.status || "").toUpperCase();

  return (
    household?.residency_status === "RESIDENT" &&
    household?.is_active === false &&
    (stayType === "RELATIVES" || stayType === "OTHER_SAFE_PLACE") &&
    !latestAttendance?.time_in &&
    !latestAttendance?.time_out &&
    latestStatus !== "PRESENT"
  );
};

const HouseholdDetailModal = ({
  isOpen,
  isLoading,
  errorMessage,
  householdDetails,
  onClose,
  onEditHousehold,
  isOffline = false,
  showAdministrativeMetadata = true,
  showDataPrivacyAcknowledgement = false,
}) => {
  if (!isOpen) {
    return null;
  }

  const household = householdDetails?.household || null;
  const members = Array.isArray(householdDetails?.members)
    ? householdDetails.members
    : [];
  const orderedMembers = members
    .map((member, index) => ({ member, index }))
    .sort((left, right) => {
      if (left.member.is_family_head === right.member.is_family_head) {
        return left.index - right.index;
      }

      return left.member.is_family_head ? -1 : 1;
    })
    .map(({ member }) => member);
  const householdSectors = Array.isArray(householdDetails?.household_sectors)
    ? householdDetails.household_sectors
    : [];
  const memberSectors = orderedMembers.flatMap((member) =>
    Array.isArray(member.sectors) ? member.sectors : [],
  );
  const sectorsText = buildSectorsText([...memberSectors, ...householdSectors]);
  const latestAttendance = householdDetails?.latest_attendance || null;
  const latestAttendanceStatus = String(latestAttendance?.status || "").toUpperCase();
  const isOperationallyActive =
    household?.is_active !== false &&
    !latestAttendance?.time_out &&
    latestAttendanceStatus !== "LEFT";
  const isNonAdmittedResident = isNonAdmittedResidentHousehold(
    household,
    latestAttendance,
  );
  const stayTypeLabel = formatStayTypeLabel(household?.current_stay_type);
  const privacyConsent = householdDetails?.privacy_consent || null;
  const dataPrivacyAcknowledgementItems = [
    {
      label: "Privacy Acknowledgement",
      value: formatPrivacyStatus(privacyConsent),
    },
    {
      label: "Privacy Notice Version",
      value: privacyConsent?.notice_version || "Not recorded",
    },
    {
      label: "Acknowledged On",
      value: formatDateTime(privacyConsent?.recorded_at),
    },
  ];
  const summaryItems = [
    {
      label: "Disaster Event",
      value: household?.disaster_event_title || "--",
    },
    {
      label: "Barangay",
      value: household?.barangay_name || "--",
    },
    {
      label: "Stay Type",
      value: stayTypeLabel || "--",
    },
    {
      label: "Family Head",
      value:
        [
          household?.family_head_first_name,
          household?.family_head_middle_name,
          household?.family_head_last_name,
          household?.family_head_suffix,
        ]
          .filter(Boolean)
          .join(" ") || "--",
    },
    {
      label: "Contact Number",
      value: formatContactNumber(household?.contact_number),
    },
    {
      label: "Household Size",
      value: household?.household_size || 0,
    },
    {
      label: "Registered At",
      value: formatDateTime(household?.registered_at),
    },
    {
      label: "Record Status",
      value: household?.is_active === false ? "Archived" : "Active",
    },
    {
      label: "Registered By",
      value:
        household?.registered_by_name ||
        household?.registered_by ||
        "Not recorded",
    },
  ];

  if (showAdministrativeMetadata) {
    summaryItems.push(
      {
        ...dataPrivacyAcknowledgementItems[0],
        label: "Privacy Acknowledgment",
      },
      dataPrivacyAcknowledgementItems[1],
      dataPrivacyAcknowledgementItems[2],
      {
        label: "Sync Status",
        value: privacyConsent?.sync_status || "--",
      },
      {
        label: "Recorded Offline",
        value: privacyConsent
          ? privacyConsent.is_offline_encoded
            ? "Yes"
            : "No"
          : "--",
      },
    );
  }

  return (
    <div className="masterlist-detail-modal-backdrop" style={modalStyles.backdrop}>
      <div className="masterlist-detail-modal" style={modalStyles.modal}>
        <div className="masterlist-detail-modal-topbar" style={modalStyles.topBar}>
          <div>
            <h2 style={{ ...pageHeaderStyles.title, fontSize: "30px" }}>
              Household Details
            </h2>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {householdDetails?.household?.id &&
            isOperationallyActive &&
            typeof onEditHousehold === "function" ? (
              <>
                <button
                  type="button"
                  onClick={() => onEditHousehold?.(householdDetails.household.id)}
                  style={pageHeaderStyles.secondaryButton}
                  title="Edit Household"
                >
                  Edit Household
                </button>
              </>
            ) : null}
            <button type="button" onClick={onClose} style={modalStyles.closeButton}>
              <FiX />
            </button>
          </div>
        </div>

        {isLoading ? (
          <section style={shellStyles.card}>
            <p style={shellStyles.mutedText}>Loading household details...</p>
          </section>
        ) : errorMessage ? (
          <section style={shellStyles.card}>
            <p style={{ ...shellStyles.mutedText, color: "#a14538" }}>
              {errorMessage}
            </p>
          </section>
        ) : !household ? (
          <section style={shellStyles.card}>
            <p style={shellStyles.mutedText}>
              No household details are available for this record.
            </p>
          </section>
        ) : (
          <div style={{ display: "grid", gap: "20px" }}>
            <section style={shellStyles.card}>
              <div style={modalStyles.grid}>
                {summaryItems.map((item) => (
                  <div key={item.label}>
                    <p style={modalStyles.label}>{item.label}</p>
                    <p style={modalStyles.value}>{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section style={shellStyles.card}>
              <div style={modalStyles.grid}>
                <div>
                  <p style={modalStyles.label}>Family Head Photo</p>
                  <div style={{ marginTop: "12px" }}>
                    {(household.family_head_photo_data_url || household.family_head_photo_url) ? (
                      <img
                        src={household.family_head_photo_data_url || household.family_head_photo_url}
                        alt="Family head"
                        style={modalStyles.photo}
                      />
                    ) : (
                      <div style={modalStyles.placeholder}>
                        {isOffline
                          ? "Family head photo is not available in the current offline data. Refresh offline data when connected."
                          : "No photo available"}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <p style={modalStyles.label}>
                    Household Sectors / Vulnerabilities
                  </p>
                  <p style={modalStyles.value}>{sectorsText}</p>

                  <p style={{ ...modalStyles.label, marginTop: "18px" }}>
                    Evacuation Status
                  </p>
                  <p style={modalStyles.value}>
                    {formatEvacuationStatus(latestAttendance?.status)}
                  </p>

                  <p style={{ ...modalStyles.label, marginTop: "18px" }}>
                    Arrival Time
                  </p>
                  <p style={modalStyles.value}>
                    {isNonAdmittedResident
                      ? stayTypeLabel
                      : formatDateTime(latestAttendance?.time_in)}
                  </p>

                  <p style={{ ...modalStyles.label, marginTop: "18px" }}>
                    Departure Time
                  </p>
                  <p style={modalStyles.value}>
                    {formatDateTime(latestAttendance?.time_out)}
                  </p>
                </div>
              </div>
            </section>

            <section style={shellStyles.card}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Family Members</h3>
              {orderedMembers.length === 0 ? (
                <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                  No family members are recorded yet.
                </p>
              ) : (
                <div style={modalStyles.list}>
                  {orderedMembers.map((member) => (
                    <div key={member.id} style={modalStyles.listItem}>
                      <p style={{ margin: 0, color: "#17324d", fontWeight: 700 }}>
                        {buildFullName(member)}
                      </p>
                      <p style={{ ...shellStyles.mutedText, marginTop: "6px" }}>
                        {member.relationship_to_head || "--"} | {member.sex || "--"} |{" "}
                        {member.age_value ?? member.age ?? "--"} {member.age_unit || ""}
                      </p>
                      <p style={{ ...shellStyles.mutedText, marginTop: "6px" }}>
                        Sectors: {buildSectorsText(member.sectors)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {showDataPrivacyAcknowledgement ? (
              <section style={shellStyles.card}>
                <h3 style={{ margin: 0, color: "#17324d" }}>
                  Data Privacy Acknowledgement
                </h3>
                <div style={{ ...modalStyles.grid, marginTop: "14px" }}>
                  {dataPrivacyAcknowledgementItems.map((item) => (
                    <div key={item.label}>
                      <p style={modalStyles.label}>{item.label}</p>
                      <p style={modalStyles.value}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default HouseholdDetailModal;
