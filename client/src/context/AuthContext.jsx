import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ACCESS_MODES, getAccessMode } from "../utils/accessMode";
import {
  AUTH_SESSION_INVALIDATED_EVENT,
  ROLE_CODES,
  clearAllAccessSessions,
  consumePendingAuthSessionInvalidation,
  getAuthenticatedSession,
  getAuthenticatedSessionExpiresAt,
  getAuthenticatedUser,
  getRoleForAccessMode,
  setAuthenticatedSession,
  setCurrentRole,
} from "../utils/roleSession";
import {
  authenticateWithDevelopmentRole,
  authenticateWithGoogleIdToken,
  clearGooglePromptState,
} from "../features/auth/authService";
import { clearRegistrationReferenceCache } from "../features/household-registration/householdRegistrationService";
import {
  clearModeRoleSettingsCaches,
  clearUserRoleSettingsCaches,
} from "../features/settings/settingsService";
import { clearUserOperationalDisasterEventSelections } from "../features/disaster-events/operationalDisasterEventSelection";
import { clearMasterlistMemoryCache } from "../features/masterlist/masterlistMemoryCache.mjs";
import { clearStubDashboardMemoryCache } from "../features/stubs/stubDashboardMemoryCache.mjs";
import {
  cleanupOfflineDataForActor,
  getActorLogoutDecisionEntriesFromStore,
} from "../offline/offlineDataLifecycle.js";
import { getSyncQueueActorContext } from "../offline/syncQueue.js";
import {
  getAuthSessionStorageKey,
  getSelectedRoleStorageKey,
} from "../utils/modeStorage.js";

const AuthContext = createContext(null);

const buildAuthState = () => {
  const accessMode = getAccessMode();
  const currentRole = getRoleForAccessMode(accessMode);
  const authenticatedUser = getAuthenticatedUser();

  return {
    accessMode,
    currentRole,
    authenticatedUser,
    isAuthenticated: Boolean(authenticatedUser),
  };
};

const buildAuthIdentityKey = (state = {}) =>
  JSON.stringify({
    accessMode: state.accessMode || "",
    userId: state.authenticatedUser?.id || "",
    roleCode: state.currentRole || "",
    barangayId: state.authenticatedUser?.default_barangay_id || "",
  });

