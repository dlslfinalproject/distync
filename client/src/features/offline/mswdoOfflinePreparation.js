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
import {
  cacheRegistrationActiveDisasterEvents,
  cacheRegistrationBarangays,
  cacheRegistrationEvacuationCenters,
  cacheRegistrationSectors,
  cacheSelectedDisasterEvent,
  cacheSelectedDisasterEventId,
  fetchEvacuationCenters,
} from "../household-registration/householdRegistrationService.js";

export const MSWDO_OFFLINE_CACHE_VERSION = 2;
export const MSWDO_OFFLINE_DATASET = "mswdo";

export const MSWDO_PREPARATION_FAILURE_STAGES = Object.freeze({
  ACTOR_CONTEXT: "ACTOR_CONTEXT",
  MASTERLIST: "MASTERLIST",
  DASHBOARD: "DASHBOARD",
  REFERENCE_DATA: "REFERENCE_DATA",
  DISTRIBUTION_FETCH: "DISTRIBUTION_FETCH",
  DISTRIBUTION_VALIDATE: "DISTRIBUTION_VALIDATE",
  DISTRIBUTION_PERSIST: "DISTRIBUTION_PERSIST",
  PHOTO_FETCH: "PHOTO_FETCH",
  PHOTO_CONVERT: "PHOTO_CONVERT",
  PHOTO_PERSIST: "PHOTO_PERSIST",
  READ_BACK: "READ_BACK",
  PREPARATION_METADATA: "PREPARATION_METADATA",
});

const PREPARATION_FAILURE_MESSAGES = Object.freeze({
  ACTOR_CONTEXT: "Offline preparation could not verify this MSWDO session.",
  MASTERLIST: "Evacuee masterlist data could not be prepared.",
  DASHBOARD: "MSWDO analytics data could not be prepared.",
  REFERENCE_DATA: "Offline reference data could not be prepared.",
  DISTRIBUTION_FETCH: "Relief distribution records could not be fetched.",
  DISTRIBUTION_VALIDATE: "Relief distribution records were not valid for offline use.",
  DISTRIBUTION_PERSIST: "Relief distribution records could not be saved.",
  PHOTO_FETCH: "Family-head photos could not be fetched.",
  PHOTO_CONVERT: "Family-head photos could not be converted for offline use.",
  PHOTO_PERSIST: "Family-head photos could not be saved.",
  READ_BACK: "Saved offline data could not be verified.",
  PREPARATION_METADATA: "Offline preparation status could not be saved.",
});

export class MswdoOfflinePreparationError extends Error {
  constructor(stage, message = "", code = "") {
    super(message || PREPARATION_FAILURE_MESSAGES[stage] || "Offline preparation failed.");
    this.name = "MswdoOfflinePreparationError";
    this.stage = stage;
    this.code = code || stage;
  }
}

export const getMswdoPreparationFailureMessage = (stage) =>
  PREPARATION_FAILURE_MESSAGES[stage] || "Offline data could not be prepared.";

const toPreparationError = (error, stage, code = "") => {
  if (error instanceof MswdoOfflinePreparationError && error.stage === stage) {
    return error;
  }

  return new MswdoOfflinePreparationError(stage, getMswdoPreparationFailureMessage(stage), code || stage);
};

const runPreparationStage = async (stage, operation) => {
  try {
    return await operation();
  } catch (error) {
    throw toPreparationError(error, stage);
  }
};

const preparationGenerations = new Map();
let nextPreparationGeneration = 0;

const beginPreparationGeneration = (id, requestedGeneration) => {
  const generation = requestedGeneration || ++nextPreparationGeneration;
  preparationGenerations.set(id, generation);
  return generation;
};

