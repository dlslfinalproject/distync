import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBarChart2,
  FiCheckCircle,
  FiGlobe,
  FiHome,
  FiInfo,
  FiMail,
  FiMapPin,
  FiPackage,
  FiPhone,
  FiShoppingBag,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { FaFacebookF } from "react-icons/fa";
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

const PUBLIC_PORTAL_REFRESH_INTERVAL_MS = 60000;

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
  websiteUrl: "https://www.malvarbatangas.gov.ph",
  facebookLabel: "Municipality of Malvar",
  facebookUrl: "https://www.facebook.com/share/1M3yVXbjF1/?mibextid=wwXIfr",
};

const DEFAULT_PUBLIC_CONTACT_CONFIG = {
  system_name: LGU_CONTACT.systemName,
  municipality: LGU_CONTACT.municipality,
  website: LGU_CONTACT.website,
  website_url: LGU_CONTACT.websiteUrl,
  facebook_label: LGU_CONTACT.facebookLabel,
  facebook_url: LGU_CONTACT.facebookUrl,
  drop_off: {
    location_name: "Municipal Hall of Malvar",
    address_lines: [
    "J. Leviste Street",
    "Poblacion, Malvar, Batangas 4233",
  ],
    office_lines: [
    "Office of the Municipal Mayor",
    "Donation Coordination Desk",
  ],
    receiving_hours: ["Monday-Friday", "8:00 AM-5:00 PM"],
    phone: LGU_CONTACT.telephonePrimary,
    email: LGU_CONTACT.emailPrimary,
    maps_url: "",
  },
  notices: {
    privacy:
      "Public information is aggregated and does not include private beneficiary records.",
    in_kind_only:
      "DISTYNC provides information for in-kind relief donations only. Cash donations and online payments are not processed through this portal.",
  },
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
  eventCardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "14px",
    alignItems: "start",
  },
  eventCard: {
    display: "grid",
    gap: "12px",
    background: COLORS.neutralSoft,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "14px",
    padding: "16px",
    minWidth: 0,
  },
  eventCardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "10px",
  },
  eventCardTitle: {
    margin: 0,
    color: COLORS.text,
    fontSize: "17px",
    lineHeight: 1.35,
    fontWeight: 800,
    overflowWrap: "anywhere",
  },
  eventCardMeta: {
    margin: "4px 0 0",
    color: COLORS.subtext,
    fontSize: "13px",
    lineHeight: 1.45,
    fontWeight: 600,
  },
  eventDescription: {
    margin: 0,
    color: COLORS.subtext,
    fontSize: "13px",
    lineHeight: 1.55,
    overflowWrap: "anywhere",
  },
  eventStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  eventStat: {
    background: "#ffffff",
    border: `1px solid ${COLORS.border}`,
    borderRadius: "10px",
    padding: "10px",
    minWidth: 0,
  },
  eventStatTop: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: COLORS.primary,
  },
  eventStatValue: {
    margin: "6px 0 0",
    color: COLORS.text,
    fontSize: "18px",
    lineHeight: 1,
    fontWeight: 800,
  },
  eventStatLabel: {
    margin: "4px 0 0",
    color: COLORS.subtext,
    fontSize: "11px",
    lineHeight: 1.35,
    fontWeight: 600,
  },
  label: {
    margin: 0,
    fontSize: "12px",
    color: COLORS.subtext,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  barangayList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "7px",
    marginTop: "8px",
  },
  barangayChip: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "6px 9px",
    background: COLORS.softBg,
    border: `1px solid ${COLORS.border}`,
    color: COLORS.text,
    fontSize: "12px",
    fontWeight: 700,
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
    position: "relative",
  },
  summaryTop: {
    display: "block",
    paddingRight: "58px",
  },
  summaryIcon: {
    position: "absolute",
    top: "28px",
    right: "28px",
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    background: "#ffffff",
    border: `1px solid ${COLORS.border}`,
    color: COLORS.primaryDark,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
    width: "100%",
    marginLeft: "auto",
    marginRight: "auto",
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
    alignItems: "stretch",
    gap: "12px",
  },
  donationIconStack: {
    width: "42px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    flexShrink: 0,
  },
  donationIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    background: COLORS.softBg,
    border: `1px solid ${COLORS.border}`,
    color: COLORS.primaryDark,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  donationIconCompact: {
    width: "34px",
    height: "34px",
    borderRadius: "11px",
  },
  donationBody: {
    minWidth: 0,
    flex: 1,
  },
  donationName: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 800,
    color: COLORS.text,
  },
  donorTypeText: {
    color: COLORS.subtext,
    fontSize: "14px",
    fontWeight: 700,
  },
  donationMeta: {
    margin: "5px 0 0",
    color: COLORS.subtext,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  donationSummaryText: {
    margin: "12px 0 0",
    color: COLORS.text,
    fontSize: "14px",
    lineHeight: 1.5,
    fontWeight: 700,
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
    width: "calc(100% + 48px)",
    margin: "24px -24px -24px",
    background:
      "linear-gradient(135deg, #17324d 0%, #244f78 58%, #2f6499 100%)",
    padding: 0,
    boxShadow: "0 -12px 28px rgba(23, 50, 77, 0.12)",
    overflow: "hidden",
  },
  footerInner: {
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "32px 28px 24px",
    boxSizing: "border-box",
  },
  footerGrid: {
    display: "grid",
    gridTemplateColumns:
      "minmax(210px, 0.82fr) minmax(520px, 1.55fr) minmax(250px, 0.9fr)",
    columnGap: "42px",
    rowGap: "24px",
    alignItems: "start",
  },
  footerColumn: {
    minWidth: 0,
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
    margin: "0 0 10px",
    color: "#ffffff",
    fontSize: "15px",
    lineHeight: 1.3,
    fontWeight: 800,
  },
  footerTitleText: {
    margin: 0,
    color: "#ffffff",
    fontSize: "17px",
    lineHeight: 1,
    fontWeight: 800,
  },
  footerSubtitleText: {
    margin: "3px 0 0",
    color: "#d8e6f4",
    fontSize: "12px",
    lineHeight: 1.4,
    fontWeight: 400,
  },
  footerText: {
    margin: "8px 0 0",
    color: "#d8e6f4",
    fontSize: "13px",
    lineHeight: 1.5,
    maxWidth: "235px",
    overflowWrap: "anywhere",
  },
  footerCoordinationBlock: {
    display: "grid",
    gap: "13px",
  },
  footerCoordinationPair: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 0.95fr) minmax(260px, 1.05fr)",
    columnGap: "28px",
    rowGap: "14px",
    alignItems: "start",
  },
  footerDetailGroup: {
    display: "grid",
    gap: "3px",
  },
  footerDetailLabel: {
    margin: 0,
    color: "#ffffff",
    fontSize: "12px",
    lineHeight: 1.3,
    fontWeight: 600,
  },
  footerDetailValue: {
    margin: 0,
    color: "#d8e6f4",
    fontSize: "13px",
    lineHeight: 1.42,
    fontWeight: 400,
    overflowWrap: "anywhere",
  },
  footerAction: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "fit-content",
    minHeight: "36px",
    border: "none",
    borderRadius: "10px",
    marginTop: "8px",
    padding: "8px 15px",
    background: "#ffffff",
    color: COLORS.primaryDark,
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 8px 16px rgba(0, 0, 0, 0.16)",
    transition: "background 160ms ease, transform 160ms ease",
  },
  footerActionDisabled: {
    background: "rgba(255, 255, 255, 0.12)",
    color: "#ffffff",
    border: "1px solid rgba(255, 255, 255, 0.32)",
    boxShadow: "none",
    cursor: "not-allowed",
  },
  footerLink: {
    display: "inline-flex",
    width: "fit-content",
    minHeight: "23px",
    alignItems: "center",
    color: "#eaf3fb",
    fontSize: "13px",
    lineHeight: 1.4,
    fontWeight: 400,
    textDecoration: "none",
    cursor: "pointer",
    transition: "color 160ms ease, transform 160ms ease",
  },
  footerCompactContact: {
    display: "grid",
    gap: "8px",
    marginTop: "10px",
  },
  footerContactRow: {
    display: "grid",
    gridTemplateColumns: "18px minmax(0, 1fr)",
    alignItems: "start",
    columnGap: "9px",
    color: "#d8e6f4",
    fontSize: "12px",
    lineHeight: 1.45,
    fontWeight: 400,
    overflowWrap: "anywhere",
  },
  footerContactLink: {
    display: "grid",
    gridTemplateColumns: "18px minmax(0, 1fr)",
    alignItems: "start",
    columnGap: "9px",
    color: "#d8e6f4",
    fontSize: "12px",
    lineHeight: 1.45,
    fontWeight: 400,
    textDecoration: "none",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    transition: "color 160ms ease, transform 160ms ease",
  },
  footerContactText: {
    display: "block",
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  footerBottom: {
    background: "rgba(9, 26, 44, 0.5)",
    borderTop: "1px solid rgba(255, 255, 255, 0.16)",
  },
  footerQuickLinksBand: {
    borderTop: "1px solid rgba(255, 255, 255, 0.16)",
    background: "rgba(9, 26, 44, 0.18)",
  },
  footerQuickLinksInner: {
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "14px 28px",
    boxSizing: "border-box",
  },
  footerHorizontalLinks: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px 52px",
    flexWrap: "wrap",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  footerBottomInner: {
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "12px",
    alignItems: "center",
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "10px 28px 12px",
    boxSizing: "border-box",
  },
  footerBottomText: {
    margin: 0,
    color: "#d8e6f4",
    fontSize: "12px",
    lineHeight: 1.5,
    fontWeight: 400,
    overflowWrap: "anywhere",
  },
};

