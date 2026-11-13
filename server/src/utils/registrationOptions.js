const AGE_BASED_MEMBER_SECTOR_CODE_ALIASES = {
  INFANT: ["INFANT", "INFANT_0_6_MONTHS"],
  TODDLER: ["TODDLER", "TODDLER_7M_2Y"],
  PRE_SCHOOLER: ["PRE_SCHOOLER", "PRESCHOOL_3_5"],
  SCHOOL_AGE: ["SCHOOL_AGE", "CHILD_6_12"],
  TEENAGE: ["TEENAGE", "TEEN_13_17"],
  ADULT: ["ADULT", "ADULT_18_59"],
  SENIOR_CITIZEN: ["SENIOR_CITIZEN", "SENIOR_60_ABOVE"],
};

const AGE_BASED_MEMBER_SECTOR_NAME_ALIASES = {
  INFANT: ["INFANT"],
  TODDLER: ["TODDLER"],
  PRE_SCHOOLER: ["PRE SCHOOLER", "PRESCHOOLER", "PRE SCHOOL"],
  SCHOOL_AGE: ["SCHOOL AGE"],
  TEENAGE: ["TEENAGE", "TEENAGER"],
  ADULT: ["ADULT"],
  SENIOR_CITIZEN: ["SENIOR CITIZEN", "SENIOR"],
};

const MANUAL_MEMBER_SECTOR_CODE_ALIASES = {
  PREGNANT: ["PREGNANT"],
  LACTATING_MOTHER: ["LACTATING_MOTHER", "LACTATING"],
  PWD: ["PWD"],
  INDIGENOUS: ["INDIGENOUS"],
  FOUR_PS: ["FOUR_PS"],
};

const MANUAL_MEMBER_SECTOR_CODES = Object.values(
  MANUAL_MEMBER_SECTOR_CODE_ALIASES,
).flat();

const HOUSEHOLD_CONDITION_CODES = [
  "CHILD_HEADED",
  "SINGLE_HEADED",
  "SOLO_PARENT",
];

const getCanonicalMemberSectorCode = (sectorCode) => {
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

const buildAgeSectorLookupCodes = (sectorCodes = []) => {
  const lookupCodes = new Set();

  sectorCodes.forEach((sectorCode) => {
    const canonicalCode = getCanonicalMemberSectorCode(sectorCode);
    const aliases =
      AGE_BASED_MEMBER_SECTOR_CODE_ALIASES[canonicalCode] || [canonicalCode];

    aliases.forEach((aliasCode) => {
      if (aliasCode) {
        lookupCodes.add(aliasCode);
      }
    });
  });

  return [...lookupCodes];
};

const normalizeSectorLookupValue = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s_-]+/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const getCanonicalAgeSectorCodeFromValue = (value) => {
  const canonicalCode = getCanonicalMemberSectorCode(String(value || "").trim());

  if (AGE_BASED_MEMBER_SECTOR_CODE_ALIASES[canonicalCode]) {
    return canonicalCode;
  }

  const normalizedValue = normalizeSectorLookupValue(value);

  const matchedEntry = Object.entries(AGE_BASED_MEMBER_SECTOR_NAME_ALIASES).find(
    ([, aliases]) =>
      aliases.some(
        (alias) =>
          normalizedValue === alias ||
          normalizedValue.startsWith(`${alias} `) ||
          normalizedValue.includes(` ${alias} `),
      ),
  );

  return matchedEntry?.[0] || "";
};

const getMemberFlagsFromSectorCodes = (sectorCodes) => {
  return {
    is_pregnant: sectorCodes.includes("PREGNANT"),
    is_lactating:
      sectorCodes.includes("LACTATING_MOTHER") ||
      sectorCodes.includes("LACTATING"),
    has_disability: sectorCodes.includes("PWD"),
  };
};

module.exports = {
  AGE_BASED_MEMBER_SECTOR_CODE_ALIASES,
  AGE_BASED_MEMBER_SECTOR_NAME_ALIASES,
  MANUAL_MEMBER_SECTOR_CODE_ALIASES,
  MANUAL_MEMBER_SECTOR_CODES,
  HOUSEHOLD_CONDITION_CODES,
  getCanonicalAgeSectorCodeFromValue,
  getCanonicalMemberSectorCode,
  buildAgeSectorLookupCodes,
  getMemberFlagsFromSectorCodes,
};
