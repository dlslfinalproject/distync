import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiLogOut, FiSettings } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import ConfirmationModal from "../shared/ConfirmationModal";
import FormModalShell from "../shared/FormModalShell";
import { pageHeaderStyles } from "./PageHeader";
import ProfileAvatar from "../shared/ProfileAvatar";
import { useAuth } from "../../context/AuthContext";
import { ACCESS_MODES } from "../../utils/accessMode";
import { getStoredUserDisplayName } from "../../utils/profileName.mjs";
import { ROLE_CODES } from "../../utils/roleSession";
import { useSettingsUnsavedChangesGuard } from "../../pages/settings/SettingsUnsavedChangesContext";
import { loadRoleSettingsState } from "../../features/settings/settingsService";
import {
  cleanupOfflineDataForActor,
  getActorLogoutDecisionEntriesFromStore,
} from "../../offline/offlineDataLifecycle.js";
import {
  flushPendingSyncEntries,
} from "../../offline/syncService.js";
import {
  getSyncQueueActorContext,
  isSyncQueueActorContextCurrent,
} from "../../offline/syncQueue.js";

const roleDetails = {
  [ROLE_CODES.BARANGAY]: { label: "Barangay Official", settingsRoute: "/barangay/settings" },
  [ROLE_CODES.MSWDO]: { label: "MSWDO Personnel", settingsRoute: "/mswdo/settings" },
  [ROLE_CODES.MAYOR]: { label: "Office of the Mayor", settingsRoute: "/inventory/settings" },
};

const styles = {
  container: { position: "relative", flexShrink: 0 },
  accountButton: {
    width: "100%", border: "1px solid #d2e0ee", borderRadius: "14px",
    background: "rgba(255, 255, 255, 0.84)", color: "#17324d", padding: "10px",
    display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", textAlign: "left",
    boxShadow: "0 5px 14px rgba(72, 95, 122, 0.06)",
  },
  menu: {
    position: "absolute", bottom: "calc(100% + 10px)", left: 0, width: "100%", minWidth: "238px",
    boxSizing: "border-box", border: "1px solid #d2e0ee", borderRadius: "16px", background: "#ffffff",
    boxShadow: "0 18px 32px rgba(39, 70, 104, 0.16)", padding: "8px", zIndex: 60,
  },
  menuIdentity: { padding: "10px 12px", borderBottom: "1px solid #e3edf6", marginBottom: "6px" },
  menuAction: {
    width: "100%", display: "flex", alignItems: "center", gap: "10px", border: "none", borderRadius: "10px",
    padding: "11px 12px", background: "transparent", color: "#24496e", cursor: "pointer", textAlign: "left", fontWeight: 700,
  },
};

