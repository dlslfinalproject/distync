const { Resend } = require("resend");
const { getEmailConfig } = require("./email.config");
const { buildNotificationEmailTemplate } = require("./email.template");
const { logErrorSafely } = require("../../utils/systemLog");

let resendClient = null;
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    };
  }

  if (!config.isConfigured || !client) {
    return {
      success: false,
      skipped: true,
      reason: "email-service-not-configured",
      error: "Email service is not configured.",
    };
  }

  const template = buildNotificationEmailTemplate({
    notificationTitle,
    notificationMessage,
    severity,
    timestamp,
  });

  try {
    const response = await client.emails.send({
      from: config.from,
      to: [emailAddress],
      subject: template.subject,
      html: template.html,
    });

    const providerError = response?.error;
    const messageId = response?.data?.id || "";

    if (providerError || !messageId) {
      const providerMessage =
        providerError?.message ||
        "Email provider rejected the request.";

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
        providerResponse: response,
      };
    }

    return {
      success: true,
      skipped: false,
      messageId,
      providerResponse: response,
    };
  } catch (error) {
    await logErrorSafely({
      actor,
      moduleName: "notification-email",
      errorCode: "RESEND_SEND_FAILED",
      errorMessage: `Email delivery failed for ${notificationType} to ${emailAddress}: ${error.message} at ${timestamp}.`,
      severity: "ERROR",
      error,
    });

    return {
      success: false,
      skipped: false,
      reason: "send-failed",
      error: error.message,
    };
  }
};

module.exports = {
  sendNotificationEmail,
};
