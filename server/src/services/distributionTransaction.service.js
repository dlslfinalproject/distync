const pool = require("../config/db");
const distributionTransactionRepository = require("../repositories/distributionTransaction.repository");
const disasterEventRepository = require("../repositories/disasterEvent.repository");
const reliefPackTemplateRepository = require("../repositories/reliefPackTemplate.repository");
const notificationService = require("../modules/notifications/notification.service");
const stubRepository = require("../repositories/stub.repository");
const settingsRepository = require("../repositories/settings.repository");
const inventoryItemRepository = require("../repositories/inventoryItem.repository");
const masterlistService = require("./masterlist.service");
const {
  getAvailableDonatedLooseItemsForClaimPreview,
  getAvailableDonatedReliefPacksForClaimPreview,
  recordAutomaticReliefPackClaim,
} = require("./automaticReliefPackClaim.service");
const {
  getAssignedReliefPackTemplatesForSectorIds,
  getPrimaryAssignedReliefPackTemplate,
  resolveAssignedReliefPackTemplatesForHousehold,
} = require("./reliefPackAssignment.service");
const { logAuditSafely, pickDefined } = require("../utils/systemLog");
const mswdoReportExport = require("../utils/mswdoReportExport");
const {
  getInventoryBatchStatus,
} = require("../utils/inventoryBatchStatus");
const {
  isReliefPackClaimHouseholdCurrentlyEligible,
} = require("../utils/reliefPackEligibility");

const buildFullName = (firstName, middleName, lastName, suffix) => {
  return [firstName, middleName, lastName, suffix].filter(Boolean).join(" ");
};

const getTemplateFamilySizeCoverage = (template) => {
  const parsedCoverage = Number.parseInt(String(template?.description || "").trim(), 10);
  return Number.isInteger(parsedCoverage) && parsedCoverage > 0 ? parsedCoverage : 0;
};

const getTemplatePackMultiplier = (template, householdSize) => {
  if (!template?.based_on_family_size) {
    return 1;
  }

  const normalizedHouseholdSize = Number.parseInt(String(householdSize || 0), 10);
  const familySizeCoverage = getTemplateFamilySizeCoverage(template);

  if (
    !Number.isInteger(normalizedHouseholdSize) ||
    normalizedHouseholdSize <= 0 ||
    familySizeCoverage <= 0
  ) {
    return 1;
  }

  return Math.max(1, Math.ceil(normalizedHouseholdSize / familySizeCoverage));
};

const formatStubDisplayNo = (sequenceNo, fallbackStubNo = null) => {
  const parsedSequenceNo = Number(sequenceNo || 0);
  return parsedSequenceNo > 0 ? `STUB#${parsedSequenceNo}` : fallbackStubNo || "--";
};

const getHistoryRowTime = (row) => {
  const parsedTime = new Date(row?.distribution_date || 0).getTime();
  return Number.isNaN(parsedTime) ? 0 : parsedTime;
};

const sortDistributionHistoryRows = (rows, sortOrder = "newest") => {
  return [...rows].sort((leftRow, rightRow) => {
    if (sortOrder === "az" || sortOrder === "za") {
      const comparison = String(leftRow.family_head_name || "").localeCompare(
        String(rightRow.family_head_name || ""),
        undefined,
        { sensitivity: "base" },
      );

      return sortOrder === "za" ? -comparison : comparison;
    }

    const leftTime = getHistoryRowTime(leftRow);
    const rightTime = getHistoryRowTime(rightRow);

    return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });
};

const buildReportSourceName = (requester, rows = []) => {
  if (requester?.roleCode !== ROLE_CODES.BARANGAY) {
    return "MSWDO";
  }

  const barangayName = rows.find((row) => row.barangay_name)?.barangay_name;
  return barangayName ? `Barangay ${barangayName}` : "Barangay";
};

const formatDisasterEventStatusLabel = (status) =>
  String(status || "").toUpperCase() === "ACTIVE" ? "Active" : "Ended";

const buildDistributionHistorySummaryRows = ({
  rows,
  disasterEvents = [],
  selectedBarangayId = null,
}) => {
  const summaryByEventId = new Map();

  (Array.isArray(disasterEvents) ? disasterEvents : []).forEach((event) => {
    const affectedBarangays = Array.isArray(event?.affected_barangays)
      ? event.affected_barangays
      : [];
    const affectedBarangayIds = affectedBarangays
      .map((barangay) => barangay?.id || barangay?.barangay_id || "")
      .filter(Boolean);

    if (
      selectedBarangayId &&
      affectedBarangayIds.length > 0 &&
      !affectedBarangayIds.includes(selectedBarangayId)
    ) {
      return;
    }

    const barangayNames = selectedBarangayId
      ? affectedBarangays
          .filter(
            (barangay) =>
              (barangay?.id || barangay?.barangay_id || "") === selectedBarangayId,
          )
          .map((barangay) => barangay?.name)
          .filter(Boolean)
      : affectedBarangays.map((barangay) => barangay?.name).filter(Boolean);

    summaryByEventId.set(event.id, {
      disaster_event_id: event.id,
      event_code: event.event_code || "",
      disaster_event_title: event.title || "--",
      disaster_event_status: event.status || "",
      start_date: event.start_date || null,
      barangayNames: new Set(barangayNames),
      reliefPacks: new Set(),
      latest_distribution_date: null,
      issued_stubs_count: 0,
      claimed_stubs_count: 0,
      unclaimed_stubs_count: 0,
    });
  });

  rows.forEach((row) => {
    const eventId = row.disaster_event_id || "unknown-event";
    const existingSummary = summaryByEventId.get(eventId) || {
      disaster_event_id: eventId,
      event_code: row.event_code || "",
      disaster_event_title: row.disaster_event_title || "--",
      disaster_event_status: row.disaster_event_status || "",
      start_date: row.start_date || null,
      barangayNames: new Set(),
      reliefPacks: new Set(),
      latest_distribution_date: null,
      issued_stubs_count: Number(row.issued_stubs_count || 0),
      claimed_stubs_count: Number(row.claimed_stubs_count || 0),
      unclaimed_stubs_count: Number(row.unclaimed_stubs_count || 0),
    };

    if (row.barangay_name) {
      existingSummary.barangayNames.add(row.barangay_name);
    }

    const reliefPackName =
      row.relief_pack_template_name || row.released_items_summary || "";
    if (reliefPackName) {
      existingSummary.reliefPacks.add(reliefPackName);
    }

    existingSummary.issued_stubs_count = Number(
      row.issued_stubs_count || existingSummary.issued_stubs_count || 0,
    );
    existingSummary.claimed_stubs_count = Number(
      row.claimed_stubs_count || existingSummary.claimed_stubs_count || 0,
    );
    existingSummary.unclaimed_stubs_count = Number(
      row.unclaimed_stubs_count || existingSummary.unclaimed_stubs_count || 0,
    );

    const currentLatestTime = getHistoryRowTime({
      distribution_date: existingSummary.latest_distribution_date,
    });
    const rowTime = getHistoryRowTime(row);

    if (rowTime > currentLatestTime) {
      existingSummary.latest_distribution_date = row.distribution_date;
    }

    summaryByEventId.set(eventId, existingSummary);
  });

  return Array.from(summaryByEventId.values()).map((summary) => ({
    disaster_event_id: summary.disaster_event_id,
    event_code: summary.event_code,
    disaster_event_title: summary.disaster_event_title,
    disaster_event_status: summary.disaster_event_status,
    start_date: summary.start_date,
    barangay_summary: Array.from(summary.barangayNames).sort().join(", ") || "--",
    barangay_count: summary.barangayNames.size,
    issued_stubs_count: summary.issued_stubs_count,
    claimed_stubs_count: summary.claimed_stubs_count,
    unclaimed_stubs_count: summary.unclaimed_stubs_count,
    relief_pack_summary: Array.from(summary.reliefPacks).sort().join(", ") || "--",
    latest_distribution_date: summary.latest_distribution_date,
  }));
};

const attachDistributionHistoryStubCounts = async ({
  rows,
  requester,
  filters,
}) => {
  if (!Array.isArray(rows) || rows.length === 0 || filters?.disaster_event_id) {
    return rows;
  }

  const eventIds = [...new Set(rows.map((row) => row.disaster_event_id).filter(Boolean))];

  if (eventIds.length === 0) {
    return rows;
  }

  const stubSummaryRows =
    await distributionTransactionRepository.getDistributionHistoryStubSummaryByEventIds({
      eventIds,
      barangayId:
        requester?.roleCode === BARANGAY_ROLE_CODE
          ? requester.defaultBarangayId
          : filters?.barangay_id || null,
    });

  const stubSummaryByEventId = new Map(
    stubSummaryRows.map((row) => [row.disaster_event_id, row]),
  );

  return rows.map((row) => {
    const stubSummary = stubSummaryByEventId.get(row.disaster_event_id);

    return {
      ...row,
      issued_stubs_count: Number(stubSummary?.issued_stubs_count || 0),
      claimed_stubs_count: Number(stubSummary?.claimed_stubs_count || 0),
      unclaimed_stubs_count: Number(stubSummary?.unclaimed_stubs_count || 0),
    };
  });
};

const sortDistributionHistorySummaryRows = (rows, sortOrder = "newest") => {
  return [...rows].sort((leftRow, rightRow) => {
    if (sortOrder === "az" || sortOrder === "za") {
      const comparison = String(leftRow.disaster_event_title || "").localeCompare(
        String(rightRow.disaster_event_title || ""),
        undefined,
        { sensitivity: "base" },
      );

      return sortOrder === "za" ? -comparison : comparison;
    }

    const leftTime = getHistoryRowTime({
      distribution_date: leftRow.latest_distribution_date,
    });
    const rightTime = getHistoryRowTime({
      distribution_date: rightRow.latest_distribution_date,
    });

    if (leftTime !== rightTime) {
      return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    }

    const leftStartTime = new Date(leftRow?.start_date || 0).getTime();
    const rightStartTime = new Date(rightRow?.start_date || 0).getTime();

    if (leftStartTime !== rightStartTime) {
      return sortOrder === "oldest"
        ? leftStartTime - rightStartTime
        : rightStartTime - leftStartTime;
    }

    return 0;
  });
};

const buildPaginationMetadata = ({ page, pageSize, totalItems }) => {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safePageSize =
    Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 25;
  const safeTotalItems = Number(totalItems || 0);
  const totalPages =
    safeTotalItems > 0 ? Math.ceil(safeTotalItems / safePageSize) : 0;

  return {
    page: safePage,
    pageSize: safePageSize,
    totalItems: safeTotalItems,
    totalPages,
    hasPreviousPage: safeTotalItems > 0 && safePage > 1,
    hasNextPage: totalPages > 0 && safePage < totalPages,
  };
};

