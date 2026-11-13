const formatTimestamp = (value) => {
  if (!value) {
    return "Unavailable";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
};

const escapeHtml = (value = "") =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildNotificationEmailTemplate = ({
  notificationTitle,
  notificationMessage,
  severity = "INFO",
  timestamp,
}) => {
  const safeTitle = escapeHtml(notificationTitle || "DISTYNC Notification");
  const safeMessage = escapeHtml(notificationMessage || "A new DISTYNC notification is available.");
  const safeSeverity = escapeHtml(severity);
  const safeTimestamp = escapeHtml(formatTimestamp(timestamp));

  return {
    subject: `DISTYNC: ${notificationTitle || "Notification"}`,
    html: `
      <div style="font-family: Arial, sans-serif; background:#f4f7fb; padding:24px; color:#17324d;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; border:1px solid #dbe6f0; overflow:hidden;">
          <div style="background:#17324d; color:#ffffff; padding:20px 24px;">
            <div style="font-size:12px; letter-spacing:0.08em; text-transform:uppercase; opacity:0.85;">DISTYNC Disaster Relief Management System</div>
            <h1 style="margin:10px 0 0; font-size:22px; line-height:1.3;">${safeTitle}</h1>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 16px; font-size:15px; line-height:1.7;">${safeMessage}</p>
            <div style="display:grid; gap:10px; margin:20px 0; padding:16px; background:#f8fbff; border:1px solid #e3edf7; border-radius:12px;">
              <div><strong>Severity:</strong> ${safeSeverity}</div>
              <div><strong>Timestamp:</strong> ${safeTimestamp}</div>
            </div>
            <p style="margin:0; font-size:13px; color:#60738a; line-height:1.6;">
              This is an automated notification from DISTYNC.
            </p>
          </div>
        </div>
      </div>
    `,
  };
};

module.exports = {
  buildNotificationEmailTemplate,
};
