const stubRepository = require("../repositories/stub.repository");

const buildFullName = (firstName, middleName, lastName, suffix) => {
  return [firstName, middleName, lastName, suffix].filter(Boolean).join(" ");
};

const formatSearchResult = (stub) => {
  return {
    id: stub.id,
    stub_no: stub.stub_no,
    serial_no: stub.serial_no,
    status: stub.status,
    issued_at: stub.issued_at,
    disaster_event: {
      id: stub.disaster_event_id,
      event_code: stub.event_code,
      title: stub.disaster_event_title,
    },
    household: {
      id: stub.household_id,
      family_head_name: buildFullName(
        stub.family_head_first_name,
        stub.family_head_middle_name,
        stub.family_head_last_name,
        stub.family_head_suffix,
      ),
      contact_number: stub.contact_number,
      household_size: stub.household_size,
      members_count: stub.members_count,
      barangay: {
        id: stub.barangay_id,
        code: stub.barangay_code,
        name: stub.barangay_name,
      },
    },
  };
};

const getSearchResults = async (filters) => {
  const stubs = await stubRepository.getStubSearchResults(
    filters.q,
    filters.disaster_event_id,
    filters.barangay_id,
  );

  return {
    filters,
    count: stubs.length,
    data: stubs.map(formatSearchResult),
  };
};

const getStubDetails = async (id) => {
  const stub = await stubRepository.getStubById(id);

  if (!stub) {
    return null;
  }

  const householdSectors = await stubRepository.getHouseholdSectorsByHouseholdId(
    stub.household_id,
  );
  const membersCount = await stubRepository.getHouseholdMembersCount(
    stub.household_id,
  );

  return {
    id: stub.id,
    stub_no: stub.stub_no,
    serial_no: stub.serial_no,
    status: stub.status,
    issued_by: stub.issued_by,
    issued_at: stub.issued_at,
    claimed_at: stub.claimed_at,
    updated_at: stub.updated_at,
    disaster_event: {
      id: stub.disaster_event_id,
      event_code: stub.event_code,
      title: stub.disaster_event_title,
      disaster_type: stub.disaster_type,
    },
    household: {
      id: stub.household_id,
      family_head_name: buildFullName(
        stub.family_head_first_name,
        stub.family_head_middle_name,
        stub.family_head_last_name,
        stub.family_head_suffix,
      ),
      household_size: stub.household_size,
      contact_number: stub.contact_number,
      current_stay_type: stub.current_stay_type,
      current_address_details: stub.current_address_details,
      registered_at: stub.registered_at,
      members_count: membersCount,
    },
    barangay: {
      id: stub.barangay_id,
      code: stub.barangay_code,
      name: stub.barangay_name,
    },
    household_sectors: householdSectors,
  };
};

const getClaimabilityResult = (status) => {
  if (status === "ISSUED") {
    return {
      is_claimable: true,
      reason: null,
      message: "Stub verified successfully",
    };
  }

  const reasonByStatus = {
    CLAIMED: "Stub already claimed",
    CANCELLED: "Stub has been cancelled",
    VOID: "Stub has been voided",
  };

  return {
    is_claimable: false,
    reason: reasonByStatus[status] || "Stub is not claimable",
    message: "Stub is not claimable",
  };
};

const verifyStub = async (identifier) => {
  const stub = await stubRepository.getStubByStubNoOrSerialNo(identifier);

  if (!stub) {
    const error = new Error("Stub not found");
    error.statusCode = 404;
    throw error;
  }

  const claimability = getClaimabilityResult(stub.status);

  return {
    message: claimability.message,
    data: {
      is_valid: true,
      is_claimable: claimability.is_claimable,
      reason: claimability.reason,
      stub: {
        id: stub.id,
        stub_no: stub.stub_no,
        serial_no: stub.serial_no,
        status: stub.status,
        issued_at: stub.issued_at,
      },
      household: {
        id: stub.household_id,
        family_head_name: buildFullName(
          stub.family_head_first_name,
          stub.family_head_middle_name,
          stub.family_head_last_name,
          stub.family_head_suffix,
        ),
        household_size: stub.household_size,
        contact_number: stub.contact_number,
        barangay_name: stub.barangay_name,
      },
    },
  };
};

module.exports = {
  getSearchResults,
  getStubDetails,
  verifyStub,
};
