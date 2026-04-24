const pool = require("../config/db");

const getReliefPackTemplates = async (filters) => {
  const values = [];
  const conditions = [];

  if (filters.is_active !== null) {
    values.push(filters.is_active);
    conditions.push(`is_active = $${values.length}`);
  }

  if (filters.based_on_family_size !== null) {
    values.push(filters.based_on_family_size);
    conditions.push(`based_on_family_size = $${values.length}`);
  }

  if (filters.based_on_sector !== null) {
    values.push(filters.based_on_sector);
    conditions.push(`based_on_sector = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(
      `(name ILIKE $${values.length} OR description ILIKE $${values.length})`,
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT
      id,
      name,
      description,
      based_on_family_size,
      based_on_sector,
      created_by,
      is_active,
      created_at,
      updated_at
    FROM relief_pack_templates
    ${whereClause}
    ORDER BY name ASC
  `;

  const result = await pool.query(query, values);
  return result.rows;
};

const getReliefPackTemplateById = async (id) => {
  const query = `
    SELECT
      id,
      name,
      description,
      based_on_family_size,
      based_on_sector,
      created_by,
      is_active,
      created_at,
      updated_at
    FROM relief_pack_templates
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getReliefPackTemplateByName = async (name) => {
  const query = `
    SELECT
      id,
      name
    FROM relief_pack_templates
    WHERE name = $1
  `;

  const result = await pool.query(query, [name]);
  return result.rows[0] || null;
};

const getInventoryItemById = async (id) => {
  const query = `
    SELECT
      id,
      item_code,
      item_name,
      category,
      unit_of_measure,
      barcode,
      is_perishable,
      is_active
    FROM inventory_items
    WHERE id = $1
  `;

  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

const getReliefPackTemplateItemsByTemplateId = async (templateId) => {
  const query = `
    SELECT
      rpti.id,
      rpti.template_id,
      rpti.inventory_item_id,
      rpti.quantity_required,
      rpti.created_at,
      ii.item_code,
      ii.item_name,
      ii.category,
      ii.unit_of_measure,
      ii.barcode,
      ii.is_perishable,
      ii.is_active
    FROM relief_pack_template_items rpti
    INNER JOIN inventory_items ii ON ii.id = rpti.inventory_item_id
    WHERE rpti.template_id = $1
    ORDER BY ii.item_name ASC
  `;

  const result = await pool.query(query, [templateId]);
  return result.rows;
};

const insertReliefPackTemplate = async (templateData, dbClient) => {
  const query = `
    INSERT INTO relief_pack_templates (
      name,
      description,
      based_on_family_size,
      based_on_sector,
      created_by,
      is_active,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    RETURNING
      id,
      name,
      description,
      based_on_family_size,
      based_on_sector,
      created_by,
      is_active,
      created_at,
      updated_at
  `;

  const values = [
    templateData.name,
    templateData.description,
    templateData.based_on_family_size,
    templateData.based_on_sector,
    templateData.created_by,
    templateData.is_active,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const updateReliefPackTemplate = async (id, templateData, dbClient = pool) => {
  const query = `
    UPDATE relief_pack_templates
    SET name = $2,
        description = $3,
        based_on_family_size = $4,
        based_on_sector = $5,
        is_active = $6,
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      name,
      description,
      based_on_family_size,
      based_on_sector,
      created_by,
      is_active,
      created_at,
      updated_at
  `;

  const values = [
    id,
    templateData.name,
    templateData.description,
    templateData.based_on_family_size,
    templateData.based_on_sector,
    templateData.is_active,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0] || null;
};

const deleteReliefPackTemplateItemsByTemplateId = async (templateId, dbClient) => {
  const query = `
    DELETE FROM relief_pack_template_items
    WHERE template_id = $1
  `;

  await dbClient.query(query, [templateId]);
};

const insertReliefPackTemplateItem = async (itemData, dbClient) => {
  const query = `
    INSERT INTO relief_pack_template_items (
      template_id,
      inventory_item_id,
      quantity_required,
      created_at
    )
    VALUES ($1, $2, $3, NOW())
    RETURNING
      id,
      template_id,
      inventory_item_id,
      quantity_required,
      created_at
  `;

  const values = [
    itemData.template_id,
    itemData.inventory_item_id,
    itemData.quantity_required,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

module.exports = {
  getReliefPackTemplates,
  getReliefPackTemplateById,
  getReliefPackTemplateByName,
  getInventoryItemById,
  getReliefPackTemplateItemsByTemplateId,
  insertReliefPackTemplate,
  updateReliefPackTemplate,
  deleteReliefPackTemplateItemsByTemplateId,
  insertReliefPackTemplateItem,
};
