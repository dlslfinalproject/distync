const {
  MANUAL_MEMBER_SECTOR_CODES,
} = require("../utils/registrationOptions");

const FAMILY_HEAD_INFORMATION_LOCKED_MESSAGE =
  "Family head information cannot be modified after registration.";

const HOUSEHOLD_UPDATE_ALLOWED_FIELDS = [
  "disaster_event_id",
  "barangay_id",
  "residency_status",
  "evacuation_center_id",
  "current_stay_type",
  "registered_by",
  "contact_number",
  "current_address_details",
  "members",
  "household_sector_ids",
  "privacy_acknowledgment",
];

const HOUSEHOLD_UPDATE_MEMBER_FIELDS = [
  "id",
  "first_name",
  "middle_name",
  "last_name",
  "suffix",
  "sex",
  "age_value",
  "age_unit",
  "relationship_to_head",
  "sector_ids",
];

const normalizeComparableString = (value) => {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue || null;
};

const normalizeComparableIdSet = (values) =>
  [...new Set((Array.isArray(values) ? values : []).filter(Boolean).map(String))].sort();

const areIdSetsEqual = (leftValues, rightValues) => {
  const normalizedLeft = normalizeComparableIdSet(leftValues);
  const normalizedRight = normalizeComparableIdSet(rightValues);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
};

const buildFamilyHeadProtectionError = () => {
  const error = new Error(FAMILY_HEAD_INFORMATION_LOCKED_MESSAGE);
  error.statusCode = 400;
  error.code = "FAMILY_HEAD_INFORMATION_LOCKED";
  return error;
};

const pickAllowedFields = (source, allowedFields) =>
  allowedFields.reduce((result, fieldName) => {
    if (Object.prototype.hasOwnProperty.call(source || {}, fieldName)) {
      result[fieldName] = source[fieldName];
    }

    return result;
  }, {});

const sanitizeHouseholdUpdateRequestData = (requestData = {}) => {
  const sanitizedRequestData = pickAllowedFields(
    requestData,
    HOUSEHOLD_UPDATE_ALLOWED_FIELDS,
  );

  sanitizedRequestData.members = Array.isArray(requestData.members)
    ? requestData.members.map((member) =>
        pickAllowedFields(member || {}, HOUSEHOLD_UPDATE_MEMBER_FIELDS),
      )
    : [];
  sanitizedRequestData.household_sector_ids = Array.isArray(
    requestData.household_sector_ids,
  )
    ? [...requestData.household_sector_ids]
    : [];
  sanitizedRequestData.privacy_acknowledgment =
    requestData.privacy_acknowledgment ?? null;

  return sanitizedRequestData;
};

const assertNoProtectedFamilyHeadChanges = ({
  requestData,
  existingHousehold,
  existingFamilyHeadMember,
  familyHeadSectorAssignments = [],
}) => {
  if (!existingHousehold || !existingFamilyHeadMember) {
    throw buildFamilyHeadProtectionError();
  }

  if (
    Array.isArray(requestData.members) &&
    requestData.members.some(
      (member) => member?.id && member.id === existingHousehold.family_head_evacuee_id,
    )
  ) {
    throw buildFamilyHeadProtectionError();
  }

  if (requestData.family_head) {
    const existingManualFamilyHeadSectorIds = familyHeadSectorAssignments
      .filter((sector) => MANUAL_MEMBER_SECTOR_CODES.includes(sector.code))
      .map((sector) => sector.sector_id);

    const normalizedIncomingFamilyHead = {
      first_name: normalizeComparableString(requestData.family_head.first_name),
      middle_name: normalizeComparableString(requestData.family_head.middle_name),
      last_name: normalizeComparableString(requestData.family_head.last_name),
      suffix: normalizeComparableString(requestData.family_head.suffix),
      sex: normalizeComparableString(requestData.family_head.sex),
      age_value: Number(requestData.family_head.age_value),
      age_unit: normalizeComparableString(requestData.family_head.age_unit),
      sector_ids: normalizeComparableIdSet(requestData.family_head.sector_ids),
    };
    const normalizedExistingFamilyHead = {
      first_name: normalizeComparableString(
        existingHousehold.family_head_first_name,
      ),
      middle_name: normalizeComparableString(
        existingHousehold.family_head_middle_name,
      ),
      last_name: normalizeComparableString(existingHousehold.family_head_last_name),
      suffix: normalizeComparableString(existingHousehold.family_head_suffix),
      sex: normalizeComparableString(
        existingFamilyHeadMember.sex || existingHousehold.sex,
      ),
      age_value: Number(existingFamilyHeadMember.age_value),
      age_unit: normalizeComparableString(existingFamilyHeadMember.age_unit || "YEARS"),
      sector_ids: normalizeComparableIdSet(existingManualFamilyHeadSectorIds),
    };

    const hasFamilyHeadIdentityChange =
      normalizedIncomingFamilyHead.first_name !==
        normalizedExistingFamilyHead.first_name ||
      normalizedIncomingFamilyHead.middle_name !==
        normalizedExistingFamilyHead.middle_name ||
      normalizedIncomingFamilyHead.last_name !==
        normalizedExistingFamilyHead.last_name ||
      normalizedIncomingFamilyHead.suffix !== normalizedExistingFamilyHead.suffix ||
      normalizedIncomingFamilyHead.sex !== normalizedExistingFamilyHead.sex ||
      normalizedIncomingFamilyHead.age_value !==
        normalizedExistingFamilyHead.age_value ||
      normalizedIncomingFamilyHead.age_unit !== normalizedExistingFamilyHead.age_unit ||
      !areIdSetsEqual(
        normalizedIncomingFamilyHead.sector_ids,
        normalizedExistingFamilyHead.sector_ids,
      );

    if (hasFamilyHeadIdentityChange) {
      throw buildFamilyHeadProtectionError();
    }
  }

  if (
    requestData.family_head_photo_url !== undefined &&
    normalizeComparableString(requestData.family_head_photo_url) !==
      normalizeComparableString(existingHousehold.family_head_photo_url)
  ) {
    throw buildFamilyHeadProtectionError();
  }

  if (
    requestData.photo_verification_notes !== undefined &&
    normalizeComparableString(requestData.photo_verification_notes) !==
      normalizeComparableString(existingHousehold.photo_verification_notes)
  ) {
    throw buildFamilyHeadProtectionError();
  }
};

module.exports = {
  FAMILY_HEAD_INFORMATION_LOCKED_MESSAGE,
  sanitizeHouseholdUpdateRequestData,
  assertNoProtectedFamilyHeadChanges,
};
