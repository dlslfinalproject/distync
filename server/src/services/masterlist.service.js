const masterlistRepository = require("../repositories/masterlist.repository");
const disasterEventService = require("./disasterEvent.service");
const { ROLE_CODES } = require("../modules/auth/auth.middleware");
const {
  buildCsvBuffer,
  buildExcelBuffer,
  buildExportColumns,
  buildExcelFilename,
  buildExportFilename,
  buildExportTitleLines,
  buildPdfBuffer,
  buildPdfFilename,
  filterExportRows,
  sortExportRows,
  mapHouseholdToExportRow,
} = require("../utils/masterlistExport");
const BARANGAY_EVENT_STATUSES = {
  active: ["ACTIVE"],
  ended: ["CLOSED", "ARCHIVED"],
};
const isOverrideAllowed = process.env.NODE_ENV !== "production";

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
  await disasterEventService.syncOverdueActiveDisasterEvents();

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
    filters.record_status,
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
        record_status: filters.record_status || "active",
      },
      count: 0,
      data: [],
    };
  }

  const householdIds = [...new Set(households.map((household) => household.household_id))];
  const includeInactiveMembers = filters.record_status !== "active";

  const stubs = await masterlistRepository.getStubsByHouseholdIds(householdIds);
  const householdSectors =
    await masterlistRepository.getHouseholdSectorsByHouseholdIds(householdIds);
  const members = await masterlistRepository.getMembersByHouseholdIds(
    householdIds,
    { includeInactive: includeInactiveMembers },
  );
  const memberSectors =
    await masterlistRepository.getMemberSectorsByHouseholdIds(householdIds, {
      includeInactive: includeInactiveMembers,
    });
  const stubsByHouseholdId = Object.fromEntries(
    stubs.map((stub) => [stub.household_id, stub]),
  );
  const householdSectorsByHouseholdId = groupByKey(
    householdSectors,
    "household_id",
  );
  const membersByHouseholdId = groupByKey(members, "household_id");
  const memberSectorsByEvacueeId = groupByKey(memberSectors, "evacuee_id");
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
    const attendance = household.attendance_log_id
      ? {
          id: household.attendance_log_id,
          status: household.attendance_status,
          time_in: household.attendance_time_in,
          time_out: household.attendance_time_out,
          evacuation_center_id: household.attendance_evacuation_center_id,
        }
      : null;

    return {
      household_id: household.household_id,
      masterlist_record_id:
        household.masterlist_record_id || household.attendance_log_id || household.household_id,
      family_head_name: buildFullName(
        household.family_head_first_name,
        household.family_head_middle_name,
        household.family_head_last_name,
        household.family_head_suffix,
      ),
      barangay: household.barangay_id
        ? {
            id: household.barangay_id,
            code: household.barangay_code,
            name: household.barangay_name,
          }
        : null,
      residency_status: household.residency_status || "RESIDENT",
      household_size: household.household_size,
      current_stay_type: household.current_stay_type,
      current_address_details: household.current_address_details,
      contact_number: household.contact_number,
      is_active: household.is_active,
      registered_at: attendance?.time_in || household.registered_at,
      household_registered_at: household.registered_at,
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
            id: attendance.id,
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
      record_status: filters.record_status || "active",
    },
    count: data.length,
    data,
  };
};

