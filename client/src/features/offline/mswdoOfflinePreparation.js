import db from "../../offline/db.js";
import { getAccessMode } from "../../utils/accessMode.js";
import {
  getSyncQueueActorContext,
  isSyncQueueActorContextCurrent,
} from "../../offline/syncQueue.js";
import { ROLE_CODES } from "../../utils/roleSession.js";
import {
  fetchConsolidatedMasterlist,
  fetchConsolidatedMasterlistDashboard,
  fetchDisasterEvents,
  fetchBarangays,
} from "../mswdo-masterlist/mswdoMasterlistService.js";
import { fetchMswdoSectors } from "../mswdo-masterlist/mswdoMasterlistService.js";
import {
  fetchMunicipalStubDashboard,
  fetchStubFamilyHeadPhoto,
} from "../stubs/stubService.js";
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
const preparationJobs = new Map();
const activePreparationScopes = new Map();
let nextPreparationGeneration = 0;
let nextScopeActivationGeneration = 0;

const normalize = (value) => String(value || "").trim();

const beginPreparationGeneration = (id, requestedGeneration) => {
  const generation = requestedGeneration || ++nextPreparationGeneration;
  preparationGenerations.set(id, generation);
  return generation;
};

const isCurrentPreparationGeneration = (id, generation) =>
  preparationGenerations.get(id) === generation;

export const getMswdoOfflineScopeKey = ({ userId, eventId, mode = getAccessMode() } = {}) =>
  [mode, userId, ROLE_CODES.MSWDO, eventId, MSWDO_OFFLINE_DATASET].map(normalize).join("|");

const getOwner = () => getSyncQueueActorContext();
const getActorScopeKey = (owner) =>
  [owner?.accessMode, owner?.userId, owner?.roleCode].map(normalize).join("|");

const activateMswdoOfflineScope = ({ userId, eventId } = {}, owner = getOwner()) => {
  if (!userId || !eventId || owner.roleCode !== ROLE_CODES.MSWDO || owner.userId !== userId) {
    return null;
  }
  const scopeKey = getMswdoOfflineScopeKey({ userId, eventId, mode: owner.accessMode });
  const actorKey = getActorScopeKey(owner);
  const activeScope = activePreparationScopes.get(actorKey);
  if (!activeScope || activeScope.scopeKey !== scopeKey) {
    const nextScope = { scopeKey, generation: ++nextScopeActivationGeneration };
    activePreparationScopes.set(actorKey, nextScope);
    return nextScope;
  }
  return activeScope;
};

export const setCurrentMswdoOfflineScope = (scope = {}) => {
  const activeScope = activateMswdoOfflineScope(scope, getOwner());
  return activeScope?.generation ?? null;
};

const isCurrentMswdoPreparation = (id, generation, owner, scopeGeneration) => {
  const activeScope = activePreparationScopes.get(getActorScopeKey(owner));
  return isCurrentPreparationGeneration(id, generation) &&
    activeScope?.scopeKey === id &&
    activeScope.generation === scopeGeneration &&
    isSyncQueueActorContextCurrent(owner);
};

const isMswdoOwner = (userId, owner = getOwner()) =>
  owner.roleCode === ROLE_CODES.MSWDO && owner.userId === userId;

export const getMswdoOfflinePreparation = async ({ userId, eventId } = {}) => {
  const owner = getOwner();
  if (!userId || !eventId || !isMswdoOwner(userId, owner)) return null;
  const id = getMswdoOfflineScopeKey({ userId, eventId, mode: owner.accessMode });
  const record = await db.offlinePreparation.get(id);
  if (
    !isSyncQueueActorContextCurrent(owner) ||
    !record ||
    record.id !== id ||
    record.accessMode !== owner.accessMode ||
    record.userId !== userId ||
    record.roleCode !== ROLE_CODES.MSWDO ||
    String(record.disaster_event_id || "") !== String(eventId) ||
    String(record.barangay_id || "") !== ""
  ) {
    return null;
  }
  return record;
};

