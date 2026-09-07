import { resolveFamilyHeadPhoto } from "../masterlist/familyHeadPhoto.js";

const getHouseholdId = (stubDetails) =>
  stubDetails?.household_id || stubDetails?.household?.id || "";

export const hydrateStubDetailsWithCachedHousehold = (
  stubDetails,
  cachedMasterlistRow,
) => {
  const cachedDetails = cachedMasterlistRow?.offline_household_details;
  if (!stubDetails || !cachedDetails?.household) return stubDetails;

  const cachedHousehold = cachedDetails.household;
  const cachedPhoto = resolveFamilyHeadPhoto(cachedHousehold);
  const familyHeadName = [
    cachedHousehold.family_head_first_name,
    cachedHousehold.family_head_middle_name,
    cachedHousehold.family_head_last_name,
    cachedHousehold.family_head_suffix,
  ].filter(Boolean).join(" ").trim();

  return {
    ...stubDetails,
    disaster_event: {
      ...(stubDetails.disaster_event || {}),
      name: cachedHousehold.disaster_event_title || stubDetails.disaster_event?.name || stubDetails.disaster_event?.title || "",
    },
    barangay: {
      ...(stubDetails.barangay || {}),
      name: cachedHousehold.barangay_name || stubDetails.barangay?.name || "",
    },
    household: {
      ...(stubDetails.household || {}),
      ...cachedHousehold,
      id: cachedHousehold.id || getHouseholdId(stubDetails),
      family_head_name: familyHeadName || cachedHousehold.family_head_name || stubDetails.household?.family_head_name || "",
      members_count: cachedHousehold.household_size ?? cachedHousehold.members_count ?? stubDetails.household?.members_count ?? 0,
      family_head_photo_url: cachedPhoto,
    },
    members: cachedDetails.members || [],
    household_sectors: cachedDetails.household_sectors || [],
    latest_attendance: cachedDetails.latest_attendance || null,
    privacy_consent: cachedDetails.privacy_consent || null,
  };
};
