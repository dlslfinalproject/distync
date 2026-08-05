const pool = require("../config/db");
const disasterEventRepository = require("../repositories/disasterEvent.repository");
const reliefPackTemplateRepository = require("../repositories/reliefPackTemplate.repository");
const { logAuditSafely } = require("../utils/systemLog");

const ensureUniqueTemplateName = async (name, currentTemplateId = null) => {
  const existingTemplate =
    await reliefPackTemplateRepository.getReliefPackTemplateByName(name);

  if (existingTemplate && existingTemplate.id !== currentTemplateId) {
    const error = new Error("Relief pack template name already exists");
    error.statusCode = 409;
    throw error;
  }
};

const validateTemplateItems = async (items) => {
  const uniqueInventoryItemIds = new Set();

  for (const item of items) {
    if (uniqueInventoryItemIds.has(item.inventory_item_id)) {
      const error = new Error(
        "Duplicate inventory_item_id is not allowed in the same template",
      );
      error.statusCode = 400;
      throw error;
    }

    uniqueInventoryItemIds.add(item.inventory_item_id);

    const inventoryItem = await reliefPackTemplateRepository.getInventoryItemById(
      item.inventory_item_id,
    );

    if (!inventoryItem) {
      const error = new Error(
        `inventory_item_id does not refer to an existing inventory item: ${item.inventory_item_id}`,
      );
      error.statusCode = 400;
      throw error;
    }
  }
};

const mapTemplateItems = (items) => {
  return items.map((item) => ({
    id: item.id,
    inventory_item_id: item.inventory_item_id,
    quantity_required: item.quantity_required,
    created_at: item.created_at,
    inventory_item: {
      id: item.inventory_item_id,
      item_code: item.item_code,
      item_name: item.item_name,
      category: item.category,
      unit_of_measure: item.unit_of_measure,
      barcode: item.barcode,
      is_perishable: item.is_perishable,
      is_active: item.is_active,
    },
  }));
};

const normalizeDisasterTypes = (disasterTypes) => {
  return Array.from(
    new Set(
      (Array.isArray(disasterTypes) ? disasterTypes : [])
        .map((disasterType) => String(disasterType || "").trim())
        .filter(Boolean),
    ),
  ).sort((leftType, rightType) => leftType.localeCompare(rightType));
};

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

const normalizeDisasterTypeOption = (disasterType) => {
  const normalizedDisasterType = String(disasterType || "").trim();

  if (!normalizedDisasterType) {
    return null;
  }

  return STANDARD_DISASTER_TYPES.includes(normalizedDisasterType)
    ? normalizedDisasterType
    : "Other";
};

const buildTemplateUsageSummary = (usageRows = []) => {
  const usedDisasterTypes = normalizeDisasterTypes(
    usageRows.map((row) => row.disaster_type),
  );
  const lockedDisasterTypeOptions = normalizeDisasterTypes(
    usedDisasterTypes.map(normalizeDisasterTypeOption).filter(Boolean),
  );
  const totalDistributions = usageRows.reduce(
    (sum, row) => sum + Number(row.distributions_count || 0),
    0,
  );

  return {
    is_used: totalDistributions > 0,
    total_distributions: totalDistributions,
    used_disaster_types: usedDisasterTypes,
    locked_disaster_type_options: lockedDisasterTypeOptions,
  };
};

const normalizeSectorIds = (sectorIds, fallbackSectorId = null) => {
  return Array.from(
    new Set(
      [
        ...(Array.isArray(sectorIds) ? sectorIds : []),
        fallbackSectorId,
      ]
        .map((sectorId) => String(sectorId || "").trim())
        .filter(Boolean),
    ),
  ).sort((leftSectorId, rightSectorId) => leftSectorId.localeCompare(rightSectorId));
};

const sectorIdsDescriptionPrefix = "__relief_pack_sector_ids__:";

const serializeSectorIdsDescription = (sectorIds) => {
  return `${sectorIdsDescriptionPrefix}${JSON.stringify(sectorIds)}`;
};

