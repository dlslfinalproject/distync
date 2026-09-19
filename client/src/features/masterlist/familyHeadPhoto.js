import { getCachedMasterlistRows } from "../../offline/masterlistCache.js";

const normalizePhotoValue = (value) => String(value || "").trim();
const isDataImage = (value) =>
  /^data:image\/[a-z0-9.+-]+;base64,/i.test(normalizePhotoValue(value));

export const resolveFamilyHeadPhoto = (record = {}, { isOffline = false } = {}) => {
  const household = record?.household || record || {};
  const localPhoto = [
    household.family_head_photo_data_url,
    household.familyHeadPhotoDataUrl,
    household.cached_family_head_photo,
    household.family_head_photo_url,
  ].map(normalizePhotoValue).find(isDataImage);

  if (localPhoto) {
    return localPhoto;
  }

  if (isOffline) {
    return "";
  }

  return (
    normalizePhotoValue(household.family_head_photo_url) ||
    normalizePhotoValue(household.familyHeadPhoto) ||
    normalizePhotoValue(household.family_head_photo) ||
    ""
  );
};

export const getCachedFamilyHeadPhoto = async ({
  householdId,
  disasterEventId,
  barangayId,
} = {}) => {
  if (!householdId || !disasterEventId || !barangayId) {
    return "";
  }

  const rows = await getCachedMasterlistRows({ disasterEventId, barangayId });
  const row = rows.find(
    (candidate) => String(candidate?.household_id || "") === String(householdId),
  );

  return resolveFamilyHeadPhoto(row?.offline_household_details || row, {
    isOffline: true,
  });
};
