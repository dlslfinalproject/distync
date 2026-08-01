import React, { useEffect, useState } from "react";
import {
  getNotificationCategoryCountLabel,
  getRuleDescription,
  getRuleHelperText,
} from "../settingsHelpers";

const MOBILE_BREAKPOINT = 768;

const validationBoxStyles = {
  border: "1px solid #f0d2d8",
  borderRadius: "14px",
  padding: "14px 16px",
  backgroundColor: "#fff8f9",
  display: "grid",
  gap: "8px",
};

const categorySectionStyles = {
  border: "1px solid #dbe6f0",
  borderRadius: "16px",
  backgroundColor: "#ffffff",
  overflow: "hidden",
};

const categoryHeaderStyles = {
  display: "grid",
  gap: "4px",
  padding: "20px 20px 14px",
};

const desktopHeaderRowStyles = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 110px 110px",
  gap: "16px",
  padding: "0 20px 10px",
  alignItems: "center",
};

const desktopHeaderLabelStyles = {
  margin: 0,
  color: "#66809c",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  textAlign: "center",
};

const rowStyles = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 110px 110px",
  gap: "16px",
  padding: "20px",
  alignItems: "center",
  borderTop: "1px solid #e4edf6",
};

const mobileRowStyles = {
  display: "grid",
  gap: "14px",
  padding: "18px 16px",
  borderTop: "1px solid #e4edf6",
};

const rowDetailStyles = {
  display: "grid",
  gap: "4px",
  minWidth: 0,
};

const ruleNameStyles = {
  margin: 0,
  color: "#17324d",
  fontSize: "14px",
  fontWeight: 700,
  lineHeight: 1.5,
};

const descriptionStyles = {
  margin: 0,
  color: "#60738a",
  fontSize: "13px",
  lineHeight: 1.6,
};

const helperTextStyles = {
  margin: 0,
  color: "#66809c",
  fontSize: "12px",
  lineHeight: 1.5,
};

const mutedTextStyles = {
  margin: 0,
  color: "#60738a",
  fontSize: "13px",
  lineHeight: 1.6,
};

const controlColumnStyles = {
  display: "grid",
  justifyItems: "center",
  alignItems: "center",
  gap: "6px",
  minHeight: "52px",
};

const mobileControlRowStyles = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "12px",
  alignItems: "center",
};

const controlLabelStyles = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  color: "#21405f",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const disabledControlLabelStyles = {
  ...controlLabelStyles,
  cursor: "default",
};

const requirementBadgeStyles = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "999px",
  border: "1px solid #dbe6f0",
  padding: "2px 8px",
  color: "#48637e",
  fontSize: "11px",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const unavailableLabelStyles = {
  margin: 0,
  color: "#7b8da0",
  fontSize: "13px",
  lineHeight: 1.5,
  textAlign: "center",
};

const srOnlyStyles = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const getResponsiveState = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.innerWidth < MOBILE_BREAKPOINT;
};

