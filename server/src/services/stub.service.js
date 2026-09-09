const masterlistRepository = require("../repositories/masterlist.repository");
const disasterEventRepository = require("../repositories/disasterEvent.repository");
const pool = require("../config/db");
const distributionTransactionRepository = require("../repositories/distributionTransaction.repository");
const reliefPackTemplateRepository = require("../repositories/reliefPackTemplate.repository");
const stubRepository = require("../repositories/stub.repository");
const mswdoReportExport = require("../utils/mswdoReportExport");
const {
  getAvailableDonatedLooseItemsForClaimPreview,
  getAvailableDonatedReliefPacksForClaimPreview,
  recordAutomaticReliefPackClaim,
} = require("./automaticReliefPackClaim.service");
const {
  getAssignedReliefPackTemplatesForSectorIds,
} = require("./reliefPackAssignment.service");
const {
  isLiveUnclaimedReliefPackAssignment,
  normalizeReliefPackAssignmentSnapshots,
} = require("../utils/reliefPackAssignmentSnapshot");
const {
  isReliefPackClaimHouseholdCurrentlyEligible,
} = require("../utils/reliefPackEligibility");
const { resolveRequesterBarangayId } = require("../utils/requesterScope");

const isOverrideAllowed = process.env.NODE_ENV !== "production";
const ACTIVE_QR_STATUS = "ACTIVE";
const BARANGAY_ROLE_CODE = "BARANGAY";
const MAYOR_ROLE_CODE = "MAYOR";
const STUB_ALREADY_CLAIMED_CODE = "STUB_ALREADY_CLAIMED";
const ARCHIVED_HOUSEHOLD_CODE = "HOUSEHOLD_ARCHIVED";
const HOUSEHOLD_NOT_PRESENT_CODE = "HOUSEHOLD_NOT_PRESENT_IN_EVAC_CENTER";

const assertBarangayRecordViewScope = (record, requester) => {
  if (requester?.roleCode !== BARANGAY_ROLE_CODE) {
    return;
  }

  if (!requester.defaultBarangayId) {
    const error = new Error(
      "Barangay access requires an account with an assigned barangay.",
    );
    error.statusCode = 403;
    error.code = "BARANGAY_SCOPE_FORBIDDEN";
    throw error;
  }

  // Scoped repository reads may intentionally omit the Barangay field from
  // lightweight verification projections. In that case the SQL scope is the
  // authorization check; an explicitly returned foreign ID is still denied.
  if (record?.barangay_id === undefined || record?.barangay_id === null) {
    return;
  }

  if (String(record?.barangay_id || "") !== String(requester.defaultBarangayId)) {
    const error = new Error(
      "You can only view records under your assigned barangay.",
    );
    error.statusCode = 403;
    error.code = "BARANGAY_SCOPE_FORBIDDEN";
    throw error;
  }
};

const DISTRIBUTION_STUB_UNIQUE_CONSTRAINTS = new Set([
  "uq_distribution_stub",
  "distribution_transactions_stub_id_key",
]);
const buildDisasterEventNotActiveError = (stub) => {
  const error = buildQrValidationError({
    code: "DISASTER_EVENT_NOT_ACTIVE",
    message: "Relief claim cannot be completed because the disaster event is not active.",
    statusCode: 400,
    details: buildStubReferenceDetails(stub),
  });
  error.entityServerId = stub?.id || null;
  return error;
};

const assertDisasterEventActiveForNewClaim = (stub) => {
  if (stub?.disaster_event_status !== "ACTIVE") {
    throw buildDisasterEventNotActiveError(stub);
  }
};

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

const buildSectorIds = (householdId, householdSectorsByHouseholdId, memberSectorsByHouseholdId) => {
  const householdSectorIds = (householdSectorsByHouseholdId[householdId] || []).map(
    (sector) => sector.id,
  );
  const memberSectorIds = (memberSectorsByHouseholdId[householdId] || []).map(
    (sector) => sector.id,
  );

  return [...new Set([...householdSectorIds, ...memberSectorIds])];
};

const getReliefPackComponentItemIds = async (
  templates,
  templateItemsByTemplateId = new Map(),
) => {
  const templateItemRows = await Promise.all(
    (templates || []).map(async (template) => {
      const templateId = template?.id;

      if (!templateId) {
        return [];
      }

      if (Array.isArray(template?.items)) {
        if (!templateItemsByTemplateId.has(templateId)) {
          templateItemsByTemplateId.set(
            templateId,
            Promise.resolve(template.items),
          );
        }

        return templateItemsByTemplateId.get(templateId);
      }

      if (templateItemsByTemplateId.has(templateId)) {
        return templateItemsByTemplateId.get(templateId);
      }

      const itemRowsPromise = Promise.resolve(
        typeof reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId ===
          "function"
          ? reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId(
              templateId,
            )
          : [],
      ).then((itemRows) => (Array.isArray(itemRows) ? itemRows : []));

      templateItemsByTemplateId.set(templateId, itemRowsPromise);
      return itemRowsPromise;
    }),
  );

  return [
    ...new Set(
      templateItemRows
        .flatMap((itemRows) => itemRows)
        .map((item) => item?.inventory_item_id)
        .filter(Boolean),
    ),
  ];
};

const buildSectors = (householdId, householdSectorsByHouseholdId, memberSectorsByHouseholdId) => {
  const uniqueSectorsById = new Map();

  [
    ...(householdSectorsByHouseholdId[householdId] || []),
    ...(memberSectorsByHouseholdId[householdId] || []),
  ].forEach((sector) => {
    if (sector?.id && !uniqueSectorsById.has(sector.id)) {
      uniqueSectorsById.set(sector.id, {
        id: sector.id,
        code: sector.code,
        name: sector.name,
      });
    }
  });

  return [...uniqueSectorsById.values()];
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

const buildStableStubQrCodeValue = (stub) => {
  return [
    "DISTYNC-STUB",
    stub.disaster_event_id,
    stub.household_id,
    stub.id,
    stub.stub_no,
  ].join("|");
};

const formatStubDisplayNo = (sequenceNo) => {
  const normalizedSequence = Number(sequenceNo || 0);

  return normalizedSequence > 0 ? `STUB#${normalizedSequence}` : null;
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
    hasPreviousPage: safePage > 1 && totalPages > 0,
    hasNextPage: totalPages > 0 && safePage < totalPages,
  };
};

const buildQrValidationError = ({
  code,
  message,
  statusCode,
  details = {},
}) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

const normalizeReferenceId = (value) => String(value ?? "").trim().toLowerCase();

