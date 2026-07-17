import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBarChart2,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiHome,
  FiInfo,
  FiMail,
  FiMapPin,
  FiPackage,
  FiPhone,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import LoadingState from "../../components/shared/LoadingState";
import distyncLogo from "../../assets/distync-logo.png";
import { fetchDonationPortalData } from "../../features/donations/donationService";
import {
  formatDonationDateOnly,
} from "../../features/donations/donationFormatters";

const COLORS = {
  cardBg: "#ffffff",
  pageBg: "#edf4fb",
  softBg: "#eef5fb",
  border: "#d6e2ef",
  text: "#17324d",
  subtext: "#60738a",
  primary: "#2f6499",
  primaryDark: "#244f78",
  danger: "#c94b4b",
  dangerSoft: "#fdecec",
  warning: "#b87516",
  warningSoft: "#fff4df",
  success: "#2e7d5b",
  successSoft: "#eaf7f0",
  neutralSoft: "#f6f9fc",
};

const LGU_CONTACT = {
  systemName: "DISTYNC",
  municipality: "Municipality of Malvar, Batangas",
  locationName: "Municipality of Malvar, Batangas",
  address: "Malvar, Batangas",
  receivingUnit: "Official LGU donation coordination desk",
  telephonePrimary: "+63 43 778 5101",
  telephoneSecondary: "+63 917 825 0356",
  emailPrimary: "lgumalvarbatangas@gmail.com",
  emailSecondary: "info@malvarbatangas.gov.ph",
  website: "www.malvarbatangas.gov.ph",
};

// Temporary public drop-off data until an official public configuration source is available.
const DROP_OFF_LOCATION = {
  buildingName: "Municipal Hall of Malvar",
  addressLines: [
    "J. Leviste Street",
    "Poblacion, Malvar, Batangas 4233",
  ],
  officeLines: [
    "Office of the Municipal Mayor",
    "Donation Coordination Desk",
  ],
  receivingHours: ["Monday-Friday", "8:00 AM-5:00 PM"],
  phone: LGU_CONTACT.telephonePrimary,
  email: LGU_CONTACT.emailPrimary,
  mapsUrl: "",
};

const PRIORITY_GROUPS = [
  {
    key: "HIGH",
    title: "High Priority",
    badge: "HIGH PRIORITY",
    iconColor: COLORS.danger,
    background: COLORS.dangerSoft,
    border: "#f2b8b8",
  },
  {
    key: "MEDIUM",
    title: "Medium Priority",
    badge: "MEDIUM PRIORITY",
    iconColor: COLORS.warning,
    background: COLORS.warningSoft,
    border: "#ebcf91",
  },
  {
    key: "LOW",
    title: "Low Priority",
    badge: "LOW PRIORITY",
    iconColor: COLORS.success,
    background: COLORS.successSoft,
    border: "#b7dcc7",
  },
];

