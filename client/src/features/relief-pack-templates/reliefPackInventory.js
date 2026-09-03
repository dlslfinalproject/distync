export const RELIEF_PACK_INVENTORY_SOURCE_TYPE = "LGU";
export const RELIEF_PACK_DONATED_SOURCE_TYPE = "DONATED";
export const RELIEF_PACK_LOOSE_DONATION_TYPE = "LOOSE_ITEM";
export const RELIEF_PACK_NEAR_EXPIRY_DAYS = 30;

const ELIGIBLE_BATCH_STATUSES = new Set(["AVAILABLE", "LOW_STOCK"]);

const normalizeValue = (value) => String(value || "").trim().toUpperCase();

const normalizeIdentifier = (value) => String(value || "").trim();

const getDisasterEventOrderValue = (event) => {
  const rawValue =
    event?.created_at || event?.start_date || event?.updated_at || 0;
  const timestamp = new Date(rawValue).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
};

const compareDisasterEventsByCreationOrder = (leftEvent, rightEvent) => {
  const timeDifference =
    getDisasterEventOrderValue(leftEvent) -
    getDisasterEventOrderValue(rightEvent);

  if (timeDifference !== 0) {
    return timeDifference;
  }

  return normalizeIdentifier(leftEvent?.id).localeCompare(
    normalizeIdentifier(rightEvent?.id),
  );
};

export const sortDisasterEventsForReliefPackRollover = (events) =>
  [...(events || [])].sort(compareDisasterEventsByCreationOrder);

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

export const isReliefPackDonationEligibleForDisasterEvent = ({
  batch,
  targetDisasterEventId,
  disasterEvents = [],
} = {}) => {
  const targetId = normalizeIdentifier(targetDisasterEventId);
  const { disasterEventId: sourceEventId } = getDonationMetadata(batch);
  const normalizedSourceEventId = normalizeIdentifier(sourceEventId);
  const targetEvent = (disasterEvents || []).find(
    (event) => normalizeIdentifier(event?.id) === targetId,
  );

  if (
    !targetId ||
    !normalizedSourceEventId ||
    !targetEvent ||
    normalizeValue(targetEvent.status) !== "ACTIVE"
  ) {
    return false;
  }

  if (normalizedSourceEventId === targetId) {
    return true;
  }

  const sourceEvent = (disasterEvents || []).find(
    (event) => normalizeIdentifier(event?.id) === normalizedSourceEventId,
  );

  if (
    !sourceEvent ||
    !["CLOSED", "ARCHIVED"].includes(normalizeValue(sourceEvent.status))
  ) {
    return false;
  }

  const laterActiveEvents = (disasterEvents || [])
    .filter((event) => normalizeValue(event?.status) === "ACTIVE")
    .filter(
      (event) =>
        compareDisasterEventsByCreationOrder(sourceEvent, event) < 0,
    )
    .sort(compareDisasterEventsByCreationOrder);

  return normalizeIdentifier(laterActiveEvents[0]?.id) === targetId;
};

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

  if (options.targetDisasterEventId) {
    return isReliefPackDonationEligibleForDisasterEvent({
      batch,
      targetDisasterEventId: options.targetDisasterEventId,
      disasterEvents: options.disasterEvents,
    });
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
