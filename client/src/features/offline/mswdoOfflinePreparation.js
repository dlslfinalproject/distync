import db from "../../offline/db.js";
import { getAccessMode } from "../../utils/accessMode.js";
import { getSyncQueueActorContext } from "../../offline/syncQueue.js";
import { ROLE_CODES } from "../../utils/roleSession.js";
import {
  fetchConsolidatedMasterlist,
  fetchConsolidatedMasterlistDashboard,
  fetchDisasterEvents,
  fetchBarangays,
} from "../mswdo-masterlist/mswdoMasterlistService.js";
import { fetchMswdoSectors } from "../mswdo-masterlist/mswdoMasterlistService.js";

export const MSWDO_OFFLINE_CACHE_VERSION = 1;
export const MSWDO_OFFLINE_DATASET = "mswdo";

const normalize = (value) => String(value || "").trim();
export const getMswdoOfflineScopeKey = ({ userId, eventId, mode = getAccessMode() } = {}) =>
  [mode, userId, ROLE_CODES.MSWDO, eventId, MSWDO_OFFLINE_DATASET].map(normalize).join("|");

const getOwner = () => getSyncQueueActorContext();
const isMswdoOwner = (userId) => {
  const owner = getOwner();
  return owner.roleCode === ROLE_CODES.MSWDO && owner.userId === userId;
};

export const getMswdoOfflinePreparation = async ({ userId, eventId } = {}) => {
  if (!userId || !eventId || !isMswdoOwner(userId)) return null;
  return db.offlinePreparation.get(getMswdoOfflineScopeKey({ userId, eventId }));
};

export const readMswdoOfflineSnapshot = async ({ userId, eventId } = {}) => {
  const record = await getMswdoOfflinePreparation({ userId, eventId });
  if (!record || record.cache_version !== MSWDO_OFFLINE_CACHE_VERSION || record.status !== "READY" && record.status !== "NEEDS_REFRESH") return null;
  if (!record.datasets?.masterlist?.complete || !record.datasets?.dashboard?.complete || !record.datasets?.filters?.complete) return null;
  return record;
};

const publish = (detail) => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("distync-mswdo-offline-preparation-updated", { detail }));
};

export const prepareMswdoOfflineData = async ({ userId, eventId } = {}) => {
  if (!userId || !eventId || !isMswdoOwner(userId)) return null;
  const owner = getOwner();
  const id = getMswdoOfflineScopeKey({ userId, eventId, mode: owner.accessMode });
  const existing = await db.offlinePreparation.get(id);
  const preparing = {
    id, accessMode: owner.accessMode, userId, roleCode: ROLE_CODES.MSWDO,
    disaster_event_id: eventId, barangay_id: "",
    cache_version: MSWDO_OFFLINE_CACHE_VERSION, status: "PREPARING",
    previous_complete_cache: Boolean(existing?.datasets?.masterlist?.complete && existing?.datasets?.dashboard?.complete),
    updated_at: new Date().toISOString(),
  };
  await db.offlinePreparation.put(preparing);
  publish(preparing);
  try {
    const [events, barangays, sectors, masterlist, dashboard] = await Promise.all([
      fetchDisasterEvents(), fetchBarangays(), fetchMswdoSectors(),
      fetchConsolidatedMasterlist({ disasterEventId: eventId, recordStatus: "all" }),
      fetchConsolidatedMasterlistDashboard({ disasterEventId: eventId }),
    ]);
    const snapshot = {
      ...preparing,
      status: "READY",
      datasets: {
        filters: { complete: true, events, barangays, sectors },
        masterlist: { complete: true, valid: true, rows: Array.isArray(masterlist?.data) ? masterlist.data : [], payload: masterlist },
        dashboard: { complete: true, valid: true, payload: dashboard },
      },
      masterlist_count: Array.isArray(masterlist?.data) ? masterlist.data.length : 0,
      updated_at: new Date().toISOString(),
    };
    await db.offlinePreparation.put(snapshot);
    const readBack = await db.offlinePreparation.get(id);
    if (!readBack?.datasets?.masterlist?.complete || !readBack?.datasets?.dashboard?.complete || !readBack?.datasets?.filters?.complete) throw new Error("MSWDO offline data could not be verified");
    publish(readBack);
    return readBack;
  } catch (error) {
    const failed = { ...preparing, status: preparing.previous_complete_cache ? "NEEDS_REFRESH" : "NOT_READY", error: error.message, updated_at: new Date().toISOString() };
    await db.offlinePreparation.put(failed);
    publish(failed);
    throw error;
  }
};

