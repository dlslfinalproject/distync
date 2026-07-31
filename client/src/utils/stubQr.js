import { ACCESS_MODES, getAccessMode } from "./accessMode";

const resolveStubQrBaseUrl = () => {
  const configuredBaseUrl = String(import.meta.env.VITE_PUBLIC_APP_URL || "").trim();
  const accessMode = getAccessMode();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  if (accessMode === ACCESS_MODES.DEVELOPMENT) {
    return "http://localhost:5173";
  }

  return "https://your-domain";
};

export const buildStubQrUrl = (qrCodeValue) => {
  const normalizedValue = String(qrCodeValue || "").trim();

  if (!normalizedValue) {
    return "";
  }

  const baseUrl = resolveStubQrBaseUrl();
  return `${baseUrl}/verify-stub?qr=${encodeURIComponent(normalizedValue)}`;
};

export const extractStubQrValue = (value) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  try {
    const parsedUrl = new URL(normalizedValue);
    return parsedUrl.searchParams.get("qr") || normalizedValue;
  } catch (_error) {
    return normalizedValue;
  }
};
