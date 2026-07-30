import React from "react";

const validationBoxStyles = {
  border: "1px solid #f0d2d8",
  borderRadius: "14px",
  padding: "14px 16px",
  backgroundColor: "#fff8f9",
  display: "grid",
  gap: "8px",
};

const settingsContainerStyles = {
  border: "1px solid #dbe6f0",
  borderRadius: "18px",
  padding: "20px 22px",
  backgroundColor: "#fbfdff",
  display: "grid",
  gap: "18px",
};

const categoryRowStyles = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "18px",
  alignItems: "start",
  padding: "18px 0",
  borderTop: "1px solid #e4edf6",
};

const channelGridStyles = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(88px, auto))",
  gap: "12px 18px",
  alignItems: "center",
  justifyContent: "end",
};

const channelLabelStyles = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  color: "#21405f",
  fontSize: "14px",
  fontWeight: 600,
};

const channelHeadingStyles = {
  margin: 0,
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#66809c",
  fontWeight: 700,
};

const NotificationPreferencesSection = ({
  shellStyles,
  cardStyles,
  helperTextStyles,
  errorTextStyles,
  pageHeaderStyles,
  mutedValueStyles,
  EmptyState,
  preferences = {},
  notificationTouched = false,
  notificationValidationErrors = {},
  handleResetNotificationPreferences,
  notificationOptions = [],
  handleNotificationChannelToggle,
  isLoading,
  description = "",
  alertChannelsDescription = "",
}) => {
  const hasValidationErrors =
    notificationTouched &&
    Object.values(notificationValidationErrors).some(Boolean);
  const notificationChannels = preferences?.notificationChannels || {};
  const categories = Array.isArray(notificationOptions)
    ? notificationOptions
    : [];

  return (
    <section style={shellStyles.card}>
      <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Notification Preferences</h3>
        <p style={mutedValueStyles}>{description}</p>
      </div>

      <article style={settingsContainerStyles}>
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
            <h4 style={{ margin: 0, color: "#17324d" }}>Delivery Preferences</h4>
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
            {notificationValidationErrors.notificationRules ? (
              <p style={errorTextStyles}>
                {notificationValidationErrors.notificationRules}
              </p>
            ) : null}
          </div>
        ) : (
          <p style={helperTextStyles}>
            Choose how DISTYNC delivers notifications for the categories
            available to your account role.
          </p>
        )}

        {isLoading ? (
          <EmptyState message="Loading notification settings..." />
        ) : categories.length === 0 ? (
          <EmptyState message="No notification preferences available." />
        ) : (
          <div style={{ display: "grid", gap: 0 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: "18px",
                alignItems: "end",
              }}
            >
              <div />
              <div style={channelGridStyles}>
                <p style={channelHeadingStyles}>In-App</p>
                <p style={channelHeadingStyles}>Email</p>
              </div>
            </div>

            {categories.map((category) => (
              <article key={category.key} style={categoryRowStyles}>
                <div style={{ display: "grid", gap: "6px" }}>
                  <h4 style={{ margin: 0, color: "#17324d", fontSize: "16px" }}>
                    {category.label}
                  </h4>
                  <p style={helperTextStyles}>{category.description}</p>
                </div>

                <div style={channelGridStyles}>
                  <label style={channelLabelStyles}>
                    <input
                      type="checkbox"
                      checked={Boolean(
                        notificationChannels[category.key]?.inApp,
                      )}
                      onChange={() =>
                        handleNotificationChannelToggle(category.key, "inApp")
                      }
                    />
                    <span>In-App</span>
                  </label>
                  <label style={channelLabelStyles}>
                    <input
                      type="checkbox"
                      checked={Boolean(
                        notificationChannels[category.key]?.email,
                      )}
                      onChange={() =>
                        handleNotificationChannelToggle(category.key, "email")
                      }
                    />
                    <span>Email</span>
                  </label>
                </div>
              </article>
            ))}
          </div>
        )}
      </article>
    </section>
  );
};

export default NotificationPreferencesSection;