const assertStubMatchesRequestedEvent = (stub, requestedEventId) => {
  const normalizedRequestedEventId = normalizeReferenceId(requestedEventId);

  if (!normalizedRequestedEventId) {
    return;
  }

  const normalizedStubEventId = normalizeReferenceId(stub?.disaster_event_id);

  if (!normalizedStubEventId) {
    throw buildQrValidationError({
      code: "STUB_EVENT_UNAVAILABLE",
      message: "The stub disaster event could not be verified.",
      statusCode: 400,
      details: buildStubReferenceDetails(stub),
    });
  }

  if (normalizedStubEventId !== normalizedRequestedEventId) {
    throw buildQrValidationError({
      code: "WRONG_EVENT",
      message:
        "This stub belongs to a different disaster event. Select the correct event before scanning.",
      statusCode: 400,
      details: buildStubReferenceDetails(stub),
    });
  }
};

const buildStubReferenceDetails = (stub) => {
  if (!stub) {
    return {};
  }

  return Object.fromEntries(
    Object.entries({
      stubNumber: formatStubDisplayNo(stub.stub_sequence_no) || stub.stub_no || null,
    }).filter(([, value]) => value),
  );
};

const buildClaimedStubDetails = (stub, latestDistributionTransaction = null) => {
  const claimedAt =
    latestDistributionTransaction?.received_at ||
    latestDistributionTransaction?.distribution_date ||
    latestDistributionTransaction?.created_at ||
    stub?.claimed_at ||
    null;

  return Object.fromEntries(
    Object.entries({
      ...buildStubReferenceDetails(stub),
      claimedAt,
      claimedByName: latestDistributionTransaction?.claimed_by_name || null,
      reliefPackName:
        latestDistributionTransaction?.relief_pack_template_name || null,
      claimStatus:
        latestDistributionTransaction?.distribution_status || stub?.status || null,
    }).filter(([, value]) => value),
  );
};

const buildStubAlreadyClaimedError = (stub, latestDistributionTransaction = null) => {
  const error = buildQrValidationError({
    code: STUB_ALREADY_CLAIMED_CODE,
    message: "Only unclaimed stubs can be marked as claimed.",
    statusCode: 409,
    details: buildClaimedStubDetails(stub, latestDistributionTransaction),
  });
  error.entityServerId = stub?.id || latestDistributionTransaction?.stub_id || null;
  error.serverPayload = {
    stub: stub
      ? {
          id: stub.id,
          stub_no: stub.stub_no || null,
          serial_no: stub.serial_no || null,
          status: stub.status || null,
          claimed_at: stub.claimed_at || null,
          disaster_event_id: stub.disaster_event_id || null,
          household_id: stub.household_id || null,
        }
      : {},
    distribution_transaction: latestDistributionTransaction || null,
  };
  return error;
};

const buildArchivedHouseholdError = (stub) => {
  const error = buildQrValidationError({
    code: ARCHIVED_HOUSEHOLD_CODE,
    message: "This household is archived and cannot receive a new relief distribution.",
    statusCode: 400,
    details: buildStubReferenceDetails(stub),
  });
  error.entityServerId = stub?.id || null;
  return error;
};

const ensureStubQrMetadata = async (stub, qrGeneratedBy) => {
  if (stub.qr_code_value) {
    return stub;
  }

  const updatedStub = await stubRepository.updateStubQrMetadata(stub.id, {
    qr_code_value: buildStableStubQrCodeValue(stub),
    qr_generated_at: new Date().toISOString(),
    qr_generated_by: qrGeneratedBy || null,
    qr_status: ACTIVE_QR_STATUS,
    qr_notes: stub.qr_notes || null,
  });

  return {
    ...stub,
    ...updatedStub,
  };
};

