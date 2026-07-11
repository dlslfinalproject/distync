import React from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import RoleSettingsViewShell from "../components/RoleSettingsViewShell";

const getMayorSettingsGridTemplateColumns = () => {
  if (typeof window === "undefined") {
    return "repeat(3, minmax(0, 1fr))";
  }

  if (window.innerWidth >= 1180) {
    return "repeat(3, minmax(0, 1fr))";
  }

  if (window.innerWidth >= 760) {
    return "repeat(2, minmax(0, 1fr))";
  }

  return "1fr";
};

const MayorSettingsView = ({
  activeSection,
  activeSectionMeta,
  roleMeta,
  pageActions,
  errorMessage,
  sectionCards,
  onOpenSection,
  toast,
  onCloseToast,
  settingsHubStyles,
  labelStyles,
  mutedValueStyles,
  StatusChip,
  ctx,
}) => {
  const {
    shellStyles,
    gridStyles,
    cardStyles,
    inputStyles,
    helperTextStyles,
    errorTextStyles,
    tableStyles,
    pageHeaderStyles,
    preferences,
    profileTouched,
    profileErrors,
    authenticatedUser,
    formatPhilippineContactNumberForDisplay,
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
    formatDateTime,
    formatSyncDateTime,
    InfoRow,
    EmptyState,
    isLoading,
    securityActivityLogs,
    notificationTouched,
    notificationValidationErrors,
    handleResetNotificationPreferences,
    BARANGAY_NOTIFICATION_OPTIONS,
    handleNotificationChannelToggle,
    notificationRules,
    enabledRuleCodes,
    toggleNotificationRule,
    navigate,
    handleSyncNow,
    isSyncingNow,
    syncSummary,
    LOCAL_SYNC_STATUS,
    getSyncStatusMeta,
    isOnline,
    ROLE_DISPLAY_NAMES,
    ROLE_CODES,
    localSyncLogRows,
    forecastHealth,
    inventoryThresholdSummary,
    unreadCount,
    notificationRuleCount,
  } = ctx;
  const [mayorGridTemplateColumns, setMayorGridTemplateColumns] = React.useState(
    getMayorSettingsGridTemplateColumns,
  );

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setMayorGridTemplateColumns(getMayorSettingsGridTemplateColumns());
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const mayorSettingsHubStyles = React.useMemo(() => {
    return {
      ...settingsHubStyles,
      grid: {
        ...settingsHubStyles.grid,
        gridTemplateColumns: mayorGridTemplateColumns,
      },
    };
  }, [mayorGridTemplateColumns, settingsHubStyles]);

  const renderSectionContent = () => {
    switch (activeSection) {
      case "profile":
        return (
          <section style={shellStyles.card}>
            <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Profile</h3>
              <p style={mutedValueStyles}>
                Keep Office of the Mayor account identity details accurate while
                leaving the assigned role and account email locked for this account.
              </p>
            </div>

            <div style={{ ...gridStyles, marginBottom: "18px" }}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Profile Summary</h4>
                <InfoRow
                  label="Account Name"
                  value={preferences.profile.fullName || "--"}
                />
                <InfoRow
                  label="Position"
                  value={ROLE_DISPLAY_NAMES[ROLE_CODES.MAYOR]}
                />
                <InfoRow label="Office / Unit" value="Office of the Mayor" muted />
              </article>

              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Account Contact</h4>
                <InfoRow
                  label="Email Address"
                  value={authenticatedUser?.email || preferences.profile.emailAddress || "--"}
                  muted
                />
                <InfoRow
                  label="Contact Number"
                  value={
                    preferences.profile.contactNumber
                      ? `PH +63 ${formatPhilippineContactNumberForDisplay(
                          preferences.profile.contactNumber,
                        )}`
                      : "--"
                  }
                />
              </article>
            </div>

            <div style={{ ...gridStyles, alignItems: "start" }}>
              <article style={cardStyles}>
                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="mayor-profile-full-name" style={labelStyles}>
                    Full Name
                  </label>
                  <input
                    id="mayor-profile-full-name"
                    value={preferences.profile.fullName}
                    onChange={(event) =>
                      handleProfileFieldChange("fullName", event.target.value)
                    }
                    onBlur={() => handleProfileFieldBlur("fullName")}
                    style={{
                      ...inputStyles.field,
                      ...(profileTouched.fullName && profileErrors.fullName
                        ? inputStyles.errorField
                        : {}),
                    }}
                  />
                  {profileTouched.fullName && profileErrors.fullName ? (
                    <p style={errorTextStyles}>{profileErrors.fullName}</p>
                  ) : (
                    <p style={helperTextStyles}>
                      Keep this updated for naming corrections and display consistency.
                    </p>
                  )}
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="mayor-profile-position" style={labelStyles}>
                    Position
                  </label>
                  <input
                    id="mayor-profile-position"
                    value={ROLE_DISPLAY_NAMES[ROLE_CODES.MAYOR]}
                    readOnly
                    style={{
                      ...inputStyles.field,
                      ...inputStyles.lockedField,
                    }}
                  />
                  <p style={helperTextStyles}>
                    Assigned role labels remain read-only in the current system setup.
                  </p>
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="mayor-profile-office" style={labelStyles}>
                    Office / Unit
                  </label>
                  <input
                    id="mayor-profile-office"
                    value="Office of the Mayor"
                    readOnly
                    style={{
                      ...inputStyles.field,
                      ...inputStyles.lockedField,
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="mayor-profile-contact" style={labelStyles}>
                    Contact Number
                  </label>
                  <div style={inputStyles.phoneInputGroup}>
                    <div style={inputStyles.phonePrefix}>PH +63</div>
                    <input
                      id="mayor-profile-contact"
                      type="text"
                      inputMode="numeric"
                      value={formatPhilippineContactNumberForDisplay(
                        preferences.profile.contactNumber,
                      )}
                      onChange={(event) =>
                        handleProfileFieldChange("contactNumber", event.target.value)
                      }
                      onBlur={() => handleProfileFieldBlur("contactNumber")}
                      placeholder="912 345 6789"
                      maxLength={12}
                      style={{
                        ...inputStyles.field,
                        ...inputStyles.phoneField,
                        ...(profileTouched.contactNumber && profileErrors.contactNumber
                          ? inputStyles.errorField
                          : {}),
                      }}
                    />
                  </div>
                  {profileTouched.contactNumber && profileErrors.contactNumber ? (
                    <p style={errorTextStyles}>{profileErrors.contactNumber}</p>
                  ) : (
                    <p style={helperTextStyles}>
                      Use the same Philippine contact number format used across DISTYNC.
                    </p>
                  )}
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="mayor-profile-email" style={labelStyles}>
                    Email Address
                  </label>
                  <input
                    id="mayor-profile-email"
                    type="email"
                    value={authenticatedUser?.email || preferences.profile.emailAddress}
                    readOnly
                    style={{
                      ...inputStyles.field,
                      ...inputStyles.lockedField,
                    }}
                  />
                  <p style={helperTextStyles}>
                    Account email stays locked to preserve sign-in and verification
                    integrity.
                  </p>
                </div>
              </article>

              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Profile Picture</h4>
                <div
                  style={{
                    width: "140px",
                    height: "140px",
                    borderRadius: "20px",
                    border: "1px solid #dbe6f0",
                    backgroundColor: "#eef5fc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {preferences.profile.profilePictureDataUrl ? (
                    <img
                      src={preferences.profile.profilePictureDataUrl}
                      alt="Mayor profile preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <span style={{ ...mutedValueStyles, textAlign: "center" }}>
                      No profile picture selected
                    </span>
                  )}
                </div>
                <p style={mutedValueStyles}>
                  {preferences.profile.profilePictureFileName ||
                    "Upload a profile photo for local UI personalization."}
                </p>
                <input
                  ref={profilePictureInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  style={{ display: "none" }}
                />
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => profilePictureInputRef.current?.click()}
                    style={pageHeaderStyles.secondaryButton}
                  >
                    Upload / Change
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPreferences((current) => ({
                        ...current,
                        profile: {
                          ...current.profile,
                          profilePictureDataUrl: "",
                          profilePictureFileName: "",
                        },
                        metadata: {
                          ...current.metadata,
                          lastProfileUpdateAt: new Date().toISOString(),
                        },
                      }))
                    }
                    style={pageHeaderStyles.secondaryButton}
                  >
                    Remove
                  </button>
                </div>
              </article>
            </div>
          </section>
        );
      case "security":
        return (
          <section style={shellStyles.card}>
            <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Security</h3>
              <p style={mutedValueStyles}>
                Keep password review and account protection settings grouped here
                without changing backend authentication behavior.
              </p>
            </div>

            <div style={gridStyles}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Password Management</h4>
                <p style={mutedValueStyles}>
                  Review password changes with frontend-only validation while keeping
                  the live authentication flow untouched.
                </p>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="mayor-security-current-password" style={labelStyles}>
                    Current Password
                  </label>
                  <div style={inputStyles.passwordWrapper}>
                    <input
                      id="mayor-security-current-password"
                      type={securityVisibility.currentPassword ? "text" : "password"}
                      value={securityForm.currentPassword}
                      onChange={(event) =>
                        setSecurityForm((current) => ({
                          ...current,
                          currentPassword: event.target.value,
                        }))
                      }
                      onBlur={() => handlePasswordFieldBlur("currentPassword")}
                      style={{
                        ...inputStyles.field,
                        ...inputStyles.passwordField,
                        ...(securityTouched.currentPassword &&
                        securityValidationErrors.currentPassword
                          ? inputStyles.errorField
                          : {}),
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility("currentPassword")}
                      style={inputStyles.visibilityButton}
                      aria-label={
                        securityVisibility.currentPassword
                          ? "Hide current password"
                          : "Show current password"
                      }
                    >
                      {securityVisibility.currentPassword ? (
                        <FiEyeOff size={18} />
                      ) : (
                        <FiEye size={18} />
                      )}
                    </button>
                  </div>
                  {securityTouched.currentPassword &&
                  securityValidationErrors.currentPassword ? (
                    <p style={errorTextStyles}>
                      {securityValidationErrors.currentPassword}
                    </p>
                  ) : null}
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="mayor-security-new-password" style={labelStyles}>
                    New Password
                  </label>
                  <div style={inputStyles.passwordWrapper}>
                    <input
                      id="mayor-security-new-password"
                      type={securityVisibility.newPassword ? "text" : "password"}
                      value={securityForm.newPassword}
                      onChange={(event) =>
                        setSecurityForm((current) => ({
                          ...current,
                          newPassword: event.target.value,
                        }))
                      }
                      onBlur={() => handlePasswordFieldBlur("newPassword")}
                      style={{
                        ...inputStyles.field,
                        ...inputStyles.passwordField,
                        ...(securityTouched.newPassword &&
                        securityValidationErrors.newPassword
                          ? inputStyles.errorField
                          : {}),
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility("newPassword")}
                      style={inputStyles.visibilityButton}
                      aria-label={
                        securityVisibility.newPassword
                          ? "Hide new password"
                          : "Show new password"
                      }
                    >
                      {securityVisibility.newPassword ? (
                        <FiEyeOff size={18} />
                      ) : (
                        <FiEye size={18} />
                      )}
                    </button>
                  </div>
                  {securityTouched.newPassword && securityValidationErrors.newPassword ? (
                    <p style={errorTextStyles}>
                      {securityValidationErrors.newPassword}
                    </p>
                  ) : (
                    <p style={helperTextStyles}>
                      Use at least 8 characters with uppercase, lowercase, and a
                      number.
                    </p>
                  )}
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="mayor-security-confirm-password" style={labelStyles}>
                    Confirm New Password
                  </label>
                  <div style={inputStyles.passwordWrapper}>
                    <input
                      id="mayor-security-confirm-password"
                      type={securityVisibility.confirmPassword ? "text" : "password"}
                      value={securityForm.confirmPassword}
                      onChange={(event) =>
                        setSecurityForm((current) => ({
                          ...current,
                          confirmPassword: event.target.value,
                        }))
                      }
                      onBlur={() => handlePasswordFieldBlur("confirmPassword")}
                      style={{
                        ...inputStyles.field,
                        ...inputStyles.passwordField,
                        ...(securityTouched.confirmPassword &&
                        securityValidationErrors.confirmPassword
                          ? inputStyles.errorField
                          : {}),
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility("confirmPassword")}
                      style={inputStyles.visibilityButton}
                      aria-label={
                        securityVisibility.confirmPassword
                          ? "Hide confirm password"
                          : "Show confirm password"
                      }
                    >
                      {securityVisibility.confirmPassword ? (
                        <FiEyeOff size={18} />
                      ) : (
                        <FiEye size={18} />
                      )}
                    </button>
                  </div>
                  {securityTouched.confirmPassword &&
                  securityValidationErrors.confirmPassword ? (
                    <p style={errorTextStyles}>
                      {securityValidationErrors.confirmPassword}
                    </p>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleLocalPasswordReview}
                    style={pageHeaderStyles.primaryButton}
                  >
                    Save Password Changes
                  </button>
                  <StatusChip
                    tone={
                      preferences.security.lastLocalPasswordChangeAt ? "success" : "info"
                    }
                    label={
                      preferences.security.lastLocalPasswordChangeAt
                        ? `Last updated ${formatDateTime(
                            preferences.security.lastLocalPasswordChangeAt,
                          )}`
                        : "No local password update yet"
                    }
                  />
                </div>
              </article>

              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>
                  Two-Factor Authentication
                </h4>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "#21405f",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.security.twoFactorEnabled)}
                    onChange={() =>
                      setPreferences((current) => ({
                        ...current,
                        security: {
                          ...current.security,
                          twoFactorEnabled: !current.security.twoFactorEnabled,
                          lastTwoFactorPreferenceUpdateAt: new Date().toISOString(),
                        },
                      }))
                    }
                  />
                  Enable two-factor authentication preference for this role
                </label>
                <p style={mutedValueStyles}>
                  Stored locally as a coordination preference until centralized 2FA
                  management is introduced.
                </p>
                <StatusChip
                  tone={preferences.security.twoFactorEnabled ? "success" : "info"}
                  label={preferences.security.twoFactorEnabled ? "Enabled" : "Optional"}
                />
              </article>

              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Security Activity</h4>
                <p style={mutedValueStyles}>
                  Review recent security-setting actions for this account. This
                  section only shows frontend-visible account protection activity.
                </p>

                {securityActivityLogs.length === 0 ? (
                  <EmptyState message="No recent security activity is available for this device yet." />
                ) : (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {securityActivityLogs.map((entry) => (
                      <article
                        key={entry.id}
                        style={{
                          border: "1px solid #dbe6f0",
                          borderRadius: "16px",
                          padding: "16px 18px",
                          backgroundColor: "#fbfdff",
                          display: "grid",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "12px",
                            flexWrap: "wrap",
                          }}
                        >
                          <strong style={{ color: "#17324d" }}>{entry.title}</strong>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <StatusChip tone="info" label={entry.moduleLabel || "Security"} />
                            <StatusChip
                              tone={entry.tone || "info"}
                              label={entry.tone || "info"}
                            />
                          </div>
                        </div>
                        <p style={mutedValueStyles}>{entry.detail}</p>
                        <p style={{ ...mutedValueStyles, fontSize: "12px" }}>
                          {formatDateTime(entry.timestamp)}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </article>
            </div>
          </section>
        );
      case "notification-preferences":
        return (
          <section style={shellStyles.card}>
            <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>
                Notification Preferences
              </h3>
              <p style={mutedValueStyles}>
                Review the local executive notification rule preferences for the
                Office of the Mayor. These selections are stored on this device and
                do not rewrite backend notification mappings.
              </p>
            </div>

            <div style={{ ...gridStyles, alignItems: "start" }}>
              <article style={cardStyles}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: "8px" }}>
                    <h4 style={{ margin: 0, color: "#17324d" }}>Alert Channels</h4>
                    <p style={helperTextStyles}>
                      Choose which alert types stay enabled locally and which
                      delivery channel you prefer when available.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetNotificationPreferences}
                    style={pageHeaderStyles.secondaryButton}
                  >
                    Reset to Default
                  </button>
                </div>

                {notificationTouched &&
                Object.values(notificationValidationErrors).some(Boolean) ? (
                  <div
                    style={{
                      border: "1px solid #f0d2d8",
                      borderRadius: "14px",
                      padding: "14px 16px",
                      backgroundColor: "#fff8f9",
                      display: "grid",
                      gap: "8px",
                    }}
                  >
                    {notificationValidationErrors.notificationTypes ? (
                      <p style={errorTextStyles}>
                        {notificationValidationErrors.notificationTypes}
                      </p>
                    ) : null}
                    {notificationValidationErrors.notificationChannels ? (
                      <p style={errorTextStyles}>
                        {notificationValidationErrors.notificationChannels}
                      </p>
                    ) : null}
                    {notificationValidationErrors.emailAddress ? (
                      <p style={errorTextStyles}>
                        {notificationValidationErrors.emailAddress}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p style={helperTextStyles}>
                    Keep at least one enabled channel for every notification type.
                    Email preferences only affect this frontend settings profile
                    right now.
                  </p>
                )}

                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyles.table}>
                    <thead>
                      <tr>
                        <th style={tableStyles.th}>Notification Type</th>
                        <th style={tableStyles.th}>In-App</th>
                        <th style={tableStyles.th}>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {BARANGAY_NOTIFICATION_OPTIONS.map((option) => (
                        <tr key={option.key}>
                          <td style={tableStyles.td}>
                            <div style={{ display: "grid", gap: "6px" }}>
                              <strong>{option.label}</strong>
                              <p style={helperTextStyles}>{option.description}</p>
                            </div>
                          </td>
                          <td style={tableStyles.td}>
                            <input
                              type="checkbox"
                              checked={Boolean(
                                preferences.notificationChannels[option.key]?.inApp,
                              )}
                              onChange={() =>
                                handleNotificationChannelToggle(option.key, "inApp")
                              }
                            />
                          </td>
                          <td style={tableStyles.td}>
                            <input
                              type="checkbox"
                              checked={Boolean(
                                preferences.notificationChannels[option.key]?.email,
                              )}
                              onChange={() =>
                                handleNotificationChannelToggle(option.key, "email")
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>
                  Existing Role Rule Mapping
                </h4>
                <p style={helperTextStyles}>
                  These mapped rules come from the current backend role
                  configuration. Toggling them here saves your local review
                  preference only and does not rewrite server-side notification
                  rules.
                </p>
                <div style={{ display: "grid", gap: "10px" }}>
                  <InfoRow label="Unread Notifications" value={`${unreadCount}`} />
                  <InfoRow
                    label="Active Rules for This Role"
                    value={`${notificationRuleCount}`}
                  />
                  <InfoRow
                    label="Rules Enabled Locally"
                    value={`${enabledRuleCodes.length}`}
                  />
                </div>
                {isLoading ? (
                  <EmptyState message="Loading notification settings..." />
                ) : notificationRules.length === 0 ? (
                  <EmptyState message="No notification rules are currently mapped to this role." />
                ) : (
                  <div style={{ display: "grid", gap: "10px" }}>
                    {notificationRules.map((rule) => {
                      const isEnabled = enabledRuleCodes.includes(rule.code);

                      return (
                        <label
                          key={rule.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "10px",
                            color: "#21405f",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => toggleNotificationRule(rule.code)}
                            style={{ marginTop: "3px" }}
                          />
                          <span>
                            <strong>{rule.name}</strong>
                            <span style={{ ...mutedValueStyles, display: "block" }}>
                              {rule.trigger_type} ({rule.is_active ? "Active" : "Inactive"})
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </article>
            </div>
          </section>
        );
      case "sync-status":
        return (
          <section style={shellStyles.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "20px",
                flexWrap: "wrap",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "grid", gap: "8px", flex: "1 1 320px" }}>
                <h3 style={{ margin: 0, color: "#17324d" }}>Sync Center</h3>
                <p style={mutedValueStyles}>
                  Monitor pending queue records, sync health, and recent local
                  synchronization activity here. Use the full Sync Center for
                  deeper monitoring when needed.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={isSyncingNow}
                  style={pageHeaderStyles.primaryButton}
                >
                  {isSyncingNow ? "Syncing..." : "Sync Now"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/inventory/sync")}
                  style={pageHeaderStyles.secondaryButton}
                >
                  Open Full Sync Center
                </button>
              </div>
            </div>

            <div style={gridStyles}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Sync Summary</h4>
                <InfoRow label="Connection" value={isOnline ? "Online" : "Offline"} />
                <InfoRow
                  label="Last Queue Update"
                  value={formatSyncDateTime(localSyncLogRows[0]?.timestamp)}
                />
                <InfoRow
                  label="Pending Queue Entries"
                  value={`${syncSummary[LOCAL_SYNC_STATUS.PENDING] || 0}`}
                />
                <InfoRow
                  label="Failed / Conflict Entries"
                  value={`${
                    (syncSummary[LOCAL_SYNC_STATUS.FAILED] || 0) +
                    (syncSummary[LOCAL_SYNC_STATUS.CONFLICT] || 0)
                  }`}
                />
                <StatusChip
                  tone={getSyncStatusMeta(syncSummary, isOnline).tone}
                  label={getSyncStatusMeta(syncSummary, isOnline).label}
                />
              </article>

              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Synced Record Types</h4>
                <div style={{ display: "grid", gap: "10px" }}>
                  {[
                    "Inventory Updates",
                    "Distribution Records",
                    "Donation Records",
                    "System Queue Entries",
                  ].map((label) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <span style={{ color: "#21405f", fontWeight: 700 }}>{label}</span>
                      <StatusChip
                        tone="info"
                        label={localSyncLogRows.length > 0 ? "Tracked" : "Waiting"}
                      />
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <div style={{ marginTop: "20px" }}>
              <h4 style={{ margin: "0 0 12px", color: "#17324d" }}>
                Local Queue Activity
              </h4>
              {localSyncLogRows.length === 0 ? (
                <EmptyState message="No local sync queue activity is available for this Office of the Mayor account yet." />
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyles.table}>
                    <thead>
                      <tr>
                        <th style={tableStyles.th}>Date & Time</th>
                        <th style={tableStyles.th}>Record Type</th>
                        <th style={tableStyles.th}>Status</th>
                        <th style={tableStyles.th}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localSyncLogRows.slice(0, 12).map((row) => (
                        <tr key={row.id}>
                          <td style={tableStyles.td}>
                            {formatSyncDateTime(row.timestamp)}
                          </td>
                          <td style={tableStyles.td}>{row.label}</td>
                          <td style={tableStyles.td}>
                            <StatusChip
                              tone={
                                row.status === LOCAL_SYNC_STATUS.FAILED
                                  ? "error"
                                  : row.status === LOCAL_SYNC_STATUS.CONFLICT
                                    ? "warning"
                                    : row.status === "RESOLVED"
                                      ? "success"
                                      : "info"
                              }
                              label={row.status}
                            />
                          </td>
                          <td style={tableStyles.td}>{row.detail || "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        );
      case "analytics-service":
        return (
          <section style={shellStyles.card}>
            <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Analytics Service</h3>
              <p style={mutedValueStyles}>
                Review read-only analytics availability for executive visibility.
              </p>
            </div>

            <div style={gridStyles}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Service Health</h4>
                {isLoading ? (
                  <EmptyState message="Checking analytics service..." />
                ) : forecastHealth ? (
                  <>
                    <InfoRow
                      label="Service Status"
                      value={forecastHealth.status || "Online"}
                    />
                    <InfoRow
                      label="Checked Endpoint"
                      value={forecastHealth.analytics_url || "--"}
                      muted
                    />
                    <StatusChip
                      tone={
                        forecastHealth.status === "Online"
                          ? "success"
                          : forecastHealth.status === "Offline"
                            ? "error"
                            : "warning"
                      }
                      label={forecastHealth.status || "Unavailable"}
                    />
                  </>
                ) : (
                  <>
                    <EmptyState message="Analytics service unavailable." />
                    <StatusChip tone="error" label="Unavailable" />
                  </>
                )}
              </article>
            </div>
          </section>
        );
      case "inventory-alert-thresholds":
        return (
          <section style={shellStyles.card}>
            <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>
                Inventory Alert Thresholds
              </h3>
              <p style={mutedValueStyles}>
                Review read-only inventory threshold coverage without changing live
                operational rules.
              </p>
            </div>

            <div style={gridStyles}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Threshold Coverage</h4>
                <p style={mutedValueStyles}>
                  Thresholds are currently operational values tied to inventory records
                  and service logic. This section shows them read-only for safety.
                </p>
                <InfoRow
                  label="Configured Active Items"
                  value={`${inventoryThresholdSummary?.configured_items || 0}`}
                />
                <InfoRow
                  label="Distinct Threshold Values"
                  value={
                    inventoryThresholdSummary?.distinct_thresholds?.length
                      ? inventoryThresholdSummary.distinct_thresholds.join(", ")
                      : "No thresholds loaded"
                  }
                />
              </article>
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <RoleSettingsViewShell
      activeSectionMeta={activeSectionMeta}
      roleMeta={roleMeta}
      pageActions={pageActions}
      errorMessage={errorMessage}
      renderSectionContent={renderSectionContent}
      sectionCards={sectionCards}
      onOpenSection={onOpenSection}
      dashboardDescription="Choose a category below to keep the Mayor Settings workspace focused and uncluttered. Detailed forms and system summaries only appear after you open a section."
      toast={toast}
      onCloseToast={onCloseToast}
      settingsHubStyles={mayorSettingsHubStyles}
      labelStyles={labelStyles}
      mutedValueStyles={mutedValueStyles}
      StatusChip={StatusChip}
    />
  );
};

export default MayorSettingsView;