const portalFooterCss = `
  .portal-footer-link:hover {
    color: #ffffff;
    transform: translateX(3px);
    text-decoration: underline;
  }

  .portal-footer-contact-link:hover {
    color: #ffffff;
    transform: translateX(2px);
    text-decoration: underline;
  }

  .portal-footer-action:hover:not(:disabled) {
    background: #eaf3fb;
    transform: translateY(-1px);
  }

  .portal-footer-link:focus-visible,
  .portal-footer-contact-link:focus-visible,
  .portal-footer-action:focus-visible {
    outline: 3px solid rgba(255, 255, 255, 0.42);
    outline-offset: 3px;
  }

  @media (max-width: 1180px) {
    .portal-footer-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      column-gap: 24px !important;
    }

    .portal-footer-coordination-pair {
      grid-template-columns: 1fr !important;
      gap: 13px !important;
    }

  }

  @media (max-width: 640px) {
    .donor-event-stats-grid {
      grid-template-columns: 1fr !important;
    }

    .recent-donation-grid {
      grid-template-columns: 1fr !important;
      max-width: 100% !important;
    }

    .portal-footer-grid,
    .portal-footer-coordination-pair,
    .portal-footer-bottom-inner {
      grid-template-columns: 1fr !important;
    }

  }
`;

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

