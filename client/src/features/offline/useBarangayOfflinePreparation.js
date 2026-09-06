import { useEffect, useState } from "react";
import {
  getOfflinePreparation,
  OFFLINE_CACHE_VERSION,
  OFFLINE_PREPARATION_STATUS,
  prepareBarangayOfflineData,
} from "../../offline/offlinePreparation.js";
import { getCachedMasterlistRows } from "../../offline/masterlistCache.js";
import {
  getCachedEvacuationCentersByBarangay,
  getCachedRegistrationReferenceData,
} from "../household-registration/householdRegistrationService.js";

export const useBarangayOfflinePreparation = ({ enabled = true, userId = "", eventId = "", barangayId = "", context = {} }) => {
  const [readiness, setReadiness] = useState(OFFLINE_PREPARATION_STATUS.NOT_PREPARED);
  const [diagnostics, setDiagnostics] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled || !userId || !eventId || !barangayId) {
      setReadiness(OFFLINE_PREPARATION_STATUS.NOT_PREPARED);
      return undefined;
    }
    let mounted = true;
    const scope = { eventId, barangayId };
    const run = async () => {
      const existing = await getOfflinePreparation(scope);
      if (mounted && existing) setDiagnostics(existing);
      const cachedMasterlistRows = await getCachedMasterlistRows({
        disasterEventId: eventId,
        barangayId,
      });
      const expectedMasterlistCount = Number(existing?.masterlist_count ?? 0);
      const cachedReferenceData = getCachedRegistrationReferenceData();
      const hasEventReference = Array.isArray(cachedReferenceData.activeDisasterEvents) &&
        cachedReferenceData.activeDisasterEvents.some((event) => String(event?.id) === String(eventId));
      const hasBarangayReference = Array.isArray(cachedReferenceData.barangays) &&
        cachedReferenceData.barangays.some((barangay) => String(barangay?.id) === String(barangayId));
      const hasSectorReference = Array.isArray(cachedReferenceData.sectors?.data) &&
        cachedReferenceData.sectors.data.length > 0;
      const hasEvacuationCenterReference =
        getCachedEvacuationCentersByBarangay(barangayId).length > 0;
      const hasCompleteHouseholdDetails = cachedMasterlistRows.every(
        (row) => Boolean(
          row?.offline_household_details?.household?.id &&
            row.offline_household_details.household.family_head_photo_data_url,
        ),
      );
      const hasRequiredMasterlistCache =
        existing?.status === OFFLINE_PREPARATION_STATUS.READY &&
        existing?.cache_version === OFFLINE_CACHE_VERSION &&
        hasCompleteHouseholdDetails &&
        (expectedMasterlistCount === 0 || cachedMasterlistRows.length > 0);
      if (
        hasRequiredMasterlistCache &&
        hasEventReference &&
        hasBarangayReference &&
        hasSectorReference &&
        hasEvacuationCenterReference
      ) {
        if (mounted) setReadiness(OFFLINE_PREPARATION_STATUS.READY);
        return;
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (mounted) {
          setReadiness(
            [
              OFFLINE_PREPARATION_STATUS.READY,
              OFFLINE_PREPARATION_STATUS.NEEDS_REFRESH,
            ].includes(existing?.status)
              ? OFFLINE_PREPARATION_STATUS.NEEDS_REFRESH
              : OFFLINE_PREPARATION_STATUS.NOT_READY,
          );
        }
        return;
      }
      if (mounted) setReadiness(OFFLINE_PREPARATION_STATUS.PREPARING);
      try {
        const result = await prepareBarangayOfflineData({ ...scope, userId, context });
        if (mounted) setReadiness(result?.status || OFFLINE_PREPARATION_STATUS.READY);
      } catch (_error) {
        if (mounted) {
          const previousCache = Boolean(existing?.previous_complete_cache || existing?.previousCompleteCache);
          setReadiness(previousCache ? OFFLINE_PREPARATION_STATUS.NEEDS_REFRESH : OFFLINE_PREPARATION_STATUS.NOT_READY);
        }
      }
    };
    const update = (event) => { if (mounted) { setDiagnostics(event.detail || null); if (event.detail?.status) setReadiness(event.detail.status); } };
    const online = () => setRevision((value) => value + 1);
    run();
    if (typeof window !== "undefined") {
      window.addEventListener("online", online);
      window.addEventListener("distync-offline-preparation-updated", update);
    }
    return () => {
      mounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("online", online);
        window.removeEventListener("distync-offline-preparation-updated", update);
      }
    };
  }, [
    barangayId,
    context?.barangaySource,
    context?.eventSource,
    context?.eventStatus,
    enabled,
    eventId,
    revision,
    userId,
  ]);
  return { readiness, diagnostics, isReady: readiness === OFFLINE_PREPARATION_STATUS.READY, retry: () => setRevision((value) => value + 1) };
};
