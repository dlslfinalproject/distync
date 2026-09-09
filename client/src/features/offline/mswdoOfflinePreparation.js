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
import { fetchMunicipalStubDashboard } from "../stubs/stubService.js";
import { upsertOfflineStubSnapshots } from "../stubs/stubCache.js";

export const MSWDO_OFFLINE_CACHE_VERSION = 2;
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
  if (!record.datasets?.masterlist?.complete || !record.datasets?.dashboard?.complete || !record.datasets?.filters?.complete || !record.datasets?.distribution?.complete || !record.datasets?.photoCache?.complete) return null;
  return record;
};

const isImageDataUrl = (value) => typeof value === "string" && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = () => reject(reader.error || new Error("Offline photo conversion failed"));
  reader.readAsDataURL(blob);
});
const fetchPhotoDataUrl = async (photoUrl, householdId) => {
  if (isImageDataUrl(photoUrl)) return photoUrl;
  if (!photoUrl) return "";
  const response = await fetch(photoUrl);
  if (!response.ok) throw new Error(`Required family-head photo ${householdId} could not be prepared.`);
  const blob = await response.blob();
  if (!String(blob.type || "").toLowerCase().startsWith("image/")) throw new Error(`Required family-head photo ${householdId} is not an image.`);
  return blobToDataUrl(blob);
};
const hydratePhotos = async (rows = []) => {
  const photoByHousehold = new Map();
  const uniqueRows = [...new Map(rows.map((row) => [String(row?.household_id || row?.household?.id || ""), row])).values()];
  const pending = uniqueRows.filter((row) => row?.household_id || row?.household?.id);
  const worker = async () => {
    while (pending.length) {
      const row = pending.shift();
      const household = row.household || row;
      const householdId = String(row.household_id || household.id || "");
      const photoUrl = household.family_head_photo_data_url || household.family_head_photo_url || "";
      if (!photoUrl) {
        photoByHousehold.set(householdId, { dataUrl: "", missing: true });
        continue;
      }
      const dataUrl = await fetchPhotoDataUrl(photoUrl, householdId);
      photoByHousehold.set(householdId, { dataUrl, missing: false });
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, worker));
  return photoByHousehold;
};
const applyPhotoData = (row, photoByHousehold) => {
  const householdId = String(row?.household_id || row?.household?.id || "");
  const photo = photoByHousehold.get(householdId);
  if (!photo?.dataUrl) return row;
  if (row?.household) return { ...row, household: { ...row.household, family_head_photo_data_url: photo.dataUrl } };
  return { ...row, family_head_photo_data_url: photo.dataUrl };
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
    const [events, barangays, sectors, masterlist, dashboard, stubDashboard] = await Promise.all([
      fetchDisasterEvents(), fetchBarangays(), fetchMswdoSectors(),
      fetchConsolidatedMasterlist({ disasterEventId: eventId, recordStatus: "all" }),
      fetchConsolidatedMasterlistDashboard({ disasterEventId: eventId }),
      fetchMunicipalStubDashboard({ disasterEventId: eventId, skipOfflineCache: true }),
    ]);
    const masterlistRows = Array.isArray(masterlist?.data) ? masterlist.data : [];
    const stubRows = Array.isArray(stubDashboard?.data) ? stubDashboard.data : [];
    const photoByHousehold = await hydratePhotos([...masterlistRows, ...stubRows]);
    const preparedMasterlistRows = masterlistRows.map((row) => applyPhotoData(row, photoByHousehold));
    const preparedStubRows = stubRows.map((row) => applyPhotoData(row, photoByHousehold));
    const persistedStubs = await upsertOfflineStubSnapshots(preparedStubRows);
    const storedRows = await db.offlineStubCache.toArray();
    const scopedStubRows = storedRows.filter((row) =>
      row.accessMode === owner.accessMode &&
      row.userId === userId &&
      row.roleCode === ROLE_CODES.MSWDO &&
      String(row.disaster_event_id) === String(eventId),
    );
    const requiredPhotoRows = preparedStubRows.filter((row) =>
      row?.household?.family_head_photo_url || row?.household?.family_head_photo_data_url || row?.family_head_photo_url,
    );
    const preparedPhotoCount = requiredPhotoRows.filter((row) => {
      const householdId = String(row?.household_id || row?.household?.id || "");
      return Boolean(photoByHousehold.get(householdId)?.dataUrl);
    }).length;
    const storedPhotoCount = scopedStubRows.filter((row) =>
      requiredPhotoRows.some((candidate) => String(candidate?.household_id || candidate?.household?.id || "") === String(row.household_id || "")) &&
      isImageDataUrl(row.family_head_photo_data_url),
    ).length;
    const distributionComplete =
      Array.isArray(stubDashboard?.data) &&
      persistedStubs.length === preparedStubRows.length &&
      preparedStubRows.every((row) => row?.id && row?.qr_code_value) &&
      scopedStubRows.length >= persistedStubs.length;
    const photoCacheComplete = preparedPhotoCount === requiredPhotoRows.length && storedPhotoCount === requiredPhotoRows.length;
    const snapshot = {
      ...preparing,
      status: "READY",
      datasets: {
        filters: { complete: true, events, barangays, sectors },
        masterlist: { complete: true, valid: true, rows: preparedMasterlistRows, payload: masterlist },
        dashboard: { complete: true, valid: true, payload: dashboard },
        distribution: { complete: distributionComplete, valid: distributionComplete, rows: persistedStubs.length, payload: stubDashboard },
        photoCache: { complete: photoCacheComplete, required: requiredPhotoRows.length, prepared: preparedPhotoCount, actual_bytes_persisted: preparedPhotoCount },
      },
      masterlist_count: preparedMasterlistRows.length,
      updated_at: new Date().toISOString(),
    };
    await db.offlinePreparation.put(snapshot);
    const readBack = await db.offlinePreparation.get(id);
    if (!readBack?.datasets?.masterlist?.complete || !readBack?.datasets?.dashboard?.complete || !readBack?.datasets?.filters?.complete || !readBack?.datasets?.distribution?.complete || !readBack?.datasets?.photoCache?.complete) throw new Error("MSWDO offline distribution data could not be verified");
    publish(readBack);
    return readBack;
  } catch (error) {
    const failed = { ...preparing, status: preparing.previous_complete_cache ? "NEEDS_REFRESH" : "NOT_READY", error: error.message, updated_at: new Date().toISOString() };
    await db.offlinePreparation.put(failed);
    publish(failed);
    throw error;
  }
};

