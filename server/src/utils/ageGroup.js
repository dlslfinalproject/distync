const ALLOWED_AGE_UNITS = ["MONTHS", "YEARS"];

const ALLOWED_AGE_GROUPS = [
  "INFANT_0_6_MONTHS",
  "TODDLER_7M_2Y",
  "PRESCHOOL_3_5",
  "CHILD_6_12",
  "TEEN_13_17",
  "ADULT_18_59",
  "SENIOR_60_ABOVE",
];

const normalizeAgeValue = (value) => {
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
};

const deriveAgeGroup = (ageValue, ageUnit) => {
  const normalizedAgeValue = normalizeAgeValue(ageValue);

  if (normalizedAgeValue === null) {
    return null;
  }

  if (ageUnit === "MONTHS") {
    if (normalizedAgeValue <= 6) {
      return "INFANT_0_6_MONTHS";
    }

    if (normalizedAgeValue <= 24) {
      return "TODDLER_7M_2Y";
    }

    return null;
  }

  if (ageUnit === "YEARS") {
    if (normalizedAgeValue <= 2) {
      return "TODDLER_7M_2Y";
    }

    if (normalizedAgeValue <= 5) {
      return "PRESCHOOL_3_5";
    }

    if (normalizedAgeValue <= 12) {
      return "CHILD_6_12";
    }

    if (normalizedAgeValue <= 17) {
      return "TEEN_13_17";
    }

    if (normalizedAgeValue <= 59) {
      return "ADULT_18_59";
    }

    return "SENIOR_60_ABOVE";
  }

  return null;
};

module.exports = {
  ALLOWED_AGE_UNITS,
  ALLOWED_AGE_GROUPS,
  deriveAgeGroup,
};
