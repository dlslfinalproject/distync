import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import ConfirmationModal from "../../components/shared/ConfirmationModal";
import FeedbackToast from "../../components/shared/FeedbackToast";
import { useAuth } from "../../context/AuthContext";
import { fetchUnreadNotificationCount } from "../../features/notifications/notificationService";
import {
  loadRoleSettingsState,
  refreshCurrentProfilePicture,
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
  areNotificationPreferencesEqual,
  buildDisplayName,
  createDefaultRolePreferences,
  formatDateTime,
  getEditableNotificationPayload,
  getBarangayProfileValidationErrors,
  getEnabledRuleCodesFromCategories,
  getNotificationPreferenceValidationErrors,
  normalizeRoleSettingsError,
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
import {
  buildPictureDraftForRemoval,
  buildPictureDraftForSelection,
  createProfilePictureDraftState,
  getProfilePictureUiState,
  hasProfilePictureDraftChanges,
  isSelectedProfilePictureFile,
  PROFILE_PICTURE_ACTIONS,
} from "./profilePictureDraft";
import {
  buildSettingsStatusBanner,
  buildSettingsConflictSnapshot,
  hasCachedRoleSettingsData,
  mergeRefreshedSettingsWithLocalDraft,
} from "./settingsOfflineHelpers";
import { useSystemInformation } from "./useSystemInformation";

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

const PROFILE_PICTURE_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const PROFILE_PICTURE_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const fileToBase64 = async (file) => {
  if (!isSelectedProfilePictureFile(file)) {
    throw new Error("Select a valid profile picture before saving.");
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("The selected profile picture could not be processed."));
    };
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  });
  const separatorIndex = dataUrl.indexOf(",");

  if (separatorIndex < 0) {
    throw new Error("The selected profile picture could not be processed.");
  }

  return dataUrl.slice(separatorIndex + 1).trim();
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

const normalizeProfileNameInput = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const hasStructuredProfileData = (profile = {}) =>
  Boolean(
    normalizeProfileNameInput(profile.firstName) ||
      normalizeProfileNameInput(profile.middleName) ||
      normalizeProfileNameInput(profile.lastName),
  );

