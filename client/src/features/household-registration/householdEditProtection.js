export const HOUSEHOLD_UPDATE_MEMBER_FIELDS = [
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

export const HOUSEHOLD_UPDATE_ALLOWED_FIELDS = [
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

const pickAllowedFields = (source, allowedFields) =>
  allowedFields.reduce((result, fieldName) => {
    if (Object.prototype.hasOwnProperty.call(source || {}, fieldName)) {
      result[fieldName] = source[fieldName];
    }

    return result;
  }, {});

export const sanitizeHouseholdUpdatePayload = (payload = {}) => {
  const sanitizedPayload = pickAllowedFields(payload, HOUSEHOLD_UPDATE_ALLOWED_FIELDS);

  sanitizedPayload.members = Array.isArray(payload.members)
    ? payload.members.map((member) =>
        pickAllowedFields(member || {}, HOUSEHOLD_UPDATE_MEMBER_FIELDS),
      )
    : [];
  sanitizedPayload.household_sector_ids = Array.isArray(payload.household_sector_ids)
    ? [...payload.household_sector_ids]
    : [];
  sanitizedPayload.privacy_acknowledgment =
    payload.privacy_acknowledgment ?? null;

  return sanitizedPayload;
};
