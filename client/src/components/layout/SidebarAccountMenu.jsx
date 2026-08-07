import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiLogOut, FiSettings } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import ConfirmationModal from "../shared/ConfirmationModal";
import ProfileAvatar from "../shared/ProfileAvatar";
import { useAuth } from "../../context/AuthContext";
import { ACCESS_MODES } from "../../utils/accessMode";
import { ROLE_CODES } from "../../utils/roleSession";
import { buildDisplayName } from "../../pages/settings/settingsHelpers";
import { loadRoleSettingsState } from "../../features/settings/settingsService";

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

const getUserName = (user = {}) =>
  buildDisplayName({
    firstName: user.firstName || user.first_name,
    middleName: user.middleName || user.middle_name,
    lastName: user.lastName || user.last_name,
  }) || user.email || "DISTYNC User";

const SidebarAccountMenu = () => {
  const navigate = useNavigate();
  const { accessMode, authenticatedUser, clearSession, currentRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [savedProfile, setSavedProfile] = useState(null);
  const containerRef = useRef(null);
  const accountButtonRef = useRef(null);
  const menuRef = useRef(null);
  const details = roleDetails[currentRole] || {};
  const displayName = useMemo(
    () => getUserName(authenticatedUser) || buildDisplayName(savedProfile || {}),
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

  const completeLogout = () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    clearSession();
    navigate(accessMode === ACCESS_MODES.DEVELOPMENT ? "/role-switcher" : "/access", { replace: true });
  };

  const handleLogoutClick = () => {
    setIsOpen(false);
    if (accessMode === ACCESS_MODES.DEVELOPMENT) {
      completeLogout();
      return;
    }
    setIsLogoutDialogOpen(true);
  };

  return (
    <div ref={containerRef} style={styles.container}>
      {isOpen ? (
        <div ref={menuRef} role="menu" aria-label="Account menu" style={styles.menu}>
          <div style={styles.menuIdentity}>
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
        onCancel={() => setIsLogoutDialogOpen(false)} onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={completeLogout} confirmLabel="Log Out" confirmTone="destructive" isSubmitting={isLoggingOut}
        finalFocusRef={accountButtonRef}
      />
    </div>
  );
};

export default SidebarAccountMenu;
