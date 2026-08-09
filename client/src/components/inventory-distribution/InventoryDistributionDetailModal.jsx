import React from "react";
import DetailsModalShell from "../shared/DetailsModalShell";
import EmptyState from "../shared/EmptyState";
import ErrorState from "../shared/ErrorState";
import LoadingState from "../shared/LoadingState";
import { shellStyles } from "../layout/BarangayLayout";
import QrCodePanel from "../stubs/QrCodePanel";
import { formatStayTypeLabel } from "../../utils/stayType";

const styles = {
  shellPanel: {
    backgroundColor: "#eef5fb",
    border: "1px solid #d7e2ef",
    boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  },
  sectionCard: {
    ...shellStyles.card,
    backgroundColor: "#ffffff",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    alignItems: "start",
  },
  visualGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "28px",
    alignItems: "start",
  },
  qrVisualGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 280px) minmax(0, 1fr)",
    gap: "28px",
    alignItems: "start",
  },
  qrInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "16px",
    alignItems: "start",
  },
  label: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
  },
  value: {
    margin: "8px 0 0",
    color: "#21405f",
    fontSize: "15px",
    lineHeight: 1.55,
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
  tableWrap: {
    overflowX: "auto",
    marginTop: "12px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "680px",
  },
  th: {
    padding: "10px 12px",
    textAlign: "left",
    fontSize: "12px",
    color: "#66809c",
    borderBottom: "1px solid #dfe8f2",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #edf3f8",
    color: "#21405f",
    fontSize: "14px",
    verticalAlign: "top",
  },
  mutedText: {
    margin: "6px 0 0",
    color: "#69839c",
    fontSize: "13px",
    lineHeight: 1.5,
  },
};

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatQuantity = (quantity, unitOfMeasure) => {
  const normalizedQuantity =
    quantity !== null && quantity !== undefined && quantity !== ""
      ? quantity
      : "--";
  const normalizedUnit = unitOfMeasure || "unit(s)";

  return `${normalizedQuantity} ${normalizedUnit}`;
};

const getDisplayStubNumber = (stubDetails, row) => {
  return (
    stubDetails?.display_stub_no ||
    row?.display_stub_no ||
    stubDetails?.stub_no ||
    "--"
  );
};

const formatStatus = (status, label = "") => {
  if (label) {
    return label;
  }

  if (status === "ISSUED") {
    return "For Claim";
  }

  if (status === "CLAIMED") {
    return "Claimed";
  }

  return status || "--";
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
    .join(" ") || person.full_name || "--";
};

const getSectorNames = (sectors) => {
  if (!Array.isArray(sectors) || sectors.length === 0) {
    return "No sector indicated.";
  }

  return sectors
    .map((sector) => sector?.display_name || sector?.name)
    .filter(Boolean)
    .join(", ") || "No sector indicated.";
};

const getHousehold = (stubDetails, row) => {
  return (
    stubDetails?.household ||
    row?.masterlist_household ||
    {
      family_head_name: row?.family_head_name,
      household_size: row?.family_members_count,
      contact_number: row?.masterlist_household?.contact_number,
      current_stay_type: row?.masterlist_household?.current_stay_type,
      current_address_details: row?.masterlist_household?.current_address_details,
      registered_at: row?.masterlist_household?.registered_at,
    }
  );
};

const getMembers = (stubDetails, row) => {
  const stubMembers = Array.isArray(stubDetails?.household?.members)
    ? stubDetails.household.members
    : [];
  const rowMembers = Array.isArray(row?.household_members)
    ? row.household_members
    : [];

  if (stubMembers.length > 0) {
    return stubMembers;
  }

  return rowMembers;
};

