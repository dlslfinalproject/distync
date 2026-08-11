import React from "react";
import { FiX } from "react-icons/fi";
import { shellStyles } from "../layout/BarangayLayout";
import { pageHeaderStyles } from "../layout/PageHeader";
import {
  DISPLAY_MEMBER_SECTOR_CODES,
  RELATIONSHIP_OPTIONS,
  formatMemberSectorLabel,
  getCanonicalMemberSectorCode,
} from "../../utils/registrationOptions";
import { formatStayTypeLabel } from "../../utils/stayType";
import QrCodePanel from "./QrCodePanel";

const getDisplayStubNumber = (stubDetails) => {
  if (stubDetails?.display_stub_no) {
    return stubDetails.display_stub_no;
  }

  const sequenceNo = Number(
    stubDetails?.stub_sequence_no || stubDetails?.stub_number || 0,
  );

  return sequenceNo > 0 ? `STUB#${sequenceNo}` : "-";
};

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
  section: {
    border: "1px solid #d6e2ef",
    borderRadius: "18px",
    backgroundColor: "#ffffff",
    padding: "20px",
    boxShadow: "0 10px 24px rgba(76, 101, 132, 0.06)",
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
  visualDetailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "28px",
    alignItems: "start",
  },
  stubInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "18px",
  },
  stubInfoFullWidth: {
    gridColumn: "1 / -1",
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

const formatStatus = (status) => {
  if (status === "ISSUED") {
    return "Unclaimed";
  }

  if (status === "CLAIMED") {
    return "Claimed";
  }

  return status || "-";
};

const formatAttendanceStatus = (status) => {
  if (!status) {
    return "No attendance record yet";
  }

  return status;
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

const formatInfoValue = (value) => {
  if (value === null || value === undefined) {
    return "-";
  }

  const normalizedValue = String(value).trim();

  return normalizedValue ? normalizedValue : "-";
};

const getDisasterEventTitle = (disasterEvent) =>
  formatInfoValue(disasterEvent?.title);

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

const formatRelationship = (relationship) => {
  if (!relationship) {
    return "--";
  }

  return (
    RELATIONSHIP_OPTIONS.find((option) => option.value === relationship)?.label ||
    relationship
  );
};

const formatMemberAge = (member) => {
  const ageValue = member?.age_value ?? member?.age;
  const ageUnit = String(member?.age_unit || "").toLowerCase();

  if (ageValue === undefined || ageValue === null || ageValue === "") {
    return "--";
  }

  if (ageUnit === "months") {
    return `${ageValue} month${Number(ageValue) === 1 ? "" : "s"}`;
  }

  if (ageUnit === "years") {
    return `${ageValue} year${Number(ageValue) === 1 ? "" : "s"}`;
  }

  return `${ageValue} ${member?.age_unit || ""}`.trim();
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

const StubDetailModal = ({
  isOpen,
  isLoading = false,
  errorMessage = "",
  stubDetails = null,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  const household = stubDetails?.household || {};
  const barangay = stubDetails?.barangay || {};
  const disasterEvent = stubDetails?.disaster_event || {};
  const latestAttendance = stubDetails?.latest_attendance || null;
  const distributionTransaction = stubDetails?.distribution_transaction || null;
  const householdMembers = Array.isArray(household.members)
    ? household.members
    : [];
  const householdSectors = Array.isArray(stubDetails?.household_sectors)
    ? stubDetails.household_sectors
    : [];
  const memberSectors = Array.isArray(stubDetails?.member_sectors)
    ? stubDetails.member_sectors
    : [];
  const sectorsText = buildSectorsText([...memberSectors, ...householdSectors]);
  const stayTypeLabel = formatStayTypeLabel(household.current_stay_type);
  const reliefPackName =
    distributionTransaction?.relief_pack_template_name ||
    stubDetails?.relief_pack_name ||
    stubDetails?.assigned_relief_packs
      ?.map((template) => template?.name)
      .filter(Boolean)
      .join(", ") ||
    distributionTransaction?.released_items_summary ||
    "-";
  const isNonAdmittedResident = isNonAdmittedResidentHousehold(
    household,
    latestAttendance,
  );

  return (
    <div style={modalStyles.backdrop}>
      <div style={modalStyles.modal}>
        <div style={modalStyles.topBar}>
          <div>
            <h2 style={{ ...pageHeaderStyles.title, fontSize: "30px" }}>
              Household Details
            </h2>
          </div>

          <button type="button" onClick={onClose} style={modalStyles.closeButton}>
            <FiX size={18} />
          </button>
        </div>

        {isLoading ? (
          <section style={modalStyles.section}>
            <p style={{ ...shellStyles.mutedText, margin: 0 }}>
              Loading stub details...
            </p>
          </section>
        ) : errorMessage ? (
          <section style={modalStyles.section}>
            <p style={{ ...shellStyles.mutedText, margin: 0, color: "#a14d58" }}>
              {errorMessage}
            </p>
          </section>
        ) : (
          <div style={{ display: "grid", gap: "18px" }}>
            <section style={modalStyles.section}>
              <div style={modalStyles.grid}>
                <div>
                  <p style={modalStyles.label}>Disaster Event</p>
                  <p style={modalStyles.value}>
                    {getDisasterEventTitle(disasterEvent)}
                  </p>
                </div>

                <div>
                  <p style={modalStyles.label}>Barangay</p>
                  <p style={modalStyles.value}>{barangay.name || "-"}</p>
                </div>

                <div>
                  <p style={modalStyles.label}>Registered At</p>
                  <p style={modalStyles.value}>
                    {formatDateTime(household.registered_at)}
                  </p>
                </div>

                <div>
                  <p style={modalStyles.label}>Family Head</p>
                  <p style={modalStyles.value}>
                    {household.family_head_name || "-"}
                  </p>
                </div>

                <div>
                  <p style={modalStyles.label}>Contact Number</p>
                  <p style={modalStyles.value}>
                    {formatContactNumber(household.contact_number)}
                  </p>
                </div>

                <div>
                  <p style={modalStyles.label}>Household Size</p>
                  <p style={modalStyles.value}>
                    {household.members_count ?? household.household_size ?? 0}
                  </p>
                </div>
              </div>
            </section>

            <section style={modalStyles.section}>
              <div style={modalStyles.grid}>
                <div>
                  <p style={modalStyles.label}>Family Head Photo</p>
                  <div style={{ marginTop: "12px" }}>
                    {household.family_head_photo_url ? (
                      <img
                        src={household.family_head_photo_url}
                        alt="Registered family head"
                        style={modalStyles.photo}
                      />
                    ) : (
                      <div style={modalStyles.placeholder}>No photo available</div>
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
                    {formatAttendanceStatus(latestAttendance?.status)}
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

            <section style={modalStyles.section}>
              <div style={modalStyles.visualDetailsGrid}>
                <div>
                  <p style={modalStyles.label}>QR Stub</p>
                  <div style={{ marginTop: "12px", maxWidth: "280px" }}>
                    <QrCodePanel
                      value={stubDetails?.qr_code_value || ""}
                      emptyLabel="No QR available"
                      valueStyle={{ overflowWrap: "anywhere" }}
                    />
                  </div>
                </div>

                <div style={modalStyles.stubInfoGrid}>
                  <div>
                    <p style={modalStyles.label}>Stub Number</p>
                    <p style={modalStyles.value}>
                      {getDisplayStubNumber(stubDetails)}
                    </p>
                  </div>

                  <div>
                    <p style={modalStyles.label}>Stub Status</p>
                    <p style={modalStyles.value}>
                      {formatStatus(stubDetails?.status)}
                    </p>
                  </div>

                  <div>
                    <p style={modalStyles.label}>Issued At</p>
                    <p style={modalStyles.value}>
                      {formatDateTime(stubDetails?.issued_at)}
                    </p>
                  </div>

                  <div>
                    <p style={modalStyles.label}>Claimed At</p>
                    <p style={modalStyles.value}>
                      {formatDateTime(stubDetails?.claimed_at)}
                    </p>
                  </div>

                  <div>
                    <p style={modalStyles.label}>Relief Pack</p>
                    <p style={modalStyles.value}>{reliefPackName}</p>
                  </div>

                  <div>
                    <p style={modalStyles.label}>Receipt Number</p>
                    <p style={modalStyles.value}>
                      {formatInfoValue(distributionTransaction?.receipt_no)}
                    </p>
                  </div>

                  <div style={modalStyles.stubInfoFullWidth}>
                    <p style={modalStyles.label}>Authorized By</p>
                    <p style={modalStyles.value}>
                      {formatInfoValue(distributionTransaction?.verified_by_name)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section style={modalStyles.section}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Family Members</h3>
              {householdMembers.length === 0 ? (
                <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                  No family members are recorded yet.
                </p>
              ) : (
                <div style={modalStyles.list}>
                  {householdMembers.map((member) => (
                    <div
                      key={member.evacuee_id || member.full_name}
                      style={modalStyles.listItem}
                    >
                      <p style={{ margin: 0, color: "#17324d", fontWeight: 700 }}>
                        {member.full_name || "--"}
                      </p>
                      <p style={{ ...shellStyles.mutedText, marginTop: "6px" }}>
                        {formatRelationship(member.relationship_to_head)} |{" "}
                        {member.sex || "--"} | {formatMemberAge(member)}
                      </p>
                      <p style={{ ...shellStyles.mutedText, marginTop: "6px" }}>
                        Sectors: {buildSectorsText(member.sectors)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default StubDetailModal;
