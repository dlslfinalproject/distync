import React from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

const SecuritySection = ({
  shellStyles,
  gridStyles,
  cardStyles,
  inputStyles,
  helperTextStyles,
  errorTextStyles,
  pageHeaderStyles,
  labelStyles,
  mutedValueStyles,
  StatusChip,
  EmptyState,
  preferences,
  securityVisibility,
  securityForm,
  setSecurityForm,
  handlePasswordFieldBlur,
  securityTouched,
  securityValidationErrors,
  togglePasswordVisibility,
  handleLocalPasswordReview,
  formatDateTime,
  setPreferences,
  securityActivityLogs,
  description,
  passwordDescription,
  fieldIds,
}) => {
  return (
    <section style={shellStyles.card}>
      <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Security</h3>
        <p style={mutedValueStyles}>{description}</p>
      </div>

      <div style={gridStyles}>
        <article style={cardStyles}>
          <h4 style={{ margin: 0, color: "#17324d" }}>Password Management</h4>
          <p style={mutedValueStyles}>{passwordDescription}</p>

          <div style={{ display: "grid", gap: "8px" }}>
            <label htmlFor={fieldIds.currentPassword} style={labelStyles}>
              Current Password
            </label>
            <div style={inputStyles.passwordWrapper}>
              <input
                id={fieldIds.currentPassword}
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
            <label htmlFor={fieldIds.newPassword} style={labelStyles}>
              New Password
            </label>
            <div style={inputStyles.passwordWrapper}>
              <input
                id={fieldIds.newPassword}
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
            {securityTouched.newPassword &&
            securityValidationErrors.newPassword ? (
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
            <label htmlFor={fieldIds.confirmPassword} style={labelStyles}>
              Confirm New Password
            </label>
            <div style={inputStyles.passwordWrapper}>
              <input
                id={fieldIds.confirmPassword}
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
                      <StatusChip tone={entry.tone || "info"} label={entry.tone || "info"} />
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
};

export default SecuritySection;
