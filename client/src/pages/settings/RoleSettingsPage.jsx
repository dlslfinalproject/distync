import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import FeedbackToast from "../../components/shared/FeedbackToast";
import { useAuth } from "../../context/AuthContext";
import { fetchBarangays } from "../../features/disaster-events/disasterEventService";
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
import { fetchSyncHistory } from "../../features/sync/syncHistoryService";
import db, { LOCAL_SYNC_STATUS } from "../../offline/db";
import {
  flushPendingSyncEntries,
  subscribeToSyncUpdates,
} from "../../offline/syncService";
import {
  ROLE_CODES,
  updateAuthenticatedSessionUser,
} from "../../utils/roleSession";
import {
  BARANGAY_SETTINGS_SECTIONS,
  EDITABLE_BARANGAY_SECTION_KEYS,
  EDITABLE_MAYOR_SECTION_KEYS,
  EDITABLE_MSWDO_SECTION_KEYS,
  MAYOR_SETTINGS_SECTIONS,
  MSWDO_SETTINGS_SECTIONS,
} from "./settingsConfig";
import {
  buildActivityLogs,
  buildLocalSyncLogRows,
  buildSecurityActivityLogs,
  buildSyncSummary,
  createDefaultNotificationChannels,
  createDefaultRolePreferences,
  getBarangayProfileValidationErrors,
  getNotificationPreferenceValidationErrors,
  getRoleMeta,
  getRolePositionLabel,
  getSecurityPasswordValidationErrors,
  normalizePhilippineContactNumber,
  normalizeRolePreferences,
} from "./settingsHelpers";
import {
  buildBarangaySectionCards,
  buildBarangayViewContext,
  buildMayorSectionCards,
  buildMayorViewContext,
  buildMswdoSectionCards,
  buildMswdoViewContext,
  buildSettingsPageActions,
  buildSharedRoleViewContext,
  getActiveSettingsSection,
  getSectionsForRole,
} from "./settingsViewBuilders";
import BarangaySettingsView from "./views/BarangaySettingsView";
import MayorSettingsView from "./views/MayorSettingsView";
import MswdoSettingsView from "./views/MswdoSettingsView";

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

const helperTextStyles = {
  ...mutedValueStyles,
  fontSize: "12px",
  lineHeight: 1.5,
};