const getReliefPackTemplates = ({ row, stubDetails, templateDetails }) => {
  const templateDetailsById = new Map(
    (Array.isArray(templateDetails) ? templateDetails : [])
      .filter((template) => template?.id)
      .map((template) => [template.id, template]),
  );
  const templates = [
    ...(Array.isArray(stubDetails?.assigned_relief_packs)
      ? stubDetails.assigned_relief_packs
      : []),
    ...(Array.isArray(row?.relief_pack_templates)
      ? row.relief_pack_templates
      : []),
  ];
  const uniqueTemplates = new Map();

  templates.forEach((template) => {
    const key = template?.id || template?.name;

    if (!key || uniqueTemplates.has(key)) {
      return;
    }

    uniqueTemplates.set(key, {
      ...template,
      ...(templateDetailsById.get(template.id) || null),
    });
  });

  return [...uniqueTemplates.values()];
};

const getDonatedReliefPacks = (row, stubDetails) => {
  return [
    ...(Array.isArray(stubDetails?.available_donated_relief_packs)
      ? stubDetails.available_donated_relief_packs
      : []),
    ...(Array.isArray(row?.donated_relief_packs)
      ? row.donated_relief_packs
      : []),
  ];
};

const getDonatedLooseItems = (row, stubDetails) => {
  return [
    ...(Array.isArray(stubDetails?.available_donated_loose_items)
      ? stubDetails.available_donated_loose_items
      : []),
    ...(Array.isArray(row?.donated_loose_items)
      ? row.donated_loose_items
      : []),
  ];
};

const InfoField = ({ label, value }) => (
  <div>
    <p style={styles.label}>{label}</p>
    <p style={styles.value}>{value || "--"}</p>
  </div>
);

const getDisasterEventTitle = (stubDetails, row, household) => {
  return (
    stubDetails?.disaster_event?.title ||
    row?.masterlist_disaster_event?.title ||
    household?.disaster_event_title ||
    "--"
  );
};

