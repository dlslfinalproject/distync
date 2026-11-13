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

export const hasComparableName = (person) =>
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
  ].join("|");

const buildFamilyHeadLookupKey = (familyHead, contactNumber) =>
  [
    "family_head",
    buildComparablePersonKey(familyHead),
    String(contactNumber || "").replace(/\D/g, ""),
  ].join("|");

const getMemberLookupId = (member, index) =>
  String(member?.lookup_id || member?.id || `member_${index}`);

export const getPossibleMatchPersonKey = (member, index) =>
  `member:${getMemberLookupId(member, index)}`;

export const getPossibleMatchRequestKey = (person = {}) =>
  person?.requestLookupKey || person?.lookupKey || "";

export const getPossibleMatchRequestPeople = ({
  eligiblePeople = [],
  currentStates = {},
} = {}) =>
  eligiblePeople.filter((person) => {
    const previousState = currentStates[person.personKey];
    const requestLookupKey = getPossibleMatchRequestKey(person);

    return (
      !previousState ||
      previousState.lookupKey !== requestLookupKey ||
      previousState.status === "idle"
    );
  });

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

  const sourceMembers = Array.isArray(members) ? members : [];
  const normalizedFamilyHead = normalizePersonForLookup(familyHead, {
    relationship_to_head: "HEAD",
    age_unit: "YEARS",
  });
  const normalizedMembers = sourceMembers.map((member) =>
    normalizePersonForLookup({
      ...member,
      relationship_to_head: resolveMemberRelationship(member),
    }),
  );
  const hasFamilyHeadLookupCandidate = hasComparableName(normalizedFamilyHead);
  const familyHeadLookupKey = hasFamilyHeadLookupCandidate
    ? buildFamilyHeadLookupKey(
        normalizedFamilyHead,
        trimValue(contactNumber) || null,
      )
    : "";
  const normalizedContactNumber = trimValue(contactNumber) || null;
  const requestContext = {
    household_id: householdId || null,
    disaster_event_id: disasterEventId,
    barangay_id: barangayId,
    contact_number: normalizedContactNumber,
  };
  const people = [
    {
      personKey: "family_head",
      requestPersonKey: "family_head",
      sourceRole: "FAMILY_HEAD",
      isEligible: hasFamilyHeadLookupCandidate,
      lookupKey: familyHeadLookupKey,
    },
    ...normalizedMembers.map((member, index) => {
      const isEligible = hasComparableName(member);

      return {
        personKey: getPossibleMatchPersonKey(sourceMembers[index], index),
        requestPersonKey: `member_${index}`,
        sourceRole: "MEMBER",
        isEligible,
        lookupKey: isEligible ? buildComparablePersonKey(member) : "",
      };
    }),
  ].map((person) => ({
    ...person,
    requestLookupKey: person.isEligible
      ? JSON.stringify({ ...requestContext, person: person.lookupKey })
      : "",
  }));
  const eligiblePeople = people.filter((person) => person.isEligible);

  if (eligiblePeople.length === 0) {
    return {
      isEligible: false,
      lookupKey: "",
      payload: null,
      eligibleFields: [],
      people,
      eligiblePeople,
    };
  }

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
    family_head: familyHeadLookupKey,
    members: people
      .filter((person) => person.sourceRole === "MEMBER")
      .map((person) =>
        person.isEligible
          ? [person.personKey, person.lookupKey].join("|")
          : "",
      ),
  });
  return {
    isEligible: true,
    lookupKey,
    payload,
    eligibleFields: eligiblePeople.map((person) => person.requestPersonKey),
    people,
    eligiblePeople,
  };
};
