import { LOCAL_SYNC_STATUS } from "../../offline/db.js";
import { getSyncQueueSnapshot } from "../../offline/syncQueue";

const retryableStatuses = new Set([
  LOCAL_SYNC_STATUS.PENDING,
  LOCAL_SYNC_STATUS.FAILED,
]);

const buildFullName = (person = {}) =>
  [
    person.first_name,
    person.middle_name,
    person.last_name,
    person.suffix,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");

const normalizeSectorOptions = (sectorOptions = []) => {
  const sectorById = new Map();

  sectorOptions.forEach((sector) => {
    const id = sector?.id || sector?.value || "";
    const name = sector?.name || sector?.label || "";

    if (id && name) {
      sectorById.set(id, name);
    }
  });

  return sectorById;
};

const collectSectorIds = (payload = {}) => {
  const sectorIds = new Set();

  (payload.family_head?.sector_ids || []).forEach((sectorId) => {
    if (sectorId) {
      sectorIds.add(sectorId);
    }
  });

  (payload.household_sector_ids || []).forEach((sectorId) => {
    if (sectorId) {
      sectorIds.add(sectorId);
    }
  });

  (payload.members || []).forEach((member) => {
    (member?.sector_ids || []).forEach((sectorId) => {
      if (sectorId) {
        sectorIds.add(sectorId);
      }
    });
  });

  return Array.from(sectorIds);
};

const buildSectorText = (sectorIds = [], sectorOptions = []) => {
  const sectorById = normalizeSectorOptions(sectorOptions);
  const sectorNames = sectorIds
    .map((sectorId) => sectorById.get(sectorId))
    .filter(Boolean);

  return sectorNames.length > 0 ? sectorNames.join(", ") : "-";
};

const isEvacuationCenterRegistration = (payload = {}) => {
  return String(payload.current_stay_type || "").toUpperCase() === "EVAC_CENTER";
};

export const getPendingLocalStubRows = async ({
  disasterEventId,
  barangayId,
  sectorOptions = [],
  existingHouseholdIds = [],
}) => {
  if (!disasterEventId || !barangayId) {
    return [];
  }

  const existingHouseholdIdSet = new Set(existingHouseholdIds.filter(Boolean));
  const syncEntries = await getSyncQueueSnapshot();

  return syncEntries
    .filter((entry) => {
      const payload = entry.payload || {};

      return (
        entry.moduleName === "barangay-households" &&
        ["HOUSEHOLD_REGISTER", "HOUSEHOLD_RE_ADMISSION"].includes(
          entry.actionKey,
        ) &&
        entry.entityType === "HOUSEHOLD" &&
        retryableStatuses.has(entry.status) &&
        payload.disaster_event_id === disasterEventId &&
        payload.barangay_id === barangayId &&
        isEvacuationCenterRegistration(payload) &&
        !existingHouseholdIdSet.has(entry.entityLocalId) &&
        !existingHouseholdIdSet.has(entry.entityServerId)
      );
    })
    .map((entry) => {
      const payload = entry.payload || {};
      const familyHeadName = buildFullName(payload.family_head) || "Pending household";
      const sectorIds = collectSectorIds(payload);
      const membersCount = Number(payload.household_size) || (payload.members || []).length + 1;

      return {
        id: `local-stub-${entry.id}`,
        household_id: entry.entityLocalId || entry.id,
        family_head_name: familyHeadName,
        household: {
          id: entry.entityLocalId || entry.id,
          family_head_name: familyHeadName,
          members_count: membersCount,
          is_active: true,
        },
        members_count: membersCount,
        display_stub_no: "Available after sync",
        stub_sequence_no: null,
        stub_number: "-",
        stub_no: "-",
        serial_no: "-",
        qr_code_value: "",
        qr_generated_at: "",
        qr_generated_by: "",
        qr_status: "",
        qr_notes: "",
        relief_pack_name: "--",
        assigned_relief_packs: [],
        sectors_text: buildSectorText(sectorIds, sectorOptions),
        sector_ids: sectorIds,
        status: "ISSUED",
        sync_status: entry.status,
        is_local_only: true,
        sync_entry_id: entry.id,
        created_at: entry.clientTimestamp,
        issued_at: entry.clientTimestamp,
      };
    });
};
