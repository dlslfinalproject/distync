const normalizeSnapshotValue = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsedValue = JSON.parse(value);
      return Array.isArray(parsedValue) ? parsedValue : [];
    } catch (_error) {
      return [];
    }
  }

  return [];
};

const normalizeSnapshotItems = (items) =>
  (Array.isArray(items) ? items : [])
    .map((item) => {
      const inventoryItemId =
        item?.inventory_item_id || item?.inventoryItemId || null;

      return {
        id: item?.id || null,
        inventory_item_id: inventoryItemId,
        item_code: item?.item_code || null,
        item_name: item?.item_name || item?.name || "--",
        category: item?.category || "--",
        unit_of_measure: item?.unit_of_measure || "unit(s)",
        quantity_required: Number(item?.quantity_required || 0),
      };
    })
    .filter((item) => item.inventory_item_id || item.item_name !== "--");

const normalizeReliefPackAssignmentSnapshots = (value) => {
  const snapshots = normalizeSnapshotValue(value);

  if (snapshots === null) {
    return null;
  }

  return snapshots
    .map((snapshot) => {
      const templateId =
        snapshot?.relief_pack_template_id || snapshot?.id || null;
      const name = String(snapshot?.name || "").trim();

      if (!templateId || !name) {
        return null;
      }

      const packMultiplier = Number(snapshot?.pack_multiplier || 1);

      return {
        id: templateId,
        relief_pack_template_id: templateId,
        name,
        description: snapshot?.description || null,
        based_on_family_size: Boolean(snapshot?.based_on_family_size),
        based_on_sector: Boolean(snapshot?.based_on_sector),
        is_additional_pack: Boolean(snapshot?.is_additional_pack),
        sector_id: snapshot?.sector_id || null,
        applies_to_all_disasters:
          snapshot?.applies_to_all_disasters !== false,
        disaster_type: snapshot?.disaster_type || null,
        pack_multiplier:
          Number.isInteger(packMultiplier) && packMultiplier > 0
            ? packMultiplier
            : 1,
        items: normalizeSnapshotItems(snapshot?.items),
        assigned_at: snapshot?.assigned_at || null,
        assignment_snapshot: true,
      };
    })
    .filter(Boolean);
};

const isLiveUnclaimedReliefPackAssignment = ({
  status,
  disasterEventStatus,
} = {}) =>
  String(status || "").toUpperCase() === "ISSUED" &&
  String(disasterEventStatus || "").toUpperCase() === "ACTIVE";

module.exports = {
  isLiveUnclaimedReliefPackAssignment,
  normalizeReliefPackAssignmentSnapshots,
};