const formatSearchResult = (stub) => {
  const isNonResident = !stub.barangay_id;

  return {
    id: stub.id,
    stub_no: stub.stub_no,
    display_stub_no: formatStubDisplayNo(stub.stub_sequence_no),
    serial_no: stub.serial_no,
    status: stub.status,
    issued_at: stub.issued_at,
    qr_code_value: stub.qr_code_value || null,
    qr_generated_at: stub.qr_generated_at || null,
    qr_generated_by: stub.qr_generated_by || null,
    qr_status: stub.qr_status || null,
    qr_notes: stub.qr_notes || null,
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

const createBarangayScopeRequiredError = (resourceName) => {
  const error = new Error(
    "Barangay " +
      resourceName +
      " requires an account with an assigned barangay.",
  );
  error.statusCode = 403;
  error.code = "NO_ASSIGNED_BARANGAY";
  return error;
};

const getRequesterBarangayScope = async (requester, resourceName) => {
  if (requester?.roleCode !== BARANGAY_ROLE_CODE) {
    return null;
  }

  const barangayId = await resolveRequesterBarangayId(requester);

  if (!barangayId) {
    throw createBarangayScopeRequiredError(resourceName);
  }

  return barangayId;
};

const getSearchResults = async (filters, requester = null) => {
  const requesterBarangayId = await getRequesterBarangayScope(
    requester,
    "stub search",
  );
  const effectiveBarangayId =
    requester?.roleCode === BARANGAY_ROLE_CODE
      ? requesterBarangayId
      : filters.barangay_id;
  const stubs = await stubRepository.getStubSearchResults(
    filters.q,
    filters.disaster_event_id,
    effectiveBarangayId,
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

  if (filters.override_barangay_id && !isOverrideAllowed) {
    const error = new Error("Barangay override is only available outside production");
    error.statusCode = 403;
    error.code = "BARANGAY_OVERRIDE_NOT_ALLOWED";
    throw error;
  }

  if (userScope?.default_barangay_id) {
    effectiveBarangay = await masterlistRepository.getBarangaySummaryById(
      userScope.default_barangay_id,
    );
  } else if (filters.barangay_id) {
    effectiveBarangay = await masterlistRepository.getBarangaySummaryById(
      filters.barangay_id,
    );

    if (!effectiveBarangay || effectiveBarangay.is_active === false) {
      const error = new Error("barangay_id is invalid");
      error.statusCode = 400;
      error.code = "INVALID_BARANGAY";
      throw error;
    }
  } else if (filters.override_barangay_id) {
    effectiveBarangay = await masterlistRepository.getBarangaySummaryById(
      filters.override_barangay_id,
    );

    if (!effectiveBarangay || effectiveBarangay.is_active === false) {
      const error = new Error("override_barangay_id is invalid");
      error.statusCode = 400;
      error.code = "INVALID_OVERRIDE_BARANGAY";
      throw error;
    }
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
  const isPaginated = Boolean(filters.is_paginated);
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 25;
  const offset = (page - 1) * pageSize;
  const rowOptions = isPaginated
    ? {
        status: filters.status || "all",
        search: filters.search || "",
        sectorIds: filters.sector_ids || [],
        sortOrder: filters.sort_order || "oldest",
        limit: pageSize,
        offset,
      }
    : {};
  const [rows, totalItems] = await Promise.all([
    stubRepository.getBarangayStubDashboardRows(
      filters.disaster_event_id,
      effectiveBarangay.id,
      rowOptions,
    ),
    isPaginated
      ? stubRepository.countBarangayStubDashboardRows(
          filters.disaster_event_id,
          effectiveBarangay.id,
          rowOptions,
        )
      : Promise.resolve(null),
  ]);
  const rowsWithQr = await Promise.all(
    rows.map((row) => ensureStubQrMetadata(row, filters.qr_generated_by)),
  );
  const householdIds = rowsWithQr.map((row) => row.household_id);
  const householdSectors =
    await stubRepository.getHouseholdSectorsByHouseholdIds(householdIds);
  const memberSectors =
    await stubRepository.getMemberSectorsByHouseholdIds(householdIds);
  const reliefPackTemplates =
    await reliefPackTemplateRepository.getReliefPackTemplates({
      is_active: true,
      based_on_family_size: null,
      based_on_sector: null,
      search: "",
      disaster_type: scopedDisasterEvent.disaster_type || null,
    });
  const householdSectorsByHouseholdId = groupByKey(
    householdSectors,
    "household_id",
  );
  const memberSectorsByHouseholdId = groupByKey(
    memberSectors,
    "household_id",
  );
  const donatedReliefPackPreviewByQueuePosition = new Map();
  const getDonatedReliefPackPreviewForQueuePosition = async (queuePosition) => {
    const normalizedQueuePosition = Number(queuePosition || 0);

    if (normalizedQueuePosition <= 0) {
      return [];
    }

    if (!donatedReliefPackPreviewByQueuePosition.has(normalizedQueuePosition)) {
      donatedReliefPackPreviewByQueuePosition.set(
        normalizedQueuePosition,
        getAvailableDonatedReliefPacksForClaimPreview(
          filters.disaster_event_id,
          normalizedQueuePosition,
        ),
      );
    }

    return await donatedReliefPackPreviewByQueuePosition.get(
      normalizedQueuePosition,
    );
  };
  const templateItemsByTemplateId = new Map();
  const donatedLooseItemPreviewByQueuePosition = new Map();
  const getDonatedLooseItemPreviewForQueuePosition = async (
    queuePosition,
    excludedInventoryItemIds = [],
  ) => {
    const normalizedQueuePosition = Number(queuePosition || 0);
    const normalizedExcludedInventoryItemIds = [
      ...new Set(
        (excludedInventoryItemIds || [])
          .map((inventoryItemId) => String(inventoryItemId || "").trim())
          .filter(Boolean),
      ),
    ].sort();
    const cacheKey = [
      normalizedQueuePosition,
      normalizedExcludedInventoryItemIds.join(","),
    ].join("|");

    if (normalizedQueuePosition <= 0) {
      return [];
    }

    if (!donatedLooseItemPreviewByQueuePosition.has(cacheKey)) {
      donatedLooseItemPreviewByQueuePosition.set(
        cacheKey,
        getAvailableDonatedLooseItemsForClaimPreview(
          filters.disaster_event_id,
          normalizedQueuePosition,
          metrics.unclaimed_stubs,
          {
            excludedInventoryItemIds: normalizedExcludedInventoryItemIds,
          },
        ),
      );
    }

    return await donatedLooseItemPreviewByQueuePosition.get(cacheKey);
  };

  const response = {
    assigned_barangay: {
      id: effectiveBarangay.id,
      code: effectiveBarangay.code,
      name: effectiveBarangay.name,
    },
    assigned_barangay_id: userScope?.default_barangay_id || null,
    is_dev_override: Boolean(
      filters.override_barangay_id &&
      !filters.barangay_id &&
      effectiveBarangay.id === filters.override_barangay_id,
    ),
    disaster_event: scopedDisasterEvent,
    metrics,
    count: isPaginated ? totalItems : rows.length,
    data: await Promise.all(rowsWithQr.map(async (row) => {
      const sectorIds = buildSectorIds(
        row.household_id,
        householdSectorsByHouseholdId,
        memberSectorsByHouseholdId,
      );
      const storedAssignedReliefPacks =
        normalizeReliefPackAssignmentSnapshots(
          row.assigned_relief_pack_snapshots,
        );
      const liveAssignedReliefPacks =
        getAssignedReliefPackTemplatesForSectorIds(
          sectorIds,
          reliefPackTemplates,
          scopedDisasterEvent.disaster_type,
        ).map((template) => ({
          id: template.id,
          name: template.name,
          description: template.description || null,
          based_on_family_size: Boolean(template.based_on_family_size),
          is_additional_pack: Boolean(template.is_additional_pack),
          sector_id: template.sector_id || null,
        }));
      const assignedReliefPacks = isLiveUnclaimedReliefPackAssignment({
        status: row.status,
        disasterEventStatus: scopedDisasterEvent.status,
      })
        ? liveAssignedReliefPacks
        : storedAssignedReliefPacks ?? liveAssignedReliefPacks;
      const showLiveClaimPreview = isLiveUnclaimedReliefPackAssignment({
        status: row.status,
        disasterEventStatus: scopedDisasterEvent.status,
      });
      const reliefPackName = assignedReliefPacks
        .map((template) => template.name)
        .filter(Boolean)
        .join(", ");
      const assignedReliefPackComponentItemIds =
        await getReliefPackComponentItemIds(
          assignedReliefPacks,
          templateItemsByTemplateId,
        );

      return {
        id: row.id,
        stub_no: row.stub_no,
        display_stub_no: formatStubDisplayNo(row.stub_sequence_no),
        serial_no: row.serial_no,
        stub_sequence_no: row.stub_sequence_no,
        status: row.status,
        issued_at: row.issued_at,
        claimed_at: row.claimed_at || null,
        distribution_date: row.distribution_date || null,
        received_at: row.received_at || null,
        receipt_no: row.receipt_no || null,
        verified_by_name: row.verified_by_name || null,
        qr_code_value: row.qr_code_value || null,
        qr_generated_at: row.qr_generated_at || null,
        qr_generated_by: row.qr_generated_by || null,
        qr_status: row.qr_status || null,
        qr_notes: row.qr_notes || null,
        queue_time_in: row.queue_time_in || null,
        latest_attendance_status: row.latest_attendance_status || null,
        latest_attendance_time_out: row.latest_attendance_time_out || null,
        barangay_id: row.barangay_id || null,
        barangay_name: row.barangay_name || null,
        unclaimed_queue_position: row.unclaimed_queue_position || null,
        household: {
          id: row.household_id,
          family_head_name: buildFullName(
            row.family_head_first_name,
            row.family_head_middle_name,
            row.family_head_last_name,
            row.family_head_suffix,
          ),
          household_size: row.household_size || row.members_count,
          members_count: row.members_count,
          is_active: row.is_active !== false,
          family_head_photo_url: row.family_head_photo_url || null,
          photo_captured_at: row.photo_captured_at || null,
          photo_verification_notes: row.photo_verification_notes || null,
        },
        sectors_text: buildSectorsText(
          row.household_id,
          householdSectorsByHouseholdId,
          memberSectorsByHouseholdId,
        ),
        sectors: buildSectors(
          row.household_id,
          householdSectorsByHouseholdId,
          memberSectorsByHouseholdId,
        ),
        sector_ids: sectorIds,
        assigned_relief_packs: assignedReliefPacks,
        available_donated_relief_packs:
          showLiveClaimPreview
            ? await getDonatedReliefPackPreviewForQueuePosition(
                row.unclaimed_queue_position,
              )
            : [],
        available_donated_loose_items:
          showLiveClaimPreview
            ? await getDonatedLooseItemPreviewForQueuePosition(
                row.unclaimed_queue_position,
                assignedReliefPackComponentItemIds,
              )
            : [],
        relief_pack_name: reliefPackName || "--",
      };
    })),
  };

  if (isPaginated) {
    response.pagination = buildPaginationMetadata({
      page,
      pageSize,
      totalItems,
    });
  }

  return response;
};

const getMunicipalStubDashboard = async ({
  disaster_event_id: disasterEventId,
  requester,
  qr_generated_by: qrGeneratedBy,
} = {}) => {
  if (requester?.roleCode !== MAYOR_ROLE_CODE) {
    const error = new Error(
      "Only Mayor users can access the municipal stub dashboard",
    );
    error.statusCode = 403;
    error.code = "MUNICIPAL_STUB_FORBIDDEN";
    throw error;
  }

  const scopedDisasterEvent =
    await disasterEventRepository.getDisasterEventById(disasterEventId);

  if (!scopedDisasterEvent) {
    const error = new Error("Disaster event not found");
    error.statusCode = 404;
    error.code = "DISASTER_EVENT_NOT_FOUND";
    throw error;
  }

  if (scopedDisasterEvent.status !== "ACTIVE") {
    const error = new Error("Disaster event is not active");
    error.statusCode = 400;
    error.code = "DISASTER_EVENT_NOT_ACTIVE";
    throw error;
  }

  const mappedBarangays =
    await disasterEventRepository.getAffectedBarangayScopeByDisasterEventId(
      disasterEventId,
    );
  const hasInvalidBarangayScope = mappedBarangays.some(
    (barangay) =>
      !barangay?.mapped_barangay_id ||
      !barangay?.id ||
      String(barangay.mapped_barangay_id) !== String(barangay.id) ||
      barangay.is_active !== true,
  );

  if (hasInvalidBarangayScope) {
    const error = new Error(
      "The disaster event has an invalid affected barangay scope",
    );
    error.statusCode = 409;
    error.code = "INVALID_EVENT_BARANGAY_SCOPE";
    throw error;
  }

  const affectedBarangaysById = new Map();
  mappedBarangays.forEach((barangay) => {
    if (!affectedBarangaysById.has(barangay.id)) {
      affectedBarangaysById.set(barangay.id, {
        id: barangay.id,
        code: barangay.code,
        name: barangay.name,
      });
    }
  });
  const affectedBarangays = [...affectedBarangaysById.values()].sort(
    (left, right) =>
      String(left.name || "").localeCompare(String(right.name || "")) ||
      String(left.id || "").localeCompare(String(right.id || "")),
  );
  const barangayIds = affectedBarangays.map((barangay) => barangay.id);
  const responseContext = {
    scope: "municipal",
    disaster_event: scopedDisasterEvent,
    barangay_ids: barangayIds,
    barangay_count: barangayIds.length,
  };

  if (barangayIds.length === 0) {
    return {
      ...responseContext,
      count: 0,
      data: [],
    };
  }

  const rows = await stubRepository.getMunicipalStubDashboardRows(
    disasterEventId,
    barangayIds,
  );
  const rowsWithQr = await Promise.all(
    rows.map((row) => ensureStubQrMetadata(row, qrGeneratedBy)),
  );
  const householdIds = [
    ...new Set(rowsWithQr.map((row) => row.household_id).filter(Boolean)),
  ];
  const [householdSectors, memberSectors, reliefPackTemplates] =
    await Promise.all([
      stubRepository.getHouseholdSectorsByHouseholdIds(householdIds),
      stubRepository.getMemberSectorsByHouseholdIds(householdIds),
      reliefPackTemplateRepository.getReliefPackTemplates({
        is_active: true,
        based_on_family_size: null,
        based_on_sector: null,
        search: "",
        disaster_type: scopedDisasterEvent.disaster_type || null,
      }),
    ]);
  const householdSectorsByHouseholdId = groupByKey(
    householdSectors,
    "household_id",
  );
  const memberSectorsByHouseholdId = groupByKey(
    memberSectors,
    "household_id",
  );
  const municipalUnclaimedStubCount = rowsWithQr.filter(
    (row) =>
      row.status === "ISSUED" &&
      row.is_active === true &&
      row.latest_attendance_status === "PRESENT" &&
      row.latest_attendance_time_out === null,
  ).length;
  const donatedReliefPackPreviewByQueuePosition = new Map();
  const getDonatedReliefPackPreviewForQueuePosition = async (queuePosition) => {
    const normalizedQueuePosition = Number(queuePosition || 0);

    if (normalizedQueuePosition <= 0) {
      return [];
    }

    if (!donatedReliefPackPreviewByQueuePosition.has(normalizedQueuePosition)) {
      donatedReliefPackPreviewByQueuePosition.set(
        normalizedQueuePosition,
        getAvailableDonatedReliefPacksForClaimPreview(
          disasterEventId,
          normalizedQueuePosition,
        ),
      );
    }

    return await donatedReliefPackPreviewByQueuePosition.get(
      normalizedQueuePosition,
    );
  };
  const templateItemsByTemplateId = new Map();
  const donatedLooseItemPreviewByQueuePosition = new Map();
  const getDonatedLooseItemPreviewForQueuePosition = async (
    queuePosition,
    excludedInventoryItemIds = [],
  ) => {
    const normalizedQueuePosition = Number(queuePosition || 0);
    const normalizedExcludedInventoryItemIds = [
      ...new Set(
        (excludedInventoryItemIds || [])
          .map((inventoryItemId) => String(inventoryItemId || "").trim())
          .filter(Boolean),
      ),
    ].sort();
    const cacheKey = [
      normalizedQueuePosition,
      normalizedExcludedInventoryItemIds.join(","),
    ].join("|");

    if (normalizedQueuePosition <= 0) {
      return [];
    }

    if (!donatedLooseItemPreviewByQueuePosition.has(cacheKey)) {
      donatedLooseItemPreviewByQueuePosition.set(
        cacheKey,
        getAvailableDonatedLooseItemsForClaimPreview(
          disasterEventId,
          normalizedQueuePosition,
          municipalUnclaimedStubCount,
          {
            excludedInventoryItemIds: normalizedExcludedInventoryItemIds,
          },
        ),
      );
    }

    return await donatedLooseItemPreviewByQueuePosition.get(cacheKey);
  };

  const data = await Promise.all(
    rowsWithQr.map(async (row) => {
      const sectorIds = buildSectorIds(
        row.household_id,
        householdSectorsByHouseholdId,
        memberSectorsByHouseholdId,
      );
      const storedAssignedReliefPacks =
        normalizeReliefPackAssignmentSnapshots(
          row.assigned_relief_pack_snapshots,
        );
      const liveAssignedReliefPacks =
        getAssignedReliefPackTemplatesForSectorIds(
          sectorIds,
          reliefPackTemplates,
          scopedDisasterEvent.disaster_type,
        ).map((template) => ({
          id: template.id,
          name: template.name,
          description: template.description || null,
          based_on_family_size: Boolean(template.based_on_family_size),
          is_additional_pack: Boolean(template.is_additional_pack),
          sector_id: template.sector_id || null,
        }));
      const assignedReliefPacks = isLiveUnclaimedReliefPackAssignment({
        status: row.status,
        disasterEventStatus: scopedDisasterEvent.status,
      })
        ? liveAssignedReliefPacks
        : storedAssignedReliefPacks ?? liveAssignedReliefPacks;
      const showLiveClaimPreview = isLiveUnclaimedReliefPackAssignment({
        status: row.status,
        disasterEventStatus: scopedDisasterEvent.status,
      });
      const reliefPackName = assignedReliefPacks
        .map((template) => template.name)
        .filter(Boolean)
        .join(", ");
      const assignedReliefPackComponentItemIds =
        await getReliefPackComponentItemIds(
          assignedReliefPacks,
          templateItemsByTemplateId,
        );

      return {
        id: row.id,
        stub_no: row.stub_no,
        display_stub_no: formatStubDisplayNo(row.stub_sequence_no),
        serial_no: row.serial_no,
        stub_sequence_no: row.stub_sequence_no,
        status: row.status,
        issued_at: row.issued_at,
        claimed_at: row.claimed_at || null,
        distribution_date: row.distribution_date || null,
        received_at: row.received_at || null,
        receipt_no: row.receipt_no || null,
        verified_by_name: row.verified_by_name || null,
        qr_code_value: row.qr_code_value || null,
        qr_generated_at: row.qr_generated_at || null,
        qr_generated_by: row.qr_generated_by || null,
        qr_status: row.qr_status || null,
        qr_notes: row.qr_notes || null,
        queue_time_in: row.queue_time_in || null,
        latest_attendance_status: row.latest_attendance_status || null,
        latest_attendance_time_out: row.latest_attendance_time_out || null,
        barangay_id: row.barangay_id || null,
        barangay_name: row.barangay_name || null,
        unclaimed_queue_position: row.unclaimed_queue_position || null,
        household: {
          id: row.household_id,
          family_head_name: buildFullName(
            row.family_head_first_name,
            row.family_head_middle_name,
            row.family_head_last_name,
            row.family_head_suffix,
          ),
          household_size: row.household_size || row.members_count,
          members_count: row.members_count,
          is_active: row.is_active !== false,
          family_head_photo_url: row.family_head_photo_url || null,
          photo_captured_at: row.photo_captured_at || null,
          photo_verification_notes: row.photo_verification_notes || null,
        },
        sectors_text: buildSectorsText(
          row.household_id,
          householdSectorsByHouseholdId,
          memberSectorsByHouseholdId,
        ),
        sectors: buildSectors(
          row.household_id,
          householdSectorsByHouseholdId,
          memberSectorsByHouseholdId,
        ),
        sector_ids: sectorIds,
        assigned_relief_packs: assignedReliefPacks,
        available_donated_relief_packs: showLiveClaimPreview
          ? await getDonatedReliefPackPreviewForQueuePosition(
              row.unclaimed_queue_position,
            )
          : [],
        available_donated_loose_items: showLiveClaimPreview
          ? await getDonatedLooseItemPreviewForQueuePosition(
              row.unclaimed_queue_position,
              assignedReliefPackComponentItemIds,
            )
          : [],
        relief_pack_name: reliefPackName || "--",
      };
    }),
  );

  return {
    ...responseContext,
    count: data.length,
    data,
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

  assertStubMatchesRequestedEvent(scopedStub, params.disaster_event_id);

  if (scopedStub.is_active === false) {
    throw buildArchivedHouseholdError(scopedStub);
  }

  if (scopedStub.status === "CLAIMED") {
    const latestDistributionTransaction =
      await stubRepository.getLatestDistributionTransactionByStubId(scopedStub.id);
    throw buildStubAlreadyClaimedError(scopedStub, latestDistributionTransaction);
  }

  if (scopedStub.status !== "ISSUED") {
    throw buildQrValidationError({
      code: "STUB_NOT_CLAIMABLE",
      message: "Only unclaimed stubs can be marked as claimed.",
      statusCode: 400,
      details: buildStubReferenceDetails(scopedStub),
    });
  }

  const externalClient = params.dbClient || null;
  const client = externalClient || await pool.connect();

  try {
    if (!externalClient) {
      await client.query("BEGIN");
    }

    const lockedStub = await distributionTransactionRepository.getStubByIdForUpdate(
      params.id,
      client,
    );

    if (!lockedStub || lockedStub.barangay_id !== effectiveBarangay.id) {
      const error = new Error("Stub not found for this barangay");
      error.statusCode = 404;
      error.code = "STUB_NOT_FOUND";
      throw error;
    }

    assertStubMatchesRequestedEvent(lockedStub, params.disaster_event_id);

    if (lockedStub.is_active === false) {
      throw buildArchivedHouseholdError(lockedStub);
    }

    if (lockedStub.status === "CLAIMED") {
      const latestDistributionTransaction =
        await stubRepository.getLatestDistributionTransactionByStubId(
          lockedStub.id,
        );
      throw buildStubAlreadyClaimedError(lockedStub, latestDistributionTransaction);
    }

    if (lockedStub.status !== "ISSUED") {
      throw buildQrValidationError({
        code: "STUB_NOT_CLAIMABLE",
        message: "Only unclaimed stubs can be marked as claimed.",
        statusCode: 400,
        details: buildStubReferenceDetails(lockedStub),
      });
    }

    assertDisasterEventActiveForNewClaim(lockedStub);

    const receivedAt = params.claimed_at || new Date().toISOString();
    const automaticClaimResult = await recordAutomaticReliefPackClaim({
      client,
      stub: lockedStub,
      claimedByName: buildFullName(
        lockedStub.family_head_first_name,
        lockedStub.family_head_middle_name,
        lockedStub.family_head_last_name,
        lockedStub.family_head_suffix,
      ),
      verifiedBy: params.verified_by || null,
      qrReferenceValue: lockedStub.qr_code_value || null,
      qrScannedAt: null,
      qrScannedBy: null,
      receivedAt,
      claimedAt: params.claimed_at || null,
      remarks: "Claimed through Relief Goods Distribution confirmation",
    });
    const {
      distributionTransaction,
      assignedReliefPackTemplates,
      updatedStub,
      packQuantity,
      donatedReliefPacks,
      donatedLooseItems,
    } = automaticClaimResult;

    if (!externalClient) {
      await client.query("COMMIT");
    }

    return {
      message: "Stub marked as claimed successfully.",
      data: {
        id: updatedStub.id,
        status: updatedStub.status,
        claimed_at: updatedStub.claimed_at,
        updated_at: updatedStub.updated_at,
        distribution_transaction_id: distributionTransaction.id,
        distribution_status: distributionTransaction.distribution_status,
        relief_pack_template_names: (assignedReliefPackTemplates || [])
          .map((template) => template?.name)
          .filter(Boolean),
        relief_pack_quantity: packQuantity || 1,
        donated_relief_packs: donatedReliefPacks || [],
        donated_loose_items: donatedLooseItems || [],
      },
    };
  } catch (error) {
    if (!externalClient) {
      await client.query("ROLLBACK");
    }

    if (
      error.code === "23505" &&
      DISTRIBUTION_STUB_UNIQUE_CONSTRAINTS.has(error.constraint)
    ) {
      const latestDistributionTransaction =
        await stubRepository.getLatestDistributionTransactionByStubId(params.id);
      throw buildStubAlreadyClaimedError(scopedStub, latestDistributionTransaction);
    }

    throw error;
  } finally {
    if (!externalClient) {
      client.release();
    }
  }
};

const getStubDetails = async (id, requester = null) => {
  const requesterBarangayId = await getRequesterBarangayScope(
    requester,
    "stub detail",
  );

  const stub = await stubRepository.getStubById(id, requesterBarangayId);

  if (!stub) {
    return null;
  }

  const scopedRequester =
    requester?.roleCode === BARANGAY_ROLE_CODE && requesterBarangayId
      ? { ...requester, defaultBarangayId: requesterBarangayId }
      : requester;
  assertBarangayRecordViewScope(stub, scopedRequester);

  const ensuredStub = await ensureStubQrMetadata(stub, null);

  const householdSectors = await stubRepository.getHouseholdSectorsByHouseholdId(
    ensuredStub.household_id,
  );
  const memberSectors = await stubRepository.getMemberSectorsByHouseholdIds([
    ensuredStub.household_id,
  ]);
  const reliefPackTemplates =
    await reliefPackTemplateRepository.getReliefPackTemplates({
      is_active: true,
      based_on_family_size: null,
      based_on_sector: null,
      search: "",
      disaster_type: ensuredStub.disaster_type || null,
    });
  const membersCount = await stubRepository.getHouseholdMembersCount(
    ensuredStub.household_id,
  );
  const members = await stubRepository.getHouseholdMembersByHouseholdId(
    ensuredStub.household_id,
  );
  const latestAttendance = await stubRepository.getLatestAttendanceByHouseholdId(
    ensuredStub.household_id,
    ensuredStub.disaster_event_id,
  );
  const latestDistributionTransaction =
    await stubRepository.getLatestDistributionTransactionByStubId(
      ensuredStub.id,
    );
  const householdMembers = members
    .filter((member) => !member.is_family_head)
    .map((member) => ({
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
      sectors: memberSectors
        .filter((sector) => sector.evacuee_id === member.evacuee_id)
        .map((sector) => ({
          id: sector.id,
          code: sector.code,
          name: sector.name,
        })),
    }));
  const householdSectorIds = buildSectorIds(
    ensuredStub.household_id,
    {
      [ensuredStub.household_id]: householdSectors,
    },
    {
      [ensuredStub.household_id]: memberSectors,
    },
  );
  const storedAssignedReliefPacks = normalizeReliefPackAssignmentSnapshots(
    ensuredStub.assigned_relief_pack_snapshots,
  );
  const liveAssignedReliefPackTemplates =
    getAssignedReliefPackTemplatesForSectorIds(
      householdSectorIds,
      reliefPackTemplates,
      ensuredStub.disaster_type,
    );
  const useLiveAssignment = isLiveUnclaimedReliefPackAssignment({
    status: ensuredStub.status,
    disasterEventStatus: ensuredStub.disaster_event_status,
  });
  const assignedReliefPackTemplates = useLiveAssignment
    ? liveAssignedReliefPackTemplates
    : storedAssignedReliefPacks ?? liveAssignedReliefPackTemplates;
  const assignedReliefPacks = useLiveAssignment
    ? assignedReliefPackTemplates.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description || null,
        based_on_family_size: Boolean(template.based_on_family_size),
        is_additional_pack: Boolean(template.is_additional_pack),
        sector_id: template.sector_id || null,
      }))
    : storedAssignedReliefPacks ?? assignedReliefPackTemplates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description || null,
      based_on_family_size: Boolean(template.based_on_family_size),
      is_additional_pack: Boolean(template.is_additional_pack),
      sector_id: template.sector_id || null,
    }));
  const assignedReliefPackComponentItemIds =
    await getReliefPackComponentItemIds(assignedReliefPacks);
  const assignedReliefPackNames = assignedReliefPacks
    .map((template) => template.name)
    .filter(Boolean)
    .join(", ");
  const stubQueueContext =
    useLiveAssignment
      ? await distributionTransactionRepository.getPresentUnclaimedStubQueueContext(
          ensuredStub.id,
        )
      : { queue_position: 0, eligible_households_count: 0 };
  const availableDonatedReliefPacks =
    useLiveAssignment
      ? await getAvailableDonatedReliefPacksForClaimPreview(
          ensuredStub.disaster_event_id,
          stubQueueContext.queue_position,
        )
      : [];
  const availableDonatedLooseItems =
    useLiveAssignment
      ? await getAvailableDonatedLooseItemsForClaimPreview(
          ensuredStub.disaster_event_id,
          stubQueueContext.queue_position,
          stubQueueContext.eligible_households_count,
          { excludedInventoryItemIds: assignedReliefPackComponentItemIds },
        )
      : [];

  return {
    id: ensuredStub.id,
    stub_no: ensuredStub.stub_no,
    display_stub_no: formatStubDisplayNo(ensuredStub.stub_sequence_no),
    serial_no: ensuredStub.serial_no,
    status: ensuredStub.status,
    issued_by: ensuredStub.issued_by,
    issued_at: ensuredStub.issued_at,
    claimed_at: ensuredStub.claimed_at,
    updated_at: ensuredStub.updated_at,
    qr_code_value: ensuredStub.qr_code_value || null,
    qr_generated_at: ensuredStub.qr_generated_at || null,
    qr_generated_by: ensuredStub.qr_generated_by || null,
    qr_status: ensuredStub.qr_status || null,
    qr_notes: ensuredStub.qr_notes || null,
    disaster_event: {
      id: ensuredStub.disaster_event_id,
      event_code: ensuredStub.event_code,
      title: ensuredStub.disaster_event_title,
      disaster_type: ensuredStub.disaster_type,
      status: ensuredStub.disaster_event_status,
    },
    household: {
      id: ensuredStub.household_id,
      family_head_name: buildFullName(
        ensuredStub.family_head_first_name,
        ensuredStub.family_head_middle_name,
        ensuredStub.family_head_last_name,
        ensuredStub.family_head_suffix,
      ),
      household_size: ensuredStub.household_size,
      residency_status: ensuredStub.residency_status,
      contact_number: ensuredStub.contact_number,
      current_stay_type: ensuredStub.current_stay_type,
      current_address_details: ensuredStub.current_address_details,
      is_active: ensuredStub.is_active,
      registered_at: ensuredStub.registered_at,
      members_count: membersCount,
      members: householdMembers,
      family_head_photo_url: ensuredStub.family_head_photo_url || null,
      photo_captured_at: ensuredStub.photo_captured_at || null,
      photo_captured_by: ensuredStub.photo_captured_by || null,
      photo_verification_notes: ensuredStub.photo_verification_notes || null,
    },
    distribution_transaction: latestDistributionTransaction,
    assigned_relief_packs: assignedReliefPacks,
    available_donated_relief_packs: availableDonatedReliefPacks,
    available_donated_loose_items: availableDonatedLooseItems,
    relief_pack_name:
      latestDistributionTransaction?.relief_pack_template_name ||
      assignedReliefPackNames ||
      null,
    latest_attendance: latestAttendance,
    barangay: {
      id: ensuredStub.barangay_id,
      code: ensuredStub.barangay_code,
      name: ensuredStub.barangay_id
        ? ensuredStub.barangay_name
        : "Non-Resident (Outside Malvar)",
    },
    household_sectors: householdSectors,
    member_sectors: memberSectors,
    sectors_text: buildSectorsText(
      ensuredStub.household_id,
      {
        [ensuredStub.household_id]: householdSectors,
      },
      {
        [ensuredStub.household_id]: memberSectors,
      },
    ),
  };
};

