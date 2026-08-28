import db from "./db.js";
import { getSyncQueueActorContext } from "./syncQueue.js";
import { ROLE_CODES } from "../utils/roleSession.js";
import { fetchBarangayStubDashboard } from "../features/stubs/stubService.js";
import { upsertOfflineStubSnapshots } from "../features/stubs/stubCache.js";
import { fetchMasterlist } from "../features/masterlist/masterlistService.js";
import { cacheMasterlistRows } from "./masterlistCache.js";

export const OFFLINE_PREPARATION_STATUS = {
  NOT_PREPARED: "NOT_PREPARED",
  PREPARING: "PREPARING",
  READY: "READY",
  PARTIAL: "PARTIAL",
  FAILED: "FAILED",
};
export const OFFLINE_CACHE_VERSION = 1;

const jobs = new Map();
const scopeKey = ({ eventId, barangayId }) => {
  const owner = getSyncQueueActorContext();
  return [owner.accessMode, owner.userId, owner.roleCode, eventId, barangayId].join("|");
};

export const getOfflinePreparation = async ({ eventId, barangayId }) => {
  const owner = getSyncQueueActorContext();
  if (!owner.userId || owner.roleCode !== ROLE_CODES.BARANGAY || !eventId || !barangayId) return null;
  return db.offlinePreparation.get(scopeKey({ eventId, barangayId }));
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

const fetchAllPages = async (fetchPage) => {
  const pageSize = 100;
  const first = await fetchPage(1, pageSize);
  const pages = Number(first?.pagination?.totalPages || 1);
  const rows = [...(first?.data || first?.rows || [])];
  for (let page = 2; page <= pages; page += 1) {
    const next = await fetchPage(page, pageSize);
    rows.push(...(next?.data || next?.rows || []));
  }
  return { rows, pages };
};

export const prepareBarangayOfflineData = ({ eventId, barangayId, userId }) => {
  const scope = { eventId, barangayId, owner: getSyncQueueActorContext() };
  const key = scopeKey(scope);
  if (jobs.has(key)) return jobs.get(key);
  const job = (async () => {
    if (!eventId || !barangayId || !userId || scope.owner.roleCode !== ROLE_CODES.BARANGAY) return null;
    await savePreparation(scope, OFFLINE_PREPARATION_STATUS.PREPARING);
    try {
      const [stubs, masterlist] = await Promise.all([
        fetchAllPages((page, pageSize) => fetchBarangayStubDashboard({ userId, disasterEventId: eventId, barangayId, page, pageSize, status: "all", skipOfflineCache: true })),
        fetchAllPages((page, pageSize) => fetchMasterlist({ disasterEventId: eventId, barangayId, recordStatus: "all", page, pageSize })),
      ]);
      await upsertOfflineStubSnapshots(stubs.rows);
      await cacheMasterlistRows({ rows: masterlist.rows, disasterEventId: eventId, barangayId });
      await savePreparation(scope, OFFLINE_PREPARATION_STATUS.READY, {
        stub_count: stubs.rows.length,
        stub_pages: stubs.pages,
        masterlist_count: masterlist.rows.length,
        masterlist_pages: masterlist.pages,
      });
      return { status: OFFLINE_PREPARATION_STATUS.READY, stubCount: stubs.rows.length, masterlistCount: masterlist.rows.length };
    } catch (error) {
      await savePreparation(scope, OFFLINE_PREPARATION_STATUS.PARTIAL, { error_code: error?.code || "PREPARATION_FAILED" });
      throw error;
    } finally {
      jobs.delete(key);
    }
  })();
  jobs.set(key, job);
  return job;
};
