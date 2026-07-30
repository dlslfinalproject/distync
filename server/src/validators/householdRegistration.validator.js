const allowedStayTypes = ["EVAC_CENTER", "RELATIVES", "OTHER_SAFE_PLACE"];
const allowedSexValues = ["MALE", "FEMALE"];
const allowedResidencyStatuses = ["RESIDENT", "NON_RESIDENT"];
const {
  HOUSEHOLD_PRIVACY_CONSENT_STATUS,
  HOUSEHOLD_PRIVACY_NOTICE_VERSION,
  HOUSEHOLD_PRIVACY_SYNC_STATUS,
} = require("../config/privacyNotice");
const { ALLOWED_AGE_UNITS } = require("../utils/ageGroup");

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => {
  return typeof value === "string" && uuidPattern.test(value);
};

const validateUuidArray = (values) => {
  return values.every((value) => isValidUuid(value));
};

const isValidDateString = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
};

const MAX_FAMILY_HEAD_PHOTO_URL_LENGTH = 4_500_000;
const MAX_PHOTO_VERIFICATION_NOTES_LENGTH = 1_000;
const MAX_CONTACT_NUMBER_LENGTH = 50;
const MAX_CURRENT_ADDRESS_LENGTH = 500;
const MAX_CORRECTION_REMARKS_LENGTH = 1000;
const MAX_PRIVACY_NOTICE_VERSION_LENGTH = 100;
const MAX_PRIVACY_ACKNOWLEDGED_NAME_LENGTH = 200;
const MAX_PRIVACY_RELATIONSHIP_LENGTH = 100;

