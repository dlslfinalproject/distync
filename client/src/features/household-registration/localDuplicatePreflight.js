import { LOCAL_SYNC_STATUS } from "../../offline/db.js";
import { getVisibleSyncQueueEntries } from "../../offline/syncQueue.js";

export const LOCAL_DUPLICATE_HOUSEHOLD_REGISTRATION_CODE =
  "DUPLICATE_HOUSEHOLD_REGISTRATION";

const HOUSEHOLD_REGISTER_ACTION = "HOUSEHOLD_REGISTER";
const DUPLICATE_QUEUE_STATUSES = new Set([
  LOCAL_SYNC_STATUS.PENDING,
  LOCAL_SYNC_STATUS.FAILED,
]);

const trimValue = (value) => String(value ?? "").trim();
const normalizeComparableText = (value) =>
  trimValue(value).replace(/\s+/g, " ").toLowerCase();

const normalizeContactNumber = (value) => String(value || "").replace(/\D/g, "");

const buildFullName = (person = {}) =>
  [
    person.first_name,
    person.middle_name,
    person.last_name,
    person.suffix,
  ]
    .map((value) => trimValue(value))
    .filter(Boolean)
    .join(" ");

const hasComparableName = (person) =>
  Boolean(
    normalizeComparableText(person?.first_name) &&
      normalizeComparableText(person?.last_name),
  );

const hasSameCoreName = (leftPerson, rightPerson) =>
  normalizeComparableText(leftPerson?.first_name) ===
    normalizeComparableText(rightPerson?.first_name) &&
  normalizeComparableText(leftPerson?.last_name) ===
    normalizeComparableText(rightPerson?.last_name);

const hasSameExtendedName = (leftPerson, rightPerson) =>
  hasSameCoreName(leftPerson, rightPerson) &&
  normalizeComparableText(leftPerson?.middle_name) ===
    normalizeComparableText(rightPerson?.middle_name) &&
  normalizeComparableText(leftPerson?.suffix) ===
    normalizeComparableText(rightPerson?.suffix);

const hasSameComparableAge = (leftPerson, rightPerson) => {
  if (
    !Number.isInteger(leftPerson?.age_value) ||
    !Number.isInteger(rightPerson?.age_value)
  ) {
    return false;
  }

  return (
    leftPerson.age_value === rightPerson.age_value &&
    String(leftPerson.age_unit || "").toUpperCase() ===
      String(rightPerson.age_unit || "").toUpperCase()
  );
};

const hasSameComparableSex = (leftPerson, rightPerson) =>
  String(leftPerson?.sex || "").toUpperCase() ===
  String(rightPerson?.sex || "").toUpperCase();

const hasSameComparableContactNumber = (leftValue, rightValue) => {
  const normalizedLeft = normalizeContactNumber(leftValue);
  const normalizedRight = normalizeContactNumber(rightValue);

  return Boolean(normalizedLeft) && normalizedLeft === normalizedRight;
};

const normalizeDuplicatePerson = (person = {}, defaults = {}) => ({
  first_name: trimValue(person.first_name),
  middle_name: trimValue(person.middle_name) || null,
  last_name: trimValue(person.last_name),
  suffix: trimValue(person.suffix) || null,
  sex: person.sex || defaults.sex || null,
  age_value: Number.isInteger(person.age_value) ? person.age_value : null,
  age_unit: person.age_unit || defaults.age_unit || null,
  relationship_to_head:
    person.relationship_to_head || defaults.relationship_to_head || null,
});

export const buildDuplicateLookupPeople = ({
  familyHead,
  members,
  contactNumber = null,
}) => {
  const lookupPeople = [];
  const normalizedFamilyHead = normalizeDuplicatePerson(familyHead, {
    age_unit: "YEARS",
  });

  if (hasComparableName(normalizedFamilyHead)) {
    lookupPeople.push({
      person_key: "family_head",
      source_role: "FAMILY_HEAD",
      contact_number: contactNumber || null,
      ...normalizedFamilyHead,
    });
  }

  (Array.isArray(members) ? members : []).forEach((member, index) => {
    const normalizedMember = normalizeDuplicatePerson(member);

    if (!hasComparableName(normalizedMember)) {
      return;
    }

    lookupPeople.push({
      person_key: `member_${index}`,
      source_role: "MEMBER",
      ...normalizedMember,
    });
  });

  return lookupPeople;
};

const buildCandidatePeople = (candidate) => {
  const people = [];
  const familyHead = normalizeDuplicatePerson(candidate.family_head, {
    age_unit: "YEARS",
  });

  if (hasComparableName(familyHead)) {
    people.push({
      matched_as: "FAMILY_HEAD",
      contact_number: candidate.contact_number || null,
      ...familyHead,
    });
  }

  (Array.isArray(candidate.members) ? candidate.members : []).forEach((member) => {
    const normalizedMember = normalizeDuplicatePerson(member);

    if (!hasComparableName(normalizedMember)) {
      return;
    }

    people.push({
      matched_as: "MEMBER",
      ...normalizedMember,
    });
  });

  return people;
};

