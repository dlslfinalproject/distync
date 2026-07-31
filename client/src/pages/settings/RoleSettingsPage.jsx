import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import FeedbackToast from "../../components/shared/FeedbackToast";
import { useAuth } from "../../context/AuthContext";
import { fetchBarangays } from "../../features/disaster-events/disasterEventService";
import {
  fetchCurrentNotificationRules,
  fetchUnreadNotificationCount,
} from "../../features/notifications/notificationService";
import {
  loadRoleSettings,
  saveRoleSettings,
} from "../../features/settings/settingsService";
import { fetchSyncHistory } from "../../features/sync/syncHistoryService";
import { LOCAL_SYNC_STATUS } from "../../offline/db";
import {
  flushPendingSyncEntries,
  subscribeToSyncUpdates,
} from "../../offline/syncService";
import { getVisibleSyncQueueEntriesByUpdatedAt } from "../../offline/syncQueue";
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
  buildLocalSyncLogRows,
  buildSyncSummary,
  createDefaultNotificationChannels,
  createDefaultRolePreferences,
  formatDateTime,
  getBarangayProfileValidationErrors,
  getNotificationPreferenceValidationErrors,
  getRoleMeta,
  getRolePositionLabel,
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

const PROFILE_PICTURE_MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const PROFILE_PICTURE_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

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
    useLiveQuery(() => getVisibleSyncQueueEntriesByUpdatedAt(), [], []) ||
    [];
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notificationRules, setNotificationRules] = useState([]);
  const [assignedBarangayName, setAssignedBarangayName] = useState("--");
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState(createDefaultRolePreferences());
  const [savedProfilePreferences, setSavedProfilePreferences] = useState(
    createDefaultRolePreferences(),
  );
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [syncHistory, setSyncHistory] = useState({
    transactions: [],
    conflicts: [],
  });
  const [syncHistoryErrorMessage, setSyncHistoryErrorMessage] = useState("");
  const [isSyncingNow, setIsSyncingNow] = useState(false);
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
    emailAddress: "",
  });
  const [profileTouched, setProfileTouched] = useState({
    fullName: false,
    contactNumber: false,
    emailAddress: false,
  });
  const profilePictureInputRef = useRef(null);

  const roleMeta = useMemo(() => getRoleMeta(currentRole), [currentRole]);
  const syncSummary = useMemo(() => buildSyncSummary(syncEntries), [syncEntries]);
  const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  const isBarangayRole = currentRole === ROLE_CODES.BARANGAY;
  const isMswdoRole = currentRole === ROLE_CODES.MSWDO;
  const isMayorRole = currentRole === ROLE_CODES.MAYOR;
  const applyAuthenticatedUserProfileFallbacks = (profilePreferences) => {
    const normalizedPreferences = normalizeRolePreferences(profilePreferences);
    const fallbackFullName =
      [authenticatedUser?.first_name, authenticatedUser?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || "";
    const fallbackEmail = authenticatedUser?.email || "";

    return {
      ...normalizedPreferences,
      profile: {
        ...normalizedPreferences.profile,
        fullName: normalizedPreferences.profile.fullName || fallbackFullName,
        emailAddress:
          normalizedPreferences.profile.emailAddress || fallbackEmail,
      },
    };
  };
  const notificationValidationErrors = useMemo(
    () =>
      getNotificationPreferenceValidationErrors({
        notificationChannels: preferences.notificationChannels,
        roleCode: currentRole,
        emailAddress:
          authenticatedUser?.email || preferences.profile.emailAddress || "",
        enabledNotificationRuleCodes: preferences.enabledNotificationRuleCodes,
        notificationRules,
      }),
    [
      authenticatedUser?.email,
      currentRole,
      notificationRules,
      preferences.enabledNotificationRuleCodes,
      preferences.notificationChannels,
      preferences.profile.emailAddress,
    ],
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

      const hydratedPreferences =
        applyAuthenticatedUserProfileFallbacks(loadedSettings);
      setPreferences(hydratedPreferences);
      setSavedProfilePreferences(hydratedPreferences);
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
      const hydratedPreferences =
        applyAuthenticatedUserProfileFallbacks(normalized);

      if (
        normalized.profile.fullName === hydratedPreferences.profile.fullName &&
        normalized.profile.emailAddress === hydratedPreferences.profile.emailAddress
      ) {
        return current;
      }

      return hydratedPreferences;
    });

    setSavedProfilePreferences((current) => {
      const normalized = normalizeRolePreferences(current);
      const hydratedPreferences =
        applyAuthenticatedUserProfileFallbacks(normalized);

      if (
        normalized.profile.fullName === hydratedPreferences.profile.fullName &&
        normalized.profile.emailAddress === hydratedPreferences.profile.emailAddress
      ) {
        return current;
      }

      return hydratedPreferences;
    });
  }, [authenticatedUser]);

  useEffect(() => {
    if (!isBarangayRole) {
      setProfileErrors({
        fullName: "",
        contactNumber: "",
        emailAddress: "",
      });
      setProfileTouched({
        fullName: false,
        contactNumber: false,
        emailAddress: false,
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
      emailAddress: validationErrors.emailAddress || "",
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

        const [notificationRuleResponse, unreadResponse, barangayResponse] =
          await Promise.all(requests);

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
      } catch (error) {
        setErrorMessage(error.message || "Failed to load settings.");
      } finally {
        setIsLoading(false);
      }
    };

    loadSettingsData();
  }, [authenticatedUser, currentRole]);

  useEffect(() => {
    if (!isBarangayRole && !isMswdoRole && !isMayorRole) {
      return;
    }

    let isMounted = true;

    const loadRoleSyncHistory = async () => {
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
  }, [isBarangayRole, isMayorRole, isMswdoRole]);

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
        emailAddress: true,
      });
      setProfileErrors({
        fullName: validationErrors.fullName || "",
        contactNumber: validationErrors.contactNumber || "",
        emailAddress: validationErrors.emailAddress || "",
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

      const resolvedPreferences = applyAuthenticatedUserProfileFallbacks(
        saveResult?.data || updatedSettings,
      );
      setPreferences(resolvedPreferences);
      setSavedProfilePreferences(resolvedPreferences);
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

  const handleCancelProfileChanges = () => {
    const restoredPreferences =
      applyAuthenticatedUserProfileFallbacks(savedProfilePreferences);
    setPreferences(restoredPreferences);
    setProfileTouched({
      fullName: false,
      contactNumber: false,
      emailAddress: false,
    });
    setProfileErrors({
      fullName: "",
      contactNumber: "",
      emailAddress: "",
    });
    setToast({
      type: "info",
      title: "Changes Canceled",
      message: "Account settings were restored to the last saved values.",
    });
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

    if (!PROFILE_PICTURE_ALLOWED_MIME_TYPES.has(selectedFile.type)) {
      setToast({
        type: "error",
        title: "Profile Picture Error",
        message: "Please choose a JPG, PNG, or WEBP image for the profile picture.",
      });
      return;
    }

    if (selectedFile.size > PROFILE_PICTURE_MAX_FILE_SIZE_BYTES) {
      setToast({
        type: "error",
        title: "Profile Picture Error",
        message: "Profile picture is too large. Please choose an image under 4 MB.",
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
  const localSyncLogRows = useMemo(
    () => buildLocalSyncLogRows(syncEntries),
    [syncEntries],
  );
  const latestSuccessfulSyncTimestamp = useMemo(() => {
    const syncedTransactions = (syncHistory.transactions || [])
      .filter((transaction) => transaction.sync_status === LOCAL_SYNC_STATUS.SYNCED)
      .map(
        (transaction) =>
          transaction.server_timestamp ||
          transaction.synced_at ||
          transaction.updated_at ||
          transaction.created_at,
      )
      .filter(Boolean)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());

    return syncedTransactions[0] || "";
  }, [syncHistory.transactions]);
  const lastQueueActivityAt = useMemo(
    () => formatDateTime(localSyncLogRows[0]?.timestamp),
    [localSyncLogRows],
  );
  const lastSuccessfulSyncAt = useMemo(
    () => formatDateTime(latestSuccessfulSyncTimestamp),
    [latestSuccessfulSyncTimestamp],
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
        syncSummary,
        isOnline,
      }),
    [enabledRuleCodes, isOnline, preferences, syncSummary],
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
      }),
    [
      enabledRuleCodes,
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
    saveLabel: "Save Changes",
    onBack: () => setActiveSection(null),
    onSave: handleSavePreferences,
  });
  const mswdoPageActions = buildSettingsPageActions({
    activeSectionMeta: activeMswdoSection,
    editableSectionKeys: EDITABLE_MSWDO_SECTION_KEYS,
    isSavingPreferences,
    saveLabel: "Save Changes",
    onBack: () => setActiveSection(null),
    onSave: handleSavePreferences,
  });
  const mayorPageActions = buildSettingsPageActions({
    activeSectionMeta: activeMayorSection,
    editableSectionKeys: EDITABLE_MAYOR_SECTION_KEYS,
    isSavingPreferences,
    saveLabel: "Save Changes",
    onBack: () => setActiveSection(null),
    onSave: handleSavePreferences,
  });

  const syncSectionProps = {
    shellStyles,
    gridStyles,
    cardStyles,
    helperTextStyles,
    mutedValueStyles,
    tableStyles,
    pageHeaderStyles,
    InfoRow,
    EmptyState,
    StatusChip,
    description:
      "Review offline sync information, current synchronization status, and the latest sync activity. This section is informative only and keeps the existing DISTYNC offline behavior unchanged.",
    isOnline,
  };

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
    isSavingPreferences,
    authenticatedUser,
    handleProfileFieldChange,
    handleProfileFieldBlur,
    profilePictureInputRef,
    handleProfilePictureChange,
    setPreferences,
    handleSaveProfileChanges: handleSavePreferences,
    handleCancelProfileChanges,
    StatusChip,
    InfoRow,
    EmptyState,
    isLoading,
    syncSectionProps,
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
    navigate,
    handleSyncNow,
    isSyncingNow,
    syncSummary,
    isOnline,
    localSyncLogRows,
    syncHistoryErrorMessage,
    lastQueueActivityAt,
    lastSuccessfulSyncAt,
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
    syncHistoryErrorMessage,
    lastQueueActivityAt,
    lastSuccessfulSyncAt,
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
    syncHistoryErrorMessage,
    lastQueueActivityAt,
    lastSuccessfulSyncAt,
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
