export const OFFLINE_QR_IDENTITY_RESULTS = Object.freeze({
  MATCH: "MATCH",
  MISMATCH: "MISMATCH",
  UNAVAILABLE: "UNAVAILABLE",
});

export const normalizeOfflineReference = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export const compareOfflineIdentity = ({ expectedId, actualId } = {}) => {
  const normalizedExpectedId = normalizeOfflineReference(expectedId);
  const normalizedActualId = normalizeOfflineReference(actualId);

  if (!normalizedExpectedId || !normalizedActualId) {
    return OFFLINE_QR_IDENTITY_RESULTS.UNAVAILABLE;
  }

  return normalizedExpectedId === normalizedActualId
    ? OFFLINE_QR_IDENTITY_RESULTS.MATCH
    : OFFLINE_QR_IDENTITY_RESULTS.MISMATCH;
};

export const compareOfflineEventIdentity = ({
  selectedEventId,
  stubEventId,
} = {}) =>
  compareOfflineIdentity({
    expectedId: selectedEventId,
    actualId: stubEventId,
  });

export const isRecognizedStubQrValue = (value) => {
  let normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    return false;
  }

  try {
    const parsedUrl = new URL(normalizedValue);
    normalizedValue = parsedUrl.searchParams.get("qr") || normalizedValue;
  } catch (_error) {
    // Raw QR values are expected for camera scans and manual test calls.
  }

  return /^DISTYNC-STUB\|/i.test(normalizedValue.trim());
};