const buildMatchReasons = ({
  sourcePerson,
  matchedPerson,
  isFamilyHeadSource,
  matchedRole,
  sourceContactNumber = null,
  matchedContactNumber = null,
}) => {
  const reasons = [];

  if (hasSameCoreName(sourcePerson, matchedPerson)) {
    reasons.push("Same first and last name");
  }

  if (hasSameExtendedName(sourcePerson, matchedPerson)) {
    reasons.push("Same full name");
  }

  if (hasSameComparableSex(sourcePerson, matchedPerson)) {
    reasons.push("Same sex");
  }

  if (hasSameComparableAge(sourcePerson, matchedPerson)) {
    reasons.push("Same age");
  }

  if (
    isFamilyHeadSource &&
    hasSameComparableContactNumber(sourceContactNumber, matchedContactNumber)
  ) {
    reasons.push("Same contact number");
  }

  reasons.push(
    matchedRole === "FAMILY_HEAD"
      ? "Matched as family head"
      : "Matched as household member",
  );

  return reasons;
};

export const classifyDuplicateMatch = ({
  sourcePerson,
  matchedPerson,
  sourceRole,
  matchedRole,
  sourceContactNumber = null,
  matchedContactNumber = null,
}) => {
  if (!hasSameCoreName(sourcePerson, matchedPerson)) {
    return null;
  }

  const isFamilyHeadSource = sourceRole === "FAMILY_HEAD";
  const sameExtendedName = hasSameExtendedName(sourcePerson, matchedPerson);
  const sameSex = hasSameComparableSex(sourcePerson, matchedPerson);
  const sameAge = hasSameComparableAge(sourcePerson, matchedPerson);
  const sameContact =
    isFamilyHeadSource &&
    hasSameComparableContactNumber(sourceContactNumber, matchedContactNumber);
  const strongMatch = sameExtendedName || (sameSex && sameAge) || sameContact;

  return {
    match_confidence: strongMatch ? "HIGH" : "POSSIBLE",
    is_strong_match: strongMatch,
    match_reasons: buildMatchReasons({
      sourcePerson,
      matchedPerson,
      isFamilyHeadSource,
      matchedRole,
      sourceContactNumber,
      matchedContactNumber,
    }),
  };
};

const normalizeCachedHouseholdCandidate = ({
  row,
  disasterEventId,
  barangayId,
}) => {
  const profile = row?.local_duplicate_profile || {};
  const familyHead = profile.family_head || null;

  if (!familyHead) {
    return null;
  }

  return {
    source_type: "cached",
    source_id: row.household_id || profile.household_id || null,
    household_id: row.household_id || profile.household_id || null,
    disaster_event_id:
      profile.disaster_event_id || row.disaster_event_id || disasterEventId || null,
    barangay_id:
      profile.barangay_id ||
      row.barangay_id ||
      row.barangay?.id ||
      barangayId ||
      null,
    barangay_name: profile.barangay_name || row.barangay?.name || null,
    family_head: familyHead,
    family_head_name: row.family_head_name || buildFullName(familyHead),
    contact_number: profile.contact_number || row.contact_number || null,
    household_size: profile.household_size || row.members_count || null,
    is_active: row.is_active !== false,
    registered_at: row.registered_at || null,
    current_stay_type: row.current_stay_type || null,
    members: Array.isArray(profile.members) ? profile.members : [],
  };
};

const normalizePendingHouseholdCandidate = (entry) => {
  const payload = entry?.payload || {};

  return {
    source_type: "pending",
    source_id: entry.id,
    household_id: entry.entityServerId || entry.entityLocalId || entry.id || null,
    client_sync_id: entry.id,
    disaster_event_id: payload.disaster_event_id || null,
    barangay_id: payload.barangay_id || null,
    barangay_name: null,
    family_head: payload.family_head || null,
    family_head_name: buildFullName(payload.family_head || {}),
    contact_number: payload.contact_number || null,
    household_size: payload.household_size || null,
    is_active: true,
    registered_at: entry.clientTimestamp || null,
    current_stay_type: payload.current_stay_type || null,
    members: Array.isArray(payload.members) ? payload.members : [],
  };
};

export const buildLocalDuplicateCandidates = ({
  payload,
  cachedHouseholds = [],
  syncQueueEntries = [],
  excludeClientSyncId = null,
}) => {
  const disasterEventId = payload?.disaster_event_id || null;
  const barangayId = payload?.barangay_id || null;
  const candidates = [];

  (Array.isArray(cachedHouseholds) ? cachedHouseholds : [])
    .map((row) =>
      normalizeCachedHouseholdCandidate({ row, disasterEventId, barangayId }),
    )
    .filter(Boolean)
    .forEach((candidate) => candidates.push(candidate));

  (Array.isArray(syncQueueEntries) ? syncQueueEntries : [])
    .filter((entry) => {
      if (!entry || entry.actionKey !== HOUSEHOLD_REGISTER_ACTION) {
        return false;
      }

      if (!DUPLICATE_QUEUE_STATUSES.has(entry.status)) {
        return false;
      }

      return !excludeClientSyncId || entry.id !== excludeClientSyncId;
    })
    .map(normalizePendingHouseholdCandidate)
    .forEach((candidate) => candidates.push(candidate));

  const seenCandidateKeys = new Set();

  return candidates.filter((candidate) => {
    if (
      candidate.disaster_event_id !== disasterEventId ||
      candidate.barangay_id !== barangayId
    ) {
      return false;
    }

    const candidateKey = [
      candidate.source_type,
      candidate.household_id,
      candidate.client_sync_id,
      normalizeComparableText(candidate.family_head_name),
    ].join("|");

    if (seenCandidateKeys.has(candidateKey)) {
      return false;
    }

    seenCandidateKeys.add(candidateKey);
    return true;
  });
};

