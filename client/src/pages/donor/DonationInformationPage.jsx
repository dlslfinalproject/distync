import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiHome,
  FiMail,
  FiMapPin,
  FiPackage,
  FiPhone,
  FiUsers,
} from "react-icons/fi";
import { fetchActiveDisasterEvents } from "../../features/disaster-events/disasterEventService";
import { fetchInventoryBatches } from "../../features/inventory-batches/inventoryBatchService";
import { fetchInventoryTransactions } from "../../features/inventory-transactions/inventoryTransactionService";
import { fetchMasterlistOperationalAnalytics } from "../../features/mswdo-analytics/mswdoAnalyticsService";

const COLORS = {
  pageBg: "#f4f8fc",
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
  address: "Malvar Municipal Hall, Malvar, Batangas",
  phone: "(043) 778-1234",
  email: "malvarlgu@gmail.com",
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
    minHeight: "100vh",
    background: "transparent",
    padding: 0,
    boxSizing: "border-box",
    fontFamily: "Inter, Segoe UI, sans-serif",
    color: COLORS.text,
  },
  pageInner: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
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
  },
  heroCard: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "20px",
    padding: "24px",
    boxShadow: "0 10px 30px rgba(23, 50, 77, 0.06)",
  },
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
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
    fontSize: "32px",
    fontWeight: 800,
    color: COLORS.text,
  },
  subtitle: {
    margin: 0,
    fontSize: "15px",
    color: COLORS.subtext,
    lineHeight: 1.6,
    maxWidth: "820px",
  },
  statusWrap: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
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
  contactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
    marginTop: "20px",
  },
  contactCard: {
    background: COLORS.softBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "14px",
    padding: "14px 16px",
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },
  contactTitle: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    color: COLORS.subtext,
    letterSpacing: "0.04em",
  },
  contactText: {
    margin: "4px 0 0",
    fontSize: "14px",
    color: COLORS.text,
    lineHeight: 1.5,
  },
  disasterCard: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "18px",
    padding: "22px",
    boxShadow: "0 10px 24px rgba(23, 50, 77, 0.04)",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
    gridTemplateColumns: "1.2fr 1fr",
    gap: "18px",
  },
  subSection: {
    background: COLORS.cardBg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: "16px",
    padding: "18px",
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
};

const formatDate = (value) => {
  if (!value) return "--";

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const formatUpdatedAt = (value) => {
  if (!value) return "--";

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
  if (!status) return "Unknown";

  const normalizedStatus = String(status).toLowerCase();
  return normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);
};

const getUrgentStyles = (level) => {
  if (level === "critical") {
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

const buildInventoryLookup = (inventoryBatches) => {
  const inventoryByItemId = new Map();

  (inventoryBatches || []).forEach((batch) => {
    const itemId = batch.inventory_item?.id || batch.inventory_item_id;

    if (!itemId) return;

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

        if (!itemId) return;

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

const HeroSection = ({ activeCount }) => {
  const hasActiveDisasters = activeCount > 0;

  return (
    <section style={styles.heroCard}>
      <div style={styles.heroTop}>
        <div>
          <h1 style={styles.title}>Disaster Response Overview</h1>
          <p style={styles.subtitle}>
            {hasActiveDisasters
              ? "This dashboard helps donors and NGOs understand which active disasters require support, how many families and individuals are affected, and which items are urgently needed across Malvar, Batangas."
              : "This portal provides public-facing disaster response information for donors and NGOs in Malvar, Batangas. When there are no active disaster events, the page remains available for monitoring and contact reference."}
          </p>
        </div>

        {hasActiveDisasters ? (
          <div style={styles.statusWrap}>
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
          </div>
        ) : null}
      </div>

      <div style={styles.contactGrid}>
        <div style={styles.contactCard}>
          <FiMapPin size={18} color={COLORS.primary} />
          <div>
            <p style={styles.contactTitle}>Address</p>
            <p style={styles.contactText}>{LGU_CONTACT.address}</p>
          </div>
        </div>

        <div style={styles.contactCard}>
          <FiPhone size={18} color={COLORS.primary} />
          <div>
            <p style={styles.contactTitle}>Contact Number</p>
            <p style={styles.contactText}>{LGU_CONTACT.phone}</p>
          </div>
        </div>

        <div style={styles.contactCard}>
          <FiMail size={18} color={COLORS.primary} />
          <div>
            <p style={styles.contactTitle}>Email</p>
            <p style={styles.contactText}>{LGU_CONTACT.email}</p>
          </div>
        </div>
      </div>
    </section>
  );
};

const DonationInformationPage = () => {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState({
    isLoading: true,
    errorMessage: "",
    activeDisasters: [],
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
        const activeEvents = await fetchActiveDisasterEvents();

        if (!isMounted) return;

        if (!Array.isArray(activeEvents) || activeEvents.length === 0) {
          setPageState({
            isLoading: false,
            errorMessage: "",
            activeDisasters: [],
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

        if (!isMounted) return;

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
          lastUpdatedAt: getLatestTimestamp([
            ...activeEvents.map((event) => event.updated_at),
            ...(inventoryTransactions || []).map(
              (transaction) =>
                transaction.performed_at || transaction.created_at,
            ),
          ]),
        });
      } catch (error) {
        if (!isMounted) return;

        setPageState({
          isLoading: false,
          errorMessage: error.message || "Failed to load donation information.",
          activeDisasters: [],
          lastUpdatedAt: new Date().toISOString(),
        });
      }
    };

    loadDonationOverview();

    return () => {
      isMounted = false;
    };
  }, []);

  const { isLoading, errorMessage, activeDisasters, lastUpdatedAt } = pageState;
  const hasActiveDisasters = activeDisasters.length > 0;

  return (
    <div style={styles.page}>
      <div style={styles.pageInner}>
        <div style={styles.backButtonWrap}>
          <button
            type="button"
            onClick={() => navigate("/role-switcher")}
            style={styles.backButton}
          >
            <FiArrowLeft size={16} />
            Back
          </button>
        </div>

        <HeroSection activeCount={activeDisasters.length} />

        {isLoading ? (
          <section style={styles.messageCard}>
            <h2 style={styles.messageTitle}>
              Loading Disaster Response Overview
            </h2>
            <p style={styles.messageText}>
              Fetching the latest active disaster, masterlist, and inventory
              records used by the LGU modules.
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
                                }}
                              >
                                <div>
                                  <h4 style={styles.urgentTitle}>
                                    {item.name}
                                  </h4>
                                  <p style={styles.urgentMeta}>
                                    {item.needed.toLocaleString()} {item.unit}{" "}
                                    needed
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
                              <strong>
                                {area.individuals.toLocaleString()}
                              </strong>
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
    </div>
  );
};

export default DonationInformationPage;
