import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  FiActivity,
  FiBell,
  FiClock,
  FiRefreshCw,
  FiShield,
  FiUser,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import FeedbackToast from "../../components/shared/FeedbackToast";
import { useAuth } from "../../context/AuthContext";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
} from "../../features/disaster-events/disasterEventService";
import { fetchDistributionHistory } from "../../features/distribution/distributionService";
import {
  fetchForecastHealth,
  fetchInventoryItems,
} from "../../features/inventory-items/inventoryItemService";
import {
  fetchCurrentNotificationRules,
  fetchUnreadNotificationCount,
} from "../../features/notifications/notificationService";
import {
  loadRoleSettings,
  saveRoleSettings,
} from "../../features/settings/settingsService";
import {
  buildPayloadSummary,
  formatSyncDateTime,
} from "../../features/sync/syncManagementHelpers";
import { fetchSyncHistory } from "../../features/sync/syncHistoryService";
import db, { LOCAL_SYNC_STATUS } from "../../offline/db";
import {
  flushPendingSyncEntries,
  subscribeToSyncUpdates,
} from "../../offline/syncService";
import { ROLE_CODES } from "../../utils/roleSession";

const gridStyles = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
};

const cardStyles = {
  border: "1px solid #dbe6f0",
  borderRadius: "18px",
  padding: "18px",
  backgroundColor: "#fbfdff",
  display: "grid",
  gap: "12px",
};

const settingsHubStyles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  button: {
    border: "1px solid #dbe6f0",
    borderRadius: "20px",
    padding: "20px",
    background:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 249, 255, 0.98) 100%)",
    display: "grid",
    gap: "18px",
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
    color: "#17324d",
    boxShadow: "0 14px 28px rgba(70, 101, 136, 0.08)",
    transition:
      "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
  },
  iconBadge: {
    width: "48px",
    height: "48px",
    borderRadius: "16px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8f1fb",
    color: "#2f6499",
    flexShrink: 0,
  },
  openLabel: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#2f6499",
  },
};

const labelStyles = {
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#66809c",
  fontWeight: 700,
  margin: 0,
};

const valueStyles = {
  margin: 0,
  color: "#17324d",
  fontSize: "16px",
  fontWeight: 700,
};

const mutedValueStyles = {
  margin: 0,
  color: "#60738a",
  fontSize: "14px",
  lineHeight: 1.6,
};

const inputStyles = {
  field: {
    minHeight: "44px",
    borderRadius: "12px",
    border: "1px solid #c9d7e6",
    backgroundColor: "#ffffff",
    padding: "10px 12px",
    color: "#21405f",
    fontSize: "14px",
    width: "100%",
    boxSizing: "border-box",
  },
  textarea: {
    minHeight: "96px",
    resize: "vertical",
  },
};

const statusChipStyles = {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 800,
  },
  success: {
    backgroundColor: "#edf8f1",
    color: "#2f6c47",
  },
  warning: {
    backgroundColor: "#fff6e8",
    color: "#9a6519",
  },
  error: {
    backgroundColor: "#fff3f1",
    color: "#9d4d58",
  },
  info: {
    backgroundColor: "#eef6ff",
    color: "#2a4c6f",
  },
};

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "12px 14px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px",
    borderBottom: "1px solid #edf3f8",
    color: "#21405f",
    fontSize: "14px",
    verticalAlign: "top",
    lineHeight: 1.5,
  },
};

const BARANGAY_SETTINGS_SECTIONS = [
  {
    key: "profile",
    label: "Profile",
    description: "Update local identity details, contact information, and profile photo.",
    icon: FiUser,
  },
  {
    key: "security",
    label: "Security",
    description: "Review device-level security preferences and password-related checks.",
    icon: FiShield,
  },
  {
    key: "notification-preferences",
    label: "Notification Preferences",
    description: "Control in-app and email alert preferences for barangay coordination.",
    icon: FiBell,
  },
  {
    key: "distribution-history",
    label: "Distribution History",
    description: "Inspect barangay distribution records and open the full history page when needed.",
    icon: FiClock,
  },
  {
    key: "sync-center",
    label: "Sync Center",
    description: "Monitor queue health, sync logs, and LGU data alignment status.",
    icon: FiRefreshCw,
  },
  {
    key: "activity-logs",
    label: "Activity Logs",
    description: "Review recent frontend-visible actions captured on this device.",
    icon: FiActivity,
  },
];

const EDITABLE_BARANGAY_SECTION_KEYS = new Set([
  "profile",
  "security",
  "notification-preferences",
]);

const BARANGAY_NOTIFICATION_OPTIONS = [
  { key: "disasterAlerts", label: "Disaster Alerts" },
  { key: "distributionSchedules", label: "Distribution Schedules" },
  { key: "reliefArrivalNotifications", label: "Relief Arrival Notifications" },
  { key: "attendanceReminders", label: "Attendance Reminders" },
  { key: "systemAnnouncements", label: "System Announcements" },
];

const BARANGAY_POSITION_OPTIONS = [
  "Barangay Captain",
  "Barangay Secretary",
  "Barangay Kagawad",
  "Barangay Treasurer",
  "Barangay Health Worker",
  "SK Chairperson",
  "Barangay Official",
];

const createDefaultNotificationChannels = () =>
  BARANGAY_NOTIFICATION_OPTIONS.reduce((current, option) => {
    current[option.key] = {
      inApp: true,
      email: false,
    };
    return current;
  }, {});

const createDefaultRolePreferences = () => ({
  enabledNotificationRuleCodes: [],
  preferredExportFormat: "excel",
  profile: {
    fullName: "",
    position: "Barangay Official",
    contactNumber: "",
    emailAddress: "",
    profilePictureDataUrl: "",
    profilePictureFileName: "",
  },
  notificationChannels: createDefaultNotificationChannels(),
  security: {
    twoFactorEnabled: false,
    lastLocalPasswordChangeAt: "",
  },
  metadata: {
    lastProfileUpdateAt: "",
    lastPreferenceSaveAt: "",
  },
});

const normalizeRolePreferences = (value = {}) => {
  const defaults = createDefaultRolePreferences();
  const notificationChannels = {
    ...defaults.notificationChannels,
  };

  Object.entries(value?.notificationChannels || {}).forEach(([key, channels]) => {
    notificationChannels[key] = {
      ...(defaults.notificationChannels[key] || { inApp: true, email: false }),
      ...(channels || {}),
    };
  });

  return {
    ...defaults,
    ...(value || {}),
    enabledNotificationRuleCodes: Array.isArray(value?.enabledNotificationRuleCodes)
      ? value.enabledNotificationRuleCodes
      : [],
    profile: {
      ...defaults.profile,
      ...(value?.profile || {}),
    },
    notificationChannels,
    security: {
      ...defaults.security,
      ...(value?.security || {}),
    },
    metadata: {
      ...defaults.metadata,
      ...(value?.metadata || {}),
    },
  };
};

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
};

const buildSyncSummary = (syncEntries) => {
  return syncEntries.reduce(
    (summary, entry) => {
      summary.total += 1;
      summary[entry.status] = (summary[entry.status] || 0) + 1;
      return summary;
    },
    {
      total: 0,
      [LOCAL_SYNC_STATUS.PENDING]: 0,
      [LOCAL_SYNC_STATUS.SYNCED]: 0,
      [LOCAL_SYNC_STATUS.FAILED]: 0,
      [LOCAL_SYNC_STATUS.CONFLICT]: 0,
    },
  );
};

const getRoleMeta = (roleCode) => {
  switch (roleCode) {
    case ROLE_CODES.BARANGAY:
      return {
        title: "BARANGAY SETTINGS",
        description:
          "Manage barangay coordination settings, distribution visibility, sync readiness, and local notification preferences.",
      };
    case ROLE_CODES.MSWDO:
      return {
        title: "MSWDO SETTINGS",
        description:
          "Review office context, notification preferences, sync state, and report export preferences.",
      };
    case ROLE_CODES.MAYOR:
      return {
        title: "MAYOR SETTINGS",
        description:
          "Review office context, notification preferences, analytics availability, inventory alert references, and sync state.",
      };
    default:
      return {
        title: "SETTINGS",
        description: "Review account and operational settings.",
      };
  }
};

