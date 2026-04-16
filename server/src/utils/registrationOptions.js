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
  MANUAL_MEMBER_SECTOR_CODE_ALIASES,
  MANUAL_MEMBER_SECTOR_CODES,
  HOUSEHOLD_CONDITION_CODES,
  getMemberFlagsFromSectorCodes,
};