const hasCompleteMswdoOfflineDatasets = (record) => {
  const datasets = record?.datasets;
  const masterlistRows = datasets?.masterlist?.rows;
  const masterlistPayloadRows = datasets?.masterlist?.payload?.data;
  const filters = datasets?.filters;
  const distributionRows = datasets?.distribution?.payload?.data;
  const photoCache = datasets?.photoCache;
  const photoCount = photoCache?.required;
  return record?.cache_version === MSWDO_OFFLINE_CACHE_VERSION &&
    datasets?.masterlist?.complete === true &&
    datasets.masterlist.valid === true &&
    Array.isArray(masterlistRows) &&
    Array.isArray(masterlistPayloadRows) &&
    masterlistRows.length === masterlistPayloadRows.length &&
    Number.isInteger(record.masterlist_count) &&
    Number(record.masterlist_count) === masterlistRows.length &&
    datasets?.dashboard?.complete === true &&
    datasets.dashboard.valid === true &&
    typeof datasets.dashboard.payload === "object" &&
    datasets.dashboard.payload !== null &&
    !Array.isArray(datasets.dashboard.payload) &&
    filters?.complete === true &&
    Array.isArray(filters.events) &&
    Array.isArray(filters.barangays) &&
    Array.isArray(filters.sectors) &&
    Array.isArray(filters.evacuationCenters) &&
    datasets?.distribution?.complete === true &&
    datasets.distribution.valid === true &&
    Array.isArray(distributionRows) &&
    Number.isInteger(datasets.distribution.rows) &&
    datasets.distribution.rows === distributionRows.length &&
    photoCache?.complete === true &&
    Number.isInteger(photoCount) &&
    photoCount >= 0 &&
    photoCache.prepared === photoCount &&
    photoCache.actual_bytes_persisted === photoCount;
};

