const { sendNotificationEmail, isNotificationEmailConfigured } = require("../src/modules/email/email.service");

const recipient = String(process.env.TEST_NOTIFICATION_EMAIL_RECIPIENT || "").trim();
const environment = String(process.env.NODE_ENV || "development").toLowerCase();

const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
};

if (!['development', 'test'].includes(environment)) {
  fail("Controlled notification email verification only permits NODE_ENV=development or test.");
} else if (!recipient) {
  fail("EMAIL_DELIVERY_NOT_VERIFIED_NO_SAFE_TEST_RECIPIENT");
} else if (!isNotificationEmailConfigured()) {
  fail("EMAIL_DELIVERY_NOT_VERIFIED_EMAIL_PROVIDER_NOT_CONFIGURED");
} else {
  sendNotificationEmail({
    recipientEmail: recipient,
    notificationType: "CONTROLLED_EMAIL_VERIFICATION",
    notificationTitle: "DISTYNC email delivery verification",
    notificationMessage: "This is one explicitly requested controlled verification email. No user notification records were created.",
    severity: "INFO",
    idempotencyKey: `controlled-notification-verification/${new Date().toISOString().slice(0, 10)}`,
  }).then((result) => {
    if (!result.success) {
      fail(`EMAIL_DELIVERY_NOT_VERIFIED_${String(result.reason || "SEND_FAILED").toUpperCase()}`);
      return;
    }
    console.log(`PROVIDER_ACCEPTED_CONTROLLED_EMAIL messageId=${result.messageId}`);
  }).catch(() => fail("EMAIL_DELIVERY_NOT_VERIFIED_SEND_FAILED"));
}