const getClaimabilityResult = ({
  stub,
  latestDistributionTransaction = null,
  latestAttendance = null,
}) => {
  if (stub.is_active === false) {
    return {
      is_claimable: false,
      code: ARCHIVED_HOUSEHOLD_CODE,
      reason: "This household is archived and cannot receive a new relief distribution.",
      message: "This household is archived and cannot receive a new relief distribution.",
      details: buildStubReferenceDetails(stub),
    };
  }

  if (stub.status === "CLAIMED") {
    return {
      is_claimable: false,
      code: STUB_ALREADY_CLAIMED_CODE,
      reason: "Stub already claimed",
      message: "Stub already claimed",
      details: buildClaimedStubDetails(stub, latestDistributionTransaction),
    };
  }

  if (stub.qr_status && stub.qr_status !== ACTIVE_QR_STATUS) {
    return {
      is_claimable: false,
      code: "QR_INACTIVE",
      reason: "QR code is inactive",
      message: "QR code is inactive",
      details: buildStubReferenceDetails(stub),
    };
  }

  if (stub.status === "ISSUED") {
    if (
      stub.disaster_event_status &&
      stub.disaster_event_status !== "ACTIVE"
    ) {
      return {
        is_claimable: false,
        code: "DISASTER_EVENT_NOT_ACTIVE",
        reason:
          "Relief claim cannot be completed because the disaster event is not active.",
        message:
          "Relief claim cannot be completed because the disaster event is not active.",
        details: buildStubReferenceDetails(stub),
      };
    }

    if (
      !isReliefPackClaimHouseholdCurrentlyEligible(stub, latestAttendance)
    ) {
      return {
        is_claimable: false,
        code: HOUSEHOLD_NOT_PRESENT_CODE,
        reason:
          "Relief packs can only be claimed by households currently present in an evacuation center.",
        message:
          "Relief packs can only be claimed by households currently present in an evacuation center.",
        details: buildStubReferenceDetails(stub),
      };
    }

    return {
      is_claimable: true,
      code: null,
      reason: null,
      message: "Stub verified successfully",
      details: {},
    };
  }

  if (stub.status === "CANCELLED") {
    return {
      is_claimable: false,
      code: "STUB_CANCELLED",
      reason: "Stub has been cancelled",
      message: "Stub has been cancelled",
      details: buildStubReferenceDetails(stub),
    };
  }

  if (stub.status === "VOID") {
    return {
      is_claimable: false,
      code: "STUB_VOID",
      reason: "Stub has been voided",
      message: "Stub has been voided",
      details: buildStubReferenceDetails(stub),
    };
  }

  return {
    is_claimable: false,
    code: "STUB_UNAVAILABLE",
    reason: "Stub is not claimable",
    message: "Stub is not claimable",
    details: buildStubReferenceDetails(stub),
  };
};

