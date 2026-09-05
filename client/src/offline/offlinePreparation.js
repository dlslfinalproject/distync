import db from "./db.js";
import { getSyncQueueActorContext } from "./syncQueue.js";
import { ROLE_CODES } from "../utils/roleSession.js";
import { fetchBarangayStubDashboard } from "../features/stubs/stubService.js";
import {
  getCachedStubDetailsByQrValue,
  getCachedStubSnapshotsForScope,
  normalizeOfflineStubQrKey,
  upsertOfflineStubSnapshots,
} from "../features/stubs/stubCache.js";
import {
  fetchHouseholdDetails,
  fetchMasterlist,
} from "../features/masterlist/masterlistService.js";
import { cacheMasterlistRows, getCachedMasterlistRows } from "./masterlistCache.js";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
  fetchEvacuationCentersByBarangay,
  fetchSectors,
  getCachedEvacuationCentersByBarangay,
  getCachedRegistrationReferenceData,
} from "../features/household-registration/householdRegistrationService.js";

export const OFFLINE_PREPARATION_STATUS = {
  NOT_PREPARED: "NOT_PREPARED",
  PREPARING: "PREPARING",
  READY: "READY",
  NOT_READY: "NOT_READY",
  NEEDS_REFRESH: "NEEDS_REFRESH",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
};
export const OFFLINE_CACHE_VERSION = 2;

const jobs = new Map();
let lastPreparationDiagnostics = null;
const PAGE_REQUEST_TIMEOUT_MS = 45_000;
const scopeKey = ({ eventId, barangayId }) => {
  const owner = getSyncQueueActorContext();
  return [owner.accessMode, owner.userId, owner.roleCode, eventId, barangayId].join("|");
};

export const getOfflinePreparation = async ({ eventId, barangayId }) => {
  const owner = getSyncQueueActorContext();
  if (!owner.userId || owner.roleCode !== ROLE_CODES.BARANGAY || !eventId || !barangayId) return null;
  return db.offlinePreparation.get(scopeKey({ eventId, barangayId }));
};

export const getPreparedBarangayOfflineContexts = async ({ userId = "" } = {}) => {
  const owner = getSyncQueueActorContext();
  if (
    !userId ||
    owner.userId !== userId ||
    owner.roleCode !== ROLE_CODES.BARANGAY
  ) {
    return [];
  }

  const preparations = await db.offlinePreparation.toArray();
  return preparations.filter(
    (preparation) =>
      preparation.accessMode === owner.accessMode &&
      preparation.userId === userId &&
      preparation.roleCode === ROLE_CODES.BARANGAY &&
      preparation.cache_version === OFFLINE_CACHE_VERSION &&
      [OFFLINE_PREPARATION_STATUS.READY, OFFLINE_PREPARATION_STATUS.NEEDS_REFRESH].includes(
        preparation.status,
      ) &&
      preparation.disaster_event_id &&
      preparation.barangay_id,
  );
};

export const getLastOfflinePreparationDiagnostics = () => lastPreparationDiagnostics;

const publishDiagnostics = (diagnostics) => {
  lastPreparationDiagnostics = diagnostics;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("distync-offline-preparation-updated", { detail: diagnostics }));
  }
};

const savePreparation = async (scope, status, details = {}) => {
  await db.offlinePreparation.put({
    id: scopeKey(scope),
    accessMode: scope.owner.accessMode,
    userId: scope.owner.userId,
    roleCode: scope.owner.roleCode,
    disaster_event_id: scope.eventId,
    barangay_id: scope.barangayId,
    cache_version: OFFLINE_CACHE_VERSION,
    status,
    ...details,
    updated_at: new Date().toISOString(),
  });
};

