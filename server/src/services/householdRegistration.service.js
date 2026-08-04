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
const RESTORE_MODES = {
  RETURN_TO_EVAC_CENTER: "RETURN_TO_EVAC_CENTER",
};
const NON_ADMITTED_RESIDENT_STAY_TYPES = new Set([
  "RELATIVES",
  "OTHER_SAFE_PLACE",
]);

const buildDuplicateRegistrationError = (duplicateHousehold) => {
  const error = new Error(
    "Duplicate household registration detected. Earlier registration was kept.",
  );
  error.statusCode = 409;
  error.code = "DUPLICATE_HOUSEHOLD_REGISTRATION";
  error.entityServerId = duplicateHousehold?.id || null;
  error.serverPayload = duplicateHousehold || null;
  return error;
};

const buildDuplicateDepartureError = (householdId, latestAttendance) => {
  const error = new Error(
    "Duplicate household departure detected. Earlier departure time was kept.",
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

const buildRegistrationResponse = async (householdId) => {
  const household =
    await householdRegistrationRepository.getHouseholdSummaryById(householdId);
  const includeInactiveMembers = household?.is_active === false;
  const members =
    await householdRegistrationRepository.getEvacueesByHouseholdId(householdId, {
      includeInactive: includeInactiveMembers,
    });
  const evacueeSectorAssignments =
    await householdRegistrationRepository.getEvacueeSectorAssignmentsByHouseholdId(
      householdId,
      {
        includeInactive: includeInactiveMembers,
      },
    );
  const householdSectors =
    await householdRegistrationRepository.getHouseholdSectorAssignmentsByHouseholdId(
      householdId,
    );
  const stub = await householdRegistrationRepository.getStubByHouseholdId(
    householdId,
  );
  const latestAttendance =
    await householdRegistrationRepository.getLatestAttendanceByHouseholdId(
      householdId,
    );
  const latestDistribution =
    await householdRegistrationRepository.getLatestDistributionTransactionByStubId(
      stub?.id || null,
    );
  const latestPrivacyConsent =
    await householdRegistrationRepository.getLatestHouseholdPrivacyConsentByHouseholdId(
      householdId,
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

const getHouseholdDetails = async ({ householdId, requester }) => {
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

  return buildRegistrationResponse(householdId);
};

const updateHouseholdDetails = async ({
  householdId,
  requester,
  requestData,
}) => {
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
    const error = new Error("You do not have access to update this household");
    error.statusCode = 403;
    throw error;
  }

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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await householdRegistrationRepository.updateHousehold(
      householdId,
      {
        ...requestDataWithDerivedAgeGroups,
        household_size:
          requestDataWithDerivedAgeGroups.members.length + 1,
      },
      client,
    );

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

    await client.query("COMMIT");
    const householdDetails = await buildRegistrationResponse(householdId);
    const familyHeadName = [
      householdDetails.household?.family_head_first_name,
      householdDetails.household?.family_head_last_name,
    ]
      .filter(Boolean)
      .join(" ");

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

    if (savedPrivacyRenewal) {
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
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const registerHousehold = async (requestData) => {
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
    relationship_to_head: "HEAD",
  });

  const normalizedMembers = requestData.members.map((member) =>
    buildPersonRecord(member),
  );

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

  if (
    registrationData.enforce_sync_duplicate_guard &&
    registrationData.synced_client_timestamp
  ) {
    const duplicateHousehold =
      await householdRegistrationRepository.findDuplicateHouseholdRegistration({
        disasterEventId: requestDataWithDerivedAgeGroups.disaster_event_id,
        barangayId: requestDataWithDerivedAgeGroups.barangay_id,
        familyHead: requestDataWithDerivedAgeGroups.family_head,
      });

    if (duplicateHousehold) {
      if (
        isEarlierTimestamp(
          registrationData.synced_client_timestamp,
          duplicateHousehold.registered_at,
        )
      ) {
        await householdRegistrationRepository.updateHouseholdRegistrationTimestamp(
          duplicateHousehold.id,
          registrationData.synced_client_timestamp,
        );
        return buildRegistrationResponse(duplicateHousehold.id);
      }

      throw buildDuplicateRegistrationError(duplicateHousehold);
    }
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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

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

    await client.query("COMMIT");

    const registrationResponse = await buildRegistrationResponse(createdHousehold.id);
    const familyHeadName = [
      registrationResponse.household?.family_head_first_name,
      registrationResponse.household?.family_head_last_name,
    ]
      .filter(Boolean)
      .join(" ");

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

    return registrationResponse;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const departHousehold = async (
  householdId,
  departureDetails,
  requester = null,
) => {
  const household =
    await householdRegistrationRepository.getHouseholdSummaryById(householdId);

  if (!household) {
    const error = new Error("Household not found");
    error.statusCode = 404;
    throw error;
  }

  if (!household.is_active) {
    if (departureDetails?.allow_duplicate_departure_resolution) {
      const latestAttendance =
        await householdRegistrationRepository.getLatestAttendanceByHouseholdId(
          householdId,
          household.disaster_event_id,
        );

      if (latestAttendance?.time_out) {
        if (
          isEarlierTimestamp(
            departureDetails.departure_time,
            latestAttendance.time_out,
          )
        ) {
          const updatedLogs =
            await householdRegistrationRepository.updateHouseholdDepartureTimestamp(
              householdId,
              departureDetails.departure_time,
            );

          return {
            household_id: householdId,
            affected_logs_count: updatedLogs.length,
            archived_members_count: 0,
            latest_departure_time:
              updatedLogs[0]?.time_out || latestAttendance.time_out,
            status: "ARCHIVED",
            household,
          };
        }

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
    );

  if (activeEvacuationLogs.length === 0) {
    const error = new Error(
      "This household has no active arrival record to mark as departed",
    );
    error.statusCode = 400;
    throw error;
  }

  const previousHouseholdSummary = summarizeHousehold(household);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const updatedLogs =
      await householdRegistrationRepository.markHouseholdDeparture(
        householdId,
        departureDetails,
        client,
      );
    const archivedHousehold =
      await householdRegistrationRepository.archiveHousehold(householdId, client);
    const archivedEvacuees =
      await householdRegistrationRepository.deactivateEvacueesByHouseholdId(
        householdId,
        client,
      );

    await client.query("COMMIT");

    await logAuditSafely({
      actor: requester,
      action: "HOUSEHOLD_DEPART_AND_ARCHIVE",
      entityType: "HOUSEHOLD",
      entityId: householdId,
      oldValues: previousHouseholdSummary,
      newValues: {
        ...summarizeHousehold(archivedHousehold),
        departure_remarks: departureDetails?.remarks || null,
        affected_logs_count: updatedLogs.length,
        archived_members_count: archivedEvacuees.length,
        status: "LEFT",
      },
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
        action: "departure-recorded",
      }),
    );

    return {
      household_id: householdId,
      affected_logs_count: updatedLogs.length,
      archived_members_count: archivedEvacuees.length,
      latest_departure_time: updatedLogs[0]?.time_out || null,
      status: "ARCHIVED",
      household: archivedHousehold,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
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
  const latestAttendance =
    await householdRegistrationRepository.getLatestAttendanceByHouseholdId(
      householdId,
    );
  const latestAttendanceStatus = String(latestAttendance?.status || "").toUpperCase();
  const hasDepartedLatestAttendance =
    Boolean(latestAttendance?.time_out) ||
    latestAttendanceStatus === "LEFT";

  if (
    restoreMode !== RESTORE_MODES.RETURN_TO_EVAC_CENTER ||
    (existingHousehold.is_active && !hasDepartedLatestAttendance)
  ) {
    const error = new Error("This household is already active");
    error.statusCode = 400;
    throw error;
  }

  const archivedHouseholdDetails = await buildRegistrationResponse(householdId);

  if (existingHousehold.is_active) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await householdRegistrationRepository.archiveHousehold(householdId, client);
      await householdRegistrationRepository.deactivateEvacueesByHouseholdId(
        householdId,
        client,
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  const returnRegistrationRequest = await buildReturnRegistrationRequest({
    householdDetails: archivedHouseholdDetails,
    existingHousehold,
    requester,
    restoreData,
  });
  const returnedHouseholdDetails =
    await registerHousehold(returnRegistrationRequest);

  await logAuditSafely({
    actor: requester,
    action: "HOUSEHOLD_RETURN_TO_EVAC_CENTER",
    entityType: "HOUSEHOLD",
    entityId: householdId,
    oldValues: {
      ...summarizeHousehold(existingHousehold),
      restore_mode: restoreMode,
    },
    newValues: {
      source_household_id: householdId,
      new_household_id: returnedHouseholdDetails.household?.id || null,
      restore_mode: restoreMode,
    },
  });

  return {
    household_id: returnedHouseholdDetails.household?.id || null,
    source_household_id: householdId,
    status: "ACTIVE",
    restore_mode: restoreMode,
    household: returnedHouseholdDetails.household,
  };
};

module.exports = {
  getHouseholdDetails,
  registerHousehold,
  updateHouseholdDetails,
  departHousehold,
  correctEvacuationLog,
  archiveHousehold,
  restoreHousehold,
};
