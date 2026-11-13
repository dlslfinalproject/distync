const pool = require("../config/db");

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

const getReliefPackTemplates = async (filters) => {
  const values = [];
  const conditions = [];
  const includeItems = filters.include_items === true;

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
    const normalizedDisasterType = String(filters.disaster_type || "").trim();
    const matchesOtherGroup =
      normalizedDisasterType &&
      !STANDARD_DISASTER_TYPES.includes(normalizedDisasterType);

    values.push(normalizedDisasterType);
    conditions.push(`
      (
        rpt.applies_to_all_disasters = TRUE
        OR EXISTS (
          SELECT 1
          FROM relief_pack_template_disaster_types rptdt_filter
          WHERE rptdt_filter.template_id = rpt.id
            AND (
              rptdt_filter.disaster_type = $${values.length}
              ${matchesOtherGroup ? "OR rptdt_filter.disaster_type = 'Other'" : ""}
            )
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
      ) AS disaster_types${includeItems ? `,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', rpti.id,
              'inventory_item_id', rpti.inventory_item_id,
              'quantity_required', rpti.quantity_required,
              'created_at', rpti.created_at,
              'inventory_item', json_build_object(
                'id', ii.id,
                'item_code', ii.item_code,
                'item_name', ii.item_name,
                'category', ii.category,
                'unit_of_measure', ii.unit_of_measure,
                'barcode', ii.barcode,
                'is_perishable', ii.is_perishable
              )
            )
            ORDER BY ii.item_name ASC
          )
          FROM relief_pack_template_items rpti
          INNER JOIN inventory_items ii ON ii.id = rpti.inventory_item_id
          WHERE rpti.template_id = rpt.id
        ),
        '[]'::json
      ) AS items` : ""}
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
    WHERE LOWER(BTRIM(name)) = LOWER(BTRIM($1))
    ORDER BY is_active DESC, updated_at DESC
    LIMIT 1
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
    WHERE LOWER(BTRIM(name)) = LOWER(BTRIM($1))
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
      is_perishable
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
      ii.is_perishable
    FROM relief_pack_template_items rpti
    INNER JOIN inventory_items ii ON ii.id = rpti.inventory_item_id
    WHERE rpti.template_id = $1
    ORDER BY ii.item_name ASC
  `;

  const result = await pool.query(query, [templateId]);
  return result.rows;
};

