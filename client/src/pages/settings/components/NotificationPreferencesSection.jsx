import React from "react";

const validationBoxStyles = {
  border: "1px solid #f0d2d8",
  borderRadius: "14px",
  padding: "14px 16px",
  backgroundColor: "#fff8f9",
  display: "grid",
  gap: "8px",
};

const NotificationPreferencesSection = ({
  shellStyles,
  gridStyles,
  cardStyles,
  helperTextStyles,
  errorTextStyles,
  tableStyles,
  pageHeaderStyles,
  mutedValueStyles,
  InfoRow,
  EmptyState,
  preferences,
  notificationTouched,
  notificationValidationErrors,
  handleResetNotificationPreferences,
  notificationOptions,
  handleNotificationChannelToggle,
  notificationRules,
  enabledRuleCodes,
  toggleNotificationRule,
  isLoading,
  description,
  alertChannelsDescription,
  summaryRows = [],
}) => {
  const hasValidationErrors =
    notificationTouched &&
    Object.values(notificationValidationErrors).some(Boolean);

  return (
    <section style={shellStyles.card}>
      <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Notification Preferences</h3>
        <p style={mutedValueStyles}>{description}</p>
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
              <p style={helperTextStyles}>{alertChannelsDescription}</p>
            </div>
            <button
              type="button"
              onClick={handleResetNotificationPreferences}
              style={pageHeaderStyles.secondaryButton}
            >
              Reset to Default
            </button>
          </div>

          {hasValidationErrors ? (
            <div style={validationBoxStyles}>
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
                {notificationOptions.map((option) => (
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
          <h4 style={{ margin: 0, color: "#17324d" }}>Existing Role Rule Mapping</h4>
          <p style={helperTextStyles}>
            These mapped rules come from the current backend role
            configuration. Toggling them here saves your local review
            preference only and does not rewrite server-side notification
            rules.
          </p>
          {summaryRows.length > 0 ? (
            <div style={{ display: "grid", gap: "10px" }}>
              {summaryRows.map((row) => (
                <InfoRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  muted={row.muted}
                />
              ))}
            </div>
          ) : null}
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
};

export default NotificationPreferencesSection;