const InventoryDistributionDetailModal = ({
  isOpen,
  isLoading,
  errorMessage,
  row,
  stubDetails,
  templateDetails = [],
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  const household = getHousehold(stubDetails, row);
  const members = getMembers(stubDetails, row);
  const latestAttendance =
    stubDetails?.latest_attendance ||
    row?.latest_attendance ||
    null;
  const barangay =
    stubDetails?.barangay?.name ||
    household?.barangay?.name ||
    household?.barangay_name ||
    row?.barangay_name ||
    row?.address ||
    "--";
  const familyHeadName =
    household?.family_head_name ||
    [
      household?.family_head_first_name,
      household?.family_head_middle_name,
      household?.family_head_last_name,
      household?.family_head_suffix,
    ]
      .filter(Boolean)
      .join(" ") ||
    row?.family_head_name ||
    "--";
  const householdSectors = [
    ...(Array.isArray(stubDetails?.household_sectors)
      ? stubDetails.household_sectors
      : []),
    ...(Array.isArray(row?.household_sectors)
      ? row.household_sectors
      : []),
  ];
  const memberSectors = members.flatMap((member) =>
    Array.isArray(member?.sectors) ? member.sectors : [],
  );
  const sectorsText =
    row?.sectors_text && row.sectors_text !== "-"
      ? row.sectors_text
      : getSectorNames([...householdSectors, ...memberSectors]);
  const distributionTransaction = stubDetails?.distribution_transaction || null;
  const reliefPackTemplates = getReliefPackTemplates({
    row,
    stubDetails,
    templateDetails,
  });
  const donatedReliefPacks = getDonatedReliefPacks(row, stubDetails);
  const donatedLooseItems = getDonatedLooseItems(row, stubDetails);
  const recordedBy =
    household?.registered_by_name ||
    household?.recorded_by_name ||
    household?.registered_by ||
    "--";

  return (
    <DetailsModalShell
      isOpen={isOpen}
      title="Household Distribution Details"
      onClose={onClose}
      maxWidth="980px"
      closeMode="icon"
      titleStyle={{ fontSize: "30px", fontWeight: 700 }}
      panelStyle={styles.shellPanel}
    >
      {isLoading ? (
        <LoadingState message="Loading distribution details..." />
      ) : errorMessage ? (
        <ErrorState compact message={errorMessage} />
      ) : !row ? (
        <EmptyState compact message="Distribution detail is unavailable." />
      ) : (
        <div style={{ display: "grid", gap: "20px" }}>
          <section style={styles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Household Information</h3>
            <div style={{ ...styles.grid, marginTop: "16px" }}>
              <InfoField
                label="Disaster Event"
                value={getDisasterEventTitle(stubDetails, row, household)}
              />
              <InfoField label="Barangay" value={barangay} />
              <InfoField
                label="Stay Type"
                value={formatStayTypeLabel(household?.current_stay_type)}
              />
              <InfoField label="Family Head" value={familyHeadName} />
              <InfoField
                label="Contact Number"
                value={formatContactNumber(household?.contact_number)}
              />
              <InfoField
                label="Household Size"
                value={
                  household?.household_size ??
                  household?.members_count ??
                  row?.family_members_count ??
                  members.length
                }
              />
              <InfoField
                label="Registered At"
                value={formatDateTime(household?.registered_at)}
              />
              <InfoField label="Recorded By" value={recordedBy} />
            </div>
          </section>

          <section style={styles.sectionCard}>
            <div style={styles.visualGrid}>
              <div>
                <p style={styles.label}>Family Head Photo</p>
                <div style={{ marginTop: "12px" }}>
                  {household?.family_head_photo_url ? (
                    <img
                      src={household.family_head_photo_url}
                      alt="Registered family head"
                      style={styles.photo}
                    />
                  ) : (
                    <div style={styles.placeholder}>No photo available</div>
                  )}
                </div>
              </div>
              <div>
                <p style={styles.label}>Household Sectors / Vulnerabilities</p>
                <p style={styles.value}>{sectorsText}</p>

                <p style={{ ...styles.label, marginTop: "18px" }}>
                  Evacuation Status
                </p>
                <p style={styles.value}>
                  {latestAttendance?.status || "No attendance record yet"}
                </p>

                <p style={{ ...styles.label, marginTop: "18px" }}>
                  Arrival Time
                </p>
                <p style={styles.value}>
                  {formatDateTime(latestAttendance?.time_in)}
                </p>

                <p style={{ ...styles.label, marginTop: "18px" }}>
                  Departure Time
                </p>
                <p style={styles.value}>
                  {formatDateTime(latestAttendance?.time_out)}
                </p>
              </div>
            </div>
          </section>

          <section style={styles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Family Members</h3>
            {members.length === 0 ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                No family members are recorded yet.
              </p>
            ) : (
              <div style={styles.list}>
                {members.map((member) => (
                  <div
                    key={member.id || member.evacuee_id || member.full_name}
                    style={styles.listItem}
                  >
                    <p style={{ margin: 0, color: "#17324d", fontWeight: 700 }}>
                      {buildFullName(member)}
                    </p>
                    <p style={{ ...shellStyles.mutedText, marginTop: "6px" }}>
                      {member.relationship_to_head || "--"} | {member.sex || "--"} |{" "}
                      {member.age_value ?? member.age ?? "--"} {member.age_unit || ""}
                    </p>
                    <p style={{ ...shellStyles.mutedText, marginTop: "6px" }}>
                      Sectors: {getSectorNames(member.sectors)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={styles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>QR Stub</h3>
            <div style={{ ...styles.qrVisualGrid, marginTop: "16px" }}>
              <div style={{ maxWidth: "280px" }}>
                <QrCodePanel
                  value={stubDetails?.qr_code_value || row?.qr_code_value || ""}
                  emptyLabel="No QR available"
                  valueStyle={{ overflowWrap: "anywhere" }}
                />
              </div>
              <div style={styles.qrInfoGrid}>
                <InfoField
                  label="Stub Number"
                  value={getDisplayStubNumber(stubDetails, row)}
                />
                <InfoField
                  label="Stub Status"
                  value={formatStatus(
                    stubDetails?.status || row?.raw_stub_status,
                    row?.distribution_status_label,
                  )}
                />
                <InfoField
                  label="Issued At"
                  value={formatDateTime(
                    stubDetails?.issued_at || row?.latest_arrival_time,
                  )}
                />
                <InfoField
                  label="Claimed At"
                  value={formatDateTime(stubDetails?.claimed_at || row?.claimed_at)}
                />
                <InfoField
                  label="Receipt Number"
                  value={distributionTransaction?.receipt_no}
                />
              </div>
            </div>
          </section>

          <section style={styles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Relief Packs / Items Received</h3>

            {reliefPackTemplates.length === 0 &&
            donatedReliefPacks.length === 0 &&
            donatedLooseItems.length === 0 ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                Relief pack details are not available for this household yet.
              </p>
            ) : (
              <div style={styles.list}>
                {reliefPackTemplates.map((template) => (
                  <div key={template.id || template.name} style={styles.listItem}>
                    <p style={{ margin: 0, color: "#17324d", fontWeight: 800 }}>
                      {template.name || "Relief Pack"}
                    </p>
                    <p style={styles.mutedText}>
                      {template.is_additional_pack
                        ? "Sector-based additional pack"
                        : "Standard relief pack"}
                    </p>
                    {Array.isArray(template.items) && template.items.length > 0 ? (
                      <div style={styles.tableWrap}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Item Name</th>
                              <th style={styles.th}>Category</th>
                              <th style={styles.th}>Quantity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {template.items.map((item) => (
                              <tr key={item.id || item.inventory_item_id}>
                                <td style={styles.td}>
                                  {item.inventory_item?.item_name || "--"}
                                </td>
                                <td style={styles.td}>
                                  {item.inventory_item?.category || "--"}
                                </td>
                                <td style={styles.td}>
                                  {formatQuantity(
                                    item.quantity_required,
                                    item.inventory_item?.unit_of_measure,
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={styles.mutedText}>No item breakdown available.</p>
                    )}
                  </div>
                ))}

                {donatedReliefPacks.map((pack, index) => (
                  <div
                    key={`${pack.donation_id || pack.name}-${index}`}
                    style={styles.listItem}
                  >
                    <p style={{ margin: 0, color: "#17324d", fontWeight: 800 }}>
                      {pack.name || "Donated Relief Pack"}
                    </p>
                    <p style={styles.mutedText}>
                      Donor: {pack.donor_name || "--"}
                    </p>
                    {Array.isArray(pack.items) && pack.items.length > 0 ? (
                      <div style={styles.tableWrap}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Item Name</th>
                              <th style={styles.th}>Quantity</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pack.items.map((item) => (
                              <tr
                                key={
                                  item.donation_item_id ||
                                  item.inventory_item_id ||
                                  item.item_name
                                }
                              >
                                <td style={styles.td}>{item.item_name || "--"}</td>
                                <td style={styles.td}>
                                  {formatQuantity(
                                    item.quantity_released,
                                    item.unit_of_measure,
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ))}

                {donatedLooseItems.length > 0 ? (
                  <div style={styles.listItem}>
                    <p style={{ margin: 0, color: "#17324d", fontWeight: 800 }}>
                      Donated Loose Items
                    </p>
                    <div style={styles.tableWrap}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Item Name</th>
                            <th style={styles.th}>Donor</th>
                            <th style={styles.th}>Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {donatedLooseItems.map((item) => (
                            <tr
                              key={
                                item.donation_item_id ||
                                item.inventory_item_id ||
                                item.item_name
                              }
                            >
                              <td style={styles.td}>{item.item_name || "--"}</td>
                              <td style={styles.td}>{item.donor_name || "--"}</td>
                              <td style={styles.td}>
                                {formatQuantity(
                                  item.quantity_released,
                                  item.unit_of_measure,
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>

        </div>
      )}
    </DetailsModalShell>
  );
};

export default InventoryDistributionDetailModal;
