import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiGlobe,
  FiHome,
  FiMail,
  FiMapPin,
  FiPackage,
  FiPhone,
  FiUsers,
} from "react-icons/fi";
import distyncLogo from "../../assets/distync-logo.png";
import { fetchDonationPortalData } from "../../features/donations/donationService";
import { fetchActiveDisasterEvents } from "../../features/disaster-events/disasterEventService";
import { fetchInventoryBatches } from "../../features/inventory-batches/inventoryBatchService";
import { fetchInventoryTransactions } from "../../features/inventory-transactions/inventoryTransactionService";
import { fetchMasterlistOperationalAnalytics } from "../../features/mswdo-analytics/mswdoAnalyticsService";

const COLORS = {
  cardBg: "#ffffff",
  softBg: "#eef5fb",
  border: "#d6e2ef",
  text: "#17324d",
  subtext: "#6b8298",
  primary: "#2f6499",
  danger: "#c94b4b",
  dangerSoft: "#fdecec",
  warning: "#d48a1f",
  warningSoft: "#fff4df",
  success: "#2e7d5b",
  successSoft: "#eaf7f0",
};

const LGU_CONTACT = {
  municipality: "Municipality of Malvar, Batangas",
  telephonePrimary: "+63 43 778 5101",
  telephoneSecondary: "+63 917 825 0356",
  emailPrimary: "lgumalvarbatangas@gmail.com",
  emailSecondary: "info@malvarbatangas.gov.ph",
  website: "www.malvarbatangas.gov.ph",
};

const EMPTY_OPERATIONAL_PAYLOAD = {
  summary_metrics: {
    total_number_of_evacuees_individuals: 0,
    total_number_of_families: 0,
    total_barangays_covered: 0,
  },
  charts: {
    per_barangay: [],
  },
};

const LOW_STOCK_THRESHOLD = 10;
const CRITICAL_STOCK_THRESHOLD = 5;

