import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ACCESS_MODES, getAccessMode } from "../utils/accessMode";
import {
  AUTH_SESSION_INVALIDATED_EVENT,
  ROLE_CODES,
  clearAllAccessSessions,
  consumePendingAuthSessionInvalidation,
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

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(buildAuthState);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const accessMode = authState.accessMode || getAccessMode();

  const syncAuthState = useCallback(() => {
    setAuthState(buildAuthState());
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

  const selectDevelopmentRole = useCallback(async (role) => {
    if (role === ROLE_CODES.DONOR) {
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
  }, [authState.authenticatedUser?.id, clearScopedSettingsCache, resetAuthenticatedBrowserState, syncAuthState]);

  const continueAsDonor = useCallback(() => {
    resetAuthenticatedBrowserState({
      userId: authState.authenticatedUser?.id || "",
    });
    setCurrentRole(ROLE_CODES.DONOR);
    syncAuthState();
  }, [authState.authenticatedUser?.id, resetAuthenticatedBrowserState, syncAuthState]);

  const signInWithGoogleCredential = useCallback(async (credential) => {
    setIsAuthLoading(true);
    setAuthError("");

    try {
      const previousUserId = authState.authenticatedUser?.id || "";
      const sessionPayload = await authenticateWithGoogleIdToken(credential);
      const nextUserId = sessionPayload?.user?.id || "";

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
  }, [accessMode, authState.authenticatedUser?.id, clearScopedSettingsCache, syncAuthState]);

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
          detail.reason === "api-401"
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