const getSyncStatusMeta = (syncSummary, isOnline) => {
  if (!isOnline) {
    return {
      tone: "warning",
      label: "Pending",
      description: "Offline mode is active. Local changes will sync later.",
    };
  }

  if (
    syncSummary[LOCAL_SYNC_STATUS.FAILED] > 0 ||
    syncSummary[LOCAL_SYNC_STATUS.CONFLICT] > 0
  ) {
    return {
      tone: "error",
      label: "Failed",
      description: "Some records need sync review before LGU coordination is complete.",
    };
  }

  if (syncSummary[LOCAL_SYNC_STATUS.PENDING] > 0) {
    return {
      tone: "warning",
      label: "Pending",
      description: "Queued records are waiting to be synced with the LGU.",
    };
  }

  return {
    tone: "success",
    label: "Synced",
    description: "Barangay records are currently aligned with the LGU data flow.",
  };
};

const safeParsePayload = (value) => {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return {};
    }
  }

  return typeof value === "object" ? value : {};
};

const buildDistributionSummaryRows = (rows = []) => {
  const groupedRows = new Map();

  rows.forEach((row) => {
    const groupKey = [
      row.receipt_no || "",
      row.event_code || "",
      row.disaster_event_title || "",
      row.distribution_date ? new Date(row.distribution_date).toDateString() : row.id,
      row.barangay_name || "",
    ].join("|");

    if (!groupedRows.has(groupKey)) {
      groupedRows.set(groupKey, {
        id: groupKey,
        distributionDate: row.distribution_date || "",
        disasterEventTitle: row.disaster_event_title || "--",
        eventCode: row.event_code || "--",
        reliefGoods: new Set(),
        totalQuantityReceived: 0,
        familyIds: new Set(),
        rawStatuses: new Set(),
        distributionReportLabel: row.receipt_no || "",
        distributionReportReceipt: row.receipt_no || "",
        photosSubmitted: 0,
      });
    }

    const currentGroup = groupedRows.get(groupKey);
    const reliefLabel =
      row.relief_pack_template_name || row.released_items_summary || "--";

    currentGroup.reliefGoods.add(reliefLabel);
    currentGroup.totalQuantityReceived += Number(row.total_quantity_released || 0);

    if (row.household_id) {
      currentGroup.familyIds.add(row.household_id);
    }

    if (row.distribution_status) {
      currentGroup.rawStatuses.add(row.distribution_status);
    }
  });

  return Array.from(groupedRows.values()).map((group) => {
    const hasOngoingStatus = Array.from(group.rawStatuses).some(
      (status) => !["CLAIMED", "CANCELLED", "REVERSED"].includes(status),
    );

    return {
      id: group.id,
      distributionDate: group.distributionDate,
      disasterEventTitle: group.disasterEventTitle,
      eventCode: group.eventCode,
      reliefGoodsReceived: Array.from(group.reliefGoods).join(", "),
      quantityReceived: group.totalQuantityReceived,
      familiesServed: group.familyIds.size,
      statusLabel: hasOngoingStatus ? "Ongoing" : "Completed",
      distributionReportLabel: group.distributionReportReceipt
        ? `Receipt ${group.distributionReportReceipt}`
        : "Open full history",
      photosSubmitted: group.photosSubmitted,
    };
  });
};

const formatQueueEntryTitle = (entry) => {
  const moduleLabel = entry?.moduleName
    ? String(entry.moduleName).replace(/[_-]/g, " ")
    : "record";
  const actionLabel = entry?.actionKey
    ? String(entry.actionKey).replace(/[_-]/g, " ")
    : "queued";

  return `${actionLabel} ${moduleLabel}`.replace(/\s+/g, " ").trim();
};

const buildActivityLogs = ({
  distributionRows,
  syncEntries,
  syncHistory,
  preferences,
}) => {
  const localActivityEntries = syncEntries.map((entry) => ({
    id: `queue-${entry.id}`,
    timestamp:
      entry.updatedAt || entry.createdAt || entry.clientTimestamp || entry.syncedAt || "",
    title: formatQueueEntryTitle(entry),
    detail: `Local sync queue - ${entry.status || "--"}`,
    tone:
      entry.status === LOCAL_SYNC_STATUS.FAILED ||
      entry.status === LOCAL_SYNC_STATUS.CONFLICT
        ? "error"
        : entry.status === LOCAL_SYNC_STATUS.PENDING
          ? "warning"
          : "success",
  }));

  const syncHistoryEntries = [
    ...(syncHistory.transactions || []).map((transaction, index) => {
      const payload = safeParsePayload(
        transaction.payload_json || transaction.payload || {},
      );

      return {
        id: `transaction-${transaction.id || index}`,
        timestamp:
          transaction.synced_at ||
          transaction.created_at ||
          transaction.client_timestamp ||
          transaction.updated_at ||
          "",
        title: `Synced ${String(transaction.module_name || "record").replace(
          /[_-]/g,
          " ",
        )}`,
        detail: buildPayloadSummary(payload),
        tone:
          transaction.sync_status === LOCAL_SYNC_STATUS.FAILED
            ? "error"
            : transaction.sync_status === LOCAL_SYNC_STATUS.CONFLICT
              ? "warning"
              : "success",
      };
    }),
    ...(syncHistory.conflicts || []).map((conflict, index) => ({
      id: `conflict-${conflict.id || index}`,
      timestamp:
        conflict.created_at || conflict.updated_at || conflict.resolved_at || "",
      title: `Sync conflict review for ${String(conflict.entity_type || "record").replace(
        /[_-]/g,
        " ",
      )}`,
      detail: conflict.conflict_type || "Conflict detected during sync.",
      tone: conflict.status === "RESOLVED" ? "success" : "warning",
    })),
  ];

  const distributionEntries = distributionRows.slice(0, 12).map((row) => ({
    id: `distribution-${row.id}`,
    timestamp: row.distribution_date || "",
    title: `Recorded distribution for ${row.disaster_event_title || row.event_code || "response"}`,
    detail:
      row.relief_pack_template_name || row.released_items_summary || "Relief goods released",
    tone: "info",
  }));

  const localSettingsEntries = [
    preferences.metadata?.lastProfileUpdateAt
      ? {
          id: "profile-update",
          timestamp: preferences.metadata.lastProfileUpdateAt,
          title: "Updated barangay profile details",
          detail: "Local settings profile data changed on this device.",
          tone: "info",
        }
      : null,
    preferences.metadata?.lastPreferenceSaveAt
      ? {
          id: "settings-save",
          timestamp: preferences.metadata.lastPreferenceSaveAt,
          title: "Saved barangay local settings",
          detail: "Notification and coordination preferences were saved locally.",
          tone: "success",
        }
      : null,
    preferences.security?.lastLocalPasswordChangeAt
      ? {
          id: "password-review",
          timestamp: preferences.security.lastLocalPasswordChangeAt,
          title: "Prepared password change review",
          detail:
            "Password fields were reviewed locally without changing backend authentication.",
          tone: "warning",
        }
      : null,
  ].filter(Boolean);

  return [
    ...localActivityEntries,
    ...syncHistoryEntries,
    ...distributionEntries,
    ...localSettingsEntries,
  ]
    .filter((entry) => entry.timestamp || entry.title)
    .sort((left, right) => {
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
      return rightTime - leftTime;
    });
};

const StatusChip = ({ tone = "info", label }) => (
  <span
    style={{
      ...statusChipStyles.base,
      ...(statusChipStyles[tone] || statusChipStyles.info),
    }}
  >
    {label}
  </span>
);

const InfoRow = ({ label, value, muted = false }) => (
  <div style={{ display: "grid", gap: "6px" }}>
    <p style={labelStyles}>{label}</p>
    <p style={muted ? mutedValueStyles : valueStyles}>{value}</p>
  </div>
);