const styles = {
  page: {
    width: "100%",
    minWidth: 0,
    background: "transparent",
    padding: "clamp(16px, 3vw, 32px)",
    boxSizing: "border-box",
    fontFamily: "Inter, Segoe UI, sans-serif",
    color: COLORS.text,
  },
  pageInner: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
    minWidth: 0,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    background: "#cfd9ee",
    border: "1px solid #c5d3e5",
    borderRadius: "20px",
    padding: "18px 22px",
    boxShadow: "0 10px 24px rgba(23, 50, 77, 0.06)",
    flexWrap: "wrap",
  },
  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    minWidth: 0,
  },
  brandLogo: {
    width: "54px",
    height: "54px",
    objectFit: "contain",
    flexShrink: 0,
  },
  brandTitle: {
    margin: 0,
    fontSize: "26px",
    fontWeight: 800,
    color: "#344567",
    lineHeight: 1,
  },
  brandSubtitle: {
    margin: "6px 0 0",
    fontSize: "14px",
    color: "#415674",
    fontWeight: 600,
  },
  portalLabel: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 700,
    color: "#415674",
  },
  backButtonWrap: {
    display: "flex",
    justifyContent: "flex-start",
  },
  backButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid #c6d8ea",
    borderRadius: "14px",
    padding: "12px 18px",
    backgroundColor: "#f8fbfe",
    color: "#2a4c6f",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    minHeight: "44px",
  },
  contentStack: {
    display: "grid",
    gap: "20px",
    minWidth: 0,
  },
  heroCard: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "20px",
    padding: "clamp(30px, 4vw, 40px)",
    boxShadow: "0 10px 30px rgba(23, 50, 77, 0.06)",
    minWidth: 0,
  },
  heroTop: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "18px",
    textAlign: "center",
  },
  heroContent: {
    minWidth: 0,
    maxWidth: "880px",
  },
  heroAside: {
    display: "grid",
    gap: "12px",
    width: "100%",
    justifyItems: "center",
  },
  eyebrow: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: COLORS.subtext,
  },
  title: {
    margin: "8px 0 6px",
    fontSize: "clamp(28px, 4vw, 36px)",
    fontWeight: 800,
    color: COLORS.text,
    lineHeight: 1.1,
  },
  subtitle: {
    margin: 0,
    fontSize: "clamp(15px, 1.8vw, 18px)",
    color: COLORS.subtext,
    lineHeight: 1.6,
    maxWidth: "700px",
  },
  statusWrap: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: 700,
  },
  heroAsideCard: {
    background: COLORS.softBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "18px",
    padding: "18px 18px 16px",
    minWidth: 0,
    maxWidth: "360px",
    width: "100%",
    textAlign: "left",
  },
  heroAsideLabel: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: COLORS.subtext,
  },
  heroAsideValue: {
    margin: "8px 0 0",
    fontSize: "30px",
    lineHeight: 1,
    fontWeight: 800,
    color: COLORS.text,
  },
  heroAsideText: {
    margin: "10px 0 0",
    fontSize: "14px",
    lineHeight: 1.6,
    color: COLORS.subtext,
  },
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "16px",
  },
  summaryCard: {
    background: COLORS.softBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "18px",
    padding: "18px 18px 16px",
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    minWidth: 0,
  },
  summaryLabel: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    color: COLORS.subtext,
    letterSpacing: "0.04em",
  },
  summaryText: {
    margin: "4px 0 0",
    fontSize: "14px",
    color: COLORS.text,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  neededSection: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "20px",
    padding: "24px",
    boxShadow: "0 10px 24px rgba(23, 50, 77, 0.04)",
  },
  neededGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  neededCard: {
    borderRadius: "16px",
    padding: "18px",
    border: "1px solid transparent",
    minWidth: 0,
  },
  neededTag: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "26px",
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: "14px",
  },
  neededTitle: {
    margin: "0 0 8px",
    fontSize: "18px",
    fontWeight: 800,
    color: COLORS.text,
  },
  neededQuantity: {
    margin: "0 0 6px",
    fontSize: "34px",
    lineHeight: 1,
    fontWeight: 800,
    color: "#344567",
  },
  neededMeta: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.5,
    color: COLORS.subtext,
  },
  dropOffSection: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "20px",
    padding: "clamp(24px, 4vw, 34px)",
    boxShadow: "0 10px 24px rgba(23, 50, 77, 0.04)",
    textAlign: "center",
  },
  dropOffCard: {
    margin: "0 auto",
    maxWidth: "520px",
    background: COLORS.softBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "18px",
    padding: "22px 24px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "16px",
    textAlign: "left",
    flexWrap: "wrap",
  },
  dropOffTitle: {
    margin: 0,
    fontSize: "clamp(28px, 4vw, 44px)",
    fontWeight: 800,
    color: "#344567",
    lineHeight: 1.05,
  },
  dropOffSubtitle: {
    margin: "10px 0 24px",
    fontSize: "15px",
    color: COLORS.subtext,
    lineHeight: 1.6,
  },
  dropOffLocationName: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 800,
    color: "#344567",
  },
  dropOffLocationText: {
    margin: "6px 0 0",
    fontSize: "14px",
    lineHeight: 1.6,
    color: COLORS.subtext,
  },
  disasterCard: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "18px",
    padding: "22px",
    boxShadow: "0 10px 24px rgba(23, 50, 77, 0.04)",
    minWidth: 0,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  sectionTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 800,
    color: COLORS.text,
  },
  sectionText: {
    margin: "6px 0 0",
    fontSize: "14px",
    color: COLORS.subtext,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },
  metricCard: {
    background: COLORS.softBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "18px",
    padding: "20px",
  },
  metricTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "12px",
  },
  metricLabel: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 700,
    color: COLORS.subtext,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  metricValue: {
    margin: 0,
    fontSize: "34px",
    fontWeight: 800,
    color: COLORS.text,
    lineHeight: 1,
  },
  metricSubtext: {
    margin: "8px 0 0",
    fontSize: "14px",
    color: COLORS.subtext,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "18px",
    minWidth: 0,
  },
  subSection: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "16px",
    padding: "18px",
    minWidth: 0,
  },
  subSectionTitle: {
    margin: "0 0 12px",
    fontSize: "18px",
    fontWeight: 800,
    color: COLORS.text,
  },
  urgentList: {
    display: "grid",
    gap: "10px",
  },
  urgentCard: {
    borderRadius: "14px",
    padding: "14px 16px",
    border: `1px solid ${COLORS.border}`,
  },
  urgentTitle: {
    margin: "0 0 4px",
    fontSize: "16px",
    fontWeight: 800,
    color: COLORS.text,
  },
  urgentMeta: {
    margin: 0,
    color: COLORS.subtext,
    fontSize: "14px",
  },
  areaList: {
    display: "grid",
    gap: "10px",
  },
  areaCard: {
    background: COLORS.softBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "14px",
    padding: "14px 16px",
  },
  areaName: {
    margin: "0 0 8px",
    fontSize: "16px",
    fontWeight: 800,
    color: COLORS.text,
  },
  areaRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "baseline",
    fontSize: "14px",
    color: COLORS.text,
    marginTop: "4px",
  },
  emptyStateCard: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "20px",
    padding: "40px 24px",
    textAlign: "center",
    boxShadow: "0 10px 24px rgba(23, 50, 77, 0.04)",
  },
  emptyIconWrap: {
    width: "72px",
    height: "72px",
    borderRadius: "999px",
    background: COLORS.successSoft,
    color: COLORS.success,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
  },
  emptyTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 800,
    color: COLORS.text,
  },
  emptyText: {
    margin: "12px auto 0",
    maxWidth: "700px",
    fontSize: "15px",
    color: COLORS.subtext,
    lineHeight: 1.7,
  },
  updatedText: {
    marginTop: "16px",
    fontSize: "13px",
    color: "#8ca0b4",
  },
  messageCard: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "20px",
    padding: "28px 24px",
    boxShadow: "0 10px 24px rgba(23, 50, 77, 0.04)",
  },
  messageTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 800,
    color: COLORS.text,
  },
  messageText: {
    margin: "10px 0 0",
    fontSize: "15px",
    lineHeight: 1.7,
    color: COLORS.subtext,
  },
  inlineEmptyText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.6,
    color: COLORS.subtext,
  },
  footer: {
    background: "#cfd9ee",
    border: "1px solid #c5d3e5",
    borderRadius: "20px",
    padding: "clamp(20px, 3vw, 28px)",
    boxShadow: "0 10px 24px rgba(23, 50, 77, 0.04)",
  },
  footerTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  footerTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 800,
    color: COLORS.text,
  },
  footerSubtitle: {
    margin: "6px 0 0",
    fontSize: "14px",
    lineHeight: 1.6,
    color: COLORS.subtext,
    maxWidth: "640px",
  },
  footerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  footerCard: {
    background: "rgba(255, 255, 255, 0.55)",
    border: "1px solid rgba(197, 211, 229, 0.95)",
    borderRadius: "16px",
    padding: "16px 18px",
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    minWidth: 0,
  },
  footerLabel: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: COLORS.subtext,
  },
  footerValue: {
    margin: "6px 0 0",
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#344567",
    wordBreak: "break-word",
  },
};