const parseSectorIdsFromDescription = (description) => {
  const textValue = String(description || "");

  if (!textValue.startsWith(sectorIdsDescriptionPrefix)) {
    return [];
  }

  try {
    const parsedSectorIds = JSON.parse(
      textValue.slice(sectorIdsDescriptionPrefix.length),
    );
    return normalizeSectorIds(parsedSectorIds);
  } catch (_error) {
    return [];
  }
};

const getPublicTemplateDescription = (template) => {
  if (
    template?.is_additional_pack &&
    String(template?.description || "").startsWith(sectorIdsDescriptionPrefix)
  ) {
    return null;
  }

  return template?.description ?? null;
};

const getTemplateStructuralSnapshot = (template, items = []) => ({
  name: String(template?.name || "").trim(),
  description: getPublicTemplateDescription(template),
  based_on_family_size: Boolean(template?.based_on_family_size),
  based_on_sector: Boolean(template?.based_on_sector),
  is_additional_pack: Boolean(template?.is_additional_pack),
  sector_ids: normalizeSectorIds(
    parseSectorIdsFromDescription(template?.description),
    template?.sector_id,
  ),
  items: [...(items || [])]
    .map((item) => ({
      inventory_item_id: item.inventory_item_id,
      quantity_required: Number(item.quantity_required || 0),
    }))
    .sort((leftItem, rightItem) =>
      String(leftItem.inventory_item_id).localeCompare(
        String(rightItem.inventory_item_id),
      ),
    ),
});

const buildTemplateAuditValues = (template) => ({
  name: template?.name || null,
  description: template?.description || null,
  based_on_family_size: Boolean(template?.based_on_family_size),
  based_on_sector: Boolean(template?.based_on_sector),
  is_additional_pack: Boolean(template?.is_additional_pack),
  sector_id: template?.sector_id || null,
  sector_ids: normalizeSectorIds(template?.sector_ids, template?.sector_id),
  applies_to_all_disasters: template?.applies_to_all_disasters !== false,
  disaster_types: normalizeDisasterTypes(template?.disaster_types),
  is_active: template?.is_active !== false,
  items: [...(Array.isArray(template?.items) ? template.items : [])]
    .map((item) => ({
      inventory_item_id: item.inventory_item_id,
      item_name: item.inventory_item?.item_name || item.item_name || null,
      quantity_required: Number(item.quantity_required || 0),
    }))
    .filter((item) => item.inventory_item_id)
    .sort((leftItem, rightItem) =>
      String(leftItem.inventory_item_id).localeCompare(
        String(rightItem.inventory_item_id),
      ),
    ),
  usage_summary: template?.usage_summary || null,
});

const areArraysEqual = (leftValues = [], rightValues = []) => {
  if (leftValues.length !== rightValues.length) {
    return false;
  }

  return leftValues.every((leftValue, index) => leftValue === rightValues[index]);
};

const areTemplateItemsEqual = (leftItems = [], rightItems = []) => {
  if (leftItems.length !== rightItems.length) {
    return false;
  }

  return leftItems.every((leftItem, index) => {
    const rightItem = rightItems[index];
    return (
      leftItem.inventory_item_id === rightItem.inventory_item_id &&
      Number(leftItem.quantity_required || 0) ===
        Number(rightItem.quantity_required || 0)
    );
  });
};

const isTemplateStructureChanged = (currentSnapshot, nextSnapshot) => {
  return (
    currentSnapshot.name !== nextSnapshot.name ||
    currentSnapshot.description !== nextSnapshot.description ||
    currentSnapshot.based_on_family_size !== nextSnapshot.based_on_family_size ||
    currentSnapshot.based_on_sector !== nextSnapshot.based_on_sector ||
    currentSnapshot.is_additional_pack !== nextSnapshot.is_additional_pack ||
    !areArraysEqual(currentSnapshot.sector_ids, nextSnapshot.sector_ids) ||
    !areTemplateItemsEqual(currentSnapshot.items, nextSnapshot.items)
  );
};

