import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { ACCESS_MODES, getAccessMode } from "../utils/accessMode";
import {
  ROLE_CODES,
  clearAllAccessSessions,
  clearAuthenticatedSession,
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

  if (!accessMode) {
    throw new Error("VITE_ACCESS_MODE is not defined. Check your .env file.");
  }

  const syncAuthState = useCallback(() => {
    setAuthState(buildAuthState());
  }, []);

  const selectDevelopmentRole = useCallback(async (role) => {
    if (role === ROLE_CODES.DONOR) {
      clearAuthenticatedSession();
      setCurrentRole(role);
      setAuthError("");
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
      const sessionPayload = await authenticateWithDevelopmentRole(role);
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
  }, [syncAuthState]);

  const continueAsDonor = useCallback(() => {
    clearAuthenticatedSession();
    setCurrentRole(ROLE_CODES.DONOR);
    setAuthError("");
    syncAuthState();
  }, [syncAuthState]);

  const signInWithGoogleCredential = useCallback(async (credential) => {
    setIsAuthLoading(true);
    setAuthError("");

    try {
      const sessionPayload = await authenticateWithGoogleIdToken(credential);
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
  }, [accessMode, syncAuthState]);

  const clearSession = useCallback(() => {
    clearGooglePromptState();
    clearAllAccessSessions();
    setAuthError("");
    syncAuthState();
  }, [syncAuthState]);

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
