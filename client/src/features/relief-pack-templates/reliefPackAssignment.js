const STANDARD_DISASTER_TYPES = [
  "Typhoon",
  "Flood",
  "Earthquake",
  "Landslide",
  "Volcanic Eruption",
  "Storm Surge",
  "Drought / El Ni\u00f1o",
  "Tsunami",
  "Fire",
];

export const getHouseholdSectorIds = (household) => {
  return [
    ...(household?.household_sectors || []).map((sector) => sector.id),
    ...(household?.members || [])
      .filter((member) => member?.is_active !== false)
      .flatMap((member) =>
        (member.sectors || []).map((sector) => sector.id),
      ),
  ].filter(Boolean);
};

export const getTemplateSectorIds = (template) => {
  return [
    ...(Array.isArray(template?.sector_ids) ? template.sector_ids : []),
    template?.sector_id,
  ].filter(Boolean).filter((sectorId, index, sectorIds) =>
    sectorIds.indexOf(sectorId) === index,
  );
};

export const isTemplateApplicableToDisasterType = (
  template,
  disasterType,
) => {
  const normalizedDisasterType = String(disasterType || "").trim();

  if (!normalizedDisasterType || template?.applies_to_all_disasters !== false) {
    return true;
  }

  const isOtherDisasterType =
    !STANDARD_DISASTER_TYPES.includes(normalizedDisasterType);

  return (template?.disaster_types || []).some((currentType) => {
    const normalizedCurrentType = String(currentType || "").trim();

    return (
      normalizedCurrentType === normalizedDisasterType ||
      (isOtherDisasterType && normalizedCurrentType === "Other")
    );
  });
};

export const getAssignedReliefPackTemplatesForHousehold = (
  household,
  templates,
  disasterEvent = null,
) => {
  const householdSectorIds = new Set(getHouseholdSectorIds(household));
  const disasterType = disasterEvent?.disaster_type;

  return (Array.isArray(templates) ? templates : []).filter((template) => {
    if (
      !template?.is_active ||
      !isTemplateApplicableToDisasterType(template, disasterType)
    ) {
      return false;
    }

    if (!template.is_additional_pack) {
      return true;
    }

    return getTemplateSectorIds(template).some((sectorId) =>
      householdSectorIds.has(sectorId),
    );
  });
};
