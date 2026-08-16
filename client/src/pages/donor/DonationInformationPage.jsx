import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiBarChart2,
  FiCheckCircle,
  FiChevronDown,
  FiFacebook,
  FiGlobe,
  FiInfo,
  FiMail,
  FiMapPin,
  FiPackage,
  FiPhone,
  FiRefreshCw,
  FiTrendingUp,
} from "react-icons/fi";
import {
  FaBoxOpen,
  FaCheckCircle as FaCheckCircleSolid,
  FaEnvelope,
  FaFacebookF,
  FaGlobeAsia,
  FaHome as FaHomeSolid,
  FaMapMarkedAlt,
  FaPhoneAlt,
  FaShoppingBag,
  FaUsers as FaUsersSolid,
} from "react-icons/fa";
import {
  GiClothes,
  GiFirstAidKit,
  GiOpenedFoodCan,
  GiRolledCloth,
  GiToolbox,
  GiWaterBottle,
} from "react-icons/gi";
import LoadingState from "../../components/shared/LoadingState";
import distyncLogo from "../../assets/distync-logo.png";
import distyncLogoCropped from "../../assets/distync-logo-cropped.png";
import { fetchDonationPortalData } from "../../features/donations/donationService";
import {
  formatDonationDateOnly,
} from "../../features/donations/donationFormatters";
import { getAccessMode, getEntryRouteForMode } from "../../utils/accessMode";

const COLORS = {
  cardBg: "#ffffff",
  pageBg: "#f3f7fb",
  softBg: "#eef6f1",
  border: "#d8e2ea",
  text: "#17324d",
  subtext: "#5d6f7f",
  primary: "#2f6499",
  primaryDark: "#244f78",
  logoBlue: "#4c86be",
  logoLightBlue: "#b8cff4",
  logoSyncLight: "#b8cff4",
  logoSyncMid: "#7896ca",
  logoSyncDeep: "#4b628f",
  logoSyncDark: "#24344f",
  logoGold: "#f2b84b",
  logoGoldSoft: "#fff3d2",
  danger: "#c94b4b",
  dangerSoft: "#fdecec",
  warning: "#b87516",
  warningSoft: "#fff4df",
  success: "#2e7d5b",
  successSoft: "#eaf7f0",
  neutralSoft: "#f6f9fc",
};

const PUBLIC_PORTAL_REFRESH_INTERVAL_MS = 60000;
const PUBLIC_PORTAL_INITIAL_LOADING_MIN_MS = 1450;
const HIDE_TRANSPARENCY_DATA_FOR_DESIGN_PREVIEW = false;
const HIDE_UTILIZATION_DATA_FOR_DESIGN_PREVIEW = false;

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

const DEFAULT_HIGH_PRIORITY_DONATION_GROUPS = [
  {
    title: "Ready-To-Eat-Foods",
    Icon: GiOpenedFoodCan,
    helper: "Easy-to-serve food items for immediate relief support.",
    items: [
      "Canned Goods",
      "Ready-to-Heat Foods",
      "Noodles or Cup Noodles",
      "Bread, Biscuits, and Snacks",
      "Rice",
    ],
  },
  {
    title: "Beverage and Drinking Supplies",
    Icon: GiWaterBottle,
    helper: "Safe beverage and drinking water supplies for families in evacuation or response areas.",
    items: [
      "Bottled Water",
      "Coffee Sachets",
      "Powdered Drinks",
      "Milk, Chocolate, and Cereal Drinks",
      "Nutritional Drinks or Ionized Beverages",
    ],
  },
  {
    title: "Health and Hygiene Kits",
    Icon: GiFirstAidKit,
    helper: "Basic health and sanitation supplies for affected households.",
    items: [
      "First Aid Supplies",
      "Essential Medicines",
      "Soap and Toothpaste",
      "Sanitary Pads",
      "Baby Care Items",
    ],
  },
];

const DEFAULT_MEDIUM_PRIORITY_DONATION_GROUPS = [
  {
    title: "Sleeping Mats/Blankets",
    Icon: GiRolledCloth,
    helper: "Comfort and rest supplies for families staying in evacuation areas.",
    items: [
      "Sleeping Mats",
      "Blankets",
      "Pillows",
      "Bedsheets",
      "Towels",
    ],
  },
  {
    title: "Clothing",
    Icon: GiClothes,
    helper: "Clean wearable items for displaced or affected families.",
    items: [
      "Adult Clothing",
      "Children's Clothing",
      "Undergarments",
      "Socks",
      "Raincoats or Jackets",
    ],
  },
];

const DEFAULT_LOW_PRIORITY_DONATION_GROUPS = [
  {
    title: "General Support Items",
    Icon: GiToolbox,
    helper: "Useful non-urgent supplies that can support relief operations and family recovery.",
    items: [
      "Flashlights",
      "Batteries",
      "Reusable Containers",
      "School Supplies",
      "Cleaning Supplies",
    ],
  },
];

const DEFAULT_DONATION_GROUPS_BY_PRIORITY = {
  HIGH: DEFAULT_HIGH_PRIORITY_DONATION_GROUPS,
  MEDIUM: DEFAULT_MEDIUM_PRIORITY_DONATION_GROUPS,
  LOW: DEFAULT_LOW_PRIORITY_DONATION_GROUPS,
};