const attachAffectedBarangaysToEvents = async (events) => {
  if (!Array.isArray(events) || events.length === 0) {
    return [];
  }

  const affectedBarangays =
    await disasterEventRepository.getAffectedBarangaysByDisasterEventIds(
      events.map((event) => event.id).filter(Boolean),
    );
  const affectedBarangaysByEventId = affectedBarangays.reduce((grouped, row) => {
    if (!grouped[row.disaster_event_id]) {
      grouped[row.disaster_event_id] = [];
    }

    grouped[row.disaster_event_id].push(row);
    return grouped;
  }, {});

  return events.map((event) => ({
    ...event,
    affected_barangays: affectedBarangaysByEventId[event.id] || [],
  }));
};

const getDistributionHistorySummaryEvents = async ({ requester, filters }) => {
  if (requester?.roleCode === BARANGAY_ROLE_CODE) {
    const barangayId = await resolveRequesterBarangayId(requester);

    if (!barangayId) {
      return [];
    }

    const events = await disasterEventRepository.getDisasterEventsByBarangayId(
      barangayId,
    );
    return attachAffectedBarangaysToEvents(events);
  }

  const events = await disasterEventRepository.getAllDisasterEvents();
  return attachAffectedBarangaysToEvents(events);
};

const groupByKey = (rows, key) => {
  return rows.reduce((groupedRows, row) => {
    const groupKey = row[key];

    if (!groupKey) {
      return groupedRows;
    }

    if (!groupedRows[groupKey]) {
      groupedRows[groupKey] = [];
    }

    groupedRows[groupKey].push(row);
    return groupedRows;
  }, {});
};

const mapInventoryDistributionDetail = (detail) => {
  if (!detail) {
    return null;
  }

  const base = detail.base;
  const memberSectorsByEvacueeId = groupByKey(
    detail.member_sectors || [],
    "evacuee_id",
  );
  const members = (detail.members || []).map((member) => ({
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
    sectors: (memberSectorsByEvacueeId[member.evacuee_id] || []).map((sector) => ({
      id: sector.id,
      code: sector.code,
      name: sector.name,
    })),
  }));

  return {
    stub: {
      id: base.stub_id,
      stub_no: base.stub_no,
      serial_no: base.serial_no,
      status: base.stub_status,
      issued_at: base.issued_at,
      claimed_at: base.claimed_at,
      updated_at: base.stub_updated_at,
      qr_code_value: base.qr_code_value,
      qr_generated_at: base.qr_generated_at,
      qr_status: base.qr_status,
      qr_notes: base.qr_notes,
    },
    disaster_event: {
      id: base.disaster_event_id,
      event_code: base.event_code,
      title: base.disaster_event_title,
      disaster_type: base.disaster_type,
    },
    household: {
      id: base.household_id,
      family_head_name: buildFullName(
        base.family_head_first_name,
        base.family_head_middle_name,
        base.family_head_last_name,
        base.family_head_suffix,
      ),
      household_size: base.household_size,
      residency_status: base.residency_status,
      contact_number: base.contact_number,
      current_stay_type: base.current_stay_type,
      current_address_details: base.current_address_details,
      is_active: base.is_active,
      registered_at: base.registered_at,
      registered_by: base.registered_by,
      registered_by_name: base.registered_by_name,
      family_head_photo_url: base.family_head_photo_url,
      photo_captured_at: base.photo_captured_at,
      photo_verification_notes: base.photo_verification_notes,
      members,
    },
    barangay: {
      id: base.barangay_id,
      code: base.barangay_code,
      name: base.barangay_id ? base.barangay_name : "Non-Resident (Outside Malvar)",
    },
    household_sectors: (detail.household_sectors || []).map((sector) => ({
      id: sector.id,
      code: sector.code,
      name: sector.name,
    })),
    member_sectors: detail.member_sectors || [],
    latest_attendance: detail.latest_attendance || null,
    distribution_transaction: detail.distribution_transaction || null,
  };
};

const getInventoryDistributionDetail = async ({ stubId }) => {
  const detail =
    await distributionTransactionRepository.getInventoryDistributionDetailByStubId(
      stubId,
    );

  return mapInventoryDistributionDetail(detail);
};

const getStandardTemplates = (templates) => {
  return (Array.isArray(templates) ? templates : [])
    .filter((template) => template.is_active && !template.is_additional_pack)
    .sort((left, right) => {
      if (left.based_on_family_size && !right.based_on_family_size) {
        return -1;
      }

      if (!left.based_on_family_size && right.based_on_family_size) {
        return 1;
      }

      return String(left.name || "").localeCompare(String(right.name || ""));
    });
};

const getHouseholdSectorIdsFromMasterlist = (household) => {
  return [
    ...(household?.household_sectors || []).map((sector) => sector.id),
    ...(household?.members || [])
      .filter((member) => member?.is_active !== false)
      .flatMap((member) => (member.sectors || []).map((sector) => sector.id)),
  ].filter(Boolean);
};

const buildInventoryExportSectorsText = (household) => {
  const sectorNames = [
    ...(household?.household_sectors || []).map((sector) => sector.name),
    ...(household?.members || []).flatMap((member) =>
      (member.sectors || []).map((sector) => sector.name),
    ),
  ].filter(Boolean);

  return [...new Set(sectorNames)].join(", ") || "--";
};

const getAssignedTemplatesForExport = (
  household,
  templates,
  disasterType = null,
) => {
  return getAssignedReliefPackTemplatesForSectorIds(
    getHouseholdSectorIdsFromMasterlist(household),
    templates,
    disasterType,
  );
};

const parseDonatedReliefPackName = (remarks) => {
  const normalizedRemarks = String(remarks || "").trim();

  if (!normalizedRemarks.toLowerCase().startsWith("relief pack:")) {
    return "";
  }

  return normalizedRemarks
    .replace(/^Relief Pack:\s*/i, "")
    .split(".")[0]
    .replace(/\sx\s\d+$/i, "")
    .trim();
};

const addUniqueInventoryExportLine = (lineMap, value) => {
  const label = String(value || "").trim();

  if (!label || label === "--") {
    return;
  }

  const key = label.toUpperCase();

  if (!lineMap.has(key)) {
    lineMap.set(key, label);
  }
};

const formatInventoryExportReliefPack = ({
  templates = [],
  sourceRows = [],
  donatedReliefPacks = [],
  donatedLooseItems = [],
}) => {
  const lineMap = new Map();

  sourceRows.forEach((row) => {
    addUniqueInventoryExportLine(lineMap, row.relief_pack_template_name);

    if (row.is_relief_pack_donation) {
      addUniqueInventoryExportLine(
        lineMap,
        parseDonatedReliefPackName(row.donation_item_remarks),
      );
      return;
    }

    if (row.donor_name) {
      addUniqueInventoryExportLine(lineMap, `${row.donor_name} Donation`);
    }
  });

  donatedReliefPacks.forEach((pack) => {
    addUniqueInventoryExportLine(lineMap, pack.name);
  });

  donatedLooseItems.forEach((item) => {
    const donorName = String(item.donor_name || "").trim();
    addUniqueInventoryExportLine(
      lineMap,
      donorName ? `${donorName} Donation` : "Donor Donation",
    );
  });

  templates.forEach((template) => {
    addUniqueInventoryExportLine(lineMap, template.name || "Relief Pack");
  });

  return lineMap.size > 0
    ? [...lineMap.values()].join("; ")
    : "Template linkage pending";
};

const getInventoryExportStatusLabel = (status, disasterEventStatus) => {
  if (status === "CLAIMED") {
    return "Claimed";
  }

  if (status === "ISSUED") {
    return disasterEventStatus === "ACTIVE" ? "For Claim" : "Not Claimed";
  }

  return "--";
};

const getInventoryExportSortableDate = (row) => {
  const parsedTime = new Date(row?.registered_at || 0).getTime();
  return Number.isNaN(parsedTime) ? 0 : parsedTime;
};

const sortInventoryExportRows = (rows, sortOrder = "newest") => {
  return [...rows].sort((leftRow, rightRow) => {
    if (sortOrder === "az" || sortOrder === "za") {
      const comparison = String(leftRow.family_head_name || "").localeCompare(
        String(rightRow.family_head_name || ""),
        undefined,
        { sensitivity: "base" },
      );

      return sortOrder === "za" ? -comparison : comparison;
    }

    const leftTime = getInventoryExportSortableDate(leftRow);
    const rightTime = getInventoryExportSortableDate(rightRow);

    return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });
};

const loadInventoryExportTemplates = async (disasterEvent) => {
  const templates = await reliefPackTemplateRepository.getReliefPackTemplates({
    is_active: true,
    based_on_family_size: null,
    based_on_sector: null,
    disaster_type: disasterEvent?.disaster_type || null,
    search: "",
  });

  const standardTemplates = getStandardTemplates(templates);
  const additionalTemplates = templates.filter(
    (template) => template.is_active && template.is_additional_pack,
  );
  const selectedTemplates = [...standardTemplates, ...additionalTemplates];

  return Promise.all(
    selectedTemplates.map(async (template) => {
      const items =
        await reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId(
          template.id,
        );

      return {
        ...template,
        items: items.map((item) => ({
          quantity_required: item.quantity_required,
          inventory_item: {
            item_name: item.item_name,
          },
        })),
      };
    }),
  );
};

const filterInventoryExportByBarangays = (rows, barangayIds = []) => {
  if (!Array.isArray(barangayIds) || barangayIds.length === 0) {
    return rows;
  }

  const selectedBarangayIds = new Set(barangayIds);
  return rows.filter((row) => selectedBarangayIds.has(row?.barangay?.id));
};

const filterInventoryExportBySectors = (rows, sectorIds = []) => {
  if (!Array.isArray(sectorIds) || sectorIds.length === 0) {
    return rows;
  }

  const selectedSectorIds = new Set(sectorIds);

  return rows.filter((row) =>
    getHouseholdSectorIdsFromMasterlist(row).some((sectorId) =>
      selectedSectorIds.has(sectorId),
    ),
  );
};

const getAffectedBarangayIdsForExport = async (disasterEventId) => {
  const affectedBarangays =
    await disasterEventRepository.getAffectedBarangaysByDisasterEventId(
      disasterEventId,
    );

  return affectedBarangays
    .map((barangay) => barangay?.id || barangay?.barangay_id)
    .filter(Boolean);
};