const EmptyState = ({ message }) => (
  <p style={{ margin: 0, color: "#60738a", lineHeight: 1.6 }}>{message}</p>
);

const RoleSettingsPage = () => {
  const navigate = useNavigate();
  const { currentRole, authenticatedUser, clearSession } = useAuth();
  const syncEntries =
    useLiveQuery(() => db.syncQueue.orderBy("updatedAt").reverse().toArray(), [], []) ||
    [];
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notificationRules, setNotificationRules] = useState([]);
  const [assignedBarangayName, setAssignedBarangayName] = useState("--");
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeDisasterEvents, setActiveDisasterEvents] = useState([]);
  const [forecastHealth, setForecastHealth] = useState(null);
  const [inventoryThresholdSummary, setInventoryThresholdSummary] = useState(null);
  const [preferences, setPreferences] = useState(createDefaultRolePreferences());
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [distributionFilters, setDistributionFilters] = useState({
    disaster_event_id: "",
    status: "",
    date_from: "",
    date_to: "",
    sort_order: "latest",
  });
  const [distributionRows, setDistributionRows] = useState([]);
  const [isLoadingDistributionHistory, setIsLoadingDistributionHistory] =
    useState(false);
  const [distributionErrorMessage, setDistributionErrorMessage] = useState("");
  const [syncHistory, setSyncHistory] = useState({
    transactions: [],
    conflicts: [],
  });
  const [isLoadingSyncHistory, setIsLoadingSyncHistory] = useState(false);
  const [syncHistoryErrorMessage, setSyncHistoryErrorMessage] = useState("");
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [activeSection, setActiveSection] = useState(null);
  const [toast, setToast] = useState({
    message: "",
    type: "info",
    title: "",
  });
  const profilePictureInputRef = useRef(null);

  const roleMeta = useMemo(() => getRoleMeta(currentRole), [currentRole]);
  const syncSummary = useMemo(() => buildSyncSummary(syncEntries), [syncEntries]);
  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  const isBarangayRole = currentRole === ROLE_CODES.BARANGAY;

  useEffect(() => {
    if (!isBarangayRole) {
      setActiveSection(null);
      return;
    }

    setActiveSection((current) => {
      if (!current) {
        return null;
      }

      return BARANGAY_SETTINGS_SECTIONS.some((section) => section.key === current)
        ? current
        : null;
    });
  }, [isBarangayRole]);

  useEffect(() => {
    if (!currentRole || !authenticatedUser) {
      return;
    }

    setPreferences(
      normalizeRolePreferences(
        loadRoleSettings({
          roleCode: currentRole,
          userId: authenticatedUser.id,
        }),
      ),
    );
  }, [authenticatedUser, currentRole]);

  useEffect(() => {
    if (!authenticatedUser) {
      return;
    }

    setPreferences((current) => {
      const normalized = normalizeRolePreferences(current);
      const fallbackFullName =
        [authenticatedUser.first_name, authenticatedUser.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || "";
      const fallbackEmail = authenticatedUser.email || "";

      if (
        normalized.profile.fullName === fallbackFullName &&
        normalized.profile.emailAddress === fallbackEmail
      ) {
        return current;
      }

      if (normalized.profile.fullName && normalized.profile.emailAddress) {
        return current;
      }

      return {
        ...normalized,
        profile: {
          ...normalized.profile,
          fullName: normalized.profile.fullName || fallbackFullName,
          emailAddress: normalized.profile.emailAddress || fallbackEmail,
        },
      };
    });
  }, [authenticatedUser]);

  useEffect(() => {
    if (!notificationRules.length) {
      return;
    }

    setPreferences((current) => {
      if (current.enabledNotificationRuleCodes?.length > 0) {
        return current;
      }

      return {
        ...current,
        enabledNotificationRuleCodes: notificationRules.map((rule) => rule.code),
      };
    });
  }, [notificationRules]);

  useEffect(() => {
    const loadSettingsData = async () => {
      if (!currentRole || !authenticatedUser) {
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const requests = [
          fetchCurrentNotificationRules(),
          fetchUnreadNotificationCount(),
        ];

        if (authenticatedUser.default_barangay_id) {
          requests.push(fetchBarangays());
        } else {
          requests.push(Promise.resolve([]));
        }

        if (currentRole === ROLE_CODES.BARANGAY || currentRole === ROLE_CODES.MSWDO) {
          requests.push(fetchActiveDisasterEvents());
        } else {
          requests.push(Promise.resolve([]));
        }

        if (currentRole === ROLE_CODES.MAYOR) {
          requests.push(fetchForecastHealth().catch(() => null));
          requests.push(fetchInventoryItems({ is_active: true }).catch(() => []));
        } else {
          requests.push(Promise.resolve(null));
          requests.push(Promise.resolve([]));
        }

        const [
          notificationRuleResponse,
          unreadResponse,
          barangayResponse,
          activeDisasterResponse,
          forecastHealthResponse,
          inventoryItemsResponse,
        ] = await Promise.all(requests);

        const rules = Array.isArray(notificationRuleResponse?.data)
          ? notificationRuleResponse.data
          : [];
        setNotificationRules(rules);
        setUnreadCount(Number(unreadResponse?.unread_count || 0));

        if (authenticatedUser.default_barangay_id && Array.isArray(barangayResponse)) {
          const assignedBarangay = barangayResponse.find(
            (barangay) => barangay.id === authenticatedUser.default_barangay_id,
          );
          setAssignedBarangayName(assignedBarangay?.name || "--");
        } else {
          setAssignedBarangayName("--");
        }

        const activeEvents = Array.isArray(activeDisasterResponse)
          ? activeDisasterResponse
          : Array.isArray(activeDisasterResponse?.data)
            ? activeDisasterResponse.data
            : [];
        setActiveDisasterEvents(activeEvents);

        setForecastHealth(forecastHealthResponse?.data || null);

        const inventoryItems = Array.isArray(inventoryItemsResponse)
          ? inventoryItemsResponse
          : Array.isArray(inventoryItemsResponse?.data)
            ? inventoryItemsResponse.data
            : [];

        if (inventoryItems.length > 0) {
          const distinctThresholds = [
            ...new Set(
              inventoryItems
                .map((item) => item.low_stock_threshold)
                .filter((value) => value !== null && value !== undefined),
            ),
          ];

          setInventoryThresholdSummary({
            configured_items: inventoryItems.length,
            distinct_thresholds: distinctThresholds,
          });
        } else {
          setInventoryThresholdSummary({
            configured_items: 0,
            distinct_thresholds: [],
          });
        }
      } catch (error) {
        setErrorMessage(error.message || "Failed to load settings.");
      } finally {
        setIsLoading(false);
      }
    };

    loadSettingsData();
  }, [authenticatedUser, currentRole]);

  useEffect(() => {
    if (!isBarangayRole) {
      return;
    }

    let isMounted = true;

    const loadDistributionData = async () => {
      setIsLoadingDistributionHistory(true);
      setDistributionErrorMessage("");

      try {
        const response = await fetchDistributionHistory({
          disaster_event_id: distributionFilters.disaster_event_id,
          date_from: distributionFilters.date_from,
          date_to: distributionFilters.date_to,
          limit: 100,
        });

        if (!isMounted) {
          return;
        }

        setDistributionRows(Array.isArray(response?.data) ? response.data : []);
      } catch (error) {
        if (isMounted) {
          setDistributionRows([]);
          setDistributionErrorMessage(
            error.message || "Failed to load barangay distribution history.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingDistributionHistory(false);
        }
      }
    };

    loadDistributionData();

    return () => {
      isMounted = false;
    };
  }, [
    distributionFilters.date_from,
    distributionFilters.date_to,
    distributionFilters.disaster_event_id,
    isBarangayRole,
  ]);

  useEffect(() => {
    if (!isBarangayRole) {
      return;
    }

    let isMounted = true;

    const loadBarangaySyncHistory = async () => {
      setIsLoadingSyncHistory(true);
      setSyncHistoryErrorMessage("");

      try {
        const response = await fetchSyncHistory({ limit: 20 });

        if (!isMounted) {
          return;
        }

        setSyncHistory({
          transactions: Array.isArray(response?.transactions)
            ? response.transactions
            : [],
          conflicts: Array.isArray(response?.conflicts) ? response.conflicts : [],
        });
      } catch (error) {
        if (isMounted) {
          setSyncHistory({
            transactions: [],
            conflicts: [],
          });
          setSyncHistoryErrorMessage(
            error.message || "Failed to load barangay sync history.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingSyncHistory(false);
        }
      }
    };

    loadBarangaySyncHistory();

    const unsubscribe = subscribeToSyncUpdates(() => {
      if (typeof navigator === "undefined" || navigator.onLine) {
        void loadBarangaySyncHistory();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isBarangayRole]);

  const toggleNotificationRule = (ruleCode) => {
    setPreferences((current) => {
      const selectedCodes = new Set(current.enabledNotificationRuleCodes || []);

      if (selectedCodes.has(ruleCode)) {
        selectedCodes.delete(ruleCode);
      } else {
        selectedCodes.add(ruleCode);
      }

      return {
        ...current,
        enabledNotificationRuleCodes: Array.from(selectedCodes),
      };
    });
  };

  const handleSavePreferences = async () => {
    if (!currentRole || !authenticatedUser) {
      return;
    }

    setIsSavingPreferences(true);

    try {
      const updatedSettings = {
        ...preferences,
        metadata: {
          ...preferences.metadata,
          lastPreferenceSaveAt: new Date().toISOString(),
        },
      };

      saveRoleSettings({
        roleCode: currentRole,
        userId: authenticatedUser.id,
        settings: updatedSettings,
      });

      setPreferences(updatedSettings);
      setToast({
        type: "success",
        title: "Settings Saved",
        message: "Your local role settings were saved successfully.",
      });
    } catch (error) {
      setToast({
        type: "error",
        title: "Save Failed",
        message: error.message || "Failed to save role settings.",
      });
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleProfileFieldChange = (field, value) => {
    setPreferences((current) => ({
      ...current,
      profile: {
        ...current.profile,
        [field]: value,
      },
      metadata: {
        ...current.metadata,
        lastProfileUpdateAt: new Date().toISOString(),
      },
    }));
  };

  const handleNotificationChannelToggle = (channelKey, type) => {
    setPreferences((current) => ({
      ...current,
      notificationChannels: {
        ...current.notificationChannels,
        [channelKey]: {
          ...current.notificationChannels[channelKey],
          [type]: !current.notificationChannels[channelKey]?.[type],
        },
      },
    }));
  };

  const handleProfilePictureChange = async (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      setToast({
        type: "error",
        title: "Profile Picture Error",
        message: "Please choose a valid image file for the profile picture.",
      });
      return;
    }

    const fileReader = new FileReader();

    fileReader.onload = () => {
      setPreferences((current) => ({
        ...current,
        profile: {
          ...current.profile,
          profilePictureDataUrl: String(fileReader.result || ""),
          profilePictureFileName: selectedFile.name || "Profile picture",
        },
        metadata: {
          ...current.metadata,
          lastProfileUpdateAt: new Date().toISOString(),
        },
      }));
    };

    fileReader.onerror = () => {
      setToast({
        type: "error",
        title: "Profile Picture Error",
        message: "Failed to read the selected image file.",
      });
    };

    fileReader.readAsDataURL(selectedFile);
  };

  const handleLocalPasswordReview = () => {
    if (!securityForm.currentPassword || !securityForm.newPassword) {
      setToast({
        type: "error",
        title: "Security Review Incomplete",
        message: "Enter the current and new password fields before reviewing.",
      });
      return;
    }

    if (securityForm.newPassword.length < 8) {
      setToast({
        type: "error",
        title: "Password Too Short",
        message: "Use at least 8 characters for the new password field.",
      });
      return;
    }

    if (securityForm.newPassword !== securityForm.confirmPassword) {
      setToast({
        type: "error",
        title: "Password Mismatch",
        message: "The new password and confirmation do not match.",
      });
      return;
    }

    setPreferences((current) => ({
      ...current,
      security: {
        ...current.security,
        lastLocalPasswordChangeAt: new Date().toISOString(),
      },
    }));
    setSecurityForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setToast({
      type: "info",
      title: "Frontend-Only Review",
      message:
        "Password review was captured locally for UI testing. Authentication backend behavior was not changed.",
    });
  };

  const handleSyncNow = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setToast({
        type: "warning",
        title: "Offline Mode",
        message: "Reconnect to the internet before syncing barangay records.",
      });
      return;
    }

    if (
      syncSummary[LOCAL_SYNC_STATUS.PENDING] === 0 &&
      syncSummary[LOCAL_SYNC_STATUS.FAILED] === 0
    ) {
      setToast({
        type: "info",
        title: "Nothing To Sync",
        message: "No pending barangay records are waiting for sync right now.",
      });
      return;
    }

    setIsSyncingNow(true);

    try {
      await flushPendingSyncEntries();
      setToast({
        type: "success",
        title: "Sync Requested",
        message: "Barangay sync processing started using the existing DISTYNC queue.",
      });
    } catch (error) {
      setToast({
        type: "error",
        title: "Sync Failed",
        message: error.message || "Failed to start the current sync request.",
      });
    } finally {
      setIsSyncingNow(false);
    }
  };

  const notificationRuleCount = notificationRules.length;
  const enabledRuleCodes =
    preferences.enabledNotificationRuleCodes?.length > 0
      ? preferences.enabledNotificationRuleCodes
      : notificationRules.map((rule) => rule.code);

  const distributionHistoryRows = useMemo(() => {
    const summaryRows = buildDistributionSummaryRows(distributionRows);
    const filteredRows = distributionFilters.status
      ? summaryRows.filter(
          (row) => row.statusLabel.toUpperCase() === distributionFilters.status,
        )
      : summaryRows;

    return filteredRows.sort((left, right) => {
      const leftTime = left.distributionDate
        ? new Date(left.distributionDate).getTime()
        : 0;
      const rightTime = right.distributionDate
        ? new Date(right.distributionDate).getTime()
        : 0;

      return distributionFilters.sort_order === "oldest"
        ? leftTime - rightTime
        : rightTime - leftTime;
    });
  }, [distributionFilters.sort_order, distributionFilters.status, distributionRows]);

  const distributionEventOptions = useMemo(() => {
    const options = new Map();

    activeDisasterEvents.forEach((eventRow) => {
      options.set(eventRow.id, {
        id: eventRow.id,
        label: `${eventRow.event_code || "--"} - ${eventRow.title || "--"}`,
      });
    });

    distributionRows.forEach((row) => {
      if (!row.disaster_event_id) {
        return;
      }

      if (!options.has(row.disaster_event_id)) {
        options.set(row.disaster_event_id, {
          id: row.disaster_event_id,
          label: `${row.event_code || "--"} - ${row.disaster_event_title || "--"}`,
        });
      }
    });

    return Array.from(options.values());
  }, [activeDisasterEvents, distributionRows]);

  const syncHistoryLogRows = useMemo(() => {
    return [
      ...(syncHistory.transactions || []).map((transaction, index) => ({
        id: `transaction-${transaction.id || index}`,
        timestamp:
          transaction.synced_at ||
          transaction.created_at ||
          transaction.client_timestamp ||
          transaction.updated_at ||
          "",
        label: String(transaction.module_name || "record").replace(/[_-]/g, " "),
        status:
          transaction.sync_status ||
          transaction.status ||
          LOCAL_SYNC_STATUS.SYNCED,
        detail: buildPayloadSummary(
          safeParsePayload(transaction.payload_json || transaction.payload || {}),
        ),
      })),
      ...(syncHistory.conflicts || []).map((conflict, index) => ({
        id: `conflict-${conflict.id || index}`,
        timestamp:
          conflict.updated_at || conflict.created_at || conflict.resolved_at || "",
        label: String(conflict.entity_type || "record").replace(/[_-]/g, " "),
        status: conflict.status === "RESOLVED" ? "RESOLVED" : "CONFLICT",
        detail: conflict.conflict_type || "Conflict detected during sync.",
      })),
    ].sort((left, right) => {
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
      return rightTime - leftTime;
    });
  }, [syncHistory]);

  const activityLogs = useMemo(
    () =>
      buildActivityLogs({
        distributionRows,
        syncEntries,
        syncHistory,
        preferences,
      }).slice(0, 16),
    [distributionRows, preferences, syncEntries, syncHistory],
  );

  const activeBarangaySection = useMemo(
    () =>
      BARANGAY_SETTINGS_SECTIONS.find((section) => section.key === activeSection) ||
      null,
    [activeSection],
  );

  const barangaySectionCards = useMemo(() => {
    const syncStatus = getSyncStatusMeta(syncSummary, isOnline);

    return BARANGAY_SETTINGS_SECTIONS.map((section) => {
      switch (section.key) {
        case "profile":
          return {
            ...section,
            statusTone: preferences.profile.fullName ? "success" : "warning",
            statusLabel: preferences.profile.fullName
              ? "Profile ready"
              : "Needs details",
          };
        case "security":
          return {
            ...section,
            statusTone: preferences.security.twoFactorEnabled ? "success" : "info",
            statusLabel: preferences.security.twoFactorEnabled
              ? "2FA preferred"
              : "Review settings",
          };
        case "notification-preferences":
          return {
            ...section,
            statusTone: enabledRuleCodes.length > 0 ? "success" : "warning",
            statusLabel: `${enabledRuleCodes.length} rules enabled`,
          };
        case "distribution-history":
          return {
            ...section,
            statusTone: distributionHistoryRows.length > 0 ? "info" : "warning",
            statusLabel: `${distributionHistoryRows.length} records`,
          };
        case "sync-center":
          return {
            ...section,
            statusTone: syncStatus.tone,
            statusLabel: syncStatus.label,
          };
        case "activity-logs":
          return {
            ...section,
            statusTone: activityLogs.length > 0 ? "info" : "warning",
            statusLabel:
              activityLogs.length > 0
                ? `${activityLogs.length} recent items`
                : "No recent items",
          };
        default:
          return {
            ...section,
            statusTone: "info",
            statusLabel: "Open section",
          };
      }
    });
  }, [
    activityLogs.length,
    distributionHistoryRows.length,
    enabledRuleCodes.length,
    isOnline,
    preferences.profile.fullName,
    preferences.security.twoFactorEnabled,
    syncSummary,
  ]);

  const barangayPageActions = activeBarangaySection
    ? [
        {
          label: "Back to Categories",
          onClick: () => setActiveSection(null),
          variant: "secondary",
        },
        ...(
          EDITABLE_BARANGAY_SECTION_KEYS.has(activeBarangaySection.key)
            ? [
                {
                  label: isSavingPreferences ? "Saving..." : "Save Barangay Settings",
                  onClick: handleSavePreferences,
                  disabled: isSavingPreferences,
                },
              ]
            : []
        ),
      ]
    : [];

  const renderBarangaySectionContent = () => {
    switch (activeSection) {
      case "profile":
        return (
          <section style={shellStyles.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "20px",
                flexWrap: "wrap",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "grid", gap: "8px", flex: "1 1 320px" }}>
                <h3 style={{ margin: 0, color: "#17324d" }}>Profile Settings</h3>
                <p style={mutedValueStyles}>
                  Manage the barangay official identity shown in this frontend
                  client while keeping the assigned barangay locked for coordination
                  safety.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection("security")}
                style={pageHeaderStyles.secondaryButton}
              >
                Change Password
              </button>
            </div>

            <div style={{ ...gridStyles, alignItems: "start" }}>
              <article style={cardStyles}>
                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="barangay-profile-full-name" style={labelStyles}>
                    Full Name
                  </label>
                  <input
                    id="barangay-profile-full-name"
                    value={preferences.profile.fullName}
                    onChange={(event) =>
                      handleProfileFieldChange("fullName", event.target.value)
                    }
                    style={inputStyles.field}
                  />
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="barangay-profile-position" style={labelStyles}>
                    Position
                  </label>
                  <select
                    id="barangay-profile-position"
                    value={preferences.profile.position}
                    onChange={(event) =>
                      handleProfileFieldChange("position", event.target.value)
                    }
                    style={inputStyles.field}
                  >
                    {BARANGAY_POSITION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="barangay-profile-name" style={labelStyles}>
                    Barangay Name
                  </label>
                  <input
                    id="barangay-profile-name"
                    value={assignedBarangayName}
                    readOnly
                    style={{
                      ...inputStyles.field,
                      backgroundColor: "#eef5fc",
                      color: "#4f6780",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="barangay-profile-contact" style={labelStyles}>
                    Contact Number
                  </label>
                  <input
                    id="barangay-profile-contact"
                    value={preferences.profile.contactNumber}
                    onChange={(event) =>
                      handleProfileFieldChange("contactNumber", event.target.value)
                    }
                    placeholder="Enter barangay contact number"
                    style={inputStyles.field}
                  />
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="barangay-profile-email" style={labelStyles}>
                    Email Address
                  </label>
                  <input
                    id="barangay-profile-email"
                    type="email"
                    value={preferences.profile.emailAddress}
                    onChange={(event) =>
                      handleProfileFieldChange("emailAddress", event.target.value)
                    }
                    style={inputStyles.field}
                  />
                </div>
              </article>

              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Profile Picture</h4>
                <div
                  style={{
                    width: "140px",
                    height: "140px",
                    borderRadius: "20px",
                    border: "1px solid #dbe6f0",
                    backgroundColor: "#eef5fc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {preferences.profile.profilePictureDataUrl ? (
                    <img
                      src={preferences.profile.profilePictureDataUrl}
                      alt="Barangay profile preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span style={{ ...mutedValueStyles, textAlign: "center" }}>
                      No profile picture selected
                    </span>
                  )}
                </div>
                <p style={mutedValueStyles}>
                  {preferences.profile.profilePictureFileName ||
                    "Upload a profile photo for local UI personalization."}
                </p>
                <input
                  ref={profilePictureInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  style={{ display: "none" }}
                />
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => profilePictureInputRef.current?.click()}
                    style={pageHeaderStyles.secondaryButton}
                  >
                    Upload / Change
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPreferences((current) => ({
                        ...current,
                        profile: {
                          ...current.profile,
                          profilePictureDataUrl: "",
                          profilePictureFileName: "",
                        },
                        metadata: {
                          ...current.metadata,
                          lastProfileUpdateAt: new Date().toISOString(),
                        },
                      }))
                    }
                    style={pageHeaderStyles.secondaryButton}
                  >
                    Remove
                  </button>
                </div>
              </article>
            </div>
          </section>
        );
      case "security":
        return (
          <section style={shellStyles.card}>
            <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Security Settings</h3>
              <p style={mutedValueStyles}>
                Keep security actions grouped here while staying transparent that
                this task does not change backend authentication behavior.
              </p>
            </div>

            <div style={gridStyles}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Change Password</h4>
                <p style={mutedValueStyles}>
                  This frontend review keeps the requested UI in place without
                  modifying the current authentication flow.
                </p>
                <input
                  type="password"
                  placeholder="Current password"
                  value={securityForm.currentPassword}
                  onChange={(event) =>
                    setSecurityForm((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                  }
                  style={inputStyles.field}
                />
                <input
                  type="password"
                  placeholder="New password"
                  value={securityForm.newPassword}
                  onChange={(event) =>
                    setSecurityForm((current) => ({
                      ...current,
                      newPassword: event.target.value,
                    }))
                  }
                  style={inputStyles.field}
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={securityForm.confirmPassword}
                  onChange={(event) =>
                    setSecurityForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  style={inputStyles.field}
                />
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleLocalPasswordReview}
                    style={pageHeaderStyles.primaryButton}
                  >
                    Review Password Change
                  </button>
                  <StatusChip
                    tone={
                      preferences.security.lastLocalPasswordChangeAt
                        ? "warning"
                        : "info"
                    }
                    label={
                      preferences.security.lastLocalPasswordChangeAt
                        ? `Last reviewed ${formatDateTime(
                            preferences.security.lastLocalPasswordChangeAt,
                          )}`
                        : "No local review yet"
                    }
                  />
                </div>
              </article>

              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>
                  Two-Factor Authentication
                </h4>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "#21405f",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.security.twoFactorEnabled)}
                    onChange={() =>
                      setPreferences((current) => ({
                        ...current,
                        security: {
                          ...current.security,
                          twoFactorEnabled: !current.security.twoFactorEnabled,
                        },
                      }))
                    }
                  />
                  Enable two-factor authentication preference for this role
                </label>
                <p style={mutedValueStyles}>
                  Stored locally as a coordination preference until centralized 2FA
                  management is introduced.
                </p>
                <StatusChip
                  tone={preferences.security.twoFactorEnabled ? "success" : "info"}
                  label={
                    preferences.security.twoFactorEnabled ? "Enabled" : "Optional"
                  }
                />
              </article>

              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Login Activity</h4>
                <div style={{ display: "grid", gap: "10px" }}>
                  <div>
                    <strong>Current browser session</strong>
                    <div style={mutedValueStyles}>
                      {preferences.profile.emailAddress ||
                        authenticatedUser?.email ||
                        "--"}
                    </div>
                  </div>
                  <div>
                    <strong>Last local settings save</strong>
                    <div style={mutedValueStyles}>
                      {formatDateTime(preferences.metadata.lastPreferenceSaveAt)}
                    </div>
                  </div>
                  <div>
                    <strong>Last password review</strong>
                    <div style={mutedValueStyles}>
                      {formatDateTime(preferences.security.lastLocalPasswordChangeAt)}
                    </div>
                  </div>
                </div>
              </article>

              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Session Actions</h4>
                <p style={mutedValueStyles}>
                  Existing session controls stay intact. Server-wide sign-out is
                  shown for planning visibility only.
                </p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => clearSession()}
                    style={pageHeaderStyles.secondaryButton}
                  >
                    Logout This Device
                  </button>
                  <button
                    type="button"
                    disabled
                    style={{
                      ...pageHeaderStyles.secondaryButton,
                      opacity: 0.6,
                      cursor: "not-allowed",
                    }}
                  >
                    Logout from All Devices
                  </button>
                </div>
              </article>
            </div>
          </section>
        );
      case "notification-preferences":
        return (
          <section style={shellStyles.card}>
            <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>
                Notification Preferences
              </h3>
              <p style={mutedValueStyles}>
                Manage local alert preferences for barangay coordination while
                keeping the existing rule-mapping behavior visible.
              </p>
            </div>

            <div style={{ ...gridStyles, alignItems: "start" }}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Alert Channels</h4>
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyles.table}>
                    <thead>
                      <tr>
                        <th style={tableStyles.th}>Notification Type</th>
                        <th style={tableStyles.th}>In-App</th>
                        <th style={tableStyles.th}>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {BARANGAY_NOTIFICATION_OPTIONS.map((option) => (
                        <tr key={option.key}>
                          <td style={tableStyles.td}>{option.label}</td>
                          <td style={tableStyles.td}>
                            <input
                              type="checkbox"
                              checked={Boolean(
                                preferences.notificationChannels[option.key]?.inApp,
                              )}
                              onChange={() =>
                                handleNotificationChannelToggle(option.key, "inApp")
                              }
                            />
                          </td>
                          <td style={tableStyles.td}>
                            <input
                              type="checkbox"
                              checked={Boolean(
                                preferences.notificationChannels[option.key]?.email,
                              )}
                              onChange={() =>
                                handleNotificationChannelToggle(option.key, "email")
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>
                  Existing Role Rule Mapping
                </h4>
                {notificationRules.length === 0 ? (
                  <EmptyState message="No notification rules are currently mapped to this role." />
                ) : (
                  <div style={{ display: "grid", gap: "10px" }}>
                    {notificationRules.map((rule) => {
                      const isEnabled = enabledRuleCodes.includes(rule.code);

                      return (
                        <label
                          key={rule.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "10px",
                            color: "#21405f",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => toggleNotificationRule(rule.code)}
                            style={{ marginTop: "3px" }}
                          />
                          <span>
                            <strong>{rule.name}</strong>
                            <span style={{ ...mutedValueStyles, display: "block" }}>
                              {rule.trigger_type} (
                              {rule.is_active ? "Active" : "Inactive"})
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </article>
            </div>
          </section>
        );
      case "distribution-history":
        return (
          <section style={shellStyles.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "20px",
                flexWrap: "wrap",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "grid", gap: "8px", flex: "1 1 320px" }}>
                <h3 style={{ margin: 0, color: "#17324d" }}>Distribution History</h3>
                <p style={mutedValueStyles}>
                  Review relief distributions tied to your barangay for audits,
                  coordination checks, and report preparation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/barangay/distribution-history")}
                style={pageHeaderStyles.secondaryButton}
              >
                Open Full History Page
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "14px",
                alignItems: "end",
                marginBottom: "20px",
              }}
            >
              <div>
                <label htmlFor="barangay-history-event" style={labelStyles}>
                  Disaster / Event
                </label>
                <select
                  id="barangay-history-event"
                  value={distributionFilters.disaster_event_id}
                  onChange={(event) =>
                    setDistributionFilters((current) => ({
                      ...current,
                      disaster_event_id: event.target.value,
                    }))
                  }
                  style={inputStyles.field}
                >
                  <option value="">All disaster events</option>
                  {distributionEventOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="barangay-history-status" style={labelStyles}>
                  Status
                </label>
                <select
                  id="barangay-history-status"
                  value={distributionFilters.status}
                  onChange={(event) =>
                    setDistributionFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  style={inputStyles.field}
                >
                  <option value="">All statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ONGOING">Ongoing</option>
                </select>
              </div>

              <div>
                <label htmlFor="barangay-history-date-from" style={labelStyles}>
                  Date From
                </label>
                <input
                  id="barangay-history-date-from"
                  type="date"
                  value={distributionFilters.date_from}
                  onChange={(event) =>
                    setDistributionFilters((current) => ({
                      ...current,
                      date_from: event.target.value,
                    }))
                  }
                  style={inputStyles.field}
                />
              </div>

              <div>
                <label htmlFor="barangay-history-date-to" style={labelStyles}>
                  Date To
                </label>
                <input
                  id="barangay-history-date-to"
                  type="date"
                  value={distributionFilters.date_to}
                  onChange={(event) =>
                    setDistributionFilters((current) => ({
                      ...current,
                      date_to: event.target.value,
                    }))
                  }
                  style={inputStyles.field}
                />
              </div>

              <div>
                <label htmlFor="barangay-history-sort" style={labelStyles}>
                  Sort
                </label>
                <select
                  id="barangay-history-sort"
                  value={distributionFilters.sort_order}
                  onChange={(event) =>
                    setDistributionFilters((current) => ({
                      ...current,
                      sort_order: event.target.value,
                    }))
                  }
                  style={inputStyles.field}
                >
                  <option value="latest">Latest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
            </div>

            {distributionErrorMessage ? (
              <p style={{ margin: "0 0 16px", color: "#9d4d58", fontWeight: 700 }}>
                {distributionErrorMessage}
              </p>
            ) : null}

            {isLoadingDistributionHistory ? (
              <EmptyState message="Loading barangay distribution history..." />
            ) : distributionHistoryRows.length === 0 ? (
              <EmptyState message="No barangay distribution history matches the current filters." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyles.table}>
                  <thead>
                    <tr>
                      <th style={tableStyles.th}>Distribution Date</th>
                      <th style={tableStyles.th}>Disaster / Event</th>
                      <th style={tableStyles.th}>Relief Goods Received</th>
                      <th style={tableStyles.th}>Quantity Received</th>
                      <th style={tableStyles.th}>Families Served</th>
                      <th style={tableStyles.th}>Status</th>
                      <th style={tableStyles.th}>Distribution Report (PDF)</th>
                      <th style={tableStyles.th}>Photos Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributionHistoryRows.map((row) => (
                      <tr key={row.id}>
                        <td style={tableStyles.td}>
                          {formatDateTime(row.distributionDate)}
                        </td>
                        <td style={tableStyles.td}>
                          <div style={{ fontWeight: 700 }}>{row.disasterEventTitle}</div>
                          <div style={{ ...mutedValueStyles, fontSize: "12px" }}>
                            {row.eventCode}
                          </div>
                        </td>
                        <td style={tableStyles.td}>{row.reliefGoodsReceived}</td>
                        <td style={tableStyles.td}>{row.quantityReceived}</td>
                        <td style={tableStyles.td}>{row.familiesServed}</td>
                        <td style={tableStyles.td}>
                          <StatusChip
                            tone={
                              row.statusLabel === "Completed" ? "success" : "warning"
                            }
                            label={row.statusLabel}
                          />
                        </td>
                        <td style={tableStyles.td}>
                          <button
                            type="button"
                            onClick={() => navigate("/barangay/distribution-history")}
                            style={pageHeaderStyles.secondaryButton}
                          >
                            {row.distributionReportLabel}
                          </button>
                        </td>
                        <td style={tableStyles.td}>{row.photosSubmitted || "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      case "sync-center":
        return (
          <section style={shellStyles.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "20px",
                flexWrap: "wrap",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "grid", gap: "8px", flex: "1 1 320px" }}>
                <h3 style={{ margin: 0, color: "#17324d" }}>Sync Center</h3>
                <p style={mutedValueStyles}>
                  Monitor whether barangay records are already aligned with the LGU
                  and review the most recent sync logs.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={isSyncingNow}
                  style={pageHeaderStyles.primaryButton}
                >
                  {isSyncingNow ? "Syncing..." : "Sync Now"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/barangay/sync")}
                  style={pageHeaderStyles.secondaryButton}
                >
                  Open Full Sync Center
                </button>
              </div>
            </div>

            <div style={gridStyles}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Sync Overview</h4>
                <InfoRow
                  label="Last Sync Date & Time"
                  value={formatSyncDateTime(syncHistoryLogRows[0]?.timestamp)}
                />
                <InfoRow
                  label="Pending Records"
                  value={`${syncSummary[LOCAL_SYNC_STATUS.PENDING] || 0}`}
                />
                <InfoRow
                  label="Failed / Conflict Records"
                  value={`${
                    (syncSummary[LOCAL_SYNC_STATUS.FAILED] || 0) +
                    (syncSummary[LOCAL_SYNC_STATUS.CONFLICT] || 0)
                  }`}
                />
                <StatusChip
                  tone={getSyncStatusMeta(syncSummary, isOnline).tone}
                  label={getSyncStatusMeta(syncSummary, isOnline).label}
                />
              </article>

              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Synced Record Types</h4>
                <div style={{ display: "grid", gap: "10px" }}>
                  {[
                    "Attendance Records",
                    "Beneficiary Lists",
                    "Distribution Records",
                    "Disaster Reports",
                  ].map((label) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <span style={{ color: "#21405f", fontWeight: 700 }}>{label}</span>
                      <StatusChip
                        tone="info"
                        label={syncHistoryLogRows.length > 0 ? "Tracked" : "Waiting"}
                      />
                    </div>
                  ))}
                </div>
              </article>
            </div>

            {syncHistoryErrorMessage ? (
              <p style={{ margin: "20px 0 0", color: "#9d4d58", fontWeight: 700 }}>
                {syncHistoryErrorMessage}
              </p>
            ) : null}

            <div style={{ marginTop: "20px" }}>
              <h4 style={{ margin: "0 0 12px", color: "#17324d" }}>Sync Logs</h4>
              {isLoadingSyncHistory ? (
                <EmptyState message="Loading sync logs..." />
              ) : syncHistoryLogRows.length === 0 ? (
                <EmptyState message="No sync logs are available yet for this barangay account." />
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyles.table}>
                    <thead>
                      <tr>
                        <th style={tableStyles.th}>Date & Time</th>
                        <th style={tableStyles.th}>Record Type</th>
                        <th style={tableStyles.th}>Status</th>
                        <th style={tableStyles.th}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncHistoryLogRows.slice(0, 12).map((row) => (
                        <tr key={row.id}>
                          <td style={tableStyles.td}>
                            {formatSyncDateTime(row.timestamp)}
                          </td>
                          <td style={tableStyles.td}>{row.label}</td>
                          <td style={tableStyles.td}>
                            <StatusChip
                              tone={
                                row.status === LOCAL_SYNC_STATUS.FAILED
                                  ? "error"
                                  : row.status === LOCAL_SYNC_STATUS.CONFLICT
                                    ? "warning"
                                    : row.status === "RESOLVED"
                                      ? "success"
                                      : "info"
                              }
                              label={row.status}
                            />
                          </td>
                          <td style={tableStyles.td}>{row.detail || "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        );
      case "activity-logs":
        return (
          <section style={shellStyles.card}>
            <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Activity Logs</h3>
              <p style={mutedValueStyles}>
                Review recent frontend-visible barangay actions in chronological
                order for accountability and transparency.
              </p>
            </div>

            {activityLogs.length === 0 ? (
              <EmptyState message="No recent activity logs are available for this device yet." />
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {activityLogs.map((entry) => (
                  <article
                    key={entry.id}
                    style={{
                      border: "1px solid #dbe6f0",
                      borderRadius: "16px",
                      padding: "16px 18px",
                      backgroundColor: "#fbfdff",
                      display: "grid",
                      gap: "6px",
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
                      <strong style={{ color: "#17324d" }}>{entry.title}</strong>
                      <StatusChip
                        tone={entry.tone || "info"}
                        label={entry.tone || "info"}
                      />
                    </div>
                    <p style={mutedValueStyles}>{entry.detail}</p>
                    <p style={{ ...mutedValueStyles, fontSize: "12px" }}>
                      {formatDateTime(entry.timestamp)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        );
      default:
        return null;
    }
  };

  if (isBarangayRole) {
    return (
      <>
        <PageHeader
          eyebrow={activeBarangaySection ? roleMeta.title : undefined}
          title={activeBarangaySection?.label || roleMeta.title}
          description={activeBarangaySection?.description || roleMeta.description}
          actions={barangayPageActions}
        />

        {errorMessage ? (
          <section style={shellStyles.card}>
            <p style={{ margin: 0, color: "#9d4d58", fontWeight: 700 }}>
              {errorMessage}
            </p>
          </section>
        ) : null}

        {activeBarangaySection ? (
          renderBarangaySectionContent()
        ) : (
          <section style={shellStyles.card}>
            <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
              <p style={labelStyles}>Settings Dashboard</p>
              <h3 style={{ margin: 0, color: "#17324d" }}>
                Open one settings function at a time
              </h3>
              <p style={mutedValueStyles}>
                Choose a category below to keep the Settings workspace focused and
                uncluttered. Detailed forms, tables, and logs only appear after you
                open a section.
              </p>
            </div>

            <div style={settingsHubStyles.grid}>
              {barangaySectionCards.map((section) => {
                const Icon = section.icon;

                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => setActiveSection(section.key)}
                    style={settingsHubStyles.button}
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
                      <span style={settingsHubStyles.iconBadge}>
                        <Icon size={22} />
                      </span>
                      <StatusChip
                        tone={section.statusTone}
                        label={section.statusLabel}
                      />
                    </div>

                    <div style={{ display: "grid", gap: "8px" }}>
                      <h3 style={{ margin: 0, color: "#17324d" }}>{section.label}</h3>
                      <p style={mutedValueStyles}>{section.description}</p>
                    </div>

                    <span style={settingsHubStyles.openLabel}>Open section</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <FeedbackToast
          message={toast.message}
          type={toast.type}
          title={toast.title}
          onClose={() => setToast({ message: "", type: "info", title: "" })}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title={roleMeta.title} description={roleMeta.description} />

      {errorMessage ? (
        <section style={shellStyles.card}>
          <p style={{ margin: 0, color: "#9d4d58", fontWeight: 700 }}>
            {errorMessage}
          </p>
        </section>
      ) : null}

      <section style={shellStyles.card}>
        <div style={gridStyles}>
          <article style={cardStyles}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Office Profile</h3>
            <InfoRow
              label="Account Name"
              value={
                [authenticatedUser?.first_name, authenticatedUser?.last_name]
                  .filter(Boolean)
                  .join(" ") || "--"
              }
            />
            <InfoRow label="Email" value={authenticatedUser?.email || "--"} muted />
            <InfoRow label="Role" value={currentRole || "--"} />
          </article>

          <article style={cardStyles}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Notification Status</h3>
            {isLoading ? (
              <EmptyState message="Loading notification settings..." />
            ) : (
              <>
                <InfoRow label="Unread Notifications" value={`${unreadCount}`} />
                <InfoRow
                  label="Active Rules for This Role"
                  value={`${notificationRuleCount}`}
                />
                <StatusChip
                  tone={notificationRuleCount > 0 ? "success" : "warning"}
                  label={
                    notificationRuleCount > 0
                      ? "Rules Available"
                      : "No Role Rules Found"
                  }
                />
              </>
            )}
          </article>

          <article style={cardStyles}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Sync Status</h3>
            <InfoRow label="Connection" value={isOnline ? "Online" : "Offline"} />
            <InfoRow
              label="Pending Queue Entries"
              value={`${syncSummary[LOCAL_SYNC_STATUS.PENDING] || 0}`}
            />
            <InfoRow
              label="Failed / Conflict Entries"
              value={`${
                (syncSummary[LOCAL_SYNC_STATUS.FAILED] || 0) +
                (syncSummary[LOCAL_SYNC_STATUS.CONFLICT] || 0)
              }`}
            />
            <StatusChip
              tone={
                syncSummary[LOCAL_SYNC_STATUS.FAILED] > 0 ||
                syncSummary[LOCAL_SYNC_STATUS.CONFLICT] > 0
                  ? "error"
                  : syncSummary[LOCAL_SYNC_STATUS.PENDING] > 0
                    ? "warning"
                    : "success"
              }
              label={
                syncSummary[LOCAL_SYNC_STATUS.FAILED] > 0 ||
                syncSummary[LOCAL_SYNC_STATUS.CONFLICT] > 0
                  ? "Needs Review"
                  : syncSummary[LOCAL_SYNC_STATUS.PENDING] > 0
                    ? "Pending Sync"
                    : "Synced"
              }
            />
          </article>
        </div>
      </section>

      {currentRole === ROLE_CODES.MSWDO ? (
        <section style={shellStyles.card}>
          <div style={gridStyles}>
            <article style={cardStyles}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Disaster Event Defaults</h3>
              {isLoading ? (
                <EmptyState message="Loading disaster event references..." />
              ) : activeDisasterEvents.length === 0 ? (
                <EmptyState message="No active disaster events are available right now." />
              ) : (
                <>
                  <InfoRow
                    label="Active Disaster Events"
                    value={`${activeDisasterEvents.length}`}
                  />
                  <InfoRow
                    label="Latest Active Event"
                    value={activeDisasterEvents[0]?.title || "--"}
                    muted
                  />
                  <InfoRow
                    label="Event Code"
                    value={activeDisasterEvents[0]?.event_code || "--"}
                  />
                </>
              )}
            </article>

            <article style={cardStyles}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Report Preferences</h3>
              <p style={mutedValueStyles}>
                This export format preference is saved locally for this account and can
                be reused by future report screens safely.
              </p>
              <select
                value={preferences.preferredExportFormat}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    preferredExportFormat: event.target.value,
                  }))
                }
                style={inputStyles.field}
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="pdf">PDF</option>
              </select>
            </article>
          </div>
        </section>
      ) : null}

      {currentRole === ROLE_CODES.MAYOR ? (
        <section style={shellStyles.card}>
          <div style={gridStyles}>
            <article style={cardStyles}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Analytics Service</h3>
              {isLoading ? (
                <EmptyState message="Checking analytics service..." />
              ) : forecastHealth ? (
                <>
                  <InfoRow
                    label="Service Status"
                    value={forecastHealth.status || "Online"}
                  />
                  <InfoRow
                    label="Checked Endpoint"
                    value={forecastHealth.analytics_url || "--"}
                    muted
                  />
                  <StatusChip
                    tone={
                      forecastHealth.status === "Online"
                        ? "success"
                        : forecastHealth.status === "Offline"
                          ? "error"
                          : "warning"
                    }
                    label={forecastHealth.status || "Unavailable"}
                  />
                </>
              ) : (
                <>
                  <EmptyState message="Analytics service unavailable." />
                  <StatusChip tone="error" label="Unavailable" />
                </>
              )}
            </article>

            <article style={cardStyles}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Inventory Alert Thresholds</h3>
              <p style={mutedValueStyles}>
                Thresholds are currently operational values tied to inventory records
                and service logic. This page shows them read-only for safety.
              </p>
              <InfoRow
                label="Configured Active Items"
                value={`${inventoryThresholdSummary?.configured_items || 0}`}
              />
              <InfoRow
                label="Distinct Threshold Values"
                value={
                  inventoryThresholdSummary?.distinct_thresholds?.length
                    ? inventoryThresholdSummary.distinct_thresholds.join(", ")
                    : "No thresholds loaded"
                }
              />
            </article>

            <article style={cardStyles}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Export Preferences</h3>
              <p style={mutedValueStyles}>
                This export format preference is saved locally for this account and can
                be reused by future report screens safely.
              </p>
              <select
                value={preferences.preferredExportFormat}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    preferredExportFormat: event.target.value,
                  }))
                }
                style={inputStyles.field}
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="pdf">PDF</option>
              </select>
            </article>
          </div>
        </section>
      ) : null}

      <section style={shellStyles.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: "8px", flex: "1 1 320px" }}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Local Preferences</h3>
            <p style={mutedValueStyles}>
              These preferences are stored locally for this signed-in role. They do
              not change backend permission rules or core workflow behavior.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={isSavingPreferences}
            style={pageHeaderStyles.primaryButton}
          >
            {isSavingPreferences ? "Saving..." : "Save Preferences"}
          </button>
        </div>

        <div style={{ ...gridStyles, marginTop: "18px" }}>
          <article style={cardStyles}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Notification Preferences</h3>
            {notificationRules.length === 0 ? (
              <EmptyState message="No notification rules are currently mapped to this role." />
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {notificationRules.map((rule) => {
                  const isEnabled = enabledRuleCodes.includes(rule.code);

                  return (
                    <label
                      key={rule.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        color: "#21405f",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleNotificationRule(rule.code)}
                        style={{ marginTop: "3px" }}
                      />
                      <span>
                        <strong>{rule.name}</strong>
                        <span style={{ ...mutedValueStyles, display: "block" }}>
                          {rule.trigger_type} ({rule.is_active ? "Active" : "Inactive"})
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </article>

          <article style={cardStyles}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Preference Notes</h3>
            <InfoRow
              label="Notification Rules Enabled Locally"
              value={`${enabledRuleCodes.length}`}
            />
            <InfoRow
              label="Preferred Export Format"
              value={preferences.preferredExportFormat?.toUpperCase() || "EXCEL"}
            />
          </article>
        </div>
      </section>

      <FeedbackToast
        message={toast.message}
        type={toast.type}
        title={toast.title}
        onClose={() => setToast({ message: "", type: "info", title: "" })}
      />
    </>
  );
};

export default RoleSettingsPage;
