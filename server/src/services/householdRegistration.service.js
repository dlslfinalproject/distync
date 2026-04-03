const pool = require("../config/db");
const householdRegistrationRepository = require("../repositories/householdRegistration.repository");

const normalizeText = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim().toLowerCase();
};

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

const validateFamilyHeadMatch = (familyHead, headMember) => {
  const fieldsToCompare = [
    ["first_name", familyHead.first_name, headMember.first_name],
    ["middle_name", familyHead.middle_name, headMember.middle_name],
    ["last_name", familyHead.last_name, headMember.last_name],
    ["suffix", familyHead.suffix, headMember.suffix],
    ["sex", familyHead.sex, headMember.sex],
    ["birth_date", familyHead.birth_date, headMember.birth_date],
  ];

  const hasMismatch = fieldsToCompare.some(([, householdValue, memberValue]) => {
    return normalizeText(householdValue) !== normalizeText(memberValue);
  });

  if (hasMismatch) {
    const error = new Error(
      "family_head fields must match the submitted member marked as family head",
    );
    error.statusCode = 400;
    throw error;
  }
};

const validateSectorUsage = (householdSectors, personSectors, requestData) => {
  const householdSectorIds = deduplicateIds(requestData.household_sector_ids);
  const memberSectorIds = deduplicateIds(
    requestData.members.flatMap((member) => member.sector_ids),
  );

  if (householdSectorIds.length !== householdSectors.length) {
    const error = new Error("One or more household sector IDs are invalid");
    error.statusCode = 400;
    throw error;
  }

  if (memberSectorIds.length !== personSectors.length) {
    const error = new Error("One or more member sector IDs are invalid");
    error.statusCode = 400;
    throw error;
  }

  const hasInvalidHouseholdSector = householdSectors.some(
    (sector) => sector.sector_group !== "HOUSEHOLD",
  );

  if (hasInvalidHouseholdSector) {
    const error = new Error(
      "household_sector_ids must only contain sectors with sector_group = HOUSEHOLD",
    );
    error.statusCode = 400;
    throw error;
  }

  const hasInvalidPersonSector = personSectors.some(
    (sector) => sector.sector_group === "HOUSEHOLD",
  );

  if (hasInvalidPersonSector) {
    const error = new Error(
      "member sector_ids must not contain sectors with sector_group = HOUSEHOLD",
    );
    error.statusCode = 400;
    throw error;
  }
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

  if (requestData.household_size !== requestData.members.length) {
    const error = new Error(
      "household_size must match the number of submitted members",
    );
    error.statusCode = 400;
    throw error;
  }

  const familyHeadMembers = requestData.members.filter(
    (member) => member.is_family_head === true,
  );

  if (familyHeadMembers.length !== 1) {
    const error = new Error("Exactly one member must be marked as family head");
    error.statusCode = 400;
    throw error;
  }

  const familyHeadMember = familyHeadMembers[0];
  validateFamilyHeadMatch(requestData.family_head, familyHeadMember);

  const householdSectors = await householdRegistrationRepository.getSectorsByIds(
    deduplicateIds(requestData.household_sector_ids),
  );
  const personSectors = await householdRegistrationRepository.getSectorsByIds(
    deduplicateIds(requestData.members.flatMap((member) => member.sector_ids)),
  );

  validateSectorUsage(householdSectors, personSectors, requestData);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const createdHousehold =
      await householdRegistrationRepository.insertHousehold(
        requestData,
        client,
      );

    const createdMembers = [];
    let familyHeadEvacueeId = null;

    for (const member of requestData.members) {
      const createdMember = await householdRegistrationRepository.insertEvacuee(
        createdHousehold.id,
        member,
        client,
      );

      createdMembers.push(createdMember);

      if (member.is_family_head) {
        familyHeadEvacueeId = createdMember.id;
      }

      if (member.sector_ids.length > 0) {
        await householdRegistrationRepository.insertEvacueeSectors(
          createdMember.id,
          deduplicateIds(member.sector_ids),
          client,
        );
      }
    }

    await householdRegistrationRepository.updateHouseholdFamilyHeadEvacueeId(
      createdHousehold.id,
      familyHeadEvacueeId,
      client,
    );

    if (requestData.household_sector_ids.length > 0) {
      await householdRegistrationRepository.insertHouseholdSectors(
        createdHousehold.id,
        deduplicateIds(requestData.household_sector_ids),
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
        disaster_event_id: requestData.disaster_event_id,
        household_id: createdHousehold.id,
        stub_no: stubNumbers.stub_no,
        serial_no: stubNumbers.serial_no,
        status: "ISSUED",
        issued_by: requestData.registered_by,
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

module.exports = {
  registerHousehold,
};
