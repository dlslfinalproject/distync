const masterlistRepository = require("../repositories/masterlist.repository");
const stubRepository = require("../repositories/stub.repository");

const isOverrideAllowed = process.env.NODE_ENV !== "production";

const buildFullName = (firstName, middleName, lastName, suffix) => {
  return [firstName, middleName, lastName, suffix].filter(Boolean).join(" ");
};

const buildSectorsText = (householdId, householdSectorsByHouseholdId, memberSectorsByHouseholdId) => {
  const householdSectorNames = (householdSectorsByHouseholdId[householdId] || []).map(
    (sector) => sector.name,
  );
  const memberSectorNames = (memberSectorsByHouseholdId[householdId] || []).map(
    (sector) => sector.name,
  );
  const uniqueSectorNames = [
    ...new Set([...householdSectorNames, ...memberSectorNames]),
  ];

  return uniqueSectorNames.length > 0 ? uniqueSectorNames.join(", ") : "-";
};

const groupByKey = (items, keyName) => {
  return items.reduce((groups, item) => {
    const key = item[keyName];

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(item);
    return groups;
  }, {});
};

const formatSearchResult = (stub) => {
  const isNonResident = !stub.barangay_id;

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
        name: isNonResident
          ? "Non-Resident (Outside Malvar)"
          : stub.barangay_name,
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

const resolveEffectiveBarangay = async (filters) => {
  const userScope = filters.user_id
    ? await masterlistRepository.getBarangayUserScopeById(filters.user_id)
    : null;

  if (filters.user_id && !userScope) {
    const error = new Error("Barangay user not found");
    error.statusCode = 404;
    throw error;
  }

  if (
    userScope &&
    userScope.role_code !== masterlistRepository.BARANGAY_ROLE_CODE
  ) {
    const error = new Error("Only Barangay users can access this dashboard");
    error.statusCode = 403;
    throw error;
  }

  let effectiveBarangay = null;

  if (filters.override_barangay_id) {
    if (!isOverrideAllowed) {
      const error = new Error("Barangay override is only available outside production");
      error.statusCode = 403;
      error.code = "BARANGAY_OVERRIDE_NOT_ALLOWED";
      throw error;
    }

    effectiveBarangay = await masterlistRepository.getBarangaySummaryById(
      filters.override_barangay_id,
    );

    if (!effectiveBarangay || effectiveBarangay.is_active === false) {
      const error = new Error("override_barangay_id is invalid");
      error.statusCode = 400;
      error.code = "INVALID_OVERRIDE_BARANGAY";
      throw error;
    }
  } else if (userScope?.default_barangay_id) {
    effectiveBarangay = await masterlistRepository.getBarangaySummaryById(
      userScope.default_barangay_id,
    );
  }

  if (!effectiveBarangay) {
    const error = new Error("No assigned barangay. Please contact administrator.");
    error.statusCode = 400;
    error.code = "NO_ASSIGNED_BARANGAY";
    throw error;
  }

  return {
    userScope,
    effectiveBarangay,
  };
};

const getBarangayStubDashboard = async (filters) => {
  const { userScope, effectiveBarangay } =
    await resolveEffectiveBarangay(filters);

  const scopedDisasterEvent =
    await masterlistRepository.getBarangayScopedDisasterEventById(
      filters.disaster_event_id,
      effectiveBarangay.id,
    );

  if (!scopedDisasterEvent) {
    const error = new Error(
      "No data available for this barangay and selected disaster event.",
    );
    error.statusCode = 404;
    error.code = "NO_STUB_EVENT_DATA";
    throw error;
  }

  const metrics = await stubRepository.getStubDashboardMetrics(
    filters.disaster_event_id,
    effectiveBarangay.id,
  );
  const rows = await stubRepository.getBarangayStubDashboardRows(
    filters.disaster_event_id,
    effectiveBarangay.id,
  );
  const householdIds = rows.map((row) => row.household_id);
  const householdSectors =
    await stubRepository.getHouseholdSectorsByHouseholdIds(householdIds);
  const memberSectors =
    await stubRepository.getMemberSectorsByHouseholdIds(householdIds);
  const householdSectorsByHouseholdId = groupByKey(
    householdSectors,
    "household_id",
  );
  const memberSectorsByHouseholdId = groupByKey(
    memberSectors,
    "household_id",
  );

  return {
    assigned_barangay: {
      id: effectiveBarangay.id,
      code: effectiveBarangay.code,
      name: effectiveBarangay.name,
    },
    assigned_barangay_id: userScope?.default_barangay_id || null,
    is_dev_override: Boolean(
      filters.override_barangay_id &&
      effectiveBarangay.id === filters.override_barangay_id,
    ),
    disaster_event: scopedDisasterEvent,
    metrics,
    count: rows.length,
    data: rows.map((row) => ({
      id: row.id,
      stub_no: row.stub_no,
      serial_no: row.serial_no,
      stub_sequence_no: row.stub_sequence_no,
      status: row.status,
      issued_at: row.issued_at,
      household: {
        id: row.household_id,
        family_head_name: buildFullName(
          row.family_head_first_name,
          row.family_head_middle_name,
          row.family_head_last_name,
          row.family_head_suffix,
        ),
        members_count: row.members_count,
      },
      sectors_text: buildSectorsText(
        row.household_id,
        householdSectorsByHouseholdId,
        memberSectorsByHouseholdId,
      ),
    })),
  };
};

const claimBarangayStub = async (params) => {
  const { effectiveBarangay } = await resolveEffectiveBarangay(params);
  const scopedStub = await stubRepository.getScopedStubById(
    params.id,
    effectiveBarangay.id,
  );

  if (!scopedStub) {
    const error = new Error("Stub not found for this barangay");
    error.statusCode = 404;
    error.code = "STUB_NOT_FOUND";
    throw error;
  }

  if (scopedStub.status !== "ISSUED") {
    const error = new Error("Only unclaimed stubs can be marked as claimed.");
    error.statusCode = 409;
    error.code = "STUB_ALREADY_CLAIMED";
    throw error;
  }

  const updatedStub = await stubRepository.markStubAsClaimed(params.id);

  return {
    message: "Stub marked as claimed successfully.",
    data: {
      id: updatedStub.id,
      status: updatedStub.status,
      claimed_at: updatedStub.claimed_at,
      updated_at: updatedStub.updated_at,
    },
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
      name: stub.barangay_id
        ? stub.barangay_name
        : "Non-Resident (Outside Malvar)",
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
        barangay_name:
          stub.barangay_name || "Non-Resident (Outside Malvar)",
      },
    },
  };
};

module.exports = {
  getBarangayStubDashboard,
  getSearchResults,
  getStubDetails,
  verifyStub,
  claimBarangayStub,
};