const getTemplateApplicabilityOptionSet = ({
  appliesToAllDisasters,
  disasterTypes,
}) => {
  if (appliesToAllDisasters) {
    return new Set([...STANDARD_DISASTER_TYPES, "Other"]);
  }

  return new Set(
    normalizeDisasterTypes(disasterTypes)
      .map(normalizeDisasterTypeOption)
      .filter(Boolean),
  );
};

const validateTemplateUsageRules = ({
  existingTemplate,
  existingItems,
  templateData,
  persistencePayload,
  usageSummary,
}) => {
  if (
    Boolean(templateData.is_additional_pack) !==
    Boolean(existingTemplate.is_additional_pack)
  ) {
    const error = new Error("Pack type cannot be changed after creation");
    error.statusCode = 409;
    throw error;
  }

  if (!usageSummary.is_used) {
    return;
  }

  const currentSnapshot = getTemplateStructuralSnapshot(
    existingTemplate,
    existingItems,
  );
  const nextSnapshot = {
    name: String(templateData.name || "").trim(),
    description: getPublicTemplateDescription(persistencePayload),
    based_on_family_size: Boolean(templateData.based_on_family_size),
    based_on_sector: Boolean(templateData.based_on_sector),
    is_additional_pack: Boolean(templateData.is_additional_pack),
    sector_ids: normalizeSectorIds(
      persistencePayload.sector_ids,
      persistencePayload.sector_id,
    ),
    items: [...(Array.isArray(templateData.items) ? templateData.items : existingItems)]
      .map((item) => ({
        inventory_item_id: item.inventory_item_id,
        quantity_required: Number(item.quantity_required || 0),
      }))
      .sort((leftItem, rightItem) =>
        String(leftItem.inventory_item_id).localeCompare(
          String(rightItem.inventory_item_id),
        ),
      ),
  };

  if (isTemplateStructureChanged(currentSnapshot, nextSnapshot)) {
    const error = new Error(
      "This relief pack has distribution records, so only unused disaster applicability options can be changed",
    );
    error.statusCode = 409;
    throw error;
  }

  const currentApplicabilityOptions = getTemplateApplicabilityOptionSet({
    appliesToAllDisasters: existingTemplate.applies_to_all_disasters !== false,
    disasterTypes: usageSummary.locked_disaster_type_options,
  });
  const nextApplicabilityOptions = getTemplateApplicabilityOptionSet({
    appliesToAllDisasters: templateData.applies_to_all_disasters !== false,
    disasterTypes: templateData.disaster_types,
  });

  const removedLockedOptions = usageSummary.locked_disaster_type_options.filter(
    (disasterTypeOption) =>
      currentApplicabilityOptions.has(disasterTypeOption) &&
      !nextApplicabilityOptions.has(disasterTypeOption),
  );

  if (removedLockedOptions.length > 0) {
    const error = new Error(
      `Cannot remove disaster applicability already used by this relief pack: ${removedLockedOptions.join(", ")}`,
    );
    error.statusCode = 409;
    throw error;
  }
};

const buildTemplatePersistencePayload = (templateData) => {
  const sectorIds = normalizeSectorIds(templateData.sector_ids, templateData.sector_id);
  const isAdditionalPack = Boolean(templateData.is_additional_pack);

  return {
    ...templateData,
    description: isAdditionalPack
      ? serializeSectorIdsDescription(sectorIds)
      : templateData.description,
    sector_id: isAdditionalPack ? sectorIds[0] ?? null : null,
    sector_ids: isAdditionalPack ? sectorIds : [],
  };
};

const getReliefPackTemplates = async (filters) => {
  let resolvedDisasterType = filters.disaster_type || null;

  if (!resolvedDisasterType && filters.disaster_event_id) {
    const disasterEvent = await disasterEventRepository.getDisasterEventById(
      filters.disaster_event_id,
    );

    if (!disasterEvent) {
      const error = new Error("Disaster event not found");
      error.statusCode = 404;
      throw error;
    }

    resolvedDisasterType = String(disasterEvent.disaster_type || "").trim() || null;
  }

  const templates = await reliefPackTemplateRepository.getReliefPackTemplates({
    ...filters,
    disaster_type: resolvedDisasterType,
  });

  return templates.map((template) => ({
    ...template,
    description: getPublicTemplateDescription(template),
    sector_ids: normalizeSectorIds(
      parseSectorIdsFromDescription(template.description),
      template.sector_id,
    ),
  }));
};