const useIsMobileLayout = () => {
  const [isMobileLayout, setIsMobileLayout] = useState(getResponsiveState);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => {
      setIsMobileLayout(window.innerWidth < MOBILE_BREAKPOINT);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return isMobileLayout;
};

const NotificationChannelControl = ({
  channelLabel,
  ruleName,
  isChecked = false,
  isDisabled = false,
  isRequired = false,
  isUnavailable = false,
  unavailableMessage = "",
  screenReaderHint = "",
  onChange,
  describedById,
  isMobileLayout = false,
}) => {
  if (isUnavailable) {
    return (
      <div
        style={isMobileLayout ? mobileControlRowStyles : controlColumnStyles}
        aria-label={`${channelLabel} not available`}
      >
        {isMobileLayout ? (
          <span style={helperTextStyles}>{channelLabel}</span>
        ) : null}
        <span style={unavailableLabelStyles}>
          Not available
          {unavailableMessage ? (
            <span style={srOnlyStyles}> {unavailableMessage}</span>
          ) : null}
        </span>
      </div>
    );
  }

  return (
    <div style={isMobileLayout ? mobileControlRowStyles : controlColumnStyles}>
      {isMobileLayout ? <span style={helperTextStyles}>{channelLabel}</span> : null}
      <div style={{ display: "grid", justifyItems: isMobileLayout ? "end" : "center", gap: "6px" }}>
        <label style={isDisabled ? disabledControlLabelStyles : controlLabelStyles}>
          <input
            type="checkbox"
            checked={Boolean(isChecked)}
            disabled={isDisabled}
            onChange={onChange}
            aria-label={`${ruleName} ${channelLabel.toLowerCase()} notification${
              isRequired ? " required and always enabled" : ""
            }`}
            aria-describedby={describedById}
          />
          {isRequired ? (
            <span style={requirementBadgeStyles}>Required</span>
          ) : null}
        </label>
        {screenReaderHint ? (
          <span id={describedById} style={srOnlyStyles}>
            {screenReaderHint}
          </span>
        ) : null}
      </div>
    </div>
  );
};

const NotificationPreferenceRow = ({
  rule,
  rowIndex,
  isOnline,
  isSavingDisabled,
  isMobileLayout,
  handleNotificationRuleChannelToggle,
}) => {
  const safeRuleDomId = `notification-rule-${rowIndex}-${rule.code || "item"}`;
  const deliveryHint = getRuleHelperText(rule);
  const isRequiredInApp = rule.inAppPolicy === "MANDATORY";
  const isInAppDisabled = !rule.editableChannels?.inApp || isSavingDisabled;
  const isEmailUnavailable = rule.emailPolicy === "UNAVAILABLE";
  const isEmailDisabled = !rule.editableChannels?.email || isSavingDisabled;

  return (
    <div style={isMobileLayout ? mobileRowStyles : rowStyles}>
      <div style={rowDetailStyles}>
        <p style={ruleNameStyles}>{rule.name}</p>
        <p style={descriptionStyles}>{getRuleDescription(rule)}</p>
        {deliveryHint ? <p style={helperTextStyles}>{deliveryHint}</p> : null}
      </div>

      <NotificationChannelControl
        channelLabel="Email"
        ruleName={rule.name}
        isChecked={Boolean(rule.effectiveChannels?.email)}
        isDisabled={isEmailDisabled}
        isUnavailable={isEmailUnavailable}
        unavailableMessage="Email delivery is not available for this notification."
        onChange={() => handleNotificationRuleChannelToggle(rule.code, "email")}
        describedById={`${safeRuleDomId}-email-status`}
        isMobileLayout={isMobileLayout}
      />

      <NotificationChannelControl
        channelLabel="In-app"
        ruleName={rule.name}
        isChecked={Boolean(rule.effectiveChannels?.inApp)}
        isDisabled={isInAppDisabled}
        isRequired={isRequiredInApp}
        screenReaderHint={
          isRequiredInApp
            ? "This notification is required and cannot be disabled."
            : "Toggle whether this notification appears in DISTYNC."
        }
        onChange={() => handleNotificationRuleChannelToggle(rule.code, "inApp")}
        describedById={`${safeRuleDomId}-in-app-status`}
        isMobileLayout={isMobileLayout}
      />
    </div>
  );
};

const NotificationPreferencesSection = ({
  shellStyles,
  errorTextStyles,
  pageHeaderStyles,
  EmptyState,
  notificationTouched = false,
  notificationValidationErrors = {},
  handleOpenResetNotificationPreferences,
  handleNotificationRuleChannelToggle,
  notificationCategories = [],
  isNotificationPreferencesLoading = false,
  hasNotificationPreferencesError = false,
  notificationLoadError = "",
  isNotificationPreferencesOffline = false,
  isNotificationPreferencesEmpty = false,
  isOnline = true,
  canResetNotificationPreferences = false,
  resetPreferencesButtonRef,
  handleRetryNotificationPreferencesLoad,
}) => {
  const isMobileLayout = useIsMobileLayout();
  const hasValidationErrors =
    notificationTouched &&
    Object.values(notificationValidationErrors).some(Boolean);
  const categories = Array.isArray(notificationCategories)
    ? notificationCategories
    : [];
  const resetDisabled =
    !canResetNotificationPreferences || hasNotificationPreferencesError;
  const areControlsDisabled =
    !isOnline ||
    isNotificationPreferencesLoading ||
    hasNotificationPreferencesError ||
    isNotificationPreferencesEmpty;

  return (
    <section
      style={{
        ...shellStyles.card,
        padding: "28px 24px",
      }}
      aria-busy={isNotificationPreferencesLoading}
    >
      <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Notification Preferences</h3>
        <p style={mutedTextStyles}>
          Choose how approved updates appear in DISTYNC and, when available, by
          email.
        </p>
      </div>

      <article style={{ display: "grid", gap: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: "6px" }}>
            <h4 style={{ margin: 0, color: "#17324d" }}>Notification types</h4>
            {isNotificationPreferencesOffline ? (
              <p style={mutedTextStyles}>
                You are offline. Notification settings are available for viewing,
                but changes require an internet connection.
              </p>
            ) : null}
          </div>
          <button
            ref={resetPreferencesButtonRef}
            type="button"
            onClick={handleOpenResetNotificationPreferences}
            style={{
              ...pageHeaderStyles.secondaryButton,
              width: isMobileLayout ? "100%" : "auto",
            }}
            disabled={resetDisabled}
            aria-disabled={resetDisabled}
          >
            Reset to Default
          </button>
        </div>

        {hasValidationErrors ? (
          <div style={validationBoxStyles} aria-live="polite">
            {Object.values(notificationValidationErrors)
              .filter(Boolean)
              .map((message) => (
                <p key={message} style={errorTextStyles}>
                  {message}
                </p>
              ))}
          </div>
        ) : null}

        {isNotificationPreferencesLoading ? (
          <div aria-live="polite">
            <EmptyState message="Loading notification preferences..." />
          </div>
        ) : null}

        {!isNotificationPreferencesLoading && hasNotificationPreferencesError ? (
          <div
            style={{
              ...categorySectionStyles,
              padding: "18px",
              display: "grid",
              gap: "12px",
            }}
            aria-live="polite"
          >
            <h4 style={{ margin: 0, color: "#17324d" }}>
              Notification preferences could not be loaded.
            </h4>
            <p style={mutedTextStyles}>
              Please check your connection and try again.
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleRetryNotificationPreferencesLoad}
                style={pageHeaderStyles.primaryButton}
              >
                Retry
              </button>
            </div>
            {notificationLoadError ? (
              <p style={{ ...mutedTextStyles, display: "none" }}>
                {notificationLoadError}
              </p>
            ) : null}
          </div>
        ) : null}

        {!isNotificationPreferencesLoading &&
        !hasNotificationPreferencesError &&
        isNotificationPreferencesEmpty ? (
          <EmptyState
            title="No notification settings available"
            message="No notification settings are assigned to this role."
          />
        ) : null}

        {!isNotificationPreferencesLoading &&
        !hasNotificationPreferencesError &&
        !isNotificationPreferencesEmpty ? (
          <div style={{ display: "grid", gap: "24px" }}>
            {categories.map((category) => (
              <section key={category.code} style={categorySectionStyles}>
                <div style={categoryHeaderStyles}>
                  <h4 style={{ margin: 0, color: "#17324d", fontSize: "16px" }}>
                    {category.label}
                  </h4>
                  <p style={mutedTextStyles}>
                    {getNotificationCategoryCountLabel(category.rules)}
                  </p>
                </div>

                {!isMobileLayout ? (
                  <div style={desktopHeaderRowStyles}>
                    <div aria-hidden="true" />
                    <p style={desktopHeaderLabelStyles}>Email</p>
                    <p style={desktopHeaderLabelStyles}>In-app</p>
                  </div>
                ) : null}

                <div>
                  {category.rules.map((rule, index) => (
                    <NotificationPreferenceRow
                      key={rule.code}
                      rule={rule}
                      rowIndex={index}
                      isOnline={isOnline}
                      isSavingDisabled={areControlsDisabled}
                      isMobileLayout={isMobileLayout}
                      handleNotificationRuleChannelToggle={
                        handleNotificationRuleChannelToggle
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
};

export default NotificationPreferencesSection;