const validateHouseholdRegistrationRequest = (
  req,
  res,
  next,
  { requirePrivacyAcknowledgment = true } = {},
) => {
  try {
    const {
      disaster_event_id,
      barangay_id,
      residency_status,
      evacuation_center_id,
      family_head,
      current_stay_type,
      household_size,
      registered_by,
      contact_number,
      current_address_details,
      members,
      household_sector_ids,
      family_head_photo_url,
      photo_verification_notes,
      privacy_acknowledgment,
    } = req.body;

    if (!isValidUuid(disaster_event_id)) {
      return res.status(400).json({
        message: "disaster_event_id is required and must be a valid UUID",
      });
    }

    const normalizedResidencyStatus = residency_status || "RESIDENT";

    if (!allowedResidencyStatuses.includes(normalizedResidencyStatus)) {
      return res.status(400).json({
        message: "residency_status must be RESIDENT or NON_RESIDENT",
      });
    }

    if (!isValidUuid(barangay_id)) {
      return res.status(400).json({
        message: "barangay_id is required and must be a valid handling barangay",
      });
    }

    if (
      evacuation_center_id !== undefined &&
      evacuation_center_id !== null &&
      !isValidUuid(evacuation_center_id)
    ) {
      return res.status(400).json({
        message: "evacuation_center_id must be a valid UUID or null",
      });
    }

    if (!family_head || typeof family_head !== "object") {
      return res.status(400).json({
        message: "family_head is required",
      });
    }

    if (!family_head.first_name || typeof family_head.first_name !== "string") {
      return res.status(400).json({
        message: "family_head.first_name is required and must be a string",
      });
    }

    if (
      family_head.middle_name !== undefined &&
      family_head.middle_name !== null &&
      typeof family_head.middle_name !== "string"
    ) {
      return res.status(400).json({
        message: "family_head.middle_name must be a string or null",
      });
    }

    if (!family_head.last_name || typeof family_head.last_name !== "string") {
      return res.status(400).json({
        message: "family_head.last_name is required and must be a string",
      });
    }

    if (
      family_head.suffix !== undefined &&
      family_head.suffix !== null &&
      typeof family_head.suffix !== "string"
    ) {
      return res.status(400).json({
        message: "family_head.suffix must be a string or null",
      });
    }

    if (!allowedSexValues.includes(family_head.sex)) {
      return res.status(400).json({
        message: "family_head.sex must be MALE or FEMALE",
      });
    }

    if (
      !Number.isInteger(family_head.age_value) ||
      family_head.age_value < 0
    ) {
      return res.status(400).json({
        message:
          "family_head.age_value is required and must be a non-negative integer",
      });
    }

    if (!ALLOWED_AGE_UNITS.includes(family_head.age_unit)) {
      return res.status(400).json({
        message: "family_head.age_unit must be YEARS",
      });
    }

    if (family_head.age_unit !== "YEARS") {
      return res.status(400).json({
        message: "family_head.age_unit must be YEARS",
      });
    }

    if (
      family_head.sector_ids !== undefined &&
      !Array.isArray(family_head.sector_ids)
    ) {
      return res.status(400).json({
        message: "family_head.sector_ids must be an array when provided",
      });
    }

    if (
      Array.isArray(family_head.sector_ids) &&
      !validateUuidArray(family_head.sector_ids)
    ) {
      return res.status(400).json({
        message: "Each family_head.sector_ids value must be a valid UUID",
      });
    }

    if (!allowedStayTypes.includes(current_stay_type)) {
      return res.status(400).json({
        message:
          "current_stay_type must be EVAC_CENTER, RELATIVES, or OTHER_SAFE_PLACE",
      });
    }

    if (!Number.isInteger(household_size) || household_size <= 0) {
      return res.status(400).json({
        message: "household_size is required and must be a positive integer",
      });
    }

    if (
      contact_number !== undefined &&
      contact_number !== null &&
      typeof contact_number !== "string"
    ) {
      return res.status(400).json({
        message: "contact_number must be a string or null",
      });
    }

    if (
      typeof contact_number === "string" &&
      contact_number.length > MAX_CONTACT_NUMBER_LENGTH
    ) {
      return res.status(400).json({
        message: "contact_number must be 50 characters or fewer",
      });
    }

    if (
      current_address_details !== undefined &&
      current_address_details !== null &&
      typeof current_address_details !== "string"
    ) {
      return res.status(400).json({
        message: "current_address_details must be a string or null",
      });
    }

    if (
      typeof current_address_details === "string" &&
      current_address_details.length > MAX_CURRENT_ADDRESS_LENGTH
    ) {
      return res.status(400).json({
        message: "current_address_details must be 500 characters or fewer",
      });
    }

    if (
      registered_by !== undefined &&
      registered_by !== null &&
      !isValidUuid(registered_by)
    ) {
      return res.status(400).json({
        message: "registered_by must be a valid UUID or null",
      });
    }

    if (
      family_head_photo_url !== undefined &&
      family_head_photo_url !== null &&
      typeof family_head_photo_url !== "string"
    ) {
      return res.status(400).json({
        message: "family_head_photo_url must be a string or null",
      });
    }

    if (
      typeof family_head_photo_url === "string" &&
      family_head_photo_url.length > MAX_FAMILY_HEAD_PHOTO_URL_LENGTH
    ) {
      return res.status(400).json({
        message: "family_head_photo_url is too large",
      });
    }

    if (
      family_head_photo_url === undefined ||
      family_head_photo_url === null ||
      (typeof family_head_photo_url === "string" &&
        !family_head_photo_url.trim())
    ) {
      return res.status(400).json({
        message: "Family head photo is required for verification.",
      });
    }

    if (
      photo_verification_notes !== undefined &&
      photo_verification_notes !== null &&
      typeof photo_verification_notes !== "string"
    ) {
      return res.status(400).json({
        message: "photo_verification_notes must be a string or null",
      });
    }

    if (
      typeof photo_verification_notes === "string" &&
      photo_verification_notes.length > MAX_PHOTO_VERIFICATION_NOTES_LENGTH
    ) {
      return res.status(400).json({
        message: "photo_verification_notes must be 1000 characters or fewer",
      });
    }

    if (
      privacy_acknowledgment !== undefined &&
      privacy_acknowledgment !== null &&
      typeof privacy_acknowledgment !== "object"
    ) {
      return res.status(400).json({
        message:
          "privacy_acknowledgment must be an object when provided",
      });
    }

    if (requirePrivacyAcknowledgment && !privacy_acknowledgment) {
      return res.status(400).json({
        message:
          "Data Privacy Notice acknowledgment is required before the family can be registered.",
      });
    }

    let normalizedPrivacyAcknowledgment = null;

    if (privacy_acknowledgment) {
      const {
        consent_status,
        notice_version,
        acknowledged_at,
        acknowledged_by_name,
        representative_relationship,
        device_id,
        is_offline_encoded,
        sync_status,
      } = privacy_acknowledgment;

      if (consent_status !== HOUSEHOLD_PRIVACY_CONSENT_STATUS.ACKNOWLEDGED) {
        return res.status(400).json({
          message:
            "Data Privacy Notice acknowledgment is required before the family can be registered.",
        });
      }

      if (
        typeof notice_version !== "string" ||
        !notice_version.trim() ||
        notice_version.length > MAX_PRIVACY_NOTICE_VERSION_LENGTH
      ) {
        return res.status(400).json({
          message:
            "privacy_acknowledgment.notice_version is required and must be 100 characters or fewer",
        });
      }

      if (notice_version.trim() !== HOUSEHOLD_PRIVACY_NOTICE_VERSION) {
        return res.status(400).json({
          message:
            "privacy_acknowledgment.notice_version is invalid or outdated",
        });
      }

      if (!isValidDateString(acknowledged_at)) {
        return res.status(400).json({
          message:
            "privacy_acknowledgment.acknowledged_at must be a valid ISO date string",
        });
      }

      if (
        acknowledged_by_name !== undefined &&
        acknowledged_by_name !== null &&
        (typeof acknowledged_by_name !== "string" ||
          !acknowledged_by_name.trim() ||
          acknowledged_by_name.length > MAX_PRIVACY_ACKNOWLEDGED_NAME_LENGTH)
      ) {
        return res.status(400).json({
          message:
            "privacy_acknowledgment.acknowledged_by_name must be 200 characters or fewer when provided",
        });
      }

      if (
        representative_relationship !== undefined &&
        representative_relationship !== null &&
        (typeof representative_relationship !== "string" ||
          representative_relationship.length > MAX_PRIVACY_RELATIONSHIP_LENGTH)
      ) {
        return res.status(400).json({
          message:
            "privacy_acknowledgment.representative_relationship must be 100 characters or fewer when provided",
        });
      }

      if (
        device_id !== undefined &&
        device_id !== null &&
        !isValidUuid(device_id)
      ) {
        return res.status(400).json({
          message:
            "privacy_acknowledgment.device_id must be a valid UUID or null",
        });
      }

      if (
        is_offline_encoded !== undefined &&
        typeof is_offline_encoded !== "boolean"
      ) {
        return res.status(400).json({
          message:
            "privacy_acknowledgment.is_offline_encoded must be a boolean when provided",
        });
      }

      if (
        sync_status !== undefined &&
        sync_status !== null &&
        !Object.values(HOUSEHOLD_PRIVACY_SYNC_STATUS).includes(
          String(sync_status).toUpperCase(),
        )
      ) {
        return res.status(400).json({
          message:
            "privacy_acknowledgment.sync_status must be PENDING, SYNCED, FAILED, or CONFLICT when provided",
        });
      }

      normalizedPrivacyAcknowledgment = {
        consent_status,
        notice_version: notice_version.trim(),
        acknowledged_at,
        acknowledged_by_name:
          typeof acknowledged_by_name === "string" &&
          acknowledged_by_name.trim()
            ? acknowledged_by_name.trim()
            : null,
        representative_relationship:
          typeof representative_relationship === "string" &&
          representative_relationship.trim()
            ? representative_relationship.trim()
            : null,
        device_id: device_id ?? null,
        is_offline_encoded: is_offline_encoded === true,
        sync_status:
          typeof sync_status === "string" && sync_status.trim()
            ? sync_status.trim().toUpperCase()
            : null,
      };
    }

    if (!Array.isArray(members)) {
      return res.status(400).json({
        message: "members must be an array",
      });
    }

    for (const member of members) {
      if (
        member.id !== undefined &&
        member.id !== null &&
        member.id !== "" &&
        !isValidUuid(member.id)
      ) {
        return res.status(400).json({
          message: "Each member.id must be a valid UUID when provided",
        });
      }

      if (!member.first_name || typeof member.first_name !== "string") {
        return res.status(400).json({
          message: "Each member.first_name is required and must be a string",
        });
      }

      if (
        member.middle_name !== undefined &&
        member.middle_name !== null &&
        typeof member.middle_name !== "string"
      ) {
        return res.status(400).json({
          message: "Each member.middle_name must be a string or null",
        });
      }

      if (!member.last_name || typeof member.last_name !== "string") {
        return res.status(400).json({
          message: "Each member.last_name is required and must be a string",
        });
      }

      if (
        member.suffix !== undefined &&
        member.suffix !== null &&
        typeof member.suffix !== "string"
      ) {
        return res.status(400).json({
          message: "Each member.suffix must be a string or null",
        });
      }

      if (!allowedSexValues.includes(member.sex)) {
        return res.status(400).json({
          message: "Each member.sex must be MALE or FEMALE",
        });
      }

      if (!Number.isInteger(member.age_value) || member.age_value < 0) {
        return res.status(400).json({
          message:
            "Each member.age_value is required and must be a non-negative integer",
        });
      }

      if (!ALLOWED_AGE_UNITS.includes(member.age_unit)) {
        return res.status(400).json({
          message: "Each member.age_unit must be MONTHS or YEARS",
        });
      }

      if (
        !member.relationship_to_head ||
        typeof member.relationship_to_head !== "string"
      ) {
        return res.status(400).json({
          message:
            "Each member.relationship_to_head is required and must be a string",
        });
      }

      if (member.sector_ids !== undefined && !Array.isArray(member.sector_ids)) {
        return res.status(400).json({
          message: "Each member.sector_ids must be an array when provided",
        });
      }

      if (
        Array.isArray(member.sector_ids) &&
        !validateUuidArray(member.sector_ids)
      ) {
        return res.status(400).json({
          message: "Each member.sector_ids value must be a valid UUID",
        });
      }
    }

    if (
      household_sector_ids !== undefined &&
      !Array.isArray(household_sector_ids)
    ) {
      return res.status(400).json({
        message: "household_sector_ids must be an array when provided",
      });
    }

    if (
      Array.isArray(household_sector_ids) &&
      !validateUuidArray(household_sector_ids)
    ) {
      return res.status(400).json({
        message: "Each household_sector_ids value must be a valid UUID",
      });
    }

    req.validatedBody = {
      disaster_event_id,
      barangay_id,
      residency_status: normalizedResidencyStatus,
      evacuation_center_id: evacuation_center_id ?? null,
      family_head: {
        first_name: family_head.first_name.trim(),
        middle_name: family_head.middle_name ?? null,
        last_name: family_head.last_name.trim(),
        suffix: family_head.suffix ?? null,
        sex: family_head.sex,
        age_value: family_head.age_value,
        age_unit: family_head.age_unit,
        sector_ids: family_head.sector_ids ?? [],
      },
      current_stay_type,
      household_size,
      registered_by: registered_by ?? null,
      contact_number:
        typeof contact_number === "string" && contact_number.trim()
          ? contact_number.trim()
          : null,
      current_address_details:
        typeof current_address_details === "string" &&
        current_address_details.trim()
          ? current_address_details.trim()
          : null,
      family_head_photo_url:
        typeof family_head_photo_url === "string" &&
        family_head_photo_url.trim()
          ? family_head_photo_url.trim()
          : null,
      photo_verification_notes:
        typeof photo_verification_notes === "string" &&
        photo_verification_notes.trim()
          ? photo_verification_notes.trim()
          : null,
      privacy_acknowledgment: normalizedPrivacyAcknowledgment,
      members: members.map((member) => ({
        id:
          typeof member.id === "string" && member.id.trim()
            ? member.id.trim()
            : null,
        first_name: member.first_name.trim(),
        middle_name: member.middle_name ?? null,
        last_name: member.last_name.trim(),
        suffix: member.suffix ?? null,
        sex: member.sex,
        age_value: member.age_value,
        age_unit: member.age_unit,
        relationship_to_head: member.relationship_to_head.trim(),
        sector_ids: member.sector_ids ?? [],
      })),
      household_sector_ids: household_sector_ids ?? [],
    };

    const hasInvalidFamilyHeadManualSector =
      Array.isArray(req.validatedBody.family_head.sector_ids) &&
      req.validatedBody.family_head.sector_ids.some((value) => !isValidUuid(value));

    if (hasInvalidFamilyHeadManualSector) {
      return res.status(400).json({
        message: "Each family_head.sector_ids value must be a valid UUID",
      });
    }

    const hasInvalidMemberSectorShape = req.validatedBody.members.some((member) =>
      member.sector_ids.some((value) => !isValidUuid(value)),
    );

    if (hasInvalidMemberSectorShape) {
      return res.status(400).json({
        message: "Each member.sector_ids value must be a valid UUID",
      });
    }

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate household registration request",
      error: error.message,
    });
  }
};