const getDateOnlyTime = (value) => {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
  ).getTime();
};

const getEventFallbackTime = (event) => {
  const updatedTime = new Date(event?.updated_at || 0).getTime();
  const createdTime = new Date(event?.created_at || 0).getTime();

  return Math.max(
    Number.isFinite(updatedTime) ? updatedTime : 0,
    Number.isFinite(createdTime) ? createdTime : 0,
  );
};

const getRecentActiveEvents = (events) => {
  const today = new Date();
  const todayTime = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();

  return [...(events || [])]
    .filter((event) => {
      const status = String(event?.status || "").toUpperCase();
      const startTime = getDateOnlyTime(event?.start_date);
      const endTime = getDateOnlyTime(event?.end_date);

      return (
        (status === "ACTIVE" || status === "ONGOING") &&
        (startTime === null || startTime <= todayTime) &&
        (endTime === null || endTime >= todayTime)
      );
    })
    .sort((left, right) => {
      const leftStartTime = getDateOnlyTime(left.start_date);
      const rightStartTime = getDateOnlyTime(right.start_date);

      if (leftStartTime !== rightStartTime) {
        if (leftStartTime === null) {
          return 1;
        }

        if (rightStartTime === null) {
          return -1;
        }

        return rightStartTime - leftStartTime;
      }

      return getEventFallbackTime(right) - getEventFallbackTime(left);
    })
    .slice(0, 3);
};

const getPriorityMeta = (priorityLevel) =>
  PRIORITY_GROUPS.find((group) => group.key === priorityLevel) ||
  PRIORITY_GROUPS[2];

const buildDonationSummary = (donation) => {
  const looseItems = Number(donation.total_loose_items_received || 0);
  const reliefPacks = Number(donation.total_relief_packs_received || 0);
  const summaryParts = [];

  if (looseItems > 0) {
    summaryParts.push(
      `${formatNumber(looseItems)} item${looseItems === 1 ? "" : "s"}`,
    );
  }

  if (reliefPacks > 0) {
    summaryParts.push(
      `${formatNumber(reliefPacks)} relief pack${
        reliefPacks === 1 ? "" : "s"
      }`,
    );
  }

  if (summaryParts.length > 0) {
    return `Donated ${summaryParts.join(" and ")}`;
  }

  const items = Array.isArray(donation.items) ? donation.items : [];
  if (items.length === 0) {
    return `Donated ${formatNumber(donation.total_quantity_received)} item${
      Number(donation.total_quantity_received || 0) === 1 ? "" : "s"
    }`;
  }

  const itemSummary = items
    .slice(0, 2)
    .map(
      (item) =>
        `${formatNumber(item.quantity_received)} ${item.unit_of_measure || "items"} ${item.item_name}`,
    )
    .join(", ")
    .concat(items.length > 2 ? `, +${items.length - 2} more` : "");

  return `Donated ${itemSummary}`;
};