const getReliefPackTemplateById = async (id) => {
  const template = await reliefPackTemplateRepository.getReliefPackTemplateById(id);

  if (!template) {
    return null;
  }

  const items =
    await reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId(id);
  const disasterTypes =
    await reliefPackTemplateRepository.getReliefPackTemplateDisasterTypesByTemplateId(
      id,
    );
  const usageRows =
    await reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId(id);
  const sectorIds = normalizeSectorIds(
    parseSectorIdsFromDescription(template.description),
    template.sector_id,
  );

  return {
    ...template,
    description: getPublicTemplateDescription(template),
    items: mapTemplateItems(items),
    disaster_types: disasterTypes.map((row) => row.disaster_type),
    sector_ids: sectorIds,
    usage_summary: buildTemplateUsageSummary(usageRows),
  };
};

const createReliefPackTemplate = async (templateData) => {
  await ensureUniqueTemplateName(templateData.name);

  if (templateData.items.length > 0) {
    await validateTemplateItems(templateData.items);
  }

  const inactiveTemplate =
    await reliefPackTemplateRepository.getInactiveReliefPackTemplateByName(
      templateData.name,
    );
  const persistencePayload = buildTemplatePersistencePayload(templateData);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const createdTemplate = inactiveTemplate
      ? await reliefPackTemplateRepository.updateReliefPackTemplate(
          inactiveTemplate.id,
          {
            ...persistencePayload,
            is_active: true,
          },
          client,
        )
      : await reliefPackTemplateRepository.insertReliefPackTemplate(
          persistencePayload,
          client,
        );

    if (inactiveTemplate) {
      await reliefPackTemplateRepository.deleteReliefPackTemplateItemsByTemplateId(
        createdTemplate.id,
        client,
      );
      await reliefPackTemplateRepository.deleteReliefPackTemplateDisasterTypesByTemplateId(
        createdTemplate.id,
        client,
      );
    }

    for (const item of templateData.items) {
      await reliefPackTemplateRepository.insertReliefPackTemplateItem(
        {
          template_id: createdTemplate.id,
          inventory_item_id: item.inventory_item_id,
          quantity_required: item.quantity_required,
        },
        client,
      );
    }

    if (!templateData.applies_to_all_disasters) {
      for (const disasterType of normalizeDisasterTypes(templateData.disaster_types)) {
        await reliefPackTemplateRepository.insertReliefPackTemplateDisasterType(
          {
            template_id: createdTemplate.id,
            disaster_type: disasterType,
          },
          client,
        );
      }
    }

    await client.query("COMMIT");

    const sectorIds = normalizeSectorIds(
      persistencePayload.sector_ids,
      persistencePayload.sector_id,
    );

    return {
      id: createdTemplate.id,
      name: createdTemplate.name,
      description: getPublicTemplateDescription(createdTemplate),
      based_on_family_size: createdTemplate.based_on_family_size,
      based_on_sector: createdTemplate.based_on_sector,
      is_additional_pack: createdTemplate.is_additional_pack,
      sector_id: createdTemplate.sector_id,
      sector_ids: sectorIds,
      applies_to_all_disasters: createdTemplate.applies_to_all_disasters,
      is_active: createdTemplate.is_active,
      disaster_types: normalizeDisasterTypes(templateData.disaster_types),
      items_count: templateData.items.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updateReliefPackTemplate = async (id, templateData, actor = null) => {
  const existingTemplate =
    await reliefPackTemplateRepository.getReliefPackTemplateById(id);

  if (!existingTemplate) {
    const error = new Error("Relief pack template not found");
    error.statusCode = 404;
    throw error;
  }

  const previousTemplateDetails = await getReliefPackTemplateById(id);

  if (Array.isArray(templateData.items)) {
    await validateTemplateItems(templateData.items);
  }

  const existingItems =
    await reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId(id);
  const usageRows =
    await reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId(id);
  const usageSummary = buildTemplateUsageSummary(usageRows);
  const persistencePayload = buildTemplatePersistencePayload(templateData);

  validateTemplateUsageRules({
    existingTemplate,
    existingItems,
    templateData,
    persistencePayload,
    usageSummary,
  });

  await ensureUniqueTemplateName(templateData.name, id);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await reliefPackTemplateRepository.updateReliefPackTemplate(
      id,
      persistencePayload,
      client,
    );

    if (Array.isArray(templateData.items)) {
      await reliefPackTemplateRepository.deleteReliefPackTemplateItemsByTemplateId(
        id,
        client,
      );

      for (const item of templateData.items) {
        await reliefPackTemplateRepository.insertReliefPackTemplateItem(
          {
            template_id: id,
            inventory_item_id: item.inventory_item_id,
            quantity_required: item.quantity_required,
          },
          client,
        );
      }
    }

    await reliefPackTemplateRepository.deleteReliefPackTemplateDisasterTypesByTemplateId(
      id,
      client,
    );

    if (!templateData.applies_to_all_disasters) {
      for (const disasterType of normalizeDisasterTypes(templateData.disaster_types)) {
        await reliefPackTemplateRepository.insertReliefPackTemplateDisasterType(
          {
            template_id: id,
            disaster_type: disasterType,
          },
          client,
        );
      }
    }

    await client.query("COMMIT");

    const updatedTemplateDetails = await getReliefPackTemplateById(id);

    await logAuditSafely({
      actor,
      action: "RELIEF_PACK_TEMPLATE_UPDATED",
      entityType: "RELIEF_PACK_TEMPLATE",
      entityId: id,
      oldValues: buildTemplateAuditValues(previousTemplateDetails),
      newValues: buildTemplateAuditValues(updatedTemplateDetails),
    });

    return updatedTemplateDetails;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const replaceReliefPackTemplateItems = async (id, itemsPayload, actor = null) => {
  const existingTemplate =
    await reliefPackTemplateRepository.getReliefPackTemplateById(id);

  if (!existingTemplate) {
    const error = new Error("Relief pack template not found");
    error.statusCode = 404;
    throw error;
  }

  const previousTemplateDetails = await getReliefPackTemplateById(id);

  await validateTemplateItems(itemsPayload.items);

  const usageRows =
    await reliefPackTemplateRepository.getReliefPackTemplateUsageByTemplateId(id);
  const usageSummary = buildTemplateUsageSummary(usageRows);

  if (usageSummary.is_used) {
    const error = new Error(
      "This relief pack has distribution records, so its items cannot be changed",
    );
    error.statusCode = 409;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await reliefPackTemplateRepository.deleteReliefPackTemplateItemsByTemplateId(
      id,
      client,
    );

    for (const item of itemsPayload.items) {
      await reliefPackTemplateRepository.insertReliefPackTemplateItem(
        {
          template_id: id,
          inventory_item_id: item.inventory_item_id,
          quantity_required: item.quantity_required,
        },
        client,
      );
    }

    await client.query("COMMIT");

    const updatedTemplateDetails = await getReliefPackTemplateById(id);

    await logAuditSafely({
      actor,
      action: "RELIEF_PACK_TEMPLATE_ITEMS_UPDATED",
      entityType: "RELIEF_PACK_TEMPLATE",
      entityId: id,
      oldValues: buildTemplateAuditValues(previousTemplateDetails),
      newValues: buildTemplateAuditValues(updatedTemplateDetails),
    });

    return updatedTemplateDetails;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getReliefPackTemplates,
  getReliefPackTemplateById,
  createReliefPackTemplate,
  updateReliefPackTemplate,
  replaceReliefPackTemplateItems,
};
