const pool = require("../config/db");
const reliefPackTemplateRepository = require("../repositories/reliefPackTemplate.repository");

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

const getReliefPackTemplates = async (filters) => {
  return reliefPackTemplateRepository.getReliefPackTemplates(filters);
};

const getReliefPackTemplateById = async (id) => {
  const template = await reliefPackTemplateRepository.getReliefPackTemplateById(id);

  if (!template) {
    return null;
  }

  const items =
    await reliefPackTemplateRepository.getReliefPackTemplateItemsByTemplateId(id);

  return {
    ...template,
    items: mapTemplateItems(items),
  };
};

const createReliefPackTemplate = async (templateData) => {
  await ensureUniqueTemplateName(templateData.name);

  if (templateData.items.length > 0) {
    await validateTemplateItems(templateData.items);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const createdTemplate =
      await reliefPackTemplateRepository.insertReliefPackTemplate(
        templateData,
        client,
      );

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

    await client.query("COMMIT");

    return {
      id: createdTemplate.id,
      name: createdTemplate.name,
      description: createdTemplate.description,
      based_on_family_size: createdTemplate.based_on_family_size,
      based_on_sector: createdTemplate.based_on_sector,
      is_active: createdTemplate.is_active,
      items_count: templateData.items.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updateReliefPackTemplate = async (id, templateData) => {
  const existingTemplate = await reliefPackTemplateRepository.getReliefPackTemplateById(
    id,
  );

  if (!existingTemplate) {
    const error = new Error("Relief pack template not found");
    error.statusCode = 404;
    throw error;
  }

  await ensureUniqueTemplateName(templateData.name, id);

  if (Array.isArray(templateData.items)) {
    await validateTemplateItems(templateData.items);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await reliefPackTemplateRepository.updateReliefPackTemplate(
      id,
      templateData,
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

    await client.query("COMMIT");

    return getReliefPackTemplateById(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const replaceReliefPackTemplateItems = async (id, itemsPayload) => {
  const existingTemplate = await reliefPackTemplateRepository.getReliefPackTemplateById(
    id,
  );

  if (!existingTemplate) {
    const error = new Error("Relief pack template not found");
    error.statusCode = 404;
    throw error;
  }

  await validateTemplateItems(itemsPayload.items);

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

    return getReliefPackTemplateById(id);
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