const SidebarAccountMenu = () => {
  const navigate = useNavigate();
  const { accessMode, authenticatedUser, clearSession, currentRole } = useAuth();
  const { requestVoluntaryLogout } = useSettingsUnsavedChangesGuard();
  const [isOpen, setIsOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isPendingLogoutDialogOpen, setIsPendingLogoutDialogOpen] = useState(false);
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutActor, setLogoutActor] = useState(null);
  const [pendingWorkCount, setPendingWorkCount] = useState(0);
  const [logoutError, setLogoutError] = useState("");
  const [logoutCheckFailed, setLogoutCheckFailed] = useState(false);
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine !== false,
  );
  const [savedProfile, setSavedProfile] = useState(null);
  const containerRef = useRef(null);
  const accountButtonRef = useRef(null);
  const menuRef = useRef(null);
  const details = roleDetails[currentRole] || {};
  const displayName = useMemo(
    () =>
      getStoredUserDisplayName({
        authenticatedUser,
        storedProfile: savedProfile || {},
      }),
    [authenticatedUser, savedProfile],
  );
  const avatarUrl = authenticatedUser?.profilePictureUrl || authenticatedUser?.profile_picture_url || savedProfile?.profilePictureUrl || "";

  useEffect(() => {
    if (!authenticatedUser?.id || !currentRole) {
      setSavedProfile(null);
      return undefined;
    }

    let isMounted = true;
    loadRoleSettingsState({ roleCode: currentRole, userId: authenticatedUser.id })
      .then((result) => {
        if (isMounted) setSavedProfile(result?.settings?.profile || null);
      })
      .catch(() => {
        if (isMounted) setSavedProfile(null);
      });
    return () => { isMounted = false; };
  }, [authenticatedUser?.id, currentRole]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnOutsidePointer = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        accountButtonRef.current?.focus();
      }
    };
    window.addEventListener("mousedown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const completeLogout = async (actor = logoutActor) => {
    if (!actor) return;
    setIsLoggingOut(true);
    setLogoutError("");

    try {
      if (!isSyncQueueActorContextCurrent(actor)) {
        throw new Error("The signed-in account changed before logout could finish.");
      }

      const unresolvedEntries = await getActorLogoutDecisionEntriesFromStore(actor);
      if (!isSyncQueueActorContextCurrent(actor)) {
        throw new Error("The signed-in account changed before logout could finish.");
      }
      if (unresolvedEntries.length > 0) {
        setPendingWorkCount(unresolvedEntries.length);
        setLogoutCheckFailed(false);
        setIsLogoutDialogOpen(false);
        setIsPendingLogoutDialogOpen(true);
        return;
      }

      await cleanupOfflineDataForActor({ actor, reason: "logout" });
      if (!isSyncQueueActorContextCurrent(actor)) {
        throw new Error("The signed-in account changed before logout could finish.");
      }

      clearSession();
      navigate(
        accessMode === ACCESS_MODES.DEVELOPMENT ? "/role-switcher" : "/access",
        { replace: true },
      );
    } catch (error) {
      if (error?.code === "OFFLINE_WORK_REQUIRES_DECISION") {
        setPendingWorkCount(error.entries?.length || 1);
        setLogoutCheckFailed(false);
        setIsLogoutDialogOpen(false);
        setIsPendingLogoutDialogOpen(true);
      } else {
        setLogoutError(
          "Logout could not be completed safely. Your offline records have been kept; try again or cancel.",
        );
        setIsLogoutDialogOpen(true);
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  const beginLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError("");
    setLogoutCheckFailed(false);

    const actor = getSyncQueueActorContext();
    setLogoutActor(actor);

    try {
      const unresolvedEntries = await getActorLogoutDecisionEntriesFromStore(actor);
      if (!isSyncQueueActorContextCurrent(actor)) {
        throw new Error("The signed-in account changed before logout could finish.");
      }

      if (unresolvedEntries.length > 0) {
        setPendingWorkCount(unresolvedEntries.length);
        setIsPendingLogoutDialogOpen(true);
        return;
      }

      if (accessMode === ACCESS_MODES.DEVELOPMENT) {
        await completeLogout(actor);
      } else {
        setIsLogoutDialogOpen(true);
      }
    } catch (_error) {
      setLogoutCheckFailed(true);
      setLogoutError(
        "This device's offline records could not be checked. Your account remains signed in; try again before logging out.",
      );
      setIsPendingLogoutDialogOpen(true);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSyncAndLogout = async () => {
    const actor = logoutActor;
    if (!actor || isLoggingOut) return;

    setIsLoggingOut(true);
    setLogoutError("");
    try {
      const result = await flushPendingSyncEntries({ source: "logout" });
      if (!isSyncQueueActorContextCurrent(actor)) return;

      const unresolvedEntries = await getActorLogoutDecisionEntriesFromStore(actor);
      if (!isSyncQueueActorContextCurrent(actor)) return;
      if (unresolvedEntries.length > 0) {
        setPendingWorkCount(unresolvedEntries.length);
        const hasUnresolvedConflict = unresolvedEntries.some(
          (entry) => String(entry?.status || "").toUpperCase() === "CONFLICT",
        );
        const hasUnresolvedFailure = unresolvedEntries.some(
          (entry) => String(entry?.status || "").toUpperCase() === "FAILED",
        );
        setLogoutError(
          result?.conflictIds?.length || hasUnresolvedConflict
            ? "A record still needs conflict review. Nothing unresolved was deleted."
            : result?.failedIds?.length || hasUnresolvedFailure
              ? "Some offline records could not be synchronized. They have been kept on this device."
              : "Some offline records are still waiting to synchronize. They have been kept on this device.",
        );
        return;
      }

      setIsPendingLogoutDialogOpen(false);
      await completeLogout(actor);
    } catch (_error) {
      setLogoutError(
        "Synchronization did not finish. Your offline records have been kept; try again when the connection is available.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDiscardOfflineData = async () => {
    const actor = logoutActor;
    if (!actor || isLoggingOut) return;

    setIsLoggingOut(true);
    setLogoutError("");
    try {
      await cleanupOfflineDataForActor({
        actor,
        reason: "user-confirmed-discard",
      });
      if (!isSyncQueueActorContextCurrent(actor)) return;

      setIsDiscardDialogOpen(false);
      setIsPendingLogoutDialogOpen(false);
      clearSession();
      navigate(
        accessMode === ACCESS_MODES.DEVELOPMENT ? "/role-switcher" : "/access",
        { replace: true },
      );
    } catch (_error) {
      setIsDiscardDialogOpen(false);
      setIsPendingLogoutDialogOpen(true);
      setLogoutError(
        "The offline records could not be removed. Your account remains signed in and the records have been kept.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogoutClick = () => {
    setIsOpen(false);
    const wasSettingsLogoutIntercepted = requestVoluntaryLogout({
      onConfirm: beginLogout,
    });

    if (wasSettingsLogoutIntercepted) {
      return;
    }

    void beginLogout();
  };

  useEffect(() => {
    if (!isPendingLogoutDialogOpen) return undefined;

    const updateConnectivity = () =>
      setIsOnline(typeof navigator === "undefined" || navigator.onLine !== false);
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
    updateConnectivity();
    return () => {
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    };
  }, [isPendingLogoutDialogOpen]);

  return (
    <div ref={containerRef} style={styles.container}>
      {isOpen ? (
        <div ref={menuRef} role="menu" aria-label="Account menu" style={styles.menu}>
          <div style={{ ...styles.menuIdentity, minWidth: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
            <div style={{ marginTop: "3px", color: "#627990", fontSize: "12px", fontWeight: 700 }}>{details.label || "DISTYNC user"}</div>
          </div>
          <button type="button" role="menuitem" style={styles.menuAction} onClick={() => { setIsOpen(false); navigate(details.settingsRoute); }}>
            <FiSettings size={17} /> Account Settings
          </button>
          <button type="button" role="menuitem" style={{ ...styles.menuAction, color: "#a23842" }} onClick={handleLogoutClick}>
            <FiLogOut size={17} /> Log Out
          </button>
        </div>
      ) : null}
      <button
        ref={accountButtonRef} type="button" style={styles.accountButton}
        onClick={() => setIsOpen((value) => !value)} aria-haspopup="menu" aria-expanded={isOpen}
        aria-label={`Open account menu for ${displayName}`}
      >
        <ProfileAvatar src={avatarUrl} displayName={displayName} alt="" style={{ width: "38px", height: "38px", border: "2px solid #e0ebf6", flexShrink: 0 }} fallbackStyle={{ fontSize: "14px" }} />
        <span style={{ minWidth: 0, display: "grid", gap: "3px" }}>
          <span style={{ fontSize: "13px", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</span>
          <span style={{ color: "#627990", fontSize: "12px", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{details.label || "DISTYNC user"}</span>
        </span>
      </button>
      <ConfirmationModal
        isOpen={isLogoutDialogOpen} title="Log out?" message="Are you sure you want to log out of DISTYNC?"
        onCancel={() => { setIsLogoutDialogOpen(false); setLogoutError(""); }}
        onClose={() => { setIsLogoutDialogOpen(false); setLogoutError(""); }}
        onConfirm={() => completeLogout()} confirmLabel="Log Out" confirmTone="destructive" isSubmitting={isLoggingOut}
        finalFocusRef={accountButtonRef}
      >
        {logoutError ? <p role="alert" style={{ color: "#a23842", lineHeight: 1.5 }}>{logoutError}</p> : null}
      </ConfirmationModal>
      <FormModalShell
        isOpen={isPendingLogoutDialogOpen}
        title={logoutCheckFailed ? "Offline Records Could Not Be Checked" : "Unsynchronized Offline Data"}
        description={
          logoutCheckFailed
            ? "Your account remains signed in because this device's offline records could not be checked. Try again before logging out."
            : isOnline
              ? `This device contains ${pendingWorkCount} offline record${pendingWorkCount === 1 ? "" : "s"} that have not yet been synchronized. Synchronize them before logging out to avoid losing pending work.`
              : `This device contains ${pendingWorkCount} offline record${pendingWorkCount === 1 ? "" : "s"} that have not yet been synchronized. Connect to the internet and synchronize them before logging out, or discard the device-only records.`
        }
        onClose={() => {
          if (isLoggingOut) return;
          setIsPendingLogoutDialogOpen(false);
          setLogoutError("");
        }}
        isCloseDisabled={isLoggingOut}
        finalFocusRef={accountButtonRef}
        footer={
          <>
            <button
              type="button"
              style={pageHeaderStyles.secondaryButton}
              disabled={isLoggingOut}
              onClick={() => {
                setIsPendingLogoutDialogOpen(false);
                setLogoutError("");
              }}
            >
              Cancel
            </button>
            {logoutCheckFailed ? (
              <button
                type="button"
                style={pageHeaderStyles.primaryButton}
                disabled={isLoggingOut}
                onClick={() => {
                  setIsPendingLogoutDialogOpen(false);
                  void beginLogout();
                }}
              >
                Try Again
              </button>
            ) : null}
            {!logoutCheckFailed && isOnline ? (
              <button
                type="button"
                style={pageHeaderStyles.primaryButton}
                disabled={isLoggingOut}
                onClick={handleSyncAndLogout}
              >
                {isLoggingOut ? "Synchronizing…" : "Sync and Logout"}
              </button>
            ) : null}
            {!logoutCheckFailed ? (
              <button
                type="button"
                style={{
                  ...pageHeaderStyles.primaryButton,
                  background: "#b91c1c",
                  border: "1px solid #b91c1c",
                }}
                disabled={isLoggingOut}
                onClick={() => {
                  setIsPendingLogoutDialogOpen(false);
                  setIsDiscardDialogOpen(true);
                }}
              >
                Discard Offline Data and Logout
              </button>
            ) : null}
          </>
        }
      >
        {logoutError ? <p role="alert" style={{ color: "#a23842", lineHeight: 1.5 }}>{logoutError}</p> : null}
      </FormModalShell>
      <ConfirmationModal
        isOpen={isDiscardDialogOpen}
        title="Discard Offline Data?"
        message="Discarding will permanently delete unsynchronized records stored only on this device. Records already synchronized with the server will not be deleted."
        onCancel={() => {
          setIsDiscardDialogOpen(false);
          setIsPendingLogoutDialogOpen(true);
        }}
        onClose={() => {
          if (isLoggingOut) return;
          setIsDiscardDialogOpen(false);
          setIsPendingLogoutDialogOpen(true);
        }}
        onConfirm={handleDiscardOfflineData}
        confirmLabel="Discard and Log Out"
        confirmTone="destructive"
        isSubmitting={isLoggingOut}
        finalFocusRef={accountButtonRef}
      />
    </div>
  );
};

export default SidebarAccountMenu;