const validateCreateHouseholdRegistration = (req, res, next) => {
  return validateHouseholdRegistrationRequest(req, res, next, {
    requirePrivacyAcknowledgment: true,
  });
};

const validateDepartHousehold = (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { remarks, recorded_by } = req.body || {};

    if (!isValidUuid(householdId)) {
      return res.status(400).json({
        message: "householdId must be a valid UUID",
      });
    }

    if (
      remarks !== undefined &&
      remarks !== null &&
      typeof remarks !== "string"
    ) {
      return res.status(400).json({
        message: "remarks must be a string or null",
      });
    }

    if (
      recorded_by !== undefined &&
      recorded_by !== null &&
      !isValidUuid(recorded_by)
    ) {
      return res.status(400).json({
        message: "recorded_by must be a valid UUID or null",
      });
    }

    req.validatedParams = {
      householdId,
    };

    req.validatedBody = {
      remarks: remarks ?? null,
      recorded_by: recorded_by ?? null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate household departure request",
      error: error.message,
    });
  }
};

const validateGetHouseholdDetails = (req, res, next) => {
  try {
    const { householdId } = req.params;

    if (!isValidUuid(householdId)) {
      return res.status(400).json({
        message: "householdId must be a valid UUID",
      });
    }

    req.validatedParams = {
      householdId,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate household detail request",
      error: error.message,
    });
  }
};