const getDonationTypeIcons = (donation) => {
  const looseItems = Number(donation.total_loose_items_received || 0);
  const reliefPacks = Number(donation.total_relief_packs_received || 0);
  const hasLooseItems = looseItems > 0;
  const hasReliefPacks = reliefPacks > 0;

  if (hasLooseItems && hasReliefPacks) {
    return ["loose", "relief"];
  }

  if (hasReliefPacks) {
    return ["relief"];
  }

  return ["loose"];
};

const getRecentDonationGridStyle = (recordCount) => {
  const normalizedCount = Number(recordCount || 0);
  const columnCount = normalizedCount >= 5 ? 3 : Math.min(normalizedCount, 2);

  return {
    gridTemplateColumns: `repeat(${Math.max(columnCount, 1)}, minmax(0, 1fr))`,
    maxWidth: "100%",
  };
};

const groupSuggestionsByPriority = (suggestions) =>
  PRIORITY_GROUPS.reduce((groups, priorityGroup) => {
    groups[priorityGroup.key] = (suggestions || []).filter(
      (item) => item.priority_level === priorityGroup.key,
    );
    return groups;
  }, {});

const DEFAULT_NEEDED_ITEMS_META = {
  source_type: "EMPTY",
  title: "Emergency Donation Needs",
  description:
    "Donation recommendations will appear when preparedness defaults, published needs, or forecast results are available.",
  notice:
    "No public donation suggestions are available yet for the active relief operations.",
  suggestions: [],
};

const normalizeNeededItemsPayload = (payload) => {
  if (payload && typeof payload === "object") {
    return {
      source_type: payload.source_type || DEFAULT_NEEDED_ITEMS_META.source_type,
      title: payload.title || DEFAULT_NEEDED_ITEMS_META.title,
      description: payload.description || DEFAULT_NEEDED_ITEMS_META.description,
      notice: payload.notice || DEFAULT_NEEDED_ITEMS_META.notice,
      suggestions: Array.isArray(payload.suggestions) ? payload.suggestions : [],
    };
  }

  return DEFAULT_NEEDED_ITEMS_META;
};

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

const HeroSection = ({ activeEvents, lastUpdatedAt }) => {
  const activeEventCount = (activeEvents || []).length;
  const hasActiveEvents = activeEventCount > 0;

  return (
    <section style={styles.hero} aria-labelledby="donor-hero-title">
      <div style={styles.heroGrid} className="donor-portal-layout">
        <div>
          <p style={styles.eyebrow}>Public In-Kind Donation Information</p>
          <h1 id="donor-hero-title" style={styles.title}>
            Support Malvar Disaster Relief Operations
          </h1>
          <p style={styles.subtitle}>
            Donors and NGOs can use this page to identify current in-kind
            donation needs, review the active relief operation, and coordinate
            support with official municipal contact channels.
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
          <p style={styles.asideLabel}>Current Relief Operations</p>
          <p style={styles.asideValue}>
            {hasActiveEvents ? formatNumber(activeEventCount) : "Monitoring"}
          </p>
          <p style={styles.sectionText}>
            {hasActiveEvents
              ? `${activeEventCount} active relief operation${
                  activeEventCount === 1 ? "" : "s"
                } currently shown.`
              : "There is currently no active disaster relief operation."}
          </p>
          <span
            style={{
              ...styles.badge,
              width: "fit-content",
              background: hasActiveEvents
                ? COLORS.dangerSoft
                : COLORS.successSoft,
              color: hasActiveEvents ? COLORS.danger : COLORS.success,
            }}
          >
            {hasActiveEvents ? (
              <FiAlertCircle size={15} />
            ) : (
              <FiCheckCircle size={15} />
            )}
            Updated {formatUpdatedAt(lastUpdatedAt)}
          </span>
        </aside>
      </div>
    </section>
  );
};