const verifyStub = async (identifier, requester = null) => {
  let normalizedIdentifier = identifier || {};
  let normalizedRequester = requester;

  // Keep compatibility with the previous service call shape while the route
  // and new callers pass the requester as a separate argument.
  if (!requester && identifier?.requester) {
    const { requester: embeddedRequester, ...identifierWithoutRequester } =
      identifier;
    normalizedIdentifier = identifierWithoutRequester;
    normalizedRequester = embeddedRequester;
  }

  const requesterBarangayId = await getRequesterBarangayScope(
    normalizedRequester,
    "stub verification",
  );

  if (
    normalizedIdentifier.qr_code_value &&
    !String(normalizedIdentifier.qr_code_value || "")
      .trim()
      .startsWith("DISTYNC-STUB|")
  ) {
    throw buildQrValidationError({
      code: "INVALID_QR_STUB",
      message:
        "The scanned QR code is not recognized as a valid DISTYNC relief stub.",
      statusCode: 400,
    });
  }

  const stub = normalizedIdentifier.qr_code_value
    ? await stubRepository.getStubByQrCodeValue(
        normalizedIdentifier.qr_code_value,
        requesterBarangayId,
      )
    : await stubRepository.getStubByStubNoOrSerialNo(
        normalizedIdentifier,
        requesterBarangayId,
      );

  if (!stub) {
    throw buildQrValidationError({
      code: "STUB_NOT_FOUND",
      message: "Stub not found",
      statusCode: 404,
    });
  }

  const ensuredStub = await ensureStubQrMetadata(stub, null);
  const scopedRequester =
    normalizedRequester?.roleCode === BARANGAY_ROLE_CODE && requesterBarangayId
      ? { ...normalizedRequester, defaultBarangayId: requesterBarangayId }
      : normalizedRequester;
  assertBarangayRecordViewScope(ensuredStub, scopedRequester);
  const latestDistributionTransaction =
    ensuredStub.status === "ISSUED"
      ? null
      : await stubRepository.getLatestDistributionTransactionByStubId(
          ensuredStub.id,
        );
  const latestAttendance =
    ensuredStub.status === "ISSUED"
      ? await stubRepository.getLatestAttendanceByHouseholdId(
          ensuredStub.household_id,
          ensuredStub.disaster_event_id,
        )
      : null;
  const claimability = getClaimabilityResult({
    stub: ensuredStub,
    latestDistributionTransaction,
    latestAttendance,
  });

  return {
    message: claimability.message,
    data: {
      is_valid: true,
      is_claimable: claimability.is_claimable,
      code: claimability.code,
      reason: claimability.reason,
      details: claimability.details,
      stub: {
        id: ensuredStub.id,
        stub_no: ensuredStub.stub_no,
        display_stub_no: formatStubDisplayNo(ensuredStub.stub_sequence_no),
        serial_no: ensuredStub.serial_no,
        status: ensuredStub.status,
        issued_at: ensuredStub.issued_at,
        qr_code_value: ensuredStub.qr_code_value || null,
        qr_generated_at: ensuredStub.qr_generated_at || null,
        qr_generated_by: ensuredStub.qr_generated_by || null,
        qr_status: ensuredStub.qr_status || null,
        qr_notes: ensuredStub.qr_notes || null,
      },
      household: {
        id: ensuredStub.household_id,
        family_head_name: buildFullName(
          ensuredStub.family_head_first_name,
          ensuredStub.family_head_middle_name,
          ensuredStub.family_head_last_name,
          ensuredStub.family_head_suffix,
        ),
        household_size: ensuredStub.household_size,
        is_active: ensuredStub.is_active !== false,
        contact_number: ensuredStub.contact_number,
        barangay_name:
          ensuredStub.barangay_name || "Non-Resident (Outside Malvar)",
        family_head_photo_url: ensuredStub.family_head_photo_url || null,
        photo_captured_at: ensuredStub.photo_captured_at || null,
        photo_verification_notes: ensuredStub.photo_verification_notes || null,
      },
    },
  };
};