const getReliefPackTemplateDemand = async (disasterEventIds = []) => {
  const query = `
    WITH selected_events AS (
      SELECT
        de.id,
        de.disaster_type
      FROM disaster_events de
      WHERE de.id = ANY($1::uuid[])
        AND de.status = 'ACTIVE'
    ),
    household_scope AS (
      SELECT
        h.id AS household_id,
        h.disaster_event_id,
        h.barangay_id,
        h.household_size,
        h.current_stay_type,
        h.is_active,
        h.family_head_evacuee_id,
        b.name AS barangay_name
      FROM households h
      INNER JOIN selected_events se ON se.id = h.disaster_event_id
      LEFT JOIN barangays b ON b.id = h.barangay_id
    ),
    family_head_evacuees AS (
      SELECT
        hs.household_id,
        COALESCE(
          hs.family_head_evacuee_id,
          (
            SELECT e.id
            FROM evacuees e
            WHERE e.household_id = hs.household_id
              AND e.is_family_head = TRUE
            ORDER BY e.created_at ASC
            LIMIT 1
          )
        ) AS family_head_evacuee_id
      FROM household_scope hs
    ),
    attendance_occurrences AS (
      SELECT
        hs.household_id,
        hs.disaster_event_id,
        el.status AS attendance_status,
        el.time_out AS attendance_time_out
      FROM household_scope hs
      INNER JOIN family_head_evacuees fhe
        ON fhe.household_id = hs.household_id
      INNER JOIN evacuation_logs el
        ON el.household_id = hs.household_id
        AND el.disaster_event_id = hs.disaster_event_id
        AND el.evacuee_id = fhe.family_head_evacuee_id
    ),
    latest_stubs AS (
      SELECT DISTINCT ON (s.household_id)
        s.household_id,
        s.status
      FROM stubs s
      WHERE s.household_id IN (
        SELECT DISTINCT hs.household_id
        FROM household_scope hs
      )
      ORDER BY s.household_id, s.issued_at DESC, s.updated_at DESC
    ),
    eligible_households AS (
      SELECT
        hs.household_id,
        hs.disaster_event_id,
        hs.barangay_id,
        COALESCE(hs.barangay_name, 'Unknown barangay') AS barangay_name,
        hs.household_size
      FROM household_scope hs
      INNER JOIN attendance_occurrences ao
        ON ao.household_id = hs.household_id
        AND ao.disaster_event_id = hs.disaster_event_id
      INNER JOIN latest_stubs ls ON ls.household_id = hs.household_id
      WHERE hs.is_active = TRUE
        AND UPPER(BTRIM(COALESCE(hs.current_stay_type, ''))) = 'EVAC_CENTER'
        AND ao.attendance_time_out IS NULL
        AND UPPER(BTRIM(COALESCE(ao.attendance_status, ''))) = 'PRESENT'
        AND UPPER(BTRIM(COALESCE(ls.status, ''))) = 'ISSUED'
    ),
    template_scope AS (
      SELECT
        rpt.id AS template_id,
        rpt.based_on_family_size,
        rpt.description,
        rpt.is_additional_pack,
        rpt.applies_to_all_disasters,
        COALESCE(
          ARRAY(
            SELECT sector_token.value::uuid
            FROM regexp_split_to_table(
              CASE
                WHEN LEFT(
                  COALESCE(rpt.description, ''),
                  char_length('__relief_pack_sector_ids__:')
                ) = '__relief_pack_sector_ids__:'
                THEN substring(
                  rpt.description
                  FROM char_length('__relief_pack_sector_ids__:') + 1
                )
                ELSE ''
              END,
              '[^0-9a-fA-F-]+'
            ) AS sector_token(value)
            WHERE sector_token.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          ),
          ARRAY[]::uuid[]
        ) || CASE
          WHEN rpt.sector_id IS NULL THEN ARRAY[]::uuid[]
          ELSE ARRAY[rpt.sector_id]
        END AS sector_ids
      FROM relief_pack_templates rpt
      WHERE rpt.is_active = TRUE
    ),
    demand_rows AS (
      SELECT
        ts.template_id,
        eh.disaster_event_id,
        eh.barangay_id,
        eh.barangay_name,
        CASE
          WHEN ts.based_on_family_size IS NOT TRUE THEN 1
          WHEN ts.description ~ '^[[:space:]]*[0-9]+[[:space:]]*$' THEN
            GREATEST(
              1,
              CEIL(
                GREATEST(1, COALESCE(eh.household_size, 1))::numeric /
                  BTRIM(ts.description)::numeric
              )
            )::integer
          ELSE 1
        END AS packs_needed
      FROM eligible_households eh
      INNER JOIN selected_events se ON se.id = eh.disaster_event_id
      CROSS JOIN template_scope ts
      WHERE BTRIM(COALESCE(se.disaster_type, '')) <> ''
        AND (
          ts.applies_to_all_disasters IS NOT FALSE
          OR EXISTS (
            SELECT 1
            FROM relief_pack_template_disaster_types rptdt
            WHERE rptdt.template_id = ts.template_id
              AND (
                BTRIM(rptdt.disaster_type) = BTRIM(se.disaster_type)
                OR (
                  BTRIM(rptdt.disaster_type) = 'Other'
                  AND BTRIM(se.disaster_type) NOT IN (
                    'Typhoon',
                    'Flood',
                    'Earthquake',
                    'Landslide',
                    'Volcanic Eruption',
                    'Storm Surge',
                    'Drought / El Niño',
                    'Tsunami',
                    'Fire'
                  )
                )
              )
          )
        )
      AND (
        ts.is_additional_pack IS NOT TRUE
        OR (
          cardinality(ts.sector_ids) > 0
          AND (
            EXISTS (
              SELECT 1
              FROM household_sectors hs
              WHERE hs.household_id = eh.household_id
                AND hs.sector_id = ANY(ts.sector_ids)
            )
            OR EXISTS (
              SELECT 1
              FROM evacuee_sectors es
              INNER JOIN evacuees e ON e.id = es.evacuee_id
              WHERE e.household_id = eh.household_id
                AND e.is_active = TRUE
                AND es.sector_id = ANY(ts.sector_ids)
            )
          )
        )
      )
    )
    SELECT
      template_id,
      disaster_event_id,
      barangay_id,
      barangay_name,
      COUNT(*)::integer AS families_count,
      SUM(packs_needed)::integer AS packs_needed
    FROM demand_rows
    GROUP BY
      template_id,
      disaster_event_id,
      barangay_id,
      barangay_name
    ORDER BY
      template_id,
      disaster_event_id,
      barangay_name ASC
  `;

  const result = await pool.query(query, [disasterEventIds]);
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

const updateReliefPackTemplateStatus = async (
  id,
  isActive,
  dbClient = pool,
) => {
  const query = `
    UPDATE relief_pack_templates
    SET is_active = $2,
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

  const result = await dbClient.query(query, [id, isActive]);
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

const getReliefPackTemplateUsageByTemplateId = async (templateId) => {
  const query = `
    SELECT
      de.disaster_type,
      de.status AS disaster_event_status,
      COUNT(dt.id) FILTER (
        WHERE dt.distribution_status = 'CLAIMED'
      )::integer AS distributions_count,
      COUNT(dt.id) FILTER (
        WHERE dt.distribution_status = 'CLAIMED'
          AND COALESCE(UPPER(de.status), '') <> 'CLOSED'
      )::integer AS active_event_distributions_count,
      COUNT(dt.id) FILTER (
        WHERE COALESCE(UPPER(dt.sync_status), 'SYNCED') <> 'SYNCED'
      )::integer AS unsynced_distributions_count,
      COUNT(dt.id) FILTER (
        WHERE (
          dt.distribution_status = 'CLAIMED'
          AND COALESCE(UPPER(de.status), '') <> 'CLOSED'
        )
        OR COALESCE(UPPER(dt.sync_status), 'SYNCED') <> 'SYNCED'
      )::integer AS edit_blocking_distributions_count
    FROM distribution_transactions dt
    INNER JOIN disaster_events de ON de.id = dt.disaster_event_id
    WHERE (
      dt.relief_pack_template_id = $1
      OR EXISTS (
        SELECT 1
        FROM distribution_transaction_relief_pack_templates dtrpt
        WHERE dtrpt.distribution_transaction_id = dt.id
          AND dtrpt.relief_pack_template_id = $1
      )
    )
    GROUP BY de.disaster_type, de.status
    ORDER BY de.disaster_type ASC
  `;

  const result = await pool.query(query, [templateId]);
  return result.rows;
};

const getReliefPackTemplateDeactivationBlockersByTemplateId = async (
  templateId,
  dbClient = pool,
) => {
  const query = `
    SELECT
      COUNT(*) FILTER (
        WHERE dt.distribution_status = 'CLAIMED'
          AND COALESCE(UPPER(de.status), '') <> 'CLOSED'
      )::integer AS active_event_distribution_count,
      COUNT(*) FILTER (
        WHERE COALESCE(UPPER(dt.sync_status), 'SYNCED') <> 'SYNCED'
      )::integer AS unsynced_distribution_count
    FROM distribution_transactions dt
    INNER JOIN disaster_events de ON de.id = dt.disaster_event_id
    WHERE (
      dt.relief_pack_template_id = $1
      OR EXISTS (
        SELECT 1
        FROM distribution_transaction_relief_pack_templates dtrpt
        WHERE dtrpt.distribution_transaction_id = dt.id
          AND dtrpt.relief_pack_template_id = $1
      )
    )
  `;

  const result = await dbClient.query(query, [templateId]);
  return (
    result.rows[0] || {
      active_event_distribution_count: 0,
      unsynced_distribution_count: 0,
    }
  );
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
  getReliefPackTemplateDemand,
  getReliefPackTemplateDisasterTypesByTemplateId,
  getReliefPackTemplateUsageByTemplateId,
  getReliefPackTemplateDeactivationBlockersByTemplateId,
  insertReliefPackTemplate,
  updateReliefPackTemplate,
  updateReliefPackTemplateStatus,
  deleteReliefPackTemplateItemsByTemplateId,
  deleteReliefPackTemplateDisasterTypesByTemplateId,
  insertReliefPackTemplateItem,
  insertReliefPackTemplateDisasterType,
};
