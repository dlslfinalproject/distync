import { getCachedMasterlistRowByHouseholdId } from "../../offline/masterlistCache.js";
export { hydrateStubDetailsWithCachedHousehold } from "./offlineHouseholdHydrationCore.js";
import { hydrateStubDetailsWithCachedHousehold } from "./offlineHouseholdHydrationCore.js";

const getHouseholdId = (stubDetails) =>
  stubDetails?.household_id || stubDetails?.household?.id || "";

export const resolveStubDetailsForOfflineDisplay = async (
  stubDetails,
  { disasterEventId = "", barangayId = "" } = {},
) => {
  if (!stubDetails) return null;
  const householdId = getHouseholdId(stubDetails);
  const eventId = disasterEventId || stubDetails.disaster_event_id || stubDetails.disaster_event?.id || "";
  const scopedBarangayId = barangayId || stubDetails.barangay_id || stubDetails.barangay?.id || "";
  const cachedRow = await getCachedMasterlistRowByHouseholdId({
    disasterEventId: eventId,
    barangayId: scopedBarangayId,
    householdId,
  });
  return cachedRow
    ? hydrateStubDetailsWithCachedHousehold(stubDetails, cachedRow)
    : { ...stubDetails, offline_household_details_unavailable: true };
};
