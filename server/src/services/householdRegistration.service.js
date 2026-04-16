const pool = require("../config/db");
const householdRegistrationRepository = require("../repositories/householdRegistration.repository");
const { deriveAgeGroup } = require("../utils/ageGroup");
const {
  HOUSEHOLD_CONDITION_CODES,
  MANUAL_MEMBER_SECTOR_CODES,
  getMemberFlagsFromSectorCodes,
} = require("../utils/registrationOptions");

const NON_RESIDENT_BARANGAY_CODE = "NON_RESIDENT_OUTSIDE_MALVAR";

const deduplicateIds = (ids) => {
  return [...new Set(ids)];
};

const createStubNumbers = (sequenceNumber, currentYear) => {
  const paddedSequence = String(sequenceNumber).padStart(6, "0");

  return {
    stub_no: `STUB-${currentYear}-${paddedSequence}`,
    serial_no: `SER-${currentYear}-${paddedSequence}`,
  };
};

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
  const members =
    await householdRegistrationRepository.getEvacueesByHouseholdId(householdId);
  const evacueeSectorAssignments =
    await householdRegistrationRepository.getEvacueeSectorAssignmentsByHouseholdId(
      householdId,
    );
  const householdSectors =
    await householdRegistrationRepository.getHouseholdSectorAssignmentsByHouseholdId(
      householdId,
    );
  const stub = await householdRegistrationRepository.getStubByHouseholdId(
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
    stub,
    members_count: members.length,
  };
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

  const barangay = await householdRegistrationRepository.getBarangayById(
    requestData.barangay_id,
  );

  if (!barangay) {
    const error = new Error("barangay_id is invalid");
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

    const isNonResidentBarangay =
      barangay.code === NON_RESIDENT_BARANGAY_CODE;

    if (
      !isNonResidentBarangay &&
      evacuationCenter.barangay_id !== requestData.barangay_id
    ) {
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
    ...requestData,
    family_head: {
      ...normalizedFamilyHead,
      birth_date: null,
      contact_number: null,
    },
    members: normalizedMembers,
    current_address_details: null,
  };

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
    deduplicateIds([
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
  ]);

  validateSectorUsage(
    householdSectors,
    memberSectors,
    requestDataWithDerivedAgeGroups,
  );

  const ageSectorIdsByCode = Object.fromEntries(
    ageSectorRows.map((sector) => [sector.code, sector.id]),
  );

  if (ageSectorRows.length !== expectedAgeSectorCodes.length) {
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

    await householdRegistrationRepository.insertEvacuationLog(
      {
        disaster_event_id: requestDataWithDerivedAgeGroups.disaster_event_id,
        household_id: createdHousehold.id,
        evacuee_id: createdFamilyHead.id,
        evacuation_center_id: requestDataWithDerivedAgeGroups.evacuation_center_id,
        status: "PRESENT",
        recorded_by: requestDataWithDerivedAgeGroups.registered_by,
        remarks: "Automatic arrival recorded during household registration",
      },
      client,
    );

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

      await householdRegistrationRepository.insertEvacuationLog(
        {
          disaster_event_id: requestDataWithDerivedAgeGroups.disaster_event_id,
          household_id: createdHousehold.id,
          evacuee_id: createdMember.id,
          evacuation_center_id: requestDataWithDerivedAgeGroups.evacuation_center_id,
          status: "PRESENT",
          recorded_by: requestDataWithDerivedAgeGroups.registered_by,
          remarks: "Automatic arrival recorded during household registration",
        },
        client,
      );
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

    const currentYear = new Date().getFullYear();
    const nextStubSequence =
      await householdRegistrationRepository.getNextStubSequence(
        currentYear,
        client,
      );
    const stubNumbers = createStubNumbers(nextStubSequence, currentYear);

    await householdRegistrationRepository.insertStub(
      {
        disaster_event_id: requestDataWithDerivedAgeGroups.disaster_event_id,
        household_id: createdHousehold.id,
        stub_no: stubNumbers.stub_no,
        serial_no: stubNumbers.serial_no,
        status: "ISSUED",
        issued_by: requestDataWithDerivedAgeGroups.registered_by,
      },
      client,
    );

    await client.query("COMMIT");

    return buildRegistrationResponse(createdHousehold.id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const departHousehold = async (householdId, departureDetails) => {
  const household =
    await householdRegistrationRepository.getHouseholdSummaryById(householdId);

  if (!household) {
    const error = new Error("Household not found");
    error.statusCode = 404;
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

  const updatedLogs = await householdRegistrationRepository.markHouseholdDeparture(
    householdId,
    departureDetails,
  );

  return {
    household_id: householdId,
    affected_logs_count: updatedLogs.length,
    latest_departure_time: updatedLogs[0]?.time_out || null,
    status: "LEFT",
  };
};

module.exports = {
  registerHousehold,
  departHousehold,
};