const validateArchiveHousehold = (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { archive_remarks } = req.body || {};

    if (!isValidUuid(householdId)) {
      return res.status(400).json({
        message: "householdId must be a valid UUID",
      });
    }

    if (
      archive_remarks !== undefined &&
      archive_remarks !== null &&
      typeof archive_remarks !== "string"
    ) {
      return res.status(400).json({
        message: "archive_remarks must be a string or null",
      });
    }

    if (
      typeof archive_remarks === "string" &&
      archive_remarks.length > MAX_CORRECTION_REMARKS_LENGTH
    ) {
      return res.status(400).json({
        message: "archive_remarks must be 1000 characters or fewer",
      });
    }

    req.validatedParams = {
      householdId,
    };

    req.validatedBody = {
      archive_remarks:
        typeof archive_remarks === "string" && archive_remarks.trim()
          ? archive_remarks.trim()
          : null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate household archive request",
      error: error.message,
    });
  }
};

const validateRestoreHousehold = (req, res, next) => {
  try {
    const { householdId } = req.params;
    const { restore_mode } = req.body || {};
    const normalizedRestoreMode =
      typeof restore_mode === "string" && restore_mode.trim()
        ? restore_mode.trim().toUpperCase()
        : "RETURN_TO_EVAC_CENTER";

    if (!isValidUuid(householdId)) {
      return res.status(400).json({
        message: "householdId must be a valid UUID",
      });
    }

    if (normalizedRestoreMode !== "RETURN_TO_EVAC_CENTER") {
      return res.status(400).json({
        message: "restore_mode must be RETURN_TO_EVAC_CENTER",
      });
    }

    req.validatedParams = {
      householdId,
    };

    req.validatedBody = {
      restore_mode: normalizedRestoreMode,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate household restore request",
      error: error.message,
    });
  }
};

