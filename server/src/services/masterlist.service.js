const masterlistRepository = require("../repositories/masterlist.repository");

const buildFullName = (firstName, middleName, lastName, suffix) => {
  return [firstName, middleName, lastName, suffix].filter(Boolean).join(" ");
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

const getMasterlist = async (filters) => {
  const disasterEvent =
    await masterlistRepository.getDisasterEventSummaryById(
      filters.disaster_event_id,
    );

  if (!disasterEvent) {
    const error = new Error("Disaster event not found");
    error.statusCode = 404;
    throw error;
  }

  if (filters.barangay_id) {
    const barangay = await masterlistRepository.getBarangaySummaryById(
      filters.barangay_id,
    );

    if (!barangay) {
      const error = new Error("Barangay not found");
      error.statusCode = 404;
      throw error;
    }
  }

  const households = await masterlistRepository.getHouseholdsByFilters(
    filters.disaster_event_id,
    filters.barangay_id,
  );

  if (households.length === 0) {
    return {
      disaster_event: {
        id: disasterEvent.id,
        event_code: disasterEvent.event_code,
        title: disasterEvent.title,
      },
      filters: {
        disaster_event_id: filters.disaster_event_id,
        barangay_id: filters.barangay_id,
      },
      count: 0,
      data: [],
    };
  }

  const householdIds = households.map((household) => household.household_id);

  const stubs = await masterlistRepository.getStubsByHouseholdIds(householdIds);
  const householdSectors =
    await masterlistRepository.getHouseholdSectorsByHouseholdIds(householdIds);
  const members = await masterlistRepository.getMembersByHouseholdIds(
    householdIds,
  );
  const memberSectors =
    await masterlistRepository.getMemberSectorsByHouseholdIds(householdIds);
  const latestAttendance =
    await masterlistRepository.getLatestAttendanceByHouseholdIds(householdIds);

  const stubsByHouseholdId = Object.fromEntries(
    stubs.map((stub) => [stub.household_id, stub]),
  );
  const householdSectorsByHouseholdId = groupByKey(
    householdSectors,
    "household_id",
  );
  const membersByHouseholdId = groupByKey(members, "household_id");
  const memberSectorsByEvacueeId = groupByKey(memberSectors, "evacuee_id");
  const latestAttendanceByHouseholdId = Object.fromEntries(
    latestAttendance.map((attendance) => [attendance.household_id, attendance]),
  );

  const data = households.map((household) => {
    const householdMembers = (membersByHouseholdId[household.household_id] || []).map(
      (member) => ({
        evacuee_id: member.evacuee_id,
        full_name: buildFullName(
          member.first_name,
          member.middle_name,
          member.last_name,
          member.suffix,
        ),
        sex: member.sex,
        age: member.age,
        age_value: member.age_value,
        age_unit: member.age_unit,
        age_group: member.age_group,
        relationship_to_head: member.relationship_to_head,
        is_family_head: member.is_family_head,
        sectors: (memberSectorsByEvacueeId[member.evacuee_id] || []).map(
          (sector) => ({
            id: sector.id,
            code: sector.code,
            name: sector.name,
          }),
        ),
      }),
    );

    const stub = stubsByHouseholdId[household.household_id] || null;
    const attendance =
      latestAttendanceByHouseholdId[household.household_id] || null;

    return {
      household_id: household.household_id,
      family_head_name: buildFullName(
        household.family_head_first_name,
        household.family_head_middle_name,
        household.family_head_last_name,
        household.family_head_suffix,
      ),
      barangay: {
        id: household.barangay_id,
        code: household.barangay_code,
        name: household.barangay_name,
      },
      household_size: household.household_size,
      current_stay_type: household.current_stay_type,
      current_address_details: household.current_address_details,
      contact_number: household.contact_number,
      registered_at: household.registered_at,
      stub: stub
        ? {
            id: stub.id,
            stub_no: stub.stub_no,
            serial_no: stub.serial_no,
            status: stub.status,
          }
        : null,
      household_sectors: (householdSectorsByHouseholdId[household.household_id] || []).map(
        (sector) => ({
          id: sector.id,
          code: sector.code,
          name: sector.name,
        }),
      ),
      latest_attendance: attendance
        ? {
            status: attendance.status,
            time_in: attendance.time_in,
            time_out: attendance.time_out,
            evacuation_center_id: attendance.evacuation_center_id,
          }
        : null,
      members: householdMembers,
    };
  });

  return {
    disaster_event: {
      id: disasterEvent.id,
      event_code: disasterEvent.event_code,
      title: disasterEvent.title,
    },
    filters: {
      disaster_event_id: filters.disaster_event_id,
      barangay_id: filters.barangay_id,
    },
    count: data.length,
    data,
  };
};

module.exports = {
  getMasterlist,
};
