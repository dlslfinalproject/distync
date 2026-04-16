export const AGE_UNIT_OPTIONS = [
  {
    value: "MONTHS",
    label: "Months",
  },
  {
    value: "YEARS",
    label: "Years",
  },
];

export const AGE_GROUP_LABELS = {
  INFANT: "Infant",
  TODDLER: "Toddler",
  PRE_SCHOOLER: "Pre-Schooler",
  SCHOOL_AGE: "School Age",
  TEENAGE: "Teenage",
  ADULT: "Adult",
  SENIOR_CITIZEN: "Senior Citizen",
  INFANT_0_6_MONTHS: "Infant",
  TODDLER_7M_2Y: "Toddler",
  PRESCHOOL_3_5: "Pre-Schooler",
  CHILD_6_12: "School Age",
  TEEN_13_17: "Teenage",
  ADULT_18_59: "Adult",
  SENIOR_60_ABOVE: "Senior Citizen",
};

export const deriveAgeGroup = (ageValue, ageUnit) => {
  if (!Number.isInteger(ageValue) || ageValue < 0) {
    return null;
  }

  if (ageUnit === "MONTHS") {
    if (ageValue <= 6) {
      return "INFANT";
    }

    if (ageValue <= 24) {
      return "TODDLER";
    }

    return null;
  }

  if (ageUnit === "YEARS") {
    if (ageValue <= 2) {
      return "TODDLER";
    }

    if (ageValue <= 5) {
      return "PRE_SCHOOLER";
    }

    if (ageValue <= 12) {
      return "SCHOOL_AGE";
    }

    if (ageValue <= 17) {
      return "TEENAGE";
    }

    if (ageValue <= 59) {
      return "ADULT";
    }

    return "SENIOR_CITIZEN";
  }

  return null;
};

export const formatAgeGroupLabel = (ageGroup) => {
  return AGE_GROUP_LABELS[ageGroup] || "\u2014";
};

export const formatAgeValueLabel = (ageValue, ageUnit) => {
  if (!Number.isInteger(ageValue) || ageValue < 0 || !ageUnit) {
    return "\u2014";
  }

  const unitLabel = ageUnit === "MONTHS"
    ? ageValue === 1
      ? "month"
      : "months"
    : ageValue === 1
      ? "year"
      : "years";

  return `${ageValue} ${unitLabel}`;
};
