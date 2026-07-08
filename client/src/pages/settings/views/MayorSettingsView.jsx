import React from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import RoleSettingsViewShell from "../components/RoleSettingsViewShell";

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
    BARANGAY_POSITION_LABEL,
    assignedBarangayName,
    notificationTouched,
    notificationValidationErrors,
    handleResetNotificationPreferences,
    BARANGAY_NOTIFICATION_OPTIONS,
    handleNotificationChannelToggle,
    notificationRules,
    enabledRuleCodes,
    toggleNotificationRule,
    distributionFilters,
    setDistributionFilters,
    distributionEventOptions,
    distributionErrorMessage,
    isLoadingDistributionHistory,
    distributionHistoryRows,
    navigate,
    handleSyncNow,
    isSyncingNow,
    syncHistoryLogRows,
    syncSummary,
    LOCAL_SYNC_STATUS,
    getSyncStatusMeta,
    isOnline,
    syncHistoryErrorMessage,
    isLoadingSyncHistory,
    activityLogs,
    ROLE_DISPLAY_NAMES,
    ROLE_CODES,
    localSyncLogRows,
    forecastHealth,
    inventoryThresholdSummary,
    unreadCount,
    notificationRuleCount,
  } = ctx;

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
                <h4 style={{ margin: 0, color: "#17324d" }}>Office Profile Summary</h4>
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
                <h4 style={{ margin: 0, color: "#17324d" }}>Notification Status</h4>
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

              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Preference Summary</h4>
                <InfoRow label="Unread Notifications" value={`${unreadCount}`} />
                <InfoRow
                  label="Active Rules for This Role"
                  value={`${notificationRuleCount}`}
                />
                <InfoRow
                  label="Rules Enabled Locally"
                  value={`${enabledRuleCodes.length}`}
                />
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
                <h3 style={{ margin: 0, color: "#17324d" }}>Sync Status</h3>
                <p style={mutedValueStyles}>
                  Review a compact synchronization summary here. The full Sync Center
                  remains available from the sidebar for deeper monitoring.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/inventory/sync")}
                style={pageHeaderStyles.secondaryButton}
              >
                Open Full Sync Center
              </button>
            </div>

            <div style={gridStyles}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Sync Summary</h4>
                <InfoRow label="Connection" value={isOnline ? "Online" : "Offline"} />
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
                <h4 style={{ margin: 0, color: "#17324d" }}>Latest Queue Activity</h4>
                <InfoRow
                  label="Last Queue Update"
                  value={formatSyncDateTime(localSyncLogRows[0]?.timestamp)}
                />
                <InfoRow
                  label="Tracked Queue Records"
                  value={`${localSyncLogRows.length}`}
                />
                <p style={mutedValueStyles}>
                  Use the full Sync Center for record-by-record review and operational
                  follow-up.
                </p>
              </article>
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
      case "local-preferences":
        return (
          <section style={shellStyles.card}>
            <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Local Preferences</h3>
              <p style={mutedValueStyles}>
                These preferences are stored locally for this signed-in role. They do
                not change backend permission rules or core workflow behavior.
              </p>
            </div>

            <div style={{ ...gridStyles, alignItems: "start" }}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Export Preferences</h4>
                <p style={mutedValueStyles}>
                  This export format preference is saved locally for this account and
                  can be reused by future report screens safely.
                </p>
                <select
                  value={preferences.preferredExportFormat}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      preferredExportFormat: event.target.value,
                    }))
                  }
                  style={inputStyles.field}
                >
                  <option value="csv">CSV</option>
                  <option value="excel">Excel</option>
                  <option value="pdf">PDF</option>
                </select>
              </article>

              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Preference Summary</h4>
                <InfoRow
                  label="Notification Rules Enabled Locally"
                  value={`${enabledRuleCodes.length}`}
                />
                <InfoRow
                  label="Preferred Export Format"
                  value={preferences.preferredExportFormat?.toUpperCase() || "EXCEL"}
                />
                <InfoRow
                  label="Last Saved"
                  value={formatDateTime(preferences.metadata?.lastPreferenceSaveAt)}
                  muted
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
      settingsHubStyles={settingsHubStyles}
      labelStyles={labelStyles}
      mutedValueStyles={mutedValueStyles}
      StatusChip={StatusChip}
    />
  );
};

export default MayorSettingsView;
