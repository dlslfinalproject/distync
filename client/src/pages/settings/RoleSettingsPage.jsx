import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import FeedbackToast from "../../components/shared/FeedbackToast";
import { useAuth } from "../../context/AuthContext";
import { fetchActiveDisasterEvents, fetchBarangays } from "../../features/disaster-events/disasterEventService";
import { fetchInventoryItems, fetchForecastHealth } from "../../features/inventory-items/inventoryItemService";
import {
  fetchCurrentNotificationRules,
  fetchUnreadNotificationCount,
} from "../../features/notifications/notificationService";
import {
  loadRoleSettings,
  saveRoleSettings,
  summarizeCachedRegistrationData,
} from "../../features/settings/settingsService";
import db, { LOCAL_SYNC_STATUS } from "../../offline/db";
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

const formatDateTime = (value) => {
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
          "Review barangay account context, notification preferences, offline sync state, and cached registration references.",
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
  const { currentRole, authenticatedUser } = useAuth();
  const syncEntries =
    useLiveQuery(() => db.syncQueue.toArray(), [], []) || [];
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notificationRules, setNotificationRules] = useState([]);
  const [assignedBarangayName, setAssignedBarangayName] = useState("--");
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeDisasterEvents, setActiveDisasterEvents] = useState([]);
  const [forecastHealth, setForecastHealth] = useState(null);
  const [inventoryThresholdSummary, setInventoryThresholdSummary] = useState(null);
  const [preferences, setPreferences] = useState({
    enabledNotificationRuleCodes: [],
    preferredExportFormat: "excel",
  });
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [toast, setToast] = useState({
    message: "",
    type: "info",
    title: "",
  });

  const roleMeta = useMemo(() => getRoleMeta(currentRole), [currentRole]);
  const syncSummary = useMemo(() => buildSyncSummary(syncEntries), [syncEntries]);
  const cachedRegistrationSummary = useMemo(
    () => summarizeCachedRegistrationData(),
    [],
  );
  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;

  useEffect(() => {
    if (!currentRole || !authenticatedUser) {
      return;
    }

    setPreferences(
      loadRoleSettings({
        roleCode: currentRole,
        userId: authenticatedUser.id,
      }),
    );
  }, [authenticatedUser, currentRole]);

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
      saveRoleSettings({
        roleCode: currentRole,
        userId: authenticatedUser.id,
        settings: preferences,
      });

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

  const notificationRuleCount = notificationRules.length;
  const enabledRuleCodes =
    preferences.enabledNotificationRuleCodes?.length > 0
      ? preferences.enabledNotificationRuleCodes
      : notificationRules.map((rule) => rule.code);

  return (
    <>
      <PageHeader title={roleMeta.title} description={roleMeta.description} />

      {errorMessage ? (
        <section style={shellStyles.card}>
          <p style={{ margin: 0, color: "#9d4d58", fontWeight: 700 }}>{errorMessage}</p>
        </section>
      ) : null}

      <section style={shellStyles.card}>
        <div style={gridStyles}>
          <article style={cardStyles}>
            <h3 style={{ margin: 0, color: "#17324d" }}>
              {currentRole === ROLE_CODES.BARANGAY ? "Barangay Profile" : "Office Profile"}
            </h3>
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
            {currentRole === ROLE_CODES.BARANGAY ? (
              <InfoRow label="Assigned Barangay" value={assignedBarangayName} />
            ) : null}
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

      {currentRole === ROLE_CODES.BARANGAY ? (
        <section style={shellStyles.card}>
          <div style={gridStyles}>
            <article style={cardStyles}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Cached Registration Data</h3>
              <InfoRow
                label="Active Disaster Events Cached"
                value={`${cachedRegistrationSummary.activeDisasterEventCount}`}
              />
              <InfoRow
                label="Sectors Cached"
                value={`${cachedRegistrationSummary.sectorCount}`}
              />
              <InfoRow
                label="Evacuation Centers Cached"
                value={`${cachedRegistrationSummary.evacuationCenterCount}`}
              />
              <InfoRow
                label="Selected Cached Event"
                value={
                  cachedRegistrationSummary.selectedDisasterEvent?.event_name ||
                  cachedRegistrationSummary.selectedDisasterEvent?.title ||
                  "No cached selected event"
                }
                muted
              />
            </article>

            <article style={cardStyles}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Operational Readiness</h3>
              <InfoRow
                label="Offline Registration"
                value={
                  cachedRegistrationSummary.selectedDisasterEventId
                    ? "Ready if cached references are present"
                    : "Needs online event selection first"
                }
                muted
              />
              <InfoRow
                label="Cached Event Status"
                value={
                  cachedRegistrationSummary.selectedDisasterEvent?.status || "--"
                }
              />
              <InfoRow
                label="Cached Event Date"
                value={formatDateTime(cachedRegistrationSummary.selectedDisasterEvent?.start_date)}
              />
            </article>
          </div>
        </section>
      ) : null}

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
            {(currentRole === ROLE_CODES.MSWDO || currentRole === ROLE_CODES.MAYOR) ? (
              <InfoRow
                label="Preferred Export Format"
                value={preferences.preferredExportFormat?.toUpperCase() || "EXCEL"}
              />
            ) : (
              <InfoRow
                label="Role Preference Mode"
                value="Operational"
                muted
              />
            )}
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
