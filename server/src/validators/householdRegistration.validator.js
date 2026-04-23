const allowedStayTypes = ["EVAC_CENTER", "RELATIVES", "OTHER_SAFE_PLACE"];
const allowedSexValues = ["MALE", "FEMALE"];
const allowedResidencyStatuses = ["RESIDENT", "NON_RESIDENT"];
const { ALLOWED_AGE_UNITS } = require("../utils/ageGroup");

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => {
  return typeof value === "string" && uuidPattern.test(value);
};

const validateUuidArray = (values) => {
  return values.every((value) => isValidUuid(value));
};

const validateCreateHouseholdRegistration = (req, res, next) => {
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
      members,
      household_sector_ids,
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
      registered_by !== undefined &&
      registered_by !== null &&
      !isValidUuid(registered_by)
    ) {
      return res.status(400).json({
        message: "registered_by must be a valid UUID or null",
      });
    }

    if (!Array.isArray(members)) {
      return res.status(400).json({
        message: "members must be an array",
      });
    }

    for (const member of members) {
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
      members: members.map((member) => ({
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

module.exports = {
  validateCreateHouseholdRegistration,
  validateDepartHousehold,
};