const clearSensitiveOfflineMemoryCaches = () => {
  clearMasterlistMemoryCache();
  clearStubDashboardMemoryCache();
};

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(buildAuthState);
  const authIdentityKeyRef = useRef(buildAuthIdentityKey(authState));
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const accessMode = authState.accessMode || getAccessMode();

  const syncAuthState = useCallback(() => {
    const nextAuthState = buildAuthState();
    const nextIdentityKey = buildAuthIdentityKey(nextAuthState);

    if (authIdentityKeyRef.current !== nextIdentityKey) {
      clearSensitiveOfflineMemoryCaches();
      authIdentityKeyRef.current = nextIdentityKey;
    }

    setAuthState(nextAuthState);
  }, []);

  const clearScopedSettingsCache = useCallback(
    ({ mode = accessMode, userId = "", clearModeCache = false } = {}) => {
      if (userId) {
        clearUserRoleSettingsCaches({
          mode,
          userId,
        });
        return;
      }

      if (clearModeCache) {
        clearModeRoleSettingsCaches({ mode });
      }
    },
    [accessMode],
  );

  const resetAuthenticatedBrowserState = useCallback(
    ({
      mode = accessMode,
      userId = "",
      clearModeCache = false,
      nextAuthError = "",
    } = {}) => {
      clearSensitiveOfflineMemoryCaches();
      clearScopedSettingsCache({
        mode,
        userId,
        clearModeCache,
      });
      clearRegistrationReferenceCache();
      clearUserOperationalDisasterEventSelections({
        mode,
        userId,
      });
      clearGooglePromptState();
      clearAllAccessSessions();
      setAuthError(nextAuthError);
      syncAuthState();
    },
    [accessMode, clearScopedSettingsCache, syncAuthState],
  );

  const prepareOutgoingActorForAccountTransition = useCallback(
    async ({ nextUserId = "", nextRoleCode = "" } = {}) => {
      const outgoingActor = getSyncQueueActorContext();
      if (!outgoingActor.userId) return;

      if (
        outgoingActor.userId === nextUserId &&
        outgoingActor.roleCode === nextRoleCode
      ) {
        return;
      }

      const unresolvedEntries = await getActorLogoutDecisionEntriesFromStore(
        outgoingActor,
      );
      if (unresolvedEntries.length > 0) {
        const error = new Error(
          "This account has offline records that must be synchronized or explicitly discarded before switching users.",
        );
        error.code = "OFFLINE_WORK_REQUIRES_DECISION";
        throw error;
      }

      await cleanupOfflineDataForActor({
        actor: outgoingActor,
        reason: "logout",
      });
      clearSensitiveOfflineMemoryCaches();
    },
    [],
  );

  const selectDevelopmentRole = useCallback(async (role) => {
    if (role === ROLE_CODES.DONOR) {
      await prepareOutgoingActorForAccountTransition({
        nextRoleCode: ROLE_CODES.DONOR,
      });
      resetAuthenticatedBrowserState({
        userId: authState.authenticatedUser?.id || "",
      });
      setCurrentRole(role);
      syncAuthState();
      return {
        user: {
          role,
        },
      };
    }

    setIsAuthLoading(true);
    setAuthError("");

    try {
      const previousUserId = authState.authenticatedUser?.id || "";
      const sessionPayload = await authenticateWithDevelopmentRole(role);
      const nextUserId = sessionPayload?.user?.id || "";
      await prepareOutgoingActorForAccountTransition({
        nextUserId,
        nextRoleCode: sessionPayload?.user?.role || role,
      });

      if (previousUserId && previousUserId !== nextUserId) {
        clearScopedSettingsCache({
          userId: previousUserId,
        });
      }

      clearAllAccessSessions();
      setCurrentRole(role);
      setAuthenticatedSession(sessionPayload);
      syncAuthState();
      return sessionPayload;
    } catch (error) {
      const message = error.message || "Failed to sign in for development";
      setAuthError(message);
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  }, [authState.authenticatedUser?.id, clearScopedSettingsCache, prepareOutgoingActorForAccountTransition, resetAuthenticatedBrowserState, syncAuthState]);

  const continueAsDonor = useCallback(async () => {
    await prepareOutgoingActorForAccountTransition({
      nextRoleCode: ROLE_CODES.DONOR,
    });
    resetAuthenticatedBrowserState({
      userId: authState.authenticatedUser?.id || "",
    });
    setCurrentRole(ROLE_CODES.DONOR);
    syncAuthState();
  }, [
    authState.authenticatedUser?.id,
    prepareOutgoingActorForAccountTransition,
    resetAuthenticatedBrowserState,
    syncAuthState,
  ]);

  const signInWithGoogleCredential = useCallback(async (credential) => {
    setIsAuthLoading(true);
    setAuthError("");

    try {
      const previousUserId = authState.authenticatedUser?.id || "";
      const sessionPayload = await authenticateWithGoogleIdToken(credential);
      const nextUserId = sessionPayload?.user?.id || "";
      await prepareOutgoingActorForAccountTransition({
        nextUserId,
        nextRoleCode: sessionPayload?.user?.role || "",
      });

      if (previousUserId && previousUserId !== nextUserId) {
        clearScopedSettingsCache({
          userId: previousUserId,
        });
      }

      clearAllAccessSessions();
      if (accessMode === ACCESS_MODES.DEMO) {
        setCurrentRole(sessionPayload.user.role);
      }
      setAuthenticatedSession(sessionPayload);
      syncAuthState();
      return sessionPayload;
    } catch (error) {
      const message = error.message || "Failed to sign in with Google";
      setAuthError(message);
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  }, [accessMode, authState.authenticatedUser?.id, clearScopedSettingsCache, prepareOutgoingActorForAccountTransition, syncAuthState]);

  const clearSession = useCallback(() => {
    resetAuthenticatedBrowserState({
      userId: authState.authenticatedUser?.id || "",
    });
  }, [authState.authenticatedUser?.id, resetAuthenticatedBrowserState]);

  useEffect(() => {
    const handleAuthSessionInvalidated = (event) => {
      const detail = event?.detail || {};

      resetAuthenticatedBrowserState({
        mode: detail.mode || accessMode,
        userId: detail.userId || authState.authenticatedUser?.id || "",
        clearModeCache: !detail.userId,
        nextAuthError:
          ["api-401", "session-expired"].includes(detail.reason)
            ? "Your session expired. Please sign in again."
            : "",
      });
    };

    window.addEventListener(
      AUTH_SESSION_INVALIDATED_EVENT,
      handleAuthSessionInvalidated,
    );

    const pendingInvalidation = consumePendingAuthSessionInvalidation();

    if (pendingInvalidation) {
      handleAuthSessionInvalidated({ detail: pendingInvalidation });
    }

    return () => {
      window.removeEventListener(
        AUTH_SESSION_INVALIDATED_EVENT,
        handleAuthSessionInvalidated,
      );
    };
  }, [accessMode, authState.authenticatedUser?.id, resetAuthenticatedBrowserState]);

  useEffect(() => {
    const authStorageKeys = new Set([
      getAuthSessionStorageKey(accessMode),
      getSelectedRoleStorageKey(accessMode),
    ]);
    const handleStorageChange = (event) => {
      if (
        event.storageArea &&
        typeof window !== "undefined" &&
        event.storageArea !== window.localStorage
      ) {
        return;
      }

      if (event.key === null || authStorageKeys.has(event.key)) {
        syncAuthState();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [accessMode, syncAuthState]);

  useEffect(() => {
    const session = getAuthenticatedSession();
    const expiresAt = getAuthenticatedSessionExpiresAt(session);

    if (!expiresAt) {
      return undefined;
    }

    const remainingTime = Math.max(expiresAt - Date.now(), 0);
    const timeoutId = window.setTimeout(() => {
      // Reading the session performs the local expiry check and dispatches the
      // normal invalidation event without touching offline data.
      getAuthenticatedSession();
      syncAuthState();
    }, Math.min(remainingTime + 1, 2_147_483_647));

    return () => window.clearTimeout(timeoutId);
  }, [accessMode, authState.authenticatedUser?.id, syncAuthState]);

  const clearAuthError = useCallback(() => {
    setAuthError("");
  }, []);

  const contextValue = useMemo(() => {
    return {
      ...authState,
      isAuthLoading,
      authError,
      clearAuthError,
      continueAsDonor,
      clearSession,
      selectDevelopmentRole,
      signInWithGoogleCredential,
      syncAuthState,
    };
  }, [authError, authState, isAuthLoading]);

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
