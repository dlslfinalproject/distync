import {
  MASTERLIST_FILTER_SECTOR_CODES,
  formatMasterlistFilterSectorLabel,
  getCanonicalMemberSectorCode,
} from "./registrationOptions.js";

const normalizeSectorToken = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const canonicalCodeByNormalizedLabel = new Map(
  MASTERLIST_FILTER_SECTOR_CODES.map((sectorCode) => [
    normalizeSectorToken(formatMasterlistFilterSectorLabel(sectorCode)),
    sectorCode,
  ]),
);

const canonicalCodeByAlias = new Map([
  ["PERSONS_WITH_DISABILITIES", "PWD"],
  ["PERSON_WITH_DISABILITIES", "PWD"],
  ["PWD", "PWD"],
  ["4PS_BENEFICIARIES", "FOUR_PS"],
  ["4P_BENEFICIARIES", "FOUR_PS"],
  ["FOUR_PS_BENEFICIARIES", "FOUR_PS"],
  ["INDIGENOUS_PEOPLE", "INDIGENOUS"],
  ["INDIGENOUS_PEOPLES", "INDIGENOUS"],
  ["PRESCHOOLER", "PRE_SCHOOLER"],
  ["PRE_SCHOOLER", "PRE_SCHOOLER"],
  ["SCHOOL_AGE", "SCHOOL_AGE"],
  ["SENIOR_CITIZEN", "SENIOR_CITIZEN"],
  ["CHILD_HEADED_FAMILY", "CHILD_HEADED"],
  ["SINGLE_HEADED_FAMILY", "SINGLE_HEADED"],
  ["SOLO_PARENTS", "SOLO_PARENT"],
]);

export const getCanonicalSectorCodeFromText = (sectorText) => {
  const normalizedToken = normalizeSectorToken(sectorText);
  const directCode = getCanonicalMemberSectorCode(normalizedToken);

  if (MASTERLIST_FILTER_SECTOR_CODES.includes(directCode)) {
    return directCode;
  }

  return (
    canonicalCodeByAlias.get(normalizedToken) ||
    canonicalCodeByNormalizedLabel.get(normalizedToken) ||
    normalizedToken
  );
};

export const formatOrderedSectorText = (sectorsText) => {
  if (!sectorsText || sectorsText === "-") {
    return "-";
  }

  const sectorItems = String(sectorsText)
    .split(",")
    .map((sectorText) => sectorText.trim())
    .filter(Boolean)
    .map((sectorText, index) => ({
      originalText: sectorText,
      code: getCanonicalSectorCodeFromText(sectorText),
      index,
    }));

  if (!sectorItems.length) {
    return "-";
  }

  const orderIndexByCode = new Map(
    MASTERLIST_FILTER_SECTOR_CODES.map((sectorCode, index) => [sectorCode, index]),
  );
  const seenCodes = new Set();

  return sectorItems
    .filter((sectorItem) => {
      const dedupeKey = sectorItem.code || sectorItem.originalText;

      if (seenCodes.has(dedupeKey)) {
        return false;
      }

      seenCodes.add(dedupeKey);
      return true;
    })
    .sort((left, right) => {
      const leftIndex = orderIndexByCode.get(left.code);
      const rightIndex = orderIndexByCode.get(right.code);

      if (leftIndex !== undefined && rightIndex !== undefined) {
        return leftIndex - rightIndex;
      }

      if (leftIndex !== undefined) {
        return -1;
      }

      if (rightIndex !== undefined) {
        return 1;
      }

      return left.index - right.index;
    })
    .map((sectorItem) =>
      MASTERLIST_FILTER_SECTOR_CODES.includes(sectorItem.code)
        ? formatMasterlistFilterSectorLabel(sectorItem.code)
        : sectorItem.originalText,
    )
    .join(", ");
};