const styles = {
  page: {
    width: "100%",
    minWidth: 0,
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #f7fafc 0%, #eef5fb 46%, #e7f0f7 100%)",
    padding: 0,
    boxSizing: "border-box",
    fontFamily: "Poppins, Inter, Segoe UI, sans-serif",
    color: COLORS.text,
    overflowX: "clip",
  },
  headerShell: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    width: "100%",
    margin: "0 0 22px",
    background: "rgba(255, 255, 255, 0.96)",
    borderBottom: `1px solid ${COLORS.border}`,
    boxShadow: "0 8px 22px rgba(23, 50, 77, 0.08)",
    backdropFilter: "blur(10px)",
  },
  pageInner: {
    display: "grid",
    gap: "16px",
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "0 24px",
    minWidth: 0,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "14px",
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "18px 24px",
    flexWrap: "wrap",
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
    color: "inherit",
    textDecoration: "none",
    borderRadius: "8px",
    transition: "opacity 160ms ease, outline-color 160ms ease",
  },
  brandLogo: {
    width: "64px",
    height: "64px",
    objectFit: "contain",
    flexShrink: 0,
  },
  brandTitle: {
    margin: 0,
    fontSize: "23px",
    fontWeight: 800,
    color: COLORS.text,
    lineHeight: 1,
  },
  brandSubtitle: {
    margin: "5px 0 0",
    fontSize: "13px",
    color: COLORS.subtext,
    fontWeight: 600,
  },
  topBarActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
    flexWrap: "wrap",
  },
  headerContactIconLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "38px",
    height: "38px",
    border: `1px solid ${COLORS.border}`,
    borderRadius: "999px",
    background: "#ffffff",
    color: "var(--header-contact-color, #244f78)",
    textDecoration: "none",
    flexShrink: 0,
    boxShadow: "0 8px 18px rgba(23, 50, 77, 0.07)",
    transition:
      "background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease",
  },
  section: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "8px",
    padding: "22px",
    boxShadow: "0 10px 24px rgba(23, 50, 77, 0.045)",
    minWidth: 0,
  },
  hero: {
    display: "flex",
    alignItems: "center",
    background:
      "linear-gradient(135deg, #17324d 0%, #244f78 48%, #2f6499 100%)",
    border: "1px solid rgba(23, 50, 77, 0.16)",
    borderRadius: "8px",
    minHeight: "clamp(420px, calc(100vh - 330px), 660px)",
    padding: "56px 56px",
    boxShadow: "0 18px 36px rgba(23, 50, 77, 0.16)",
    position: "relative",
    overflow: "hidden",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 360px)",
    gap: "46px",
    width: "100%",
    alignItems: "stretch",
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    maxWidth: "820px",
    alignSelf: "center",
  },
  eyebrow: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: COLORS.logoGoldSoft,
  },
  title: {
    margin: "12px 0 14px",
    fontSize: "46px",
    lineHeight: 1.08,
    fontWeight: 800,
    color: "#ffffff",
    maxWidth: "760px",
  },
  subtitle: {
    margin: 0,
    fontSize: "17px",
    color: "#dce9f3",
    lineHeight: 1.7,
    maxWidth: "780px",
  },
  notice: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    marginTop: "16px",
    padding: "13px 14px",
    borderRadius: "8px",
    background: "rgba(255, 243, 210, 0.96)",
    color: COLORS.text,
    border: `1px solid ${COLORS.logoGold}`,
    fontSize: "13px",
    lineHeight: 1.6,
  },
  heroAside: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "18px",
    justifySelf: "end",
    alignSelf: "center",
    width: "100%",
    maxWidth: "360px",
    minHeight: "178px",
    padding: "28px",
    borderRadius: "8px",
    background: "rgba(255, 255, 255, 0.96)",
    border: `1px solid ${COLORS.logoLightBlue}`,
    boxShadow: "0 14px 26px rgba(10, 29, 45, 0.16)",
    position: "relative",
    zIndex: 1,
    transition:
      "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
  },
  asideHeader: {
    display: "grid",
    gap: "18px",
    minWidth: 0,
    flex: 1,
    transformOrigin: "left center",
  },
  asideIcon: {
    width: "68px",
    height: "68px",
    borderRadius: "8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: COLORS.logoGoldSoft,
    border: `1px solid ${COLORS.logoGold}`,
    color: COLORS.primaryDark,
    flexShrink: 0,
    transition: "transform 180ms ease",
  },
  asideLabel: {
    margin: 0,
    color: COLORS.subtext,
    fontSize: "13px",
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    lineHeight: 1.35,
  },
  asideValue: {
    margin: 0,
    fontSize: "56px",
    lineHeight: 1,
    fontWeight: 800,
    color: COLORS.primaryDark,
  },
  asideLoadingValue: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "22px",
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  },
  updateBadge: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    width: "fit-content",
    margin: "24px 0 0",
    color: "#dce9f3",
    fontSize: "13px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    position: "relative",
    zIndex: 1,
  },
  updateIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: COLORS.logoGoldSoft,
    flexShrink: 0,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  collapsibleSectionSummary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer",
    listStyle: "none",
    flexWrap: "wrap",
  },
  summaryActionGroup: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  disclosureIndicator: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "30px",
    height: "30px",
    borderRadius: "999px",
    background: "#ffffff",
    border: `1px solid ${COLORS.border}`,
    color: COLORS.primaryDark,
    flexShrink: 0,
    transition:
      "transform 180ms ease, background 180ms ease, border-color 180ms ease",
  },
  collapsibleSectionBody: {
    marginTop: "16px",
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
    fontSize: "13px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  quickLinkGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "10px",
  },
  quickLink: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    minHeight: "54px",
    padding: "12px 14px",
    borderRadius: "8px",
    background: "var(--quick-link-bg, #ffffff)",
    border: `1px solid var(--quick-link-border, ${COLORS.border})`,
    color: `var(--quick-link-color, ${COLORS.text})`,
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 800,
    boxShadow: "0 8px 18px rgba(23, 50, 77, 0.045)",
    transition:
      "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, color 180ms ease, transform 180ms ease",
  },
  quickLinkLogoFrame: {
    width: "24px",
    height: "24px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  quickLinkLogo: {
    width: "28px",
    height: "28px",
    objectFit: "contain",
  },
  contentStack: {
    display: "grid",
    gap: "16px",
    minWidth: 0,
  },
  eventCardsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "14px",
    alignItems: "start",
  },
  eventCard: {
    display: "grid",
    gap: "12px",
    background: COLORS.neutralSoft,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "8px",
    padding: "16px",
    minWidth: 0,
  },
  eventDetails: {
    border: `1px solid ${COLORS.border}`,
    borderRadius: "8px",
    overflow: "hidden",
    background: COLORS.neutralSoft,
    minWidth: 0,
    transition:
      "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
  },
  eventDetailsSummary: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    alignItems: "center",
    gap: "12px",
    padding: "15px 16px",
    cursor: "pointer",
    listStyle: "none",
  },
  eventDetailsBody: {
    display: "grid",
    gap: "12px",
    padding: "0 16px 16px",
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
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
    background: "#ffffff",
    border: `1px solid ${COLORS.border}`,
    borderRadius: "8px",
    padding: "18px",
    minWidth: 0,
  },
  eventStatValue: {
    margin: "12px 0 0",
    color: COLORS.primaryDark,
    fontSize: "38px",
    lineHeight: 1,
    fontWeight: 800,
  },
  eventStatLabel: {
    margin: "8px 0 0",
    color: COLORS.subtext,
    fontSize: "12px",
    lineHeight: 1.35,
    fontWeight: 600,
  },
  eventStatIcon: {
    width: "70px",
    height: "70px",
    borderRadius: "8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eaf5f4",
    border: "1px solid #d7ebe8",
    color: COLORS.primaryDark,
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
  },
  eventStatIconMain: {
    position: "relative",
    zIndex: 1,
    color: COLORS.primaryDark,
  },
  label: {
    margin: 0,
    fontSize: "12px",
    color: COLORS.subtext,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  eventBarangayBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    padding: "8px 11px",
    borderRadius: "999px",
    background: "#eaf5f4",
    border: "1px solid #d7ebe8",
    color: COLORS.primaryDark,
    fontSize: "13px",
    lineHeight: 1,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  barangayList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "10px",
  },
  barangayPanel: {
    background: "#ffffff",
    border: "1px solid #d7ebe8",
    borderLeft: `4px solid ${COLORS.primary}`,
    borderRadius: "8px",
    padding: "14px",
  },
  barangayHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  barangayTitleGroup: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },
  barangayTitleIcon: {
    width: "34px",
    height: "34px",
    borderRadius: "8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eaf5f4",
    border: "1px solid #d7ebe8",
    color: COLORS.primaryDark,
    flexShrink: 0,
  },
  barangayCount: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    borderRadius: "999px",
    padding: "6px 10px",
    background: "#eaf5f4",
    border: "1px solid #d7ebe8",
    color: COLORS.primaryDark,
    fontWeight: 800,
  },
  barangayCountValue: {
    fontSize: "15px",
    lineHeight: 1,
  },
  barangayCountLabel: {
    fontSize: "11px",
    lineHeight: 1,
    color: COLORS.subtext,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  barangayChip: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "8px",
    padding: "7px 10px",
    background: "#f7fbfb",
    border: "1px solid #d7ebe8",
    color: COLORS.text,
    fontSize: "12px",
    lineHeight: 1.2,
    fontWeight: 700,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "14px",
  },
  summaryCard: {
    background: "#ffffff",
    border: `1px solid ${COLORS.border}`,
    borderRadius: "8px",
    padding: "18px",
    minWidth: 0,
    position: "relative",
    boxShadow: "0 8px 18px rgba(23, 50, 77, 0.04)",
    transition:
      "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
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
    borderRadius: "8px",
    background: COLORS.softBg,
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
    borderRadius: "8px",
    overflow: "hidden",
    background: "#fff",
    transition:
      "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
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
    borderRadius: "8px",
    padding: "14px",
    border: `1px solid ${COLORS.border}`,
    background: COLORS.neutralSoft,
    minWidth: 0,
  },
  forecastTableWrap: {
    overflowX: "auto",
    border: `1px solid ${COLORS.border}`,
    borderRadius: "8px",
    margin: "0 16px 16px",
  },
  forecastTable: {
    width: "100%",
    minWidth: "360px",
    borderCollapse: "collapse",
  },
  forecastTh: {
    background: "#e6f0fb",
    color: COLORS.primaryDark,
  },
  forecastItemCell: {
    fontWeight: 800,
  },
  defaultNeedCard: {
    borderRadius: "8px",
    padding: "16px",
    border: `1px solid ${COLORS.border}`,
    background: "#ffffff",
    minWidth: 0,
    boxShadow: "0 8px 18px rgba(23, 50, 77, 0.04)",
  },
  itemTitle: {
    margin: 0,
    color: COLORS.text,
    fontSize: "16px",
    lineHeight: 1.35,
    fontWeight: 800,
  },
  defaultNeedTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
  },
  defaultNeedTitleIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "30px",
    height: "30px",
    borderRadius: "8px",
    background: COLORS.softBg,
    color: COLORS.primaryDark,
    flexShrink: 0,
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
  defaultNeedList: {
    display: "grid",
    gap: "8px",
    margin: "14px 0 0",
    padding: 0,
    listStyle: "none",
  },
  defaultNeedListItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: COLORS.text,
    fontSize: "13px",
    lineHeight: 1.45,
    fontWeight: 600,
  },
  defaultNeedBullet: {
    width: "6px",
    height: "6px",
    borderRadius: "999px",
    background: COLORS.primary,
    flexShrink: 0,
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
    borderRadius: "8px",
    padding: "14px",
    minWidth: 0,
    transition:
      "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
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
    borderRadius: "8px",
    background: "#ffffff",
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
    borderRadius: "8px",
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
    borderRadius: "8px",
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
    borderRadius: "8px",
    color: COLORS.subtext,
    fontSize: "14px",
    lineHeight: 1.6,
  },
  footer: {
    width: "100%",
    margin: "24px 0 0",
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
    padding: "24px 28px 20px",
    boxSizing: "border-box",
  },
  footerGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 0.34fr)",
    columnGap: "38px",
    rowGap: "20px",
    alignItems: "center",
  },
  footerColumn: {
    minWidth: 0,
  },
  footerPrimaryColumn: {
    display: "grid",
    gap: "14px",
    minWidth: 0,
  },
  footerBrand: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    minWidth: 0,
  },
  footerLogoFrame: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "96px",
    height: "96px",
    borderRadius: "8px",
    background: COLORS.logoGoldSoft,
    border: `1px solid ${COLORS.logoGold}`,
    boxShadow: "0 10px 22px rgba(9, 26, 44, 0.18)",
    flexShrink: 0,
    overflow: "hidden",
  },
  footerLogo: {
    width: "92px",
    height: "92px",
    objectFit: "contain",
    transform: "translateX(3px)",
  },
  footerBrandCopy: {
    minWidth: 0,
  },
  footerColumnTitle: {
    margin: "0 0 7px",
    color: "#ffffff",
    fontSize: "14px",
    lineHeight: 1.3,
    fontWeight: 800,
  },
  footerTitleText: {
    margin: 0,
    color: "#ffffff",
    fontSize: "21px",
    lineHeight: 1,
    fontWeight: 800,
  },
  footerSystemLine: {
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
    flexWrap: "wrap",
    margin: 0,
  },
  footerSubtitleText: {
    display: "inline",
    margin: 0,
    color: "#d8e6f4",
    fontSize: "13px",
    lineHeight: 1.4,
    fontWeight: 400,
  },
  footerText: {
    margin: "8px 0 0",
    color: "#d8e6f4",
    fontSize: "13px",
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
  footerCoordinationSection: {
    paddingTop: "14px",
    borderTop: "1px solid rgba(255, 255, 255, 0.14)",
  },
  footerCoordinationBlock: {
    display: "grid",
    gap: "13px",
  },
  footerCoordinationPair: {
    display: "grid",
    gridTemplateColumns: "max-content max-content minmax(0, 300px)",
    columnGap: "48px",
    rowGap: "12px",
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
    fontWeight: 800,
  },
  footerDetailValue: {
    margin: 0,
    color: "#d8e6f4",
    fontSize: "13px",
    lineHeight: 1.42,
    fontWeight: 400,
    overflowWrap: "anywhere",
  },
  footerCompactContact: {
    display: "grid",
    gap: "9px",
    marginTop: "9px",
  },
  footerContactColumn: {
    alignSelf: "center",
    paddingLeft: "26px",
    borderLeft: "1px solid rgba(255, 255, 255, 0.16)",
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
  footerDirectionsLink: {
    marginTop: "3px",
    paddingTop: "11px",
    borderTop: "1px solid rgba(255, 255, 255, 0.14)",
    color: COLORS.logoGoldSoft,
    fontWeight: 700,
  },
  footerTaglineBand: {
    borderTop: "1px solid rgba(255, 255, 255, 0.14)",
    background: "rgba(9, 26, 44, 0.18)",
  },
  footerTaglineInner: {
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "13px 28px",
    boxSizing: "border-box",
  },
  footerTaglineText: {
    margin: 0,
    color: COLORS.logoGoldSoft,
    fontSize: "15px",
    lineHeight: 1.5,
    fontWeight: 600,
    textAlign: "center",
    overflowWrap: "anywhere",
  },
  footerTaglineEmphasis: {
    fontStyle: "italic",
  },
  footerBottom: {
    background: "rgba(9, 26, 44, 0.5)",
    borderTop: "1px solid rgba(255, 255, 255, 0.16)",
  },
  footerBottomInner: {
    display: "flex",
    justifyContent: "center",
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
    width: "100%",
    color: "#d8e6f4",
    fontSize: "12px",
    lineHeight: 1.5,
    fontWeight: 400,
    textAlign: "center",
    overflowWrap: "anywhere",
  },
};

const portalFooterCss = `
  .donor-utilization-summary::-webkit-details-marker,
  .donor-event-details-summary::-webkit-details-marker,
  .donor-needed-items-summary::-webkit-details-marker {
    display: none;
  }

  details[open] > summary .donor-portal-disclosure-indicator {
    transform: rotate(180deg);
  }

  summary:hover .donor-portal-disclosure-indicator {
    background: #eef6f1;
    border-color: #b8cff4;
  }

  .donor-portal-anchor-target {
    scroll-margin-top: 140px;
  }

  .donor-portal-quick-link.is-hovered-quick-link:hover {
    --quick-link-bg: var(--quick-link-hover-bg);
    --quick-link-border: var(--quick-link-hover-border);
    --quick-link-color: var(--quick-link-hover-color);
    text-shadow: 0 1px 1px var(--quick-link-hover-text-shadow);
    transform: translateY(-1px);
  }

  .donor-portal-quick-link.is-hovered-quick-link:hover {
    box-shadow: 0 12px 24px var(--quick-link-hover-shadow);
  }

  .donor-portal-hero-eyebrow,
  .donor-portal-hero-title,
  .donor-portal-hero-subtitle,
  .donor-portal-update-meta {
    animation: donorPortalHeroCopyIn 0.68s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .donor-portal-hero-eyebrow {
    animation-delay: 0.08s;
  }

  .donor-portal-hero-title {
    animation-delay: 0.18s;
  }

  .donor-portal-hero-subtitle {
    animation-delay: 0.28s;
  }

  .donor-portal-update-meta {
    animation-delay: 0.38s;
  }

  .donor-portal-quick-link.is-intro-quick-link {
    animation: donorPortalQuickLinkIntro 0.74s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
    animation-delay: var(--quick-link-intro-delay);
  }

  .donor-portal-quick-link svg {
    color: currentColor;
    flex-shrink: 0;
    transition: color 180ms ease, transform 180ms ease;
  }

  .donor-portal-content-stack {
    animation: donorPortalContentFadeIn 1.15s cubic-bezier(0.2, 0.8, 0.2, 1) 0.75s both;
  }

  .donor-portal-data-resolved {
    animation: donorPortalDataResolve 0.98s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }

  .donor-portal-icon-resolved {
    animation: donorPortalResolveSpin 1.35s linear both;
  }

  .donor-portal-quick-link:focus-visible {
    outline: 3px solid rgba(47, 100, 153, 0.26);
    outline-offset: 3px;
  }

  .donor-portal-update-meta.is-loading .donor-portal-update-icon {
    animation: donorPortalLoadingSpin 0.9s linear infinite;
  }

  .donor-portal-update-meta:hover .donor-portal-update-icon-glyph {
    animation: donorPortalSyncSpin 0.72s ease-in-out;
  }

  .donor-portal-update-meta:hover .donor-portal-update-text-label {
    animation: donorPortalUpdateTextLift 0.72s ease-in-out;
  }

  .donor-portal-update-icon,
  .donor-portal-update-text {
    display: inline-flex;
    align-items: center;
  }

  .donor-portal-update-icon-glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transform-origin: center;
  }

  .donor-portal-status-icon-glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    line-height: 1;
  }

  .donor-portal-status-icon-glyph svg {
    display: block;
    transform-box: fill-box;
    transform-origin: center;
  }

  .donor-portal-status-icon-glyph.is-resolved svg {
    animation: donorPortalStatusIconFadeIn 0.42s ease-out both;
  }

  .donor-portal-update-text-label {
    display: inline-flex;
    align-items: center;
  }

  .donor-portal-status-card {
    animation: donorPortalStatusSettle 0.74s cubic-bezier(0.2, 0.8, 0.2, 1) 0.28s both;
  }

  .donor-portal-status-card:hover {
    border-color: #f2b84b;
    box-shadow: 0 18px 30px rgba(10, 29, 45, 0.2);
    transform: translateY(-2px);
  }

  .donor-portal-status-card:hover .donor-portal-status-copy {
    animation: donorPortalStatusCopyLift 0.58s ease-in-out;
  }

  .donor-portal-status-card:hover .donor-portal-status-icon-glyph {
    animation: donorPortalStatusShake 0.52s ease-in-out;
  }

  .donor-portal-card-hover:hover,
  .donor-portal-card-hover:focus-within {
    border-color: #b8cff4;
    box-shadow: 0 12px 24px rgba(23, 50, 77, 0.08);
    transform: translateY(-2px);
  }

  .donor-portal-status-card.is-loading .donor-portal-status-icon-glyph svg,
  .donor-portal-status-loading-icon {
    animation: donorPortalLoadingSpin 0.9s linear infinite;
  }

  @keyframes donorPortalSyncSpin {
    from {
      transform: rotate(0deg);
    }

    to {
      transform: rotate(360deg);
    }
  }

  @keyframes donorPortalHeroCopyIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes donorPortalQuickLinkIntro {
    0%,
    100% {
      background: #ffffff;
      border-color: #d8e2ea;
      color: #17324d;
      box-shadow: 0 8px 18px rgba(23, 50, 77, 0.045);
      transform: translateY(0) scale(1);
    }

    36%,
    68% {
      background: var(--quick-link-hover-bg);
      border-color: var(--quick-link-hover-border);
      color: var(--quick-link-hover-color);
      box-shadow: 0 12px 24px var(--quick-link-hover-shadow);
      transform: translateY(-3px) scale(1.012);
    }
  }

  @keyframes donorPortalContentFadeIn {
    from {
      opacity: 0;
      transform: translateY(16px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes donorPortalDataResolve {
    from {
      opacity: 0;
      transform: translateY(6px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes donorPortalStatusIconFadeIn {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  @keyframes donorPortalResolveSpin {
    0% {
      opacity: 0.78;
      transform: rotate(-180deg) scale(0.96);
    }

    84% {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }

    100% {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }
  }

  @keyframes donorPortalUpdateTextLift {
    0%,
    100% {
      transform: translateY(0);
    }

    42% {
      transform: translateY(-2px);
    }

    68% {
      transform: translateY(1px);
    }
  }

  @keyframes donorPortalStatusSettle {
    0% {
      opacity: 0;
      transform: translateY(10px) scale(0.98);
    }

    58% {
      opacity: 1;
      transform: translateY(-2px) scale(1.01);
    }

    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes donorPortalStatusCopyLift {
    0%,
    100% {
      transform: translateY(0) scale(1);
    }

    28% {
      transform: translateY(-2px) scale(1.01);
    }

    58% {
      transform: translateY(1px) scale(1);
    }
  }

  @keyframes donorPortalStatusShake {
    0%,
    100% {
      transform: translateX(0) rotate(0deg);
    }

    22% {
      transform: translateX(-1px) rotate(-5deg);
    }

    46% {
      transform: translateX(2px) rotate(4deg);
    }

    70% {
      transform: translateX(-1px) rotate(-2deg);
    }
  }

  @keyframes donorPortalLoadingSpin {
    from {
      transform: rotate(0deg);
    }

    to {
      transform: rotate(360deg);
    }
  }

  .donor-portal-header-action:hover {
    background: #fff3d2;
    border-color: #f2b84b;
    transform: translateY(-1px);
  }

  .donor-portal-brand-link:hover {
    opacity: 0.84;
  }

  .portal-footer-contact-link:hover {
    color: #ffffff;
    transform: translateX(3px);
    text-decoration: underline;
  }

  .donor-portal-brand-link:focus-visible,
  .donor-portal-header-action:focus-visible {
    outline: 3px solid rgba(47, 100, 153, 0.28);
    outline-offset: 3px;
  }

  .portal-footer-contact-link:focus-visible {
    outline: 3px solid rgba(255, 255, 255, 0.42);
    outline-offset: 3px;
  }

  @media (max-width: 1180px) {
    .donor-portal-hero {
      padding: 42px 34px !important;
    }

    .donor-portal-hero-title {
      font-size: 40px !important;
    }

    .donor-portal-quick-links {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }

    .portal-footer-grid {
      grid-template-columns: 1fr !important;
      column-gap: 24px !important;
    }

    .portal-footer-contact {
      padding-left: 0 !important;
      border-left: none !important;
      padding-top: 16px !important;
      border-top: 1px solid rgba(255, 255, 255, 0.14) !important;
    }

    .portal-footer-coordination-pair {
      grid-template-columns: max-content max-content minmax(0, 300px) !important;
      column-gap: 48px !important;
      row-gap: 13px !important;
    }

  }

  @media (prefers-reduced-motion: reduce) {
    .donor-portal-quick-link,
    .donor-portal-quick-link:hover,
    .donor-portal-quick-link.is-hovered-quick-link,
    .donor-portal-card-hover,
    .donor-portal-content-stack,
    .donor-portal-data-resolved,
    .donor-portal-icon-resolved,
    .donor-portal-hero-eyebrow,
    .donor-portal-hero-title,
    .donor-portal-hero-subtitle,
    .donor-portal-status-card,
    .donor-portal-status-card:hover .donor-portal-status-copy,
    .donor-portal-status-card:hover .donor-portal-status-icon-glyph,
    .donor-portal-status-card.is-loading .donor-portal-status-icon-glyph svg,
    .donor-portal-status-icon-glyph.is-resolved svg,
    .donor-portal-status-loading-icon,
    .donor-portal-update-meta.is-loading .donor-portal-update-icon,
    .donor-portal-update-meta:hover .donor-portal-update-icon-glyph,
    .donor-portal-update-meta:hover .donor-portal-update-text-label {
      animation: none;
    }

    .donor-portal-card-hover,
    .donor-portal-card-hover:hover,
    .donor-portal-card-hover:focus-within {
      transition: none;
      transform: none;
    }
  }

  @media (max-width: 640px) {
    .donor-portal-page {
      padding: 0 !important;
    }

    .donor-portal-page-inner {
      padding-left: 14px !important;
      padding-right: 14px !important;
    }

    .donor-portal-header-shell {
      margin-bottom: 16px !important;
    }

    .donor-portal-anchor-target {
      scroll-margin-top: 170px;
    }

    .donor-portal-topbar {
      align-items: flex-start !important;
      padding: 14px !important;
    }

    .donor-portal-topbar-actions {
      width: 100% !important;
      justify-content: space-between !important;
    }

    .portal-footer-brand {
      align-items: flex-start !important;
      flex-direction: column !important;
    }

    .donor-portal-hero {
      min-height: auto !important;
      padding: 22px !important;
    }

    .donor-portal-hero-title {
      font-size: 30px !important;
    }

    .donor-portal-update-meta {
      width: 100% !important;
      margin-left: 0 !important;
      white-space: normal !important;
    }

    .donor-portal-quick-links {
      grid-template-columns: 1fr !important;
    }

    .donor-event-stats-grid {
      grid-template-columns: 1fr !important;
    }

    .donor-event-details-summary {
      grid-template-columns: 1fr !important;
    }

    .donor-event-barangay-badge {
      width: fit-content !important;
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

  details[open] .donor-event-barangay-badge {
    display: none !important;
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

const isActiveDisasterStatus = (status) => {
  const normalizedStatus = String(status || "").toUpperCase();

  return normalizedStatus === "ACTIVE" || normalizedStatus === "ONGOING";
};

const isCurrentActiveDisasterEvent = (event, todayTime) => {
  const startTime = getDateOnlyTime(event?.start_date);
  const endTime = getDateOnlyTime(event?.end_date);

  return (
    isActiveDisasterStatus(event?.status) &&
    (startTime === null || startTime <= todayTime) &&
    (endTime === null || endTime >= todayTime)
  );
};

const sortDisasterEventsByRecency = (left, right) => {
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
};

const getActiveDisasterEventsForPortal = (events) => {
  const today = new Date();
  const todayTime = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  const disasterEvents = [...(events || [])];
  const currentActiveEvents = disasterEvents
    .filter((event) => isCurrentActiveDisasterEvent(event, todayTime))
    .sort(sortDisasterEventsByRecency);

  if (currentActiveEvents.length > 0) {
    return {
      events: currentActiveEvents,
      isShowingRecentFallback: false,
    };
  }

  return {
    events: disasterEvents
      .filter((event) => {
        const startTime = getDateOnlyTime(event?.start_date);

        return (
          isActiveDisasterStatus(event?.status) &&
          (startTime === null || startTime <= todayTime)
        );
      })
      .sort(sortDisasterEventsByRecency)
      .slice(0, 3),
    isShowingRecentFallback: true,
  };
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

const NEEDED_ITEMS_COPY_OVERRIDES = {
  "Suggested donation quantities are generated using the system's forecasting module based on disaster impact, affected population, historical relief distribution, and inventory data. These values are recommendations only and may change when a new forecast is generated.":
    "Forecasted quantities are estimates and may change after new updates.",
  "Displayed forecasted quantities are recommendations only and may change as disaster conditions, affected population, distribution activity, and inventory levels are updated.":
    "Forecasted quantities are estimates and may change after new updates.",
  "These recommendations are based on the municipality's standard disaster preparedness guidelines while operational data is still being collected.":
    "Based on Malvar's standard disaster preparedness guidelines.",
  "These items are preparedness recommendations, not forecast quantities. They help donors identify commonly needed relief goods before enough operational data is available for forecasting.":
    "Preparedness guide only; actual needs may change as operations update.",
};

const normalizeNeededItemsCopy = (text) =>
  NEEDED_ITEMS_COPY_OVERRIDES[text] || text;

const DEFAULT_NEEDED_ITEMS_META = {
  source_type: "EMPTY",
  title: "Emergency Donation Needs",
  description:
    "Common relief goods recommended for emergency preparedness.",
  notice:
    "Actual needs may change as relief operations update.",
  suggestions: [],
};

const normalizeNeededItemsPayload = (payload) => {
  if (payload && typeof payload === "object") {
    return {
      source_type: payload.source_type || DEFAULT_NEEDED_ITEMS_META.source_type,
      title: payload.title || DEFAULT_NEEDED_ITEMS_META.title,
      description: normalizeNeededItemsCopy(
        payload.description || DEFAULT_NEEDED_ITEMS_META.description,
      ),
      notice: normalizeNeededItemsCopy(
        payload.notice || DEFAULT_NEEDED_ITEMS_META.notice,
      ),
      suggestions: Array.isArray(payload.suggestions) ? payload.suggestions : [],
    };
  }

  return DEFAULT_NEEDED_ITEMS_META;
};

const getGmailComposeUrl = (email) =>
  email ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}` : "";

const getPhoneHref = (phone) =>
  phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "";

const TopBar = ({ publicContactConfig }) => {
  const contactConfig = publicContactConfig || DEFAULT_PUBLIC_CONTACT_CONFIG;
  const dropOffConfig =
    contactConfig.drop_off || DEFAULT_PUBLIC_CONTACT_CONFIG.drop_off;
  const entryRoute = getEntryRouteForMode(getAccessMode());
  const contactLinks = [
    {
      label: `Call ${dropOffConfig.phone || "the donation coordination desk"}`,
      href: getPhoneHref(dropOffConfig.phone),
      Icon: FaPhoneAlt,
      color: COLORS.logoSyncLight,
    },
    {
      label: `Email ${dropOffConfig.email || "the donation coordination desk"}`,
      href: getGmailComposeUrl(dropOffConfig.email),
      Icon: FaEnvelope,
      color: COLORS.logoSyncMid,
      opensNewTab: true,
    },
    {
      label: "Open LGU website",
      href: contactConfig.website_url || LGU_CONTACT.websiteUrl,
      Icon: FaGlobeAsia,
      color: COLORS.logoSyncDeep,
      opensNewTab: true,
    },
    {
      label: "Open Facebook page",
      href: contactConfig.facebook_url || LGU_CONTACT.facebookUrl,
      Icon: FaFacebookF,
      color: COLORS.logoSyncDark,
      opensNewTab: true,
    },
  ].filter((link) => link.href);

  return (
    <div className="donor-portal-header-shell" style={styles.headerShell}>
      <header className="donor-portal-topbar" style={styles.topBar}>
        <Link
          to={entryRoute}
          className="donor-portal-brand-link"
          style={styles.brandWrap}
          aria-label="Return to DISTYNC login page"
          title="Return to DISTYNC login page"
        >
          <img src={distyncLogoCropped} alt="DISTYNC logo" style={styles.brandLogo} />
          <div>
            <p style={styles.brandTitle}>DISTYNC</p>
            <p style={styles.brandSubtitle}>Disaster Relief Management</p>
          </div>
        </Link>

        <div className="donor-portal-topbar-actions" style={styles.topBarActions}>
          {contactLinks.map(({ label, href, Icon, color, opensNewTab }) => (
            <a
              key={label}
              href={href}
              className="donor-portal-header-action"
              style={{
                ...styles.headerContactIconLink,
                "--header-contact-color": color,
              }}
              aria-label={label}
              title={label}
              target={opensNewTab ? "_blank" : undefined}
              rel={opensNewTab ? "noopener noreferrer" : undefined}
            >
              <Icon size={17} aria-hidden="true" />
            </a>
          ))}
        </div>
      </header>
    </div>
  );
};

const HeroSection = ({ activeEvents, lastUpdatedAt, isLoading }) => {
  const activeEventCount = (activeEvents || []).length;
  const hasActiveEvents = activeEventCount > 0;
  const updateLabel =
    isLoading && !lastUpdatedAt
      ? "Checking latest data..."
      : `Latest data update: ${formatUpdatedAt(lastUpdatedAt)}`;
  const statusValue = isLoading
    ? (
        <span style={styles.asideLoadingValue}>
          <FiRefreshCw
            className="donor-portal-status-loading-icon"
            size={20}
            aria-hidden="true"
          />
          Updating
        </span>
      )
    : hasActiveEvents
      ? formatNumber(activeEventCount)
      : "Monitoring";
  const StatusIcon = isLoading ? FiRefreshCw : FiAlertTriangle;

  return (
    <section
      className="donor-portal-hero"
      style={styles.hero}
      aria-labelledby="donor-hero-title"
    >
      <div style={styles.heroGrid} className="donor-portal-layout">
        <div style={styles.heroContent}>
          <p className="donor-portal-hero-eyebrow" style={styles.eyebrow}>
            Public In-Kind Donation Information
          </p>
          <h1
            id="donor-hero-title"
            className="donor-portal-hero-title"
            style={styles.title}
          >
            Support Malvar Disaster Relief Operations
          </h1>
          <p className="donor-portal-hero-subtitle" style={styles.subtitle}>
            View current needs, active operations, and official drop-off details.
          </p>
          <p
            className={`donor-portal-update-meta${isLoading ? " is-loading" : ""}`}
            style={styles.updateBadge}
            title="Latest data update"
          >
            <span
              key={isLoading ? "update-icon-loading" : "update-icon-ready"}
              className={`donor-portal-update-icon${
                !isLoading ? " donor-portal-icon-resolved" : ""
              }`}
              style={styles.updateIcon}
              aria-hidden="true"
            >
              <span className="donor-portal-update-icon-glyph">
                <FiRefreshCw size={15} />
              </span>
            </span>
            <span
              key={isLoading ? "checking-latest-data" : "latest-data-ready"}
              className={`donor-portal-update-text${
                !isLoading ? " donor-portal-data-resolved" : ""
              }`}
            >
              <span className="donor-portal-update-text-label">
                {updateLabel}
              </span>
            </span>
          </p>
        </div>

        <aside
          className={`donor-portal-status-card${isLoading ? " is-loading" : ""}`}
          style={styles.heroAside}
          aria-label={isLoading ? "Current portal status loading" : "Current portal status"}
          aria-busy={isLoading ? "true" : undefined}
        >
          <div className="donor-portal-status-copy" style={styles.asideHeader}>
            <p style={styles.asideLabel}>Current Relief Operations</p>
            <p
              key={isLoading ? "status-loading" : "status-ready"}
              className={!isLoading ? "donor-portal-data-resolved" : undefined}
              style={styles.asideValue}
            >
              {statusValue}
            </p>
          </div>
          <span
            key={isLoading ? "status-icon-loading" : "status-icon-ready"}
            className="donor-portal-status-icon"
            style={styles.asideIcon}
            aria-hidden="true"
          >
            <span
              className={`donor-portal-status-icon-glyph${
                !isLoading ? " is-resolved" : ""
              }`}
            >
              <StatusIcon size={28} />
            </span>
          </span>
        </aside>
      </div>
    </section>
  );
};

const QuickLinksSection = () => {
  const introTimeoutRef = useRef(null);
  const [hoveredQuickLinkIndex, setHoveredQuickLinkIndex] = useState(null);
  const [isIntroActive, setIsIntroActive] = useState(true);
  const quickLinks = [
    {
      href: "#needed-items-title",
      label: "Needed Items",
      icon: <FiPackage size={18} aria-hidden="true" />,
      hoverBg: "#cfe0ff",
      hoverBorder: "#a8c4f4",
      hoverColor: "#17324d",
      hoverShadow: "rgba(76, 134, 190, 0.16)",
      hoverTextShadow: "rgba(255, 255, 255, 0.45)",
    },
    {
      href: "#active-event-title",
      label: "Active Operations",
      icon: <FiAlertCircle size={18} aria-hidden="true" />,
      hoverBg: "#b9d3f5",
      hoverBorder: "#8fb5e5",
      hoverColor: "#17324d",
      hoverShadow: "rgba(76, 112, 160, 0.18)",
      hoverTextShadow: "rgba(255, 255, 255, 0.36)",
    },
    {
      href: "#transparency-title",
      label: "Transparency",
      icon: <FiBarChart2 size={18} aria-hidden="true" />,
      hoverBg: "#a9c3e8",
      hoverBorder: "#7fa3d2",
      hoverColor: "#17324d",
      hoverShadow: "rgba(57, 82, 120, 0.2)",
      hoverTextShadow: "rgba(255, 255, 255, 0.3)",
    },
    {
      href: "#footer-about-title",
      label: "About DISTYNC",
      icon: (
        <span style={styles.quickLinkLogoFrame} aria-hidden="true">
          <img src={distyncLogoCropped} alt="" style={styles.quickLinkLogo} />
        </span>
      ),
      hoverBg: "#8fa7ca",
      hoverBorder: "#6f89b0",
      hoverColor: "#ffffff",
      hoverShadow: "rgba(34, 48, 72, 0.22)",
      hoverTextShadow: "rgba(20, 35, 55, 0.24)",
    },
  ];

  useEffect(() => {
    return () => {
      if (introTimeoutRef.current) {
        clearTimeout(introTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    introTimeoutRef.current = window.setTimeout(() => {
      setIsIntroActive(false);
      introTimeoutRef.current = null;
    }, quickLinks.length * 140 + 900);
  }, [quickLinks.length]);

  const handleQuickLinkPointerEnter = (index) => {
    if (introTimeoutRef.current) {
      clearTimeout(introTimeoutRef.current);
      introTimeoutRef.current = null;
    }

    setIsIntroActive(false);
    setHoveredQuickLinkIndex(index);
  };

  const clearHoveredQuickLink = () => {
    setHoveredQuickLinkIndex(null);
  };

  return (
    <nav aria-label="Donor portal sections">
      <div
        className="donor-portal-quick-links"
        onPointerLeave={clearHoveredQuickLink}
        style={styles.quickLinkGrid}
      >
        {quickLinks.map((link, index) => (
          <a
            key={link.href}
            href={link.href}
            className={`donor-portal-quick-link${
              isIntroActive ? " is-intro-quick-link" : ""
            }${
              hoveredQuickLinkIndex === index
                ? " is-hovered-quick-link"
                : ""
            }`}
            onPointerEnter={() => handleQuickLinkPointerEnter(index)}
            style={{
              ...styles.quickLink,
              "--quick-link-intro-delay": `${index * 140 + 160}ms`,
              "--quick-link-hover-bg": link.hoverBg,
              "--quick-link-hover-border": link.hoverBorder,
              "--quick-link-hover-color": link.hoverColor,
              "--quick-link-hover-shadow": link.hoverShadow,
              "--quick-link-hover-text-shadow": link.hoverTextShadow,
            }}
          >
            <span>{link.label}</span>
            {link.icon}
          </a>
        ))}
      </div>
    </nav>
  );
};

const ActiveDisastersSection = ({ events, isShowingRecentFallback }) => {
  const sectionTitle = isShowingRecentFallback
    ? "Recent Active Disaster Relief Operations"
    : "Active Disaster Relief Operations";

  if (!events.length) {
    return (
      <section style={styles.section} aria-labelledby="active-event-title">
        <h2
          id="active-event-title"
          className="donor-portal-anchor-target"
          style={styles.sectionTitle}
        >
          {sectionTitle}
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
          <h2
            id="active-event-title"
            className="donor-portal-anchor-target"
            style={styles.sectionTitle}
          >
            {sectionTitle}
          </h2>
        </div>
      </div>

      <div style={styles.eventCardsGrid}>
        {events.map((event, eventIndex) => {
          const barangays = Array.isArray(event.affected_barangays)
            ? event.affected_barangays
            : [];
          const barangayCount =
            barangays.length || Number(event.affected_barangays_count || 0);

          return (
            <details
              key={event.public_key || event.event_code || event.title}
              style={styles.eventDetails}
              open={events.length === 1}
              className="donor-portal-card-hover"
            >
              <summary
                className="donor-event-details-summary"
                style={styles.eventDetailsSummary}
              >
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
                  className="donor-event-barangay-badge"
                  style={styles.eventBarangayBadge}
                >
                  <FaMapMarkedAlt size={14} aria-hidden="true" />
                  {formatNumber(barangayCount)} barangay
                  {barangayCount === 1 ? "" : "s"}
                </span>
                <span
                  className="donor-portal-disclosure-indicator"
                  style={styles.disclosureIndicator}
                  aria-hidden="true"
                >
                  <FiChevronDown size={16} />
                </span>
              </summary>

              <div style={styles.eventDetailsBody}>
                <div
                  className="donor-event-stats-grid"
                  style={styles.eventStatsGrid}
                >
                  <div style={styles.eventStat}>
                    <div>
                      <span style={styles.label}>Areas</span>
                      <p style={styles.eventStatValue}>
                        {formatNumber(event.affected_barangays_count)}
                      </p>
                      <p style={styles.eventStatLabel}>Barangays</p>
                    </div>
                    <span style={styles.eventStatIcon} aria-hidden="true">
                      <FaMapMarkedAlt size={30} style={styles.eventStatIconMain} />
                    </span>
                  </div>
                  <div style={styles.eventStat}>
                    <div>
                      <span style={styles.label}>Families</span>
                      <p style={styles.eventStatValue}>
                        {formatNumber(event.registered_households_count)}
                      </p>
                      <p style={styles.eventStatLabel}>Households</p>
                    </div>
                    <span style={styles.eventStatIcon} aria-hidden="true">
                      <FaHomeSolid size={30} style={styles.eventStatIconMain} />
                    </span>
                  </div>
                  <div style={styles.eventStat}>
                    <div>
                      <span style={styles.label}>Individuals</span>
                      <p style={styles.eventStatValue}>
                        {formatNumber(event.affected_individuals_count)}
                      </p>
                      <p style={styles.eventStatLabel}>People</p>
                    </div>
                    <span style={styles.eventStatIcon} aria-hidden="true">
                      <FaUsersSolid size={30} style={styles.eventStatIconMain} />
                    </span>
                  </div>
                </div>

                <div style={styles.barangayPanel}>
                  <div style={styles.barangayHeader}>
                    <div style={styles.barangayTitleGroup}>
                      <span style={styles.barangayTitleIcon} aria-hidden="true">
                        <FaMapMarkedAlt size={17} />
                      </span>
                      <p style={styles.label}>Affected Barangays</p>
                    </div>
                    {barangays.length > 0 ? (
                      <span style={styles.barangayCount}>
                        <span style={styles.barangayCountValue}>
                          {formatNumber(barangays.length)}
                        </span>
                        <span style={styles.barangayCountLabel}>
                          barangay{barangays.length === 1 ? "" : "s"}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  {barangays.length === 0 ? (
                    <p style={{ ...styles.sectionText, marginTop: "8px" }}>
                      No affected barangay is recorded for this operation.
                    </p>
                  ) : (
                    <div style={styles.barangayList}>
                      {barangays.map((barangay) => (
                        <span
                          key={barangay.public_key || barangay.name}
                          style={styles.barangayChip}
                        >
                          {barangay.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </details>
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
  const isForecastSource = neededItems?.source_type === "FORECAST";
  const isDefaultEmergencySource =
    neededItems?.source_type === "DEFAULT_EMERGENCY";
  const hasSuggestions = suggestions.length > 0 || isDefaultEmergencySource;

  return (
    <section style={styles.section} aria-labelledby="needed-items-title">
      <div style={styles.sectionHeader}>
        <div>
          <h2
            id="needed-items-title"
            className="donor-portal-anchor-target"
            style={styles.sectionTitle}
          >
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
            const defaultPriorityItems =
              isDefaultEmergencySource || (isForecastSource && items.length === 0)
              ? DEFAULT_DONATION_GROUPS_BY_PRIORITY[priorityGroup.key]
              : null;
            const displayedItemCount = defaultPriorityItems
              ? defaultPriorityItems.length
              : items.length;

            return (
              <details
                key={priorityGroup.key}
                style={styles.details}
                open={priorityGroup.key === "HIGH"}
                className="donor-portal-card-hover"
              >
                <summary
                  className="donor-needed-items-summary"
                  style={styles.detailsSummary}
                >
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
                  <span style={styles.summaryActionGroup}>
                    <span
                      style={{
                        ...styles.badge,
                        background: priorityGroup.background,
                        border: `1px solid ${priorityGroup.border}`,
                        color: priorityGroup.iconColor,
                      }}
                    >
                      {displayedItemCount} item
                      {displayedItemCount === 1 ? "" : "s"}
                    </span>
                    <span
                      className="donor-portal-disclosure-indicator"
                      style={styles.disclosureIndicator}
                      aria-hidden="true"
                    >
                      <FiChevronDown size={16} />
                    </span>
                  </span>
                </summary>

                {defaultPriorityItems ? (
                  <div style={styles.itemGrid}>
                    {defaultPriorityItems.map((group) => (
                      <article key={group.title} style={styles.defaultNeedCard}>
                        <div style={styles.defaultNeedTitleRow}>
                          {group.Icon ? (
                            <span
                              style={styles.defaultNeedTitleIcon}
                              aria-hidden="true"
                            >
                              <group.Icon size={18} />
                            </span>
                          ) : null}
                          <h3 style={styles.itemTitle}>{group.title}</h3>
                        </div>
                        <p style={styles.itemNote}>{group.helper}</p>
                        <ul style={styles.defaultNeedList}>
                          {group.items.map((itemName) => (
                            <li
                              key={itemName}
                              style={styles.defaultNeedListItem}
                            >
                              <span
                                style={styles.defaultNeedBullet}
                                aria-hidden="true"
                              />
                              <span>{itemName}</span>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div style={{ padding: "0 16px 16px" }}>
                    <p style={styles.sectionText}>
                      No {priorityGroup.title.toLowerCase()} suggestions are
                      available.
                    </p>
                  </div>
                ) : (
                  <div style={styles.forecastTableWrap}>
                    <table style={styles.forecastTable}>
                      <thead>
                        <tr>
                          <th style={{ ...styles.th, ...styles.forecastTh }}>
                            Item
                          </th>
                          <th
                            style={{
                              ...styles.th,
                              ...styles.numericCell,
                              ...styles.forecastTh,
                            }}
                          >
                            Needed Quantity
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => {
                          const quantityValue = Number(item.suggested_quantity);
                          const hasQuantity =
                            Number.isFinite(quantityValue) && quantityValue > 0;
                          const quantityLabel = hasQuantity
                            ? `${formatNumber(quantityValue)} ${
                                item.unit_of_measure || "items"
                              }`
                            : item.unit_of_measure || "Needed item";

                          return (
                            <tr key={item.public_key || item.item_name}>
                              <td style={{ ...styles.td, ...styles.forecastItemCell }}>
                                {item.item_name || "Donation item"}
                              </td>
                              <td style={{ ...styles.td, ...styles.numericCell }}>
                                {quantityLabel}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
  const displayedRecentDonations = HIDE_TRANSPARENCY_DATA_FOR_DESIGN_PREVIEW
    ? []
    : recentDonations || [];
  const displayedTransparencySummary = HIDE_TRANSPARENCY_DATA_FOR_DESIGN_PREVIEW
    ? {
        total_donations_received: 0,
        total_quantity_received: 0,
      }
    : transparencySummary || {};

  return (
    <section style={styles.section} aria-labelledby="transparency-title">
      <div style={styles.sectionHeader}>
        <div>
          <h2
            id="transparency-title"
            className="donor-portal-anchor-target"
            style={styles.sectionTitle}
          >
            Donation Transparency
          </h2>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <div className="donor-portal-card-hover" style={styles.summaryCard}>
          <div style={styles.summaryTop}>
            <p style={styles.label}>Recorded Donations</p>
            <span style={styles.summaryIcon} aria-hidden="true">
              <FaCheckCircleSolid size={18} />
            </span>
          </div>
          <p style={styles.summaryValue}>
            {formatNumber(displayedTransparencySummary.total_donations_received)}
          </p>
        </div>
        <div className="donor-portal-card-hover" style={styles.summaryCard}>
          <div style={styles.summaryTop}>
            <p style={styles.label}>Items Received</p>
            <span style={styles.summaryIcon} aria-hidden="true">
              <FaBoxOpen size={18} />
            </span>
          </div>
          <p style={styles.summaryValue}>
            {formatNumber(displayedTransparencySummary.total_quantity_received)}
          </p>
        </div>
      </div>

      <h3 style={{ ...styles.sectionTitle, fontSize: "18px", marginTop: "18px" }}>
        Donation Records
      </h3>
      {displayedRecentDonations.length === 0 ? (
        <div style={{ ...styles.emptyState, marginTop: "12px" }}>
          <FiInfo size={20} color={COLORS.primary} aria-hidden="true" />
          <span>No public donation records are available yet.</span>
        </div>
      ) : (
        <div
          className="recent-donation-grid"
          style={{
            ...styles.donationList,
            ...getRecentDonationGridStyle(displayedRecentDonations.length),
            marginTop: "12px",
          }}
        >
          {displayedRecentDonations.map((donation, index) => {
            const donationTypeIcons = getDonationTypeIcons(donation);
            const hasStackedIcons = donationTypeIcons.length > 1;

            return (
              <article
                key={donation.public_key || `${donation.donation_date}-${index}`}
                className="donor-portal-card-hover"
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
                          <FaShoppingBag size={hasStackedIcons ? 16 : 18} />
                        ) : (
                          <FaBoxOpen size={hasStackedIcons ? 16 : 18} />
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
  const donatedItemRows = HIDE_UTILIZATION_DATA_FOR_DESIGN_PREVIEW
    ? []
    : transparencySummary?.received_vs_distributed || [];

  return (
    <section style={styles.section} aria-labelledby="utilization-title">
      <details open>
        <summary
          className="donor-utilization-summary"
          style={styles.collapsibleSectionSummary}
        >
          <div>
            <h2 id="utilization-title" style={styles.sectionTitle}>
              Donation Utilization
            </h2>
          </div>
          <span style={styles.summaryActionGroup}>
            <span
              style={{
                ...styles.badge,
                background: COLORS.softBg,
                border: `1px solid ${COLORS.border}`,
                color: COLORS.primaryDark,
              }}
            >
              {formatNumber(donatedItemRows.length)} item
              {donatedItemRows.length === 1 ? "" : "s"}
            </span>
            <span
              className="donor-portal-disclosure-indicator"
              style={styles.disclosureIndicator}
              aria-hidden="true"
            >
              <FiChevronDown size={16} />
            </span>
          </span>
        </summary>

        <div style={styles.collapsibleSectionBody}>
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
                    <th style={{ ...styles.th, ...styles.forecastTh }}>Item</th>
                    <th
                      style={{
                        ...styles.th,
                        ...styles.numericCell,
                        ...styles.forecastTh,
                      }}
                    >
                      Received
                    </th>
                    <th
                      style={{
                        ...styles.th,
                        ...styles.numericCell,
                        ...styles.forecastTh,
                      }}
                    >
                      Distributed
                    </th>
                    <th
                      style={{
                        ...styles.th,
                        ...styles.numericCell,
                        ...styles.forecastTh,
                      }}
                    >
                      Available
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {donatedItemRows.map((row) => (
                    <tr key={row.public_key || row.item_name}>
                      <td style={{ ...styles.td, ...styles.forecastItemCell }}>
                        {row.item_name || "--"}
                      </td>
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
        </div>
      </details>
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
  const phoneHref = getPhoneHref(footerInfo.phone);
  const emailHref = getGmailComposeUrl(footerInfo.email);

  return (
    <footer style={styles.footer}>
      <div style={styles.footerInner}>
        <div className="portal-footer-grid" style={styles.footerGrid}>
          <div style={styles.footerPrimaryColumn}>
            <section aria-labelledby="footer-about-title" style={styles.footerColumn}>
              <div className="portal-footer-brand" style={styles.footerBrand}>
                <span style={styles.footerLogoFrame}>
                  <img src={distyncLogoCropped} alt="DISTYNC logo" style={styles.footerLogo} />
                </span>
                <div style={styles.footerBrandCopy}>
                  <h2
                    id="footer-about-title"
                    className="donor-portal-anchor-target"
                    style={styles.footerColumnTitle}
                  >
                    ABOUT
                  </h2>
                  <p style={styles.footerSystemLine}>
                    <span style={styles.footerTitleText}>
                      {footerInfo.systemName}
                    </span>
                  </p>
                  <p style={styles.footerText}>
                    A web-based disaster relief management system that integrates evacuee monitoring, relief distribution, inventory management, and data analytics to support coordinated and transparent disaster response.
                  </p>
                </div>
              </div>
            </section>

            <section
              aria-label="Donation coordination details"
              style={{ ...styles.footerColumn, ...styles.footerCoordinationSection }}
            >
              <div
                className="portal-footer-coordination-pair"
                style={styles.footerCoordinationPair}
              >
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
                <div style={styles.footerDetailGroup}>
                  <p id="drop-off-title" style={styles.footerDetailLabel}>
                    Drop-off Location
                  </p>
                  <p style={styles.footerDetailValue}>
                    {[footerInfo.buildingName, footerInfo.addressLines[0]]
                      .filter(Boolean)
                      .join(", ")}
                    <br />
                    {footerInfo.addressLines.slice(1).join(", ")}
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section
            aria-labelledby="footer-contact-title"
            className="portal-footer-contact"
            style={{ ...styles.footerColumn, ...styles.footerContactColumn }}
          >
            <h2 id="footer-contact-title" style={styles.footerColumnTitle}>
              Contact Information
            </h2>
            <div
              aria-label="Contact information"
              style={styles.footerCompactContact}
            >
              {phoneHref ? (
                <a
                  href={phoneHref}
                  className="portal-footer-contact-link"
                  style={styles.footerContactLink}
                >
                  <FiPhone size={14} aria-hidden="true" />
                  <span style={styles.footerContactText}>{footerInfo.phone}</span>
                </a>
              ) : (
                <div style={styles.footerContactRow}>
                  <FiPhone size={14} aria-hidden="true" />
                  <span style={styles.footerContactText}>{footerInfo.phone}</span>
                </div>
              )}
              {emailHref ? (
                <a
                  href={emailHref}
                  className="portal-footer-contact-link"
                  style={styles.footerContactLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FiMail size={14} aria-hidden="true" />
                  <span style={styles.footerContactText}>{footerInfo.email}</span>
                </a>
              ) : (
                <div style={styles.footerContactRow}>
                  <FiMail size={14} aria-hidden="true" />
                  <span style={styles.footerContactText}>{footerInfo.email}</span>
                </div>
              )}
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
                  <FiFacebook size={14} aria-hidden="true" />
                  <span style={styles.footerContactText}>
                    {footerInfo.facebookLabel}
                  </span>
                </a>
              ) : null}
              {footerInfo.mapsUrl ? (
                <a
                  href={footerInfo.mapsUrl}
                  className="portal-footer-contact-link"
                  style={{
                    ...styles.footerContactLink,
                    ...styles.footerDirectionsLink,
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FiMapPin size={14} aria-hidden="true" />
                  <span style={styles.footerContactText}>Get Directions</span>
                </a>
              ) : null}
            </div>
          </section>

        </div>
      </div>

      <div style={styles.footerTaglineBand}>
        <div style={styles.footerTaglineInner}>
          <p style={styles.footerTaglineText}>
            DISTYNC: A Disaster Relief Management System -{" "}
            <span style={styles.footerTaglineEmphasis}>
              Where Relief Stays in Sync and Service Stays Distinct
            </span>
          </p>
        </div>
      </div>

      <div className="portal-footer-bottom" style={styles.footerBottom}>
        <div className="portal-footer-bottom-inner" style={styles.footerBottomInner}>
          <p style={styles.footerBottomText}>
            &copy; {currentYear} DISTYNC - {footerInfo.municipality}. Developed by Quadcore Girls.
          </p>
        </div>
      </div>
    </footer>
  );
};

const DonationInformationPage = () => {
  const [pageState, setPageState] = useState({
    isLoading: true,
    errorMessage: "",
    activeDisasters: [],
    isShowingRecentActiveDisasters: false,
    neededItems: DEFAULT_NEEDED_ITEMS_META,
    recentDonations: [],
    transparencySummary: {},
    publicContactConfig: DEFAULT_PUBLIC_CONTACT_CONFIG,
    lastUpdatedAt: null,
  });

  useEffect(() => {
    let isMounted = true;
    const waitForInitialLoadingCue = (startedAt) => {
      const elapsedMs = Date.now() - startedAt;
      const remainingMs = PUBLIC_PORTAL_INITIAL_LOADING_MIN_MS - elapsedMs;

      if (remainingMs <= 0) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        window.setTimeout(resolve, remainingMs);
      });
    };

    const loadDonationOverview = async ({ showLoading = false } = {}) => {
      const loadStartedAt = Date.now();

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
        const activeDisasterDisplay =
          getActiveDisasterEventsForPortal(disasterEvents);
        const activeDisasters = activeDisasterDisplay.events;
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

        if (showLoading) {
          await waitForInitialLoadingCue(loadStartedAt);
        }

        if (!isMounted) {
          return;
        }

        setPageState({
          isLoading: false,
          errorMessage: "",
          activeDisasters,
          isShowingRecentActiveDisasters:
            activeDisasterDisplay.isShowingRecentFallback,
          neededItems,
          recentDonations,
          transparencySummary,
          publicContactConfig,
          lastUpdatedAt: getLatestTimestamp([
            ...activeDisasters.map(
              (event) => event.updated_at || event.created_at,
            ),
            ...neededItems.suggestions.map((item) => item.forecasted_at),
            ...recentDonations.map(
              (donation) => donation.updated_at || donation.donation_date,
            ),
          ]),
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (showLoading) {
          await waitForInitialLoadingCue(loadStartedAt);

          if (!isMounted) {
            return;
          }

          setPageState({
            isLoading: false,
            errorMessage: error.message || "Failed to load donation information.",
            activeDisasters: [],
            isShowingRecentActiveDisasters: false,
            neededItems: DEFAULT_NEEDED_ITEMS_META,
            recentDonations: [],
            transparencySummary: {},
            publicContactConfig: DEFAULT_PUBLIC_CONTACT_CONFIG,
            lastUpdatedAt: null,
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
    isShowingRecentActiveDisasters,
    neededItems,
    recentDonations,
    transparencySummary,
    publicContactConfig,
    lastUpdatedAt,
  } = pageState;

  return (
    <main className="donor-portal-page" style={styles.page}>
      <style>{portalFooterCss}</style>
      <TopBar publicContactConfig={publicContactConfig} />
      <div className="donor-portal-page-inner" style={styles.pageInner}>
        <HeroSection
          activeEvents={activeDisasters}
          lastUpdatedAt={lastUpdatedAt}
          isLoading={isLoading}
        />
        <QuickLinksSection />

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
          <div className="donor-portal-content-stack" style={styles.contentStack}>
            <NeededItemsSection neededItems={neededItems} />
            <ActiveDisastersSection
              events={activeDisasters}
              isShowingRecentFallback={isShowingRecentActiveDisasters}
            />
            <TransparencySection
              recentDonations={recentDonations}
              transparencySummary={transparencySummary}
            />
            <DonationUtilizationSection
              transparencySummary={transparencySummary}
            />
          </div>
        ) : null}

      </div>

      <PortalFooter publicContactConfig={publicContactConfig} />
    </main>
  );
};

export default DonationInformationPage;
