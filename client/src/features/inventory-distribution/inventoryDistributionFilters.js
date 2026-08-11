import { getCanonicalSectorCodeFromText } from "../../utils/sectorDisplay.js";

const getReliefPackSearchValues = (row) => {
  const values = [row.relief_pack_name];

  if (Array.isArray(row.relief_pack_templates)) {
    row.relief_pack_templates.forEach((template) => {
      values.push(template.name);

      if (Array.isArray(template.items)) {
        template.items.forEach((item) => {
          values.push(item.inventory_item?.item_name);
        });
      }
    });
  }

  if (Array.isArray(row.donated_relief_packs)) {
    row.donated_relief_packs.forEach((pack) => {
      values.push(pack.name, pack.donor_name);
    });
  }

  if (Array.isArray(row.donated_loose_items)) {
    row.donated_loose_items.forEach((item) => {
      values.push(item.inventory_item_name, item.item_name, item.donor_name);
    });
  }

  return values;
};

export const matchesInventoryDistributionSearch = (row, searchTerm) => {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  if (!normalizedSearchTerm) {
    return true;
  }

  const searchableValues = [
    row.family_head_name,
    row.address,
    row.barangay_name,
    row.family_members_count,
    row.sectors_text,
    row.distribution_status_label,
    row.authorized_by_name,
    ...getReliefPackSearchValues(row),
  ];

  return searchableValues.some((value) =>
    String(value || "")
      .toLowerCase()
      .includes(normalizedSearchTerm),
  );
};

export const matchesInventoryDistributionFilters = (
  row,
  selectedStatus,
  selectedSectorIds,
) => {
  if (selectedStatus && row.distribution_status !== selectedStatus) {
    return false;
  }

  if (!selectedSectorIds.length) {
    return true;
  }

  const rowSectorIds = Array.isArray(row.sector_ids) ? row.sector_ids : [];
  const rowSectorCodes = String(row.sectors_text || "")
    .split(",")
    .map((sectorName) => getCanonicalSectorCodeFromText(sectorName))
    .filter(Boolean);

  return selectedSectorIds.some(
    (sectorId) =>
      rowSectorIds.includes(sectorId) || rowSectorCodes.includes(sectorId),
  );
};
