const pool = require("../config/db");

const getReliefPackTemplates = async (filters) => {
  const values = [];
  const conditions = [];

  if (filters.is_active !== null) {
    values.push(filters.is_active);
    conditions.push(`rpt.is_active = $${values.length}`);
  }

  if (filters.based_on_family_size !== null) {
    values.push(filters.based_on_family_size);
    conditions.push(`rpt.based_on_family_size = $${values.length}`);
  }

  if (filters.based_on_sector !== null) {
    values.push(filters.based_on_sector);
    conditions.push(`rpt.based_on_sector = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(
      `(rpt.name ILIKE $${values.length} OR rpt.description ILIKE $${values.length})`,
    );
  }

  if (filters.disaster_type) {
    values.push(filters.disaster_type);
    conditions.push(`
      (
        rpt.applies_to_all_disasters = TRUE
        OR EXISTS (
          SELECT 1
          FROM relief_pack_template_disaster_types rptdt_filter
          WHERE rptdt_filter.template_id = rpt.id
            AND rptdt_filter.disaster_type = $${values.length}
        )
      )
    `);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT
      rpt.id,
      rpt.name,
      rpt.description,
      rpt.based_on_family_size,
      rpt.based_on_sector,
      rpt.is_additional_pack,
      rpt.sector_id,
      rpt.applies_to_all_disasters,
      rpt.created_by,
      rpt.is_active,
      rpt.created_at,
      rpt.updated_at,
      COALESCE(
        array_remove(array_agg(DISTINCT rptdt.disaster_type), NULL),
        ARRAY[]::character varying[]
      ) AS disaster_types
    FROM relief_pack_templates rpt
    LEFT JOIN relief_pack_template_disaster_types rptdt
      ON rptdt.template_id = rpt.id
    ${whereClause}
    GROUP BY
      rpt.id,
      rpt.name,
      rpt.description,
      rpt.based_on_family_size,
      rpt.based_on_sector,
      rpt.is_additional_pack,
      rpt.sector_id,
      rpt.applies_to_all_disasters,
      rpt.created_by,
      rpt.is_active,
      rpt.created_at,
      rpt.updated_at
    ORDER BY rpt.name ASC
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
      is_additional_pack,
      sector_id,
      applies_to_all_disasters,
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
    WHERE LOWER(name) = LOWER($1)
      AND is_active = TRUE
  `;

  const result = await pool.query(query, [name]);
  return result.rows[0] || null;
};

const getInactiveReliefPackTemplateByName = async (name) => {
  const query = `
    SELECT
      id,
      name,
      description,
      based_on_family_size,
      based_on_sector,
      is_additional_pack,
      sector_id,
      applies_to_all_disasters,
      created_by,
      is_active,
      created_at,
      updated_at
    FROM relief_pack_templates
    WHERE LOWER(name) = LOWER($1)
      AND is_active = FALSE
    ORDER BY updated_at DESC
    LIMIT 1
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
      is_additional_pack,
      sector_id,
      applies_to_all_disasters,
      created_by,
      is_active,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    RETURNING
      id,
      name,
      description,
      based_on_family_size,
      based_on_sector,
      is_additional_pack,
      sector_id,
      applies_to_all_disasters,
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
    templateData.is_additional_pack,
    templateData.sector_id,
    templateData.applies_to_all_disasters,
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
        is_additional_pack = $6,
        sector_id = $7,
        applies_to_all_disasters = $8,
        is_active = $9,
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      name,
      description,
      based_on_family_size,
      based_on_sector,
      is_additional_pack,
      sector_id,
      applies_to_all_disasters,
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
    templateData.is_additional_pack,
    templateData.sector_id,
    templateData.applies_to_all_disasters,
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

const getReliefPackTemplateDisasterTypesByTemplateId = async (templateId) => {
  const query = `
    SELECT
      id,
      template_id,
      disaster_type,
      created_at
    FROM relief_pack_template_disaster_types
    WHERE template_id = $1
    ORDER BY disaster_type ASC
  `;

  const result = await pool.query(query, [templateId]);
  return result.rows;
};

const deleteReliefPackTemplateDisasterTypesByTemplateId = async (
  templateId,
  dbClient,
) => {
  const query = `
    DELETE FROM relief_pack_template_disaster_types
    WHERE template_id = $1
  `;

  await dbClient.query(query, [templateId]);
};

const insertReliefPackTemplateDisasterType = async (disasterTypeData, dbClient) => {
  const query = `
    INSERT INTO relief_pack_template_disaster_types (
      template_id,
      disaster_type,
      created_at
    )
    VALUES ($1, $2, NOW())
    RETURNING
      id,
      template_id,
      disaster_type,
      created_at
  `;

  const values = [
    disasterTypeData.template_id,
    disasterTypeData.disaster_type,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

module.exports = {
  getReliefPackTemplates,
  getReliefPackTemplateById,
  getReliefPackTemplateByName,
  getInactiveReliefPackTemplateByName,
  getInventoryItemById,
  getReliefPackTemplateItemsByTemplateId,
  getReliefPackTemplateDisasterTypesByTemplateId,
  insertReliefPackTemplate,
  updateReliefPackTemplate,
  deleteReliefPackTemplateItemsByTemplateId,
  deleteReliefPackTemplateDisasterTypesByTemplateId,
  insertReliefPackTemplateItem,
  insertReliefPackTemplateDisasterType,
};
