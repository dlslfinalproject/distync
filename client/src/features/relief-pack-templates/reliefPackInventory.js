export const RELIEF_PACK_INVENTORY_SOURCE_TYPE = "LGU";
export const RELIEF_PACK_DONATED_SOURCE_TYPE = "DONATED";
export const RELIEF_PACK_LOOSE_DONATION_TYPE = "LOOSE_ITEM";
export const RELIEF_PACK_NEAR_EXPIRY_DAYS = 30;

const ELIGIBLE_BATCH_STATUSES = new Set(["AVAILABLE", "LOW_STOCK"]);

const normalizeValue = (value) => String(value || "").trim().toUpperCase();

const getDonationMetadata = (batch) => ({
  donationType: normalizeValue(
    batch?.source_donation_type || batch?.donation?.donation_type,
  ),
  donationStatus: normalizeValue(
    batch?.source_donation_status || batch?.donation?.status,
  ),
  disasterEventId:
    batch?.source_donation_disaster_event_id ||
    batch?.donation?.disaster_event_id ||
    null,
});

const isLooseDonatedBatch = (batch, options = {}) => {
  if (normalizeValue(batch?.source_type) !== RELIEF_PACK_DONATED_SOURCE_TYPE) {
    return false;
  }

  const { donationType, donationStatus, disasterEventId } =
    getDonationMetadata(batch);

  if (
    donationType !== RELIEF_PACK_LOOSE_DONATION_TYPE ||
    donationStatus === "CANCELLED"
  ) {
    return false;
  }

  if (!Array.isArray(options.activeDisasterEventIds)) {
    return true;
  }

  const activeEventIds = new Set(
    options.activeDisasterEventIds
      .map((eventId) => String(eventId || "").trim())
      .filter(Boolean),
  );

  return Boolean(disasterEventId) && activeEventIds.has(String(disasterEventId));
};

const parseCalendarDate = (value) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return null;
  }

  const calendarDateMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const parsedDate = calendarDateMatch
    ? new Date(
        Number(calendarDateMatch[1]),
        Number(calendarDateMatch[2]) - 1,
        Number(calendarDateMatch[3]),
      )
    : new Date(normalizedValue);

  return Number.isNaN(parsedDate.getTime())
    ? null
    : new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
};

export const isReliefPackInventoryBatchEligible = (
  batch,
  referenceDate = new Date(),
  options = {},
) => {
  if (!batch?.inventory_item_id) {
    return false;
  }

  const normalizedSourceType = normalizeValue(batch.source_type);
  const isEligibleSource =
    normalizedSourceType === RELIEF_PACK_INVENTORY_SOURCE_TYPE
      ? true
      : isLooseDonatedBatch(batch, options);

  if (!isEligibleSource || !ELIGIBLE_BATCH_STATUSES.has(normalizeValue(batch.status))) {
    return false;
  }

  const quantityAvailable = Number(batch.quantity_available);

  if (!Number.isFinite(quantityAvailable) || quantityAvailable <= 0) {
    return false;
  }

  if (batch.expiration_date === null || batch.expiration_date === undefined) {
    return true;
  }

  const expirationDate = parseCalendarDate(batch.expiration_date);
  const today = parseCalendarDate(referenceDate);

  if (!expirationDate || !today) {
    return false;
  }

  const nearExpiryThreshold = new Date(today);
  nearExpiryThreshold.setDate(
    nearExpiryThreshold.getDate() + RELIEF_PACK_NEAR_EXPIRY_DAYS,
  );

  return expirationDate > nearExpiryThreshold;
};
