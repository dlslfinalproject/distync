const { Resend } = require("resend");
const { getEmailConfig } = require("./email.config");
const { buildNotificationEmailTemplate } = require("./email.template");
const { logErrorSafely } = require("../../utils/systemLog");

let resendClient = null;
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeProviderError = (value = "") =>
  String(value || "Email provider request failed.")
    .replace(/(?:re|bearer)[_\s-]?[A-Za-z0-9_-]{8,}/gi, "[redacted]")
    .replace(/api[_-]?key\s*[=:]\s*[^\s,;]+/gi, "api_key=[redacted]")
    .slice(0, 500);

const classifyProviderFailure = ({ statusCode, code, message } = {}) => {
  const normalizedCode = String(code || "").toLowerCase();
  const normalizedMessage = String(message || "").toLowerCase();
  const numericStatus = Number(statusCode);

  if (
    numericStatus === 408 || numericStatus === 429 || numericStatus >= 500 ||
    /timeout|timed out|network|econn|enotfound|temporar|concurrent_idempotent_requests/.test(normalizedCode + normalizedMessage)
  ) return "TRANSIENT";
  if (numericStatus >= 400 && numericStatus < 500) return "PERMANENT";
  return "UNKNOWN";
};

const getResendClient = () => {
  const { apiKey, isConfigured } = getEmailConfig();

  if (!isConfigured) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
};

const sendNotificationEmail = async ({
  actor = null,
  recipientEmail,
  notificationType = "NOTIFICATION",
  notificationTitle,
  notificationMessage,
  severity = "INFO",
  timestamp = new Date().toISOString(),
  idempotencyKey = undefined,
}) => {
  const emailAddress = String(recipientEmail || "").trim().toLowerCase();
  const config = getEmailConfig();
  const client = getResendClient();

  if (!emailAddress) {
    await logErrorSafely({
      actor,
      moduleName: "notification-email",
      errorCode: "EMAIL_RECIPIENT_MISSING",
      errorMessage: `Email delivery failed for ${notificationType}: missing recipient email at ${timestamp}.`,
      severity: "WARNING",
    });

    return {
      success: false,
      skipped: true,
      reason: "missing-recipient-email",
      error: "Missing recipient email.",
      failureClass: "PERMANENT",
    };
  }

  if (!EMAIL_ADDRESS_PATTERN.test(emailAddress)) {
    await logErrorSafely({
      actor,
      moduleName: "notification-email",
      errorCode: "EMAIL_RECIPIENT_INVALID",
      errorMessage: `Email delivery failed for ${notificationType} to ${emailAddress}: invalid recipient email format at ${timestamp}.`,
      severity: "WARNING",
    });

    return {
      success: false,
      skipped: false,
      reason: "invalid-recipient-email",
      error: "Invalid recipient email.",
      failureClass: "PERMANENT",
    };
  }

  if (!config.isConfigured || !client) {
    return {
      success: false,
      skipped: true,
      reason: "email-service-not-configured",
      error: "Email service is not configured.",
      failureClass: "CONFIGURATION",
    };
  }

  const template = buildNotificationEmailTemplate({
    notificationTitle,
    notificationMessage,
    severity,
    timestamp,
  });

  try {
    const response = await client.emails.send(
      { from: config.from, to: [emailAddress], subject: template.subject, html: template.html },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    const providerError = response?.error;
    const messageId = response?.data?.id || "";

    if (providerError || !messageId) {
      const providerMessage = sanitizeProviderError(providerError?.message);

      await logErrorSafely({
        actor,
        moduleName: "notification-email",
        errorCode: "RESEND_SEND_REJECTED",
        errorMessage: `Email delivery failed for ${notificationType} to ${emailAddress}: ${providerMessage} at ${timestamp}.`,
        severity: "ERROR",
      });

      return {
        success: false,
        skipped: false,
        reason: "provider-rejected-request",
        error: providerMessage,
        failureClass: classifyProviderFailure({
          statusCode: providerError?.statusCode || providerError?.status,
          code: providerError?.name || providerError?.code,
          message: providerMessage,
        }),
      };
    }

    return {
      success: true,
      skipped: false,
      messageId,
    };
  } catch (error) {
    const safeErrorMessage = sanitizeProviderError(error.message);
    await logErrorSafely({
      actor,
      moduleName: "notification-email",
      errorCode: "RESEND_SEND_FAILED",
      errorMessage: `Email delivery failed for ${notificationType} to ${emailAddress}: ${safeErrorMessage} at ${timestamp}.`,
      severity: "ERROR",
      error,
    });

    return {
      success: false,
      skipped: false,
      reason: "send-failed",
      error: safeErrorMessage,
      failureClass: classifyProviderFailure({
        statusCode: error.statusCode || error.status,
        code: error.code || error.name,
        message: error.message,
      }),
    };
  }
};

module.exports = {
  sendNotificationEmail,
  isNotificationEmailConfigured: () => getEmailConfig().isConfigured,
  isValidNotificationEmailAddress: (value) => EMAIL_ADDRESS_PATTERN.test(String(value || "").trim().toLowerCase()),
  EMAIL_ADDRESS_PATTERN,
  sanitizeProviderError,
  classifyProviderFailure,
};
