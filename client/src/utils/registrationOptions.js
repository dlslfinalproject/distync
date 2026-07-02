export const RELATIONSHIP_OPTIONS = [
  { value: "SPOUSE", label: "Spouse" },
  { value: "SON", label: "Son" },
  { value: "DAUGHTER", label: "Daughter" },
  { value: "FATHER", label: "Father" },
  { value: "MOTHER", label: "Mother" },
  { value: "BROTHER", label: "Brother" },
  { value: "SISTER", label: "Sister" },
  { value: "GRANDCHILD", label: "Grandchild" },
  { value: "GRANDPARENT", label: "Grandparent" },
  { value: "RELATIVE", label: "Relative" },
  { value: "OTHERS", label: "Others" },
];

export const AGE_BASED_MEMBER_SECTOR_CODES = [
  "INFANT",
  "TODDLER",
  "PRE_SCHOOLER",
  "SCHOOL_AGE",
  "TEENAGE",
  "ADULT",
  "SENIOR_CITIZEN",
];

export const MANUAL_MEMBER_SECTOR_CODE_ALIASES = {
  PREGNANT: ["PREGNANT"],
  LACTATING_MOTHER: ["LACTATING_MOTHER", "LACTATING"],
  PWD: ["PWD"],
  INDIGENOUS: ["INDIGENOUS"],
  FOUR_PS: ["FOUR_PS"],
};

export const MANUAL_MEMBER_SECTOR_CODES = Object.values(
  MANUAL_MEMBER_SECTOR_CODE_ALIASES,
).flat();

export const DISPLAY_MEMBER_SECTOR_CODES = [
  ...AGE_BASED_MEMBER_SECTOR_CODES,
  "PREGNANT",
  "LACTATING_MOTHER",
  "PWD",
  "INDIGENOUS",
  "FOUR_PS",
];

export const HOUSEHOLD_CONDITION_CODES = [
  "CHILD_HEADED",
  "SINGLE_HEADED",
  "SOLO_PARENT",
];

export const MEMBER_SECTOR_LABELS = {
  INFANT: "Infant",
  TODDLER: "Toddler",
  PRE_SCHOOLER: "Pre-schooler",
  SCHOOL_AGE: "School Age",
  TEENAGE: "Teenage",
  ADULT: "Adult",
  SENIOR_CITIZEN: "Senior Citizen",
  PREGNANT: "Pregnant",
  LACTATING_MOTHER: "Lactating Mother",
  LACTATING: "Lactating Mother",
  PWD: "Persons with Disabilities",
  INDIGENOUS: "Indigenous",
  FOUR_PS: "4Ps Beneficiaries",
};

export const getCanonicalMemberSectorCode = (sectorCode) => {
  if (!sectorCode) {
    return "";
  }

  if (sectorCode === "LACTATING") {
    return "LACTATING_MOTHER";
  }

  if (sectorCode === "INFANT_0_6_MONTHS") {
    return "INFANT";
  }

  if (sectorCode === "TODDLER_7M_2Y") {
    return "TODDLER";
  }

  if (sectorCode === "PRESCHOOL_3_5") {
    return "PRE_SCHOOLER";
  }

  if (sectorCode === "CHILD_6_12") {
    return "SCHOOL_AGE";
  }

  if (sectorCode === "TEEN_13_17") {
    return "TEENAGE";
  }

  if (sectorCode === "ADULT_18_59") {
    return "ADULT";
  }

  if (sectorCode === "SENIOR_60_ABOVE") {
    return "SENIOR_CITIZEN";
  }

  return sectorCode;
};

export const isAgeBasedMemberSectorCode = (sectorCode) => {
  return AGE_BASED_MEMBER_SECTOR_CODES.includes(
    getCanonicalMemberSectorCode(sectorCode),
  );
};

export const formatMemberSectorLabel = (sectorOrCode) => {
  if (!sectorOrCode) {
    return "";
  }

  const sectorCode =
    typeof sectorOrCode === "string"
      ? getCanonicalMemberSectorCode(sectorOrCode)
      : getCanonicalMemberSectorCode(sectorOrCode.code);

  return (
    MEMBER_SECTOR_LABELS[sectorCode] ||
    sectorOrCode.name ||
    sectorCode ||
    ""
  );
};
