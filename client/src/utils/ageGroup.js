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
  INFANT_0_6_MONTHS: "Infant (0-6 months)",
  TODDLER_7M_2Y: "Toddler (7 months-2 years)",
  PRESCHOOL_3_5: "Preschool (3-5 years)",
  CHILD_6_12: "Child (6-12 years)",
  TEEN_13_17: "Teen (13-17 years)",
  ADULT_18_59: "Adult (18-59 years)",
  SENIOR_60_ABOVE: "Senior (60+ years)",
};

export const deriveAgeGroup = (ageValue, ageUnit) => {
  if (!Number.isInteger(ageValue) || ageValue < 0) {
    return null;
  }

  if (ageUnit === "MONTHS") {
    if (ageValue <= 6) {
      return "INFANT_0_6_MONTHS";
    }

    if (ageValue <= 24) {
      return "TODDLER_7M_2Y";
    }

    return null;
  }

  if (ageUnit === "YEARS") {
    if (ageValue <= 2) {
      return "TODDLER_7M_2Y";
    }

    if (ageValue <= 5) {
      return "PRESCHOOL_3_5";
    }

    if (ageValue <= 12) {
      return "CHILD_6_12";
    }

    if (ageValue <= 17) {
      return "TEEN_13_17";
    }

    if (ageValue <= 59) {
      return "ADULT_18_59";
    }

    return "SENIOR_60_ABOVE";
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
