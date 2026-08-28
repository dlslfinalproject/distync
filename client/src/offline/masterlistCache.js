import db from "./db.js";
import { getSyncQueueActorContext } from "./syncQueue.js";
import { ROLE_CODES } from "../utils/roleSession.js";

const value = (item) => String(item || "").trim();

const getScope = ({ disasterEventId, barangayId }) => {
  const owner = getSyncQueueActorContext();
  if (!owner.accessMode || !owner.userId || !owner.roleCode || !disasterEventId || !barangayId) {
    return null;
  }
  if (owner.roleCode === ROLE_CODES.BARANGAY && !barangayId) return null;
  return { ...owner, disasterEventId: value(disasterEventId), barangayId: value(barangayId) };
};

export const cacheMasterlistRows = async ({ rows = [], disasterEventId, barangayId }) => {
  const scope = getScope({ disasterEventId, barangayId });
  if (!scope) return [];
  const cachedAt = new Date().toISOString();
  const entries = (Array.isArray(rows) ? rows : []).filter(Boolean).map((row) => ({
    id: [scope.accessMode, scope.userId, scope.roleCode, scope.disasterEventId, scope.barangayId, row.household_id].join("|"),
    household_id: row.household_id,
    accessMode: scope.accessMode,
    userId: scope.userId,
    roleCode: scope.roleCode,
    disaster_event_id: scope.disasterEventId,
    barangay_id: scope.barangayId,
    row,
    cached_at: cachedAt,
  }));
  if (entries.length) await db.offlineMasterlistCache.bulkPut(entries);
  return entries;
};

export const getCachedMasterlistRows = async ({ disasterEventId, barangayId }) => {
  const scope = getScope({ disasterEventId, barangayId });
  if (!scope) return [];
  const entries = await db.offlineMasterlistCache
    .where("[accessMode+userId+roleCode+disaster_event_id+barangay_id]")
    .equals([scope.accessMode, scope.userId, scope.roleCode, scope.disasterEventId, scope.barangayId])
    .toArray();
  return entries.map((entry) => entry.row).filter(Boolean);
};