const styles = {
  page: {
    width: "100%",
    minWidth: 0,
    background: "transparent",
    padding: "24px",
    boxSizing: "border-box",
    fontFamily: "Poppins, Inter, Segoe UI, sans-serif",
    color: COLORS.text,
  },
  pageInner: {
    display: "grid",
    gap: "18px",
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
    minWidth: 0,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    background: "#cfd9ee",
    border: "1px solid #c5d3e5",
    borderRadius: "16px",
    padding: "16px 18px",
    boxShadow: "0 10px 24px rgba(23, 50, 77, 0.06)",
    flexWrap: "wrap",
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },
  brandLogo: {
    width: "48px",
    height: "48px",
    objectFit: "contain",
    flexShrink: 0,
  },
  brandTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 800,
    color: "#344567",
    lineHeight: 1,
  },
  brandSubtitle: {
    margin: "5px 0 0",
    fontSize: "13px",
    color: "#415674",
    fontWeight: 600,
  },
  portalLabel: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 700,
    color: "#415674",
  },
  backButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    width: "fit-content",
    border: "1px solid #c6d8ea",
    borderRadius: "12px",
    padding: "10px 15px",
    backgroundColor: "#f8fbfe",
    color: "#2a4c6f",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    minHeight: "42px",
  },
  section: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "16px",
    padding: "22px",
    boxShadow: "0 10px 24px rgba(23, 50, 77, 0.05)",
    minWidth: 0,
  },
  hero: {
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(238,245,251,0.98) 100%)",
    border: `1px solid ${COLORS.border}`,
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 10px 30px rgba(23, 50, 77, 0.06)",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.45fr) minmax(260px, 0.55fr)",
    gap: "20px",
    alignItems: "center",
  },
  eyebrow: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: COLORS.primary,
  },
  title: {
    margin: "8px 0",
    fontSize: "34px",
    lineHeight: 1.12,
    fontWeight: 800,
    color: COLORS.text,
  },
  subtitle: {
    margin: 0,
    fontSize: "15px",
    color: COLORS.subtext,
    lineHeight: 1.7,
    maxWidth: "760px",
  },
  notice: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    marginTop: "16px",
    padding: "13px 14px",
    borderRadius: "12px",
    background: COLORS.warningSoft,
    color: COLORS.text,
    border: "1px solid #edd5a5",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  heroAside: {
    display: "grid",
    gap: "10px",
    padding: "16px",
    borderRadius: "14px",
    background: "rgba(255, 255, 255, 0.72)",
    border: `1px solid ${COLORS.border}`,
  },
  asideLabel: {
    margin: 0,
    color: COLORS.subtext,
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  asideValue: {
    margin: 0,
    fontSize: "32px",
    lineHeight: 1,
    fontWeight: 800,
    color: COLORS.primaryDark,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "22px",
    lineHeight: 1.2,
    fontWeight: 800,
    color: COLORS.text,
  },
  sectionText: {
    margin: "6px 0 0",
    fontSize: "14px",
    color: COLORS.subtext,
    lineHeight: 1.6,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    padding: "8px 11px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  eventGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.25fr) minmax(260px, 0.75fr)",
    gap: "18px",
    alignItems: "start",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginTop: "16px",
  },
  detailItem: {
    background: COLORS.neutralSoft,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "12px",
    padding: "13px 14px",
    minWidth: 0,
  },
  label: {
    margin: 0,
    fontSize: "12px",
    color: COLORS.subtext,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  value: {
    margin: "5px 0 0",
    fontSize: "15px",
    color: COLORS.text,
    fontWeight: 700,
    lineHeight: 1.4,
    overflowWrap: "anywhere",
  },
  barangayList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "12px",
  },
  barangayChip: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "7px 10px",
    background: COLORS.softBg,
    border: `1px solid ${COLORS.border}`,
    color: COLORS.text,
    fontSize: "13px",
    fontWeight: 700,
  },
  ghostButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: `1px solid ${COLORS.border}`,
    borderRadius: "999px",
    padding: "7px 10px",
    background: "#fff",
    color: COLORS.primaryDark,
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "14px",
  },
  summaryCard: {
    background: COLORS.softBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "14px",
    padding: "18px",
    minWidth: 0,
  },
  summaryTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
  },
  summaryValue: {
    margin: "12px 0 0",
    fontSize: "30px",
    fontWeight: 800,
    color: COLORS.text,
    lineHeight: 1,
  },
  priorityStack: {
    display: "grid",
    gap: "12px",
  },
  details: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: "14px",
    overflow: "hidden",
    background: "#fff",
  },
  detailsSummary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "15px 16px",
    cursor: "pointer",
    listStyle: "none",
  },
  itemGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
    padding: "0 16px 16px",
  },
  itemCard: {
    borderRadius: "12px",
    padding: "14px",
    border: `1px solid ${COLORS.border}`,
    background: COLORS.neutralSoft,
    minWidth: 0,
  },
  itemTitle: {
    margin: 0,
    color: COLORS.text,
    fontSize: "16px",
    lineHeight: 1.35,
    fontWeight: 800,
  },
  itemQuantity: {
    margin: "10px 0 0",
    fontSize: "25px",
    lineHeight: 1,
    fontWeight: 800,
    color: COLORS.primaryDark,
  },
  itemNote: {
    margin: "9px 0 0",
    color: COLORS.subtext,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  donationList: {
    display: "grid",
    gap: "12px",
  },
  donationCard: {
    background: COLORS.neutralSoft,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "12px",
    padding: "14px",
    minWidth: 0,
  },
  donationTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    flexWrap: "wrap",
  },
  donationName: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 800,
    color: COLORS.text,
  },
  donationMeta: {
    margin: "5px 0 0",
    color: COLORS.subtext,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  tableWrap: {
    overflowX: "auto",
    border: `1px solid ${COLORS.border}`,
    borderRadius: "12px",
    marginTop: "14px",
  },
  table: {
    width: "100%",
    minWidth: "520px",
    borderCollapse: "collapse",
  },
  th: {
    padding: "12px 14px",
    textAlign: "left",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: COLORS.subtext,
    borderBottom: `1px solid ${COLORS.border}`,
    background: COLORS.softBg,
  },
  td: {
    padding: "14px",
    borderBottom: "1px solid #edf3f8",
    fontSize: "14px",
    color: COLORS.text,
    verticalAlign: "top",
  },
  numericCell: {
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  emptyState: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "16px",
    background: COLORS.neutralSoft,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "12px",
    color: COLORS.subtext,
    fontSize: "14px",
    lineHeight: 1.6,
  },
  footer: {
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(238,245,251,0.98) 100%)",
    border: `1px solid ${COLORS.border}`,
    borderRadius: "16px",
    padding: 0,
    boxShadow: "0 10px 30px rgba(23, 50, 77, 0.06)",
    overflow: "hidden",
  },
  footerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "16px",
    alignItems: "start",
    padding: "18px 20px 15px",
  },
  footerBrand: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    minWidth: 0,
  },
  footerLogo: {
    width: "36px",
    height: "36px",
    objectFit: "contain",
    flexShrink: 0,
  },
  footerColumnTitle: {
    margin: "0 0 8px",
    color: COLORS.primaryDark,
    fontSize: "13px",
    lineHeight: 1.3,
    fontWeight: 800,
  },
  footerTitleText: {
    margin: 0,
    color: COLORS.text,
    fontSize: "17px",
    lineHeight: 1,
    fontWeight: 800,
  },
  footerSubtitleText: {
    margin: "3px 0 0",
    color: COLORS.subtext,
    fontSize: "12px",
    lineHeight: 1.4,
    fontWeight: 400,
  },
  footerText: {
    margin: "7px 0 0",
    color: COLORS.subtext,
    fontSize: "13px",
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
  footerDetailList: {
    display: "grid",
    gap: "8px",
    margin: 0,
  },
  footerDetailLabel: {
    margin: 0,
    color: COLORS.primaryDark,
    fontSize: "12px",
    lineHeight: 1.3,
    fontWeight: 800,
  },
  footerDetailValue: {
    margin: "2px 0 0",
    color: COLORS.subtext,
    fontSize: "13px",
    lineHeight: 1.42,
    fontWeight: 400,
    overflowWrap: "anywhere",
  },
  footerContactList: {
    display: "grid",
    gap: "8px",
    maxWidth: "260px",
  },
  footerContactRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    color: COLORS.subtext,
    fontSize: "13px",
    lineHeight: 1.45,
    fontWeight: 400,
    overflowWrap: "anywhere",
  },
  footerAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    minHeight: "38px",
    border: "none",
    borderRadius: "10px",
    padding: "9px 12px",
    background: COLORS.primary,
    color: "#ffffff",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  footerLinkList: {
    display: "grid",
    gap: "4px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  footerLink: {
    display: "inline-flex",
    width: "fit-content",
    minHeight: "28px",
    alignItems: "center",
    color: COLORS.primaryDark,
    fontSize: "13px",
    lineHeight: 1.4,
    fontWeight: 400,
    textDecoration: "none",
  },
  footerBottom: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "12px",
    padding: "11px 20px",
    background: COLORS.softBg,
    borderTop: `1px solid ${COLORS.border}`,
    flexWrap: "wrap",
  },
  footerBottomText: {
    margin: 0,
    color: COLORS.subtext,
    fontSize: "12px",
    lineHeight: 1.5,
    fontWeight: 400,
    overflowWrap: "anywhere",
  },
};