const formatDate = (value) => {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const formatUpdatedAt = (value) => {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatDateRange = (startDate, endDate) => {
  return `${formatDate(startDate)} - ${endDate ? formatDate(endDate) : "Ongoing"}`;
};

const formatStatusLabel = (status) => {
  if (!status) {
    return "Unknown";
  }

  const normalizedStatus = String(status).toLowerCase();
  return normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);
};

const getUrgentStyles = (level) => {
  if (level === "critical" || level === "URGENT") {
    return {
      background: COLORS.dangerSoft,
      color: COLORS.danger,
    };
  }

  return {
    background: COLORS.warningSoft,
    color: COLORS.warning,
  };
};

const getNeedPalette = (level) => {
  if (level === "URGENT" || level === "critical") {
    return {
      background: "#efc7cb",
      border: "#d4a1a8",
      tagBackground: "#d54141",
      tagColor: "#ffffff",
    };
  }

  if (level === "HIGH") {
    return {
      background: "#f5dcc8",
      border: "#e4b58a",
      tagBackground: "#ee7a31",
      tagColor: "#ffffff",
    };
  }

  if (level === "MEDIUM") {
    return {
      background: "#f4ebc6",
      border: "#e0cd87",
      tagBackground: "#c89210",
      tagColor: "#ffffff",
    };
  }

  return {
    background: "#d7eadf",
    border: "#99c1ab",
    tagBackground: "#2e7d5b",
    tagColor: "#ffffff",
  };
};

const buildInventoryLookup = (inventoryBatches) => {
  const inventoryByItemId = new Map();

  (inventoryBatches || []).forEach((batch) => {
    const itemId = batch.inventory_item?.id || batch.inventory_item_id;

    if (!itemId) {
      return;
    }

    const quantityAvailable = Number(batch.quantity_available || 0);
    const existingEntry = inventoryByItemId.get(itemId) || {
      id: itemId,
      name: batch.inventory_item?.item_name || "--",
      unit: batch.inventory_item?.unit_of_measure || "pc",
      totalQuantityAvailable: 0,
      hasLowStock: false,
      hasCriticalStock: false,
    };

    existingEntry.totalQuantityAvailable += quantityAvailable;
    existingEntry.hasLowStock =
      existingEntry.hasLowStock ||
      batch.status === "LOW_STOCK" ||
      (quantityAvailable > 0 && quantityAvailable <= LOW_STOCK_THRESHOLD);
    existingEntry.hasCriticalStock =
      existingEntry.hasCriticalStock ||
      (quantityAvailable > 0 && quantityAvailable <= CRITICAL_STOCK_THRESHOLD);

    inventoryByItemId.set(itemId, existingEntry);
  });

  return inventoryByItemId;
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

const buildActiveDisasterRows = ({
  activeEvents,
  operationalAnalyticsByEventId,
  distributionTransactions,
  inventoryLookup,
}) => {
  return (activeEvents || []).map((event) => {
    const operationalPayload =
      operationalAnalyticsByEventId.get(event.id) || EMPTY_OPERATIONAL_PAYLOAD;
    const summaryMetrics =
      operationalPayload.summary_metrics ||
      EMPTY_OPERATIONAL_PAYLOAD.summary_metrics;
    const areaBreakdown = (operationalPayload.charts?.per_barangay || []).map(
      (item) => ({
        area: item.barangay_name || "Unknown",
        families: Number(item.families_count || 0),
        individuals: Number(item.evacuees_count || 0),
      }),
    );

    const neededItemsByItemId = new Map();

    (distributionTransactions || [])
      .filter((transaction) => transaction.disaster_event_id === event.id)
      .forEach((transaction) => {
        const itemId = transaction.inventory_item?.id;

        if (!itemId) {
          return;
        }

        const inventoryEntry = inventoryLookup.get(itemId);
        const existingEntry = neededItemsByItemId.get(itemId) || {
          id: itemId,
          name:
            transaction.inventory_item?.item_name ||
            inventoryEntry?.name ||
            "--",
          needed: 0,
          unit: inventoryEntry?.unit || "pc",
          level: inventoryEntry?.hasCriticalStock ? "critical" : "high",
        };

        existingEntry.needed += Number(transaction.quantity || 0);

        if (inventoryEntry?.hasCriticalStock) {
          existingEntry.level = "critical";
        }

        neededItemsByItemId.set(itemId, existingEntry);
      });

    const urgentNeeds = [...neededItemsByItemId.values()]
      .sort((left, right) => {
        if (left.level !== right.level) {
          return left.level === "critical" ? -1 : 1;
        }

        return right.needed - left.needed;
      })
      .slice(0, 4);

    return {
      id: event.id,
      eventName: event.title || "Active Disaster Event",
      status: formatStatusLabel(event.status),
      dateRange: formatDateRange(event.start_date, event.end_date),
      affectedAreasCount:
        Number(summaryMetrics.total_barangays_covered || 0) ||
        (event.affected_barangays || []).length,
      affectedFamilies: Number(summaryMetrics.total_number_of_families || 0),
      affectedIndividuals: Number(
        summaryMetrics.total_number_of_evacuees_individuals || 0,
      ),
      neededItemsTotal: [...neededItemsByItemId.values()].reduce(
        (total, item) => total + item.needed,
        0,
      ),
      urgentNeeds,
      areaBreakdown,
    };
  });
};

const TopBar = () => {
  return (
    <div style={styles.topBar}>
      <div style={styles.brandWrap}>
        <img src={distyncLogo} alt="DISTYNC logo" style={styles.brandLogo} />
        <div>
          <p style={styles.brandTitle}>DISTYNC</p>
          <p style={styles.brandSubtitle}>Disaster Relief Management</p>
        </div>
      </div>

      <p style={styles.portalLabel}>Donation Portal</p>
    </div>
  );
};

const HeroSection = ({ activeCount, lastUpdatedAt }) => {
  const hasActiveDisasters = activeCount > 0;

  return (
    <section style={styles.heroCard}>
      <div style={styles.heroTop}>
        <div style={styles.heroContent}>
          <p style={styles.eyebrow}>Donors & NGOs Portal</p>
          <h1 style={styles.dropOffTitle}>YOUR DONATION CAN SAVE LIVES!</h1>
          <p style={styles.subtitle}>
            {hasActiveDisasters
              ? "We are facing a disaster crisis and urgently need community support to help displaced families get through this challenging time."
              : "This portal remains available for public monitoring and future donation coordination for Malvar, Batangas."}
          </p>
        </div>

        <div style={styles.heroAside}>
          <div style={styles.heroAsideCard}>
            <p style={styles.heroAsideLabel}>Current Situation</p>
            <p style={styles.heroAsideValue}>{activeCount}</p>
            <p style={styles.heroAsideText}>
              {hasActiveDisasters
                ? "Active disaster events currently need monitoring and donor visibility."
                : "No active disaster events are open right now, but the LGU remains prepared for response."}
            </p>
          </div>

          <div style={styles.statusWrap}>
            {hasActiveDisasters ? (
              <span
                style={{
                  ...styles.badge,
                  background: COLORS.dangerSoft,
                  color: COLORS.danger,
                }}
              >
                <FiAlertCircle size={16} />
                {activeCount} Active Disasters
              </span>
            ) : (
              <span
                style={{
                  ...styles.badge,
                  background: COLORS.successSoft,
                  color: COLORS.success,
                }}
              >
                <FiCheckCircle size={16} />
                Monitoring Only
              </span>
            )}

            <span
              style={{
                ...styles.badge,
                background: COLORS.softBg,
                color: COLORS.text,
              }}
            >
              Updated {formatUpdatedAt(lastUpdatedAt)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

const OverviewSummary = ({ activeCount, hasActiveDisasters, lastUpdatedAt }) => {
  return (
    <section style={styles.summaryRow}>
      <div style={styles.summaryCard}>
        <FiAlertCircle size={18} color={COLORS.primary} />
        <div>
          <p style={styles.summaryLabel}>Portal Status</p>
          <p style={styles.summaryText}>
            {hasActiveDisasters
              ? "Live disaster information is currently available for donor action."
              : "No active disaster event is currently open for donation monitoring."}
          </p>
        </div>
      </div>

      <div style={styles.summaryCard}>
        <FiUsers size={18} color={COLORS.primary} />
        <div>
          <p style={styles.summaryLabel}>Active Disaster Count</p>
          <p style={styles.summaryText}>
            {activeCount} active event{activeCount === 1 ? "" : "s"} visible in the portal.
          </p>
        </div>
      </div>

      <div style={styles.summaryCard}>
        <FiCheckCircle size={18} color={COLORS.primary} />
        <div>
          <p style={styles.summaryLabel}>Last Refresh</p>
          <p style={styles.summaryText}>{formatUpdatedAt(lastUpdatedAt)}</p>
        </div>
      </div>
    </section>
  );
};

const CriticallyNeededItemsSection = ({ donationNeeds, activeDisasters }) => {
  const fallbackItems = activeDisasters
    .flatMap((disaster) =>
      (disaster.urgentNeeds || []).map((item) => ({
        id: `${disaster.id}-${item.id}`,
        inventory_item: { item_name: item.name, unit_of_measure: item.unit },
        quantity_needed: item.needed,
        priority_level: item.level === "critical" ? "URGENT" : "HIGH",
        notes: `For: ${disaster.eventName}`,
      })),
    )
    .slice(0, 6);

  const items = ((donationNeeds || []).length > 0 ? donationNeeds : fallbackItems)
    .slice()
    .sort((left, right) => Number(right.quantity_needed || 0) - Number(left.quantity_needed || 0))
    .slice(0, 6);

  return (
    <section style={styles.neededSection}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>Critically Needed Items</h2>
          <p style={styles.sectionText}>
            Priority donation needs for the current disaster situation across Malvar.
          </p>
        </div>
      </div>

      <div style={styles.neededGrid}>
        {items.length === 0 ? (
          <p style={styles.inlineEmptyText}>
            No prioritized donation items are available yet from the current records.
          </p>
        ) : (
          items.map((item) => {
            const palette = getNeedPalette(item.priority_level);

            return (
              <article
                key={item.id}
                style={{
                  ...styles.neededCard,
                  background: palette.background,
                  borderColor: palette.border,
                }}
              >
                <span
                  style={{
                    ...styles.neededTag,
                    background: palette.tagBackground,
                    color: palette.tagColor,
                  }}
                >
                  {item.priority_level}
                </span>
                <h3 style={styles.neededTitle}>
                  {item.inventory_item?.item_name || "Unknown Item"}
                </h3>
                <p style={styles.neededQuantity}>
                  {Number(item.quantity_needed || 0).toLocaleString()}
                </p>
                <p style={styles.neededMeta}>
                  {item.inventory_item?.unit_of_measure || "items"} needed
                </p>
                <p style={{ ...styles.neededMeta, marginTop: "8px" }}>
                  {item.notes || "No additional notes provided."}
                </p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
};

const DropOffLocationSection = () => {
  return (
    <section style={styles.dropOffSection}>
      <h2 style={styles.sectionTitle}>Drop-off Coordination</h2>
      <p style={styles.dropOffSubtitle}>
        Donations may be coordinated through the official municipal channels listed below.
      </p>
      <div style={styles.dropOffCard}>
        <FiMapPin size={42} color={COLORS.primary} />
        <div>
          <p style={styles.dropOffLocationName}>{LGU_CONTACT.municipality}</p>
          <p style={styles.dropOffLocationText}>
            Please confirm delivery instructions with the LGU before dispatching goods.
          </p>
        </div>
      </div>
    </section>
  );
};

const PortalFooter = () => {
  return (
    <footer style={styles.footer}>
      <div style={styles.footerTop}>
        <div>
          <h2 style={styles.footerTitle}>LGU Contact Information</h2>
          <p style={styles.footerSubtitle}>
            For coordination, verification, or follow-up on donation support,
            please contact the Municipality of Malvar through the channels below.
          </p>
        </div>
      </div>

      <div style={styles.footerGrid}>
        <div style={styles.footerCard}>
          <FiPhone size={18} color={COLORS.primary} />
          <div>
            <p style={styles.footerLabel}>Telephone No.</p>
            <p style={styles.footerValue}>{LGU_CONTACT.telephonePrimary}</p>
            <p style={styles.footerValue}>{LGU_CONTACT.telephoneSecondary}</p>
          </div>
        </div>

        <div style={styles.footerCard}>
          <FiMail size={18} color={COLORS.primary} />
          <div>
            <p style={styles.footerLabel}>Emails</p>
            <p style={styles.footerValue}>{LGU_CONTACT.emailPrimary}</p>
            <p style={styles.footerValue}>{LGU_CONTACT.emailSecondary}</p>
          </div>
        </div>

        <div style={styles.footerCard}>
          <FiGlobe size={18} color={COLORS.primary} />
          <div>
            <p style={styles.footerLabel}>Website</p>
            <p style={styles.footerValue}>{LGU_CONTACT.website}</p>
          </div>
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
    donationNeeds: [],
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
        const [activeEvents, publicPortalData] = await Promise.all([
          fetchActiveDisasterEvents(),
          fetchDonationPortalData(),
        ]);

        if (!isMounted) {
          return;
        }

        if (!Array.isArray(activeEvents) || activeEvents.length === 0) {
          setPageState({
            isLoading: false,
            errorMessage: "",
            activeDisasters: [],
            donationNeeds: publicPortalData?.donation_needs || [],
            lastUpdatedAt: new Date().toISOString(),
          });
          return;
        }

        const [operationalEntries, inventoryBatches, inventoryTransactions] =
          await Promise.all([
            Promise.all(
              activeEvents.map(async (event) => {
                try {
                  const payload = await fetchMasterlistOperationalAnalytics({
                    disasterEventId: event.id,
                    barangayId: null,
                  });

                  return [event.id, payload];
                } catch (_error) {
                  return [event.id, EMPTY_OPERATIONAL_PAYLOAD];
                }
              }),
            ),
            fetchInventoryBatches(),
            fetchInventoryTransactions({
              reference_type: "DISTRIBUTION",
            }),
          ]);

        if (!isMounted) {
          return;
        }

        const operationalAnalyticsByEventId = new Map(operationalEntries);
        const inventoryLookup = buildInventoryLookup(inventoryBatches || []);
        const activeDisasters = buildActiveDisasterRows({
          activeEvents,
          operationalAnalyticsByEventId,
          distributionTransactions: inventoryTransactions || [],
          inventoryLookup,
        });

        setPageState({
          isLoading: false,
          errorMessage: "",
          activeDisasters,
          donationNeeds: publicPortalData?.donation_needs || [],
          lastUpdatedAt: getLatestTimestamp([
            ...activeEvents.map((event) => event.updated_at),
            ...(publicPortalData?.donation_needs || []).map(
              (need) => need.updated_at || need.published_at,
            ),
            ...(inventoryTransactions || []).map(
              (transaction) =>
                transaction.performed_at || transaction.created_at,
            ),
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
          donationNeeds: [],
          lastUpdatedAt: new Date().toISOString(),
        });
      }
    };

    loadDonationOverview();

    return () => {
      isMounted = false;
    };
  }, []);

  const { isLoading, errorMessage, activeDisasters, donationNeeds, lastUpdatedAt } =
    pageState;
  const hasActiveDisasters = activeDisasters.length > 0;

  return (
    <div style={styles.page}>
      <div style={styles.pageInner}>
        <div style={styles.backButtonWrap}>
          <button
            type="button"
            onClick={() => navigate("/access")}
            style={styles.backButton}
          >
            <FiArrowLeft size={16} />
            Back
          </button>
        </div>

        <TopBar />

        <HeroSection
          activeCount={activeDisasters.length}
          lastUpdatedAt={lastUpdatedAt}
        />

        <OverviewSummary
          activeCount={activeDisasters.length}
          hasActiveDisasters={hasActiveDisasters}
          lastUpdatedAt={lastUpdatedAt}
        />

        <div style={styles.contentStack}>
          {!isLoading && !errorMessage ? (
            <CriticallyNeededItemsSection
              donationNeeds={donationNeeds}
              activeDisasters={activeDisasters}
            />
          ) : null}

          {isLoading ? (
            <section style={styles.messageCard}>
              <h2 style={styles.messageTitle}>
                Loading Disaster Response Overview
              </h2>
              <p style={styles.messageText}>
                Fetching the latest active disaster, masterlist, inventory, and donation records used by the public portal.
              </p>
            </section>
          ) : null}

          {!isLoading && errorMessage ? (
            <section style={styles.messageCard}>
              <h2 style={styles.messageTitle}>
                Unable to Load Donation Information
              </h2>
              <p style={styles.messageText}>{errorMessage}</p>
            </section>
          ) : null}

          {!isLoading && !errorMessage && !hasActiveDisasters ? (
            <section style={styles.emptyStateCard}>
              <div style={styles.emptyIconWrap}>
                <FiCheckCircle size={36} />
              </div>

              <h2 style={styles.emptyTitle}>No Active Disaster Events</h2>
              <p style={styles.emptyText}>
                There are currently no ongoing disaster events in Malvar,
                Batangas. The LGU continues to monitor conditions and remains
                prepared to respond to emergencies when needed.
              </p>
              <p style={styles.updatedText}>
                Last updated: {formatUpdatedAt(lastUpdatedAt)}
              </p>
            </section>
          ) : null}

          {!isLoading && !errorMessage && hasActiveDisasters
            ? activeDisasters.map((disaster) => (
                <section key={disaster.id} style={styles.disasterCard}>
                  <div style={styles.sectionHeader}>
                    <div>
                      <h2 style={styles.sectionTitle}>{disaster.eventName}</h2>
                      <p style={styles.sectionText}>{disaster.dateRange}</p>
                    </div>

                    <div style={styles.statusWrap}>
                      <span
                        style={{
                          ...styles.badge,
                          background: COLORS.dangerSoft,
                          color: COLORS.danger,
                        }}
                      >
                        <FiAlertCircle size={16} />
                        {disaster.status}
                      </span>
                      <span
                        style={{
                          ...styles.badge,
                          background: COLORS.softBg,
                          color: COLORS.text,
                        }}
                      >
                        <FiMapPin size={16} />
                        {disaster.affectedAreasCount} Affected Areas
                      </span>
                    </div>
                  </div>

                  <div style={styles.summaryGrid}>
                    <div style={styles.metricCard}>
                      <div style={styles.metricTop}>
                        <p style={styles.metricLabel}>Affected Families</p>
                        <FiHome size={20} color={COLORS.primary} />
                      </div>
                      <h3 style={styles.metricValue}>
                        {disaster.affectedFamilies.toLocaleString()}
                      </h3>
                      <p style={styles.metricSubtext}>
                        Households needing assistance
                      </p>
                    </div>

                    <div style={styles.metricCard}>
                      <div style={styles.metricTop}>
                        <p style={styles.metricLabel}>Affected Individuals</p>
                        <FiUsers size={20} color={COLORS.primary} />
                      </div>
                      <h3 style={styles.metricValue}>
                        {disaster.affectedIndividuals.toLocaleString()}
                      </h3>
                      <p style={styles.metricSubtext}>
                        People currently affected
                      </p>
                    </div>

                    <div style={styles.metricCard}>
                      <div style={styles.metricTop}>
                        <p style={styles.metricLabel}>Needed Items</p>
                        <FiPackage size={20} color={COLORS.primary} />
                      </div>
                      <h3 style={styles.metricValue}>
                        {disaster.neededItemsTotal.toLocaleString()}
                      </h3>
                      <p style={styles.metricSubtext}>
                        Total items currently required
                      </p>
                    </div>
                  </div>

                  <div style={styles.contentGrid}>
                    <div style={styles.subSection}>
                      <h3 style={styles.subSectionTitle}>Urgent Needs</h3>
                      <div style={styles.urgentList}>
                        {disaster.urgentNeeds.length === 0 ? (
                          <p style={styles.inlineEmptyText}>
                            No event-linked inventory summary is available yet for
                            this active disaster.
                          </p>
                        ) : (
                          disaster.urgentNeeds.map((item) => {
                            const urgentStyle = getUrgentStyles(item.level);

                            return (
                              <div
                                key={item.id}
                                style={{
                                  ...styles.urgentCard,
                                  background: urgentStyle.background,
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    gap: "12px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <div>
                                    <h4 style={styles.urgentTitle}>
                                      {item.name}
                                    </h4>
                                    <p style={styles.urgentMeta}>
                                      {item.needed.toLocaleString()} {item.unit} needed
                                    </p>
                                  </div>

                                  <span
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 800,
                                      textTransform: "uppercase",
                                      color: urgentStyle.color,
                                    }}
                                  >
                                    {item.level}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div style={styles.subSection}>
                      <h3 style={styles.subSectionTitle}>Affected Areas</h3>
                      <div style={styles.areaList}>
                        {disaster.areaBreakdown.length === 0 ? (
                          <p style={styles.inlineEmptyText}>
                            No barangay-level impact summary is available yet for
                            this active disaster.
                          </p>
                        ) : (
                          disaster.areaBreakdown.map((area) => (
                            <div key={area.area} style={styles.areaCard}>
                              <h4 style={styles.areaName}>{area.area}</h4>
                              <div style={styles.areaRow}>
                                <span>Families</span>
                                <strong>{area.families.toLocaleString()}</strong>
                              </div>
                              <div style={styles.areaRow}>
                                <span>Individuals</span>
                                <strong>{area.individuals.toLocaleString()}</strong>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              ))
            : null}
        </div>

        <DropOffLocationSection />

        <PortalFooter />
      </div>
    </div>
  );
};

export default DonationInformationPage;
