const reliefPackTemplateRepository = require("../repositories/reliefPackTemplate.repository");
const disasterEventRepository = require("../repositories/disasterEvent.repository");
const stubRepository = require("../repositories/stub.repository");

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

const sectorIdsDescriptionPrefix = "__relief_pack_sector_ids__:";

const parseSectorIdsFromDescription = (description) => {
  const textValue = String(description || "");

  if (!textValue.startsWith(sectorIdsDescriptionPrefix)) {
    return [];
  }

  try {
    const parsedSectorIds = JSON.parse(
      textValue.slice(sectorIdsDescriptionPrefix.length),
    );
    return Array.isArray(parsedSectorIds)
      ? parsedSectorIds.map((sectorId) => String(sectorId || "").trim()).filter(Boolean)
      : [];
  } catch (_error) {
    return [];
  }
};

const buildSectorIds = (
  householdId,
  householdSectorsByHouseholdId,
  memberSectorsByHouseholdId,
) => {
  const householdSectorIds = (householdSectorsByHouseholdId[householdId] || []).map(
    (sector) => sector.id,
  );
  const memberSectorIds = (memberSectorsByHouseholdId[householdId] || []).map(
    (sector) => sector.id,
  );

  return [...new Set([...householdSectorIds, ...memberSectorIds])];
};

const getStandardReliefPackTemplates = (templates) => {
  if (!Array.isArray(templates) || templates.length === 0) {
    return [];
  }

  const standardTemplates = templates.filter(
    (template) => template?.is_active && !template?.is_additional_pack,
  );

  if (standardTemplates.length === 0) {
    return [];
  }

  return [...standardTemplates].sort((left, right) => {
    if (left.based_on_family_size && !right.based_on_family_size) {
      return -1;
    }

    if (!left.based_on_family_size && right.based_on_family_size) {
      return 1;
    }

    return String(left.name || "").localeCompare(String(right.name || ""));
  });
};

const getAssignedReliefPackTemplatesForSectorIds = (
  householdSectorIds,
  templates,
  disasterType = null,
) => {
  if (!Array.isArray(templates) || templates.length === 0) {
    return [];
  }

  const sectorIdSet = new Set((householdSectorIds || []).filter(Boolean));
  const applicableTemplates = templates.filter((template) =>
    isTemplateApplicableToDisasterType(template, disasterType),
  );
  const assignedTemplates = getStandardReliefPackTemplates(applicableTemplates);

  applicableTemplates.forEach((template) => {
    const templateSectorIds = Array.isArray(template?.sector_ids)
      ? template.sector_ids
      : parseSectorIdsFromDescription(template?.description);
    const normalizedTemplateSectorIds = [
      ...new Set([...templateSectorIds, template?.sector_id].filter(Boolean)),
    ];

    if (
      !template?.is_active ||
      !template?.is_additional_pack ||
      normalizedTemplateSectorIds.length === 0 ||
      !normalizedTemplateSectorIds.some((sectorId) => sectorIdSet.has(sectorId))
    ) {
      return;
    }

    assignedTemplates.push(template);
  });

  return assignedTemplates;
};

const isTemplateApplicableToDisasterType = (template, disasterType) => {
  const normalizedDisasterType = String(disasterType || "").trim();

  if (!normalizedDisasterType) {
    return true;
  }

  if (template?.applies_to_all_disasters !== false) {
    return true;
  }

  const isOtherDisasterType =
    !STANDARD_DISASTER_TYPES.includes(normalizedDisasterType);

  return (template?.disaster_types || []).some(
    (currentType) => {
      const normalizedCurrentType = String(currentType || "").trim();
      return (
        normalizedCurrentType === normalizedDisasterType ||
        (isOtherDisasterType && normalizedCurrentType === "Other")
      );
    },
  );
};

const getPrimaryAssignedReliefPackTemplate = (templates) => {
  const standardTemplates = getStandardReliefPackTemplates(templates);

  if (standardTemplates.length > 0) {
    return standardTemplates[0];
  }

  return Array.isArray(templates) && templates.length > 0 ? templates[0] : null;
};

const fetchActiveReliefPackTemplates = async (disasterType = null) => {
  return reliefPackTemplateRepository.getReliefPackTemplates({
    is_active: true,
    based_on_family_size: null,
    based_on_sector: null,
    search: "",
    disaster_type: disasterType,
  });
};

const resolveAssignedReliefPackTemplatesForHousehold = async (
  householdId,
  disasterEventId = null,
) => {
  if (!householdId) {
    return [];
  }

  let disasterType = null;

  if (disasterEventId) {
    const disasterEvent = await disasterEventRepository.getDisasterEventById(
      disasterEventId,
    );
    disasterType = String(disasterEvent?.disaster_type || "").trim() || null;
  }

  const [householdSectors, memberSectors, templates] = await Promise.all([
    stubRepository.getHouseholdSectorsByHouseholdId(householdId),
    stubRepository.getMemberSectorsByHouseholdIds([householdId]),
    fetchActiveReliefPackTemplates(disasterType),
  ]);

  const sectorIds = buildSectorIds(
    householdId,
    { [householdId]: householdSectors },
    { [householdId]: memberSectors },
  );

  return getAssignedReliefPackTemplatesForSectorIds(
    sectorIds,
    templates,
    disasterType,
  );
};

module.exports = {
  buildSectorIds,
  getAssignedReliefPackTemplatesForSectorIds,
  getPrimaryAssignedReliefPackTemplate,
  getStandardReliefPackTemplates,
  resolveAssignedReliefPackTemplatesForHousehold,
};
