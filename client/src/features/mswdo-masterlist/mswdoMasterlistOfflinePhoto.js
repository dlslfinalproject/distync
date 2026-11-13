import { readMswdoOfflineSnapshot } from "../offline/mswdoOfflinePreparation.js";
import { buildHouseholdDetailsSnapshot } from "../masterlist/barangayMasterlistUi.js";

const normalizeId = (value) => String(value ?? "").trim();

export const getMswdoOfflineHouseholdDetails = async ({
  userId,
  eventId,
  householdId,
  barangayId = "",
} = {}) => {
  if (!userId || !eventId || !householdId) {
    return null;
  }

  const snapshot = await readMswdoOfflineSnapshot({ userId, eventId });
  const household = (snapshot?.datasets?.masterlist?.rows || []).find(
    (row) =>
      normalizeId(row?.household_id || row?.id) === normalizeId(householdId) &&
      (!barangayId ||
        normalizeId(row?.barangay?.id || row?.barangay_id) === normalizeId(barangayId)),
  );

  if (!household) {
    return null;
  }

  return buildHouseholdDetailsSnapshot(household);
};