const RoleSettingsPage = () => {
  const navigate = useNavigate();
  const { accessMode, currentRole, authenticatedUser, syncAuthState } = useAuth();
  const syncEntries =
    useLiveQuery(() => getVisibleSyncQueueEntriesByUpdatedAt(), [], []) ||
    [];
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [notificationLoadError, setNotificationLoadError] = useState("");
  const [notificationLoadSource, setNotificationLoadSource] = useState("loading");
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
  const [settingsReloadVersion, setSettingsReloadVersion] = useState(0);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false);
  const [isReconnectConflictModalOpen, setIsReconnectConflictModalOpen] =
    useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [toast, setToast] = useState({
    message: "",
    type: "info",
    title: "",
  });
  const [profileErrors, setProfileErrors] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    contactNumber: "",
  });
  const [profileTouched, setProfileTouched] = useState({
    firstName: false,
    middleName: false,
    lastName: false,
    contactNumber: false,
  });
  const [profilePictureDraft, setProfilePictureDraft] = useState(
    createProfilePictureDraftState(),
  );
  const [isRemoveProfilePictureModalOpen, setIsRemoveProfilePictureModalOpen] =
    useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [isReconnectRefreshInFlight, setIsReconnectRefreshInFlight] =
    useState(false);
  const [isReconnectRefreshBlocked, setIsReconnectRefreshBlocked] =
    useState(false);
  const profilePictureInputRef = useRef(null);
  const resetPreferencesButtonRef = useRef(null);
  const resetCancelButtonRef = useRef(null);
  const unsavedKeepEditingButtonRef = useRef(null);
  const removeProfilePictureButtonRef = useRef(null);
  const removeProfilePictureCancelButtonRef = useRef(null);
  const settingsOwnerKeyRef = useRef("");
  const profilePicturePreviewUrlRef = useRef("");
  const isRefreshingProfilePictureRef = useRef(false);
  const previousOnlineRef = useRef(isOnline);
  const preferencesRef = useRef(createDefaultRolePreferences());
  const savedProfilePreferencesRef = useRef(createDefaultRolePreferences());
  const hasUnsavedChangesRef = useRef(false);
  const hasProfileChangesRef = useRef(false);
  const hasNotificationChangesRef = useRef(false);
  const offlineToastKeyRef = useRef("");

  const roleMeta = useMemo(() => getRoleMeta(currentRole), [currentRole]);
  const syncSummary = useMemo(() => buildSyncSummary(syncEntries), [syncEntries]);
  const isBarangayRole = currentRole === ROLE_CODES.BARANGAY;
  const isMswdoRole = currentRole === ROLE_CODES.MSWDO;
  const isMayorRole = currentRole === ROLE_CODES.MAYOR;
  const settingsOwnerKey = useMemo(() => {
    if (!accessMode || !currentRole || !authenticatedUser?.id) {
      return "";
    }

    return `${accessMode}:${currentRole}:${authenticatedUser.id}`;
  }, [accessMode, authenticatedUser?.id, currentRole]);
  const revokeProfilePicturePreviewUrl = () => {
    if (profilePicturePreviewUrlRef.current) {
      URL.revokeObjectURL(profilePicturePreviewUrlRef.current);
      profilePicturePreviewUrlRef.current = "";
    }
  };
  const resetProfilePictureDraft = () => {
    revokeProfilePicturePreviewUrl();
    setProfilePictureDraft(createProfilePictureDraftState());
    if (profilePictureInputRef.current) {
      profilePictureInputRef.current.value = "";
    }
  };
  const applyAuthenticatedUserProfileFallbacks = (profilePreferences) => {
    const normalizedPreferences = normalizeRolePreferences(profilePreferences);
    const fallbackEmail = authenticatedUser?.email || "";

    return {
      ...normalizedPreferences,
      profile: {
        ...normalizedPreferences.profile,
        firstName: normalizeProfileNameInput(
          normalizedPreferences.profile.firstName,
        ),
        middleName: normalizeProfileNameInput(
          normalizedPreferences.profile.middleName,
        ),
        lastName: normalizeProfileNameInput(
          normalizedPreferences.profile.lastName,
        ),
        emailAddress:
          normalizedPreferences.profile.emailAddress || fallbackEmail,
      },
    };
  };
  const notificationValidationErrors = useMemo(
    () =>
      getNotificationPreferenceValidationErrors({
        categories: preferences.categories,
        emailAddress:
          authenticatedUser?.email || preferences.profile.emailAddress || "",
        isOnline,
      }),
    [
      authenticatedUser?.email,
      isOnline,
      preferences.categories,
      preferences.profile.emailAddress,
    ],
  );
  const normalizedCurrentProfile = useMemo(
    () => ({
      firstName: String(preferences.profile.firstName || "").trim(),
      middleName: String(preferences.profile.middleName || "").trim(),
      lastName: String(preferences.profile.lastName || "").trim(),
      contactNumber: normalizePhilippineContactNumber(
        preferences.profile.contactNumber || "",
      ),
      emailAddress: String(
        authenticatedUser?.email || preferences.profile.emailAddress || "",
      ).trim(),
    }),
    [
      authenticatedUser?.email,
      preferences.profile.contactNumber,
      preferences.profile.emailAddress,
      preferences.profile.firstName,
      preferences.profile.middleName,
      preferences.profile.lastName,
    ],
  );
  const normalizedSavedProfile = useMemo(
    () => ({
      firstName: String(savedProfilePreferences.profile.firstName || "").trim(),
      middleName: String(savedProfilePreferences.profile.middleName || "").trim(),
      lastName: String(savedProfilePreferences.profile.lastName || "").trim(),
      contactNumber: normalizePhilippineContactNumber(
        savedProfilePreferences.profile.contactNumber || "",
      ),
      emailAddress: String(
        authenticatedUser?.email ||
          savedProfilePreferences.profile.emailAddress ||
          "",
      ).trim(),
    }),
    [
      authenticatedUser?.email,
      savedProfilePreferences.profile.contactNumber,
      savedProfilePreferences.profile.emailAddress,
      savedProfilePreferences.profile.firstName,
      savedProfilePreferences.profile.middleName,
      savedProfilePreferences.profile.lastName,
    ],
  );
  const hasProfileChanges = useMemo(
    () =>
      JSON.stringify(normalizedCurrentProfile) !==
        JSON.stringify(normalizedSavedProfile) ||
      hasProfilePictureDraftChanges(profilePictureDraft),
    [normalizedCurrentProfile, normalizedSavedProfile, profilePictureDraft],
  );
  const hasNotificationChanges = useMemo(
    () =>
      !areNotificationPreferencesEqual(preferences, savedProfilePreferences),
    [preferences, savedProfilePreferences],
  );
  const hasUnsavedChanges = hasProfileChanges || hasNotificationChanges;
  const hasCachedSettings = useMemo(
    () =>
      hasCachedRoleSettingsData(preferences) ||
      hasCachedRoleSettingsData(savedProfilePreferences),
    [preferences, savedProfilePreferences],
  );
  const isOfflineWithoutCachedSettings =
    !isOnline &&
    !hasCachedSettings &&
    (notificationLoadSource === "offline-empty" ||
      notificationLoadSource === "unauthorized" ||
      notificationLoadSource === "error");
  const isSettingsReadOnlyOffline =
    !isOnline || isReconnectRefreshInFlight || isReconnectRefreshBlocked;
  const settingsStatusBanner = buildSettingsStatusBanner({
    activeSectionKey: activeSection,
    isOnline,
    hasUnsavedChanges,
    isReconnectRefreshBlocked,
  });
  const profilePicturePresentation = useMemo(
    () =>
      getProfilePictureUiState({
        draft: profilePictureDraft,
        savedProfile: preferences.profile,
      }),
    [preferences.profile, profilePictureDraft],
  );
  const retryRoleSettingsLoad = () => {
    setIsReconnectRefreshBlocked(false);
    setNotificationLoadError("");
    setNotificationLoadSource("loading");
    setSettingsReloadVersion((current) => current + 1);
  };

  const showScopedToast = ({ key, title, message, type = "info" }) => {
    if (offlineToastKeyRef.current === key && toast.message === message) {
      return;
    }

    offlineToastKeyRef.current = key;
    setToast({ title, message, type });
  };

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    savedProfilePreferencesRef.current = savedProfilePreferences;
  }, [savedProfilePreferences]);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
    hasProfileChangesRef.current = hasProfileChanges;
    hasNotificationChangesRef.current = hasNotificationChanges;
  }, [hasNotificationChanges, hasProfileChanges, hasUnsavedChanges]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
    if (!settingsOwnerKey) {
      resetProfilePictureDraft();
      settingsOwnerKeyRef.current = "";
      setPreferences(createDefaultRolePreferences());
      setSavedProfilePreferences(createDefaultRolePreferences());
      setProfileErrors({
        firstName: "",
        middleName: "",
        lastName: "",
        contactNumber: "",
      });
      setProfileTouched({
        firstName: false,
        middleName: false,
        lastName: false,
        contactNumber: false,
      });
      setNotificationTouched(false);
      setNotificationLoadError("");
      setNotificationLoadSource("idle");
      setIsResetModalOpen(false);
      setIsUnsavedModalOpen(false);
      setIsRemoveProfilePictureModalOpen(false);
      setUnreadCount(0);
      setErrorMessage("");
      setIsLoading(false);
      return;
    }

    const resetPreferences = applyAuthenticatedUserProfileFallbacks(
      createDefaultRolePreferences(),
    );
    resetProfilePictureDraft();
    settingsOwnerKeyRef.current = settingsOwnerKey;
    setPreferences(resetPreferences);
    setSavedProfilePreferences(resetPreferences);
    setProfileErrors({
      firstName: "",
      middleName: "",
      lastName: "",
      contactNumber: "",
    });
    setProfileTouched({
      firstName: false,
      middleName: false,
      lastName: false,
      contactNumber: false,
    });
    setNotificationLoadError("");
    setNotificationLoadSource("loading");
    setIsResetModalOpen(false);
    setIsUnsavedModalOpen(false);
    setIsRemoveProfilePictureModalOpen(false);
    setErrorMessage("");
    setIsLoading(true);
  }, [settingsOwnerKey]);

  useEffect(() => {
    return () => {
      revokeProfilePicturePreviewUrl();
    };
  }, []);

  useEffect(() => {
    if (!currentRole || !authenticatedUser) {
      return;
    }

    const wasOnline = previousOnlineRef.current;

    if (wasOnline && !isOnline && hasUnsavedChangesRef.current) {
      showScopedToast({
        key: "settings-connection-lost",
        type: "warning",
        title: "Connection lost",
        message: "Your changes are not saved. Reconnect to continue.",
      });
    }

  }, [authenticatedUser, currentRole, isOnline]);

  useEffect(() => {
    if (!currentRole || !authenticatedUser) {
      return;
    }

    let isMounted = true;
    const ownerKey = settingsOwnerKey;

    const loadPersistedRoleSettings = async () => {
      const result = await loadRoleSettingsState({
        roleCode: currentRole,
        userId: authenticatedUser.id,
      });

      if (!isMounted || settingsOwnerKeyRef.current !== ownerKey) {
        return;
      }

      const hydratedPreferences = applyAuthenticatedUserProfileFallbacks(
        result.settings,
      );

      if (result.source === "network" && !hasStructuredProfileData(hydratedPreferences.profile)) {
        setErrorMessage(
          "Profile information is incomplete. Refresh the page after reconnecting to the server.",
        );
      }

      if (result.source === "network" && hasUnsavedChangesRef.current) {
        const previousSavedSnapshot = buildSettingsConflictSnapshot(
          savedProfilePreferencesRef.current,
        );
        const refreshedSnapshot = buildSettingsConflictSnapshot(
          hydratedPreferences,
        );
        const hasServerConflict =
          JSON.stringify(previousSavedSnapshot) !==
          JSON.stringify(refreshedSnapshot);

        setPreferences(
          mergeRefreshedSettingsWithLocalDraft({
            refreshedSettings: hydratedPreferences,
            currentPreferences: preferencesRef.current,
            preserveProfileDraft: hasProfileChangesRef.current,
            preserveNotificationDraft: hasNotificationChangesRef.current,
          }),
        );

        if (hasServerConflict) {
          setIsReconnectConflictModalOpen(true);
        }
      } else {
        setPreferences(hydratedPreferences);
      }
      setSavedProfilePreferences(hydratedPreferences);
      setNotificationLoadSource(result.source);
      setNotificationLoadError(
        result.source === "offline-empty"
          ? "Connect to the internet to load your account settings."
          : result.errorMessage || "",
      );
    };

    void loadPersistedRoleSettings();

    return () => {
      isMounted = false;
    };
  }, [authenticatedUser, currentRole, settingsOwnerKey, settingsReloadVersion]);

  useEffect(() => {
    if (!isOnline || !currentRole || !authenticatedUser) {
      previousOnlineRef.current = isOnline;
      return;
    }

    const wasOnline = previousOnlineRef.current;
    previousOnlineRef.current = isOnline;

    if (wasOnline !== false) {
      return;
    }

    let isMounted = true;
    const ownerKey = settingsOwnerKey;

    const refreshSettingsAfterReconnect = async () => {
      setIsReconnectRefreshInFlight(true);
      setIsReconnectRefreshBlocked(false);
      setNotificationLoadError("");

      try {
        const result = await loadRoleSettingsState({
          roleCode: currentRole,
          userId: authenticatedUser.id,
        });

        if (
          !isMounted ||
          settingsOwnerKeyRef.current !== ownerKey
        ) {
          return;
        }

        if (result.source !== "network") {
          setIsReconnectRefreshBlocked(true);
          setNotificationLoadError(
            "Account settings could not be refreshed. Please try again.",
          );
          showScopedToast({
            key: "settings-reconnect-refresh-failed",
            type: "warning",
            title: "Back online",
            message: "Account settings could not be refreshed. Please try again.",
          });
          return;
        }

        const refreshedPreferences = applyAuthenticatedUserProfileFallbacks(
          result.settings,
        );
        const hadLocalDraft = hasUnsavedChangesRef.current;
        const hadProfileDraft = hasProfileChangesRef.current;
        const hadNotificationDraft = hasNotificationChangesRef.current;
        const previousSavedSnapshot = buildSettingsConflictSnapshot(
          savedProfilePreferencesRef.current,
        );
        const refreshedSnapshot = buildSettingsConflictSnapshot(
          refreshedPreferences,
        );
        const hasServerConflict =
          JSON.stringify(previousSavedSnapshot) !==
          JSON.stringify(refreshedSnapshot);

        if (!hadLocalDraft) {
          setPreferences(refreshedPreferences);
        } else {
          setPreferences(
            mergeRefreshedSettingsWithLocalDraft({
              refreshedSettings: refreshedPreferences,
              currentPreferences: preferencesRef.current,
              preserveProfileDraft: hadProfileDraft,
              preserveNotificationDraft: hadNotificationDraft,
            }),
          );
        }

        setSavedProfilePreferences(refreshedPreferences);
        setNotificationLoadSource("network");
        setNotificationLoadError("");

        if (hadLocalDraft && hasServerConflict) {
          setIsReconnectConflictModalOpen(true);
        }

        showScopedToast({
          key: "settings-back-online",
          type: "info",
          title: "Back online",
          message: "Review your account settings before saving.",
        });
      } finally {
        if (isMounted && settingsOwnerKeyRef.current === ownerKey) {
          setIsReconnectRefreshInFlight(false);
        }
      }
    };

    void refreshSettingsAfterReconnect();

    return () => {
      isMounted = false;
    };
  }, [authenticatedUser, currentRole, isOnline, settingsOwnerKey]);

  useEffect(() => {
    if (!authenticatedUser) {
      return;
    }

    setPreferences((current) => {
      const normalized = normalizeRolePreferences(current);
      const nextEmailAddress =
        normalized.profile.emailAddress || authenticatedUser?.email || "";

      if (
        normalized.profile.emailAddress === nextEmailAddress
      ) {
        return current;
      }

      return {
        ...normalized,
        profile: {
          ...normalized.profile,
          emailAddress: nextEmailAddress,
        },
      };
    });

    setSavedProfilePreferences((current) => {
      const normalized = normalizeRolePreferences(current);
      const nextEmailAddress =
        normalized.profile.emailAddress || authenticatedUser?.email || "";

      if (
        normalized.profile.emailAddress === nextEmailAddress
      ) {
        return current;
      }

      return {
        ...normalized,
        profile: {
          ...normalized.profile,
          emailAddress: nextEmailAddress,
        },
      };
    });
  }, [authenticatedUser]);

  useEffect(() => {
    if (!isBarangayRole && !isMswdoRole && !isMayorRole) {
      return;
    }

    const lockedEmailAddress = authenticatedUser?.email || "";
    const normalizedContactNumber = preferences.profile.contactNumber
      ? normalizePhilippineContactNumber(preferences.profile.contactNumber)
      : "";
    const lockedPosition = getRolePositionLabel(currentRole);

    setPreferences((current) => {
      if (
        current.profile.position === lockedPosition &&
        current.profile.emailAddress === lockedEmailAddress &&
        current.profile.contactNumber === normalizedContactNumber
      ) {
        return current;
      }

      return {
        ...current,
        profile: {
          ...current.profile,
          position: lockedPosition,
          contactNumber: normalizedContactNumber,
          emailAddress: lockedEmailAddress,
        },
      };
    });
  }, [
    authenticatedUser?.email,
    currentRole,
    isBarangayRole,
    isMayorRole,
    isMswdoRole,
    preferences.profile.contactNumber,
  ]);

  useEffect(() => {
    if (!isBarangayRole && !isMswdoRole && !isMayorRole) {
      return;
    }

    const validationErrors = getBarangayProfileValidationErrors(preferences.profile);

    setProfileErrors({
      firstName: validationErrors.firstName || "",
      middleName: validationErrors.middleName || "",
      lastName: validationErrors.lastName || "",
      contactNumber: validationErrors.contactNumber || "",
    });
  }, [
    isBarangayRole,
    isMayorRole,
    isMswdoRole,
    preferences.profile.contactNumber,
    preferences.profile.firstName,
    preferences.profile.middleName,
    preferences.profile.lastName,
  ]);

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

      if (!isOnline) {
        setIsLoading(false);
        setErrorMessage("");
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      const ownerKey = settingsOwnerKey;

      try {
        const unreadResponse = await fetchUnreadNotificationCount();

        if (settingsOwnerKeyRef.current !== ownerKey) {
          return;
        }

        setUnreadCount(Number(unreadResponse?.unread_count || 0));
      } catch (error) {
        if (settingsOwnerKeyRef.current === ownerKey) {
          setErrorMessage("Settings information could not be loaded.");
        }
      } finally {
        if (settingsOwnerKeyRef.current === ownerKey) {
          setIsLoading(false);
        }
      }
    };

    loadSettingsData();
  }, [authenticatedUser, currentRole, isOnline, settingsOwnerKey]);

  useEffect(() => {
    if (!isBarangayRole && !isMswdoRole && !isMayorRole) {
      return;
    }

    if (!isOnline) {
      setSyncHistoryErrorMessage("");
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
  }, [isBarangayRole, isMayorRole, isMswdoRole, isOnline]);

  const handleSavePreferences = async () => {
    if (!currentRole || !authenticatedUser) {
      return;
    }

    const isProfileSection = activeSection === "account-settings";
    const isNotificationSection = activeSection === "notification-preferences";

    if (!isOnline) {
      showScopedToast({
        key: "settings-save-offline",
        type: "warning",
        title: "Unable to save offline",
        message: "Connect to the internet to save account settings.",
      });
      return;
    }

    if (isReconnectRefreshInFlight || isReconnectRefreshBlocked) {
      showScopedToast({
        key: "settings-save-refresh-blocked",
        type: "warning",
        title: "Unable to save offline",
        message: "Connect to the internet to save account settings.",
      });
      return;
    }

    const normalizedFirstName = normalizeProfileNameInput(
      preferences.profile.firstName,
    );
    const normalizedMiddleName = normalizeProfileNameInput(
      preferences.profile.middleName,
    );
    const normalizedLastName = normalizeProfileNameInput(
      preferences.profile.lastName,
    );
    const usesPhilippineContactFormat =
      isBarangayRole || isMswdoRole || isMayorRole;
    const normalizedContactNumber = usesPhilippineContactFormat
      ? normalizePhilippineContactNumber(preferences.profile.contactNumber)
      : preferences.profile.contactNumber;
    const lockedEmailAddress =
      authenticatedUser.email || preferences.profile.emailAddress;

    if (
      isProfileSection &&
      (isBarangayRole || isMswdoRole || isMayorRole)
    ) {
      const lockedPosition = getRolePositionLabel(currentRole);
      const validationErrors = getBarangayProfileValidationErrors({
        ...preferences.profile,
        firstName: normalizedFirstName,
        middleName: normalizedMiddleName,
        lastName: normalizedLastName,
        position: lockedPosition,
        contactNumber: normalizedContactNumber,
        emailAddress: lockedEmailAddress,
      });

      setProfileTouched({
        firstName: true,
        middleName: true,
        lastName: true,
        contactNumber: true,
      });
      setProfileErrors({
        firstName: validationErrors.firstName || "",
        middleName: validationErrors.middleName || "",
        lastName: validationErrors.lastName || "",
        contactNumber: validationErrors.contactNumber || "",
      });

      if (Object.values(validationErrors).some(Boolean)) {
        const invalidFieldOrder = [
          "firstName",
          "middleName",
          "lastName",
          "contactNumber",
        ];
        const fieldIdPrefix = isBarangayRole
          ? "barangay"
          : isMswdoRole
            ? "mswdo"
            : "mayor";
        const firstInvalidField = invalidFieldOrder.find(
          (fieldName) => validationErrors[fieldName],
        );

        if (firstInvalidField && typeof document !== "undefined") {
          const fieldIdMap = {
            firstName: `${fieldIdPrefix}-profile-first-name`,
            middleName: `${fieldIdPrefix}-profile-middle-name`,
            lastName: `${fieldIdPrefix}-profile-last-name`,
            contactNumber: `${fieldIdPrefix}-profile-contact`,
          };
          document.getElementById(fieldIdMap[firstInvalidField])?.focus();
        }

        setToast({
          type: "error",
          title: "Check Profile Information",
          message: "Please correct the highlighted profile fields.",
        });
        return;
      }
    }

    if (
      (isBarangayRole || isMswdoRole || isMayorRole) &&
      isNotificationSection
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
      const updatedSettings = isProfileSection
        ? {
            profile: {
              firstName: normalizedFirstName,
              middleName: normalizedMiddleName || null,
              lastName: normalizedLastName,
              contactNumber: normalizedContactNumber,
            },
            metadata: {
              lastProfileUpdateAt: new Date().toISOString(),
            },
          }
        : {
            notificationRulePreferences:
              getEditableNotificationPayload(preferences),
            metadata: {
              lastPreferenceSaveAt: new Date().toISOString(),
            },
          };

      if (isProfileSection) {
        if (profilePictureDraft.pictureAction === PROFILE_PICTURE_ACTIONS.REPLACE) {
          if (!isSelectedProfilePictureFile(profilePictureDraft.selectedPictureFile)) {
            setToast({
              type: "error",
              title: "Profile Picture Error",
              message: "Select a valid profile picture before saving.",
            });
            setIsSavingPreferences(false);
            return;
          }

          updatedSettings.profilePicture = {
            action: PROFILE_PICTURE_ACTIONS.REPLACE,
            fileName:
              profilePictureDraft.selectedPictureFile.name || "profile-picture",
            mimeType: profilePictureDraft.selectedPictureFile.type,
            fileDataBase64: await fileToBase64(
              profilePictureDraft.selectedPictureFile,
            ),
          };
        }

        if (profilePictureDraft.pictureAction === PROFILE_PICTURE_ACTIONS.REMOVE) {
          updatedSettings.profilePicture = {
            action: PROFILE_PICTURE_ACTIONS.REMOVE,
          };
        }
      }

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
      resetProfilePictureDraft();
      setPreferences(resolvedPreferences);
      setSavedProfilePreferences(resolvedPreferences);
      setIsRemoveProfilePictureModalOpen(false);
      setNotificationTouched(false);
      setToast({
        type: "success",
        title: isProfileSection ? "Profile Saved" : "Notification Preferences Saved",
        message: isProfileSection
          ? profilePictureDraft.pictureAction === PROFILE_PICTURE_ACTIONS.REPLACE
            ? "Profile information and picture saved successfully."
            : profilePictureDraft.pictureAction === PROFILE_PICTURE_ACTIONS.REMOVE
              ? "Profile information saved and the picture was removed."
              : "Profile information saved successfully."
          : "Notification preferences saved successfully.",
      });
    } catch (error) {
      const errorMessage = String(error?.message || "").trim();

      if (isProfileSection) {
        const nextProfileErrors = {
          firstName: /first name/i.test(errorMessage) ? errorMessage : "",
          middleName: /middle name/i.test(errorMessage) ? errorMessage : "",
          lastName: /last name/i.test(errorMessage) ? errorMessage : "",
          contactNumber: /contact number/i.test(errorMessage)
            ? "Enter a valid contact number."
            : "",
        };

        if (/cannot be changed from Account Settings/i.test(errorMessage)) {
          setErrorMessage(
            "Some profile fields cannot be changed from Account Settings.",
          );
        }

        if (Object.values(nextProfileErrors).some(Boolean)) {
          setProfileTouched({
            firstName: true,
            middleName: true,
            lastName: true,
            contactNumber: true,
          });
          setProfileErrors(nextProfileErrors);
        }

        setToast({
          type: "error",
          title:
            error?.code === "PROFILE_PICTURE_SAVE_FAILED"
              ? "Profile Picture Error"
              : error?.code === "SETTINGS_SAVE_FAILED" || error?.status >= 500
                ? "Account Settings Could Not Be Saved"
                : "Profile Save Failed",
          message: /cannot be changed from Account Settings/i.test(errorMessage)
            ? "Some profile fields cannot be changed from Account Settings."
            : error?.code === "PROFILE_PICTURE_SAVE_FAILED"
              ? "The selected profile picture could not be saved. Please try again."
              : error?.code === "SETTINGS_SAVE_FAILED" || error?.status >= 500
                ? "Something went wrong while saving your changes. Please try again."
                : "Profile information could not be saved. Please review your entries and try again.",
        });
        return;
      }

      setToast({
        type: "error",
        title: "Notification Save Failed",
        message: normalizeRoleSettingsError(error),
      });
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleProfileFieldChange = (field, value) => {
    if (isSettingsReadOnlyOffline) {
      return;
    }

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
    resetProfilePictureDraft();
    setIsRemoveProfilePictureModalOpen(false);
    const restoredPreferences =
      applyAuthenticatedUserProfileFallbacks(savedProfilePreferences);
    setPreferences(restoredPreferences);
    setProfileTouched({
      firstName: false,
      middleName: false,
      lastName: false,
      contactNumber: false,
    });
    setProfileErrors({
      firstName: "",
      middleName: "",
      lastName: "",
      contactNumber: "",
    });
    setToast({
      type: "info",
      title: "Changes Canceled",
      message: "Account settings were restored to the last saved values.",
    });
  };

  const handleNotificationRuleChannelToggle = (ruleCode, type) => {
    if (isSettingsReadOnlyOffline) {
      return;
    }

    setNotificationTouched(true);
    setPreferences((current) => ({
      ...current,
      categories: (current.categories || []).map((category) => ({
        ...category,
        rules: (category.rules || []).map((rule) =>
          rule.code !== ruleCode
            ? rule
            : {
                ...rule,
                effectiveChannels: {
                  ...rule.effectiveChannels,
                  [type]: !rule.effectiveChannels?.[type],
                },
              },
        ),
      })),
    }));
  };

  const handleOpenResetNotificationPreferences = () => {
    if (isSettingsReadOnlyOffline) {
      return;
    }

    setIsResetModalOpen(true);
  };

  const handleCloseResetNotificationPreferences = () => {
    setIsResetModalOpen(false);
  };

  const handleConfirmResetNotificationPreferences = () => {
    if (isSettingsReadOnlyOffline) {
      return;
    }

    setIsResetModalOpen(false);
    setNotificationTouched(true);
    setPreferences((current) => {
      const resetCategories = (current.categories || []).map((category) => ({
        ...category,
        rules: (category.rules || []).map((rule) => ({
          ...rule,
          effectiveChannels: {
            inApp: rule.inAppPolicy !== "NOT_APPLICABLE",
            email: rule.emailPolicy === "DEFAULT_ON",
          },
        })),
      }));

      return {
        ...current,
        categories: resetCategories,
        notificationRulePreferences: getEditableNotificationPayload({
          ...current,
          categories: resetCategories,
        }),
      };
    });
    setToast({
      type: "info",
      title: "Preferences Restored",
      message:
        "Notification preferences restored to the recommended defaults. Select Save Changes to apply them.",
    });
  };

  const handleBackAction = () => {
    if (hasUnsavedChanges) {
      setIsUnsavedModalOpen(true);
      return;
    }

    setActiveSection(null);
  };

  const handleKeepEditing = () => {
    setIsUnsavedModalOpen(false);
  };

  const handleDiscardChanges = () => {
    setIsUnsavedModalOpen(false);
    setIsRemoveProfilePictureModalOpen(false);
    resetProfilePictureDraft();
    const restoredPreferences =
      applyAuthenticatedUserProfileFallbacks(savedProfilePreferences);
    setPreferences(restoredPreferences);
    setProfileTouched({
      firstName: false,
      middleName: false,
      lastName: false,
      contactNumber: false,
    });
    setNotificationTouched(false);
    setActiveSection(null);
  };

  const handleProfilePictureChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (isSettingsReadOnlyOffline) {
      event.target.value = "";
      showScopedToast({
        key: "settings-picture-offline",
        type: "warning",
        title: "You're offline",
        message: "Connect to the internet to change your profile picture.",
      });
      return;
    }

    if (!selectedFile || !authenticatedUser || !currentRole) {
      return;
    }

    if (!PROFILE_PICTURE_ALLOWED_MIME_TYPES.has(selectedFile.type)) {
      setToast({
        type: "error",
        title: "Profile Picture Error",
        message: "Please choose a JPG, PNG, or WEBP image for the profile picture.",
      });
      event.target.value = "";
      return;
    }

    if (selectedFile.size > PROFILE_PICTURE_MAX_FILE_SIZE_BYTES) {
      setToast({
        type: "error",
        title: "Profile Picture Error",
        message: "Profile picture is too large. Please choose an image under 2 MB.",
      });
      event.target.value = "";
      return;
    }

    revokeProfilePicturePreviewUrl();

    const previewUrl = URL.createObjectURL(selectedFile);
    profilePicturePreviewUrlRef.current = previewUrl;
    setProfilePictureDraft(
      buildPictureDraftForSelection({
        file: selectedFile,
        previewUrl,
      }),
    );
    setIsRemoveProfilePictureModalOpen(false);
    setToast({
      type: "info",
      title: "Picture selected",
      message: "Save Changes to apply it.",
    });
    event.target.value = "";
  };

  const handleOpenRemoveProfilePictureDialog = () => {
    if (isSettingsReadOnlyOffline) {
      showScopedToast({
        key: "settings-picture-remove-offline",
        type: "warning",
        title: "You're offline",
        message: "Connect to the internet to change your profile picture.",
      });
      return;
    }

    if (!authenticatedUser || !currentRole) {
      return;
    }

    setIsRemoveProfilePictureModalOpen(true);
  };

  const handleCancelRemoveProfilePicture = () => {
    setIsRemoveProfilePictureModalOpen(false);
  };

  const handleConfirmRemoveProfilePicture = () => {
    revokeProfilePicturePreviewUrl();
    setProfilePictureDraft(buildPictureDraftForRemoval());
    setIsRemoveProfilePictureModalOpen(false);
    if (profilePictureInputRef.current) {
      profilePictureInputRef.current.value = "";
    }
    setToast({
      type: "info",
      title: "Removal pending",
      message: "Save Changes to confirm it.",
    });
  };

  const handleUndoProfilePictureChange = () => {
    resetProfilePictureDraft();
    setIsRemoveProfilePictureModalOpen(false);
    setToast({
      type: "info",
      title: "Picture restored",
      message: "Draft picture changes were canceled.",
    });
  };

  const handleProfilePictureLoadError = async () => {
    if (
      hasProfilePictureDraftChanges(profilePictureDraft) ||
      isRefreshingProfilePictureRef.current ||
      !preferences.profile.profilePicturePath
    ) {
      return;
    }

    isRefreshingProfilePictureRef.current = true;

    try {
      const refreshedProfile = await refreshCurrentProfilePicture();

      setPreferences((current) => ({
        ...current,
        profile: {
          ...current.profile,
          ...refreshedProfile,
        },
      }));
      setSavedProfilePreferences((current) => ({
        ...current,
        profile: {
          ...current.profile,
          ...refreshedProfile,
        },
      }));
    } catch (_error) {
      setPreferences((current) => ({
        ...current,
        profile: {
          ...current.profile,
          profilePictureUrl: "",
          profilePictureUrlExpiresAt: "",
        },
      }));
    } finally {
      isRefreshingProfilePictureRef.current = false;
    }
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

  const notificationRules = useMemo(
    () => (preferences.categories || []).flatMap((category) => category.rules || []),
    [preferences.categories],
  );
  const hasNotificationRules = notificationRules.length > 0;
  const notificationRuleCount = notificationRules.length;
  const enabledRuleCodes = useMemo(
    () => getEnabledRuleCodesFromCategories(preferences.categories),
    [preferences.categories],
  );
  const isNotificationPreferencesLoading = notificationLoadSource === "loading";
  const hasNotificationPreferencesError = notificationLoadSource === "error";
  const isNotificationPreferencesOffline =
    !isOnline && notificationLoadSource === "cache";
  const isNotificationPreferencesEmpty =
    !isNotificationPreferencesLoading &&
    !hasNotificationPreferencesError &&
    !hasNotificationRules;
  const canSavePreferences =
    hasUnsavedChanges &&
    !isSavingPreferences &&
    !isSettingsReadOnlyOffline &&
    !isLoading &&
    !isNotificationPreferencesLoading &&
    !hasNotificationPreferencesError &&
    !isNotificationPreferencesEmpty &&
    !Object.values(notificationValidationErrors).some(Boolean);
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
  const systemInformation = useSystemInformation({
    roleCode: currentRole,
    syncEntries,
    formatDateTime,
  });

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
    isSaveDisabled: !canSavePreferences,
    saveLabel: "Save Changes",
    onBack: handleBackAction,
    onSave: handleSavePreferences,
  });
  const mswdoPageActions = buildSettingsPageActions({
    activeSectionMeta: activeMswdoSection,
    editableSectionKeys: EDITABLE_MSWDO_SECTION_KEYS,
    isSavingPreferences,
    isSaveDisabled: !canSavePreferences,
    saveLabel: "Save Changes",
    onBack: handleBackAction,
    onSave: handleSavePreferences,
  });
  const mayorPageActions = buildSettingsPageActions({
    activeSectionMeta: activeMayorSection,
    editableSectionKeys: EDITABLE_MAYOR_SECTION_KEYS,
    isSavingPreferences,
    isSaveDisabled: !canSavePreferences,
    saveLabel: "Save Changes",
    onBack: handleBackAction,
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
    handleOpenRemoveProfilePictureDialog,
    handleProfilePictureLoadError,
    handleUndoProfilePictureChange,
    profilePicturePresentation,
    profilePictureDraft,
    isRemoveProfilePictureModalOpen,
    handleCancelRemoveProfilePicture,
    handleConfirmRemoveProfilePicture,
    removeProfilePictureButtonRef,
    setPreferences,
    handleSaveProfileChanges: handleSavePreferences,
    handleCancelProfileChanges,
    StatusChip,
    InfoRow,
    EmptyState,
    isLoading,
    syncSectionProps,
    isOnline,
    isSettingsReadOnlyOffline,
    hasUnsavedChanges,
    isReconnectRefreshInFlight,
    isReconnectRefreshBlocked,
  });

  const barangayViewContext = buildBarangayViewContext({
    sharedContext: sharedRoleViewContext,
    notificationTouched,
    notificationValidationErrors,
    handleOpenResetNotificationPreferences,
    handleNotificationRuleChannelToggle,
    notificationCategories: preferences.categories,
    enabledRuleCodes,
    notificationLoadError,
    isNotificationPreferencesLoading,
    isNotificationPreferencesOffline,
    isNotificationPreferencesEmpty,
    hasNotificationPreferencesError,
    canResetNotificationPreferences:
      !isSavingPreferences &&
      !isNotificationPreferencesLoading &&
      !hasNotificationPreferencesError &&
      !isNotificationPreferencesEmpty &&
      isOnline,
    resetPreferencesButtonRef,
    handleRetryNotificationPreferencesLoad: retryRoleSettingsLoad,
    systemInformation,
  });

  const mswdoViewContext = buildMswdoViewContext({
    sharedContext: sharedRoleViewContext,
    notificationTouched,
    notificationValidationErrors,
    handleOpenResetNotificationPreferences,
    handleNotificationRuleChannelToggle,
    notificationCategories: preferences.categories,
    enabledRuleCodes,
    notificationLoadError,
    isNotificationPreferencesLoading,
    isNotificationPreferencesOffline,
    isNotificationPreferencesEmpty,
    hasNotificationPreferencesError,
    canResetNotificationPreferences:
      !isSavingPreferences &&
      !isNotificationPreferencesLoading &&
      !hasNotificationPreferencesError &&
      !isNotificationPreferencesEmpty &&
      isOnline,
    resetPreferencesButtonRef,
    handleRetryNotificationPreferencesLoad: retryRoleSettingsLoad,
    unreadCount,
    notificationRuleCount,
    systemInformation,
  });

  const mayorViewContext = buildMayorViewContext({
    sharedContext: sharedRoleViewContext,
    notificationTouched,
    notificationValidationErrors,
    handleOpenResetNotificationPreferences,
    handleNotificationRuleChannelToggle,
    notificationCategories: preferences.categories,
    enabledRuleCodes,
    notificationLoadError,
    isNotificationPreferencesLoading,
    isNotificationPreferencesOffline,
    isNotificationPreferencesEmpty,
    hasNotificationPreferencesError,
    canResetNotificationPreferences:
      !isSavingPreferences &&
      !isNotificationPreferencesLoading &&
      !hasNotificationPreferencesError &&
      !isNotificationPreferencesEmpty &&
      isOnline,
    resetPreferencesButtonRef,
    handleRetryNotificationPreferencesLoad: retryRoleSettingsLoad,
    unreadCount,
    notificationRuleCount,
    systemInformation,
  });

  const settingsDialogs = (
    <>
      <ConfirmationModal
        isOpen={isResetModalOpen}
        title="Reset notification preferences?"
        message={`This will restore the recommended notification settings for the ${getRolePositionLabel(currentRole) || "current"} account. Your changes will stay on this page until you save them.`}
        onCancel={handleCloseResetNotificationPreferences}
        onClose={handleCloseResetNotificationPreferences}
        onConfirm={handleConfirmResetNotificationPreferences}
        cancelLabel="Cancel"
        confirmLabel="Reset Preferences"
        initialFocusRef={resetCancelButtonRef}
        finalFocusRef={resetPreferencesButtonRef}
        cancelButtonRef={resetCancelButtonRef}
      />

      <ConfirmationModal
        isOpen={isRemoveProfilePictureModalOpen}
        title="Remove profile picture?"
        message="The picture will be removed when you save your changes."
        onCancel={handleCancelRemoveProfilePicture}
        onClose={handleCancelRemoveProfilePicture}
        onConfirm={handleConfirmRemoveProfilePicture}
        cancelLabel="Keep Picture"
        confirmLabel="Remove Picture"
        confirmTone="destructive"
        initialFocusRef={removeProfilePictureCancelButtonRef}
        finalFocusRef={removeProfilePictureButtonRef}
        cancelButtonRef={removeProfilePictureCancelButtonRef}
      />

      <ConfirmationModal
        isOpen={isUnsavedModalOpen}
        title="Discard unsaved changes?"
        message="Your account settings have not been saved. Connect to the internet to save them, or discard them now."
        onCancel={handleKeepEditing}
        onClose={handleKeepEditing}
        onConfirm={handleDiscardChanges}
        cancelLabel="Keep Editing"
        confirmLabel="Discard Changes"
        confirmButtonStyle={{
          backgroundColor: "#fff3f1",
          borderColor: "#f1d2cc",
          color: "#9d4d58",
        }}
        initialFocusRef={unsavedKeepEditingButtonRef}
        cancelButtonRef={unsavedKeepEditingButtonRef}
      />

      <ConfirmationModal
        isOpen={isReconnectConflictModalOpen}
        title="Account settings changed while you were offline"
        message="Review the latest account information before saving your changes."
        onCancel={() => setIsReconnectConflictModalOpen(false)}
        onClose={() => setIsReconnectConflictModalOpen(false)}
        onConfirm={() => {
          setIsReconnectConflictModalOpen(false);
          handleDiscardChanges();
        }}
        cancelLabel="Review Changes"
        confirmLabel="Discard My Changes"
      />
    </>
  );

  if (
    (isBarangayRole || isMswdoRole || isMayorRole) &&
    isOfflineWithoutCachedSettings
  ) {
    return (
      <>
        <PageHeader title={roleMeta.title} description={roleMeta.description} />
        <section style={shellStyles.card} aria-live="polite">
          <div style={{ display: "grid", gap: "10px" }}>
            <h3 style={{ margin: 0, color: "#17324d" }}>
              Account settings unavailable offline
            </h3>
            <p style={mutedValueStyles}>
              Connect to the internet to load your account settings.
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
  }

  if (isBarangayRole) {
    return (
      <>
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
          statusBanner={settingsStatusBanner}
          ctx={barangayViewContext}
        />
        {settingsDialogs}
      </>
    );
  }

  if (isMswdoRole) {
    return (
      <>
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
          statusBanner={settingsStatusBanner}
          ctx={mswdoViewContext}
        />
        {settingsDialogs}
      </>
    );
  }

  if (isMayorRole) {
    return (
      <>
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
          statusBanner={settingsStatusBanner}
          ctx={mayorViewContext}
        />
        {settingsDialogs}
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