const isCurrentPreparationGeneration = (id, generation) =>
  preparationGenerations.get(id) === generation;

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
export const fetchPhotoDataUrl = async (photoUrl, householdId) => {
  if (isImageDataUrl(photoUrl)) return photoUrl;
  if (!photoUrl) return "";
  let response;
  try {
    response = await fetch(photoUrl);
  } catch (_error) {
    throw new MswdoOfflinePreparationError(
      MSWDO_PREPARATION_FAILURE_STAGES.PHOTO_FETCH,
      getMswdoPreparationFailureMessage(MSWDO_PREPARATION_FAILURE_STAGES.PHOTO_FETCH),
      "PHOTO_NETWORK",
    );
  }
  if (!response.ok) {
    throw new MswdoOfflinePreparationError(
      MSWDO_PREPARATION_FAILURE_STAGES.PHOTO_FETCH,
      getMswdoPreparationFailureMessage(MSWDO_PREPARATION_FAILURE_STAGES.PHOTO_FETCH),
      `PHOTO_HTTP_${response.status}`,
    );
  }
  let blob;
  try {
    blob = await response.blob();
  } catch (_error) {
    throw new MswdoOfflinePreparationError(
      MSWDO_PREPARATION_FAILURE_STAGES.PHOTO_CONVERT,
      getMswdoPreparationFailureMessage(MSWDO_PREPARATION_FAILURE_STAGES.PHOTO_CONVERT),
      "PHOTO_BODY",
    );
  }
  if (!String(blob.type || "").toLowerCase().startsWith("image/")) {
    throw new MswdoOfflinePreparationError(
      MSWDO_PREPARATION_FAILURE_STAGES.PHOTO_FETCH,
      getMswdoPreparationFailureMessage(MSWDO_PREPARATION_FAILURE_STAGES.PHOTO_FETCH),
      "PHOTO_NON_IMAGE",
    );
  }
  let dataUrl;
  try {
    dataUrl = await blobToDataUrl(blob);
  } catch (_error) {
    throw new MswdoOfflinePreparationError(
      MSWDO_PREPARATION_FAILURE_STAGES.PHOTO_CONVERT,
      getMswdoPreparationFailureMessage(MSWDO_PREPARATION_FAILURE_STAGES.PHOTO_CONVERT),
      "PHOTO_FILEREADER",
    );
  }
  if (!isImageDataUrl(dataUrl)) {
    throw new MswdoOfflinePreparationError(
      MSWDO_PREPARATION_FAILURE_STAGES.PHOTO_CONVERT,
      getMswdoPreparationFailureMessage(MSWDO_PREPARATION_FAILURE_STAGES.PHOTO_CONVERT),
      "PHOTO_DATA_URL",
    );
  }
  return dataUrl;
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

export const prepareMswdoOfflineData = async ({ userId, eventId, generation } = {}) => {
  if (!userId || !eventId || !isMswdoOwner(userId)) {
    throw new MswdoOfflinePreparationError(MSWDO_PREPARATION_FAILURE_STAGES.ACTOR_CONTEXT);
  }
  const owner = getOwner();
  const id = getMswdoOfflineScopeKey({ userId, eventId, mode: owner.accessMode });
  const currentGeneration = beginPreparationGeneration(id, generation);
  const existing = await runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.PREPARATION_METADATA, () => db.offlinePreparation.get(id));
  const preparing = {
    id, accessMode: owner.accessMode, userId, roleCode: ROLE_CODES.MSWDO,
    disaster_event_id: eventId, barangay_id: "",
    cache_version: MSWDO_OFFLINE_CACHE_VERSION, status: "PREPARING",
    previous_complete_cache: Boolean(existing?.datasets?.masterlist?.complete && existing?.datasets?.dashboard?.complete),
    ...(existing?.datasets ? { datasets: existing.datasets } : {}),
    updated_at: new Date().toISOString(),
  };
  await runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.PREPARATION_METADATA, () => db.offlinePreparation.put(preparing));
  if (isCurrentPreparationGeneration(id, currentGeneration)) publish({ ...preparing, generation: currentGeneration });
  try {
    const [events, barangays, sectors, evacuationCenters, masterlist, dashboard, stubDashboard] = await Promise.all([
      runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.REFERENCE_DATA, () => fetchDisasterEvents()),
      runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.REFERENCE_DATA, () => fetchBarangays()),
      runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.REFERENCE_DATA, () => fetchMswdoSectors()),
      runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.REFERENCE_DATA, () => fetchEvacuationCenters()),
      runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.MASTERLIST, () => fetchConsolidatedMasterlist({ disasterEventId: eventId, recordStatus: "all" })),
      runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.DASHBOARD, () => fetchConsolidatedMasterlistDashboard({ disasterEventId: eventId })),
      runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.DISTRIBUTION_FETCH, () => fetchMunicipalStubDashboard({ disasterEventId: eventId, skipOfflineCache: true })),
    ]);
    const selectedEvent = (Array.isArray(events) ? events : []).find(
      (event) => String(event?.id || "") === String(eventId),
    );
    cacheRegistrationActiveDisasterEvents(
      (Array.isArray(events) ? events : []).filter(
        (event) => String(event?.status || "").toUpperCase() === "ACTIVE",
      ),
    );
    cacheRegistrationBarangays(Array.isArray(barangays) ? barangays : []);
    cacheRegistrationSectors(Array.isArray(sectors) ? sectors : []);
    cacheRegistrationEvacuationCenters(Array.isArray(evacuationCenters) ? evacuationCenters : []);
    cacheSelectedDisasterEventId(eventId);
    if (selectedEvent) cacheSelectedDisasterEvent(selectedEvent);
    const masterlistRows = Array.isArray(masterlist?.data) ? masterlist.data : [];
    if (!Array.isArray(stubDashboard?.data)) {
      throw new MswdoOfflinePreparationError(MSWDO_PREPARATION_FAILURE_STAGES.DISTRIBUTION_VALIDATE, getMswdoPreparationFailureMessage(MSWDO_PREPARATION_FAILURE_STAGES.DISTRIBUTION_VALIDATE), "DISTRIBUTION_DATA_ARRAY");
    }
    const stubRows = stubDashboard.data;
    const invalidStub = stubRows.find((row) => !row?.id || !row?.qr_code_value);
    if (invalidStub) {
      throw new MswdoOfflinePreparationError(MSWDO_PREPARATION_FAILURE_STAGES.DISTRIBUTION_VALIDATE, getMswdoPreparationFailureMessage(MSWDO_PREPARATION_FAILURE_STAGES.DISTRIBUTION_VALIDATE), "DISTRIBUTION_ID_OR_QR");
    }
    const photoByHousehold = await hydratePhotos([...masterlistRows, ...stubRows]);
    const preparedMasterlistRows = masterlistRows.map((row) => applyPhotoData(row, photoByHousehold));
    const preparedStubRows = stubRows.map((row) => applyPhotoData(row, photoByHousehold));
    if (!isCurrentPreparationGeneration(id, currentGeneration)) return preparing;
    const persistedStubs = await runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.DISTRIBUTION_PERSIST, () => upsertOfflineStubSnapshots(preparedStubRows));
    const storedRows = await runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.READ_BACK, () => db.offlineStubCache.toArray());
    const scopedStubRows = storedRows.filter((row) =>
      row.accessMode === owner.accessMode &&
      row.userId === userId &&
      row.roleCode === ROLE_CODES.MSWDO &&
      String(row.disaster_event_id) === String(eventId),
    );
    const requiredPhotoRows = [...masterlistRows, ...stubRows].filter((row) =>
      row?.household?.family_head_photo_url || row?.household?.family_head_photo_data_url || row?.family_head_photo_url,
    );
    const requiredPhotoHouseholdIds = new Set(
      requiredPhotoRows
        .map((row) => String(row?.household_id || row?.household?.id || ""))
        .filter(Boolean),
    );
    const preparedPhotoHouseholdIds = new Set(
      [...requiredPhotoHouseholdIds].filter((householdId) =>
        Boolean(photoByHousehold.get(householdId)?.dataUrl),
      ),
    );
    const persistedPhotoHouseholdIds = new Set(
      preparedMasterlistRows
        .filter((row) =>
          requiredPhotoHouseholdIds.has(String(row?.household_id || row?.id || "")) &&
          isImageDataUrl(row?.family_head_photo_data_url),
        )
        .map((row) => String(row.household_id || row.id)),
    );
    scopedStubRows
      .filter((row) =>
        requiredPhotoHouseholdIds.has(String(row?.household_id || "")) &&
        isImageDataUrl(row?.family_head_photo_data_url),
      )
      .forEach((row) => persistedPhotoHouseholdIds.add(String(row.household_id)));
    const distributionComplete =
      Array.isArray(stubDashboard?.data) &&
      persistedStubs.length === preparedStubRows.length &&
      preparedStubRows.every((row) => row?.id && row?.qr_code_value) &&
      scopedStubRows.length >= persistedStubs.length;
    const photoCacheComplete =
      preparedPhotoHouseholdIds.size === requiredPhotoHouseholdIds.size &&
      persistedPhotoHouseholdIds.size === requiredPhotoHouseholdIds.size;
    const snapshot = {
      ...preparing,
      status: "READY",
      datasets: {
        filters: { complete: true, events, barangays, sectors, evacuationCenters },
        masterlist: { complete: true, valid: true, rows: preparedMasterlistRows, payload: masterlist },
        dashboard: { complete: true, valid: true, payload: dashboard },
        distribution: { complete: distributionComplete, valid: distributionComplete, rows: persistedStubs.length, payload: stubDashboard },
        photoCache: { complete: photoCacheComplete, required: requiredPhotoHouseholdIds.size, prepared: preparedPhotoHouseholdIds.size, actual_bytes_persisted: persistedPhotoHouseholdIds.size },
      },
      masterlist_count: preparedMasterlistRows.length,
      updated_at: new Date().toISOString(),
    };
    if (!isCurrentPreparationGeneration(id, currentGeneration)) return snapshot;
    await runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.PREPARATION_METADATA, () => db.offlinePreparation.put(snapshot));
    const readBack = await runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.READ_BACK, () => db.offlinePreparation.get(id));
    // Preserve the Stage 2 contract wording while exposing READ_BACK safely.
    if (!readBack?.datasets?.masterlist?.complete || !readBack?.datasets?.dashboard?.complete || !readBack?.datasets?.filters?.complete || !readBack?.datasets?.distribution?.complete || !readBack?.datasets?.photoCache?.complete) throw new MswdoOfflinePreparationError(MSWDO_PREPARATION_FAILURE_STAGES.READ_BACK, "MSWDO offline distribution data could not be verified.");
    if (isCurrentPreparationGeneration(id, currentGeneration)) publish({ ...readBack, generation: currentGeneration });
    return readBack;
  } catch (error) {
    if (!isCurrentPreparationGeneration(id, currentGeneration)) throw error;
    const failure = error instanceof MswdoOfflinePreparationError
      ? error
      : toPreparationError(error, MSWDO_PREPARATION_FAILURE_STAGES.PREPARATION_METADATA);
    const failed = { ...preparing, status: preparing.previous_complete_cache ? "NEEDS_REFRESH" : "NOT_READY", error: failure.message, failure_stage: failure.stage, failure_code: failure.code, failure_message: failure.message, failure_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    try {
      await db.offlinePreparation.put(failed);
    } catch (_metadataError) {
      throw new MswdoOfflinePreparationError(MSWDO_PREPARATION_FAILURE_STAGES.PREPARATION_METADATA);
    }
    if (isCurrentPreparationGeneration(id, currentGeneration)) publish({ ...failed, generation: currentGeneration });
    throw error;
  }
};

