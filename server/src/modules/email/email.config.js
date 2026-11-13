const DEFAULT_FROM_EMAIL = "onboarding@resend.dev";
const DEFAULT_FROM_NAME = "DISTYNC";

const normalizeString = (value) => {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const getEmailConfig = () => {
  const apiKey = normalizeString(process.env.RESEND_API_KEY);
  const fromEmail =
    normalizeString(process.env.RESEND_FROM_EMAIL) || DEFAULT_FROM_EMAIL;
  const fromName =
    normalizeString(process.env.RESEND_FROM_NAME) || DEFAULT_FROM_NAME;

  return {
    apiKey,
    fromEmail,
    fromName,
    from: `${fromName} <${fromEmail}>`,
    isConfigured: Boolean(apiKey && fromEmail),
  };
};

module.exports = {
  getEmailConfig,
};