const getMswdoMasterlistDashboard = async (filters) => {
  await disasterEventService.syncOverdueActiveDisasterEvents();

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

  const metrics = await masterlistRepository.getMswdoMasterlistAnalytics(
    filters.disaster_event_id,
    filters.barangay_id,
  );

  const perBarangayChartDataset = Array.isArray(metrics.per_barangay_chart_dataset)
    ? metrics.per_barangay_chart_dataset
    : [];

  return {
    disaster_event: {
      id: disasterEvent.id,
      event_code: disasterEvent.event_code,
      title: disasterEvent.title,
      disaster_type: disasterEvent.disaster_type,
      status: disasterEvent.status,
    },
    filters: {
      disaster_event_id: filters.disaster_event_id,
      barangay_id: filters.barangay_id,
    },
    summary_metrics: {
      total_number_of_evacuees_individuals: Number(
        metrics.total_number_of_evacuees_individuals || 0,
      ),
      total_number_of_families: Number(
        metrics.total_number_of_families || 0,
      ),
      average_household_size: Number(metrics.average_household_size || 0),
      currently_admitted_evacuees: Number(
        metrics.currently_admitted_evacuees || 0,
      ),
      total_departed_evacuees: Number(
        metrics.total_departed_evacuees || 0,
      ),
      total_barangays_covered: Number(metrics.total_barangays_covered || 0),
    },
    charts: {
      per_barangay: perBarangayChartDataset.map((item) => ({
        barangay_id: item.barangay_id,
        barangay_name: item.barangay_name,
        families_count: Number(item.families_count || 0),
        evacuees_count: Number(item.evacuees_count || 0),
        admitted_evacuees_count: Number(item.admitted_evacuees_count || 0),
        departed_evacuees_count: Number(item.departed_evacuees_count || 0),
      })),
      sex_distribution: Array.isArray(metrics.sex_distribution_dataset)
        ? metrics.sex_distribution_dataset.map((item) => ({
            name: item.name,
            value: Number(item.value || 0),
          }))
        : [],
      age_group_distribution: Array.isArray(metrics.age_group_distribution_dataset)
        ? metrics.age_group_distribution_dataset.map((item) => ({
            name: item.name,
            value: Number(item.value || 0),
          }))
        : [],
      sector_distribution: Array.isArray(metrics.sector_distribution_dataset)
        ? metrics.sector_distribution_dataset.map((item) => ({
            code: item.code,
            name: item.name,
            sector_group: item.sector_group,
            value: Number(item.value || 0),
          }))
        : [],
      stay_type_distribution: Array.isArray(metrics.stay_type_distribution_dataset)
        ? metrics.stay_type_distribution_dataset.map((item) => ({
            name: item.name,
            value: Number(item.value || 0),
          }))
        : [],
      evacuation_center_distribution: Array.isArray(
        metrics.evacuation_center_distribution_dataset,
      )
        ? metrics.evacuation_center_distribution_dataset.map((item) => ({
            name: item.name,
            value: Number(item.value || 0),
          }))
        : [],
      relief_distribution_per_barangay: Array.isArray(
        metrics.relief_distribution_dataset,
      )
        ? metrics.relief_distribution_dataset.map((item) => ({
            name: item.name,
            value: Number(item.value || 0),
          }))
        : [],
      daily_admission_trend: Array.isArray(metrics.daily_admission_trend_dataset)
        ? metrics.daily_admission_trend_dataset.map((item) => ({
            name: item.name,
            date: item.date,
            value: Number(item.value || 0),
          }))
        : [],
    },
    has_data:
      Number(metrics.total_number_of_evacuees_individuals || 0) > 0 ||
      Number(metrics.total_number_of_families || 0) > 0 ||
      Number(metrics.currently_admitted_evacuees || 0) > 0 ||
      Number(metrics.total_departed_evacuees || 0) > 0,
  };
};

const getHouseholdSectorIds = (household) => {
  return [
    ...(household.household_sectors || []).map((sector) => sector.id),
    ...(household.members || []).flatMap((member) =>
      (member.sectors || []).map((sector) => sector.id),
    ),
  ].filter(Boolean);
};

const filterMasterlistBySectorIds = (households, sectorIds = []) => {
  if (!Array.isArray(sectorIds) || sectorIds.length === 0) {
    return households;
  }

  const selectedSectorIds = new Set(sectorIds);

  return households.filter((household) =>
    getHouseholdSectorIds(household).some((sectorId) =>
      selectedSectorIds.has(sectorId),
    ),
  );
};

const filterMasterlistByBarangayIds = (households, barangayIds = []) => {
  if (!Array.isArray(barangayIds) || barangayIds.length === 0) {
    return households;
  }

  const selectedBarangayIds = new Set(barangayIds);

  return households.filter((household) =>
    selectedBarangayIds.has(household?.barangay?.id),
  );
};

const isOperationallyActiveHousehold = (household) => {
  if (!household || household.is_active === false) {
    return false;
  }

  const latestStatus = String(household.latest_attendance?.status || "").toUpperCase();

  if (household.latest_attendance?.time_out) {
    return false;
  }

  if (latestStatus === "LEFT") {
    return false;
  }

  return true;
};

const filterMasterlistByRecordStatus = (households, recordStatus = "active") => {
  if (recordStatus === "archived") {
    return households.filter(
      (household) => !isOperationallyActiveHousehold(household),
    );
  }

  if (recordStatus === "all") {
    return households;
  }

  return households.filter(isOperationallyActiveHousehold);
};