export const readMswdoOfflineSnapshot = async ({ userId, eventId } = {}) => {
  const record = await getMswdoOfflinePreparation({ userId, eventId });
  if (!record || !["READY", "NEEDS_REFRESH"].includes(record.status)) return null;
  if (!hasCompleteMswdoOfflineDatasets(record)) return null;
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
    response = await fetch(photoUrl, { cache: "no-store" });
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
      let photoUrl = household.family_head_photo_data_url || household.family_head_photo_url || "";
      if (!photoUrl && (household.has_family_head_photo || row.has_family_head_photo)) {
        const photo = await fetchStubFamilyHeadPhoto(row.id);
        photoUrl = photo?.url || "";
      }
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

const runMswdoOfflinePreparation = async ({
  userId,
  eventId,
  owner,
  id,
  activeScope,
  currentGeneration,
} = {}) => {
  const existing = await runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.PREPARATION_METADATA, () => db.offlinePreparation.get(id));
  const readinessGeneration = Math.max(
    1,
    Number(existing?.readiness_generation || 0) +
      (["READY", "NEEDS_REFRESH"].includes(existing?.status) ? 1 : 0),
  );
  const preparing = {
    id, accessMode: owner.accessMode, userId, roleCode: ROLE_CODES.MSWDO,
    disaster_event_id: eventId, barangay_id: "",
    cache_version: MSWDO_OFFLINE_CACHE_VERSION, status: "PREPARING",
    previous_complete_cache: hasCompleteMswdoOfflineDatasets(existing),
    ...(existing?.datasets ? { datasets: existing.datasets } : {}),
    updated_at: new Date().toISOString(),
    readiness_generation: readinessGeneration,
  };
  if (!isCurrentMswdoPreparation(id, currentGeneration, owner, activeScope.generation)) {
    return { ...preparing, stale: true };
  }
  await runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.PREPARATION_METADATA, () => db.offlinePreparation.put(preparing));
  if (!isCurrentMswdoPreparation(id, currentGeneration, owner, activeScope.generation)) {
    return { ...preparing, stale: true };
  }
  publish({ ...preparing, generation: currentGeneration });
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
    if (!isCurrentMswdoPreparation(id, currentGeneration, owner, activeScope.generation)) {
      return { ...preparing, stale: true };
    }
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
    const photoByHousehold = await hydratePhotos(stubRows);
    const preparedMasterlistRows = masterlistRows.map((row) => applyPhotoData(row, photoByHousehold));
    const preparedStubRows = stubRows.map((row) => applyPhotoData(row, photoByHousehold));
    if (!isCurrentMswdoPreparation(id, currentGeneration, owner, activeScope.generation)) {
      return { ...preparing, stale: true };
    }
    const persistedStubs = await runPreparationStage(
      MSWDO_PREPARATION_FAILURE_STAGES.DISTRIBUTION_PERSIST,
      () => upsertOfflineStubSnapshots(preparedStubRows, owner),
    );
    const storedRows = await runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.READ_BACK, () => db.offlineStubCache.toArray());
    const scopedStubRows = storedRows.filter((row) =>
      row.accessMode === owner.accessMode &&
      row.userId === userId &&
      row.roleCode === ROLE_CODES.MSWDO &&
      String(row.disaster_event_id) === String(eventId),
    );
    const requiredPhotoRows = stubRows.filter((row) =>
      row?.has_family_head_photo || row?.household?.has_family_head_photo ||
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
    const persistedPhotoHouseholdIds = new Set();
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
    if (!isCurrentMswdoPreparation(id, currentGeneration, owner, activeScope.generation)) {
      return { ...snapshot, stale: true };
    }
    await runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.PREPARATION_METADATA, () => db.offlinePreparation.put(snapshot));
    const readBack = await runPreparationStage(MSWDO_PREPARATION_FAILURE_STAGES.READ_BACK, () => db.offlinePreparation.get(id));
    // Preserve the Stage 2 contract wording while exposing READ_BACK safely.
    if (!hasCompleteMswdoOfflineDatasets(readBack)) throw new MswdoOfflinePreparationError(MSWDO_PREPARATION_FAILURE_STAGES.READ_BACK, "MSWDO offline distribution data could not be verified.");
    if (!isCurrentMswdoPreparation(id, currentGeneration, owner, activeScope.generation)) {
      return { ...readBack, stale: true };
    }
    publish({ ...readBack, generation: currentGeneration });
    return readBack;
  } catch (error) {
    if (!isCurrentMswdoPreparation(id, currentGeneration, owner, activeScope.generation)) {
      return { ...preparing, stale: true };
    }
    const failure = error instanceof MswdoOfflinePreparationError
      ? error
      : toPreparationError(error, MSWDO_PREPARATION_FAILURE_STAGES.PREPARATION_METADATA);
    const failed = { ...preparing, status: preparing.previous_complete_cache ? "NEEDS_REFRESH" : "NOT_READY", error: failure.message, failure_stage: failure.stage, failure_code: failure.code, failure_message: failure.message, failure_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    try {
      await db.offlinePreparation.put(failed);
    } catch (_metadataError) {
      throw new MswdoOfflinePreparationError(MSWDO_PREPARATION_FAILURE_STAGES.PREPARATION_METADATA);
    }
    if (isCurrentMswdoPreparation(id, currentGeneration, owner, activeScope.generation)) {
      publish({ ...failed, generation: currentGeneration });
    }
    throw error;
  }
};

export const prepareMswdoOfflineData = async ({ userId, eventId, generation } = {}) => {
  if (!userId || !eventId) {
    throw new MswdoOfflinePreparationError(MSWDO_PREPARATION_FAILURE_STAGES.ACTOR_CONTEXT);
  }
  const owner = getOwner();
  if (!isMswdoOwner(userId, owner)) {
    throw new MswdoOfflinePreparationError(MSWDO_PREPARATION_FAILURE_STAGES.ACTOR_CONTEXT);
  }
  const id = getMswdoOfflineScopeKey({ userId, eventId, mode: owner.accessMode });
  const activeScope = activateMswdoOfflineScope({ userId, eventId }, owner);
  const existingJob = preparationJobs.get(id);
  if (existingJob) return existingJob;
  const currentGeneration = beginPreparationGeneration(id, generation);
  const preparation = runMswdoOfflinePreparation({
    userId,
    eventId,
    owner,
    id,
    activeScope,
    currentGeneration,
  });
  const job = preparation.finally(() => {
    if (preparationJobs.get(id) === job) preparationJobs.delete(id);
  });
  preparationJobs.set(id, job);
  return job;
};

