const pool = require("../config/db");
const {
  HOUSEHOLD_PRIVACY_NOTICE_VERSION,
  HOUSEHOLD_PRIVACY_CONSENT_STATUS,
  HOUSEHOLD_PRIVACY_SYNC_STATUS,
} = require("../config/privacyNotice");
const householdRegistrationRepository = require("../repositories/householdRegistration.repository");
const notificationService = require("../modules/notifications/notification.service");
const { deriveAgeGroup } = require("../utils/ageGroup");
const {
  logAuditSafely,
  pickDefined,
} = require("../utils/systemLog");
const {
  HOUSEHOLD_CONDITION_CODES,
  MANUAL_MEMBER_SECTOR_CODES,
  buildAgeSectorLookupCodes,
  getCanonicalAgeSectorCodeFromValue,
  getCanonicalMemberSectorCode,
  getMemberFlagsFromSectorCodes,
} = require("../utils/registrationOptions");
const {
  assertNoProtectedFamilyHeadChanges,
  sanitizeHouseholdUpdateRequestData,
} = require("./householdEditProtection.service");

const NON_RESIDENT_BARANGAY_CODE = "NON_RESIDENT_OUTSIDE_MALVAR";
const RESIDENCY_STATUSES = {
  resident: "RESIDENT",
  nonResident: "NON_RESIDENT",
};
const BARANGAY_ROLE_CODE = "BARANGAY";
const DUPLICATE_SUGGESTION_VISIBILITY = {
  authorized: "AUTHORIZED",
  restrictedExternalBarangay: "RESTRICTED_EXTERNAL_BARANGAY",
};
const RESTORE_MODES = {
  RETURN_TO_EVAC_CENTER: "RETURN_TO_EVAC_CENTER",
};
const NEW_HOUSEHOLD_OCCURRENCE_OPERATION =
  "CREATE_NEW_HOUSEHOLD_OCCURRENCE";
const NON_ADMITTED_RESIDENT_STAY_TYPES = new Set([
  "RELATIVES",
  "OTHER_SAFE_PLACE",
]);

const buildDuplicateDepartureError = (householdId, latestAttendance) => {
  const error = new Error(
    "Duplicate household departure detected. Accepted server departure time was kept.",
  );
  error.statusCode = 409;
  error.code = "DUPLICATE_HOUSEHOLD_DEPARTURE";
  error.entityServerId = householdId;
  error.serverPayload = latestAttendance || null;
  return error;
};

const isEarlierTimestamp = (candidateTimestamp, existingTimestamp) => {
  if (!candidateTimestamp || !existingTimestamp) {
    return false;
  }

  const candidateTime = new Date(candidateTimestamp).getTime();
  const existingTime = new Date(existingTimestamp).getTime();

  return Number.isFinite(candidateTime) &&
    Number.isFinite(existingTime) &&
    candidateTime < existingTime;
};

const buildStubQrCodeValue = ({ disasterEventId, householdId, stubNo }) => {
  return `DISTYNC-STUB|${disasterEventId}|${householdId}|${stubNo}`;
};

const deduplicateIds = (ids) => {
  return [...new Set(ids)];
};

const isValidTimestampValue = (value) => {
  if (!value) {
    return false;
  }

  const parsedValue = new Date(value).getTime();
  return Number.isFinite(parsedValue);
};

const buildHouseholdPrivacyRequiredError = () => {
  const error = new Error(
    "Data Privacy Notice acknowledgment is required before the family can be registered.",
  );
  error.statusCode = 400;
  error.code = "HOUSEHOLD_PRIVACY_ACKNOWLEDGMENT_REQUIRED";
  return error;
};

const buildHouseholdPrivacySaveFailedError = (cause = null) => {
  const error = new Error(
    "The family registration could not be completed because the Data Privacy acknowledgment was not saved. No family record was created. Please try again.",
  );
  error.statusCode = 500;
  error.code = "HOUSEHOLD_PRIVACY_ACKNOWLEDGMENT_SAVE_FAILED";
  if (cause) {
    error.cause = cause;
  }
  return error;
};

const buildDisasterEventNotActiveError = () => {
  const error = new Error(
    "Household registration cannot be completed because the disaster event is not active.",
  );
  error.statusCode = 400;
  error.code = "DISASTER_EVENT_NOT_ACTIVE";
  return error;
};

const assertHouseholdUpdateDisasterEventActive = (household) => {
  if (household?.disaster_event_status !== "ACTIVE") {
    throw buildDisasterEventNotActiveError();
  }
};

const buildFullName = ({
  first_name,
  middle_name,
  last_name,
  suffix,
}) => {
  return [first_name, middle_name, last_name, suffix]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
};

const normalizeComparableText = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const buildComparableFullName = (person) =>
  [
    person?.first_name,
    person?.middle_name,
    person?.last_name,
    person?.suffix,
  ]
    .map((value) => normalizeComparableText(value))
    .filter(Boolean)
    .join("|");

const hasComparableName = (person) =>
  Boolean(
    normalizeComparableText(person?.first_name) &&
      normalizeComparableText(person?.last_name),
  );

const buildComparablePersonKey = (person) =>
  [
    normalizeComparableText(person?.first_name),
    normalizeComparableText(person?.middle_name),
    normalizeComparableText(person?.last_name),
    normalizeComparableText(person?.suffix),
  ].join("|");

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
  const normalizeContactNumber = (value) => String(value || "").replace(/\D/g, "");
  const normalizedLeft = normalizeContactNumber(leftValue);
  const normalizedRight = normalizeContactNumber(rightValue);

  return Boolean(normalizedLeft) && normalizedLeft === normalizedRight;
};

const buildDuplicateSuggestionPersonLabel = (person, fallbackLabel) => {
  const fullName = buildFullName(person);
  return fullName || fallbackLabel || "Unnamed person";
};

const buildDuplicateSuggestionMatchSummary = (match) => ({
  visibility: DUPLICATE_SUGGESTION_VISIBILITY.authorized,
  details_restricted: false,
  household_id: match.household_id,
  barangay_id: match.barangay_id,
  barangay_name: match.barangay_name || null,
  family_head_name: buildFullName({
    first_name: match.household_family_head_first_name,
    middle_name: match.household_family_head_middle_name,
    last_name: match.household_family_head_last_name,
    suffix: match.household_family_head_suffix,
  }),
  matched_as: match.matched_role,
  matched_person_name: buildFullName({
    first_name: match.matched_first_name,
    middle_name: match.matched_middle_name,
    last_name: match.matched_last_name,
    suffix: match.matched_suffix,
  }),
  matched_relationship_to_head: match.matched_relationship_to_head || null,
  matched_sex: match.matched_sex || null,
  matched_age_value: Number.isInteger(match.matched_age_value)
    ? match.matched_age_value
    : null,
  matched_age_unit: match.matched_age_unit || null,
  matched_contact_number: match.matched_contact_number || null,
  current_stay_type: match.current_stay_type || null,
  household_size: Number(match.household_size || 0),
  is_active: match.is_active !== false,
  registered_at: match.registered_at || null,
  match_confidence: match.match_confidence,
  match_reasons: match.match_reasons,
});

const buildRestrictedExternalBarangayDuplicateSuggestion = () => ({
  visibility: DUPLICATE_SUGGESTION_VISIBILITY.restrictedExternalBarangay,
  details_restricted: true,
});

const canViewDuplicateSuggestionMatch = ({ match, requester }) => {
  if (requester?.roleCode !== BARANGAY_ROLE_CODE) {
    return true;
  }

  return Boolean(
    requester.defaultBarangayId &&
      match?.barangay_id === requester.defaultBarangayId,
  );
};

const buildVisibleDuplicateSuggestionMatches = ({ matches, requester }) => {
  const authorizedMatches = [];
  let hasRestrictedExternalBarangayMatch = false;

  for (const match of matches) {
    if (canViewDuplicateSuggestionMatch({ match, requester })) {
      authorizedMatches.push(buildDuplicateSuggestionMatchSummary(match));
      continue;
    }

    hasRestrictedExternalBarangayMatch = true;
  }

  return [
    ...authorizedMatches,
    ...(hasRestrictedExternalBarangayMatch
      ? [buildRestrictedExternalBarangayDuplicateSuggestion()]
      : []),
  ];
};

const isCrossBarangayDuplicate = (duplicateMatch, barangayId) =>
  Boolean(
    duplicateMatch?.barangay_id &&
      barangayId &&
      String(duplicateMatch.barangay_id) !== String(barangayId),
  );

const buildDuplicateRegistrationError = (duplicateMatch, barangayId = null) => {
  const crossBarangay = isCrossBarangayDuplicate(duplicateMatch, barangayId);
  const error = new Error(
    crossBarangay
      ? "A similar household registration already exists under another Barangay and requires municipality-level review."
      : "Possible duplicate evacuee registration detected. Review the matched household before registering again.",
  );
  error.statusCode = 409;
  error.code = crossBarangay
    ? "POSSIBLE_CROSS_BARANGAY_HOUSEHOLD_DUPLICATE"
    : "DUPLICATE_HOUSEHOLD_REGISTRATION";
  error.entityServerId = duplicateMatch?.household_id || null;
  error.serverPayload = duplicateMatch
    ? buildDuplicateSuggestionMatchSummary(duplicateMatch)
    : null;
  if (crossBarangay) {
    error.duplicateRegistration = {
      match: duplicateMatch,
      barangay_id: barangayId,
      registration_data: null,
    };
  }
  return error;
};

const validateUniqueHouseholdPeople = ({ familyHead, members }) => {
  const familyHeadFullName = buildComparableFullName(familyHead);

  if (!familyHeadFullName) {
    return;
  }

  const seenMemberNames = new Map();

  for (const [memberIndex, member] of (members || []).entries()) {
    const memberFullName = buildComparableFullName(member);

    if (!memberFullName) {
      continue;
    }

    if (memberFullName === familyHeadFullName) {
      const error = new Error(
        "A household member cannot have the exact same full name as the family head.",
      );
      error.statusCode = 400;
      error.code = "DUPLICATE_HOUSEHOLD_MEMBER_NAME";
      throw error;
    }

    if (seenMemberNames.has(memberFullName)) {
      const error = new Error(
        "Household members cannot contain exact duplicate full names.",
      );
      error.statusCode = 400;
      error.code = "DUPLICATE_HOUSEHOLD_MEMBER_NAME";
      error.serverPayload = {
        duplicate_member_indexes: [
          seenMemberNames.get(memberFullName),
          memberIndex,
        ],
      };
      throw error;
    }

    seenMemberNames.set(memberFullName, memberIndex);
  }
};

const summarizePrivacyConsent = (consent) =>
  pickDefined(consent, [
    "id",
    "household_id",
    "disaster_event_id",
    "consent_status",
    "notice_version",
    "acknowledged_at",
    "representative_relationship",
    "recorded_by",
    "recorded_at",
    "device_id",
    "is_offline_encoded",
    "sync_status",
  ]);

const isCurrentHouseholdPrivacyConsent = (consent) => {
  if (!consent) {
    return false;
  }

  return (
    consent.consent_status === HOUSEHOLD_PRIVACY_CONSENT_STATUS.ACKNOWLEDGED &&
    consent.notice_version === HOUSEHOLD_PRIVACY_NOTICE_VERSION
  );
};

