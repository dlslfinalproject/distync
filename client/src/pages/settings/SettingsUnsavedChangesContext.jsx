import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";

const SettingsUnsavedChangesContext = createContext(null);

export const SettingsUnsavedChangesProvider = ({ children }) => {
  const voluntaryLogoutGuardRef = useRef(null);

  const registerVoluntaryLogoutGuard = useCallback((guard) => {
    voluntaryLogoutGuardRef.current =
      typeof guard === "function" ? guard : null;

    return () => {
      if (voluntaryLogoutGuardRef.current === guard) {
        voluntaryLogoutGuardRef.current = null;
      }
    };
  }, []);

  const requestVoluntaryLogout = useCallback((request = {}) => {
    if (!voluntaryLogoutGuardRef.current) {
      return false;
    }

    return Boolean(voluntaryLogoutGuardRef.current(request));
  }, []);

  const value = useMemo(
    () => ({
      registerVoluntaryLogoutGuard,
      requestVoluntaryLogout,
    }),
    [registerVoluntaryLogoutGuard, requestVoluntaryLogout],
  );

  return (
    <SettingsUnsavedChangesContext.Provider value={value}>
      {children}
    </SettingsUnsavedChangesContext.Provider>
  );
};

export const useSettingsUnsavedChangesGuard = () => {
  const context = useContext(SettingsUnsavedChangesContext);

  if (!context) {
    return {
      registerVoluntaryLogoutGuard: () => () => {},
      requestVoluntaryLogout: () => false,
    };
  }

  return context;
};