const getScopedInventoryExportBarangayIds = async ({
  disasterEventId,
  requestedBarangayIds = [],
}) => {
  const affectedBarangayIds = await getAffectedBarangayIdsForExport(disasterEventId);

  if (!Array.isArray(requestedBarangayIds) || requestedBarangayIds.length === 0) {
    return affectedBarangayIds;
  }

  const affectedBarangayIdSet = new Set(affectedBarangayIds);
  return requestedBarangayIds.filter((barangayId) =>
    affectedBarangayIdSet.has(barangayId),
  );
};

const getInventoryExportRowStatus = (household) => {
  if (household?.stub?.status === "CLAIMED") {
    return "CLAIMED";
  }

  if (household?.stub?.status === "ISSUED") {
    return "ISSUED";
  }

  return "";
};

const filterInventoryExportByStatus = (rows, status) => {
  if (!status) {
    return rows;
  }

  return rows.filter((row) => getInventoryExportRowStatus(row) === status);
};

const getInventoryDistributionExportContext = async (filters) => {
  const masterlist = await masterlistService.getMasterlist({
    disaster_event_id: filters.disaster_event_id,
    barangay_id: null,
    record_status: "all",
  });
  const disasterEvent =
    (await disasterEventRepository.getDisasterEventById(
      filters.disaster_event_id,
    )) || masterlist.disaster_event;
  const scopedBarangayIds = await getScopedInventoryExportBarangayIds({
    disasterEventId: filters.disaster_event_id,
    requestedBarangayIds: filters.barangay_ids || [],
  });
  const barangayFilteredRows =
    scopedBarangayIds.length > 0
      ? filterInventoryExportByBarangays(masterlist.data || [], scopedBarangayIds)
      : [];
  const statusFilteredRows = filterInventoryExportByStatus(
    barangayFilteredRows,
    filters.status,
  );
  const sectorFilteredRows = filterInventoryExportBySectors(
    statusFilteredRows,
    filters.sector_ids || [],
  );

  return {
    disasterEvent,
    affectedBarangayIds: await getAffectedBarangayIdsForExport(
      filters.disaster_event_id,
    ),
    scopedBarangayIds,
    optionRows: statusFilteredRows,
    exportRows: sectorFilteredRows,
  };
};

const formatInventoryExportEventLabel = (event) =>
  [event?.event_code, event?.title].filter(Boolean).join(" - ") ||
  event?.title ||
  "No disaster event selected";

const getInventoryExportBarangayLabel = (rows, barangayIds = []) => {
  if (!Array.isArray(barangayIds) || barangayIds.length === 0) {
    return "All Barangays";
  }

  if (barangayIds.length === 1) {
    return rows[0]?.barangay?.name || "Selected barangay";
  }

  return "Selected Barangays";
};

const getInventoryDistributionExportOptions = async ({ requester, filters }) => {
  if (
    requester?.roleCode !== ROLE_CODES.MSWDO &&
    requester?.roleCode !== ROLE_CODES.MAYOR
  ) {
    const error = new Error(
      "Only MSWDO and Office of the Mayor can view inventory distribution export options.",
    );
    error.statusCode = 403;
    throw error;
  }

  const context = await getInventoryDistributionExportContext({
    ...filters,
    sector_ids: [],
  });
  const availableSectorIds = [
    ...new Set(
      context.optionRows.flatMap((household) =>
        getHouseholdSectorIdsFromMasterlist(household),
      ),
    ),
  ];

  return {
    available_barangay_ids: context.affectedBarangayIds,
    selected_barangay_ids: context.scopedBarangayIds,
    available_sector_ids: availableSectorIds,
  };
};

const exportInventoryDistribution = async ({ requester, filters }) => {
  if (
    requester?.roleCode !== ROLE_CODES.MSWDO &&
    requester?.roleCode !== ROLE_CODES.MAYOR
  ) {
    const error = new Error(
      "Only MSWDO and Office of the Mayor can export inventory distribution reports.",
    );
    error.statusCode = 403;
    throw error;
  }

  const context = await getInventoryDistributionExportContext(filters);
  const disasterEvent = context.disasterEvent;
  const templates = await loadInventoryExportTemplates(disasterEvent);
  const exportStubIds = context.exportRows
    .map((household) => household?.stub?.id)
    .filter(Boolean);
  const reliefSourceRows =
    await distributionTransactionRepository.getLatestDistributionReliefSourcesByStubIds(
      exportStubIds,
    );
  const reliefSourceRowsByStubId = groupByKey(reliefSourceRows, "stub_id");
  const mappedRows = await Promise.all(context.exportRows.map(async (household) => {
    const assignedTemplates = getAssignedTemplatesForExport(
      household,
      templates,
      disasterEvent?.disaster_type,
    );
    const stubStatus = getInventoryExportRowStatus(household);
    const sourceRows = reliefSourceRowsByStubId[household?.stub?.id] || [];
    const stubQueueContext =
      stubStatus === "ISSUED" && household?.stub?.id
        ? await distributionTransactionRepository.getPresentUnclaimedStubQueueContext(
            household.stub.id,
          )
        : { queue_position: 0, eligible_households_count: 0 };
    const donatedReliefPacks =
      stubStatus === "ISSUED"
        ? await getAvailableDonatedReliefPacksForClaimPreview(
            filters.disaster_event_id,
            stubQueueContext.queue_position,
          )
        : [];
    const donatedLooseItems =
      stubStatus === "ISSUED"
        ? await getAvailableDonatedLooseItemsForClaimPreview(
            filters.disaster_event_id,
            stubQueueContext.queue_position,
            stubQueueContext.eligible_households_count,
          )
        : [];

    return {
      family_head_name: household.family_head_name || "--",
      barangay_name: household.barangay?.name || "--",
      address:
        household.current_address_details ||
        household.barangay?.name ||
        "--",
      family_members_count: household.household_size || household.members?.length || 0,
      sectors_text: buildInventoryExportSectorsText(household),
      relief_pack_summary: formatInventoryExportReliefPack({
        templates: assignedTemplates,
        sourceRows,
        donatedReliefPacks,
        donatedLooseItems,
      }),
      claimed_date_time:
        stubStatus === "CLAIMED"
          ? mswdoReportExport.formatDateTime(
              sourceRows[0]?.received_at ||
                sourceRows[0]?.distribution_date ||
                household?.stub?.claimed_at,
            )
          : "--",
      distribution_status: stubStatus,
      status_label: getInventoryExportStatusLabel(stubStatus, disasterEvent?.status),
      registered_at: household.registered_at,
    };
  }));
  const sortedRows = sortInventoryExportRows(
    mappedRows,
    filters.sort_order || "newest",
  );

  if (sortedRows.length === 0) {
    const error = new Error("No inventory distribution data available for export.");
    error.statusCode = 404;
    throw error;
  }

  const includeBarangayColumn = context.scopedBarangayIds.length !== 1;
  const columns = [
    ...(includeBarangayColumn
      ? [{ key: "barangay_name", label: "Barangay", width: 20, pdfWidth: 70 }]
      : []),
    { key: "family_head_name", label: "Family Head", width: 28, pdfWidth: 95 },
    { key: "address", label: "Address", width: 32, pdfWidth: 105 },
    { key: "family_members_count", label: "Family Members", width: 16, pdfWidth: 50 },
    { key: "sectors_text", label: "Sectors", width: 30, pdfWidth: 105 },
    { key: "relief_pack_summary", label: "Relief Pack", width: 36, pdfWidth: 130 },
    { key: "status_label", label: "Status", width: 16, pdfWidth: 55 },
    { key: "claimed_date_time", label: "Claimed Date / Time", width: 22, pdfWidth: 75 },
  ];
  const eventLabel = formatInventoryExportEventLabel(disasterEvent);
  const barangayLabel = getInventoryExportBarangayLabel(
    sortedRows.map((row) => ({
      barangay: {
        name: row.barangay_name,
      },
    })),
    context.scopedBarangayIds,
  );

  const sourceName =
    requester?.roleCode === ROLE_CODES.MAYOR ? "Office of the Mayor" : "MSWDO";

  return mswdoReportExport.buildExportFile({
    filePrefix:
      requester?.roleCode === ROLE_CODES.MAYOR
        ? "office-mayor-inventory-distribution"
        : "mswdo-inventory-distribution",
    worksheetName: "Inventory Distribution",
    reportTitle: "Inventory Distribution Report",
    sourceName,
    metadata: [
      { label: "Disaster Event", value: eventLabel },
      { label: "Barangay", value: barangayLabel },
      {
        label: "Status",
        value: filters.status
          ? getInventoryExportStatusLabel(filters.status, disasterEvent?.status)
          : "All",
      },
    ],
    columns,
    rows: sortedRows,
    format: filters.format,
  });
};