const shouldRequireHouseholdPrivacyRenewal = (consent) => {
  return !isCurrentHouseholdPrivacyConsent(consent);
};

const normalizeHouseholdPrivacyAcknowledgment = ({
  privacyAcknowledgment,
  familyHead,
  disasterEventId,
  recordedBy,
  syncedClientTimestamp = null,
}) => {
  if (!privacyAcknowledgment || typeof privacyAcknowledgment !== "object") {
    throw buildHouseholdPrivacyRequiredError();
  }

  const consentStatus = String(
    privacyAcknowledgment.consent_status || "",
  ).toUpperCase();
  const noticeVersion = String(
    privacyAcknowledgment.notice_version || "",
  ).trim();
  const acknowledgedAt = privacyAcknowledgment.acknowledged_at || null;
  const fallbackAcknowledgedName = buildFullName(familyHead);
  const acknowledgedByName = String(
    privacyAcknowledgment.acknowledged_by_name || fallbackAcknowledgedName,
  ).trim();
  const representativeRelationship = String(
    privacyAcknowledgment.representative_relationship || "",
  ).trim();

  if (consentStatus !== HOUSEHOLD_PRIVACY_CONSENT_STATUS.ACKNOWLEDGED) {
    throw buildHouseholdPrivacyRequiredError();
  }

  if (!noticeVersion) {
    const error = new Error(
      "Data Privacy Notice acknowledgment is required before the family can be registered.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (noticeVersion !== HOUSEHOLD_PRIVACY_NOTICE_VERSION) {
    const error = new Error(
      "Data Privacy Notice acknowledgment version is invalid or outdated.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (!isValidTimestampValue(acknowledgedAt)) {
    const error = new Error(
      "Data Privacy Notice acknowledgment timestamp is invalid.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (!acknowledgedByName) {
    const error = new Error(
      "Data Privacy Notice acknowledgment must identify the family head or representative.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (!recordedBy) {
    const error = new Error(
      "Data Privacy Notice acknowledgment must include the recording user.",
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    disaster_event_id: disasterEventId,
    consent_status: consentStatus,
    notice_version: noticeVersion,
    acknowledged_at: new Date(acknowledgedAt).toISOString(),
    acknowledged_by_name: acknowledgedByName,
    representative_relationship: representativeRelationship || null,
    recorded_by: recordedBy,
    device_id: privacyAcknowledgment.device_id || null,
    is_offline_encoded:
      Boolean(privacyAcknowledgment.is_offline_encoded) ||
      Boolean(syncedClientTimestamp),
    sync_status: HOUSEHOLD_PRIVACY_SYNC_STATUS.SYNCED,
  };
};

const buildPrivacyAuditActor = ({
  requester = null,
  recordedBy = null,
  roleCode = null,
  deviceId = null,
}) => {
  if (requester) {
    return {
      ...requester,
      deviceId: requester.deviceId || deviceId || null,
    };
  }

  return {
    userId: recordedBy,
    roleCode,
    deviceId: deviceId || null,
  };
};

const buildAgeSectorIdsByCode = (ageSectorRows = []) =>
  ageSectorRows.reduce((lookupByCode, sector) => {
    const canonicalCode =
      getCanonicalAgeSectorCodeFromValue(sector.code) ||
      getCanonicalAgeSectorCodeFromValue(sector.name);

    if (canonicalCode && !lookupByCode[canonicalCode]) {
      lookupByCode[canonicalCode] = sector.id;
    }

    return lookupByCode;
  }, {});

const validateSectorUsage = (
  householdSectors,
  memberSectors,
  requestData,
) => {
  const householdSectorIds = deduplicateIds(requestData.household_sector_ids || []);
  const familyHeadSectorIds = deduplicateIds(requestData.family_head.sector_ids || []);
  const memberSectorIds = deduplicateIds([
    ...familyHeadSectorIds,
    ...requestData.members.flatMap((member) => member.sector_ids || []),
  ]);

  if (householdSectorIds.length !== householdSectors.length) {
    const error = new Error("One or more household sector IDs are invalid");
    error.statusCode = 400;
    throw error;
  }

  if (memberSectorIds.length !== memberSectors.length) {
    const error = new Error("One or more member sector IDs are invalid");
    error.statusCode = 400;
    throw error;
  }

  const hasInvalidHouseholdSector = householdSectors.some(
    (sector) => !HOUSEHOLD_CONDITION_CODES.includes(sector.code),
  );

  if (hasInvalidHouseholdSector) {
    const error = new Error(
      "household_sector_ids must only contain allowed household conditions",
    );
    error.statusCode = 400;
    throw error;
  }

  const hasInvalidPersonSector = memberSectors.some(
    (sector) => !MANUAL_MEMBER_SECTOR_CODES.includes(sector.code),
  );

  if (hasInvalidPersonSector) {
    const error = new Error(
      "Member sector_ids must only contain allowed manual member sectors",
    );
    error.statusCode = 400;
    throw error;
  }
};

const buildPersonRecord = ({
  id,
  first_name,
  middle_name,
  last_name,
  suffix,
  sex,
  age_value,
  age_unit,
  relationship_to_head,
  sector_ids,
}) => {
  const derivedAgeSectorCode = deriveAgeGroup(age_value, age_unit);

  if (!derivedAgeSectorCode) {
    const error = new Error(
      `Invalid age_value and age_unit combination for ${first_name} ${last_name}`,
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    id: id || null,
    first_name,
    middle_name,
    last_name,
    suffix,
    sex,
    age_value,
    age_unit,
    age: age_unit === "YEARS" ? age_value : null,
    birth_date: null,
    civil_status: null,
    relationship_to_head,
    sector_ids: deduplicateIds(sector_ids || []),
    derived_age_sector_code: derivedAgeSectorCode,
    ...getMemberFlagsFromSectorCodes([]),
  };
};

const buildDuplicateLookupPeople = ({
  familyHead,
  members,
  contactNumber = null,
}) => {
  const lookupPeople = [];

  if (hasComparableName(familyHead)) {
    lookupPeople.push({
      person_key: "family_head",
      source_role: "FAMILY_HEAD",
      contact_number: contactNumber || null,
      ...familyHead,
    });
  }

  (members || []).forEach((member, index) => {
    if (!hasComparableName(member)) {
      return;
    }

    lookupPeople.push({
      person_key: `member_${index}`,
      source_role: "MEMBER",
      ...member,
    });
  });

  return lookupPeople;
};

const normalizeDuplicateLookupPerson = (person, defaults = {}) => ({
  first_name: String(person?.first_name || "").trim(),
  middle_name: String(person?.middle_name || "").trim() || null,
  last_name: String(person?.last_name || "").trim(),
  suffix: String(person?.suffix || "").trim() || null,
  sex: person?.sex || defaults.sex || null,
  age_value: Number.isInteger(person?.age_value) ? person.age_value : null,
  age_unit: person?.age_unit || defaults.age_unit || null,
  relationship_to_head:
    person?.relationship_to_head || defaults.relationship_to_head || null,
});

const buildDuplicateMatchReasons = ({
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

  if (matchedRole === "FAMILY_HEAD") {
    reasons.push("Matched as family head");
  } else {
    reasons.push("Matched as household member");
  }

  return reasons;
};

const classifyDuplicateMatch = ({
  sourcePerson,
  matchedPerson,
  sourceRole,
  matchedRole,
  sourceContactNumber = null,
  matchedContactNumber = null,
}) => {
  const isFamilyHeadSource = sourceRole === "FAMILY_HEAD";
  const sameExtendedName = hasSameExtendedName(sourcePerson, matchedPerson);
  const sameSex = hasSameComparableSex(sourcePerson, matchedPerson);
  const sameAge = hasSameComparableAge(sourcePerson, matchedPerson);
  const sameContact =
    isFamilyHeadSource &&
    hasSameComparableContactNumber(sourceContactNumber, matchedContactNumber);
  const strongMatch =
    sameExtendedName ||
    ((sameSex && sameAge) || sameContact);

  return {
    match_confidence: strongMatch ? "HIGH" : "POSSIBLE",
    is_strong_match: strongMatch,
    match_reasons: buildDuplicateMatchReasons({
      sourcePerson,
      matchedPerson,
      isFamilyHeadSource,
      matchedRole,
      sourceContactNumber,
      matchedContactNumber,
    }),
  };
};

const buildDuplicateRegistrationSuggestions = async ({
  disasterEventId,
  householdIdToExclude = null,
  familyHead,
  members,
  contactNumber = null,
  requester = null,
  dbClient = undefined,
}) => {
  const lookupPeople = buildDuplicateLookupPeople({
    familyHead,
    members,
    contactNumber,
  });

  if (lookupPeople.length === 0) {
    return {
      total_matches: 0,
      has_strong_matches: false,
      groups: [],
    };
  }

  const rawMatches =
    await householdRegistrationRepository.findPotentialDuplicatePersonMatches(
      {
        disasterEventId,
        householdIdToExclude,
        people: lookupPeople,
      },
      dbClient,
    );

  const sourcePeopleByKey = lookupPeople.reduce((lookup, person) => {
    lookup[person.person_key] = person;
    return lookup;
  }, {});
  const groupedMatches = rawMatches.reduce((lookup, match) => {
    const sourcePerson = sourcePeopleByKey[match.person_key];

    if (!sourcePerson) {
      return lookup;
    }

    const matchedPerson = {
      first_name: match.matched_first_name,
      middle_name: match.matched_middle_name,
      last_name: match.matched_last_name,
      suffix: match.matched_suffix,
      sex: match.matched_sex,
      age_value: Number.isInteger(match.matched_age_value)
        ? match.matched_age_value
        : null,
      age_unit: match.matched_age_unit,
    };
    const classifiedMatch = classifyDuplicateMatch({
      sourcePerson,
      matchedPerson,
      sourceRole: sourcePerson.source_role,
      matchedRole: match.matched_role,
      sourceContactNumber: sourcePerson.contact_number || null,
      matchedContactNumber: match.matched_contact_number || null,
    });

    const groupKey = match.person_key;
    const nextMatch = {
      ...match,
      ...classifiedMatch,
    };

    if (!lookup[groupKey]) {
      lookup[groupKey] = [];
    }

    const existingHouseholdMatch = lookup[groupKey].find(
      (candidate) =>
        candidate.household_id === nextMatch.household_id &&
        candidate.matched_role === nextMatch.matched_role,
    );

    if (!existingHouseholdMatch) {
      lookup[groupKey].push(nextMatch);
    }

    return lookup;
  }, {});

  const groups = lookupPeople.map((person, index) => {
    const sortedMatches = (groupedMatches[person.person_key] || [])
      .sort((leftMatch, rightMatch) => {
        if (leftMatch.is_strong_match !== rightMatch.is_strong_match) {
          return leftMatch.is_strong_match ? -1 : 1;
        }

        if (leftMatch.is_active !== rightMatch.is_active) {
          return leftMatch.is_active ? -1 : 1;
        }

        const leftTime = new Date(leftMatch.registered_at || 0).getTime();
        const rightTime = new Date(rightMatch.registered_at || 0).getTime();
        return rightTime - leftTime;
      });
    const matches = buildVisibleDuplicateSuggestionMatches({
      matches: sortedMatches,
      requester,
    });

    return {
      person_key: person.person_key,
      source_role: person.source_role,
      person_label: buildDuplicateSuggestionPersonLabel(
        person,
        person.source_role === "FAMILY_HEAD"
          ? "Family head"
          : `Member ${index}`,
      ),
      matches,
      has_strong_matches: matches.some(
        (match) => match.match_confidence === "HIGH",
      ),
    };
  });

  return {
    total_matches: groups.reduce(
      (totalMatches, group) => totalMatches + group.matches.length,
      0,
    ),
    has_strong_matches: groups.some((group) => group.has_strong_matches),
    groups: groups.filter((group) => group.matches.length > 0),
  };
};

const buildActiveCrossEventInformation = async ({
  disasterEventId,
  familyHead,
  contactNumber = null,
  dbClient = undefined,
}) => {
  let rawMatches = [];

  try {
    rawMatches =
      await householdRegistrationRepository.findActiveCrossEventFamilyHeadMatches(
        {
          disasterEventId,
          familyHead,
        },
        dbClient,
      );
  } catch (_error) {
    return null;
  }

  const activeEventsByTitle = new Map();

  for (const match of rawMatches) {
    const matchedPerson = {
      first_name: match.family_head_first_name,
      middle_name: match.family_head_middle_name,
      last_name: match.family_head_last_name,
      suffix: match.family_head_suffix,
      sex: match.sex,
      age_value: Number.isInteger(match.age_value) ? match.age_value : null,
      age_unit: match.age_unit,
    };
    const classifiedMatch = classifyDuplicateMatch({
      sourcePerson: familyHead,
      matchedPerson,
      sourceRole: "FAMILY_HEAD",
      matchedRole: "FAMILY_HEAD",
      sourceContactNumber: contactNumber,
      matchedContactNumber: match.contact_number || null,
    });

    if (classifiedMatch.match_confidence !== "HIGH") {
      continue;
    }

    const eventTitle = String(match.disaster_event_title || "").trim();

    if (eventTitle) {
      activeEventsByTitle.set(eventTitle, {
        disaster_event_title: eventTitle,
      });
    }
  }

  const activeEvents = [...activeEventsByTitle.values()];

  return {
    has_active_cross_event_match: activeEvents.length > 0,
    active_disaster_events: activeEvents,
  };
};

const buildRegistrationResponse = async (householdId, dbClient = undefined) => {
  const household =
    await householdRegistrationRepository.getHouseholdSummaryById(
      householdId,
      dbClient,
    );
  const includeInactiveMembers = household?.is_active === false;
  const members =
    await householdRegistrationRepository.getEvacueesByHouseholdId(
      householdId,
      {
        includeInactive: includeInactiveMembers,
        dbClient,
      },
    );
  const evacueeSectorAssignments =
    await householdRegistrationRepository.getEvacueeSectorAssignmentsByHouseholdId(
      householdId,
      {
        includeInactive: includeInactiveMembers,
        dbClient,
      },
    );
  const householdSectors =
    await householdRegistrationRepository.getHouseholdSectorAssignmentsByHouseholdId(
      householdId,
      dbClient,
    );
  const stub = await householdRegistrationRepository.getStubByHouseholdId(
    householdId,
    dbClient,
  );
  const latestAttendance =
    await householdRegistrationRepository.getLatestAttendanceByHouseholdId(
      householdId,
      dbClient,
    );
  const latestDistribution =
    await householdRegistrationRepository.getLatestDistributionTransactionByStubId(
      stub?.id || null,
      dbClient,
    );
  const latestPrivacyConsent =
    await householdRegistrationRepository.getLatestHouseholdPrivacyConsentByHouseholdId(
      householdId,
      dbClient,
    );

  const membersWithSectors = members.map((member) => {
    const sectorAssignments = evacueeSectorAssignments
      .filter((assignment) => assignment.evacuee_id === member.id)
      .map((assignment) => ({
        id: assignment.sector_id,
        code: assignment.code,
        name: assignment.name,
        description: assignment.description,
        sector_group: assignment.sector_group,
      }));

    return {
      ...member,
      sectors: sectorAssignments,
    };
  });

  return {
    household,
    members: membersWithSectors,
    household_sectors: householdSectors,
    privacy_consent: latestPrivacyConsent,
    privacy_notice_version: HOUSEHOLD_PRIVACY_NOTICE_VERSION,
    stub,
    latest_attendance: latestAttendance,
    distribution_transaction: latestDistribution,
    members_count: members.length,
  };
};

const summarizeHousehold = (household) =>
  pickDefined(household, [
    "disaster_event_id",
    "barangay_id",
    "evacuation_center_id",
    "residency_status",
    "family_head_first_name",
    "family_head_last_name",
    "contact_number",
    "current_stay_type",
    "current_address_details",
    "household_size",
    "family_head_photo_url",
    "photo_verification_notes",
    "is_active",
  ]);

const summarizeMember = (member) => ({
  id: member.id,
  ...pickDefined(member, [
    "household_id",
    "first_name",
    "last_name",
    "relationship_to_head",
    "age_value",
    "age_unit",
    "is_active",
  ]),
});

const summarizeEvacuationLog = (log) =>
  pickDefined(log, [
    "household_id",
    "evacuee_id",
    "evacuation_center_id",
    "time_in",
    "time_out",
    "status",
    "remarks",
  ]);

const isNonAdmittedResidentRecord = ({
  residency_status,
  current_stay_type,
}) => {
  return (
    residency_status === RESIDENCY_STATUSES.resident &&
    NON_ADMITTED_RESIDENT_STAY_TYPES.has(current_stay_type)
  );
};

const resolveSingleActiveEvacuationCenterId = async (barangayId) => {
  if (!barangayId) {
    return null;
  }

  const evacuationCenters =
    await householdRegistrationRepository.getActiveEvacuationCentersByBarangayId(
      barangayId,
    );

  return evacuationCenters.length === 1 ? evacuationCenters[0].id : null;
};

const assertReAdmissionSourceHousehold = async ({
  sourceHouseholdId,
  registrationData,
  dbClient,
}) => {
  const sourceHousehold =
    await householdRegistrationRepository.getHouseholdSummaryByIdForUpdate(
      sourceHouseholdId,
      dbClient,
    );

  if (!sourceHousehold) {
    const error = new Error("The archived household selected for re-admission was not found.");
    error.statusCode = 404;
    error.code = "RE_ADMISSION_SOURCE_NOT_FOUND";
    throw error;
  }

  if (
    sourceHousehold.disaster_event_id !== registrationData.disaster_event_id ||
    sourceHousehold.barangay_id !== registrationData.barangay_id
  ) {
    const error = new Error(
      "The archived household must belong to the selected disaster event and barangay.",
    );
    error.statusCode = 400;
    error.code = "RE_ADMISSION_SOURCE_CONTEXT_MISMATCH";
    throw error;
  }

  if (sourceHousehold.is_active !== false) {
    const error = new Error(
      "Only an archived household occurrence can be re-admitted.",
    );
    error.statusCode = 400;
    error.code = "RE_ADMISSION_SOURCE_NOT_ARCHIVED";
    throw error;
  }

  const activeEvacuationLogs =
    await householdRegistrationRepository.getActiveEvacuationLogsByHouseholdId(
      sourceHouseholdId,
      dbClient,
    );

  if (activeEvacuationLogs.length > 0) {
    const error = new Error("This household is already admitted.");
    error.statusCode = 400;
    error.code = "HOUSEHOLD_ALREADY_ADMITTED";
    throw error;
  }

  const activeSuccessor =
    await householdRegistrationRepository.getActiveHouseholdSuccessorById(
      sourceHouseholdId,
      dbClient,
    );

  if (activeSuccessor) {
    const error = new Error("This household is already admitted.");
    error.statusCode = 400;
    error.code = "HOUSEHOLD_ALREADY_ADMITTED";
    throw error;
  }

  return sourceHousehold;
};

const buildReturnRegistrationRequest = async ({
  householdDetails,
  existingHousehold,
  requester,
  restoreData,
}) => {
  const familyHeadMember = (householdDetails.members || []).find(
    (member) => member.is_family_head,
  );

  if (!familyHeadMember) {
    const error = new Error(
      "Family head details are missing and the household cannot be returned",
    );
    error.statusCode = 400;
    throw error;
  }

  if (!isCurrentHouseholdPrivacyConsent(householdDetails.privacy_consent)) {
    const error = new Error(
      "A valid Data Privacy Notice acknowledgment is required before this household can be returned.",
    );
    error.statusCode = 400;
    throw error;
  }

  const filterManualSectorIds = (member) =>
    (member?.sectors || [])
      .filter((sector) => MANUAL_MEMBER_SECTOR_CODES.includes(sector.code))
      .map((sector) => sector.id);
  const inferredEvacuationCenterId = isNonAdmittedResidentRecord(existingHousehold)
    ? await resolveSingleActiveEvacuationCenterId(existingHousehold.barangay_id)
    : null;

  return {
    disaster_event_id: existingHousehold.disaster_event_id,
    barangay_id: existingHousehold.barangay_id,
    evacuation_center_id: isNonAdmittedResidentRecord(existingHousehold)
      ? inferredEvacuationCenterId
      : existingHousehold.evacuation_center_id,
    residency_status: existingHousehold.residency_status,
    contact_number: existingHousehold.contact_number || null,
    current_stay_type: isNonAdmittedResidentRecord(existingHousehold)
      ? "EVAC_CENTER"
      : existingHousehold.current_stay_type,
    current_address_details: existingHousehold.current_address_details || null,
    household_size: (householdDetails.members || []).length,
    household_sector_ids: (householdDetails.household_sectors || []).map(
      (sector) => sector.id,
    ),
    family_head_photo_url: existingHousehold.family_head_photo_url || null,
    photo_verification_notes: existingHousehold.photo_verification_notes || null,
    registered_by: requester?.userId || existingHousehold.registered_by || null,
    family_head: {
      first_name: familyHeadMember.first_name,
      middle_name: familyHeadMember.middle_name,
      last_name: familyHeadMember.last_name,
      suffix: familyHeadMember.suffix,
      sex: familyHeadMember.sex,
      age_value: familyHeadMember.age_value,
      age_unit: familyHeadMember.age_unit,
      sector_ids: filterManualSectorIds(familyHeadMember),
    },
    members: (householdDetails.members || [])
      .filter((member) => !member.is_family_head)
      .map((member) => ({
        first_name: member.first_name,
        middle_name: member.middle_name,
        last_name: member.last_name,
        suffix: member.suffix,
        sex: member.sex,
        age_value: member.age_value,
        age_unit: member.age_unit,
        relationship_to_head: member.relationship_to_head,
        sector_ids: filterManualSectorIds(member),
      })),
    privacy_acknowledgment: {
      consent_status: householdDetails.privacy_consent.consent_status,
      notice_version: householdDetails.privacy_consent.notice_version,
      acknowledged_at: householdDetails.privacy_consent.acknowledged_at,
      acknowledged_by_name:
        householdDetails.privacy_consent.acknowledged_by_name ||
        buildFullName({
          first_name: familyHeadMember.first_name,
          middle_name: familyHeadMember.middle_name,
          last_name: familyHeadMember.last_name,
          suffix: familyHeadMember.suffix,
        }),
      representative_relationship:
        householdDetails.privacy_consent.representative_relationship || null,
      device_id: householdDetails.privacy_consent.device_id || null,
      is_offline_encoded:
        householdDetails.privacy_consent.is_offline_encoded === true,
      sync_status: householdDetails.privacy_consent.sync_status || null,
    },
    restore_remarks: restoreData.restore_remarks || null,
  };
};

const prepareRegistrationContext = async (requestData) => {
  const disasterEvent =
    await householdRegistrationRepository.getDisasterEventById(
      requestData.disaster_event_id,
    );

  if (!disasterEvent) {
    const error = new Error("disaster_event_id is invalid");
    error.statusCode = 400;
    throw error;
  }

  const isNonResident =
    requestData.residency_status === RESIDENCY_STATUSES.nonResident;
  let handlingBarangayId = requestData.barangay_id;
  let userScope = null;

  if (requestData.registered_by) {
    userScope =
      await householdRegistrationRepository.getUserBarangayScopeById(
        requestData.registered_by,
      );
  }

  const isBarangayUser = userScope?.role_code === BARANGAY_ROLE_CODE;
  const isBarangayScopedRegistration =
    isBarangayUser && Boolean(userScope.default_barangay_id);

  if (isBarangayUser && !userScope.default_barangay_id) {
    const error = new Error(
      "Barangay registrations require an assigned barangay account.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (isBarangayScopedRegistration) {
    if (requestData.barangay_id !== userScope.default_barangay_id) {
      const error = new Error(
        "Barangay registrations must use the account's assigned barangay.",
      );
      error.statusCode = 400;
      throw error;
    }

    handlingBarangayId = userScope.default_barangay_id;
  }

  const registrationData = {
    ...requestData,
    barangay_id: handlingBarangayId,
  };
  const barangay = await householdRegistrationRepository.getBarangayById(
    registrationData.barangay_id,
  );

  if (!barangay || barangay.code === NON_RESIDENT_BARANGAY_CODE) {
    const error = new Error("barangay_id must reference a valid handling barangay");
    error.statusCode = 400;
    throw error;
  }

  const disasterEventBarangayLink =
    await householdRegistrationRepository.getDisasterEventBarangayLink(
      registrationData.disaster_event_id,
      registrationData.barangay_id,
    );

  if (!disasterEventBarangayLink) {
    const error = new Error(
      "Selected disaster event is not linked to the chosen barangay.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (
    isNonResident &&
    isBarangayScopedRegistration &&
    registrationData.current_stay_type &&
    registrationData.current_stay_type !== "EVAC_CENTER"
  ) {
    const error = new Error(
      "Non-resident Barangay registrations must use Evacuation Center stay.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (
    isNonResident &&
    isBarangayScopedRegistration &&
    requestData.current_stay_type === "EVAC_CENTER" &&
    !registrationData.evacuation_center_id
  ) {
    const error = new Error(
      "Non-resident Barangay registrations require an evacuation center.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (requestData.evacuation_center_id) {
    const evacuationCenter =
      await householdRegistrationRepository.getEvacuationCenterById(
        requestData.evacuation_center_id,
      );

    if (!evacuationCenter || !evacuationCenter.is_active) {
      const error = new Error("evacuation_center_id is invalid");
      error.statusCode = 400;
      throw error;
    }

    if (evacuationCenter.barangay_id !== registrationData.barangay_id) {
      const error = new Error(
        "Selected evacuation center must belong to the chosen barangay",
      );
      error.statusCode = 400;
      throw error;
    }
  }

  return {
    disasterEvent,
    barangay,
    userScope,
    isBarangayUser,
    isBarangayScopedRegistration,
    isNonResident,
    registrationData,
  };
};

const getHouseholdDetails = async ({
  householdId,
  evacuationLogId = null,
  requester,
}) => {
  const household =
    await householdRegistrationRepository.getHouseholdSummaryById(householdId);

  if (!household) {
    const error = new Error("Household not found");
    error.statusCode = 404;
    throw error;
  }

  if (
    requester?.roleCode === BARANGAY_ROLE_CODE &&
    household.barangay_id !== requester.defaultBarangayId
  ) {
    const error = new Error("You do not have access to this household");
    error.statusCode = 403;
    throw error;
  }

  const householdDetails = await buildRegistrationResponse(householdId);

  if (!evacuationLogId) {
    return householdDetails;
  }

  const selectedAttendance =
    await householdRegistrationRepository.getEvacuationLogByIdForHousehold(
      householdId,
      evacuationLogId,
    );

  if (!selectedAttendance) {
    const error = new Error("Selected evacuation record not found for this household");
    error.statusCode = 404;
    throw error;
  }

  return {
    ...householdDetails,
    latest_attendance: selectedAttendance,
  };
};

const getAuthorizedHouseholdSummaryForUpdate = async ({
  householdId,
  requester,
  dbClient = null,
}) => {
  const existingHousehold =
    await householdRegistrationRepository.getHouseholdSummaryById(
      householdId,
      dbClient || undefined,
    );

  if (!existingHousehold) {
    const error = new Error("Household not found");
    error.statusCode = 404;
    throw error;
  }

  if (
    requester?.roleCode === BARANGAY_ROLE_CODE &&
    existingHousehold.barangay_id !== requester.defaultBarangayId
  ) {
    const error = new Error("You do not have access to update this household");
    error.statusCode = 403;
    throw error;
  }

  return existingHousehold;
};

const getDuplicateRegistrationSuggestions = async (requestData) => {
  const { registrationData } = await prepareRegistrationContext(requestData);

  const familyHead = requestData.family_head
    ? normalizeDuplicateLookupPerson(requestData.family_head, {
        relationship_to_head: "HEAD",
        age_unit: "YEARS",
      })
    : null;
  const members = Array.isArray(requestData.members)
    ? requestData.members.map((member) => normalizeDuplicateLookupPerson(member))
    : [];

  return buildDuplicateRegistrationSuggestions({
    disasterEventId: registrationData.disaster_event_id,
    householdIdToExclude: requestData.household_id || null,
    familyHead,
    members,
    contactNumber: requestData.contact_number || null,
    requester: requestData.requester || null,
  });
};

const updateHouseholdDetails = async ({
  householdId,
  requester,
  requestData,
  dbClient = null,
}) => {
  const existingHousehold = await getAuthorizedHouseholdSummaryForUpdate({
    householdId,
    requester,
    dbClient,
  });

  assertHouseholdUpdateDisasterEventActive(existingHousehold);

  if (requestData.disaster_event_id !== existingHousehold.disaster_event_id) {
    const error = new Error("disaster_event_id cannot be changed");
    error.statusCode = 400;
    throw error;
  }

  if (requestData.barangay_id !== existingHousehold.barangay_id) {
    const error = new Error("barangay_id cannot be changed");
    error.statusCode = 400;
    throw error;
  }

  if (
    !existingHousehold.is_active &&
    !isNonAdmittedResidentRecord(existingHousehold)
  ) {
    const error = new Error("Archived households cannot be edited");
    error.statusCode = 400;
    error.code = "HISTORICAL_HOUSEHOLD_IMMUTABLE";
    throw error;
  }

  const latestPrivacyConsent =
    await householdRegistrationRepository.getLatestHouseholdPrivacyConsentByHouseholdId(
      householdId,
    );
  const existingMembers =
    await householdRegistrationRepository.getEvacueesByHouseholdId(householdId, {
      includeInactive: existingHousehold.is_active === false,
    });
  const existingFamilyHeadMember = existingMembers.find(
    (member) =>
      member.is_family_head || member.id === existingHousehold.family_head_evacuee_id,
  );
  const existingEvacueeSectorAssignments =
    await householdRegistrationRepository.getEvacueeSectorAssignmentsByHouseholdId(
      householdId,
      {
        includeInactive: existingHousehold.is_active === false,
      },
    );
  const familyHeadSectorAssignments = existingEvacueeSectorAssignments.filter(
    (assignment) => assignment.evacuee_id === existingHousehold.family_head_evacuee_id,
  );

  assertNoProtectedFamilyHeadChanges({
    requestData,
    existingHousehold,
    existingFamilyHeadMember,
    familyHeadSectorAssignments,
  });

  const allowedUpdateData = sanitizeHouseholdUpdateRequestData(requestData);
  const requiresPrivacyRenewal =
    shouldRequireHouseholdPrivacyRenewal(latestPrivacyConsent);
  const normalizedPrivacyRenewal = requiresPrivacyRenewal
    ? normalizeHouseholdPrivacyAcknowledgment({
        privacyAcknowledgment: allowedUpdateData.privacy_acknowledgment,
        familyHead: {
          first_name: existingHousehold.family_head_first_name,
          middle_name: existingHousehold.family_head_middle_name,
          last_name: existingHousehold.family_head_last_name,
          suffix: existingHousehold.family_head_suffix,
        },
        disasterEventId: allowedUpdateData.disaster_event_id,
        recordedBy: requester?.userId || allowedUpdateData.registered_by || null,
      })
    : null;
  const previousHouseholdSummary = summarizeHousehold(existingHousehold);

  const normalizedMembers = allowedUpdateData.members.map((member) =>
    buildPersonRecord(member),
  );
  const normalizedExistingFamilyHead = {
    first_name: existingHousehold.family_head_first_name,
    middle_name: existingHousehold.family_head_middle_name,
    last_name: existingHousehold.family_head_last_name,
    suffix: existingHousehold.family_head_suffix,
  };

  validateUniqueHouseholdPeople({
    familyHead: normalizedExistingFamilyHead,
    members: normalizedMembers,
  });

  const requestDataWithDerivedAgeGroups = {
    ...allowedUpdateData,
    members: normalizedMembers,
    current_address_details: allowedUpdateData.current_address_details || null,
    contact_number: allowedUpdateData.contact_number || null,
  };

  const householdSectors = await householdRegistrationRepository.getSectorsByIds(
    deduplicateIds(requestDataWithDerivedAgeGroups.household_sector_ids),
  );
  const memberSectors = await householdRegistrationRepository.getSectorsByIds(
    deduplicateIds([
      ...requestDataWithDerivedAgeGroups.members.flatMap(
        (member) => member.sector_ids || [],
      ),
    ]),
  );
  const ageSectorRows = await householdRegistrationRepository.getSectorsByCodes(
    buildAgeSectorLookupCodes([
      ...requestDataWithDerivedAgeGroups.members.map(
        (member) => member.derived_age_sector_code,
      ),
    ]),
  );
  const expectedAgeSectorCodes = deduplicateIds([
    ...requestDataWithDerivedAgeGroups.members.map(
      (member) => member.derived_age_sector_code,
    ),
  ].map(getCanonicalMemberSectorCode));

  validateSectorUsage(
    householdSectors,
    memberSectors,
    {
      ...requestDataWithDerivedAgeGroups,
      family_head: {
        sector_ids: [],
      },
    },
  );

  let ageSectorIdsByCode = buildAgeSectorIdsByCode(ageSectorRows);

  if (
    expectedAgeSectorCodes.some(
      (sectorCode) => !ageSectorIdsByCode[sectorCode],
    )
  ) {
    const fallbackAgeSectorRows =
      await householdRegistrationRepository.getAgeGroupSectors();
    ageSectorIdsByCode = {
      ...buildAgeSectorIdsByCode(fallbackAgeSectorRows),
      ...ageSectorIdsByCode,
    };
  }

  if (
    expectedAgeSectorCodes.some(
      (sectorCode) => !ageSectorIdsByCode[sectorCode],
    )
  ) {
    const error = new Error(
      "One or more derived age-based sectors are missing from the sector master list",
    );
    error.statusCode = 500;
    throw error;
  }

  const existingMembersById = new Map(
    existingMembers.map((member) => [member.id, member]),
  );
  const existingNonHeadMembers = existingMembers.filter(
    (member) => !member.is_family_head,
  );
  const deactivatedMemberSummaries = [];
  const incomingExistingMemberIds = new Set(
    allowedUpdateData.members
      .map((member) => member.id)
      .filter(Boolean),
  );
  const shouldKeepMembersArchived = existingHousehold.is_active === false;

  const externalClient = dbClient;
  const client = externalClient || await pool.connect();

  try {
    if (!externalClient) {
      await client.query("BEGIN");
    }

    const updatedHousehold = await householdRegistrationRepository.updateHousehold(
      householdId,
      {
        ...requestDataWithDerivedAgeGroups,
        household_size:
          requestDataWithDerivedAgeGroups.members.length + 1,
      },
      client,
    );

    if (!updatedHousehold) {
      const error = new Error("Archived households cannot be edited");
      error.statusCode = 400;
      error.code = "HISTORICAL_HOUSEHOLD_IMMUTABLE";
      throw error;
    }

    for (const existingMember of existingNonHeadMembers) {
      if (incomingExistingMemberIds.has(existingMember.id)) {
        continue;
      }

      await householdRegistrationRepository.deleteEvacueeSectorsByEvacueeId(
        existingMember.id,
        client,
      );
      await householdRegistrationRepository.deactivateEvacuee(
        existingMember.id,
        client,
      );
      deactivatedMemberSummaries.push(summarizeMember(existingMember));
    }

    const activeEvacuationLogs =
      await householdRegistrationRepository.getActiveEvacuationLogsByHouseholdId(
        householdId,
        client,
      );
    const activeAttendanceSeed = activeEvacuationLogs[0] || null;

    for (const member of requestDataWithDerivedAgeGroups.members) {
      const memberSectorRows = memberSectors.filter((sector) =>
        member.sector_ids.includes(sector.id),
      );
      const memberSectorCodes = memberSectorRows.map((sector) => sector.code);
      const preparedMember = {
        ...member,
        is_family_head: false,
        is_active: !shouldKeepMembersArchived,
        ...getMemberFlagsFromSectorCodes(memberSectorCodes),
      };

      let savedMember = null;

      if (member.id) {
        if (!existingMembersById.has(member.id)) {
          const error = new Error("One or more members do not belong to this household");
          error.statusCode = 400;
          throw error;
        }

        savedMember = await householdRegistrationRepository.updateEvacuee(
          member.id,
          preparedMember,
          client,
        );
      } else {
        savedMember = await householdRegistrationRepository.insertEvacuee(
          householdId,
          preparedMember,
          client,
        );

        if (activeAttendanceSeed) {
          await householdRegistrationRepository.insertEvacuationLog(
            {
              disaster_event_id: requestDataWithDerivedAgeGroups.disaster_event_id,
              household_id: householdId,
              evacuee_id: savedMember.id,
              evacuation_center_id: activeAttendanceSeed.evacuation_center_id,
              status: "PRESENT",
              recorded_by: requester?.userId || requestDataWithDerivedAgeGroups.registered_by,
              remarks: "Automatic arrival recorded during household update",
            },
            client,
          );
        }
      }

      await householdRegistrationRepository.deleteEvacueeSectorsByEvacueeId(
        savedMember.id,
        client,
      );

      const assignedSectorIds = deduplicateIds([
        ageSectorIdsByCode[preparedMember.derived_age_sector_code],
        ...preparedMember.sector_ids,
      ]).filter(Boolean);

      if (assignedSectorIds.length > 0) {
        await householdRegistrationRepository.insertEvacueeSectors(
          savedMember.id,
          assignedSectorIds,
          client,
        );
      }
    }

    await householdRegistrationRepository.deleteHouseholdSectorsByHouseholdId(
      householdId,
      client,
    );

    if (requestDataWithDerivedAgeGroups.household_sector_ids.length > 0) {
      await householdRegistrationRepository.insertHouseholdSectors(
        householdId,
        deduplicateIds(requestDataWithDerivedAgeGroups.household_sector_ids),
        client,
      );
    }

    let savedPrivacyRenewal = null;

    if (normalizedPrivacyRenewal) {
      try {
        savedPrivacyRenewal =
          await householdRegistrationRepository.insertHouseholdPrivacyConsent(
            {
              ...normalizedPrivacyRenewal,
              household_id: householdId,
            },
            client,
          );
      } catch (error) {
        throw buildHouseholdPrivacySaveFailedError(error);
      }
    }

    if (!externalClient) {
      await client.query("COMMIT");
    }
    const householdDetails = await buildRegistrationResponse(
      householdId,
      externalClient || undefined,
    );
    const familyHeadName = [
      householdDetails.household?.family_head_first_name,
      householdDetails.household?.family_head_last_name,
    ]
      .filter(Boolean)
      .join(" ");

    if (!externalClient) {
      await notificationService.emitSafely(() =>
        notificationService.emitHouseholdRegistrationUpdate({
          householdId,
          barangayId: requestDataWithDerivedAgeGroups.barangay_id,
          familyHeadName,
          action: "updated",
          requiresVerification: !householdDetails.household?.family_head_photo_url,
        }),
      );

      await logAuditSafely({
        actor: requester,
        action: "HOUSEHOLD_UPDATE",
        entityType: "HOUSEHOLD",
        entityId: householdId,
        oldValues: previousHouseholdSummary,
        newValues: summarizeHousehold(householdDetails.household),
      });
    }

    if (savedPrivacyRenewal && !externalClient) {
      await logAuditSafely({
        actor: buildPrivacyAuditActor({
          requester,
          deviceId: savedPrivacyRenewal.device_id,
        }),
        action: "HOUSEHOLD_PRIVACY_ACKNOWLEDGED",
        entityType: "HOUSEHOLD_PRIVACY_CONSENT",
        entityId: savedPrivacyRenewal.id,
        oldValues: {},
        newValues: summarizePrivacyConsent(savedPrivacyRenewal),
      });
    }

    for (const deactivatedMember of deactivatedMemberSummaries) {
      if (externalClient) {
        break;
      }
      await logAuditSafely({
        actor: requester,
        action: "HOUSEHOLD_MEMBER_DEACTIVATE",
        entityType: "EVACUEE",
        entityId: deactivatedMember.id,
        oldValues: {
          ...deactivatedMember,
          is_active: true,
        },
        newValues: {
          ...deactivatedMember,
          is_active: false,
        },
      });
    }

    return householdDetails;
  } catch (error) {
    if (!externalClient) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    if (!externalClient) {
      client.release();
    }
  }
};

const getStrongestDuplicateRegistrationMatch = async ({
  disasterEventId,
  familyHead,
  members,
  contactNumber = null,
  dbClient = undefined,
}) => {
  const duplicateSuggestions = await buildDuplicateRegistrationSuggestions({
    disasterEventId,
    familyHead,
    members,
    contactNumber,
    dbClient,
  });

  return duplicateSuggestions.groups
    .flatMap((group) => group.matches)
    .find((match) => match.match_confidence === "HIGH") || null;
};

const handleDuplicateRegistrationMatch = async ({
  match,
  registrationData,
  dbClient = undefined,
}) => {
  if (!match) {
    return null;
  }

  if (
    isCrossBarangayDuplicate(match, registrationData.barangay_id) &&
    !registrationData.allow_reviewed_cross_barangay_duplicate
  ) {
    const error = buildDuplicateRegistrationError(match, registrationData.barangay_id);
    error.duplicateRegistration.registration_data = registrationData;
    throw error;
  }

  if (
    isCrossBarangayDuplicate(match, registrationData.barangay_id) &&
    registrationData.allow_reviewed_cross_barangay_duplicate
  ) {
    return null;
  }

  if (
    registrationData.enforce_sync_duplicate_guard &&
    registrationData.synced_client_timestamp &&
    isEarlierTimestamp(
      registrationData.synced_client_timestamp,
      match.registered_at,
    )
  ) {
    const updatedHousehold =
      await householdRegistrationRepository.updateHouseholdRegistrationTimestamp(
        match.household_id,
        registrationData.synced_client_timestamp,
        dbClient,
      );

    if (!updatedHousehold) {
      const error = new Error("Archived households cannot be modified");
      error.statusCode = 400;
      error.code = "HISTORICAL_HOUSEHOLD_IMMUTABLE";
      throw error;
    }

    return match.household_id;
  }

  throw buildDuplicateRegistrationError(match);
};

const reconcileCrossBarangayDuplicateWithEarlierRegistration = async ({
  householdId,
  registrationData,
  dbClient,
}) => {
  if (
    !householdId ||
    !registrationData?.registered_at ||
    !isValidTimestampValue(registrationData.registered_at)
  ) {
    return null;
  }

  const updatedHousehold =
    await householdRegistrationRepository.replaceHouseholdRegistrationAuthority(
      householdId,
      registrationData,
      dbClient,
    );

  if (!updatedHousehold) {
    return null;
  }

  if (updatedHousehold.family_head_evacuee_id) {
    await householdRegistrationRepository.updateEvacuee(
      updatedHousehold.family_head_evacuee_id,
      {
        ...registrationData.family_head,
        is_family_head: true,
        is_active: true,
      },
      dbClient,
    );
  }

  return buildRegistrationResponse(householdId, dbClient);
};

const registerHousehold = async (
  requestData,
  { dbClient = null, operation = null, sourceHouseholdId = null } = {},
) => {
  const effectiveDbClient = dbClient || requestData.dbClient || null;
  const requestedRegistrationOperation = String(
    requestData.registration_operation || "",
  )
    .trim()
    .toUpperCase();
  const effectiveSourceHouseholdId =
    sourceHouseholdId || requestData.re_admission_source_household_id || null;
  const isReAdmissionRequest =
    operation === "RE_ADMISSION" ||
    requestedRegistrationOperation === NEW_HOUSEHOLD_OCCURRENCE_OPERATION;
  if (isReAdmissionRequest && !effectiveSourceHouseholdId) {
    const error = new Error(
      "An archived household source is required for re-admission registration.",
    );
    error.statusCode = 400;
    error.code = "RE_ADMISSION_SOURCE_REQUIRED";
    throw error;
  }
  const registrationContextRequest = effectiveDbClient
    ? { ...requestData, dbClient: effectiveDbClient }
    : requestData;
  const isReAdmissionClone =
    isReAdmissionRequest && Boolean(effectiveSourceHouseholdId);
  const {
    userScope,
    isNonResident,
    isBarangayScopedRegistration,
    registrationData,
  } = await prepareRegistrationContext(registrationContextRequest);

  if (requestData.household_size !== requestData.members.length + 1) {
    const error = new Error(
      "household_size must match the family head plus the submitted additional members",
    );
    error.statusCode = 400;
    throw error;
  }

  if (requestData.family_head.age_unit !== "YEARS") {
    const error = new Error("Family head age must be encoded in years");
    error.statusCode = 400;
    throw error;
  }

  const normalizedFamilyHead = buildPersonRecord({
    ...requestData.family_head,
    ...(isReAdmissionClone ? { id: null } : {}),
    relationship_to_head: "HEAD",
  });

  const normalizedMembers = requestData.members.map((member) =>
    buildPersonRecord(
      isReAdmissionClone ? { ...member, id: null } : member,
    ),
  );

  validateUniqueHouseholdPeople({
    familyHead: normalizedFamilyHead,
    members: normalizedMembers,
  });

  const requestDataWithDerivedAgeGroups = {
    ...registrationData,
    registered_at: registrationData.synced_client_timestamp || null,
    family_head_photo_url: registrationData.family_head_photo_url || null,
    photo_captured_at: registrationData.family_head_photo_url
      ? new Date().toISOString()
      : null,
    photo_captured_by: registrationData.family_head_photo_url
      ? registrationData.registered_by
      : null,
    photo_verification_notes: registrationData.photo_verification_notes || null,
    family_head: {
      ...normalizedFamilyHead,
      birth_date: null,
      contact_number: registrationData.contact_number || null,
    },
    members: normalizedMembers,
    current_address_details: registrationData.current_address_details || null,
    contact_number: registrationData.contact_number || null,
  };
  const normalizedPrivacyAcknowledgment =
    normalizeHouseholdPrivacyAcknowledgment({
      privacyAcknowledgment: registrationData.privacy_acknowledgment,
      familyHead: requestDataWithDerivedAgeGroups.family_head,
      disasterEventId: requestDataWithDerivedAgeGroups.disaster_event_id,
      recordedBy: requestDataWithDerivedAgeGroups.registered_by,
      syncedClientTimestamp: registrationData.synced_client_timestamp || null,
    });
  const shouldAutoArchiveWithoutAttendance =
    isNonAdmittedResidentRecord(requestDataWithDerivedAgeGroups);
  const precheckDuplicateMatch = isReAdmissionClone ||
    registrationData.allow_reviewed_cross_barangay_duplicate
    ? null
    : await getStrongestDuplicateRegistrationMatch({
        disasterEventId: requestDataWithDerivedAgeGroups.disaster_event_id,
        familyHead: requestDataWithDerivedAgeGroups.family_head,
        members: requestDataWithDerivedAgeGroups.members,
        contactNumber: requestDataWithDerivedAgeGroups.contact_number || null,
      });

  if (
    precheckDuplicateMatch &&
    !(
      registrationData.enforce_sync_duplicate_guard &&
      registrationData.synced_client_timestamp &&
      isEarlierTimestamp(
        registrationData.synced_client_timestamp,
        precheckDuplicateMatch.registered_at,
      )
    )
  ) {
    throw buildDuplicateRegistrationError(
      precheckDuplicateMatch,
      registrationData.barangay_id,
    );
  }

  const householdSectors = await householdRegistrationRepository.getSectorsByIds(
    deduplicateIds(requestDataWithDerivedAgeGroups.household_sector_ids),
  );
  const memberSectors = await householdRegistrationRepository.getSectorsByIds(
    deduplicateIds([
      ...(requestDataWithDerivedAgeGroups.family_head.sector_ids || []),
      ...requestDataWithDerivedAgeGroups.members.flatMap(
        (member) => member.sector_ids,
      ),
    ]),
  );

  const ageSectorRows = await householdRegistrationRepository.getSectorsByCodes(
    buildAgeSectorLookupCodes([
      requestDataWithDerivedAgeGroups.family_head.derived_age_sector_code,
      ...requestDataWithDerivedAgeGroups.members.map(
        (member) => member.derived_age_sector_code,
      ),
    ]),
  );

  const expectedAgeSectorCodes = deduplicateIds([
    requestDataWithDerivedAgeGroups.family_head.derived_age_sector_code,
    ...requestDataWithDerivedAgeGroups.members.map(
      (member) => member.derived_age_sector_code,
    ),
  ].map(getCanonicalMemberSectorCode));

  validateSectorUsage(
    householdSectors,
    memberSectors,
    requestDataWithDerivedAgeGroups,
  );

  let ageSectorIdsByCode = buildAgeSectorIdsByCode(ageSectorRows);

  if (
    expectedAgeSectorCodes.some(
      (sectorCode) => !ageSectorIdsByCode[sectorCode],
    )
  ) {
    const fallbackAgeSectorRows =
      await householdRegistrationRepository.getAgeGroupSectors();
    ageSectorIdsByCode = {
      ...buildAgeSectorIdsByCode(fallbackAgeSectorRows),
      ...ageSectorIdsByCode,
    };
  }

  if (
    expectedAgeSectorCodes.some(
      (sectorCode) => !ageSectorIdsByCode[sectorCode],
    )
  ) {
    const error = new Error(
      "One or more derived age-based sectors are missing from the sector master list",
    );
    error.statusCode = 500;
    throw error;
  }

  const externalClient = effectiveDbClient;
  const client = externalClient || await pool.connect();

  try {
    if (!externalClient) {
      await client.query("BEGIN");
    }

    const lockedScope =
      await householdRegistrationRepository.lockHouseholdRegistrationScope(
        requestDataWithDerivedAgeGroups.disaster_event_id,
        client,
      );

    if (!lockedScope) {
      const error = new Error("disaster_event_id is invalid");
      error.statusCode = 400;
      throw error;
    }

    if (lockedScope.status !== "ACTIVE") {
      throw buildDisasterEventNotActiveError();
    }

    if (isReAdmissionClone) {
      await assertReAdmissionSourceHousehold({
        sourceHouseholdId: effectiveSourceHouseholdId,
        registrationData: requestDataWithDerivedAgeGroups,
        dbClient: client,
      });
    }

    const authoritativeDuplicateMatch = isReAdmissionClone
      ? null
      : await getStrongestDuplicateRegistrationMatch({
          disasterEventId: requestDataWithDerivedAgeGroups.disaster_event_id,
          familyHead: requestDataWithDerivedAgeGroups.family_head,
          members: requestDataWithDerivedAgeGroups.members,
          contactNumber: requestDataWithDerivedAgeGroups.contact_number || null,
          dbClient: client,
        });

    const existingHouseholdId = await handleDuplicateRegistrationMatch({
      match: authoritativeDuplicateMatch,
      registrationData: requestDataWithDerivedAgeGroups,
      dbClient: client,
    });

    if (existingHouseholdId) {
      if (!externalClient) {
        await client.query("COMMIT");
      }

      return buildRegistrationResponse(
        existingHouseholdId,
        externalClient ? client : undefined,
      );
    }

    const createdHousehold =
      await householdRegistrationRepository.insertHousehold(
        requestDataWithDerivedAgeGroups,
        client,
      );

    let savedPrivacyAcknowledgment = null;

    try {
      savedPrivacyAcknowledgment =
        await householdRegistrationRepository.insertHouseholdPrivacyConsent(
          {
            ...normalizedPrivacyAcknowledgment,
            household_id: createdHousehold.id,
          },
          client,
        );
    } catch (error) {
      throw buildHouseholdPrivacySaveFailedError(error);
    }

    const createdMembers = [];
    let familyHeadEvacueeId = null;

    const familyHeadSectorRows = memberSectors.filter((sector) =>
      requestDataWithDerivedAgeGroups.family_head.sector_ids.includes(sector.id),
    );
    const familyHeadSectorCodes = familyHeadSectorRows.map((sector) => sector.code);
    const preparedFamilyHead = {
      ...requestDataWithDerivedAgeGroups.family_head,
      is_family_head: true,
      ...getMemberFlagsFromSectorCodes(familyHeadSectorCodes),
    };

    const createdFamilyHead =
      await householdRegistrationRepository.insertEvacuee(
        createdHousehold.id,
        preparedFamilyHead,
        client,
      );

    createdMembers.push(createdFamilyHead);
    familyHeadEvacueeId = createdFamilyHead.id;

    const familyHeadSectorIds = deduplicateIds([
      ageSectorIdsByCode[preparedFamilyHead.derived_age_sector_code],
      ...preparedFamilyHead.sector_ids,
    ]).filter(Boolean);

    if (familyHeadSectorIds.length > 0) {
      await householdRegistrationRepository.insertEvacueeSectors(
        createdFamilyHead.id,
        familyHeadSectorIds,
        client,
      );
    }

    if (!shouldAutoArchiveWithoutAttendance) {
      await householdRegistrationRepository.insertEvacuationLog(
        {
          disaster_event_id: requestDataWithDerivedAgeGroups.disaster_event_id,
          household_id: createdHousehold.id,
          evacuee_id: createdFamilyHead.id,
          evacuation_center_id: requestDataWithDerivedAgeGroups.evacuation_center_id,
          status: "PRESENT",
          recorded_by: requestDataWithDerivedAgeGroups.registered_by,
          remarks: "Automatic arrival recorded during household registration",
          time_in: requestDataWithDerivedAgeGroups.registered_at,
        },
        client,
      );
    }

    for (const member of requestDataWithDerivedAgeGroups.members) {
      const memberSectorRows = memberSectors.filter((sector) =>
        member.sector_ids.includes(sector.id),
      );
      const memberSectorCodes = memberSectorRows.map((sector) => sector.code);
      const preparedMember = {
        ...member,
        is_family_head: false,
        ...getMemberFlagsFromSectorCodes(memberSectorCodes),
      };

      const createdMember = await householdRegistrationRepository.insertEvacuee(
        createdHousehold.id,
        preparedMember,
        client,
      );

      createdMembers.push(createdMember);

      const assignedSectorIds = deduplicateIds([
        ageSectorIdsByCode[preparedMember.derived_age_sector_code],
        ...preparedMember.sector_ids,
      ]).filter(Boolean);

      if (assignedSectorIds.length > 0) {
        await householdRegistrationRepository.insertEvacueeSectors(
          createdMember.id,
          assignedSectorIds,
          client,
        );
      }

      if (!shouldAutoArchiveWithoutAttendance) {
        await householdRegistrationRepository.insertEvacuationLog(
          {
            disaster_event_id: requestDataWithDerivedAgeGroups.disaster_event_id,
            household_id: createdHousehold.id,
            evacuee_id: createdMember.id,
            evacuation_center_id: requestDataWithDerivedAgeGroups.evacuation_center_id,
            status: "PRESENT",
            recorded_by: requestDataWithDerivedAgeGroups.registered_by,
            remarks: "Automatic arrival recorded during household registration",
            time_in: requestDataWithDerivedAgeGroups.registered_at,
          },
          client,
        );
      }
    }

    await householdRegistrationRepository.updateHouseholdFamilyHeadEvacueeId(
      createdHousehold.id,
      familyHeadEvacueeId,
      client,
    );

    if (requestDataWithDerivedAgeGroups.household_sector_ids.length > 0) {
      await householdRegistrationRepository.insertHouseholdSectors(
        createdHousehold.id,
        deduplicateIds(requestDataWithDerivedAgeGroups.household_sector_ids),
        client,
      );
    }

    if (requestDataWithDerivedAgeGroups.current_stay_type === "EVAC_CENTER") {
      const stubNumbers =
        await householdRegistrationRepository.generateStubNumbers(client);

      await householdRegistrationRepository.insertStub(
        {
          disaster_event_id: requestDataWithDerivedAgeGroups.disaster_event_id,
          household_id: createdHousehold.id,
          stub_no: stubNumbers.stub_no,
          serial_no: stubNumbers.serial_no,
          status: "ISSUED",
          issued_by: requestDataWithDerivedAgeGroups.registered_by,
          qr_code_value: buildStubQrCodeValue({
            disasterEventId: requestDataWithDerivedAgeGroups.disaster_event_id,
            householdId: createdHousehold.id,
            stubNo: stubNumbers.stub_no,
          }),
          qr_generated_by: requestDataWithDerivedAgeGroups.registered_by,
          qr_status: "ACTIVE",
          qr_notes: null,
        },
        client,
      );
    }

    if (shouldAutoArchiveWithoutAttendance) {
      await householdRegistrationRepository.archiveHousehold(
        createdHousehold.id,
        client,
      );
      await householdRegistrationRepository.deactivateEvacueesByHouseholdId(
        createdHousehold.id,
        client,
      );
    }

    if (!externalClient) {
      await client.query("COMMIT");
    }

    const registrationResponse = await buildRegistrationResponse(
      createdHousehold.id,
      externalClient || undefined,
    );
    registrationResponse.active_cross_event_information =
      await buildActiveCrossEventInformation({
        disasterEventId: requestDataWithDerivedAgeGroups.disaster_event_id,
        familyHead: requestDataWithDerivedAgeGroups.family_head,
        contactNumber: requestDataWithDerivedAgeGroups.contact_number || null,
      });
    if (isReAdmissionClone) {
      registrationResponse.registration_operation =
        NEW_HOUSEHOLD_OCCURRENCE_OPERATION;
      registrationResponse.source_household_id = effectiveSourceHouseholdId;
    }
    const familyHeadName = [
      registrationResponse.household?.family_head_first_name,
      registrationResponse.household?.family_head_last_name,
    ]
      .filter(Boolean)
      .join(" ");

    if (!externalClient) {
      await notificationService.emitSafely(() =>
        notificationService.emitHouseholdRegistrationUpdate({
          householdId: createdHousehold.id,
          barangayId: requestDataWithDerivedAgeGroups.barangay_id,
          familyHeadName,
          action: "registered",
          requiresVerification: !registrationResponse.household?.family_head_photo_url,
        }),
      );

      await logAuditSafely({
        actor: buildPrivacyAuditActor({
          recordedBy: requestDataWithDerivedAgeGroups.registered_by,
          roleCode: userScope?.role_code || null,
          deviceId: savedPrivacyAcknowledgment.device_id,
        }),
        action: "HOUSEHOLD_PRIVACY_ACKNOWLEDGED",
        entityType: "HOUSEHOLD_PRIVACY_CONSENT",
        entityId: savedPrivacyAcknowledgment.id,
        oldValues: {},
        newValues: summarizePrivacyConsent(savedPrivacyAcknowledgment),
      });

      if (isReAdmissionClone) {
        await logAuditSafely({
          actor: buildPrivacyAuditActor({
            recordedBy: requestDataWithDerivedAgeGroups.registered_by,
            roleCode: userScope?.role_code || null,
            deviceId: savedPrivacyAcknowledgment.device_id,
          }),
          action: "HOUSEHOLD_RE_ADMITTED",
          entityType: "HOUSEHOLD",
          entityId: createdHousehold.id,
          oldValues: {
            source_household_id: effectiveSourceHouseholdId,
          },
          newValues: {
            household_id: createdHousehold.id,
            registration_operation: NEW_HOUSEHOLD_OCCURRENCE_OPERATION,
          },
        });
      }
    }

    return registrationResponse;
  } catch (error) {
    if (!externalClient) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    if (!externalClient) {
      client.release();
    }
  }
};

const departHousehold = async (
  householdId,
  departureDetails,
  requester = null,
  options = {},
) => {
  const externalClient = options.dbClient || null;
  const client = externalClient || await pool.connect();
  let transactionResult = null;

  try {
    if (!externalClient) {
      await client.query("BEGIN");
    }

    const scopedHousehold =
      await householdRegistrationRepository.getHouseholdSummaryById(
        householdId,
        client,
      );

    if (!scopedHousehold) {
      const error = new Error("Household not found");
      error.statusCode = 404;
      throw error;
    }

    if (
      requester?.roleCode === BARANGAY_ROLE_CODE &&
      scopedHousehold.barangay_id !== requester.defaultBarangayId
    ) {
      const error = new Error("You do not have access to depart this household");
      error.statusCode = 403;
      throw error;
    }

    const lockedHousehold =
      await householdRegistrationRepository.getHouseholdSummaryByIdForUpdate(
        householdId,
        client,
      );

    if (!lockedHousehold) {
      const error = new Error("Household not found");
      error.statusCode = 404;
      throw error;
    }

    if (!lockedHousehold.is_active) {
      if (departureDetails?.allow_duplicate_departure_resolution) {
        const latestAttendance =
          await householdRegistrationRepository.getLatestAttendanceByHouseholdId(
            householdId,
            client,
          );

        if (latestAttendance?.time_out) {
          throw buildDuplicateDepartureError(householdId, latestAttendance);
        }
      }

      const error = new Error("Archived households cannot be marked as departed");
      error.statusCode = 400;
      throw error;
    }

    const activeEvacuationLogs =
      await householdRegistrationRepository.getActiveEvacuationLogsByHouseholdId(
        householdId,
        client,
      );

    if (activeEvacuationLogs.length === 0) {
      const error = new Error(
        "This household has no active arrival record to mark as departed",
      );
      error.statusCode = 400;
      throw error;
    }

    const previousHouseholdSummary = summarizeHousehold(lockedHousehold);
    const updatedLogs =
      await householdRegistrationRepository.markHouseholdDeparture(
        householdId,
        departureDetails,
        client,
      );

    if (updatedLogs.length === 0) {
      const currentHousehold =
        await householdRegistrationRepository.getHouseholdSummaryById(
          householdId,
          client,
        );

      if (
        !currentHousehold?.is_active &&
        departureDetails?.allow_duplicate_departure_resolution
      ) {
        const latestAttendance =
          await householdRegistrationRepository.getLatestAttendanceByHouseholdId(
            householdId,
            client,
          );

        if (latestAttendance?.time_out) {
          throw buildDuplicateDepartureError(householdId, latestAttendance);
        }
      }

      const error = new Error(
        "This household departure could not be completed because the active arrival state was no longer available",
      );
      error.statusCode = 409;
      error.code = "HOUSEHOLD_DEPARTURE_STATE_CONSUMED";
      throw error;
    }

    const archivedHousehold =
      await householdRegistrationRepository.archiveHousehold(householdId, client);
    const archivedEvacuees =
      await householdRegistrationRepository.deactivateEvacueesByHouseholdId(
        householdId,
        client,
      );

    if (!externalClient) {
      await client.query("COMMIT");
    }

    transactionResult = {
      household_id: householdId,
      affected_logs_count: updatedLogs.length,
      archived_members_count: archivedEvacuees.length,
      latest_departure_time: updatedLogs[0]?.time_out || null,
      status: "ARCHIVED",
      household: archivedHousehold,
      previousHouseholdSummary,
      familyHeadName: [
        lockedHousehold.family_head_first_name,
        lockedHousehold.family_head_last_name,
      ]
        .filter(Boolean)
        .join(" "),
      barangayId: lockedHousehold.barangay_id,
    };

    if (!externalClient) {
      await logAuditSafely({
        actor: requester,
        action: "HOUSEHOLD_DEPART_AND_ARCHIVE",
        entityType: "HOUSEHOLD",
        entityId: householdId,
        oldValues: transactionResult.previousHouseholdSummary,
        newValues: {
          ...summarizeHousehold(archivedHousehold),
          departure_remarks: departureDetails?.remarks || null,
          affected_logs_count: updatedLogs.length,
          archived_members_count: archivedEvacuees.length,
          status: "LEFT",
        },
      });
    }

    if (!externalClient) {
      await notificationService.emitSafely(() =>
        notificationService.emitEvacueeAttendanceUpdate({
          householdId,
          barangayId: transactionResult.barangayId,
          familyHeadName: transactionResult.familyHeadName,
          action: "departure-recorded",
        }),
      );
    }

    return {
      household_id: transactionResult.household_id,
      affected_logs_count: transactionResult.affected_logs_count,
      archived_members_count: transactionResult.archived_members_count,
      latest_departure_time: transactionResult.latest_departure_time,
      status: transactionResult.status,
      household: transactionResult.household,
    };
  } catch (error) {
    if (!externalClient) {
      await client.query("ROLLBACK");
    }
    throw error;
  } finally {
    if (!externalClient) {
      client.release();
    }
  }
};

const correctEvacuationLog = async ({
  householdId,
  evacuationLogId,
  requester,
  correctionData,
}) => {
  const household =
    await householdRegistrationRepository.getHouseholdSummaryById(householdId);

  if (!household) {
    const error = new Error("Household not found");
    error.statusCode = 404;
    throw error;
  }

  if (
    requester?.roleCode === BARANGAY_ROLE_CODE &&
    household.barangay_id !== requester.defaultBarangayId
  ) {
    const error = new Error(
      "You do not have access to correct evacuation logs for this household",
    );
    error.statusCode = 403;
    throw error;
  }

  const existingLog =
    await householdRegistrationRepository.getEvacuationLogByIdForHousehold(
      householdId,
      evacuationLogId,
    );

  if (!existingLog) {
    const error = new Error("Evacuation log not found");
    error.statusCode = 404;
    throw error;
  }

  if (correctionData.evacuation_center_id) {
    const evacuationCenter =
      await householdRegistrationRepository.getEvacuationCenterById(
        correctionData.evacuation_center_id,
      );

    if (!evacuationCenter || !evacuationCenter.is_active) {
      const error = new Error("evacuation_center_id is invalid");
      error.statusCode = 400;
      throw error;
    }

    if (evacuationCenter.barangay_id !== household.barangay_id) {
      const error = new Error(
        "Selected evacuation center must belong to the household barangay",
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const updatedLog =
    await householdRegistrationRepository.updateEvacuationLogCorrection(
      evacuationLogId,
      {
        evacuation_center_id: correctionData.evacuation_center_id,
        status: correctionData.status,
        remarks: correctionData.correction_remarks,
      },
    );

  await logAuditSafely({
    actor: requester,
    action: "HOUSEHOLD_EVACUATION_CORRECTION",
    entityType: "EVACUATION_LOG",
    entityId: evacuationLogId,
    oldValues: summarizeEvacuationLog(existingLog),
    newValues: summarizeEvacuationLog(updatedLog),
  });

  const familyHeadName = [
    household.family_head_first_name,
    household.family_head_last_name,
  ]
    .filter(Boolean)
    .join(" ");

  await notificationService.emitSafely(() =>
    notificationService.emitEvacueeAttendanceUpdate({
      householdId,
      barangayId: household.barangay_id,
      familyHeadName,
      action: "status-updated",
    }),
  );

  return {
    household_id: householdId,
    evacuation_log_id: updatedLog.id,
    status: updatedLog.status,
    evacuation_center_id: updatedLog.evacuation_center_id,
    time_in: updatedLog.time_in,
    time_out: updatedLog.time_out,
    remarks: updatedLog.remarks,
  };
};

const archiveHousehold = async ({ householdId, requester, archiveData }) => {
  const existingHousehold =
    await householdRegistrationRepository.getHouseholdSummaryById(householdId);

  if (!existingHousehold) {
    const error = new Error("Household not found");
    error.statusCode = 404;
    throw error;
  }

  if (
    requester?.roleCode === BARANGAY_ROLE_CODE &&
    existingHousehold.barangay_id !== requester.defaultBarangayId
  ) {
    const error = new Error("You do not have access to archive this household");
    error.statusCode = 403;
    throw error;
  }

  if (!existingHousehold.is_active) {
    const error = new Error("This household is already archived");
    error.statusCode = 400;
    throw error;
  }

  const previousHouseholdSummary = summarizeHousehold(existingHousehold);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await householdRegistrationRepository.archiveHousehold(householdId, client);
    const archivedEvacuees =
      await householdRegistrationRepository.deactivateEvacueesByHouseholdId(
        householdId,
        client,
      );

    await client.query("COMMIT");

    const archivedHouseholdDetails = await buildRegistrationResponse(householdId);

    await logAuditSafely({
      actor: requester,
      action: "HOUSEHOLD_ARCHIVE",
      entityType: "HOUSEHOLD",
      entityId: householdId,
      oldValues: previousHouseholdSummary,
      newValues: {
        ...summarizeHousehold(archivedHouseholdDetails.household),
        archive_remarks: archiveData.archive_remarks || null,
        archived_members_count: archivedEvacuees.length,
      },
    });

    return {
      household_id: householdId,
      archived_members_count: archivedEvacuees.length,
      status: "ARCHIVED",
      household: archivedHouseholdDetails.household,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const restoreHousehold = async ({ householdId, requester, restoreData }) => {
  const existingHousehold =
    await householdRegistrationRepository.getHouseholdSummaryById(householdId);

  if (!existingHousehold) {
    const error = new Error("Household not found");
    error.statusCode = 404;
    throw error;
  }

  if (
    requester?.roleCode === BARANGAY_ROLE_CODE &&
    existingHousehold.barangay_id !== requester.defaultBarangayId
  ) {
    const error = new Error("You do not have access to restore this household");
    error.statusCode = 403;
    throw error;
  }

  const restoreMode =
    restoreData.restore_mode || RESTORE_MODES.RETURN_TO_EVAC_CENTER;
  if (restoreMode !== RESTORE_MODES.RETURN_TO_EVAC_CENTER) {
    const error = new Error("This household cannot be re-admitted.");
    error.statusCode = 400;
    throw error;
  }
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lockedHousehold =
      await householdRegistrationRepository.getHouseholdSummaryByIdForUpdate(
        householdId,
        client,
      );

    if (!lockedHousehold) {
      const error = new Error("Household not found");
      error.statusCode = 404;
      throw error;
    }

    if (
      requester?.roleCode === BARANGAY_ROLE_CODE &&
      lockedHousehold.barangay_id !== requester.defaultBarangayId
    ) {
      const error = new Error("You do not have access to restore this household");
      error.statusCode = 403;
      throw error;
    }

    const shouldConvertNonAdmittedResident =
      isNonAdmittedResidentRecord(lockedHousehold);

    if (lockedHousehold.is_active && !shouldConvertNonAdmittedResident) {
      const error = new Error("This household is already admitted.");
      error.statusCode = 400;
      error.code = "HOUSEHOLD_ALREADY_ADMITTED";
      throw error;
    }

    const activeEvacuationLogs =
      await householdRegistrationRepository.getActiveEvacuationLogsByHouseholdId(
        householdId,
        client,
      );

    if (activeEvacuationLogs.length > 0) {
      const error = new Error("This household is already admitted.");
      error.statusCode = 400;
      error.code = "HOUSEHOLD_ALREADY_ADMITTED";
      throw error;
    }

    const activeSuccessor =
      await householdRegistrationRepository.getActiveHouseholdSuccessorById(
        householdId,
        client,
      );

    if (activeSuccessor) {
      const error = new Error("This household is already admitted.");
      error.statusCode = 400;
      error.code = "HOUSEHOLD_ALREADY_ADMITTED";
      throw error;
    }

    const archivedHouseholdDetails = await buildRegistrationResponse(
      householdId,
      client,
    );

    if (!isCurrentHouseholdPrivacyConsent(archivedHouseholdDetails.privacy_consent)) {
      const error = new Error(
        "A valid Data Privacy Notice acknowledgment is required before this household can be re-admitted.",
      );
      error.statusCode = 400;
      throw error;
    }

    if (shouldConvertNonAdmittedResident) {
      const restoreEvacuationCenterId =
        await resolveSingleActiveEvacuationCenterId(lockedHousehold.barangay_id);

      if (restoreEvacuationCenterId) {
        const evacuationCenter =
          await householdRegistrationRepository.getEvacuationCenterById(
            restoreEvacuationCenterId,
          );

        if (!evacuationCenter || !evacuationCenter.is_active) {
          const error = new Error("evacuation_center_id is invalid");
          error.statusCode = 400;
          throw error;
        }

        if (evacuationCenter.barangay_id !== lockedHousehold.barangay_id) {
          const error = new Error(
            "Selected evacuation center must belong to the chosen barangay",
          );
          error.statusCode = 400;
          throw error;
        }
      }

      const updatedHousehold =
        await householdRegistrationRepository.updateHousehold(
          householdId,
          {
            evacuation_center_id: restoreEvacuationCenterId,
            residency_status: lockedHousehold.residency_status,
            contact_number: lockedHousehold.contact_number || null,
            current_stay_type: "EVAC_CENTER",
            current_address_details: lockedHousehold.current_address_details || null,
            household_size: archivedHouseholdDetails.members_count ||
              lockedHousehold.household_size,
          },
          client,
        );

      if (!updatedHousehold) {
        const error = new Error("Archived households cannot be edited");
        error.statusCode = 400;
        error.code = "HISTORICAL_HOUSEHOLD_IMMUTABLE";
        throw error;
      }

      const evacuees =
        await householdRegistrationRepository.getEvacueesByHouseholdId(
          householdId,
          {
            includeInactive: true,
            dbClient: client,
          },
        );

      if (evacuees.length === 0) {
        const error = new Error(
          "This household has no family members to re-admit.",
        );
        error.statusCode = 400;
        throw error;
      }

      const createdLogs = [];

      for (const evacuee of evacuees) {
        const createdLog =
          await householdRegistrationRepository.insertEvacuationLog(
            {
              disaster_event_id: lockedHousehold.disaster_event_id,
              household_id: householdId,
              evacuee_id: evacuee.id,
              evacuation_center_id: restoreEvacuationCenterId,
              status: "PRESENT",
              recorded_by:
                requester?.userId || lockedHousehold.registered_by || null,
              remarks: "Automatic arrival recorded during household re-admission",
            },
            client,
          );

        createdLogs.push(createdLog);
      }

      await client.query("COMMIT");

      const returnedHouseholdDetails = await buildRegistrationResponse(householdId);
      const familyHeadName = [
        returnedHouseholdDetails.household?.family_head_first_name,
        returnedHouseholdDetails.household?.family_head_last_name,
      ]
        .filter(Boolean)
        .join(" ");
      const familyHeadArrivalLog =
        createdLogs.find(
          (log) => log.evacuee_id === lockedHousehold.family_head_evacuee_id,
        ) ||
        createdLogs[0] ||
        null;

      await logAuditSafely({
        actor: requester,
        action: "HOUSEHOLD_RETURN_TO_EVAC_CENTER",
        entityType: "HOUSEHOLD",
        entityId: householdId,
        oldValues: {
          ...summarizeHousehold(lockedHousehold),
          restore_mode: restoreMode,
        },
        newValues: {
          ...summarizeHousehold(returnedHouseholdDetails.household),
          restore_mode: restoreMode,
          new_arrival_time: familyHeadArrivalLog?.time_in || null,
        },
      });

      await notificationService.emitSafely(() =>
        notificationService.emitEvacueeAttendanceUpdate({
          householdId,
          barangayId: lockedHousehold.barangay_id,
          familyHeadName,
          action: "arrival-recorded",
        }),
      );

      return {
        household_id: householdId,
        source_household_id: householdId,
        status: "ACTIVE",
        restore_mode: restoreMode,
        household: returnedHouseholdDetails.household,
      };
    }

    const reAdmissionRequest = await buildReturnRegistrationRequest({
      householdDetails: archivedHouseholdDetails,
      existingHousehold: lockedHousehold,
      requester,
      restoreData,
    });
    const returnedHouseholdDetails = await registerHousehold(
      reAdmissionRequest,
      {
        dbClient: client,
        operation: "RE_ADMISSION",
        sourceHouseholdId: householdId,
      },
    );

    await client.query("COMMIT");

    const familyHeadName = [
      returnedHouseholdDetails.household?.family_head_first_name,
      returnedHouseholdDetails.household?.family_head_last_name,
    ]
      .filter(Boolean)
      .join(" ");
    const familyHeadArrivalLog = returnedHouseholdDetails.latest_attendance || null;

    await logAuditSafely({
      actor: requester,
      action: "HOUSEHOLD_RETURN_TO_EVAC_CENTER",
      entityType: "HOUSEHOLD",
      entityId: returnedHouseholdDetails.household?.id || null,
      oldValues: {
        ...summarizeHousehold(lockedHousehold),
        restore_mode: restoreMode,
        source_household_id: householdId,
      },
      newValues: {
        ...summarizeHousehold(returnedHouseholdDetails.household),
        restore_mode: restoreMode,
        source_household_id: householdId,
        new_arrival_time: familyHeadArrivalLog?.time_in || null,
      },
    });

    await notificationService.emitSafely(() =>
      notificationService.emitEvacueeAttendanceUpdate({
        householdId: returnedHouseholdDetails.household?.id || null,
        barangayId: lockedHousehold.barangay_id,
        familyHeadName,
        action: "arrival-recorded",
      }),
    );

    return {
      household_id: returnedHouseholdDetails.household?.id || null,
      source_household_id: householdId,
      status: "ACTIVE",
      restore_mode: restoreMode,
      household: returnedHouseholdDetails.household,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getHouseholdDetails,
  getAuthorizedHouseholdSummaryForUpdate,
  assertHouseholdUpdateDisasterEventActive,
  getDuplicateRegistrationSuggestions,
  registerHousehold,
  reconcileCrossBarangayDuplicateWithEarlierRegistration,
  updateHouseholdDetails,
  departHousehold,
  correctEvacuationLog,
  archiveHousehold,
  restoreHousehold,
};