const withTimeout = (promise, label) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out`);
      error.code = "OFFLINE_PREPARATION_TIMEOUT";
      reject(error);
    }, PAGE_REQUEST_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const fetchAllPages = async (fetchPage, onPage = () => {}) => {
  const pageSize = 100;
  const first = await withTimeout(fetchPage(1, pageSize), "Offline data page 1");
  const reportedPages = Number(first?.pagination?.totalPages);
  const pages = Number.isInteger(reportedPages) && reportedPages >= 0 ? reportedPages : 1;
  const expectedCount = Number(first?.pagination?.totalItems ?? first?.count ?? 0);
  const rows = [...(first?.data || first?.rows || [])];
  onPage({ page: 1, pages, expectedCount, received: rows.length, pageRows: rows });
  if (pages === 0 || rows.length === 0) {
    if (expectedCount > 0) {
      const error = new Error("Offline preparation pagination returned no records for a non-empty dataset");
      error.code = "OFFLINE_PREPARATION_INCOMPLETE_PAGINATION";
      throw error;
    }
    return { rows, pages: Math.max(pages, 1), expectedCount };
  }
  const seenPages = new Set([1]);
  for (let page = 2; page <= pages; page += 1) {
    if (seenPages.has(page)) throw new Error("Offline preparation pagination repeated a page");
    seenPages.add(page);
    const next = await withTimeout(fetchPage(page, pageSize), `Offline data page ${page}`);
    const pageRows = next?.data || next?.rows || [];
    rows.push(...pageRows);
    onPage({ page, pages, expectedCount, received: pageRows.length, pageRows });
  }
  if (expectedCount > rows.length) {
    const error = new Error("Offline preparation pagination ended before all records were fetched");
    error.code = "OFFLINE_PREPARATION_INCOMPLETE_PAGINATION";
    throw error;
  }
  const idKey = rows[0]?.stub_id !== undefined || rows[0]?.id !== undefined ? "id" : "household_id";
  const uniqueRows = [...new Map(rows.map((row) => [row?.[idKey] || JSON.stringify(row), row])).values()];
  return { rows: uniqueRows, pages, expectedCount };
};

const fetchHouseholdDetailsWithBoundedConcurrency = async (rows, onProgress) => {
  const detailsByHouseholdId = new Map();
  const queue = [...rows];
  const worker = async () => {
    while (queue.length) {
      const row = queue.shift();
      const householdId = row?.household_id;
      if (!householdId) continue;
      const details = await withTimeout(
        fetchHouseholdDetails(householdId),
        `Offline household details ${householdId}`,
      );
      if (!details?.household?.id || !details.household.family_head_photo_url) {
        const error = new Error("Offline household detail or required photo is unavailable");
        error.code = "OFFLINE_PREPARATION_HOUSEHOLD_DETAILS_INCOMPLETE";
        throw error;
      }
      detailsByHouseholdId.set(String(householdId), details);
      onProgress?.(detailsByHouseholdId.size);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
  return detailsByHouseholdId;
};

export const prepareBarangayOfflineData = ({ eventId, barangayId, userId, context = {}, targetQrValue = "" }) => {
  const scope = { eventId, barangayId, owner: getSyncQueueActorContext() };
  const key = scopeKey(scope);
  if (jobs.has(key)) return jobs.get(key);
  const job = (async () => {
    if (!eventId || !barangayId || !userId || scope.owner.roleCode !== ROLE_CODES.BARANGAY) return null;
    const previousPreparation = await getOfflinePreparation({ eventId, barangayId });
    const diagnostics = {
      scope: { barangayId, disasterEventId: eventId, cacheVersion: OFFLINE_CACHE_VERSION },
      status: OFFLINE_PREPARATION_STATUS.PREPARING,
      startedAt: new Date().toISOString(),
      online: typeof navigator === "undefined" ? true : navigator.onLine !== false,
      context: {
        role: scope.owner.roleCode,
        barangaySource: context.barangaySource || "resolved context",
        eventSource: context.eventSource || "selected event",
        eventStatus: context.eventStatus || "",
      },
      targetQr: targetQrValue ? { normalized: normalizeOfflineStubQrKey(targetQrValue), included: false, page: null } : null,
      datasets: { stubs: { pagesFetched: 0 }, masterlist: { pagesFetched: 0 } },
      stage: "RESOLVING_CONTEXT",
      stages: {},
      lastProgressAt: new Date().toISOString(),
      previousCompleteCache: [OFFLINE_PREPARATION_STATUS.READY, OFFLINE_PREPARATION_STATUS.NEEDS_REFRESH].includes(previousPreparation?.status),
    };
    const startStage = (stage) => {
      diagnostics.stage = stage;
      diagnostics.stages[stage] = { startedAt: new Date().toISOString(), status: "IN_PROGRESS", processed: 0 };
      diagnostics.lastProgressAt = new Date().toISOString();
      publishDiagnostics({ ...diagnostics });
    };
    const completeStage = (stage, processed = 0) => {
      diagnostics.stages[stage] = { ...(diagnostics.stages[stage] || {}), completedAt: new Date().toISOString(), status: "COMPLETED", processed };
      diagnostics.lastProgressAt = new Date().toISOString();
      publishDiagnostics({ ...diagnostics });
    };
    publishDiagnostics(diagnostics);
    await savePreparation(scope, OFFLINE_PREPARATION_STATUS.PREPARING, { datasets: diagnostics.datasets });
    try {
      startStage("FETCHING_MASTERLIST");
      startStage("FETCHING_HOUSEHOLD_DETAILS");
      startStage("FETCHING_STUBS");
      startStage("FETCHING_REGISTRATION_REFERENCES");
      const [stubs, masterlist, registrationReferences] = await Promise.all([
          fetchAllPages(
          (page, pageSize) => fetchBarangayStubDashboard({ userId, disasterEventId: eventId, barangayId, page, pageSize, status: "all", skipOfflineCache: true }),
          (pageInfo) => {
            const { pageRows, ...safePageInfo } = pageInfo;
            diagnostics.datasets.stubs = {
              ...diagnostics.datasets.stubs,
              ...safePageInfo,
              pagesFetched: pageInfo.page,
              pagesExpected: pageInfo.pages,
              recordsByPage: {
                ...(diagnostics.datasets.stubs.recordsByPage || {}),
                [pageInfo.page]: pageInfo.received,
              },
            };
            diagnostics.lastProgressAt = new Date().toISOString();
            if (diagnostics.targetQr && pageRows?.some((row) => normalizeOfflineStubQrKey(row?.qr_code_value) === diagnostics.targetQr.normalized)) {
              diagnostics.targetQr = { ...diagnostics.targetQr, included: true, page: pageInfo.page };
            }
            publishDiagnostics({ ...diagnostics });
          },
        ),
        fetchAllPages(
          (page, pageSize) => fetchMasterlist({ disasterEventId: eventId, barangayId, recordStatus: "all", page, pageSize }),
          (pageInfo) => {
            const { pageRows, ...safePageInfo } = pageInfo;
            diagnostics.datasets.masterlist = {
              ...diagnostics.datasets.masterlist,
              ...safePageInfo,
              pagesFetched: pageInfo.page,
              pagesExpected: pageInfo.pages,
              recordsByPage: {
                ...(diagnostics.datasets.masterlist.recordsByPage || {}),
                [pageInfo.page]: pageInfo.received,
              },
            };
            diagnostics.lastProgressAt = new Date().toISOString();
            publishDiagnostics({ ...diagnostics });
          },
        ),
        Promise.all([
          fetchActiveDisasterEvents(),
          fetchBarangays(),
          fetchSectors(),
          fetchEvacuationCentersByBarangay(barangayId),
        ]),
      ]);
      completeStage("FETCHING_MASTERLIST", masterlist.rows.length);
      const householdDetailsById = await fetchHouseholdDetailsWithBoundedConcurrency(
        masterlist.rows,
        (processed) => {
          diagnostics.stages.FETCHING_HOUSEHOLD_DETAILS.processed = processed;
          diagnostics.lastProgressAt = new Date().toISOString();
          publishDiagnostics({ ...diagnostics });
        },
      );
      completeStage("FETCHING_HOUSEHOLD_DETAILS", householdDetailsById.size);
      completeStage("FETCHING_STUBS", stubs.rows.length);
      completeStage("FETCHING_REGISTRATION_REFERENCES");
      void registrationReferences;
      const cachedReferenceData = getCachedRegistrationReferenceData();
      const cachedEvents = Array.isArray(cachedReferenceData.activeDisasterEvents)
        ? cachedReferenceData.activeDisasterEvents
        : [];
      const cachedBarangays = Array.isArray(cachedReferenceData.barangays)
        ? cachedReferenceData.barangays
        : [];
      const cachedSectors = Array.isArray(cachedReferenceData.sectors?.data)
        ? cachedReferenceData.sectors.data
        : [];
      const cachedEvacuationCenters = getCachedEvacuationCentersByBarangay(barangayId);
      if (
        !cachedEvents.some((event) => String(event?.id) === String(eventId)) ||
        !cachedBarangays.some((barangay) => String(barangay?.id) === String(barangayId)) ||
        cachedSectors.length === 0 ||
        cachedEvacuationCenters.length === 0
      ) {
        const error = new Error("Offline registration reference read-back failed");
        error.code = "OFFLINE_PREPARATION_REFERENCE_READ_BACK_FAILED";
        throw error;
      }
      startStage("PERSISTING_MASTERLIST");
      startStage("PERSISTING_STUBS");
      const persistedStubs = await upsertOfflineStubSnapshots(stubs.rows);
      const preparedMasterlistRows = masterlist.rows.map((row) => ({
        ...row,
        offline_household_details: householdDetailsById.get(String(row.household_id)) || null,
      }));
      await cacheMasterlistRows({ rows: preparedMasterlistRows, disasterEventId: eventId, barangayId });
      completeStage("PERSISTING_MASTERLIST", preparedMasterlistRows.length);
      completeStage("PERSISTING_STUBS", persistedStubs.length);
      const [stubRowsAfterWrite, masterlistRowsAfterWrite] = await Promise.all([
        getCachedStubSnapshotsForScope({ disasterEventId: eventId, currentBarangayId: barangayId }),
        getCachedMasterlistRows({ disasterEventId: eventId, barangayId }),
      ]);
      const qrEligibleRows = persistedStubs.filter((row) => normalizeOfflineStubQrKey(row?.qr_code_value));
      startStage("VERIFYING_QR_DATA");
      const qrReadBack = await Promise.all(
        qrEligibleRows.map((row) => getCachedStubDetailsByQrValue(row.qr_code_value, { currentBarangayId: barangayId })),
      );
      diagnostics.stages.VERIFYING_QR_DATA.processed = qrReadBack.length;
      completeStage("VERIFYING_QR_DATA", qrReadBack.length);
      startStage("VERIFYING_LOCAL_DATA");
      const masterlistReadBack = preparedMasterlistRows.every((row) =>
        masterlistRowsAfterWrite.some((cachedRow) =>
          cachedRow.household_id === row.household_id &&
          cachedRow.offline_household_details?.household?.family_head_photo_url,
        ),
      );
      const masterlistReadBackSucceeded = masterlistReadBack;
      if (!qrReadBack.every(Boolean) || !masterlistReadBack || stubRowsAfterWrite.length < persistedStubs.length) {
        throw new Error("Offline preparation read-back verification failed");
      }
      completeStage("VERIFYING_LOCAL_DATA", stubRowsAfterWrite.length + masterlistRowsAfterWrite.length);
      startStage("FINALIZING");
      diagnostics.datasets.stubs = { ...diagnostics.datasets.stubs, collected: stubs.rows.length, persisted: persistedStubs.length, qrSearchable: qrReadBack.filter(Boolean).length, readBack: true, complete: stubs.pages > 0 && (!stubs.expectedCount || stubs.rows.length >= stubs.expectedCount) };
      diagnostics.datasets.masterlist = { ...diagnostics.datasets.masterlist, collected: preparedMasterlistRows.length, persisted: preparedMasterlistRows.length, detailsPrepared: householdDetailsById.size, readBack: true, complete: masterlist.pages > 0 && (!masterlist.expectedCount || preparedMasterlistRows.length >= masterlist.expectedCount) };
      await savePreparation(scope, OFFLINE_PREPARATION_STATUS.READY, {
        stub_count: stubs.rows.length,
        stub_pages: stubs.pages,
        stub_expected_count: stubs.expectedCount,
        masterlist_count: preparedMasterlistRows.length,
        masterlist_pages: masterlist.pages,
        masterlist_expected_count: masterlist.expectedCount,
        datasets: diagnostics.datasets,
      });
      publishDiagnostics({ ...diagnostics, status: OFFLINE_PREPARATION_STATUS.READY, completedAt: new Date().toISOString(), targetQr: diagnostics.targetQr ? { ...diagnostics.targetQr, persisted: diagnostics.targetQr.included && qrReadBack.some(Boolean), readBack: diagnostics.targetQr.included && qrReadBack.some(Boolean) } : null });
      return { status: OFFLINE_PREPARATION_STATUS.READY, stubCount: stubs.rows.length, masterlistCount: preparedMasterlistRows.length };
    } catch (error) {
      if (diagnostics.stage && diagnostics.stages[diagnostics.stage]) {
        diagnostics.stages[diagnostics.stage] = {
          ...diagnostics.stages[diagnostics.stage],
          status: "FAILED",
          completedAt: new Date().toISOString(),
          errorCategory: error?.code || "PREPARATION_FAILED",
        };
      }
      const terminalStatus = diagnostics.previousCompleteCache
        ? OFFLINE_PREPARATION_STATUS.NEEDS_REFRESH
        : OFFLINE_PREPARATION_STATUS.NOT_READY;
      // PARTIAL remains recognized for records written by older releases; new runs always use a terminal status.
      const legacyPartialStatus = OFFLINE_PREPARATION_STATUS.PARTIAL;
      void legacyPartialStatus;
      const failureDetails = { error_code: error?.code || "PREPARATION_FAILED", datasets: diagnostics.datasets, previous_complete_cache: diagnostics.previousCompleteCache };
      await savePreparation(scope, terminalStatus, failureDetails);
      publishDiagnostics({ ...diagnostics, status: terminalStatus, completedAt: new Date().toISOString(), error: "Preparation could not be completed" });
      throw error;
    } finally {
      jobs.delete(key);
    }
  })();
  jobs.set(key, job);
  return job;
};
