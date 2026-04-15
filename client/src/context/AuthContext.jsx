import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { getAccessMode } from "../utils/accessMode";
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

  const syncAuthState = useCallback(() => {
    setAuthState(buildAuthState());
  }, []);

  const selectDevelopmentRole = useCallback((role) => {
    clearAuthenticatedSession();
    setCurrentRole(role);
    setAuthError("");
    syncAuthState();
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
  }, [syncAuthState]);

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