const getStubClaimHistory = async (filters) => {
  return stubRepository.getStubClaimHistory(filters);
};

const exportStubClaimHistory = async (filters) => {
  const rows = await stubRepository.getStubClaimHistory({
    disasterEventId: filters.disaster_event_id || null,
    barangayId: filters.barangay_id || null,
    status: filters.status || null,
    dateFrom: filters.date_from || null,
    dateTo: filters.date_to || null,
    limit: 1000,
  });

  return mswdoReportExport.buildExportFile({
    filePrefix: "mswdo-stub-claim-history",
    worksheetName: "Stub Claim History",
    reportTitle: "MSWDO Stub and Claim History",
    metadata: [
      {
        label: "Disaster Event",
        value: filters.disaster_event_id || "All",
      },
      {
        label: "Barangay",
        value: filters.barangay_id || "All",
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
      { key: "family_head_name", label: "Family Head", width: 28, pdfWidth: 95 },
      { key: "barangay_name", label: "Barangay", width: 20, pdfWidth: 65 },
      { key: "event_label", label: "Disaster Event", width: 28, pdfWidth: 90 },
      { key: "stub_reference", label: "Stub / QR", width: 24, pdfWidth: 85 },
      { key: "claim_reference", label: "Claim Status", width: 22, pdfWidth: 75 },
      { key: "relief_summary", label: "Relief Item / Pack", width: 32, pdfWidth: 120 },
      { key: "recorded_by_name", label: "Claimed / Recorded By", width: 30, pdfWidth: 90 },
      { key: "activity_date", label: "Date / Time", width: 22, pdfWidth: 80 },
    ],
    rows: rows.map((row) => ({
      family_head_name: row.family_head_name || "--",
      barangay_name: row.barangay_name || "--",
      event_label: [row.event_code, row.disaster_event_title].filter(Boolean).join(" - ") || "--",
      stub_reference:
        [row.stub_no ? `Stub: ${row.stub_no}` : "", row.qr_code_value ? `QR: ${row.qr_code_value}` : ""]
          .filter(Boolean)
          .join(" | ") || "--",
      claim_reference:
        row.status === "CLAIMED"
          ? `Claimed${row.receipt_no ? ` (${row.receipt_no})` : ""}`
          : row.status === "ISSUED"
            ? "Unclaimed"
            : row.status || "--",
      relief_summary: row.relief_pack_template_name || row.released_items_summary || "--",
      recorded_by_name: `Claimed: ${row.claimed_by_name || "--"} | Recorded: ${row.recorded_by_name || "--"}`,
      activity_date: mswdoReportExport.formatDateTime(
        row.distribution_date || row.claimed_at || row.issued_at,
      ),
    })),
    format: filters.format,
  });
};

module.exports = {
  getBarangayStubDashboard,
  getMunicipalStubDashboard,
  getSearchResults,
  getStubDetails,
  verifyStub,
  claimBarangayStub,
  getStubClaimHistory,
  exportStubClaimHistory,
};
