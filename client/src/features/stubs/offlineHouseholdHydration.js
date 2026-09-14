import { getCachedMasterlistRowByHouseholdId } from "../../offline/masterlistCache.js";
import { getSyncQueueActorContext } from "../../offline/syncQueue.js";
import { ROLE_CODES } from "../../utils/roleSession.js";
import { getMswdoOfflineHouseholdDetails } from "../mswdo-masterlist/mswdoMasterlistOfflinePhoto.js";
export { hydrateStubDetailsWithCachedHousehold } from "./offlineHouseholdHydrationCore.js";
import { hydrateStubDetailsWithCachedHousehold } from "./offlineHouseholdHydrationCore.js";

const getHouseholdId = (stubDetails) =>
  stubDetails?.household_id || stubDetails?.household?.id || "";

const getScopedBarangayId = (stubDetails, barangayId) =>
  barangayId === "__ALL_BARANGAYS__"
    ? stubDetails?.barangay_id || stubDetails?.barangay?.id || ""
    : barangayId || stubDetails?.barangay_id || stubDetails?.barangay?.id || "";

const getPreparedHouseholdRow = async ({
  disasterEventId,
  barangayId,
  householdId,
}) => {
  const cachedMasterlistRow = await getCachedMasterlistRowByHouseholdId({
    disasterEventId,
    barangayId,
    householdId,
  });

  if (cachedMasterlistRow) return cachedMasterlistRow;

  const owner = getSyncQueueActorContext();
  if (owner.roleCode !== ROLE_CODES.MSWDO) return null;

  const offlineDetails = await getMswdoOfflineHouseholdDetails({
    userId: owner.userId,
    eventId: disasterEventId,
    householdId,
    barangayId,
  });

  return offlineDetails
    ? { household_id: householdId, offline_household_details: offlineDetails }
    : null;
};

export const resolveStubDetailsForOfflineDisplay = async (
  stubDetails,
  { disasterEventId = "", barangayId = "" } = {},
) => {
  if (!stubDetails) return null;
  const householdId = getHouseholdId(stubDetails);
  const eventId = disasterEventId || stubDetails.disaster_event_id || stubDetails.disaster_event?.id || "";
  const scopedBarangayId = getScopedBarangayId(stubDetails, barangayId);
  const cachedRow = await getPreparedHouseholdRow({
    disasterEventId: eventId,
    barangayId: scopedBarangayId,
    householdId,
  });
  return cachedRow
    ? hydrateStubDetailsWithCachedHousehold(stubDetails, cachedRow)
    : { ...stubDetails, offline_household_details_unavailable: true };
};
