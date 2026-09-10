import { readMswdoOfflineSnapshot } from "../offline/mswdoOfflinePreparation.js";

const normalizeId = (value) => String(value ?? "").trim();

export const getMswdoOfflineHouseholdDetails = async ({
  userId,
  eventId,
  householdId,
} = {}) => {
  if (!userId || !eventId || !householdId) {
    return null;
  }

  const snapshot = await readMswdoOfflineSnapshot({ userId, eventId });
  const household = (snapshot?.datasets?.masterlist?.rows || []).find(
    (row) => normalizeId(row?.household_id || row?.id) === normalizeId(householdId),
  );

  if (!household) {
    return null;
  }

  return {
    household,
    members: Array.isArray(household.members) ? household.members : [],
    household_sectors: Array.isArray(household.household_sectors)
      ? household.household_sectors
      : [],
    latest_attendance: household.latest_attendance || null,
    privacy_consent: household.privacy_consent || null,
  };
};
