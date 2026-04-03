const allowedStayTypes = ["EVAC_CENTER", "RELATIVES", "OTHER_SAFE_PLACE"];
const allowedSexValues = ["MALE", "FEMALE", "OTHER"];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => {
  return typeof value === "string" && uuidPattern.test(value);
};

const isValidDateString = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const validateUuidArray = (values) => {
  return values.every((value) => isValidUuid(value));
};

const validateCreateHouseholdRegistration = (req, res, next) => {
  try {
    const {
      disaster_event_id,
      barangay_id,
      evacuation_center_id,
      family_head,
      current_stay_type,
      current_address_details,
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

    if (!isValidUuid(barangay_id)) {
      return res.status(400).json({
        message: "barangay_id is required and must be a valid UUID",
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
        message: "family_head.sex must be MALE, FEMALE, or OTHER",
      });
    }

    if (!isValidDateString(family_head.birth_date)) {
      return res.status(400).json({
        message: "family_head.birth_date is required and must be a valid date",
      });
    }

    if (
      !family_head.contact_number ||
      typeof family_head.contact_number !== "string"
    ) {
      return res.status(400).json({
        message: "family_head.contact_number is required and must be a string",
      });
    }

    if (!allowedStayTypes.includes(current_stay_type)) {
      return res.status(400).json({
        message:
          "current_stay_type must be EVAC_CENTER, RELATIVES, or OTHER_SAFE_PLACE",
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

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        message: "members must be a non-empty array",
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
          message: "Each member.sex must be MALE, FEMALE, or OTHER",
        });
      }

      if (!isValidDateString(member.birth_date)) {
        return res.status(400).json({
          message: "Each member.birth_date must be a valid date",
        });
      }

      if (!Number.isInteger(member.age) || member.age < 0) {
        return res.status(400).json({
          message: "Each member.age must be a non-negative integer",
        });
      }

      if (
        member.civil_status !== undefined &&
        member.civil_status !== null &&
        typeof member.civil_status !== "string"
      ) {
        return res.status(400).json({
          message: "Each member.civil_status must be a string or null",
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

      if (typeof member.is_family_head !== "boolean") {
        return res.status(400).json({
          message: "Each member.is_family_head must be a boolean",
        });
      }

      if (typeof member.is_pregnant !== "boolean") {
        return res.status(400).json({
          message: "Each member.is_pregnant must be a boolean",
        });
      }

      if (typeof member.is_lactating !== "boolean") {
        return res.status(400).json({
          message: "Each member.is_lactating must be a boolean",
        });
      }

      if (typeof member.has_disability !== "boolean") {
        return res.status(400).json({
          message: "Each member.has_disability must be a boolean",
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
      evacuation_center_id: evacuation_center_id ?? null,
      family_head: {
        first_name: family_head.first_name.trim(),
        middle_name: family_head.middle_name ?? null,
        last_name: family_head.last_name.trim(),
        suffix: family_head.suffix ?? null,
        sex: family_head.sex,
        birth_date: family_head.birth_date,
        contact_number: family_head.contact_number.trim(),
      },
      current_stay_type,
      current_address_details: current_address_details ?? null,
      household_size,
      registered_by: registered_by ?? null,
      members: members.map((member) => ({
        first_name: member.first_name.trim(),
        middle_name: member.middle_name ?? null,
        last_name: member.last_name.trim(),
        suffix: member.suffix ?? null,
        sex: member.sex,
        birth_date: member.birth_date,
        age: member.age,
        civil_status: member.civil_status ?? null,
        relationship_to_head: member.relationship_to_head.trim(),
        is_family_head: member.is_family_head,
        is_pregnant: member.is_pregnant,
        is_lactating: member.is_lactating,
        has_disability: member.has_disability,
        sector_ids: member.sector_ids ?? [],
      })),
      household_sector_ids: household_sector_ids ?? [],
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate household registration request",
      error: error.message,
    });
  }
};

module.exports = {
  validateCreateHouseholdRegistration,
};