const formatNumber = (value) => Number(value || 0).toLocaleString("en-PH");

const formatDate = (value) => {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const formatDateRange = (startDate, endDate) => {
  const start = formatDate(startDate);
  const end = endDate ? formatDate(endDate) : "Ongoing";
  return `${start} - ${end}`;
};

const formatUpdatedAt = (value) => {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatStatusLabel = (status) => {
  if (!status) {
    return "Unknown";
  }

  return String(status)
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getLatestTimestamp = (timestamps) => {
  const validTimestamps = timestamps
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (validTimestamps.length === 0) {
    return new Date().toISOString();
  }

  return new Date(Math.max(...validTimestamps)).toISOString();
};

const getPriorityMeta = (priorityLevel) =>
  PRIORITY_GROUPS.find((group) => group.key === priorityLevel) ||
  PRIORITY_GROUPS[2];

const buildDonationSummary = (donation) => {
  const items = Array.isArray(donation.items) ? donation.items : [];

  if (items.length === 0) {
    return `${formatNumber(donation.total_quantity_received)} item${
      Number(donation.total_quantity_received || 0) === 1 ? "" : "s"
    } received`;
  }

  return items
    .slice(0, 2)
    .map(
      (item) =>
        `${formatNumber(item.quantity_received)} ${item.unit_of_measure || "items"} ${item.item_name}`,
    )
    .join(", ")
    .concat(items.length > 2 ? `, +${items.length - 2} more` : "");
};

const groupSuggestionsByPriority = (suggestions) =>
  PRIORITY_GROUPS.reduce((groups, priorityGroup) => {
    groups[priorityGroup.key] = (suggestions || []).filter(
      (item) => item.priority_level === priorityGroup.key,
    );
    return groups;
  }, {});

const TopBar = () => (
  <header style={styles.topBar}>
    <div style={styles.brandWrap}>
      <img src={distyncLogo} alt="DISTYNC logo" style={styles.brandLogo} />
      <div>
        <p style={styles.brandTitle}>DISTYNC</p>
        <p style={styles.brandSubtitle}>Disaster Relief Management</p>
      </div>
    </div>

    <p style={styles.portalLabel}>Donor & NGO Public Portal</p>
  </header>
);

const HeroSection = ({ activeEvent, lastUpdatedAt }) => (
  <section style={styles.hero} aria-labelledby="donor-hero-title">
    <div style={styles.heroGrid} className="donor-portal-layout">
      <div>
        <p style={styles.eyebrow}>Public In-Kind Donation Information</p>
        <h1 id="donor-hero-title" style={styles.title}>
          Support Malvar Disaster Relief Operations
        </h1>
        <p style={styles.subtitle}>
          Donors and NGOs can use this page to identify current in-kind donation
          needs, review the active relief operation, and coordinate support with
          official municipal contact channels.
        </p>
        <div style={styles.notice} role="note">
          <FiInfo size={18} color={COLORS.warning} aria-hidden="true" />
          <span>
            Displayed forecasted quantities are recommendations only and may
            change as disaster conditions, affected population, distribution
            activity, and inventory levels are updated.
          </span>
        </div>
      </div>

      <aside style={styles.heroAside} aria-label="Current portal status">
        <p style={styles.asideLabel}>Current Relief Operation</p>
        <p style={styles.asideValue}>{activeEvent ? "Active" : "Monitoring"}</p>
        <p style={styles.sectionText}>
          {activeEvent
            ? activeEvent.title || "Active disaster relief operation"
            : "There is currently no active disaster relief operation."}
        </p>
        <span
          style={{
            ...styles.badge,
            width: "fit-content",
            background: activeEvent ? COLORS.dangerSoft : COLORS.successSoft,
            color: activeEvent ? COLORS.danger : COLORS.success,
          }}
        >
          {activeEvent ? <FiAlertCircle size={15} /> : <FiCheckCircle size={15} />}
          Updated {formatUpdatedAt(lastUpdatedAt)}
        </span>
      </aside>
    </div>
  </section>
);

const ActiveDisasterSection = ({ event, showAllBarangays, onToggleBarangays }) => {
  if (!event) {
    return (
      <section style={styles.section} aria-labelledby="active-event-title">
        <h2 id="active-event-title" style={styles.sectionTitle}>
          Recent Active Disaster Event
        </h2>
        <div style={{ ...styles.emptyState, marginTop: "14px" }}>
          <FiCheckCircle size={20} color={COLORS.success} aria-hidden="true" />
          <span>There is currently no active disaster relief operation.</span>
        </div>
      </section>
    );
  }

  const barangays = Array.isArray(event.affected_barangays)
    ? event.affected_barangays
    : [];
  const visibleBarangays = showAllBarangays ? barangays : barangays.slice(0, 6);

  return (
    <section style={styles.section} aria-labelledby="active-event-title">
      <div style={styles.sectionHeader}>
        <div>
          <h2 id="active-event-title" style={styles.sectionTitle}>
            Recent Active Disaster Event
          </h2>
          <p style={styles.sectionText}>
            Public information for the most recent active operation.
          </p>
        </div>
        <span
          style={{
            ...styles.badge,
            background: COLORS.dangerSoft,
            color: COLORS.danger,
          }}
        >
          <FiAlertCircle size={15} />
          {formatStatusLabel(event.status)}
        </span>
      </div>

      <div style={styles.eventGrid} className="donor-portal-layout">
        <div>
          <h3 style={{ ...styles.sectionTitle, fontSize: "20px" }}>
            {event.title || "Active disaster relief operation"}
          </h3>
          <p style={styles.sectionText}>
            {event.description || "No public description has been recorded yet."}
          </p>

          <div style={styles.detailGrid}>
            <div style={styles.detailItem}>
              <p style={styles.label}>Disaster Type</p>
              <p style={styles.value}>{event.disaster_type || "--"}</p>
            </div>
            <div style={styles.detailItem}>
              <p style={styles.label}>Relief Period</p>
              <p style={styles.value}>
                {formatDateRange(event.start_date, event.end_date)}
              </p>
            </div>
          </div>
        </div>

        <aside aria-label="Affected barangays">
          <p style={styles.label}>Affected Barangays</p>
          {barangays.length === 0 ? (
            <p style={{ ...styles.sectionText, marginTop: "10px" }}>
              No affected barangay is recorded for this operation.
            </p>
          ) : (
            <>
              <div style={styles.barangayList}>
                {visibleBarangays.map((barangay) => (
                  <span
                    key={barangay.id || barangay.name}
                    style={styles.barangayChip}
                  >
                    {barangay.name}
                  </span>
                ))}
              </div>
              {barangays.length > 6 ? (
                <button
                  type="button"
                  style={{ ...styles.ghostButton, marginTop: "12px" }}
                  onClick={onToggleBarangays}
                  aria-expanded={showAllBarangays}
                >
                  {showAllBarangays ? <FiChevronUp /> : <FiChevronDown />}
                  {showAllBarangays ? "Show Less" : `View All (${barangays.length})`}
                </button>
              ) : null}
            </>
          )}
        </aside>
      </div>
    </section>
  );
};

const ImpactSummarySection = ({ event }) => (
  <section style={styles.section} aria-labelledby="impact-summary-title">
    <div style={styles.sectionHeader}>
      <div>
        <h2 id="impact-summary-title" style={styles.sectionTitle}>
          Disaster Impact Summary
        </h2>
        <p style={styles.sectionText}>
          Totals are based on the selected active disaster event.
        </p>
      </div>
    </div>

    <div style={styles.summaryGrid}>
      <div style={styles.summaryCard}>
        <div style={styles.summaryTop}>
          <p style={styles.label}>Affected Barangays</p>
          <FiMapPin size={20} color={COLORS.primary} aria-hidden="true" />
        </div>
        <p style={styles.summaryValue}>
          {formatNumber(event?.affected_barangays_count)}
        </p>
        <p style={styles.sectionText}>Barangays included in the operation</p>
      </div>
      <div style={styles.summaryCard}>
        <div style={styles.summaryTop}>
          <p style={styles.label}>Affected Families</p>
          <FiHome size={20} color={COLORS.primary} aria-hidden="true" />
        </div>
        <p style={styles.summaryValue}>
          {formatNumber(event?.registered_households_count)}
        </p>
        <p style={styles.sectionText}>Families or households registered</p>
      </div>
      <div style={styles.summaryCard}>
        <div style={styles.summaryTop}>
          <p style={styles.label}>Affected Individuals</p>
          <FiUsers size={20} color={COLORS.primary} aria-hidden="true" />
        </div>
        <p style={styles.summaryValue}>
          {formatNumber(event?.affected_individuals_count)}
        </p>
        <p style={styles.sectionText}>Individuals linked to active households</p>
      </div>
    </div>
  </section>
);

const NeededItemsSection = ({ suggestions }) => {
  const groupedSuggestions = useMemo(
    () => groupSuggestionsByPriority(suggestions),
    [suggestions],
  );
  const hasSuggestions = (suggestions || []).length > 0;

  return (
    <section style={styles.section} aria-labelledby="needed-items-title">
      <div style={styles.sectionHeader}>
        <div>
          <h2 id="needed-items-title" style={styles.sectionTitle}>
            Needed Items
          </h2>
          <p style={styles.sectionText}>
            Forecast-based donation suggestions grouped by priority level.
          </p>
        </div>
      </div>

      <div style={{ ...styles.notice, marginTop: 0, marginBottom: "14px" }} role="note">
        <FiTrendingUp size={18} color={COLORS.warning} aria-hidden="true" />
        <span>
          Suggested donation quantities are generated using the system's
          forecasting module based on disaster impact, affected population,
          historical relief distribution, and inventory data. These values are
          recommendations only and may change as new information becomes
          available.
        </span>
      </div>

      {!hasSuggestions ? (
        <div style={styles.emptyState}>
          <FiInfo size={20} color={COLORS.primary} aria-hidden="true" />
          <span>
            There are currently no donation suggestions available for this
            disaster event.
          </span>
        </div>
      ) : (
        <div style={styles.priorityStack}>
          {PRIORITY_GROUPS.map((priorityGroup) => {
            const items = groupedSuggestions[priorityGroup.key] || [];

            return (
              <details
                key={priorityGroup.key}
                style={styles.details}
                open={priorityGroup.key !== "LOW"}
              >
                <summary style={styles.detailsSummary}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "10px",
                      fontWeight: 800,
                      color: COLORS.text,
                    }}
                  >
                    <FiPackage
                      size={18}
                      color={priorityGroup.iconColor}
                      aria-hidden="true"
                    />
                    {priorityGroup.title}
                  </span>
                  <span
                    style={{
                      ...styles.badge,
                      background: priorityGroup.background,
                      border: `1px solid ${priorityGroup.border}`,
                      color: priorityGroup.iconColor,
                    }}
                  >
                    {items.length} item{items.length === 1 ? "" : "s"}
                  </span>
                </summary>

                {items.length === 0 ? (
                  <div style={{ padding: "0 16px 16px" }}>
                    <p style={styles.sectionText}>
                      No {priorityGroup.title.toLowerCase()} suggestions are
                      available.
                    </p>
                  </div>
                ) : (
                  <div style={styles.itemGrid}>
                    {items.map((item) => {
                      const priorityMeta = getPriorityMeta(item.priority_level);

                      return (
                        <article
                          key={item.inventory_item_id || item.item_name}
                          style={{
                            ...styles.itemCard,
                            borderColor: priorityMeta.border,
                            background: priorityMeta.background,
                          }}
                        >
                          <span
                            style={{
                              ...styles.badge,
                              background: "#fff",
                              color: priorityMeta.iconColor,
                              padding: "5px 9px",
                            }}
                          >
                            {priorityMeta.badge}
                          </span>
                          <h3 style={{ ...styles.itemTitle, marginTop: "12px" }}>
                            {item.item_name || "Donation item"}
                          </h3>
                          <p style={styles.itemQuantity}>
                            {formatNumber(item.suggested_quantity)}
                          </p>
                          <p style={styles.itemNote}>
                            {item.unit_of_measure || "items"} suggested
                          </p>
                          {item.note ? (
                            <p style={styles.itemNote}>{item.note}</p>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
};

const TransparencySection = ({ recentDonations, transparencySummary }) => {
  return (
    <section style={styles.section} aria-labelledby="transparency-title">
      <div style={styles.sectionHeader}>
        <div>
          <h2 id="transparency-title" style={styles.sectionTitle}>
            Recent Donation Transparency
          </h2>
          <p style={styles.sectionText}>
            Public in-kind donation records and aggregate item movement.
          </p>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <p style={styles.label}>Donations Received</p>
          <p style={styles.summaryValue}>
            {formatNumber(transparencySummary?.total_donations_received)}
          </p>
        </div>
        <div style={styles.summaryCard}>
          <p style={styles.label}>Items Received</p>
          <p style={styles.summaryValue}>
            {formatNumber(transparencySummary?.total_quantity_received)}
          </p>
        </div>
      </div>

      <h3 style={{ ...styles.sectionTitle, fontSize: "18px", marginTop: "18px" }}>
        Recent Recorded Donations
      </h3>
      {(recentDonations || []).length === 0 ? (
        <div style={{ ...styles.emptyState, marginTop: "12px" }}>
          <FiInfo size={20} color={COLORS.primary} aria-hidden="true" />
          <span>No public donation records are available yet.</span>
        </div>
      ) : (
        <div style={{ ...styles.donationList, marginTop: "12px" }}>
          {recentDonations.map((donation, index) => (
            <article
              key={donation.public_key || `${donation.donation_date}-${index}`}
              style={styles.donationCard}
            >
              <div style={styles.donationTop}>
                <div>
                  <h3 style={styles.donationName}>{donation.donor_name}</h3>
                  <p style={styles.donationMeta}>
                    {donation.recipient_barangay || "Not specified"} |{" "}
                    {formatDonationDateOnly(donation.donation_date)}
                  </p>
                </div>
                <span
                  style={{
                    ...styles.badge,
                    background: COLORS.successSoft,
                    color: COLORS.success,
                  }}
                >
                  {formatStatusLabel(donation.status)}
                </span>
              </div>
              <p style={styles.donationMeta}>{buildDonationSummary(donation)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

const DonationUtilizationSection = ({ transparencySummary }) => {
  const donatedItemRows = transparencySummary?.received_vs_distributed || [];

  return (
    <section style={styles.section} aria-labelledby="utilization-title">
      <div style={styles.sectionHeader}>
        <div>
          <h2 id="utilization-title" style={styles.sectionTitle}>
            Donation Utilization
          </h2>
          <p style={styles.sectionText}>
            Summary of donated items that have been received, distributed, and
            currently remaining based on completed inventory transactions.
          </p>
        </div>
      </div>

      {donatedItemRows.length === 0 ? (
        <div style={styles.emptyState}>
          <FiBarChart2 size={20} color={COLORS.primary} aria-hidden="true" />
          <span>No donated inventory summary is available yet.</span>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Item</th>
                <th style={{ ...styles.th, ...styles.numericCell }}>Received</th>
                <th style={{ ...styles.th, ...styles.numericCell }}>
                  Distributed
                </th>
                <th style={{ ...styles.th, ...styles.numericCell }}>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {donatedItemRows.slice(0, 6).map((row) => (
                <tr key={row.inventory_item_id || row.item_name}>
                  <td style={styles.td}>{row.item_name || "--"}</td>
                  <td style={{ ...styles.td, ...styles.numericCell }}>
                    {formatNumber(row.quantity_received)}{" "}
                    {row.unit_of_measure || "items"}
                  </td>
                  <td style={{ ...styles.td, ...styles.numericCell }}>
                    {formatNumber(row.quantity_distributed)}{" "}
                    {row.unit_of_measure || "items"}
                  </td>
                  <td style={{ ...styles.td, ...styles.numericCell }}>
                    {formatNumber(row.quantity_remaining)}{" "}
                    {row.unit_of_measure || "items"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const PortalFooter = () => {
  const currentYear = new Date().getFullYear();
  const footerInfo = {
    systemName: LGU_CONTACT.systemName,
    systemSubtitle: "Disaster Relief Management System",
    municipality: LGU_CONTACT.municipality,
    buildingName: DROP_OFF_LOCATION.buildingName,
    addressLines: DROP_OFF_LOCATION.addressLines,
    officeLines: DROP_OFF_LOCATION.officeLines,
    receivingHours: DROP_OFF_LOCATION.receivingHours,
    phone: DROP_OFF_LOCATION.phone,
    email: DROP_OFF_LOCATION.email,
    mapsUrl: DROP_OFF_LOCATION.mapsUrl,
  };
  const footerLinks = [
    { label: "Active Disaster", href: "#active-event-title" },
    { label: "Needed Items", href: "#needed-items-title" },
    { label: "Donation Transparency", href: "#transparency-title" },
    { label: "Donation Utilization", href: "#utilization-title" },
    { label: "Drop-off Location", href: "#drop-off-title" },
  ];

  return (
    <footer style={styles.footer}>
      <div style={styles.footerGrid}>
        <section aria-labelledby="footer-about-title">
          <h2 id="footer-about-title" style={styles.footerColumnTitle}>
            About DISTYNC
          </h2>
          <div style={styles.footerBrand}>
            <img src={distyncLogo} alt="DISTYNC logo" style={styles.footerLogo} />
            <div>
              <p style={styles.footerTitleText}>
                {footerInfo.systemName}
              </p>
              <p style={styles.footerSubtitleText}>
                {footerInfo.systemSubtitle}
              </p>
            </div>
          </div>
          <p style={styles.footerText}>
            Public in-kind donation information portal for{" "}
            {footerInfo.municipality}.
          </p>
        </section>

        <section aria-labelledby="drop-off-title">
          <h2 id="drop-off-title" style={styles.footerColumnTitle}>
            Donation Coordination
          </h2>
          <div style={styles.footerDetailList}>
            <div>
              <p style={styles.footerDetailLabel}>Receiving Office</p>
              <p style={styles.footerDetailValue}>
                {footerInfo.officeLines.map((line) => (
                  <React.Fragment key={line}>
                    {line}
                    <br />
                  </React.Fragment>
                ))}
              </p>
            </div>
            <div>
              <p style={styles.footerDetailLabel}>Drop-off Location</p>
              <p style={styles.footerDetailValue}>
                {footerInfo.buildingName}
                <br />
                {footerInfo.addressLines.map((line) => (
                  <React.Fragment key={line}>
                    {line}
                    <br />
                  </React.Fragment>
                ))}
              </p>
            </div>
            <div>
              <p style={styles.footerDetailLabel}>Receiving Hours</p>
              <p style={styles.footerDetailValue}>
                {footerInfo.receivingHours.join(", ")}
              </p>
            </div>
          </div>
        </section>

        <nav aria-labelledby="footer-links-title">
          <h2 id="footer-links-title" style={styles.footerColumnTitle}>
            Quick Links
          </h2>
          <ul style={styles.footerLinkList}>
            {footerLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} style={styles.footerLink}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="footer-contact-title">
          <h2 id="footer-contact-title" style={styles.footerColumnTitle}>
            Contact Information
          </h2>
          <div style={styles.footerContactList}>
            <div style={styles.footerContactRow}>
              <FiPhone size={15} aria-hidden="true" />
              <span>{footerInfo.phone}</span>
            </div>
            <div style={styles.footerContactRow}>
              <FiMail size={15} aria-hidden="true" />
              <span>{footerInfo.email}</span>
            </div>
            {footerInfo.mapsUrl ? (
              <a
                href={footerInfo.mapsUrl}
                style={styles.footerAction}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FiMapPin size={15} aria-hidden="true" />
                Get Directions
              </a>
            ) : (
              <button type="button" style={styles.footerAction}>
                <FiMapPin size={15} aria-hidden="true" />
                Get Directions
              </button>
            )}
          </div>
        </section>
      </div>

      <div style={styles.footerBottom}>
        <p style={styles.footerBottomText}>
          (c) {currentYear} DISTYNC - {footerInfo.municipality}
        </p>
      </div>
    </footer>
  );
};

const DonationInformationPage = () => {
  const navigate = useNavigate();
  const [showAllBarangays, setShowAllBarangays] = useState(false);
  const [pageState, setPageState] = useState({
    isLoading: true,
    errorMessage: "",
    activeDisasters: [],
    forecastSuggestions: [],
    recentDonations: [],
    transparencySummary: {},
    lastUpdatedAt: new Date().toISOString(),
  });

  useEffect(() => {
    let isMounted = true;

    const loadDonationOverview = async () => {
      setPageState((currentState) => ({
        ...currentState,
        isLoading: true,
        errorMessage: "",
      }));

      try {
        const publicPortalData = await fetchDonationPortalData();

        if (!isMounted) {
          return;
        }

        const disasterEvents = Array.isArray(publicPortalData?.disaster_events)
          ? publicPortalData.disaster_events
          : [];
        const forecastSuggestions = Array.isArray(
          publicPortalData?.forecast_suggestions,
        )
          ? publicPortalData.forecast_suggestions
          : [];
        const recentDonations = Array.isArray(publicPortalData?.recent_donations)
          ? publicPortalData.recent_donations
          : [];
        const transparencySummary =
          publicPortalData?.transparency_summary &&
          typeof publicPortalData.transparency_summary === "object"
            ? publicPortalData.transparency_summary
            : {};

        setPageState({
          isLoading: false,
          errorMessage: "",
          activeDisasters: disasterEvents,
          forecastSuggestions,
          recentDonations,
          transparencySummary,
          lastUpdatedAt: getLatestTimestamp([
            ...disasterEvents.map((event) => event.updated_at || event.created_at),
            ...forecastSuggestions.map((item) => item.forecasted_at),
            ...recentDonations.map((donation) => donation.donation_date),
          ]),
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPageState({
          isLoading: false,
          errorMessage: error.message || "Failed to load donation information.",
          activeDisasters: [],
          forecastSuggestions: [],
          recentDonations: [],
          transparencySummary: {},
          lastUpdatedAt: new Date().toISOString(),
        });
      }
    };

    loadDonationOverview();

    return () => {
      isMounted = false;
    };
  }, []);

  const {
    isLoading,
    errorMessage,
    activeDisasters,
    forecastSuggestions,
    recentDonations,
    transparencySummary,
    lastUpdatedAt,
  } = pageState;
  const activeEvent = activeDisasters[0] || null;

  return (
    <main style={styles.page}>
      <div style={styles.pageInner}>
        <button
          type="button"
          onClick={() => navigate("/access")}
          style={styles.backButton}
        >
          <FiArrowLeft size={16} aria-hidden="true" />
          Back
        </button>

        <TopBar />
        <HeroSection activeEvent={activeEvent} lastUpdatedAt={lastUpdatedAt} />

        {isLoading ? (
          <section style={styles.section} aria-live="polite">
            <LoadingState message="Loading public donation information..." />
          </section>
        ) : null}

        {!isLoading && errorMessage ? (
          <section style={styles.section} aria-live="polite">
            <div style={styles.emptyState}>
              <FiAlertCircle size={20} color={COLORS.danger} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          </section>
        ) : null}

        {!isLoading && !errorMessage ? (
          <>
            <ActiveDisasterSection
              event={activeEvent}
              showAllBarangays={showAllBarangays}
              onToggleBarangays={() =>
                setShowAllBarangays((currentValue) => !currentValue)
              }
            />
            <ImpactSummarySection event={activeEvent} />
            <NeededItemsSection suggestions={forecastSuggestions} />
            <TransparencySection
              recentDonations={recentDonations}
              transparencySummary={transparencySummary}
            />
            <DonationUtilizationSection
              transparencySummary={transparencySummary}
            />
          </>
        ) : null}

        <PortalFooter />
      </div>
    </main>
  );
};

export default DonationInformationPage;