const buildExportIdentityKey = (household, disasterEventId) => {
  const familyHeadName = String(household?.family_head_name || "")
    .trim()
    .toUpperCase();

  return [disasterEventId || "", household?.barangay?.id || "", familyHeadName].join(
    "|",
  );
};

const buildExportSummaryMetrics = (households, disasterEventId) => {
  const latestHouseholdsByIdentity = new Map();

  households.forEach((household) => {
    const identityKey = buildExportIdentityKey(household, disasterEventId);
    const currentTimestamp = new Date(household?.registered_at || 0).getTime();
    const existingHousehold = latestHouseholdsByIdentity.get(identityKey);
    const existingTimestamp = new Date(
      existingHousehold?.registered_at || 0,
    ).getTime();

    if (!existingHousehold || currentTimestamp >= existingTimestamp) {
      latestHouseholdsByIdentity.set(identityKey, household);
    }
  });

  const latestHouseholds = [...latestHouseholdsByIdentity.values()];
  const totalNumberOfFamilies = latestHouseholds.length;
  const totalNumberOfEvacueesIndividuals = latestHouseholds.reduce(
    (total, household) => total + Number(household?.household_size || 0),
    0,
  );
  const currentlyAdmittedEvacuees = latestHouseholds.reduce((total, household) => {
    const isEvacuationCenterStay =
      String(household?.current_stay_type || "").toUpperCase() === "EVAC_CENTER";

    if (!isEvacuationCenterStay || !isOperationallyActiveHousehold(household)) {
      return total;
    }

    return total + Number(household?.household_size || 0);
  }, 0);
  const totalDepartedEvacuees = latestHouseholds.reduce((total, household) => {
    const isEvacuationCenterStay =
      String(household?.current_stay_type || "").toUpperCase() === "EVAC_CENTER";

    if (isEvacuationCenterStay && !isOperationallyActiveHousehold(household)) {
      return total + Number(household?.household_size || 0);
    }

    return total;
  }, 0);
  const totalBarangaysCovered = new Set(
    latestHouseholds.map((household) => household?.barangay?.id).filter(Boolean),
  ).size;

  return {
    total_number_of_evacuees_individuals: totalNumberOfEvacueesIndividuals,
    total_number_of_families: totalNumberOfFamilies,
    average_household_size:
      totalNumberOfFamilies > 0
        ? totalNumberOfEvacueesIndividuals / totalNumberOfFamilies
        : 0,
    currently_admitted_evacuees: currentlyAdmittedEvacuees,
    total_departed_evacuees: totalDepartedEvacuees,
    total_barangays_covered: totalBarangaysCovered,
  };
};