export const runLocalDuplicatePreflight = ({
  payload,
  cachedHouseholds = [],
  syncQueueEntries = [],
  excludeClientSyncId = null,
}) => {
  const lookupPeople = buildDuplicateLookupPeople({
    familyHead: payload?.family_head,
    members: payload?.members,
    contactNumber: payload?.contact_number,
  });

  if (lookupPeople.length === 0) {
    return {
      hasHighConfidenceDuplicate: false,
      candidates: [],
      sourceCoverage: {
        cachedHouseholds: 0,
        pendingHouseholdRegistrations: 0,
      },
    };
  }

  const localCandidates = buildLocalDuplicateCandidates({
    payload,
    cachedHouseholds,
    syncQueueEntries,
    excludeClientSyncId,
  });
  const matches = [];

  for (const candidate of localCandidates) {
    const candidatePeople = buildCandidatePeople(candidate);

    for (const sourcePerson of lookupPeople) {
      for (const matchedPerson of candidatePeople) {
        const classifiedMatch = classifyDuplicateMatch({
          sourcePerson,
          matchedPerson,
          sourceRole: sourcePerson.source_role,
          matchedRole: matchedPerson.matched_as,
          sourceContactNumber: sourcePerson.contact_number,
          matchedContactNumber:
            matchedPerson.matched_as === "FAMILY_HEAD"
              ? candidate.contact_number
              : null,
        });

        if (!classifiedMatch) {
          continue;
        }

        matches.push({
          ...classifiedMatch,
          household_id: candidate.household_id,
          client_sync_id: candidate.client_sync_id || null,
          source_type: candidate.source_type,
          source_id: candidate.source_id,
          barangay_id: candidate.barangay_id,
          barangay_name: candidate.barangay_name,
          family_head_name: candidate.family_head_name,
          matched_as: matchedPerson.matched_as,
          matched_person_name: buildFullName(matchedPerson),
          matched_relationship_to_head:
            matchedPerson.relationship_to_head || null,
          matched_sex: matchedPerson.sex || null,
          matched_age_value: Number.isInteger(matchedPerson.age_value)
            ? matchedPerson.age_value
            : null,
          matched_age_unit: matchedPerson.age_unit || null,
          current_stay_type: candidate.current_stay_type || null,
          household_size: candidate.household_size || null,
          is_active: candidate.is_active !== false,
          registered_at: candidate.registered_at || null,
        });
      }
    }
  }

  const highConfidenceMatches = matches.filter((match) => match.is_strong_match);

  return {
    hasHighConfidenceDuplicate: highConfidenceMatches.length > 0,
    candidates: highConfidenceMatches,
    possibleCandidates: matches.filter((match) => !match.is_strong_match),
    sourceCoverage: {
      cachedHouseholds: localCandidates.filter(
        (candidate) => candidate.source_type === "cached",
      ).length,
      pendingHouseholdRegistrations: localCandidates.filter(
        (candidate) => candidate.source_type === "pending",
      ).length,
    },
  };
};

export const buildLocalDuplicateRegistrationError = (match) => {
  const sourceLabel =
    match?.source_type === "pending"
      ? "a pending offline registration"
      : "records available on this device";
  const error = new Error(
    `Possible duplicate evacuee registration detected from ${sourceLabel}. Review the matched household before registering again.`,
  );

  error.statusCode = 409;
  error.code = LOCAL_DUPLICATE_HOUSEHOLD_REGISTRATION_CODE;
  error.serverPayload = match || null;
  return error;
};

export const assertNoLocalDuplicateHouseholdRegistration = async ({
  payload,
  cachedHouseholds = [],
  excludeClientSyncId = null,
}) => {
  let syncQueueEntries = [];

  try {
    syncQueueEntries = await getVisibleSyncQueueEntries();
  } catch (error) {
    const preflightError = new Error(
      "Unable to inspect offline household registrations on this device. Please try again before saving offline.",
    );
    preflightError.code = "LOCAL_DUPLICATE_PREFLIGHT_UNAVAILABLE";
    preflightError.cause = error;
    throw preflightError;
  }

  const result = runLocalDuplicatePreflight({
    payload,
    cachedHouseholds,
    syncQueueEntries,
    excludeClientSyncId,
  });

  if (result.hasHighConfidenceDuplicate) {
    throw buildLocalDuplicateRegistrationError(result.candidates[0]);
  }

  return result;
};
