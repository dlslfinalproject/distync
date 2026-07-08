import React from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import RoleSettingsViewShell from "../components/RoleSettingsViewShell";

const BarangaySettingsView = ({
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
                <h3 style={{ margin: 0, color: "#17324d" }}>Profile Settings</h3>
                <p style={mutedValueStyles}>
                  Update editable barangay profile details here while keeping the
                  assigned role, account email, and linked barangay locked for
                  coordination safety.
                </p>
              </div>
            </div>

            <div style={{ ...gridStyles, alignItems: "start" }}>
              <article style={cardStyles}>
                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="barangay-profile-full-name" style={labelStyles}>
                    Full Name
                  </label>
                  <input
                    id="barangay-profile-full-name"
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
                      Keep this updated for spelling or naming corrections.
                    </p>
                  )}
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="barangay-profile-position" style={labelStyles}>
                    Position
                  </label>
                  <input
                    id="barangay-profile-position"
                    value={BARANGAY_POSITION_LABEL}
                    readOnly
                    style={{
                      ...inputStyles.field,
                      ...inputStyles.lockedField,
                    }}
                  />
                  <p style={helperTextStyles}>
                    Assigned role for this account. Barangay users cannot edit this
                    field.
                  </p>
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="barangay-profile-name" style={labelStyles}>
                    Barangay Name
                  </label>
                  <input
                    id="barangay-profile-name"
                    value={assignedBarangayName}
                    readOnly
                    style={{
                      ...inputStyles.field,
                      ...inputStyles.lockedField,
                    }}
                  />
                  <p style={helperTextStyles}>
                    This barangay assignment is linked to the account and stays
                    locked.
                  </p>
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="barangay-profile-contact" style={labelStyles}>
                    Contact Number
                  </label>
                  <div style={inputStyles.phoneInputGroup}>
                    <div style={inputStyles.phonePrefix}>PH +63</div>
                    <input
                      id="barangay-profile-contact"
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
                      Enter the mobile number after the fixed `+63` prefix.
                    </p>
                  )}
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="barangay-profile-email" style={labelStyles}>
                    Email Address
                  </label>
                  <input
                    id="barangay-profile-email"
                    type="email"
                    value={authenticatedUser?.email || preferences.profile.emailAddress}
                    readOnly
                    style={{
                      ...inputStyles.field,
                      ...inputStyles.lockedField,
                    }}
                  />
                  <p style={helperTextStyles}>
                    Account email is locked to protect sign-in and verification
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
                      alt="Barangay profile preview"
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
              <h3 style={{ margin: 0, color: "#17324d" }}>Security Settings</h3>
              <p style={mutedValueStyles}>
                Keep account protection and authentication controls grouped here.
                Password validation in this screen is frontend-only and does not
                modify backend authentication behavior.
              </p>
            </div>

            <div style={gridStyles}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Password Management</h4>
                <p style={mutedValueStyles}>
                  Update the password form with stronger client-side validation while
                  keeping the authentication backend unchanged.
                </p>

                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="security-current-password" style={labelStyles}>
                    Current Password
                  </label>
                  <div style={inputStyles.passwordWrapper}>
                    <input
                      id="security-current-password"
                      type={
                        securityVisibility.currentPassword ? "text" : "password"
                      }
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
                  <label htmlFor="security-new-password" style={labelStyles}>
                    New Password
                  </label>
                  <div style={inputStyles.passwordWrapper}>
                    <input
                      id="security-new-password"
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
                  <label htmlFor="security-confirm-password" style={labelStyles}>
                    Confirm New Password
                  </label>
                  <div style={inputStyles.passwordWrapper}>
                    <input
                      id="security-confirm-password"
                      type={
                        securityVisibility.confirmPassword ? "text" : "password"
                      }
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
                  label={
                    preferences.security.twoFactorEnabled ? "Enabled" : "Optional"
                  }
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
                Manage local alert preferences for barangay coordination. These
                settings are saved on this device for the current account while the
                live system rules shown below still depend on the existing backend
                notification mappings.
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
                      channel you prefer when available.
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
                    In-app alerts are enabled by default. Email preferences only
                    affect this frontend settings profile right now.
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
                {notificationRules.length === 0 ? (
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
                              {rule.trigger_type} (
                              {rule.is_active ? "Active" : "Inactive"})
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
      case "distribution-history":
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
                <h3 style={{ margin: 0, color: "#17324d" }}>Distribution History</h3>
                <p style={mutedValueStyles}>
                  Review relief distributions tied to your barangay for audits,
                  coordination checks, and report preparation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/barangay/distribution-history")}
                style={pageHeaderStyles.secondaryButton}
              >
                Open Full History Page
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "14px",
                alignItems: "end",
                marginBottom: "20px",
              }}
            >
              <div>
                <label htmlFor="barangay-history-event" style={labelStyles}>
                  Disaster / Event
                </label>
                <select
                  id="barangay-history-event"
                  value={distributionFilters.disaster_event_id}
                  onChange={(event) =>
                    setDistributionFilters((current) => ({
                      ...current,
                      disaster_event_id: event.target.value,
                    }))
                  }
                  style={inputStyles.field}
                >
                  <option value="">All disaster events</option>
                  {distributionEventOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="barangay-history-status" style={labelStyles}>
                  Status
                </label>
                <select
                  id="barangay-history-status"
                  value={distributionFilters.status}
                  onChange={(event) =>
                    setDistributionFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  style={inputStyles.field}
                >
                  <option value="">All statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="ONGOING">Ongoing</option>
                </select>
              </div>

              <div>
                <label htmlFor="barangay-history-date-from" style={labelStyles}>
                  Date From
                </label>
                <input
                  id="barangay-history-date-from"
                  type="date"
                  value={distributionFilters.date_from}
                  onChange={(event) =>
                    setDistributionFilters((current) => ({
                      ...current,
                      date_from: event.target.value,
                    }))
                  }
                  style={inputStyles.field}
                />
              </div>

              <div>
                <label htmlFor="barangay-history-date-to" style={labelStyles}>
                  Date To
                </label>
                <input
                  id="barangay-history-date-to"
                  type="date"
                  value={distributionFilters.date_to}
                  onChange={(event) =>
                    setDistributionFilters((current) => ({
                      ...current,
                      date_to: event.target.value,
                    }))
                  }
                  style={inputStyles.field}
                />
              </div>

              <div>
                <label htmlFor="barangay-history-sort" style={labelStyles}>
                  Sort
                </label>
                <select
                  id="barangay-history-sort"
                  value={distributionFilters.sort_order}
                  onChange={(event) =>
                    setDistributionFilters((current) => ({
                      ...current,
                      sort_order: event.target.value,
                    }))
                  }
                  style={inputStyles.field}
                >
                  <option value="latest">Latest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
            </div>

            {distributionErrorMessage ? (
              <p style={{ margin: "0 0 16px", color: "#9d4d58", fontWeight: 700 }}>
                {distributionErrorMessage}
              </p>
            ) : null}

            {isLoadingDistributionHistory ? (
              <EmptyState message="Loading barangay distribution history..." />
            ) : distributionHistoryRows.length === 0 ? (
              <EmptyState message="No barangay distribution history matches the current filters." />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyles.table}>
                  <thead>
                    <tr>
                      <th style={tableStyles.th}>Distribution Date</th>
                      <th style={tableStyles.th}>Disaster / Event</th>
                      <th style={tableStyles.th}>Relief Goods Received</th>
                      <th style={tableStyles.th}>Quantity Received</th>
                      <th style={tableStyles.th}>Families Served</th>
                      <th style={tableStyles.th}>Status</th>
                      <th style={tableStyles.th}>Distribution Report (PDF)</th>
                      <th style={tableStyles.th}>Photos Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributionHistoryRows.map((row) => (
                      <tr key={row.id}>
                        <td style={tableStyles.td}>
                          {formatDateTime(row.distributionDate)}
                        </td>
                        <td style={tableStyles.td}>
                          <div style={{ fontWeight: 700 }}>{row.disasterEventTitle}</div>
                          <div style={{ ...mutedValueStyles, fontSize: "12px" }}>
                            {row.eventCode}
                          </div>
                        </td>
                        <td style={tableStyles.td}>{row.reliefGoodsReceived}</td>
                        <td style={tableStyles.td}>{row.quantityReceived}</td>
                        <td style={tableStyles.td}>{row.familiesServed}</td>
                        <td style={tableStyles.td}>
                          <StatusChip
                            tone={
                              row.statusLabel === "Completed" ? "success" : "warning"
                            }
                            label={row.statusLabel}
                          />
                        </td>
                        <td style={tableStyles.td}>
                          <button
                            type="button"
                            onClick={() => navigate("/barangay/distribution-history")}
                            style={pageHeaderStyles.secondaryButton}
                          >
                            {row.distributionReportLabel}
                          </button>
                        </td>
                        <td style={tableStyles.td}>{row.photosSubmitted || "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      case "sync-center":
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
                  Monitor whether barangay records are already aligned with the LGU
                  and review the most recent sync logs.
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
                  onClick={() => navigate("/barangay/sync")}
                  style={pageHeaderStyles.secondaryButton}
                >
                  Open Full Sync Center
                </button>
              </div>
            </div>

            <div style={gridStyles}>
              <article style={cardStyles}>
                <h4 style={{ margin: 0, color: "#17324d" }}>Sync Overview</h4>
                <InfoRow
                  label="Last Sync Date & Time"
                  value={formatSyncDateTime(syncHistoryLogRows[0]?.timestamp)}
                />
                <InfoRow
                  label="Pending Records"
                  value={`${syncSummary[LOCAL_SYNC_STATUS.PENDING] || 0}`}
                />
                <InfoRow
                  label="Failed / Conflict Records"
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
                    "Attendance Records",
                    "Beneficiary Lists",
                    "Distribution Records",
                    "Disaster Reports",
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
                        label={syncHistoryLogRows.length > 0 ? "Tracked" : "Waiting"}
                      />
                    </div>
                  ))}
                </div>
              </article>
            </div>

            {syncHistoryErrorMessage ? (
              <p style={{ margin: "20px 0 0", color: "#9d4d58", fontWeight: 700 }}>
                {syncHistoryErrorMessage}
              </p>
            ) : null}

            <div style={{ marginTop: "20px" }}>
              <h4 style={{ margin: "0 0 12px", color: "#17324d" }}>Sync Logs</h4>
              {isLoadingSyncHistory ? (
                <EmptyState message="Loading sync logs..." />
              ) : syncHistoryLogRows.length === 0 ? (
                <EmptyState message="No sync logs are available yet for this barangay account." />
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
                      {syncHistoryLogRows.slice(0, 12).map((row) => (
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
      case "activity-logs":
        return (
          <section style={shellStyles.card}>
            <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Recent Local Activity</h3>
              <p style={mutedValueStyles}>
                Review recent operational and sync-related activity visible in this
                frontend. This section focuses on barangay workflow actions instead
                of account security settings.
              </p>
            </div>

            {activityLogs.length === 0 ? (
              <EmptyState message="No recent local operational activity is available for this device yet." />
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {activityLogs.map((entry) => (
                  <article
                    key={entry.id}
                    style={{
                      border: "1px solid #dbe6f0",
                      borderRadius: "16px",
                      padding: "16px 18px",
                      backgroundColor: "#fbfdff",
                      display: "grid",
                      gap: "6px",
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
                        <StatusChip tone="info" label={entry.moduleLabel || "Activity"} />
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
      dashboardDescription="Choose a category below to keep the Settings workspace focused and uncluttered. Detailed forms, tables, and logs only appear after you open a section."
      toast={toast}
      onCloseToast={onCloseToast}
      settingsHubStyles={settingsHubStyles}
      labelStyles={labelStyles}
      mutedValueStyles={mutedValueStyles}
      StatusChip={StatusChip}
    />
  );
};

export default BarangaySettingsView;