const buildSectorsText = (
  householdId,
  householdSectorsByHouseholdId,
  memberSectorsByHouseholdId,
) => {
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

const attachHistorySectors = async (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const householdIds = [...new Set(rows.map((row) => row.household_id).filter(Boolean))];
  const [householdSectors, memberSectors] = await Promise.all([
    stubRepository.getHouseholdSectorsByHouseholdIds(householdIds),
    stubRepository.getMemberSectorsByHouseholdIds(householdIds),
  ]);
  const householdSectorsByHouseholdId = groupByKey(
    householdSectors,
    "household_id",
  );
  const memberSectorsByHouseholdId = groupByKey(memberSectors, "household_id");

  return rows.map((row) => ({
    ...row,
    sectors_text: buildSectorsText(
      row.household_id,
      householdSectorsByHouseholdId,
      memberSectorsByHouseholdId,
    ),
  }));
};

const ACTIVE_QR_STATUS = "ACTIVE";
const BARANGAY_ROLE_CODE = "BARANGAY";
const ROLE_CODES = {
  BARANGAY: "BARANGAY",
  MSWDO: "MSWDO",
  MAYOR: "MAYOR",
};
const STUB_ALREADY_CLAIMED_CODE = "STUB_ALREADY_CLAIMED";
const DISTRIBUTION_STUB_UNIQUE_CONSTRAINT = "distribution_transactions_stub_id_key";

const isDistributionStubUniqueViolation = (error) =>
  error?.code === "23505" &&
  error?.constraint === DISTRIBUTION_STUB_UNIQUE_CONSTRAINT;

const createDisasterEventNotActiveError = (stub) => {
  const error = new Error(
    "Relief distribution cannot be completed because the disaster event is not active.",
  );
  error.code = "DISASTER_EVENT_NOT_ACTIVE";
  error.statusCode = 400;
  error.entityServerId = stub?.id || null;
  return error;
};

const assertDisasterEventActiveForNewDistribution = (stub) => {
  if (stub?.disaster_event_status !== "ACTIVE") {
    throw createDisasterEventNotActiveError(stub);
  }
};

const createStubAlreadyClaimedError = ({
  stub,
  latestDistributionTransaction = null,
}) => {
  const error = new Error("This stub has already been used for distribution");
  error.code = STUB_ALREADY_CLAIMED_CODE;
  error.statusCode = 409;
  error.entityServerId = stub?.id || latestDistributionTransaction?.stub_id || null;
  error.serverPayload = {
    stub: stub
      ? pickDefined(stub, [
          "id",
          "stub_no",
          "serial_no",
          "status",
          "claimed_at",
          "disaster_event_id",
          "household_id",
        ])
      : {},
    distribution_transaction: latestDistributionTransaction
      ? pickDefined(latestDistributionTransaction, [
          "id",
          "disaster_event_id",
          "household_id",
          "stub_id",
          "distribution_status",
          "receipt_no",
          "received_at",
          "created_at",
        ])
      : null,
  };
  return error;
};

const throwStubAlreadyClaimedError = async (stub) => {
  const latestDistributionTransaction =
    await stubRepository.getLatestDistributionTransactionByStubId(stub?.id);

  throw createStubAlreadyClaimedError({
    stub,
    latestDistributionTransaction,
  });
};

const resolveRequesterBarangayId = async (requester) => {
  if (requester?.defaultBarangayId) {
    return requester.defaultBarangayId;
  }

  if (!requester?.userId) {
    return null;
  }

  const user = await settingsRepository.getUserById(requester.userId);
  return user?.default_barangay_id || null;
};

const assertBarangayDistributionScope = (stub, requester) => {
  if (requester?.roleCode !== BARANGAY_ROLE_CODE) {
    return;
  }

  if (!requester.defaultBarangayId) {
    const error = new Error(
      "Barangay distribution requires an account with an assigned barangay.",
    );
    error.statusCode = 403;
    throw error;
  }

  if (stub.barangay_id !== requester.defaultBarangayId) {
    const error = new Error(
      "You can only claim or distribute stubs under your assigned barangay.",
    );
    error.statusCode = 403;
    throw error;
  }
};

const STANDARD_DISASTER_TYPES = [
  "Typhoon",
  "Flood",
  "Earthquake",
  "Landslide",
  "Volcanic Eruption",
  "Storm Surge",
  "Drought / El Ni\u00f1o",
  "Tsunami",
  "Fire",
];

const isTemplateApplicableToDisasterType = (templateDisasterTypes, disasterType) => {
  const normalizedDisasterType = String(disasterType || "").trim();

  if (!normalizedDisasterType) {
    return true;
  }

  const isOtherDisasterType =
    !STANDARD_DISASTER_TYPES.includes(normalizedDisasterType);

  return (templateDisasterTypes || []).some((row) => {
    const normalizedTemplateType = String(row.disaster_type || "").trim();

    return (
      normalizedTemplateType === normalizedDisasterType ||
      (isOtherDisasterType && normalizedTemplateType === "Other")
    );
  });
};

const buildUpdatedItemStockSnapshot = (inventoryItem, onHandQuantity) => {
  const normalizedOnHandQuantity = Math.max(Number(onHandQuantity || 0), 0);
  const normalizedPackaging = String(inventoryItem?.packaging || "").toLowerCase();
  const unitsPerPackage = Number(inventoryItem?.quantity || 0);
  const existingPackagingCount = Number(inventoryItem?.packaging_count || 0);

  if (normalizedPackaging === "piece" || unitsPerPackage <= 1) {
    return {
      quantity: 1,
      packaging_count: normalizedOnHandQuantity > 0 ? normalizedOnHandQuantity : null,
    };
  }

  if (normalizedOnHandQuantity === 0) {
    return {
      quantity: inventoryItem?.quantity || null,
      packaging_count: null,
    };
  }

  if (normalizedOnHandQuantity % unitsPerPackage === 0) {
    return {
      quantity: inventoryItem?.quantity || null,
      packaging_count: normalizedOnHandQuantity / unitsPerPackage,
    };
  }

  return {
    quantity: inventoryItem?.quantity || null,
    packaging_count: existingPackagingCount > 0 ? existingPackagingCount : null,
  };
};

const buildDistributionInventoryRemarks = ({
  templateName,
  packQuantity,
  batchNo,
  quantityReleased,
}) => {
  const remarkParts = [
    "Relief distribution outflow",
    templateName ? `pack: ${templateName}` : null,
    packQuantity && packQuantity > 1 ? `pack_quantity: ${packQuantity}` : null,
    batchNo ? `batch: ${batchNo}` : null,
    quantityReleased ? `quantity: ${quantityReleased}` : null,
  ].filter(Boolean);

  return remarkParts.join(" | ");
};

const buildReturnInventoryRemarks = ({
  transactionId,
  batchNo,
  quantityRestored,
}) => {
  return [
    "Relief distribution stock restored",
    transactionId ? `distribution_transaction_id: ${transactionId}` : null,
    batchNo ? `batch: ${batchNo}` : null,
    quantityRestored ? `quantity: ${quantityRestored}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
};

const recomputeAndUpdateInventoryItemSnapshots = async (
  inventoryItemsById,
  dbClient,
) => {
  for (const [inventoryItemId, inventoryItem] of inventoryItemsById.entries()) {
    const recomputedQuantityResult = await dbClient.query(
      `
        SELECT COALESCE(SUM(quantity_available), 0)::integer AS total_quantity
        FROM inventory_batches
        WHERE inventory_item_id = $1
      `,
      [inventoryItemId],
    );
    const nextItemQuantity = Number(
      recomputedQuantityResult.rows[0]?.total_quantity || 0,
    );

    await inventoryItemRepository.updateInventoryItemStockSnapshot(
      inventoryItemId,
      buildUpdatedItemStockSnapshot(inventoryItem, nextItemQuantity),
      dbClient,
    );
  }
};

const getInventoryItemStockTotals = async (inventoryItemIds, dbClient) => {
  const uniqueInventoryItemIds = [...new Set(inventoryItemIds || [])].filter(Boolean);

  if (uniqueInventoryItemIds.length === 0) {
    return new Map();
  }

  const result = await dbClient.query(
    `
      SELECT
        inventory_item_id,
        COALESCE(SUM(quantity_available), 0)::integer AS total_quantity
      FROM inventory_batches
      WHERE inventory_item_id = ANY($1::uuid[])
      GROUP BY inventory_item_id
    `,
    [uniqueInventoryItemIds],
  );

  return new Map(
    result.rows.map((row) => [
      row.inventory_item_id,
      Number(row.total_quantity || 0),
    ]),
  );
};

const buildTemplateReleasePlan = async ({
  reliefPackTemplateId,
  disasterEventId,
  client,
  inventoryItemsById,
  disasterType,
  householdSize,
  reservedQuantityByBatch = new Map(),
  allowEmptyTemplate = false,
}) => {
  const reliefPackTemplate =
    await distributionTransactionRepository.getReliefPackTemplateByIdForUpdate(
      reliefPackTemplateId,
      client,
    );

  if (!reliefPackTemplate || reliefPackTemplate.is_active === false) {
    const error = new Error("Selected relief pack template is no longer available");
    error.statusCode = 404;
    throw error;
  }

  if (
    reliefPackTemplate.applies_to_all_disasters === false &&
    String(disasterType || "").trim()
  ) {
    const templateDisasterTypes =
      await reliefPackTemplateRepository.getReliefPackTemplateDisasterTypesByTemplateId(
        reliefPackTemplateId,
      );
    const isApplicableToDisasterType = isTemplateApplicableToDisasterType(
      templateDisasterTypes,
      disasterType,
    );

    if (!isApplicableToDisasterType) {
      const error = new Error(
        `Selected relief pack template is not applicable to ${disasterType}.`,
      );
      error.statusCode = 400;
      throw error;
    }
  }

  const templateItems =
    await distributionTransactionRepository.getReliefPackTemplateItemsByTemplateIdForUpdate(
      reliefPackTemplateId,
      client,
    );

  if (!Array.isArray(templateItems) || templateItems.length === 0) {
    if (allowEmptyTemplate) {
      return {
        reliefPackTemplate,
        packMultiplier: getTemplatePackMultiplier(
          reliefPackTemplate,
          householdSize,
        ),
        releasePlan: [],
      };
    }

    const error = new Error(
      "Selected relief pack template does not have configured inventory items",
    );
    error.statusCode = 400;
    throw error;
  }

  const packMultiplier = getTemplatePackMultiplier(
    reliefPackTemplate,
    householdSize,
  );
  const releasePlan = [];

  for (const templateItem of templateItems) {
    const inventoryItem = await inventoryItemRepository.getInventoryItemByIdForUpdate(
      templateItem.inventory_item_id,
      client,
    );

    if (!inventoryItem) {
      const error = new Error(
        `Relief pack item no longer exists: ${templateItem.item_name || templateItem.inventory_item_id}`,
      );
      error.statusCode = 400;
      throw error;
    }

    inventoryItemsById.set(templateItem.inventory_item_id, inventoryItem);

    const candidateBatches =
      await distributionTransactionRepository.getAvailableInventoryBatchesByItemIdForUpdate(
        templateItem.inventory_item_id,
        disasterEventId,
        client,
      );
    const requiredQuantity =
      Number(templateItem.quantity_required || 0) * packMultiplier;
    const totalAvailableQuantity = candidateBatches.reduce(
      (total, batch) => {
        const reservedQuantity = Number(
          reservedQuantityByBatch.get(batch.id) || 0,
        );
        return (
          total +
          Math.max(
            0,
            Number(batch.quantity_available || 0) - reservedQuantity,
          )
        );
      },
      0,
    );

    if (totalAvailableQuantity < requiredQuantity) {
      const error = new Error(
        `Insufficient stock for ${templateItem.item_name}. Required: ${requiredQuantity}, available: ${totalAvailableQuantity}.`,
      );
      error.statusCode = 400;
      throw error;
    }

    let remainingQuantity = requiredQuantity;

    for (const batch of candidateBatches) {
      if (remainingQuantity <= 0) {
        break;
      }

      const reservedQuantity = Number(
        reservedQuantityByBatch.get(batch.id) || 0,
      );
      const availableQuantity = Math.max(
        0,
        Number(batch.quantity_available || 0) - reservedQuantity,
      );
      const quantityReleased = Math.min(availableQuantity, remainingQuantity);

      if (quantityReleased <= 0) {
        continue;
      }

      releasePlan.push({
        inventory_batch_id: batch.id,
        inventory_item_id: templateItem.inventory_item_id,
        quantity_released: quantityReleased,
        batch_no: batch.batch_no,
        item_code: batch.item_code,
        item_name: batch.item_name,
        unit_of_measure: batch.unit_of_measure,
        source_type: batch.source_type || "LGU",
        donation_id: batch.donation_id || null,
        donor_name: batch.donor_name || null,
        donation_item_id: batch.donation_item_id || null,
      });

      reservedQuantityByBatch.set(
        batch.id,
        reservedQuantity + quantityReleased,
      );

      remainingQuantity -= quantityReleased;
    }
  }

  return {
    reliefPackTemplate,
    packMultiplier,
    releasePlan,
  };
};

const buildAssignedTemplateReleasePlan = async ({
  householdId,
  disasterEventId,
  selectedReliefPackTemplateId,
  client,
  inventoryItemsById,
  disasterType,
  householdSize,
}) => {
  const assignedReliefPackTemplates =
    await resolveAssignedReliefPackTemplatesForHousehold(
      householdId,
      disasterEventId,
    );
  const primaryAssignedReliefPackTemplate =
    getPrimaryAssignedReliefPackTemplate(assignedReliefPackTemplates);

  if (!primaryAssignedReliefPackTemplate?.id) {
    const error = new Error(
      "No active standard relief pack is assigned to this family.",
    );
    error.statusCode = 400;
    error.code = "NO_ASSIGNED_RELIEF_PACK";
    throw error;
  }

  const assignedTemplateIds = new Set(
    assignedReliefPackTemplates.map((template) => template?.id).filter(Boolean),
  );

  if (!assignedTemplateIds.has(selectedReliefPackTemplateId)) {
    const error = new Error(
      "Selected relief pack template is not assigned to this family.",
    );
    error.statusCode = 400;
    error.code = "RELIEF_PACK_TEMPLATE_NOT_ASSIGNED";
    throw error;
  }

  const reservedQuantityByBatch = new Map();
  const templatePlans = [];

  for (const template of assignedReliefPackTemplates) {
    if (!template?.id) {
      continue;
    }

    const templatePlan = await buildTemplateReleasePlan({
      reliefPackTemplateId: template.id,
      disasterEventId,
      client,
      inventoryItemsById,
      disasterType,
      householdSize,
      reservedQuantityByBatch,
      allowEmptyTemplate: true,
    });

    templatePlans.push(templatePlan);
  }

  if (
    templatePlans.length === 0 ||
    templatePlans.every((templatePlan) => templatePlan.releasePlan.length === 0)
  ) {
    const error = new Error(
      "The assigned relief packs do not contain any inventory items.",
    );
    error.statusCode = 400;
    error.code = "EMPTY_RELIEF_PACK_TEMPLATE";
    throw error;
  }

  const primaryTemplatePlan = templatePlans.find(
    (templatePlan) =>
      templatePlan.reliefPackTemplate.id === primaryAssignedReliefPackTemplate.id,
  );

  if (!primaryTemplatePlan) {
    const error = new Error(
      "The assigned primary relief pack is no longer available.",
    );
    error.statusCode = 400;
    error.code = "NO_ASSIGNED_RELIEF_PACK";
    throw error;
  }

  const releasePlanByBatch = new Map();

  templatePlans.forEach((templatePlan) => {
    templatePlan.releasePlan.forEach((releaseItem) => {
      const existingReleaseItem = releasePlanByBatch.get(
        releaseItem.inventory_batch_id,
      );

      if (existingReleaseItem) {
        existingReleaseItem.quantity_released += Number(
          releaseItem.quantity_released || 0,
        );
        return;
      }

      releasePlanByBatch.set(releaseItem.inventory_batch_id, {
        ...releaseItem,
        quantity_released: Number(releaseItem.quantity_released || 0),
      });
    });
  });

  return {
    reliefPackTemplate: primaryTemplatePlan.reliefPackTemplate,
    reliefPackTemplates: templatePlans.map(
      (templatePlan) => templatePlan.reliefPackTemplate,
    ),
    reliefPackTemplateNames: templatePlans
      .map((templatePlan) => templatePlan.reliefPackTemplate.name)
      .filter(Boolean),
    packMultiplier: primaryTemplatePlan.packMultiplier,
    releasePlan: [...releasePlanByBatch.values()],
  };
};

const summarizeDistributionTransaction = (transaction) =>
  pickDefined(transaction, [
    "id",
    "disaster_event_id",
    "household_id",
    "stub_id",
    "distribution_status",
    "claimed_by_name",
    "verified_by",
    "qr_reference_value",
    "receipt_no",
    "receipt_status",
    "received_at",
    "relief_pack_template_id",
    "remarks",
  ]);

const summarizeDistributionItems = (items) =>
  (Array.isArray(items) ? items : []).map((item) =>
    pickDefined(item, [
      "id",
      "inventory_batch_id",
      "inventory_item_id",
      "quantity_released",
      "batch_no",
      "item_code",
      "item_name",
      "unit_of_measure",
      "source_type",
      "donation_id",
      "donor_name",
      "donation_item_id",
    ]),
  );

const formatDistributionActionRemarks = ({
  actionType,
  reason,
  previousRemarks,
}) => {
  const actionLabel = actionType === "REVERSED" ? "Reversal" : "Cancellation";
  const normalizedReason = String(reason || "").trim();
  const normalizedPreviousRemarks = String(previousRemarks || "").trim();

  if (!normalizedPreviousRemarks) {
    return `${actionLabel} reason: ${normalizedReason}`;
  }

  return `${actionLabel} reason: ${normalizedReason}\nPrevious remarks: ${normalizedPreviousRemarks}`;
};

const normalizeRestoredBatchStatus = (
  batch,
  restoredQuantity,
  reorderLevel,
  totalQuantityAvailable,
) => {
  if (!batch) {
    return "AVAILABLE";
  }

  if (batch.status === "EXPIRED") {
    return "EXPIRED";
  }

  return getInventoryBatchStatus({
    quantityAvailable: restoredQuantity,
    expirationDate: batch.expiration_date,
    reorderLevel,
    totalQuantityAvailable,
  });
};

const createDistributionTransaction = async (requestData) => {
  const externalClient = requestData.dbClient || null;
  const client = externalClient || await pool.connect();

  try {
    if (!externalClient) {
      await client.query("BEGIN");
    }

    const stub = await distributionTransactionRepository.getStubByIdForUpdate(
      requestData.stub_id,
      client,
    );

    if (!stub) {
      const error = new Error("Stub not found");
      error.statusCode = 404;
      error.code = "STUB_NOT_FOUND";
      throw error;
    }

    assertBarangayDistributionScope(stub, requestData.requester);

    if (stub.disaster_event_id !== requestData.disaster_event_id) {
      const error = new Error("disaster_event_id does not match the stub record");
      error.statusCode = 400;
      throw error;
    }

    if (stub.household_id !== requestData.household_id) {
      const error = new Error("household_id does not match the stub record");
      error.statusCode = 400;
      throw error;
    }

    if (stub.status === "CLAIMED") {
      await throwStubAlreadyClaimedError(stub);
    }

    if (stub.status !== "ISSUED") {
      const error = new Error("Stub is not claimable");
      error.statusCode = 400;
      error.code = "STUB_NOT_CLAIMABLE";
      error.entityServerId = stub.id;
      throw error;
    }

    assertDisasterEventActiveForNewDistribution(stub);

    const disasterEvent = await disasterEventRepository.getDisasterEventById(
      stub.disaster_event_id,
    );

    if (!disasterEvent) {
      const error = new Error("Disaster event not found");
      error.statusCode = 404;
      throw error;
    }

    const latestAttendance =
      await distributionTransactionRepository.getLatestAttendanceByHouseholdId(
        stub.household_id,
        stub.disaster_event_id,
        client,
      );

    if (!isReliefPackClaimHouseholdCurrentlyEligible(stub, latestAttendance)) {
      const error = new Error(
        "Only active evacuation-center households can claim a relief pack.",
      );
      error.statusCode = 400;
      throw error;
    }

    if (
      requestData.qr_reference_value &&
      stub.qr_code_value !== requestData.qr_reference_value
    ) {
      const error = new Error("qr_reference_value does not match the stub record");
      error.statusCode = 400;
      error.code = "QR_REFERENCE_MISMATCH";
      error.entityServerId = stub.id;
      throw error;
    }

    if (
      requestData.qr_reference_value &&
      stub.qr_status &&
      stub.qr_status !== ACTIVE_QR_STATUS
    ) {
      const error = new Error("The scanned QR reference is not active");
      error.statusCode = 400;
      error.code = "QR_INACTIVE";
      error.entityServerId = stub.id;
      throw error;
    }

    if (!requestData.relief_pack_template_id) {
      const error = new Error(
        "relief_pack_template_id is required for assignment-driven distribution.",
      );
      error.statusCode = 400;
      error.code = "RELIEF_PACK_TEMPLATE_REQUIRED";
      throw error;
    }

    const inventoryItemsById = new Map();
    const templateReleasePlan = await buildAssignedTemplateReleasePlan({
      householdId: stub.household_id,
      disasterEventId: stub.disaster_event_id,
      selectedReliefPackTemplateId: requestData.relief_pack_template_id,
      client,
      inventoryItemsById,
      disasterType: disasterEvent.disaster_type,
      householdSize: stub.household_size,
    });
    const releasePlan = templateReleasePlan.releasePlan;
    const releaseQuantityByItemId = releasePlan.reduce(
      (totals, item) => {
        totals.set(
          item.inventory_item_id,
          (totals.get(item.inventory_item_id) || 0) +
            Number(item.quantity_released || 0),
        );
        return totals;
      },
      new Map(),
    );
    const currentItemStockById = await getInventoryItemStockTotals(
      [...releaseQuantityByItemId.keys()],
      client,
    );
    const nextItemStockById = new Map(
      [...releaseQuantityByItemId.keys()].map((inventoryItemId) => [
        inventoryItemId,
        Math.max(
          0,
          (currentItemStockById.get(inventoryItemId) || 0) -
            (releaseQuantityByItemId.get(inventoryItemId) || 0),
        ),
      ]),
    );

    const receiptNo =
      await distributionTransactionRepository.getDistributionReceiptSequence(
        client,
      );
    const receivedAt = new Date().toISOString();
    const qrScannedAt = requestData.qr_reference_value
      ? new Date().toISOString()
      : null;

    const distributionTransaction =
      await distributionTransactionRepository.insertDistributionTransaction(
        {
          disaster_event_id: requestData.disaster_event_id,
          household_id: requestData.household_id,
          stub_id: requestData.stub_id,
          distribution_status: "CLAIMED",
          claimed_by_name: requestData.claimed_by_name,
          verified_by: requestData.verified_by,
          device_id: requestData.device_id,
          is_offline_encoded: requestData.is_offline_encoded,
          sync_status: requestData.sync_status,
          qr_reference_value:
            requestData.qr_reference_value || stub.qr_code_value || null,
          qr_scanned_at: qrScannedAt,
          qr_scanned_by: requestData.qr_reference_value
            ? requestData.verified_by
            : null,
          receipt_no: receiptNo,
          receipt_status: requestData.receipt_status,
          received_at: receivedAt,
          relief_pack_template_id:
            templateReleasePlan?.reliefPackTemplate?.id || null,
          remarks: requestData.remarks,
        },
        client,
      );

    await distributionTransactionRepository.insertDistributionTransactionReliefPackTemplates(
      distributionTransaction.id,
      templateReleasePlan?.reliefPackTemplates || [],
      client,
    );

    const releasedItems = [];
    const batchAlertPayloads = [];
    const deductedBatchTotals = new Map();

    for (const item of releasePlan) {
      const insertedItem =
        await distributionTransactionRepository.insertDistributionTransactionItem(
          {
            distribution_transaction_id: distributionTransaction.id,
            inventory_batch_id: item.inventory_batch_id,
            inventory_item_id: item.inventory_item_id,
            quantity_released: item.quantity_released,
            item_code_snapshot: item.item_code,
            item_name_snapshot: item.item_name,
            unit_of_measure_snapshot: item.unit_of_measure,
          },
          client,
        );

      const batchDetails =
        await distributionTransactionRepository.getInventoryBatchByIdForUpdate(
          item.inventory_batch_id,
          client,
        );

      releasedItems.push({
        id: insertedItem.id,
        inventory_batch_id: insertedItem.inventory_batch_id,
        inventory_item_id: insertedItem.inventory_item_id,
        quantity_released: insertedItem.quantity_released,
        batch_no: batchDetails.batch_no,
        item_code: batchDetails.item_code,
        item_name: batchDetails.item_name,
        unit_of_measure: batchDetails.unit_of_measure,
        source_type: item.source_type || batchDetails.source_type || "LGU",
        donation_id: item.donation_id || null,
        donor_name: item.donor_name || null,
        donation_item_id: item.donation_item_id || null,
      });

      deductedBatchTotals.set(item.inventory_batch_id, {
        ...batchDetails,
        total_quantity_released:
          Number(deductedBatchTotals.get(item.inventory_batch_id)?.total_quantity_released || 0) +
          Number(item.quantity_released || 0),
      });
    }

    for (const groupedItem of deductedBatchTotals.values()) {
      const batchDetails =
        await distributionTransactionRepository.getInventoryBatchByIdForUpdate(
          groupedItem.id,
          client,
        );
      const remainingQuantity =
        Number(batchDetails.quantity_available || 0) -
        Number(groupedItem.total_quantity_released || 0);

      if (remainingQuantity < 0) {
        const error = new Error(`Insufficient stock for batch ${batchDetails.batch_no}`);
        error.statusCode = 400;
        throw error;
      }

      const nextStatus = getInventoryBatchStatus({
        quantityAvailable: remainingQuantity,
        expirationDate: batchDetails.expiration_date,
        reorderLevel:
          inventoryItemsById.get(batchDetails.inventory_item_id)?.reorder_level,
        totalQuantityAvailable: nextItemStockById.get(
          batchDetails.inventory_item_id,
        ),
      });

      const updatedBatch =
        await distributionTransactionRepository.updateInventoryBatchQuantityAndStatus(
          groupedItem.id,
          remainingQuantity,
          nextStatus,
          client,
        );

      batchAlertPayloads.push({
        batch: {
          id: batchDetails.id,
          batch_no: batchDetails.batch_no,
          quantity_available: updatedBatch.quantity_available,
          status: updatedBatch.status,
          reorder_level:
            inventoryItemsById.get(batchDetails.inventory_item_id)?.reorder_level,
          item_total_stock: nextItemStockById.get(batchDetails.inventory_item_id),
          item_name: batchDetails.item_name,
        },
        previousQuantityAvailable: batchDetails.quantity_available,
        previousStatus: batchDetails.status,
      });
    }

    for (const item of releasedItems) {
      await distributionTransactionRepository.insertInventoryTransaction(
        {
          disaster_event_id: requestData.disaster_event_id,
          inventory_batch_id: item.inventory_batch_id,
          transaction_type: "OUTFLOW",
          quantity: item.quantity_released,
          reference_type: "DISTRIBUTION",
          reference_id: distributionTransaction.id,
          performed_by: requestData.verified_by || null,
          remarks: buildDistributionInventoryRemarks({
            templateName:
              templateReleasePlan?.reliefPackTemplateNames?.join(", ") || null,
            packQuantity: templateReleasePlan?.packMultiplier || 1,
            batchNo: item.batch_no,
            quantityReleased: item.quantity_released,
          }),
        },
        client,
      );
    }

    await recomputeAndUpdateInventoryItemSnapshots(inventoryItemsById, client);

    const updatedStub = await distributionTransactionRepository.updateStubAsClaimed(
      requestData.stub_id,
      client,
    );

    if (!externalClient) {
      await client.query("COMMIT");
    }

    if (!externalClient) {
      await notificationService.emitSafely(async () => {
        for (const batchAlertPayload of batchAlertPayloads) {
          await notificationService.emitBatchAlerts({
            ...batchAlertPayload,
            disasterEventId: requestData.disaster_event_id,
          });
        }

        await notificationService.emitDistributionUpdate({
          disasterEventId: requestData.disaster_event_id,
          stubNo: updatedStub.stub_no,
          familyHeadName: buildFullName(
            stub.family_head_first_name,
            stub.family_head_middle_name,
            stub.family_head_last_name,
            stub.family_head_suffix,
          ),
          distributionTransactionId: distributionTransaction.id,
        });
      });

      await logAuditSafely({
        actor: requestData.requester,
        action: "DISTRIBUTION_RECORD",
        entityType: "DISTRIBUTION_TRANSACTION",
        entityId: distributionTransaction.id,
        oldValues: {},
        newValues: summarizeDistributionTransaction(distributionTransaction),
      });
    }

    return {
      distribution_transaction_id: distributionTransaction.id,
      distribution_date: distributionTransaction.distribution_date,
      qr_reference_value: distributionTransaction.qr_reference_value,
      qr_scanned_at: distributionTransaction.qr_scanned_at,
      qr_scanned_by: distributionTransaction.qr_scanned_by,
      receipt_no: distributionTransaction.receipt_no,
      receipt_status: distributionTransaction.receipt_status,
      received_at: distributionTransaction.received_at,
      relief_pack_template_id: distributionTransaction.relief_pack_template_id,
      relief_pack_template_name:
        templateReleasePlan?.reliefPackTemplate?.name || null,
      relief_pack_template_names: templateReleasePlan?.reliefPackTemplateNames || [],
      relief_pack_quantity: templateReleasePlan?.packMultiplier || 1,
      stub: {
        id: updatedStub.id,
        stub_no: updatedStub.stub_no,
        serial_no: updatedStub.serial_no,
        status: updatedStub.status,
        claimed_at: updatedStub.claimed_at,
        qr_code_value: updatedStub.qr_code_value || null,
        qr_generated_at: updatedStub.qr_generated_at || null,
        qr_generated_by: updatedStub.qr_generated_by || null,
        qr_status: updatedStub.qr_status || null,
        qr_notes: updatedStub.qr_notes || null,
      },
      household: {
        id: stub.household_id,
        family_head_name: buildFullName(
          stub.family_head_first_name,
          stub.family_head_middle_name,
          stub.family_head_last_name,
          stub.family_head_suffix,
        ),
      },
      items_count: releasedItems.length,
      items: releasedItems,
    };
  } catch (error) {
    if (!externalClient) {
      await client.query("ROLLBACK");
    }

    if (isDistributionStubUniqueViolation(error)) {
      const latestDistributionTransaction =
        await stubRepository.getLatestDistributionTransactionByStubId(
          requestData.stub_id,
        );
      throw createStubAlreadyClaimedError({
        stub: latestDistributionTransaction
          ? {
              id: requestData.stub_id,
              status: "CLAIMED",
              disaster_event_id: requestData.disaster_event_id,
              household_id: requestData.household_id,
            }
          : { id: requestData.stub_id, status: "CLAIMED" },
        latestDistributionTransaction,
      });
    }

    throw error;
  } finally {
    if (!externalClient) {
      client.release();
    }
  }
};

const claimDistributionTransactionFromQr = async (requestData) => {
  const externalClient = requestData.dbClient || null;
  const client = externalClient || await pool.connect();

  try {
    if (!externalClient) {
      await client.query("BEGIN");
    }

    const stub = await distributionTransactionRepository.getStubByIdForUpdate(
      requestData.stub_id,
      client,
    );

    if (!stub) {
      const error = new Error("Stub not found");
      error.statusCode = 404;
      error.code = "STUB_NOT_FOUND";
      throw error;
    }

    assertBarangayDistributionScope(stub, requestData.requester);

    if (stub.disaster_event_id !== requestData.disaster_event_id) {
      const error = new Error("disaster_event_id does not match the stub record");
      error.statusCode = 400;
      throw error;
    }

    if (stub.household_id !== requestData.household_id) {
      const error = new Error("household_id does not match the stub record");
      error.statusCode = 400;
      throw error;
    }

    if (stub.status === "CLAIMED") {
      await throwStubAlreadyClaimedError(stub);
    }

    if (stub.status !== "ISSUED") {
      const error = new Error("Stub is not claimable");
      error.statusCode = 400;
      error.code = "STUB_NOT_CLAIMABLE";
      error.entityServerId = stub.id;
      throw error;
    }

    assertDisasterEventActiveForNewDistribution(stub);

    if (
      requestData.qr_reference_value &&
      stub.qr_code_value !== requestData.qr_reference_value
    ) {
      const error = new Error("qr_reference_value does not match the stub record");
      error.statusCode = 400;
      error.code = "QR_REFERENCE_MISMATCH";
      error.entityServerId = stub.id;
      throw error;
    }

    if (
      requestData.qr_reference_value &&
      stub.qr_status &&
      stub.qr_status !== ACTIVE_QR_STATUS
    ) {
      const error = new Error("The scanned QR reference is not active");
      error.statusCode = 400;
      error.code = "QR_INACTIVE";
      error.entityServerId = stub.id;
      throw error;
    }

    const receivedAt = new Date().toISOString();
    const qrScannedAt = requestData.qr_reference_value
      ? new Date().toISOString()
      : null;
    const automaticClaimResult = await recordAutomaticReliefPackClaim({
      client,
      stub,
      claimedByName: requestData.claimed_by_name,
      verifiedBy: requestData.verified_by,
      qrReferenceValue: requestData.qr_reference_value || null,
      qrScannedAt,
      qrScannedBy: requestData.qr_reference_value
        ? requestData.verified_by
        : null,
      receivedAt,
      remarks:
        requestData.remarks ||
        "Claimed through QR stub verification page",
    });
    const {
      assignedReliefPackTemplate,
      assignedReliefPackTemplates,
      distributionTransaction,
      releasedItems,
      updatedStub,
      donatedReliefPacks,
    } = automaticClaimResult;

    if (!externalClient) {
      await client.query("COMMIT");
    }

    if (!externalClient) {
      await notificationService.emitSafely(() =>
        notificationService.emitDistributionUpdate({
          disasterEventId: requestData.disaster_event_id,
          stubNo: updatedStub.stub_no,
          familyHeadName: buildFullName(
            stub.family_head_first_name,
            stub.family_head_middle_name,
            stub.family_head_last_name,
            stub.family_head_suffix,
          ),
          distributionTransactionId: distributionTransaction.id,
        }),
      );

      await logAuditSafely({
        actor: requestData.requester,
        action: "DISTRIBUTION_QR_CLAIM",
        entityType: "DISTRIBUTION_TRANSACTION",
        entityId: distributionTransaction.id,
        oldValues: {},
        newValues: summarizeDistributionTransaction(distributionTransaction),
      });
    }

    return {
      distribution_transaction_id: distributionTransaction.id,
      distribution_date: distributionTransaction.distribution_date,
      qr_reference_value: distributionTransaction.qr_reference_value,
      qr_scanned_at: distributionTransaction.qr_scanned_at,
      qr_scanned_by: distributionTransaction.qr_scanned_by,
      receipt_no: distributionTransaction.receipt_no,
      receipt_status: distributionTransaction.receipt_status,
      received_at: distributionTransaction.received_at,
      relief_pack_template_id: distributionTransaction.relief_pack_template_id,
      relief_pack_template_name: assignedReliefPackTemplate?.name || null,
      relief_pack_template_names: (assignedReliefPackTemplates || [])
        .map((template) => template?.name)
        .filter(Boolean),
      relief_pack_quantity: automaticClaimResult.packQuantity || 1,
      donated_relief_packs: donatedReliefPacks || [],
      stub: {
        id: updatedStub.id,
        stub_no: updatedStub.stub_no,
        serial_no: updatedStub.serial_no,
        status: updatedStub.status,
        claimed_at: updatedStub.claimed_at,
        qr_code_value: updatedStub.qr_code_value || null,
        qr_generated_at: updatedStub.qr_generated_at || null,
        qr_generated_by: updatedStub.qr_generated_by || null,
        qr_status: updatedStub.qr_status || null,
        qr_notes: updatedStub.qr_notes || null,
      },
      household: {
        id: stub.household_id,
        family_head_name: buildFullName(
          stub.family_head_first_name,
          stub.family_head_middle_name,
          stub.family_head_last_name,
          stub.family_head_suffix,
        ),
      },
      items_count: releasedItems.length,
      items: releasedItems,
    };
  } catch (error) {
    if (!externalClient) {
      await client.query("ROLLBACK");
    }

    if (isDistributionStubUniqueViolation(error)) {
      const latestDistributionTransaction =
        await stubRepository.getLatestDistributionTransactionByStubId(
          requestData.stub_id,
        );
      throw createStubAlreadyClaimedError({
        stub: latestDistributionTransaction
          ? {
              id: requestData.stub_id,
              status: "CLAIMED",
              disaster_event_id: requestData.disaster_event_id,
              household_id: requestData.household_id,
            }
          : { id: requestData.stub_id, status: "CLAIMED" },
        latestDistributionTransaction,
      });
    }

    throw error;
  } finally {
    if (!externalClient) {
      client.release();
    }
  }
};

const getDistributionHistory = async ({ requester, filters }) => {
  const roleCode = requester?.roleCode;
  const isBarangay = roleCode === BARANGAY_ROLE_CODE;
  const requesterBarangayId = isBarangay
    ? await resolveRequesterBarangayId(requester)
    : null;

  if (isBarangay && !requesterBarangayId) {
    const error = new Error(
      "Barangay distribution history requires an account with an assigned barangay.",
    );
    error.statusCode = 403;
    throw error;
  }

  const scopedBarangayId = isBarangay
    ? requesterBarangayId
    : filters.barangay_id || null;
  const isSummaryMode = filters.mode === "summary" && !filters.disaster_event_id;
  const isPaginated = Boolean(filters.isPaginated);
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 25;
  const offset = (page - 1) * pageSize;
  const commonFilters = {
    barangayId: scopedBarangayId,
    disasterEventId: filters.disaster_event_id || null,
    status: filters.status || null,
    dateFrom: filters.date_from || null,
    dateTo: filters.date_to || null,
    search: filters.search || "",
    sortOrder: filters.sort_order || "newest",
  };

  if (isSummaryMode) {
    const [summaryRows, totalItems] = await Promise.all([
      distributionTransactionRepository.getDistributionHistorySummaryRows({
        barangayId: scopedBarangayId,
        status: filters.status || null,
        dateFrom: filters.date_from || null,
        dateTo: filters.date_to || null,
        search: filters.search || "",
        sortOrder: filters.sort_order || "newest",
        limit: pageSize,
        offset,
      }),
      distributionTransactionRepository.countDistributionHistorySummaryRows({
        barangayId: scopedBarangayId,
        status: filters.status || null,
        dateFrom: filters.date_from || null,
        dateTo: filters.date_to || null,
        search: filters.search || "",
      }),
    ]);

    return {
      data: summaryRows.map((row) => ({
        ...row,
        id: row.disaster_event_id,
      })),
      pagination: buildPaginationMetadata({ page, pageSize, totalItems }),
    };
  }

  const rowQuery = {
    ...commonFilters,
    limit: isPaginated ? pageSize : filters.limit || 100,
    offset: isPaginated ? offset : null,
  };

  const [rows, totalItems] = await Promise.all([
    distributionTransactionRepository.getDistributionHistory(rowQuery),
    isPaginated
      ? distributionTransactionRepository.countDistributionHistory(commonFilters)
      : Promise.resolve(null),
  ]);

  const rowsWithSectors = await attachHistorySectors(rows);
  const rowsWithStubCounts = await attachDistributionHistoryStubCounts({
    rows: rowsWithSectors,
    requester: isBarangay
      ? {
          ...requester,
          defaultBarangayId: requesterBarangayId,
        }
      : requester,
    filters,
  });

  if (isPaginated) {
    return {
      data: rowsWithStubCounts,
      pagination: buildPaginationMetadata({ page, pageSize, totalItems }),
    };
  }

  return rowsWithStubCounts;
};

const exportDistributionHistory = async ({ requester, filters }) => {
  if (
    requester?.roleCode !== ROLE_CODES.BARANGAY &&
    requester?.roleCode !== ROLE_CODES.MSWDO
  ) {
    const error = new Error("Only Barangay and MSWDO can export distribution history.");
    error.statusCode = 403;
    throw error;
  }

  const roleCode = requester?.roleCode;
  const isBarangay = roleCode === BARANGAY_ROLE_CODE;
  const requesterBarangayId = isBarangay
    ? await resolveRequesterBarangayId(requester)
    : null;

  if (isBarangay && !requesterBarangayId) {
    const error = new Error(
      "Barangay distribution history export requires an account with an assigned barangay.",
    );
    error.statusCode = 403;
    throw error;
  }

  const scopedBarangayId = isBarangay
    ? requesterBarangayId
    : filters.barangay_id || null;

  const rows = await distributionTransactionRepository.getDistributionHistoryExportRows({
    barangayId: scopedBarangayId,
    disasterEventId: filters.disaster_event_id || null,
    status: filters.status || null,
    dateFrom: filters.date_from || null,
    dateTo: filters.date_to || null,
    search: filters.search || "",
    sortOrder: filters.sort_order || "newest",
  });

  const rowsWithSectors = await attachHistorySectors(rows);
  const isSummaryExport = !filters.disaster_event_id;
  const sortedRows = rowsWithSectors;
  const sourceName = buildReportSourceName(requester, sortedRows);
  const selectedDisasterEventLabel =
    filters.disaster_event_id && sortedRows[0]
      ? [sortedRows[0].event_code, sortedRows[0].disaster_event_title]
          .filter(Boolean)
          .join(" - ") || sortedRows[0].disaster_event_title || filters.disaster_event_id
      : "All";

  if (isSummaryExport) {
    const summaryRows =
      await distributionTransactionRepository.getDistributionHistorySummaryRows({
        barangayId: scopedBarangayId,
        status: filters.status || null,
        dateFrom: filters.date_from || null,
        dateTo: filters.date_to || null,
        search: filters.search || "",
        sortOrder: filters.sort_order || "newest",
        limit: null,
      });

    return mswdoReportExport.buildExportFile({
      filePrefix:
        requester?.roleCode === ROLE_CODES.BARANGAY
          ? "barangay-distribution-history-summary"
          : "mswdo-distribution-history-summary",
      worksheetName: "Distribution Summary",
      reportTitle:
        requester?.roleCode === ROLE_CODES.BARANGAY
          ? "Barangay Distribution History Summary"
          : "MSWDO Distribution History Summary",
      sourceName,
      metadata: [
        {
          label: "Disaster Event",
          value: selectedDisasterEventLabel,
        },
        {
          label: "Barangay",
          value:
            filters.barangay_id ||
            (requester?.roleCode === ROLE_CODES.BARANGAY
              ? "Assigned Barangay"
              : "All"),
        },
        {
          label: "Date Range",
          value:
            filters.date_from || filters.date_to
              ? `${filters.date_from || "--"} to ${filters.date_to || "--"}`
              : "All",
        },
      ],
      columns: [
        { key: "event_label", label: "Disaster Event", width: 32, pdfWidth: 120 },
        { key: "event_status", label: "Status", width: 14, pdfWidth: 48 },
        { key: "barangay_summary", label: "Barangays", width: 34, pdfWidth: 120 },
        { key: "issued_stubs_count", label: "Issued Stubs", width: 16, pdfWidth: 60 },
        { key: "claimed_stubs_count", label: "Claimed", width: 14, pdfWidth: 42 },
        { key: "unclaimed_stubs_count", label: "Unclaimed", width: 14, pdfWidth: 42 },
        { key: "relief_pack_summary", label: "Relief Pack", width: 32, pdfWidth: 115 },
        { key: "latest_distribution_date_label", label: "Latest Claim", width: 22, pdfWidth: 80 },
      ],
      rows: summaryRows.map((row) => ({
        event_label:
          [row.event_code, row.disaster_event_title].filter(Boolean).join(" - ") || "--",
        event_status: formatDisasterEventStatusLabel(row.disaster_event_status),
        barangay_summary:
          row.barangay_count > 0
            ? `${row.barangay_summary} (Count: ${row.barangay_count})`
            : "--",
        issued_stubs_count: row.issued_stubs_count || 0,
        claimed_stubs_count: row.claimed_stubs_count || 0,
        unclaimed_stubs_count: row.unclaimed_stubs_count || 0,
        relief_pack_summary: row.relief_pack_summary,
        latest_distribution_date_label: mswdoReportExport.formatDateTime(
          row.latest_distribution_date,
        ),
      })),
      format: filters.format,
    });
  }

  return mswdoReportExport.buildExportFile({
    filePrefix:
      requester?.roleCode === ROLE_CODES.BARANGAY
        ? "barangay-distribution-history"
        : "mswdo-distribution-history",
    worksheetName: "Distribution History",
    reportTitle:
      requester?.roleCode === ROLE_CODES.BARANGAY
        ? "Barangay Distribution History"
        : "MSWDO Distribution History",
    sourceName,
    metadata: [
      {
        label: "Disaster Event",
        value: selectedDisasterEventLabel,
      },
      {
        label: "Barangay",
        value:
          filters.barangay_id ||
          (requester?.roleCode === ROLE_CODES.BARANGAY
            ? "Assigned Barangay"
            : "All"),
      },
      {
        label: "Status",
        value: filters.status || "All",
      },
      {
        label: "Date Range",
        value:
          filters.date_from || filters.date_to
            ? `${filters.date_from || "--"} to ${filters.date_to || "--"}`
            : "All",
      },
    ],
    columns: [
      { key: "family_head_name", label: "Family Head", width: 28, pdfWidth: 100 },
      { key: "barangay_name", label: "Barangay", width: 20, pdfWidth: 70 },
      { key: "event_label", label: "Disaster Event", width: 24, pdfWidth: 84 },
      { key: "stub_reference", label: "Stub", width: 12, pdfWidth: 46 },
      { key: "qr_reference_value", label: "QR", width: 26, pdfWidth: 110 },
      { key: "relief_summary", label: "Relief Item / Pack", width: 24, pdfWidth: 118 },
      { key: "recorded_by_name", label: "Recorded By", width: 18, pdfWidth: 70 },
      { key: "distribution_status", label: "Status", width: 14, pdfWidth: 55 },
      { key: "distribution_date_label", label: "Date / Time", width: 18, pdfWidth: 72 },
    ],
    rows: sortedRows.map((row) => ({
      family_head_name: row.family_head_name || "--",
      barangay_name: row.barangay_name || "--",
      event_label: [row.event_code, row.disaster_event_title].filter(Boolean).join(" - ") || "--",
      stub_reference: formatStubDisplayNo(row.stub_sequence_no, row.stub_no),
      qr_reference_value: row.qr_reference_value || "--",
      relief_summary:
        row.relief_pack_template_name || row.released_items_summary || "--",
      recorded_by_name: row.verified_by_name || "--",
      distribution_status: row.distribution_status || "--",
      distribution_date_label: mswdoReportExport.formatDateTime(row.distribution_date),
    })),
    format: filters.format,
  });
};

const updateDistributionTransactionLifecycle = async ({
  transactionId,
  actionType,
  remarks,
  requester,
}) => {
  const normalizedActionType = String(actionType || "").toUpperCase();
  const normalizedRemarks = String(remarks || "").trim();

  if (!["CANCELLED", "REVERSED"].includes(normalizedActionType)) {
    const error = new Error("distribution action must be CANCELLED or REVERSED");
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedRemarks) {
    const error = new Error("remarks are required for distribution cancel/reversal");
    error.statusCode = 400;
    throw error;
  }

  if (
    requester?.roleCode !== ROLE_CODES.BARANGAY &&
    requester?.roleCode !== ROLE_CODES.MSWDO
  ) {
    const error = new Error("Only Barangay and MSWDO can cancel or reverse distributions.");
    error.statusCode = 403;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const distributionTransaction =
      await distributionTransactionRepository.getDistributionTransactionByIdForUpdate(
        transactionId,
        client,
      );

    if (!distributionTransaction) {
      const error = new Error("Distribution transaction not found");
      error.statusCode = 404;
      throw error;
    }

    assertBarangayDistributionScope(
      {
        barangay_id: distributionTransaction.barangay_id,
      },
      requester,
    );

    if (distributionTransaction.distribution_status === normalizedActionType) {
      const duplicateActionLabel =
        normalizedActionType === "REVERSED" ? "reversed" : "cancelled";
      const error = new Error(
        `This distribution record has already been ${duplicateActionLabel}.`,
      );
      error.statusCode = 409;
      throw error;
    }

    if (distributionTransaction.distribution_status !== "CLAIMED") {
      const error = new Error(
        "Only currently claimed distribution records can be cancelled or reversed.",
      );
      error.statusCode = 400;
      throw error;
    }

    const transactionItems =
      await distributionTransactionRepository.getDistributionTransactionItemsForUpdate(
        distributionTransaction.id,
        client,
      );
    const inventoryItemsById = new Map();
    const restoredQuantityByItemId = transactionItems.reduce(
      (totals, item) => {
        totals.set(
          item.inventory_item_id,
          (totals.get(item.inventory_item_id) || 0) +
            Number(item.quantity_released || 0),
        );
        return totals;
      },
      new Map(),
    );

    const batchSummaries = [];

    for (const item of transactionItems) {
      const inventoryItem = await inventoryItemRepository.getInventoryItemByIdForUpdate(
        item.inventory_item_id,
        client,
      );

      if (inventoryItem) {
        inventoryItemsById.set(item.inventory_item_id, inventoryItem);
      }

      const restoredQuantity =
        Number(item.quantity_available || 0) + Number(item.quantity_released || 0);
      const nextItemTotalStock =
        item.item_total_stock === undefined || item.item_total_stock === null
          ? undefined
          : Number(item.item_total_stock || 0) +
            (restoredQuantityByItemId.get(item.inventory_item_id) || 0);
      const nextStatus = normalizeRestoredBatchStatus(
        item,
        restoredQuantity,
        inventoryItem?.reorder_level,
        nextItemTotalStock,
      );

      await distributionTransactionRepository.updateInventoryBatchQuantityAndStatus(
        item.inventory_batch_id,
        restoredQuantity,
        nextStatus,
        client,
      );

      batchSummaries.push({
        inventory_batch_id: item.inventory_batch_id,
        batch_no: item.batch_no,
        item_name: item.item_name,
        restored_quantity: item.quantity_released,
        next_quantity_available: restoredQuantity,
        next_status: nextStatus,
      });

      await distributionTransactionRepository.insertInventoryTransaction(
        {
          disaster_event_id: distributionTransaction.disaster_event_id,
          inventory_batch_id: item.inventory_batch_id,
          transaction_type: "RETURN",
          quantity: item.quantity_released,
          reference_type: "DISTRIBUTION",
          reference_id: distributionTransaction.id,
          performed_by: requester?.userId || null,
          remarks: buildReturnInventoryRemarks({
            transactionId: distributionTransaction.id,
            batchNo: item.batch_no,
            quantityRestored: item.quantity_released,
          }),
        },
        client,
      );
    }

    const nextReceiptStatus =
      normalizedActionType === "REVERSED" ? "VOIDED" : "CANCELLED";
    const nextRemarks = formatDistributionActionRemarks({
      actionType: normalizedActionType,
      reason: normalizedRemarks,
      previousRemarks: distributionTransaction.remarks,
    });

    const updatedTransaction =
      await distributionTransactionRepository.updateDistributionTransactionStatus(
        distributionTransaction.id,
        {
          distribution_status: normalizedActionType,
          receipt_status: nextReceiptStatus,
          remarks: nextRemarks,
        },
        client,
      );

    const updatedStub = await distributionTransactionRepository.updateStubStatus(
      distributionTransaction.stub_id,
      "CANCELLED",
      client,
    );

    await recomputeAndUpdateInventoryItemSnapshots(inventoryItemsById, client);

    await client.query("COMMIT");

    await logAuditSafely({
      actor: requester,
      action:
        normalizedActionType === "REVERSED"
          ? "DISTRIBUTION_REVERSE"
          : "DISTRIBUTION_CANCEL",
      entityType: "DISTRIBUTION_TRANSACTION",
      entityId: updatedTransaction.id,
      oldValues: {
        transaction: summarizeDistributionTransaction(distributionTransaction),
        items: summarizeDistributionItems(transactionItems),
        stub: pickDefined(distributionTransaction, [
          "stub_id",
          "stub_no",
          "serial_no",
          "stub_status",
        ]),
      },
      newValues: {
        transaction: summarizeDistributionTransaction(updatedTransaction),
        stub: pickDefined(updatedStub, [
          "id",
          "stub_no",
          "serial_no",
          "status",
        ]),
        reason: normalizedRemarks,
        restored_batches: batchSummaries,
      },
    });

    return {
      id: updatedTransaction.id,
      distribution_status: updatedTransaction.distribution_status,
      receipt_status: updatedTransaction.receipt_status,
      remarks: updatedTransaction.remarks,
      stub: pickDefined(updatedStub, [
        "id",
        "stub_no",
        "serial_no",
        "status",
      ]),
      restored_batches: batchSummaries,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  createDistributionTransaction,
  claimDistributionTransactionFromQr,
  getInventoryDistributionDetail,
  getInventoryDistributionExportOptions,
  getDistributionHistory,
  exportInventoryDistribution,
  exportDistributionHistory,
  updateDistributionTransactionLifecycle,
};
