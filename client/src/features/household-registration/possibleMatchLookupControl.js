export const POSSIBLE_MATCH_LOOKUP_DEBOUNCE_MS = 700;

const trimValue = (value) => String(value ?? "").trim();

export const normalizePossibleMatchText = (value) =>
  trimValue(value).replace(/\s+/g, " ").toLowerCase();

const normalizeAgeValue = (value) => {
  if (value === "" || value === null || value === undefined) {
    return "";
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : "";
};

const normalizePersonForLookup = (person = {}, defaults = {}) => ({
  first_name: trimValue(person.first_name),
  middle_name: trimValue(person.middle_name) || null,
  last_name: trimValue(person.last_name),
  suffix: trimValue(person.suffix) || null,
  sex: person.sex || defaults.sex || null,
  age_value: normalizeAgeValue(person.age_value),
  age_unit: person.age_unit || defaults.age_unit || null,
  relationship_to_head:
    person.relationship_to_head || defaults.relationship_to_head || null,
});

const hasComparableName = (person) =>
  Boolean(
    normalizePossibleMatchText(person?.first_name).length >= 2 &&
      normalizePossibleMatchText(person?.last_name).length >= 2,
  );

const buildComparablePersonKey = (person = {}) =>
  [
    normalizePossibleMatchText(person.first_name),
    normalizePossibleMatchText(person.middle_name),
    normalizePossibleMatchText(person.last_name),
    normalizePossibleMatchText(person.suffix),
    String(person.sex || "").toUpperCase(),
    person.age_value === "" || person.age_value === null ? "" : String(person.age_value),
    String(person.age_unit || "").toUpperCase(),
    normalizePossibleMatchText(person.relationship_to_head),
  ].join("|");

const buildFamilyHeadLookupKey = (familyHead, contactNumber) =>
  [
    "family_head",
    buildComparablePersonKey(familyHead),
    String(contactNumber || "").replace(/\D/g, ""),
  ].join("|");

export const buildPossibleMatchLookupState = ({
  householdId = null,
  disasterEventId = "",
  barangayId = "",
  registeredBy = null,
  contactNumber = "",
  familyHead = {},
  members = [],
  resolveMemberRelationship = (member) => member?.relationship_to_head || "",
} = {}) => {
  if (!disasterEventId || !barangayId) {
    return {
      isEligible: false,
      lookupKey: "",
      payload: null,
      eligibleFields: [],
    };
  }

  const normalizedFamilyHead = normalizePersonForLookup(familyHead, {
    relationship_to_head: "HEAD",
    age_unit: "YEARS",
  });
  const normalizedMembers = (Array.isArray(members) ? members : []).map((member) =>
    normalizePersonForLookup({
      ...member,
      relationship_to_head: resolveMemberRelationship(member),
    }),
  );
  const hasFamilyHeadLookupCandidate = hasComparableName(normalizedFamilyHead);
  const eligibleMemberIndexes = normalizedMembers
    .map((member, index) => (hasComparableName(member) ? index : null))
    .filter((index) => index !== null);

  if (!hasFamilyHeadLookupCandidate && eligibleMemberIndexes.length === 0) {
    return {
      isEligible: false,
      lookupKey: "",
      payload: null,
      eligibleFields: [],
    };
  }

  const normalizedContactNumber = trimValue(contactNumber) || null;
  const payload = {
    household_id: householdId || null,
    disaster_event_id: disasterEventId,
    barangay_id: barangayId,
    registered_by: registeredBy,
    contact_number: normalizedContactNumber,
    family_head: normalizedFamilyHead,
    members: normalizedMembers,
  };
  const lookupKey = JSON.stringify({
    household_id: payload.household_id,
    disaster_event_id: payload.disaster_event_id,
    barangay_id: payload.barangay_id,
    family_head: hasFamilyHeadLookupCandidate
      ? buildFamilyHeadLookupKey(normalizedFamilyHead, normalizedContactNumber)
      : "",
    members: normalizedMembers.map((member, index) =>
      eligibleMemberIndexes.includes(index)
        ? [`member_${index}`, buildComparablePersonKey(member)].join("|")
        : "",
    ),
  });

  return {
    isEligible: true,
    lookupKey,
    payload,
    eligibleFields: [
      ...(hasFamilyHeadLookupCandidate ? ["family_head"] : []),
      ...eligibleMemberIndexes.map((index) => `member_${index}`),
    ],
  };
};
