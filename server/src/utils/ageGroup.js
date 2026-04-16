const ALLOWED_AGE_UNITS = ["MONTHS", "YEARS"];

const ALLOWED_AGE_GROUPS = [
  "INFANT",
  "TODDLER",
  "PRE_SCHOOLER",
  "SCHOOL_AGE",
  "TEENAGE",
  "ADULT",
  "SENIOR_CITIZEN",
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
      return "INFANT";
    }

    if (normalizedAgeValue <= 24) {
      return "TODDLER";
    }

    return null;
  }

  if (ageUnit === "YEARS") {
    if (normalizedAgeValue <= 2) {
      return "TODDLER";
    }

    if (normalizedAgeValue <= 5) {
      return "PRE_SCHOOLER";
    }

    if (normalizedAgeValue <= 12) {
      return "SCHOOL_AGE";
    }

    if (normalizedAgeValue <= 17) {
      return "TEENAGE";
    }

    if (normalizedAgeValue <= 59) {
      return "ADULT";
    }

    return "SENIOR_CITIZEN";
  }

  return null;
};

module.exports = {
  ALLOWED_AGE_UNITS,
  ALLOWED_AGE_GROUPS,
  deriveAgeGroup,
};