const errorTextStyles = {
  ...helperTextStyles,
  color: "#b2434f",
  fontWeight: 700,
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
  lockedField: {
    backgroundColor: "#eef5fc",
    color: "#4f6780",
  },
  errorField: {
    borderColor: "#d46975",
    boxShadow: "0 0 0 1px rgba(212, 105, 117, 0.12)",
  },
  phoneInputGroup: {
    display: "flex",
    alignItems: "stretch",
    width: "100%",
  },
  phonePrefix: {
    minHeight: "44px",
    minWidth: "124px",
    border: "1px solid #c9d7e6",
    borderRight: "none",
    borderRadius: "12px 0 0 12px",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#21405f",
    backgroundColor: "#eef5fc",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    flexShrink: 0,
  },
  phoneField: {
    borderRadius: "0 12px 12px 0",
    flex: 1,
  },
  passwordWrapper: {
    position: "relative",
  },
  passwordField: {
    paddingRight: "44px",
  },
  visibilityButton: {
    position: "absolute",
    top: "50%",
    right: "12px",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#60738a",
    cursor: "pointer",
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
  const { currentRole, authenticatedUser, syncAuthState } = useAuth();
  const syncEntries =
    useLiveQuery(() => db.syncQueue.orderBy("updatedAt").reverse().toArray(), [], []) ||
    [];
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notificationRules, setNotificationRules] = useState([]);
  const [assignedBarangayName, setAssignedBarangayName] = useState("--");
  const [unreadCount, setUnreadCount] = useState(0);
  const [forecastHealth, setForecastHealth] = useState(null);
  const [inventoryThresholdSummary, setInventoryThresholdSummary] = useState(null);
  const [preferences, setPreferences] = useState(createDefaultRolePreferences());
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [distributionRows, setDistributionRows] = useState([]);
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
  const [securityTouched, setSecurityTouched] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [securityVisibility, setSecurityVisibility] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [notificationTouched, setNotificationTouched] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [toast, setToast] = useState({
    message: "",
    type: "info",
    title: "",
  });
  const [profileErrors, setProfileErrors] = useState({
    fullName: "",
    contactNumber: "",
  });
  const [profileTouched, setProfileTouched] = useState({
    fullName: false,
    contactNumber: false,
  });
  const profilePictureInputRef = useRef(null);

  const roleMeta = useMemo(() => getRoleMeta(currentRole), [currentRole]);
  const syncSummary = useMemo(() => buildSyncSummary(syncEntries), [syncEntries]);
  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  const isBarangayRole = currentRole === ROLE_CODES.BARANGAY;
  const isMswdoRole = currentRole === ROLE_CODES.MSWDO;
  const isMayorRole = currentRole === ROLE_CODES.MAYOR;
  const securityValidationErrors = useMemo(
    () => getSecurityPasswordValidationErrors(securityForm),
    [securityForm],
  );
  const notificationValidationErrors = useMemo(
    () =>
      getNotificationPreferenceValidationErrors({
        notificationChannels: preferences.notificationChannels,
        emailAddress:
          authenticatedUser?.email || preferences.profile.emailAddress || "",
      }),
    [authenticatedUser?.email, preferences.notificationChannels, preferences.profile.emailAddress],
  );

  useEffect(() => {
    const availableSections = getSectionsForRole({
      isBarangayRole,
      isMswdoRole,
      isMayorRole,
    });

    if (availableSections.length === 0) {
      setActiveSection(null);
      return;
    }

    setActiveSection((current) => {
      if (!current) {
        return null;
      }

      return availableSections.some((section) => section.key === current)
        ? current
        : null;
    });
  }, [isBarangayRole, isMayorRole, isMswdoRole]);

  useEffect(() => {
    if (!currentRole || !authenticatedUser) {
      return;
    }

    let isMounted = true;

    const loadPersistedRoleSettings = async () => {
      const loadedSettings = await loadRoleSettings({
        roleCode: currentRole,
        userId: authenticatedUser.id,
      });

      if (!isMounted) {
        return;
      }

      setPreferences(normalizeRolePreferences(loadedSettings));
    };

    void loadPersistedRoleSettings();

    return () => {
      isMounted = false;
    };
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
    if (!isBarangayRole) {
      setProfileErrors({
        fullName: "",
        contactNumber: "",
      });
      setProfileTouched({
        fullName: false,
        contactNumber: false,
      });
      return;
    }

    const lockedEmailAddress = authenticatedUser?.email || "";
    const normalizedContactNumber = preferences.profile.contactNumber
      ? normalizePhilippineContactNumber(preferences.profile.contactNumber)
      : "";

    setPreferences((current) => {
      if (
        current.profile.position === getRolePositionLabel(ROLE_CODES.BARANGAY) &&
        current.profile.emailAddress === lockedEmailAddress &&
        current.profile.contactNumber === normalizedContactNumber
      ) {
        return current;
      }

      return {
        ...current,
        profile: {
          ...current.profile,
          position: getRolePositionLabel(ROLE_CODES.BARANGAY),
          contactNumber: normalizedContactNumber,
          emailAddress: lockedEmailAddress,
        },
      };
    });
  }, [authenticatedUser?.email, isBarangayRole, preferences.profile.contactNumber]);

  useEffect(() => {
    if (!isBarangayRole && !isMswdoRole && !isMayorRole) {
      return;
    }

    const validationErrors = getBarangayProfileValidationErrors(preferences.profile);

    setProfileErrors({
      fullName: validationErrors.fullName || "",
      contactNumber: validationErrors.contactNumber || "",
    });
  }, [
    isBarangayRole,
    isMayorRole,
    isMswdoRole,
    preferences.profile.contactNumber,
    preferences.profile.fullName,
  ]);

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
    if (!isBarangayRole) {
      setSecurityTouched({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
      });
      setSecurityVisibility({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
      });
      setNotificationTouched(false);
    }
  }, [isBarangayRole]);

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
      setDistributionRows([]);
      return;
    }

    let isMounted = true;

    const loadDistributionData = async () => {
      try {
        const response = await fetchDistributionHistory({
          limit: 100,
        });

        if (!isMounted) {
          return;
        }

        setDistributionRows(Array.isArray(response?.data) ? response.data : []);
      } catch (_error) {
        if (isMounted) {
          setDistributionRows([]);
        }
      }
    };

    loadDistributionData();

    return () => {
      isMounted = false;
    };
  }, [isBarangayRole]);

  useEffect(() => {
    if (!isBarangayRole) {
      return;
    }

    let isMounted = true;

    const loadRoleSyncHistory = async () => {
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
            error.message || "Failed to load sync history.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingSyncHistory(false);
        }
      }
    };

    loadRoleSyncHistory();

    const unsubscribe = subscribeToSyncUpdates(() => {
      if (typeof navigator === "undefined" || navigator.onLine) {
        void loadRoleSyncHistory();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isBarangayRole]);

  const toggleNotificationRule = (ruleCode) => {
    setNotificationTouched(true);
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

    const trimmedFullName = preferences.profile.fullName.trim();
    const usesPhilippineContactFormat =
      isBarangayRole || isMswdoRole || isMayorRole;
    const normalizedContactNumber = usesPhilippineContactFormat
      ? normalizePhilippineContactNumber(preferences.profile.contactNumber)
      : preferences.profile.contactNumber;
    const lockedEmailAddress = authenticatedUser.email || preferences.profile.emailAddress;

    if (isBarangayRole || isMswdoRole || isMayorRole) {
      const lockedPosition = getRolePositionLabel(currentRole);
      const validationErrors = getBarangayProfileValidationErrors({
        ...preferences.profile,
        fullName: trimmedFullName,
        position: lockedPosition,
        contactNumber: normalizedContactNumber,
        emailAddress: lockedEmailAddress,
      });

      setProfileTouched({
        fullName: true,
        contactNumber: true,
      });
      setProfileErrors({
        fullName: validationErrors.fullName || "",
        contactNumber: validationErrors.contactNumber || "",
      });

      if (Object.values(validationErrors).some(Boolean)) {
        setToast({
          type: "error",
          title: "Profile Settings Incomplete",
          message: isBarangayRole
            ? "Review the barangay profile fields before saving."
            : isMswdoRole
              ? "Review the MSWDO profile fields before saving."
              : "Review the mayor profile fields before saving.",
        });
        return;
      }
    }

    if (
      (isBarangayRole || isMswdoRole || isMayorRole) &&
      activeSection === "notification-preferences"
    ) {
      setNotificationTouched(true);

      if (Object.values(notificationValidationErrors).some(Boolean)) {
        setToast({
          type: "error",
          title: "Notification Preferences Incomplete",
          message: "Review the local notification preferences before saving.",
        });
        return;
      }
    }

    setIsSavingPreferences(true);

    try {
      const updatedProfile =
        isBarangayRole || isMswdoRole || isMayorRole
          ? {
              ...preferences.profile,
              fullName: trimmedFullName,
              position: getRolePositionLabel(currentRole),
              contactNumber: normalizedContactNumber,
              emailAddress: lockedEmailAddress,
            }
          : preferences.profile;
      const updatedSettings = {
        ...preferences,
        profile: updatedProfile,
        metadata: {
          ...preferences.metadata,
          lastPreferenceSaveAt: new Date().toISOString(),
        },
      };

      const saveResult = await saveRoleSettings({
        roleCode: currentRole,
        userId: authenticatedUser.id,
        settings: updatedSettings,
      });

      if (saveResult?.user) {
        updateAuthenticatedSessionUser(saveResult.user);
        syncAuthState();
      }

      setPreferences(normalizeRolePreferences(saveResult?.data || updatedSettings));
      setToast({
        type: "success",
        title: "Settings Saved",
        message: "Your role settings were saved successfully.",
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
    const nextValue =
      (isBarangayRole || isMswdoRole || isMayorRole) &&
      field === "contactNumber"
        ? normalizePhilippineContactNumber(value)
        : value;

    setPreferences((current) => ({
      ...current,
      profile: {
        ...current.profile,
        [field]: nextValue,
      },
      metadata: {
        ...current.metadata,
        lastProfileUpdateAt: new Date().toISOString(),
      },
    }));
  };

  const handleProfileFieldBlur = (field) => {
    if (!isBarangayRole && !isMswdoRole && !isMayorRole) {
      return;
    }

    setProfileTouched((current) => ({
      ...current,
      [field]: true,
    }));
  };

  const handleNotificationChannelToggle = (channelKey, type) => {
    setNotificationTouched(true);
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

  const handleResetNotificationPreferences = () => {
    setNotificationTouched(false);
    setPreferences((current) => ({
      ...current,
      enabledNotificationRuleCodes:
        notificationRules.length > 0 ? notificationRules.map((rule) => rule.code) : [],
      notificationChannels: createDefaultNotificationChannels(),
    }));
    setToast({
      type: "info",
      title: "Notification Preferences Reset",
      message: "Local notification settings were reset to their default values.",
    });
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

  const handlePasswordFieldBlur = (field) => {
    setSecurityTouched((current) => ({
      ...current,
      [field]: true,
    }));
  };

  const togglePasswordVisibility = (field) => {
    setSecurityVisibility((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  const handleLocalPasswordReview = () => {
    setSecurityTouched({
      currentPassword: true,
      newPassword: true,
      confirmPassword: true,
    });

    if (Object.values(securityValidationErrors).some(Boolean)) {
      setToast({
        type: "error",
        title: "Password Update Incomplete",
        message: "Review the password fields and try again.",
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
    setSecurityTouched({
      currentPassword: false,
      newPassword: false,
      confirmPassword: false,
    });
    setSecurityVisibility({
      currentPassword: false,
      newPassword: false,
      confirmPassword: false,
    });
    setToast({
      type: "success",
      title: "Password Updated",
      message:
        "Password changed successfully. This frontend-only review did not modify backend authentication.",
    });
  };

  const handleSyncNow = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setToast({
        type: "warning",
        title: "Offline Mode",
        message: "Reconnect to the internet before syncing DISTYNC records.",
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
        message: "No pending records are waiting for sync right now.",
      });
      return;
    }

    setIsSyncingNow(true);

    try {
      await flushPendingSyncEntries();
      setToast({
        type: "success",
        title: "Sync Requested",
        message: "Sync processing started using the existing DISTYNC queue.",
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

  const activityLogs = useMemo(
    () =>
      buildActivityLogs({
        distributionRows,
        syncEntries,
        syncHistory,
      }).slice(0, 16),
    [distributionRows, syncEntries, syncHistory],
  );
  const securityActivityLogs = useMemo(
    () => buildSecurityActivityLogs(preferences),
    [preferences],
  );
  const localSyncLogRows = useMemo(
    () => buildLocalSyncLogRows(syncEntries),
    [syncEntries],
  );

  const activeBarangaySection = useMemo(
    () => getActiveSettingsSection(BARANGAY_SETTINGS_SECTIONS, activeSection),
    [activeSection],
  );
  const activeMswdoSection = useMemo(
    () => getActiveSettingsSection(MSWDO_SETTINGS_SECTIONS, activeSection),
    [activeSection],
  );
  const activeMayorSection = useMemo(
    () => getActiveSettingsSection(MAYOR_SETTINGS_SECTIONS, activeSection),
    [activeSection],
  );

  const barangaySectionCards = useMemo(
    () =>
      buildBarangaySectionCards({
        preferences,
        enabledRuleCodes,
        activityLogs,
      }),
    [activityLogs, enabledRuleCodes, preferences],
  );
  const mswdoSectionCards = useMemo(
    () =>
      buildMswdoSectionCards({
        preferences,
        enabledRuleCodes,
        notificationRuleCount,
        syncSummary,
        isOnline,
      }),
    [enabledRuleCodes, isOnline, notificationRuleCount, preferences, syncSummary],
  );
  const mayorSectionCards = useMemo(
    () =>
      buildMayorSectionCards({
        preferences,
        enabledRuleCodes,
        notificationRuleCount,
        syncSummary,
        isOnline,
        forecastHealth,
        inventoryThresholdSummary,
      }),
    [
      enabledRuleCodes,
      forecastHealth,
      inventoryThresholdSummary,
      isOnline,
      notificationRuleCount,
      preferences,
      syncSummary,
    ],
  );

  const barangayPageActions = buildSettingsPageActions({
    activeSectionMeta: activeBarangaySection,
    editableSectionKeys: EDITABLE_BARANGAY_SECTION_KEYS,
    isSavingPreferences,
    saveLabel: "Save Barangay Settings",
    onBack: () => setActiveSection(null),
    onSave: handleSavePreferences,
  });
  const mswdoPageActions = buildSettingsPageActions({
    activeSectionMeta: activeMswdoSection,
    editableSectionKeys: EDITABLE_MSWDO_SECTION_KEYS,
    isSavingPreferences,
    saveLabel: "Save MSWDO Settings",
    onBack: () => setActiveSection(null),
    onSave: handleSavePreferences,
  });
  const mayorPageActions = buildSettingsPageActions({
    activeSectionMeta: activeMayorSection,
    editableSectionKeys: EDITABLE_MAYOR_SECTION_KEYS,
    isSavingPreferences,
    saveLabel: "Save Mayor Settings",
    onBack: () => setActiveSection(null),
    onSave: handleSavePreferences,
  });

  const sharedRoleViewContext = buildSharedRoleViewContext({
    shellStyles,
    gridStyles,
    cardStyles,
    inputStyles,
    labelStyles,
    mutedValueStyles,
    helperTextStyles,
    errorTextStyles,
    tableStyles,
    pageHeaderStyles,
    preferences,
    profileTouched,
    profileErrors,
    authenticatedUser,
    handleProfileFieldChange,
    handleProfileFieldBlur,
    profilePictureInputRef,
    handleProfilePictureChange,
    setPreferences,
    securityVisibility,
    securityForm,
    setSecurityForm,
    handlePasswordFieldBlur,
    securityTouched,
    securityValidationErrors,
    togglePasswordVisibility,
    handleLocalPasswordReview,
    StatusChip,
    InfoRow,
    EmptyState,
    isLoading,
    securityActivityLogs,
  });

  const barangayViewContext = buildBarangayViewContext({
    sharedContext: sharedRoleViewContext,
    assignedBarangayName,
    notificationTouched,
    notificationValidationErrors,
    handleResetNotificationPreferences,
    handleNotificationChannelToggle,
    notificationRules,
    enabledRuleCodes,
    toggleNotificationRule,
    activityLogs,
  });

  const mswdoViewContext = buildMswdoViewContext({
    sharedContext: sharedRoleViewContext,
    notificationTouched,
    notificationValidationErrors,
    handleResetNotificationPreferences,
    handleNotificationChannelToggle,
    notificationRules,
    enabledRuleCodes,
    toggleNotificationRule,
    unreadCount,
    notificationRuleCount,
    navigate,
    handleSyncNow,
    isSyncingNow,
    syncSummary,
    isOnline,
    localSyncLogRows,
  });

  const mayorViewContext = buildMayorViewContext({
    sharedContext: sharedRoleViewContext,
    notificationTouched,
    notificationValidationErrors,
    handleResetNotificationPreferences,
    handleNotificationChannelToggle,
    notificationRules,
    enabledRuleCodes,
    toggleNotificationRule,
    unreadCount,
    notificationRuleCount,
    navigate,
    handleSyncNow,
    isSyncingNow,
    syncSummary,
    isOnline,
    localSyncLogRows,
    forecastHealth,
    inventoryThresholdSummary,
  });
  if (isBarangayRole) {
    return (
      <BarangaySettingsView
        activeSection={activeSection}
        activeSectionMeta={activeBarangaySection}
        roleMeta={roleMeta}
        pageActions={barangayPageActions}
        errorMessage={errorMessage}
        sectionCards={barangaySectionCards}
        onOpenSection={setActiveSection}
        toast={toast}
        onCloseToast={() => setToast({ message: "", type: "info", title: "" })}
        settingsHubStyles={settingsHubStyles}
        labelStyles={labelStyles}
        mutedValueStyles={mutedValueStyles}
        StatusChip={StatusChip}
        ctx={barangayViewContext}
      />
    );
  }

  if (isMswdoRole) {
    return (
      <MswdoSettingsView
        activeSection={activeSection}
        activeSectionMeta={activeMswdoSection}
        roleMeta={roleMeta}
        pageActions={mswdoPageActions}
        errorMessage={errorMessage}
        sectionCards={mswdoSectionCards}
        onOpenSection={setActiveSection}
        toast={toast}
        onCloseToast={() => setToast({ message: "", type: "info", title: "" })}
        settingsHubStyles={settingsHubStyles}
        labelStyles={labelStyles}
        mutedValueStyles={mutedValueStyles}
        StatusChip={StatusChip}
        ctx={mswdoViewContext}
      />
    );
  }

  if (isMayorRole) {
    return (
      <MayorSettingsView
        activeSection={activeSection}
        activeSectionMeta={activeMayorSection}
        roleMeta={roleMeta}
        pageActions={mayorPageActions}
        errorMessage={errorMessage}
        sectionCards={mayorSectionCards}
        onOpenSection={setActiveSection}
        toast={toast}
        onCloseToast={() => setToast({ message: "", type: "info", title: "" })}
        settingsHubStyles={settingsHubStyles}
        labelStyles={labelStyles}
        mutedValueStyles={mutedValueStyles}
        StatusChip={StatusChip}
        ctx={mayorViewContext}
      />
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
        <div style={{ display: "grid", gap: "10px" }}>
          <h3 style={{ margin: 0, color: "#17324d" }}>
            Settings are unavailable for this role.
          </h3>
          <p style={mutedValueStyles}>
            The current DISTYNC settings workspace is configured for Barangay,
            MSWDO, and Mayor accounts only.
          </p>
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