const ActiveDisastersSection = ({ events }) => {
  if (!events.length) {
    return (
      <section style={styles.section} aria-labelledby="active-event-title">
        <h2 id="active-event-title" style={styles.sectionTitle}>
          Recent Active Disaster Relief Operations
        </h2>
        <div style={{ ...styles.emptyState, marginTop: "14px" }}>
          <FiCheckCircle size={20} color={COLORS.success} aria-hidden="true" />
          <span>There is currently no active disaster relief operation.</span>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.section} aria-labelledby="active-event-title">
      <div style={styles.sectionHeader}>
        <div>
          <h2 id="active-event-title" style={styles.sectionTitle}>
            Recent Active Disaster Relief Operations
          </h2>
          <p style={styles.sectionText}>
            Public information for up to three current active relief operations.
          </p>
        </div>
      </div>

      <div style={styles.eventCardsGrid}>
        {events.map((event) => {
          const barangays = Array.isArray(event.affected_barangays)
            ? event.affected_barangays
            : [];

          return (
            <article
              key={event.public_key || event.event_code || event.title}
              style={styles.eventCard}
            >
              <div style={styles.eventCardHeader}>
                <div>
                  <h3 style={styles.eventCardTitle}>
                    {event.title || "Active disaster relief operation"}
                  </h3>
                  <p style={styles.eventCardMeta}>
                    {event.disaster_type || "Disaster event"} |{" "}
                    {formatDateRange(event.start_date, event.end_date)}
                  </p>
                </div>
                <span
                  style={{
                    ...styles.badge,
                    padding: "6px 9px",
                    background: COLORS.dangerSoft,
                    color: COLORS.danger,
                  }}
                >
                  {formatStatusLabel(event.status)}
                </span>
              </div>

              <p style={styles.eventDescription}>
                {event.description ||
                  "No public description has been recorded yet."}
              </p>

              <div
                className="donor-event-stats-grid"
                style={styles.eventStatsGrid}
              >
                <div style={styles.eventStat}>
                  <div style={styles.eventStatTop}>
                    <FiMapPin size={14} aria-hidden="true" />
                    <span style={styles.label}>Areas</span>
                  </div>
                  <p style={styles.eventStatValue}>
                    {formatNumber(event.affected_barangays_count)}
                  </p>
                  <p style={styles.eventStatLabel}>Barangays</p>
                </div>
                <div style={styles.eventStat}>
                  <div style={styles.eventStatTop}>
                    <FiHome size={14} aria-hidden="true" />
                    <span style={styles.label}>Families</span>
                  </div>
                  <p style={styles.eventStatValue}>
                    {formatNumber(event.registered_households_count)}
                  </p>
                  <p style={styles.eventStatLabel}>Households</p>
                </div>
                <div style={styles.eventStat}>
                  <div style={styles.eventStatTop}>
                    <FiUsers size={14} aria-hidden="true" />
                    <span style={styles.label}>Individuals</span>
                  </div>
                  <p style={styles.eventStatValue}>
                    {formatNumber(event.affected_individuals_count)}
                  </p>
                  <p style={styles.eventStatLabel}>People</p>
                </div>
              </div>

              <div>
                <p style={styles.label}>Affected Barangays</p>
                {barangays.length === 0 ? (
                  <p style={{ ...styles.sectionText, marginTop: "8px" }}>
                    No affected barangay is recorded for this operation.
                  </p>
                ) : (
                  <div style={styles.barangayList}>
                    {barangays.slice(0, 6).map((barangay) => (
                      <span
                        key={barangay.public_key || barangay.name}
                        style={styles.barangayChip}
                      >
                        {barangay.name}
                      </span>
                    ))}
                    {barangays.length > 6 ? (
                      <span style={styles.barangayChip}>
                        +{barangays.length - 6} more
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

const NeededItemsSection = ({ neededItems }) => {
  const suggestions = neededItems?.suggestions || [];
  const groupedSuggestions = useMemo(
    () => groupSuggestionsByPriority(suggestions),
    [suggestions],
  );
  const hasSuggestions = suggestions.length > 0;
  const isForecastSource = neededItems?.source_type === "FORECAST";

  return (
    <section style={styles.section} aria-labelledby="needed-items-title">
      <div style={styles.sectionHeader}>
        <div>
          <h2 id="needed-items-title" style={styles.sectionTitle}>
            {neededItems?.title || DEFAULT_NEEDED_ITEMS_META.title}
          </h2>
          <p style={styles.sectionText}>
            {neededItems?.description || DEFAULT_NEEDED_ITEMS_META.description}
          </p>
        </div>
      </div>

      <div style={{ ...styles.notice, marginTop: 0, marginBottom: "14px" }} role="note">
        <FiTrendingUp size={18} color={COLORS.warning} aria-hidden="true" />
        <span>
          {neededItems?.notice || DEFAULT_NEEDED_ITEMS_META.notice}
        </span>
      </div>
      {isForecastSource ? (
        <p style={{ ...styles.sectionText, marginBottom: "14px" }}>
          Priority is based on the same forecast risk level used by the Office of
          the Mayor: critical or high-risk items appear as High Priority, medium
          risk appears as Medium Priority, and lower-risk forecast needs appear
          as Low Priority.
        </p>
      ) : null}

      {!hasSuggestions ? (
        <div style={styles.emptyState}>
          <FiInfo size={20} color={COLORS.primary} aria-hidden="true" />
          <span>
            {neededItems?.notice || DEFAULT_NEEDED_ITEMS_META.notice}
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
                      const quantityValue = Number(item.suggested_quantity);
                      const hasQuantity =
                        Number.isFinite(quantityValue) && quantityValue > 0;

                      return (
                        <article
                          key={item.public_key || item.item_name}
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
                            {hasQuantity
                              ? formatNumber(quantityValue)
                              : "Preparedness Recommendation"}
                          </p>
                          <p style={styles.itemNote}>
                            {hasQuantity
                              ? `${item.unit_of_measure || "items"} suggested`
                              : item.unit_of_measure || "Preparedness item"}
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
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryTop}>
            <p style={styles.label}>Recorded Donations</p>
            <span style={styles.summaryIcon} aria-hidden="true">
              <FiCheckCircle size={20} />
            </span>
          </div>
          <p style={styles.summaryValue}>
            {formatNumber(transparencySummary?.total_donations_received)}
          </p>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryTop}>
            <p style={styles.label}>Items Received</p>
            <span style={styles.summaryIcon} aria-hidden="true">
              <FiPackage size={20} />
            </span>
          </div>
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
        <div
          className="recent-donation-grid"
          style={{
            ...styles.donationList,
            ...getRecentDonationGridStyle(recentDonations.length),
            marginTop: "12px",
          }}
        >
          {recentDonations.map((donation, index) => {
            const donationTypeIcons = getDonationTypeIcons(donation);
            const hasStackedIcons = donationTypeIcons.length > 1;

            return (
              <article
                key={donation.public_key || `${donation.donation_date}-${index}`}
                style={styles.donationCard}
              >
                <div style={styles.donationTop}>
                  <span style={styles.donationIconStack} aria-hidden="true">
                    {donationTypeIcons.map((iconType) => (
                      <span
                        key={iconType}
                        style={{
                          ...styles.donationIcon,
                          ...(hasStackedIcons
                            ? styles.donationIconCompact
                            : null),
                        }}
                      >
                        {iconType === "relief" ? (
                          <FiShoppingBag size={hasStackedIcons ? 17 : 20} />
                        ) : (
                          <FiPackage size={hasStackedIcons ? 17 : 20} />
                        )}
                      </span>
                    ))}
                  </span>
                  <div style={styles.donationBody}>
                    <h3 style={styles.donationName}>
                      {donation.donor_name}{" "}
                      <span style={styles.donorTypeText}>
                        ({donation.donor_type_label || formatStatusLabel(donation.donor_type)})
                      </span>
                    </h3>
                    <p style={styles.donationMeta}>
                      {donation.disaster_event_title || "Disaster event"} |{" "}
                      {formatDonationDateOnly(donation.donation_date)}
                    </p>
                    <p style={styles.donationSummaryText}>
                      {buildDonationSummary(donation)}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
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
            Remaining reflects available donated inventory after distribution
            and inventory adjustments.
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
                <th style={{ ...styles.th, ...styles.numericCell }}>Available</th>
              </tr>
            </thead>
            <tbody>
              {donatedItemRows.map((row) => (
                <tr key={row.public_key || row.item_name}>
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

const PortalFooter = ({ publicContactConfig }) => {
  const currentYear = new Date().getFullYear();
  const contactConfig = publicContactConfig || DEFAULT_PUBLIC_CONTACT_CONFIG;
  const dropOffConfig =
    contactConfig.drop_off || DEFAULT_PUBLIC_CONTACT_CONFIG.drop_off;
  const footerInfo = {
    systemName: contactConfig.system_name || LGU_CONTACT.systemName,
    systemSubtitle: "Disaster Relief Management System",
    municipality: contactConfig.municipality || LGU_CONTACT.municipality,
    buildingName: dropOffConfig.location_name,
    addressLines: Array.isArray(dropOffConfig.address_lines)
      ? dropOffConfig.address_lines
      : [],
    officeLines: Array.isArray(dropOffConfig.office_lines)
      ? dropOffConfig.office_lines
      : [],
    receivingHours: Array.isArray(dropOffConfig.receiving_hours)
      ? dropOffConfig.receiving_hours
      : [],
    phone: dropOffConfig.phone,
    email: dropOffConfig.email,
    mapsUrl: dropOffConfig.maps_url,
    websiteLabel: contactConfig.website || LGU_CONTACT.website,
    websiteUrl: contactConfig.website_url || LGU_CONTACT.websiteUrl,
    facebookLabel: contactConfig.facebook_label || LGU_CONTACT.facebookLabel,
    facebookUrl: contactConfig.facebook_url || LGU_CONTACT.facebookUrl,
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
      <style>{portalFooterCss}</style>
      <div style={styles.footerInner}>
        <div className="portal-footer-grid" style={styles.footerGrid}>
          <section aria-labelledby="footer-about-title" style={styles.footerColumn}>
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
              Public in-kind donation portal supporting transparent and coordinated
              disaster relief operations in Malvar, Batangas.
            </p>
          </section>

          <section
            aria-labelledby="footer-donation-coordination-title"
            style={styles.footerColumn}
          >
            <h2
              id="footer-donation-coordination-title"
              style={styles.footerColumnTitle}
            >
              Donation Coordination
            </h2>
            <div
              className="portal-footer-coordination-pair"
              style={styles.footerCoordinationPair}
            >
              <div style={styles.footerCoordinationBlock}>
                <div style={styles.footerDetailGroup}>
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
                <div style={styles.footerDetailGroup}>
                  <p style={styles.footerDetailLabel}>Receiving Hours</p>
                  <p style={styles.footerDetailValue}>
                    {footerInfo.receivingHours.map((line) => (
                      <React.Fragment key={line}>
                        {line}
                        <br />
                      </React.Fragment>
                    ))}
                  </p>
                </div>
              </div>
              <div style={styles.footerDetailGroup}>
                <p id="drop-off-title" style={styles.footerDetailLabel}>
                  Drop-off Location
                </p>
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
                {footerInfo.mapsUrl ? (
                  <a
                    href={footerInfo.mapsUrl}
                    className="portal-footer-action"
                    style={styles.footerAction}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FiMapPin size={15} aria-hidden="true" />
                    Get Directions
                  </a>
                ) : (
                  <button
                    type="button"
                    className="portal-footer-action"
                    style={{ ...styles.footerAction, ...styles.footerActionDisabled }}
                    disabled
                    aria-disabled="true"
                  >
                    <FiMapPin size={15} aria-hidden="true" />
                    Directions unavailable
                  </button>
                )}
              </div>
            </div>
          </section>

          <section aria-labelledby="footer-contact-title" style={styles.footerColumn}>
            <h2 id="footer-contact-title" style={styles.footerColumnTitle}>
              Contact Information
            </h2>
            <div
              aria-label="Contact information"
              style={styles.footerCompactContact}
            >
              <div style={styles.footerContactRow}>
                <FiPhone size={14} aria-hidden="true" />
                <span style={styles.footerContactText}>{footerInfo.phone}</span>
              </div>
              <div style={styles.footerContactRow}>
                <FiMail size={14} aria-hidden="true" />
                <span style={styles.footerContactText}>{footerInfo.email}</span>
              </div>
              {footerInfo.websiteUrl ? (
                <a
                  href={footerInfo.websiteUrl}
                  className="portal-footer-contact-link"
                  style={styles.footerContactLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FiGlobe size={14} aria-hidden="true" />
                  <span style={styles.footerContactText}>
                    {footerInfo.websiteLabel}
                  </span>
                </a>
              ) : null}
              {footerInfo.facebookUrl ? (
                <a
                  href={footerInfo.facebookUrl}
                  className="portal-footer-contact-link"
                  style={styles.footerContactLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FaFacebookF size={14} aria-hidden="true" />
                  <span style={styles.footerContactText}>
                    {footerInfo.facebookLabel}
                  </span>
                </a>
              ) : null}
            </div>
          </section>

        </div>
      </div>

      <nav
        aria-label="Footer quick links"
        style={styles.footerQuickLinksBand}
      >
        <div style={styles.footerQuickLinksInner}>
          <ul style={styles.footerHorizontalLinks}>
            {footerLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="portal-footer-link"
                  style={styles.footerLink}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="portal-footer-bottom" style={styles.footerBottom}>
        <div className="portal-footer-bottom-inner" style={styles.footerBottomInner}>
          <p style={styles.footerBottomText}>
            © {currentYear} DISTYNC - {footerInfo.municipality}
          </p>
        </div>
      </div>
    </footer>
  );
};

const DonationInformationPage = () => {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState({
    isLoading: true,
    errorMessage: "",
    activeDisasters: [],
    neededItems: DEFAULT_NEEDED_ITEMS_META,
    recentDonations: [],
    transparencySummary: {},
    publicContactConfig: DEFAULT_PUBLIC_CONTACT_CONFIG,
    lastUpdatedAt: new Date().toISOString(),
  });

  useEffect(() => {
    let isMounted = true;

    const loadDonationOverview = async ({ showLoading = false } = {}) => {
      if (showLoading) {
        setPageState((currentState) => ({
          ...currentState,
          isLoading: true,
          errorMessage: "",
        }));
      }

      try {
        const publicPortalData = await fetchDonationPortalData();

        if (!isMounted) {
          return;
        }

        const disasterEvents = Array.isArray(publicPortalData?.disaster_events)
          ? publicPortalData.disaster_events
          : [];
        const recentActiveDisasters = getRecentActiveEvents(disasterEvents);
        const forecastSuggestions = Array.isArray(
          publicPortalData?.forecast_suggestions,
        )
          ? publicPortalData.forecast_suggestions
          : [];
        const neededItems = publicPortalData?.needed_items
          ? normalizeNeededItemsPayload(publicPortalData.needed_items)
          : {
              ...DEFAULT_NEEDED_ITEMS_META,
              source_type: forecastSuggestions.length > 0 ? "FORECAST" : "EMPTY",
              title:
                forecastSuggestions.length > 0
                  ? "Forecasted Donation Needs"
                  : DEFAULT_NEEDED_ITEMS_META.title,
              suggestions: forecastSuggestions,
            };
        const recentDonations = Array.isArray(publicPortalData?.recent_donations)
          ? publicPortalData.recent_donations
          : [];
        const transparencySummary =
          publicPortalData?.transparency_summary &&
          typeof publicPortalData.transparency_summary === "object"
            ? publicPortalData.transparency_summary
            : {};
        const publicContactConfig =
          publicPortalData?.public_contact_config &&
          typeof publicPortalData.public_contact_config === "object"
            ? publicPortalData.public_contact_config
            : DEFAULT_PUBLIC_CONTACT_CONFIG;

        setPageState({
          isLoading: false,
          errorMessage: "",
          activeDisasters: recentActiveDisasters,
          neededItems,
          recentDonations,
          transparencySummary,
          publicContactConfig,
          lastUpdatedAt: getLatestTimestamp([
            ...recentActiveDisasters.map(
              (event) => event.updated_at || event.created_at,
            ),
            ...neededItems.suggestions.map((item) => item.forecasted_at),
            ...recentDonations.map((donation) => donation.donation_date),
          ]),
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (showLoading) {
          setPageState({
            isLoading: false,
            errorMessage: error.message || "Failed to load donation information.",
            activeDisasters: [],
            neededItems: DEFAULT_NEEDED_ITEMS_META,
            recentDonations: [],
            transparencySummary: {},
            publicContactConfig: DEFAULT_PUBLIC_CONTACT_CONFIG,
            lastUpdatedAt: new Date().toISOString(),
          });
          return;
        }

        setPageState((currentState) => ({
          ...currentState,
          isLoading: false,
        }));
      }
    };

    loadDonationOverview({ showLoading: true });

    const refreshTimer = window.setInterval(
      () => loadDonationOverview(),
      PUBLIC_PORTAL_REFRESH_INTERVAL_MS,
    );
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadDonationOverview();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const {
    isLoading,
    errorMessage,
    activeDisasters,
    neededItems,
    recentDonations,
    transparencySummary,
    publicContactConfig,
    lastUpdatedAt,
  } = pageState;

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
        <HeroSection activeEvents={activeDisasters} lastUpdatedAt={lastUpdatedAt} />

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
            <NeededItemsSection neededItems={neededItems} />
            <ActiveDisastersSection events={activeDisasters} />
            <TransparencySection
              recentDonations={recentDonations}
              transparencySummary={transparencySummary}
            />
            <DonationUtilizationSection
              transparencySummary={transparencySummary}
            />
          </>
        ) : null}

      </div>

      <PortalFooter publicContactConfig={publicContactConfig} />
    </main>
  );
};

export default DonationInformationPage;
