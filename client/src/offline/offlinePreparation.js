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
import { fetchMasterlist } from "../features/masterlist/masterlistService.js";
import { cacheMasterlistRows, getCachedMasterlistRows } from "./masterlistCache.js";

export const OFFLINE_PREPARATION_STATUS = {
  NOT_PREPARED: "NOT_PREPARED",
  PREPARING: "PREPARING",
  READY: "READY",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
};
export const OFFLINE_CACHE_VERSION = 1;

const jobs = new Map();
let lastPreparationDiagnostics = null;
const scopeKey = ({ eventId, barangayId }) => {
  const owner = getSyncQueueActorContext();
  return [owner.accessMode, owner.userId, owner.roleCode, eventId, barangayId].join("|");
};

export const getOfflinePreparation = async ({ eventId, barangayId }) => {
  const owner = getSyncQueueActorContext();
  if (!owner.userId || owner.roleCode !== ROLE_CODES.BARANGAY || !eventId || !barangayId) return null;
  return db.offlinePreparation.get(scopeKey({ eventId, barangayId }));
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

const fetchAllPages = async (fetchPage, onPage = () => {}) => {
  const pageSize = 100;
  const first = await fetchPage(1, pageSize);
  const pages = Number(first?.pagination?.totalPages || 1);
  const expectedCount = Number(first?.pagination?.totalItems ?? first?.count ?? 0);
  const rows = [...(first?.data || first?.rows || [])];
  onPage({ page: 1, pages, expectedCount, received: rows.length, pageRows: rows });
  for (let page = 2; page <= pages; page += 1) {
    const next = await fetchPage(page, pageSize);
    const pageRows = next?.data || next?.rows || [];
    rows.push(...pageRows);
    onPage({ page, pages, expectedCount, received: pageRows.length, pageRows });
  }
  const idKey = rows[0]?.stub_id !== undefined || rows[0]?.id !== undefined ? "id" : "household_id";
  const uniqueRows = [...new Map(rows.map((row) => [row?.[idKey] || JSON.stringify(row), row])).values()];
  return { rows: uniqueRows, pages, expectedCount };
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
      previousCompleteCache: previousPreparation?.status === OFFLINE_PREPARATION_STATUS.READY,
    };
    publishDiagnostics(diagnostics);
    await savePreparation(scope, OFFLINE_PREPARATION_STATUS.PREPARING, { datasets: diagnostics.datasets });
    try {
      const [stubs, masterlist] = await Promise.all([
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
            if (diagnostics.targetQr && pageRows?.some((row) => normalizeOfflineStubQrKey(row?.qr_code_value) === diagnostics.targetQr.normalized)) {
              diagnostics.targetQr = { ...diagnostics.targetQr, included: true, page: pageInfo.page };
            }
            publishDiagnostics({ ...diagnostics });
          },
        ),
        fetchAllPages(
          (page, pageSize) => fetchMasterlist({ disasterEventId: eventId, barangayId, recordStatus: "all", page, pageSize }),
          (pageInfo) => {
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
            publishDiagnostics({ ...diagnostics });
          },
        ),
      ]);
      const persistedStubs = await upsertOfflineStubSnapshots(stubs.rows);
      await cacheMasterlistRows({ rows: masterlist.rows, disasterEventId: eventId, barangayId });
      const [stubRowsAfterWrite, masterlistRowsAfterWrite] = await Promise.all([
        getCachedStubSnapshotsForScope({ disasterEventId: eventId, currentBarangayId: barangayId }),
        getCachedMasterlistRows({ disasterEventId: eventId, barangayId }),
      ]);
      const qrReadBack = await Promise.all(
        persistedStubs.map((row) => getCachedStubDetailsByQrValue(row.qr_code_value, { currentBarangayId: barangayId })),
      );
      const masterlistReadBack = masterlist.rows.every((row) =>
        masterlistRowsAfterWrite.some((cachedRow) => cachedRow.household_id === row.household_id),
      );
      const masterlistReadBackSucceeded = masterlistReadBack;
      if (!qrReadBack.every(Boolean) || !masterlistReadBack || stubRowsAfterWrite.length < persistedStubs.length) {
        throw new Error("Offline preparation read-back verification failed");
      }
      diagnostics.datasets.stubs = { ...diagnostics.datasets.stubs, collected: stubs.rows.length, persisted: persistedStubs.length, qrSearchable: qrReadBack.filter(Boolean).length, readBack: true, complete: stubs.pages > 0 && (!stubs.expectedCount || stubs.rows.length >= stubs.expectedCount) };
      diagnostics.datasets.masterlist = { ...diagnostics.datasets.masterlist, collected: masterlist.rows.length, persisted: masterlist.rows.length, readBack: true, complete: masterlist.pages > 0 && (!masterlist.expectedCount || masterlist.rows.length >= masterlist.expectedCount) };
      await savePreparation(scope, OFFLINE_PREPARATION_STATUS.READY, {
        stub_count: stubs.rows.length,
        stub_pages: stubs.pages,
        stub_expected_count: stubs.expectedCount,
        masterlist_count: masterlist.rows.length,
        masterlist_pages: masterlist.pages,
        masterlist_expected_count: masterlist.expectedCount,
        datasets: diagnostics.datasets,
      });
      publishDiagnostics({ ...diagnostics, status: OFFLINE_PREPARATION_STATUS.READY, completedAt: new Date().toISOString(), targetQr: diagnostics.targetQr ? { ...diagnostics.targetQr, persisted: diagnostics.targetQr.included && qrReadBack.some(Boolean), readBack: diagnostics.targetQr.included && qrReadBack.some(Boolean) } : null });
      return { status: OFFLINE_PREPARATION_STATUS.READY, stubCount: stubs.rows.length, masterlistCount: masterlist.rows.length };
    } catch (error) {
      await savePreparation(scope, OFFLINE_PREPARATION_STATUS.PARTIAL, { error_code: error?.code || "PREPARATION_FAILED", datasets: diagnostics.datasets, previous_complete_cache: diagnostics.previousCompleteCache });
      publishDiagnostics({ ...diagnostics, status: OFFLINE_PREPARATION_STATUS.PARTIAL, error: "Preparation could not be completed" });
      throw error;
    } finally {
      jobs.delete(key);
    }
  })();
  jobs.set(key, job);
  return job;
};