const validateCorrectEvacuationLog = (req, res, next) => {
  try {
    const { householdId, evacuationLogId } = req.params;
    const { evacuation_center_id, status, correction_remarks } = req.body || {};

    if (!isValidUuid(householdId)) {
      return res.status(400).json({
        message: "householdId must be a valid UUID",
      });
    }

    if (!isValidUuid(evacuationLogId)) {
      return res.status(400).json({
        message: "evacuationLogId must be a valid UUID",
      });
    }

    if (
      evacuation_center_id !== undefined &&
      evacuation_center_id !== null &&
      !isValidUuid(evacuation_center_id)
    ) {
      return res.status(400).json({
        message: "evacuation_center_id must be a valid UUID or null",
      });
    }

    if (!["PRESENT", "LEFT"].includes(status)) {
      return res.status(400).json({
        message: "status must be PRESENT or LEFT",
      });
    }

    if (
      correction_remarks !== undefined &&
      correction_remarks !== null &&
      typeof correction_remarks !== "string"
    ) {
      return res.status(400).json({
        message: "correction_remarks must be a string or null",
      });
    }

    if (
      typeof correction_remarks === "string" &&
      correction_remarks.length > MAX_CORRECTION_REMARKS_LENGTH
    ) {
      return res.status(400).json({
        message: "correction_remarks must be 1000 characters or fewer",
      });
    }

    req.validatedParams = {
      householdId,
      evacuationLogId,
    };

    req.validatedBody = {
      evacuation_center_id: evacuation_center_id ?? null,
      status,
      correction_remarks:
        typeof correction_remarks === "string" && correction_remarks.trim()
          ? correction_remarks.trim()
          : null,
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate evacuation correction request",
      error: error.message,
    });
  }
};

const validateUpdateHouseholdDetails = (req, res, next) => {
  try {
    const { householdId } = req.params;

    if (!isValidUuid(householdId)) {
      return res.status(400).json({
        message: "householdId must be a valid UUID",
      });
    }

    req.params.householdId = householdId;

    return validateHouseholdRegistrationRequest(req, res, () => {
      req.validatedParams = {
        householdId,
      };

      return next();
    }, {
      requirePrivacyAcknowledgment: false,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate household update request",
      error: error.message,
    });
  }
};

module.exports = {
  validateCreateHouseholdRegistration,
  validateDepartHousehold,
  validateGetHouseholdDetails,
  validateUpdateHouseholdDetails,
  validateArchiveHousehold,
  validateRestoreHousehold,
  validateCorrectEvacuationLog,
};