const exportMswdoMasterlist = async (filters) => {
  await disasterEventService.syncOverdueActiveDisasterEvents();

  const [masterlist, dashboard] = await Promise.all([
    getMasterlist({
      disaster_event_id: filters.disaster_event_id,
      barangay_id: null,
      record_status: filters.record_status === "active" ? "active" : "all",
    }),
    getMswdoMasterlistDashboard({
      disaster_event_id: filters.disaster_event_id,
      barangay_id:
        Array.isArray(filters.barangay_ids) && filters.barangay_ids.length === 1
          ? filters.barangay_ids[0]
          : filters.barangay_id,
    }),
  ]);

  const recordStatusFilteredRows = filterMasterlistByRecordStatus(
    masterlist.data || [],
    filters.record_status || "active",
  );
  const barangayFilteredRows = filterMasterlistByBarangayIds(
    recordStatusFilteredRows,
    filters.barangay_ids || [],
  );
  const sectorFilteredRows = filterMasterlistBySectorIds(
    barangayFilteredRows,
    filters.sector_ids || [],
  );
  const exportSummaryMetrics =
    Array.isArray(filters.barangay_ids) && filters.barangay_ids.length > 1
      ? buildExportSummaryMetrics(sectorFilteredRows, filters.disaster_event_id)
      : dashboard.summary_metrics;

  const exportRows = filterExportRows(
    sectorFilteredRows.map(mapHouseholdToExportRow),
    filters.search || "",
  );
  const sortedExportRows = sortExportRows(
    exportRows,
    filters.sort_order || "newest",
  );

  if (sortedExportRows.length === 0) {
    const error = new Error("No masterlist data available for export.");
    error.statusCode = 404;
    throw error;
  }

  const includeBarangayColumn = (filters.barangay_ids || []).length !== 1;
  const columns = buildExportColumns(includeBarangayColumn);
  const eventLabel = masterlist.disaster_event
    ? `${masterlist.disaster_event.event_code} - ${masterlist.disaster_event.title}`
    : "No disaster event selected";

  const barangayLabel =
    Array.isArray(filters.barangay_ids) && filters.barangay_ids.length > 0
      ? filters.barangay_ids.length === 1
        ? sortedExportRows[0]?.barangay_name || "Selected barangay"
        : "Selected Barangays"
      : "All Barangays";
  const sourceName =
    filters.source_role === ROLE_CODES.BARANGAY
      ? `Barangay ${sortedExportRows[0]?.barangay_name || barangayLabel}`
      : "MSWDO";

  const titleLines = buildExportTitleLines({
    eventLabel,
    barangayLabel,
    searchTerm: filters.search,
    sourceName,
  });

  const filename = buildExportFilename({
    eventCode: masterlist.disaster_event?.event_code,
    barangayName: barangayLabel,
    format: filters.format,
  });

  if (filters.format === "csv") {
    return {
      filename,
      contentType: "text/csv; charset=utf-8",
      buffer: buildCsvBuffer({
        titleLines,
        columns,
        rows: sortedExportRows,
      }),
    };
  }

  if (filters.format === "excel") {
    return {
      filename: buildExcelFilename({
        eventCode: masterlist.disaster_event?.event_code,
        barangayName: barangayLabel,
      }),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await buildExcelBuffer({
        worksheetName: "Evacuee Masterlist",
        rows: sortedExportRows,
        summaryMetrics: exportSummaryMetrics,
        eventLabel,
        barangayLabel,
        searchTerm: filters.search,
        includeBarangayColumn,
        sourceName,
      }),
    };
  }

  return {
    filename: buildPdfFilename({
      eventCode: masterlist.disaster_event?.event_code,
      barangayName: barangayLabel,
    }),
    contentType: "application/pdf",
    buffer: buildPdfBuffer({
      rows: sortedExportRows,
      summaryMetrics: exportSummaryMetrics,
      eventLabel,
      eventCode: masterlist.disaster_event?.event_code,
      barangayLabel,
      searchTerm: filters.search,
      includeBarangayColumn,
      sourceName,
    }),
  };
};

const getBarangayDashboard = async (filters) => {
  await disasterEventService.syncOverdueActiveDisasterEvents();

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

  const scopedStatuses =
    BARANGAY_EVENT_STATUSES[filters.event_scope] || BARANGAY_EVENT_STATUSES.active;
  const scopedEvents =
    await masterlistRepository.getBarangayScopedDisasterEventsByStatuses(
      effectiveBarangay.id,
      scopedStatuses,
    );

  let selectedDisasterEvent = null;

  if (filters.disaster_event_id) {
    selectedDisasterEvent =
      await masterlistRepository.getBarangayScopedDisasterEventById(
        filters.disaster_event_id,
        effectiveBarangay.id,
      );
  }

  if (
    selectedDisasterEvent &&
    !scopedStatuses.includes(selectedDisasterEvent.status)
  ) {
    selectedDisasterEvent = null;
  }

  if (!selectedDisasterEvent && scopedEvents.length > 0) {
    selectedDisasterEvent = scopedEvents[0];
  }

  const metrics = selectedDisasterEvent
    ? await masterlistRepository.getBarangayDashboardMetrics(
        selectedDisasterEvent.id,
        effectiveBarangay.id,
      )
    : {
        total_evacuees_individuals: 0,
        total_families: 0,
        currently_admitted_evacuees: 0,
        total_departed_evacuees: 0,
      };

  const hasData =
    Number(metrics.total_evacuees_individuals || 0) > 0 ||
    Number(metrics.total_families || 0) > 0 ||
    Number(metrics.currently_admitted_evacuees || 0) > 0 ||
    Number(metrics.total_departed_evacuees || 0) > 0;

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
    event_scope: filters.event_scope,
    available_events: scopedEvents,
    selected_event: selectedDisasterEvent,
    metrics,
    has_data: hasData,
  };
};

module.exports = {
  exportMswdoMasterlist,
  getBarangayDashboard,
  getMasterlist,
  getMswdoMasterlistDashboard,
};
