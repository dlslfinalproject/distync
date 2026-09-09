const pool = require("../config/db");

const hasSchemaColumn = async (tableName, columnName, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS has_column
    `,
    [tableName, columnName],
  );

  return Boolean(result.rows[0]?.has_column);
};

const hasInventoryItemReorderLevelColumn = (dbClient = pool) =>
  hasSchemaColumn("inventory_items", "reorder_level", dbClient);

const hasInventoryItemIsActiveColumn = (dbClient = pool) =>
  hasSchemaColumn("inventory_items", "is_active", dbClient);

const hasInventoryBatchStockVersionColumn = (dbClient = pool) =>
  hasSchemaColumn("inventory_batches", "stock_version", dbClient);

const hasInventoryTransactionOtherStatusColumn = (dbClient = pool) =>
  hasSchemaColumn("inventory_transactions", "other_status", dbClient);

const hasInventoryTransactionReferenceNoColumn = (dbClient = pool) =>
  hasSchemaColumn(
    "inventory_transactions",
    "inventory_transaction_reference_no",
    dbClient,
  );

const hasDonationDonorNamePublicColumn = (dbClient = pool) =>
  hasSchemaColumn("donations", "donor_name_public", dbClient);

const donationNeedSelect = `
  SELECT
    dn.id,
    dn.disaster_event_id,
    dn.inventory_item_id,
    dn.quantity_needed,
    dn.priority_level,
    dn.notes,
    dn.is_active,
    dn.published_by,
    dn.published_at,
    dn.updated_at,
    de.event_code,
    de.title AS disaster_event_title,
    ii.item_code,
    ii.item_name,
    ii.category,
    ii.unit_of_measure,
    u.first_name AS published_by_first_name,
    u.last_name AS published_by_last_name
  FROM donation_needs dn
  INNER JOIN disaster_events de ON de.id = dn.disaster_event_id
  INNER JOIN inventory_items ii ON ii.id = dn.inventory_item_id
  LEFT JOIN users u ON u.id = dn.published_by
`;

const buildDonationSelect = (hasDonorNamePublicColumn) => `
  SELECT
    d.id,
    d.disaster_event_id,
    d.donor_name,
    ${hasDonorNamePublicColumn ? "d.donor_name_public" : "FALSE"} AS donor_name_public,
    d.donor_type,
    d.donor_type_other,
    d.contact_information,
    d.received_by,
    d.received_at,
    d.status,
    d.remarks,
    d.created_at,
    d.updated_at,
    de.event_code,
    de.title AS disaster_event_title,
    de.status AS disaster_event_status,
    u.first_name AS received_by_first_name,
    u.last_name AS received_by_last_name
  FROM donations d
  INNER JOIN disaster_events de ON de.id = d.disaster_event_id
  LEFT JOIN users u ON u.id = d.received_by
`;

const buildDonationItemSelect = (
  hasReorderLevelColumn,
  hasStockVersionColumn,
) => `
  SELECT
    di.id,
    di.donation_id,
    di.inventory_item_id,
    di.inventory_batch_id,
    di.quantity_received,
    di.remarks,
    di.created_at,
    di.updated_at,
    ii.item_code,
    ii.item_name,
    ii.category,
    ii.unit_of_measure,
    ${hasReorderLevelColumn ? "ii.reorder_level" : "NULL::integer"} AS reorder_level,
    CAST(COALESCE((
      SELECT SUM(COALESCE(item_stock.quantity_available, 0))
      FROM inventory_batches item_stock
      WHERE item_stock.inventory_item_id = di.inventory_item_id
    ), 0) AS integer) AS item_total_stock,
    ib.inventory_item_stock_form_id,
    ib.batch_no,
    ib.source_type,
    ib.quantity_available,
    ${hasStockVersionColumn ? "ib.stock_version" : "NULL::integer"} AS stock_version,
    ib.expiration_date,
    ib.storage_location,
    stock_forms.barcode AS stock_form_barcode,
    stock_forms.packaging AS stock_form_packaging,
    stock_forms.units_per_packaging AS stock_form_units_per_packaging,
    stock_forms.unit_of_measure AS stock_form_unit_of_measure,
    stock_forms.unit_of_measure_value AS stock_form_unit_of_measure_value
  FROM donation_items di
  INNER JOIN inventory_items ii ON ii.id = di.inventory_item_id
  LEFT JOIN inventory_batches ib ON ib.id = di.inventory_batch_id
  LEFT JOIN inventory_item_stock_forms stock_forms
    ON stock_forms.id = ib.inventory_item_stock_form_id
`;

const normalizeDisasterEventFilter = (disasterEventId) => {
  if (Array.isArray(disasterEventId)) {
    return disasterEventId.filter(Boolean);
  }

  return disasterEventId ? [disasterEventId] : [];
};

const getDisasterEventById = async (id, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT id, event_code, title, status
      FROM disaster_events
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] || null;
};

const getInventoryItemById = async (id, dbClient = pool) => {
  const [hasReorderLevelColumn, hasIsActiveColumn] = await Promise.all([
    hasInventoryItemReorderLevelColumn(dbClient),
    hasInventoryItemIsActiveColumn(dbClient),
  ]);
  const result = await dbClient.query(
    `
      SELECT
        id,
        item_code,
        item_name,
        category,
        unit_of_measure,
        unit_of_measure_value,
        packaging,
        packaging_count,
        quantity,
        ${hasReorderLevelColumn ? "reorder_level" : "NULL::integer AS reorder_level"},
        ${hasIsActiveColumn ? "is_active" : "TRUE AS is_active"},
        is_perishable
      FROM inventory_items
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] || null;
};

const getInventoryItemByIdForUpdate = async (id, dbClient = pool) => {
  const [hasReorderLevelColumn, hasIsActiveColumn] = await Promise.all([
    hasInventoryItemReorderLevelColumn(dbClient),
    hasInventoryItemIsActiveColumn(dbClient),
  ]);
  const result = await dbClient.query(
    `
      SELECT
        id,
        item_code,
        item_name,
        category,
        unit_of_measure,
        unit_of_measure_value,
        packaging,
        packaging_count,
        quantity,
        ${hasReorderLevelColumn ? "reorder_level" : "NULL::integer AS reorder_level"},
        ${hasIsActiveColumn ? "is_active" : "TRUE AS is_active"},
        is_perishable
      FROM inventory_items
      WHERE id = $1
      FOR UPDATE
    `,
    [id],
  );

  return result.rows[0] || null;
};

const getInventoryItemByName = async (itemName, dbClient = pool) => {
  const [hasReorderLevelColumn, hasIsActiveColumn] = await Promise.all([
    hasInventoryItemReorderLevelColumn(dbClient),
    hasInventoryItemIsActiveColumn(dbClient),
  ]);
  const result = await dbClient.query(
    `
      SELECT
        id,
        item_code,
        item_name,
        category,
        unit_of_measure,
        unit_of_measure_value,
        packaging,
        packaging_count,
        quantity,
        ${hasReorderLevelColumn ? "reorder_level" : "NULL::integer AS reorder_level"},
        ${hasIsActiveColumn ? "is_active" : "TRUE AS is_active"},
        is_perishable
      FROM inventory_items
      WHERE LOWER(BTRIM(item_name)) = LOWER(BTRIM($1))
      ORDER BY
        ${hasIsActiveColumn ? "is_active DESC," : ""}
        created_at ASC,
        id ASC
      LIMIT 1
    `,
    [itemName],
  );

  return result.rows[0] || null;
};

const getUserById = async (id, dbClient = pool) => {
  const result = await dbClient.query(
    `
      SELECT id, first_name, last_name, is_active
      FROM users
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] || null;
};

const getDonationNeeds = async (filters = {}, dbClient = pool) => {
  const values = [];
  const conditions = [];

  if (filters.disaster_event_id) {
    values.push(filters.disaster_event_id);
    conditions.push(`dn.disaster_event_id = $${values.length}`);
  }

  if (filters.inventory_item_id) {
    values.push(filters.inventory_item_id);
    conditions.push(`dn.inventory_item_id = $${values.length}`);
  }

  if (filters.is_active !== null && filters.is_active !== undefined) {
    values.push(filters.is_active);
    conditions.push(`dn.is_active = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(
      `(ii.item_name ILIKE $${values.length} OR ii.item_code ILIKE $${values.length} OR de.title ILIKE $${values.length} OR de.event_code ILIKE $${values.length})`,
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await dbClient.query(
    `
      ${donationNeedSelect}
      ${whereClause}
      ORDER BY
        dn.is_active DESC,
        CASE dn.priority_level
          WHEN 'URGENT' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          ELSE 4
        END,
        ii.item_name ASC
    `,
    values,
  );

  return result.rows;
};

const getDonationNeedById = async (id, dbClient = pool) => {
  const result = await dbClient.query(
    `
      ${donationNeedSelect}
      WHERE dn.id = $1
    `,
    [id],
  );

  return result.rows[0] || null;
};

const insertDonationNeed = async (payload, dbClient) => {
  const result = await dbClient.query(
    `
      INSERT INTO donation_needs (
        disaster_event_id,
        inventory_item_id,
        quantity_needed,
        priority_level,
        notes,
        is_active,
        published_by,
        published_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING id
    `,
    [
      payload.disaster_event_id,
      payload.inventory_item_id,
      payload.quantity_needed,
      payload.priority_level,
      payload.notes,
      payload.is_active,
      payload.published_by,
    ],
  );

  return result.rows[0];
};

const updateDonationNeed = async (id, payload, dbClient) => {
  const result = await dbClient.query(
    `
      UPDATE donation_needs
      SET disaster_event_id = $2,
          inventory_item_id = $3,
          quantity_needed = $4,
          priority_level = $5,
          notes = $6,
          is_active = $7,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [
      id,
      payload.disaster_event_id,
      payload.inventory_item_id,
      payload.quantity_needed,
      payload.priority_level,
      payload.notes,
      payload.is_active,
    ],
  );

  return result.rows[0] || null;
};

const deleteDonationNeed = async (id, dbClient) => {
  const result = await dbClient.query(
    `
      DELETE FROM donation_needs
      WHERE id = $1
      RETURNING id
    `,
    [id],
  );

  return result.rows[0] || null;
};

const getDonations = async (filters = {}, dbClient = pool) => {
  const values = [];
  const conditions = [];
  const hasDonorNamePublicColumn = await hasDonationDonorNamePublicColumn(
    dbClient,
  );

  if (filters.disaster_event_id) {
    values.push(filters.disaster_event_id);
    conditions.push(`d.disaster_event_id = $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`d.status = $${values.length}`);
  }

  if (filters.donor_type) {
    values.push(filters.donor_type);
    conditions.push(`d.donor_type = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(
      `(d.donor_name ILIKE $${values.length} OR d.donor_type_other ILIKE $${values.length} OR d.contact_information ILIKE $${values.length} OR de.title ILIKE $${values.length} OR de.event_code ILIKE $${values.length})`,
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await dbClient.query(
    `
      ${buildDonationSelect(hasDonorNamePublicColumn)}
      ${whereClause}
      ORDER BY d.received_at DESC, d.created_at DESC
    `,
    values,
  );

  return result.rows;
};

const getDonationById = async (id, dbClient = pool) => {
  const hasDonorNamePublicColumn = await hasDonationDonorNamePublicColumn(
    dbClient,
  );
  const result = await dbClient.query(
    `
      ${buildDonationSelect(hasDonorNamePublicColumn)}
      WHERE d.id = $1
    `,
    [id],
  );

  return result.rows[0] || null;
};

const getDonationByIdForUpdate = async (id, dbClient) => {
  const hasDonorNamePublicColumn = await hasDonationDonorNamePublicColumn(
    dbClient,
  );
  const result = await dbClient.query(
    `
      SELECT
        id,
        disaster_event_id,
        donor_name,
        ${hasDonorNamePublicColumn ? "donor_name_public" : "FALSE"} AS donor_name_public,
        donor_type,
        donor_type_other,
        contact_information,
        received_by,
        received_at,
        status,
        remarks
      FROM donations
      WHERE id = $1
      FOR UPDATE
    `,
    [id],
  );

  return result.rows[0] || null;
};

const getDonationItemsByDonationId = async (donationId, dbClient = pool) => {
  const [hasReorderLevelColumn, hasStockVersionColumn] = await Promise.all([
    hasInventoryItemReorderLevelColumn(dbClient),
    hasInventoryBatchStockVersionColumn(dbClient),
  ]);
  const result = await dbClient.query(
    `
      ${buildDonationItemSelect(hasReorderLevelColumn, hasStockVersionColumn)}
      WHERE di.donation_id = $1
      ORDER BY di.created_at ASC, ii.item_name ASC
    `,
    [donationId],
  );

  return result.rows;
};

const getDonationItemById = async (id, dbClient = pool) => {
  const [hasReorderLevelColumn, hasStockVersionColumn] = await Promise.all([
    hasInventoryItemReorderLevelColumn(dbClient),
    hasInventoryBatchStockVersionColumn(dbClient),
  ]);
  const result = await dbClient.query(
    `
      ${buildDonationItemSelect(hasReorderLevelColumn, hasStockVersionColumn)}
      WHERE di.id = $1
    `,
    [id],
  );

  return result.rows[0] || null;
};

const getDonationItemByIdForUpdate = async (id, dbClient) => {
  const result = await dbClient.query(
    `
      SELECT
        di.id,
        di.donation_id,
        di.inventory_item_id,
        di.inventory_batch_id,
        di.quantity_received,
        di.remarks
      FROM donation_items di
      WHERE di.id = $1
      FOR UPDATE
    `,
    [id],
  );

  return result.rows[0] || null;
};

const insertDonation = async (payload, dbClient) => {
  const result = await dbClient.query(
    `
      INSERT INTO donations (
        disaster_event_id,
        donor_name,
        donor_type,
        donor_type_other,
        contact_information,
        received_by,
        received_at,
        status,
        remarks,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, NOW()), $8, $9, NOW(), NOW())
      RETURNING id
    `,
    [
      payload.disaster_event_id,
      payload.donor_name,
      payload.donor_type,
      payload.donor_type_other,
      payload.contact_information,
      payload.received_by,
      payload.received_at,
      payload.status,
      payload.remarks,
    ],
  );

  return result.rows[0];
};

const updateDonation = async (id, payload, dbClient) => {
  const result = await dbClient.query(
    `
      UPDATE donations
      SET disaster_event_id = $2,
          donor_name = $3,
          donor_type = $4,
          donor_type_other = $5,
          contact_information = $6,
          received_at = COALESCE($7, received_at),
          status = $8,
          remarks = $9,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [
      id,
      payload.disaster_event_id,
      payload.donor_name,
      payload.donor_type,
      payload.donor_type_other,
      payload.contact_information,
      payload.received_at,
      payload.status,
      payload.remarks,
    ],
  );

  return result.rows[0] || null;
};

const updateDonationPublicName = async (
  id,
  donorNamePublic,
  dbClient,
) => {
  const hasDonorNamePublicColumn = await hasDonationDonorNamePublicColumn(
    dbClient,
  );

  if (!hasDonorNamePublicColumn) {
    const error = new Error(
      "Donor name visibility is unavailable until the donor_name_public migration is applied.",
    );
    error.code = "DONATION_PUBLIC_NAME_COLUMN_MISSING";
    error.statusCode = 503;
    throw error;
  }

  const result = await dbClient.query(
    `
      UPDATE donations
      SET donor_name_public = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, donor_name_public
    `,
    [id, donorNamePublic],
  );

  return result.rows[0] || null;
};

const renameDonorAcrossDonations = async (
  { previousDonorName, nextDonorName, donorType, donorTypeOther },
  dbClient,
) => {
  const result = await dbClient.query(
    `
      UPDATE donations
      SET donor_name = $2,
          updated_at = NOW()
      WHERE LOWER(BTRIM(donor_name)) = LOWER(BTRIM($1))
        AND donor_type = $3
        AND COALESCE(donor_type_other, '') = COALESCE($4, '')
      RETURNING id, disaster_event_id, received_at
    `,
    [
      previousDonorName,
      nextDonorName,
      donorType,
      donorTypeOther,
    ],
  );

  return result.rows;
};

const deleteDonation = async (id, dbClient) => {
  const result = await dbClient.query(
    `
      DELETE FROM donations
      WHERE id = $1
      RETURNING id
    `,
    [id],
  );

  return result.rows[0] || null;
};

const insertDonationItem = async (payload, dbClient) => {
  const result = await dbClient.query(
    `
      INSERT INTO donation_items (
        donation_id,
        inventory_item_id,
        inventory_batch_id,
        quantity_received,
        remarks,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id
    `,
    [
      payload.donation_id,
      payload.inventory_item_id,
      payload.inventory_batch_id,
      payload.quantity_received,
      payload.remarks,
    ],
  );

  return result.rows[0];
};

const updateDonationItem = async (id, payload, dbClient) => {
  const result = await dbClient.query(
    `
      UPDATE donation_items
      SET quantity_received = $2,
          remarks = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [id, payload.quantity_received, payload.remarks],
  );

  return result.rows[0] || null;
};

const syncDonationInventoryTransactions = async (
  donationId,
  { disaster_event_id, received_at },
  dbClient,
) => {
  await dbClient.query(
    `
      UPDATE inventory_transactions it
      SET disaster_event_id = $2
      FROM donation_items di
      WHERE di.id = it.reference_id
        AND it.reference_type = 'DONATION'
        AND di.donation_id = $1
    `,
    [donationId, disaster_event_id],
  );

  if (received_at) {
    await dbClient.query(
      `
        WITH ranked_transactions AS (
          SELECT
            it.id,
            ROW_NUMBER() OVER (
              PARTITION BY it.reference_id
              ORDER BY it.performed_at ASC, it.created_at ASC, it.id ASC
            ) AS row_rank
          FROM inventory_transactions it
          INNER JOIN donation_items di ON di.id = it.reference_id
          WHERE it.reference_type = 'DONATION'
            AND di.donation_id = $1
        )
        UPDATE inventory_transactions it
        SET performed_at = $2
        FROM ranked_transactions ranked
        WHERE ranked.id = it.id
          AND ranked.row_rank = 1
      `,
      [donationId, received_at],
    );
  }

  await dbClient.query(
    `
      WITH donation_source AS (
        SELECT id, donor_name
        FROM donations
        WHERE id = $1
      ),
      ranked_transactions AS (
        SELECT
          it.id,
          it.transaction_type,
          ii.item_name,
          ds.donor_name,
          ROW_NUMBER() OVER (
            PARTITION BY it.reference_id
            ORDER BY it.performed_at ASC, it.created_at ASC, it.id ASC
          ) AS row_rank
        FROM inventory_transactions it
        INNER JOIN donation_items di ON di.id = it.reference_id
        INNER JOIN inventory_batches ib ON ib.id = it.inventory_batch_id
        INNER JOIN inventory_items ii ON ii.id = ib.inventory_item_id
        INNER JOIN donation_source ds ON ds.id = di.donation_id
        WHERE it.reference_type = 'DONATION'
          AND di.donation_id = $1
      )
      UPDATE inventory_transactions it
      SET remarks = CASE
        WHEN ranked.transaction_type = 'INFLOW' AND ranked.row_rank = 1
          THEN CONCAT('Received donation stock for ', ranked.item_name, ' from ', COALESCE(ranked.donor_name, 'Unknown donor'))
        WHEN ranked.transaction_type = 'INFLOW'
          THEN CONCAT('Adjusted up donation stock for ', ranked.item_name, ' from ', COALESCE(ranked.donor_name, 'Unknown donor'))
        WHEN ranked.transaction_type = 'OUTFLOW'
          THEN CONCAT('Adjusted down donation stock for ', ranked.item_name, ' from ', COALESCE(ranked.donor_name, 'Unknown donor'))
          ELSE CONCAT('Updated donation stock for ', ranked.item_name, ' from ', COALESCE(ranked.donor_name, 'Unknown donor'))
      END
      FROM ranked_transactions ranked
      WHERE ranked.id = it.id
    `,
    [donationId],
  );
};

const deleteDonationItem = async (id, dbClient) => {
  const result = await dbClient.query(
    `
      DELETE FROM donation_items
      WHERE id = $1
      RETURNING id
    `,
    [id],
  );

  return result.rows[0] || null;
};

const getInventoryBatchByIdForUpdate = async (id, dbClient) => {
  const result = await dbClient.query(
    `
      SELECT
        id,
        inventory_item_id,
        inventory_item_stock_form_id,
        batch_no,
        source_type,
        quantity_received,
        quantity_available,
        CAST(COALESCE((
          SELECT SUM(COALESCE(item_stock.quantity_available, 0))
          FROM inventory_batches item_stock
          WHERE item_stock.inventory_item_id = inventory_batches.inventory_item_id
        ), 0) AS integer) AS item_total_stock,
        expiration_date,
        received_at,
        storage_location,
        status
      FROM inventory_batches
      WHERE id = $1
      FOR UPDATE
    `,
    [id],
  );

  return result.rows[0] || null;
};

const insertInventoryBatch = async (payload, dbClient) => {
  const result = await dbClient.query(
    `
      INSERT INTO inventory_batches (
        inventory_item_id,
        batch_no,
        source_type,
        quantity_received,
        quantity_available,
        expiration_date,
        received_at,
        storage_location,
        status,
        created_by,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, NOW()), $8, $9, $10, NOW(), NOW())
      RETURNING id
    `,
    [
      payload.inventory_item_id,
      payload.batch_no,
      payload.source_type,
      payload.quantity_received,
      payload.quantity_available,
      payload.expiration_date,
      payload.received_at,
      payload.storage_location,
      payload.status,
      payload.created_by,
    ],
  );

  return result.rows[0];
};

const updateInventoryBatchStock = async (
  batchId,
  payload,
  dbClient,
) => {
  const result = await dbClient.query(
    `
      UPDATE inventory_batches
      SET quantity_received = $2,
          quantity_available = $3,
          expiration_date = $4,
          storage_location = $5,
          status = $6,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [
      batchId,
      payload.quantity_received,
      payload.quantity_available,
      payload.expiration_date,
      payload.storage_location,
      payload.status,
    ],
  );

  return result.rows[0] || null;
};

const insertInventoryTransaction = async (payload, dbClient) => {
  const hasReferenceNoColumn =
    await hasInventoryTransactionReferenceNoColumn(dbClient);
  const result = await dbClient.query(
    `
      INSERT INTO inventory_transactions (
        disaster_event_id,
        inventory_batch_id,
        transaction_type,
        quantity,
        reference_type,
        reference_id,
        performed_by,
        performed_at,
        remarks,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, NOW())
      RETURNING
        id,
        ${
          hasReferenceNoColumn
            ? "inventory_transaction_reference_no"
            : "NULL::text AS inventory_transaction_reference_no"
        }
    `,
    [
      payload.disaster_event_id,
      payload.inventory_batch_id,
      payload.transaction_type,
      payload.quantity,
      payload.reference_type,
      payload.reference_id,
      payload.performed_by,
      payload.remarks,
    ],
  );

  return result.rows[0];
};

const getDefaultEmergencyDonationNeeds = async (
  disasterTypes = [],
  dbClient = pool,
) => {
  const normalizedDisasterTypes = [...new Set(
    (disasterTypes || [])
      .map((disasterType) => String(disasterType || "").trim())
      .filter(Boolean),
  )];
  const values = [];
  const conditions = ["dedn.is_active = TRUE"];

  if (normalizedDisasterTypes.length > 0) {
    values.push(normalizedDisasterTypes);
    conditions.push(
      `(dedn.disaster_type IS NULL OR dedn.disaster_type = ANY($${values.length}::text[]))`,
    );
  } else {
    conditions.push("dedn.disaster_type IS NULL");
  }

  const result = await dbClient.query(
    `
      SELECT
        dedn.id,
        dedn.inventory_item_id,
        COALESCE(ii.item_name, dedn.item_name) AS item_name,
        COALESCE(ii.category, dedn.category) AS category,
        COALESCE(ii.unit_of_measure, dedn.unit_of_measure) AS unit_of_measure,
        dedn.suggested_quantity,
        dedn.priority_level,
        dedn.notes,
        dedn.disaster_type,
        dedn.display_order,
        dedn.updated_at
      FROM default_emergency_donation_needs dedn
      LEFT JOIN inventory_items ii
        ON ii.id = dedn.inventory_item_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        CASE WHEN dedn.disaster_type IS NULL THEN 1 ELSE 0 END,
        dedn.display_order ASC,
        COALESCE(ii.item_name, dedn.item_name) ASC
    `,
    values,
  );

  return result.rows;
};

const getPublicDonationDisasterSummaries = async (
  disasterEventId,
  dbClient = pool,
) => {
  const values = [];
  const conditions = [
    `UPPER(de.status) IN ('ACTIVE', 'ONGOING')`,
  ];

  if (disasterEventId) {
    values.push(disasterEventId);
    conditions.push(`de.id = $${values.length}`);
  }

  const result = await dbClient.query(
    `
      SELECT
        de.id,
        de.event_code,
        de.title,
        de.disaster_type,
        de.description,
        de.start_date,
        de.end_date,
        de.status,
        de.created_at,
        GREATEST(
          COALESCE(de.updated_at, de.created_at),
          COALESCE(activity_summary.latest_activity_at, de.created_at)
        ) AS updated_at,
        COALESCE(affected_barangays.affected_barangays, '[]'::json) AS affected_barangays,
        COALESCE(barangay_summary.affected_barangays_count, 0)::int AS affected_barangays_count,
        COALESCE(household_summary.registered_households_count, 0)::int AS registered_households_count,
        COALESCE(eligible_household_summary.eligible_unclaimed_households_count, 0)::int AS eligible_unclaimed_households_count,
        COALESCE(individual_summary.affected_individuals_count, 0)::int AS affected_individuals_count
      FROM disaster_events de
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', barangay_rows.id,
              'name', barangay_rows.name
            )
            ORDER BY barangay_rows.name
          ),
          '[]'::json
        ) AS affected_barangays
        FROM (
          SELECT DISTINCT b.id, b.name
          FROM disaster_event_barangays deb
          INNER JOIN barangays b ON b.id = deb.barangay_id
          WHERE deb.disaster_event_id = de.id
            AND b.is_active = TRUE
        ) barangay_rows
      ) affected_barangays ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT deb.barangay_id)::int AS affected_barangays_count
        FROM disaster_event_barangays deb
        INNER JOIN barangays b ON b.id = deb.barangay_id
        WHERE deb.disaster_event_id = de.id
          AND b.is_active = TRUE
      ) barangay_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT h.id)::int AS registered_households_count
        FROM households h
        WHERE h.disaster_event_id = de.id
          AND h.current_stay_type = 'EVAC_CENTER'
          AND h.is_active = TRUE
      ) household_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT h.id)::int AS eligible_unclaimed_households_count
        FROM stubs s
        INNER JOIN households h ON h.id = s.household_id
        INNER JOIN LATERAL (
          SELECT el.status, el.time_in, el.time_out
          FROM evacuation_logs el
          WHERE el.household_id = h.id
            AND el.disaster_event_id = s.disaster_event_id
          ORDER BY
            COALESCE(el.time_out, el.time_in) DESC,
            el.updated_at DESC,
            el.created_at DESC
          LIMIT 1
        ) latest_attendance ON TRUE
        WHERE s.disaster_event_id = de.id
          AND s.status = 'ISSUED'
          AND h.current_stay_type = 'EVAC_CENTER'
          AND h.is_active = TRUE
          AND latest_attendance.status = 'PRESENT'
          AND latest_attendance.time_out IS NULL
      ) eligible_household_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT e.id)::int AS affected_individuals_count
        FROM households h
        INNER JOIN evacuees e ON e.household_id = h.id
        WHERE h.disaster_event_id = de.id
          AND h.current_stay_type = 'EVAC_CENTER'
          AND h.is_active = TRUE
          AND e.is_active = TRUE
      ) individual_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT MAX(activity_at) AS latest_activity_at
        FROM (
          SELECT deb.created_at AS activity_at
          FROM disaster_event_barangays deb
          WHERE deb.disaster_event_id = de.id

          UNION ALL

          SELECT h.registered_at AS activity_at
          FROM households h
          WHERE h.disaster_event_id = de.id

          UNION ALL

          SELECT h.updated_at AS activity_at
          FROM households h
          WHERE h.disaster_event_id = de.id

          UNION ALL

          SELECT e.updated_at AS activity_at
          FROM households h
          INNER JOIN evacuees e ON e.household_id = h.id
          WHERE h.disaster_event_id = de.id

          UNION ALL

          SELECT el.updated_at AS activity_at
          FROM evacuation_logs el
          WHERE el.disaster_event_id = de.id

          UNION ALL

          SELECT s.updated_at AS activity_at
          FROM stubs s
          WHERE s.disaster_event_id = de.id

          UNION ALL

          SELECT dt.updated_at AS activity_at
          FROM distribution_transactions dt
          WHERE dt.disaster_event_id = de.id
        ) activities
      ) activity_summary ON TRUE
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        de.start_date DESC NULLS LAST,
        GREATEST(
          COALESCE(de.updated_at, de.created_at),
          COALESCE(activity_summary.latest_activity_at, de.created_at),
          de.created_at
        ) DESC,
        de.created_at DESC
    `,
    values,
  );

  return result.rows;
};

const getPublicForecastSuggestions = async (disasterEventId, dbClient = pool) => {
  if (!disasterEventId) {
    return [];
  }

  const result = await dbClient.query(
    `
      WITH latest_run AS (
        SELECT id, disaster_event_id, run_at
        FROM forecast_runs
        WHERE disaster_event_id = $1
        ORDER BY run_at DESC, id DESC
        LIMIT 1
      ),
      latest_results AS (
        SELECT DISTINCT ON (fr.inventory_item_id)
          fr.id,
          fr.inventory_item_id,
          fr.predicted_quantity_needed,
          fr.predicted_depletion_date,
          fr.recommended_reorder_quantity,
          fr.confidence_notes,
          fr.created_at,
          lr.id AS forecast_run_id,
          lr.run_at,
          ii.item_name,
          ii.item_code,
          ii.category,
          ii.unit_of_measure
        FROM latest_run lr
        INNER JOIN forecast_results fr ON fr.forecast_run_id = lr.id
        INNER JOIN inventory_items ii ON ii.id = fr.inventory_item_id
        ORDER BY fr.inventory_item_id, fr.created_at DESC, fr.id DESC
      )
      SELECT *
      FROM latest_results
      ORDER BY recommended_reorder_quantity DESC NULLS LAST, item_name ASC
    `,
    [disasterEventId],
  );

  return result.rows;
};

const getPublicRecentDonationSummaries = async (
  disasterEventId,
  limit = 6,
  dbClient = pool,
) => {
  const disasterEventIds = normalizeDisasterEventFilter(disasterEventId);

  if (disasterEventIds.length === 0) {
    return [];
  }

  const hasDonorNamePublicColumn = await hasDonationDonorNamePublicColumn(
    dbClient,
  );
  const values = [disasterEventIds, limit];

  const result = await dbClient.query(
    `
      WITH donor_groups AS (
        SELECT
          MIN(d.id::text) AS donor_group_key,
          LOWER(BTRIM(d.donor_name)) AS normalized_donor_name,
          MIN(d.donor_name) AS donor_name,
          ${hasDonorNamePublicColumn
            ? "BOOL_OR(COALESCE(d.donor_name_public, FALSE))"
            : "FALSE"} AS donor_name_public,
          d.donor_type,
          d.donor_type_other,
          d.disaster_event_id,
          de.title AS disaster_event_title,
          MAX(d.received_at) AS latest_received_at,
          MAX(d.created_at) AS latest_created_at,
          MAX(d.updated_at) AS latest_updated_at,
          COUNT(DISTINCT d.id)::int AS donation_count,
          CASE
            WHEN BOOL_OR(d.status = 'DISTRIBUTED') THEN 'DISTRIBUTED'
            WHEN BOOL_OR(d.status = 'PARTIALLY_DISTRIBUTED') THEN 'PARTIALLY_DISTRIBUTED'
            ELSE 'RECEIVED'
          END AS status
        FROM donations d
        INNER JOIN disaster_events de ON de.id = d.disaster_event_id
        WHERE d.disaster_event_id = ANY($1::uuid[])
          AND d.status <> 'CANCELLED'
        GROUP BY
          LOWER(BTRIM(d.donor_name)),
          d.donor_type,
          d.donor_type_other,
          d.disaster_event_id,
          de.title
      )
      SELECT
        MD5(CONCAT_WS(':', donor_groups.donor_group_key, donor_groups.disaster_event_id::text)) AS public_key,
        CASE
          WHEN donor_groups.donor_name_public THEN donor_groups.donor_name
          ELSE NULL
        END AS donor_name,
        donor_groups.donor_name_public,
        donor_groups.donor_type,
        donor_groups.donor_type_other,
        donor_groups.disaster_event_id,
        donor_groups.disaster_event_title,
        donor_groups.latest_received_at AS received_at,
        donor_groups.latest_updated_at AS updated_at,
        donor_groups.status,
        donor_groups.donation_count,
        COALESCE(item_summary.total_quantity_received, 0)::int AS total_quantity_received,
        COALESCE(item_summary.total_loose_items_received, 0)::int AS total_loose_items_received,
        COALESCE(item_summary.total_relief_packs_received, 0)::int AS total_relief_packs_received,
        COALESCE(item_summary.item_count, 0)::int AS item_count,
        COALESCE(item_summary.items, '[]'::json) AS items,
        CASE
          WHEN affected_barangays.affected_barangays_count = 1
            THEN affected_barangays.single_barangay_name
          WHEN affected_barangays.affected_barangays_count > 1
            THEN 'Multiple affected barangays'
          ELSE NULL
        END AS recipient_barangay_name
      FROM donor_groups
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT di.id)::int AS item_count,
          COALESCE(SUM(di.quantity_received), 0)::int AS total_quantity_received,
          COALESCE(
            SUM(
              CASE
                WHEN COALESCE(di.remarks, '') ILIKE 'Relief Pack:%' THEN 0
                ELSE di.quantity_received
              END
            ),
            0
          )::int AS total_loose_items_received,
          COALESCE(
            (
              SELECT SUM(pack_rows.relief_pack_quantity)
              FROM (
                SELECT DISTINCT
                  d2.id,
                  di2.remarks,
                  COALESCE(
                    NULLIF(
                      SUBSTRING(di2.remarks FROM '\\sx\\s([0-9]+)\\s*$'),
                      ''
                    )::int,
                    0
                  ) AS relief_pack_quantity
                FROM donations d2
                INNER JOIN donation_items di2 ON di2.donation_id = d2.id
                WHERE LOWER(BTRIM(d2.donor_name)) = donor_groups.normalized_donor_name
                  AND d2.donor_type = donor_groups.donor_type
                  AND COALESCE(d2.donor_type_other, '') = COALESCE(donor_groups.donor_type_other, '')
                  AND d2.disaster_event_id = donor_groups.disaster_event_id
                  AND d2.status <> 'CANCELLED'
                  AND COALESCE(di2.remarks, '') ILIKE 'Relief Pack:%'
              ) pack_rows
            ),
            0
          )::int AS total_relief_packs_received,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'item_name', ii.item_name,
                'quantity_received', di.quantity_received,
                'unit_of_measure', ii.unit_of_measure
              )
              ORDER BY ii.item_name
            ),
            '[]'::json
          ) AS items
        FROM donation_items di
        INNER JOIN donations d ON d.id = di.donation_id
        INNER JOIN inventory_items ii ON ii.id = di.inventory_item_id
        WHERE LOWER(BTRIM(d.donor_name)) = donor_groups.normalized_donor_name
          AND d.donor_type = donor_groups.donor_type
          AND COALESCE(d.donor_type_other, '') = COALESCE(donor_groups.donor_type_other, '')
          AND d.disaster_event_id = donor_groups.disaster_event_id
          AND d.status <> 'CANCELLED'
      ) item_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT b.id)::int AS affected_barangays_count,
          MIN(b.name) AS single_barangay_name
        FROM disaster_event_barangays deb
        INNER JOIN barangays b ON b.id = deb.barangay_id
        WHERE deb.disaster_event_id = donor_groups.disaster_event_id
          AND b.is_active = TRUE
      ) affected_barangays ON TRUE
      ORDER BY donor_groups.latest_received_at DESC, donor_groups.latest_created_at DESC
      LIMIT $2
    `,
    values,
  );

  return result.rows;
};

const getDonationSummaryTotals = async (disasterEventId, dbClient = pool) => {
  const values = [];
  const donationConditions = [`d.status <> 'CANCELLED'`];
  const distributionConditions = [
    `ib.source_type = 'DONATED'`,
    `it.transaction_type IN ('OUTFLOW', 'RETURN')`,
    `it.reference_type = 'DISTRIBUTION'`,
  ];
  const writeOffConditions = [
    `ib.source_type = 'DONATED'`,
    `it.transaction_type IN ('EXPIRED', 'MISSING', 'DAMAGED', 'SPOILED', 'STOLEN', 'OTHER')`,
  ];
  const batchConditions = [`ib.source_type = 'DONATED'`];
  const donatedBatchDonationConditions = [`d.status <> 'CANCELLED'`];
  const disasterEventIds = normalizeDisasterEventFilter(disasterEventId);

  if (disasterEventIds.length > 0) {
    values.push(disasterEventIds);
    donationConditions.push(`d.disaster_event_id = ANY($${values.length}::uuid[])`);
    donatedBatchDonationConditions.push(
      `d.disaster_event_id = ANY($${values.length}::uuid[])`,
    );
    distributionConditions.push(
      `it.disaster_event_id = ANY($${values.length}::uuid[])`,
    );
  }

  const donatedBatchDonationCondition = `EXISTS (
    SELECT 1
    FROM donation_items di
    INNER JOIN donations d ON d.id = di.donation_id
    WHERE di.inventory_batch_id = ib.id
      AND ${donatedBatchDonationConditions.join("\n      AND ")}
  )`;
  distributionConditions.push(donatedBatchDonationCondition);
  writeOffConditions.push(donatedBatchDonationCondition);
  batchConditions.push(donatedBatchDonationCondition);

  const donationWhere =
    donationConditions.length > 0 ? `WHERE ${donationConditions.join(" AND ")}` : "";
  const distributionWhere = `WHERE ${distributionConditions.join(" AND ")}`;
  const writeOffWhere = `WHERE ${writeOffConditions.join(" AND ")}`;
  const batchWhere = `WHERE ${batchConditions.join(" AND ")}`;

  const [donationResult, distributionResult, writeOffResult, batchResult] = await Promise.all([
    dbClient.query(
      `
        SELECT
          COUNT(DISTINCT d.id)::int AS total_donations_received,
          COALESCE(SUM(di.quantity_received), 0)::int AS total_quantity_received
        FROM donations d
        INNER JOIN donation_items di ON di.donation_id = d.id
        INNER JOIN inventory_batches ib
          ON ib.id = di.inventory_batch_id
         AND ib.source_type = 'DONATED'
        ${donationWhere}
      `,
      values,
    ),
    dbClient.query(
      `
        SELECT GREATEST(
          COALESCE(SUM(
            CASE
              WHEN it.transaction_type = 'OUTFLOW' THEN it.quantity
              WHEN it.transaction_type = 'RETURN' THEN -it.quantity
              ELSE 0
            END
          ), 0),
          0
        )::int AS total_donated_items_distributed
        FROM inventory_transactions it
        INNER JOIN inventory_batches ib ON ib.id = it.inventory_batch_id
        ${distributionWhere}
      `,
      values,
    ),
    dbClient.query(
      `
        SELECT COALESCE(SUM(it.quantity), 0)::int AS total_donated_items_written_off
        FROM inventory_transactions it
        INNER JOIN inventory_batches ib ON ib.id = it.inventory_batch_id
        ${writeOffWhere}
      `,
      values,
    ),
    dbClient.query(
      `
        SELECT COALESCE(SUM(ib.quantity_available), 0)::int AS remaining_donated_inventory
        FROM inventory_batches ib
        ${batchWhere}
      `,
      values,
    ),
  ]);

  return {
    total_donations_received:
      donationResult.rows[0]?.total_donations_received || 0,
    total_quantity_received: donationResult.rows[0]?.total_quantity_received || 0,
    total_donated_items_distributed:
      distributionResult.rows[0]?.total_donated_items_distributed || 0,
    total_donated_items_written_off:
      writeOffResult.rows[0]?.total_donated_items_written_off || 0,
    remaining_donated_inventory:
      batchResult.rows[0]?.remaining_donated_inventory || 0,
  };
};

const getDonationItemTransparencySummaryLegacy = async (
  disasterEventId,
  dbClient = pool,
) => {
  const values = [];
  const conditions = [
    `ib.source_type = 'DONATED'`,
    `d.status <> 'CANCELLED'`,
  ];
  const disasterEventIds = normalizeDisasterEventFilter(disasterEventId);
  const distributionEventFilter =
    disasterEventIds.length > 0
      ? "AND it.disaster_event_id = ANY($1::uuid[])"
      : "";

  if (disasterEventIds.length > 0) {
    values.push(disasterEventIds);
    conditions.push(`d.disaster_event_id = ANY($${values.length}::uuid[])`);
  }

  const hasDonorNamePublicColumn = await hasDonationDonorNamePublicColumn(
    dbClient,
  );
  const result = await dbClient.query(
    `
      SELECT
        d.id AS donation_id,
        d.donor_name,
        d.donor_type,
        ${hasDonorNamePublicColumn ? "d.donor_name_public" : "FALSE"} AS donor_name_public,
        d.disaster_event_id,
        de.title AS disaster_event_title,
        d.received_at,
        di.id AS donation_item_id,
        di.inventory_batch_id,
        ii.id AS inventory_item_id,
        ii.item_code,
        ii.item_name,
        ii.unit_of_measure,
        di.quantity_received,
        di.remarks AS donation_item_remarks,
        COALESCE(ib.quantity_available, 0)::int AS quantity_remaining,
        COALESCE((
          SELECT GREATEST(
            COALESCE(SUM(
              CASE
                WHEN it.transaction_type = 'OUTFLOW' THEN it.quantity
                WHEN it.transaction_type = 'RETURN' THEN -it.quantity
                ELSE 0
              END
            ), 0),
            0
          )::int
          FROM inventory_transactions it
          INNER JOIN inventory_batches ib2 ON ib2.id = it.inventory_batch_id
          WHERE ib2.id = di.inventory_batch_id
            AND ib2.source_type = 'DONATED'
            AND it.transaction_type IN ('OUTFLOW', 'RETURN')
            AND it.reference_type = 'DISTRIBUTION'
            AND EXISTS (
              SELECT 1
              FROM donation_items di2
              INNER JOIN donations d2 ON d2.id = di2.donation_id
              WHERE di2.inventory_batch_id = ib2.id
                AND di2.donation_id = d.id
                AND di2.inventory_item_id = ii.id
                AND d2.status <> 'CANCELLED'
            )
            ${distributionEventFilter}
        ), 0) AS quantity_distributed,
        COALESCE((
          SELECT SUM(it.quantity)::int
          FROM inventory_transactions it
          INNER JOIN inventory_batches ib2 ON ib2.id = it.inventory_batch_id
          WHERE ib2.id = di.inventory_batch_id
            AND ib2.source_type = 'DONATED'
            AND it.transaction_type IN ('EXPIRED', 'MISSING', 'DAMAGED', 'SPOILED', 'STOLEN', 'OTHER')
            AND EXISTS (
              SELECT 1
              FROM donation_items di2
              INNER JOIN donations d2 ON d2.id = di2.donation_id
              WHERE di2.inventory_batch_id = ib2.id
                AND di2.donation_id = d.id
                AND di2.inventory_item_id = ii.id
                AND d2.status <> 'CANCELLED'
            )
            ${distributionEventFilter}
        ), 0) AS quantity_written_off,
        COALESCE((
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'reason', reason_rows.reason,
              'quantity', reason_rows.quantity
            )
            ORDER BY reason_rows.reason ASC
          )
          FROM (
            SELECT
              it.transaction_type AS reason,
              SUM(it.quantity)::int AS quantity
            FROM inventory_transactions it
            INNER JOIN inventory_batches ib2 ON ib2.id = it.inventory_batch_id
            WHERE ib2.id = di.inventory_batch_id
              AND ib2.source_type = 'DONATED'
              AND it.transaction_type IN ('EXPIRED', 'MISSING', 'DAMAGED', 'SPOILED', 'STOLEN', 'OTHER')
              AND EXISTS (
                SELECT 1
                FROM donation_items di2
                INNER JOIN donations d2 ON d2.id = di2.donation_id
                WHERE di2.inventory_batch_id = ib2.id
                  AND di2.donation_id = d.id
                  AND di2.inventory_item_id = ii.id
                  AND d2.status <> 'CANCELLED'
              )
              ${distributionEventFilter}
            GROUP BY it.transaction_type
          ) reason_rows
        ), '[]'::json) AS write_off_reasons
      FROM donation_items di
      INNER JOIN donations d ON d.id = di.donation_id
      INNER JOIN disaster_events de ON de.id = d.disaster_event_id
        INNER JOIN inventory_items ii ON ii.id = di.inventory_item_id
      LEFT JOIN inventory_batches ib ON ib.id = di.inventory_batch_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY d.received_at DESC, d.donor_name ASC, ii.item_name ASC, di.id ASC
    `,
    values,
  );

  return result.rows;
};

const isDatabaseClient = (value) =>
  Boolean(value && typeof value.query === "function");

const buildPublicTransparencyGroupedCte = ({
  hasDonorNamePublicColumn,
  disasterEventIds,
}) => {
  const eventParamIndex = disasterEventIds.length > 0 ? 1 : null;
  const eventCondition = eventParamIndex
    ? `AND d.disaster_event_id = ANY($${eventParamIndex}::uuid[])`
    : "";
  const distributionEventFilter = eventParamIndex
    ? `AND it.disaster_event_id = ANY($${eventParamIndex}::uuid[])`
    : "";

  return `
    WITH raw_rows AS (
      SELECT
        d.id AS donation_id,
        d.donor_name,
        COALESCE(d.donor_type, 'OTHER') AS donor_type,
        ${hasDonorNamePublicColumn ? "d.donor_name_public" : "FALSE"} AS donor_name_public,
        d.disaster_event_id,
        de.title AS disaster_event_title,
        d.received_at,
        di.id AS donation_item_id,
        di.inventory_batch_id,
        ii.id AS inventory_item_id,
        ii.item_name,
        di.quantity_received,
        di.remarks AS donation_item_remarks,
        COALESCE(ib.quantity_available, 0)::int AS quantity_remaining,
        COALESCE((
          SELECT GREATEST(
            COALESCE(SUM(
              CASE
                WHEN it.transaction_type = 'OUTFLOW' THEN it.quantity
                WHEN it.transaction_type = 'RETURN' THEN -it.quantity
                ELSE 0
              END
            ), 0),
            0
          )::int
          FROM inventory_transactions it
          INNER JOIN inventory_batches ib2 ON ib2.id = it.inventory_batch_id
          WHERE ib2.id = di.inventory_batch_id
            AND ib2.source_type = 'DONATED'
            AND it.transaction_type IN ('OUTFLOW', 'RETURN')
            AND it.reference_type = 'DISTRIBUTION'
            AND EXISTS (
              SELECT 1
              FROM donation_items di2
              INNER JOIN donations d2 ON d2.id = di2.donation_id
              WHERE di2.inventory_batch_id = ib2.id
                AND di2.donation_id = d.id
                AND di2.inventory_item_id = ii.id
                AND d2.status <> 'CANCELLED'
            )
            ${distributionEventFilter}
        ), 0) AS quantity_distributed,
        COALESCE((
          SELECT SUM(it.quantity)::int
          FROM inventory_transactions it
          INNER JOIN inventory_batches ib2 ON ib2.id = it.inventory_batch_id
          WHERE ib2.id = di.inventory_batch_id
            AND ib2.source_type = 'DONATED'
            AND it.transaction_type IN ('EXPIRED', 'MISSING', 'DAMAGED', 'SPOILED', 'STOLEN', 'OTHER')
            AND EXISTS (
              SELECT 1
              FROM donation_items di2
              INNER JOIN donations d2 ON d2.id = di2.donation_id
              WHERE di2.inventory_batch_id = ib2.id
                AND di2.donation_id = d.id
                AND di2.inventory_item_id = ii.id
                AND d2.status <> 'CANCELLED'
            )
            ${distributionEventFilter}
        ), 0) AS quantity_written_off,
        COALESCE((
          SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'reason', reason_rows.reason,
              'quantity', reason_rows.quantity
            )
            ORDER BY reason_rows.reason ASC
          )
          FROM (
            SELECT
              it.transaction_type AS reason,
              SUM(it.quantity)::int AS quantity
            FROM inventory_transactions it
            INNER JOIN inventory_batches ib2 ON ib2.id = it.inventory_batch_id
            WHERE ib2.id = di.inventory_batch_id
              AND ib2.source_type = 'DONATED'
              AND it.transaction_type IN ('EXPIRED', 'MISSING', 'DAMAGED', 'SPOILED', 'STOLEN', 'OTHER')
              AND EXISTS (
                SELECT 1
                FROM donation_items di2
                INNER JOIN donations d2 ON d2.id = di2.donation_id
                WHERE di2.inventory_batch_id = ib2.id
                  AND di2.donation_id = d.id
                  AND di2.inventory_item_id = ii.id
                  AND d2.status <> 'CANCELLED'
              )
              ${distributionEventFilter}
            GROUP BY it.transaction_type
          ) reason_rows
        ), '[]'::json) AS write_off_reasons
      FROM donation_items di
      INNER JOIN donations d ON d.id = di.donation_id
      INNER JOIN disaster_events de ON de.id = d.disaster_event_id
      INNER JOIN inventory_items ii ON ii.id = di.inventory_item_id
      LEFT JOIN inventory_batches ib ON ib.id = di.inventory_batch_id
      WHERE ib.source_type = 'DONATED'
        AND d.status <> 'CANCELLED'
        ${eventCondition}
    ),
    parsed_rows AS (
      SELECT
        raw_rows.*,
        CASE
          WHEN pack_match.matches IS NOT NULL THEN 'RELIEF_PACK'
          ELSE 'LOOSE_ITEM'
        END AS source_type,
        NULLIF(BTRIM(pack_match.matches[1]), '') AS pack_name,
        NULLIF(pack_match.matches[2], '')::int AS pack_quantity
      FROM raw_rows
      LEFT JOIN LATERAL regexp_match(
        BTRIM(COALESCE(raw_rows.donation_item_remarks, '')),
        '^Relief Pack:\\s*(.*?)\\s+x\\s+([0-9]+)$',
        'i'
      ) AS pack_match(matches) ON TRUE
      WHERE NOT (
        BTRIM(COALESCE(raw_rows.donation_item_remarks, '')) ILIKE 'Relief Pack:%'
        AND pack_match.matches IS NULL
      )
    ),
    normalized_rows AS (
      SELECT
        parsed_rows.*,
        CASE
          WHEN parsed_rows.source_type = 'RELIEF_PACK' THEN FLOOR(
            COALESCE(parsed_rows.quantity_received, 0)::numeric /
              NULLIF(parsed_rows.pack_quantity, 0)
          )::int
          ELSE NULL
        END AS quantity_per_pack,
        CASE
          WHEN parsed_rows.source_type = 'RELIEF_PACK' THEN CONCAT(
            parsed_rows.donation_id::text,
            ':RELIEF_PACK:',
            LOWER(parsed_rows.pack_name),
            ':',
            parsed_rows.pack_quantity
          )
          ELSE CONCAT(
            parsed_rows.donation_id::text,
            ':LOOSE_ITEM:',
            parsed_rows.inventory_item_id::text
          )
        END AS source_key,
        CONCAT(
          LOWER(BTRIM(COALESCE(parsed_rows.donor_name, ''))),
          '|',
          LOWER(BTRIM(COALESCE(parsed_rows.donor_type, ''))),
          '|',
          COALESCE(parsed_rows.disaster_event_id::text, '')
        ) AS donor_key
      FROM parsed_rows
    ),
    eligible_rows AS (
      SELECT *
      FROM normalized_rows
      WHERE source_type = 'LOOSE_ITEM'
        OR (
          pack_name IS NOT NULL
          AND quantity_per_pack > 0
        )
    ),
    reason_totals AS (
      SELECT
        eligible_rows.source_key,
        reason_row->>'reason' AS reason,
        SUM(COALESCE(NULLIF(reason_row->>'quantity', '')::int, 0))::int AS quantity
      FROM eligible_rows
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(eligible_rows.write_off_reasons::jsonb, '[]'::jsonb)
      ) AS reason_row
      GROUP BY eligible_rows.source_key, reason_row->>'reason'
    ),
    reason_arrays AS (
      SELECT
        source_key,
        JSON_AGG(
          JSON_BUILD_OBJECT('reason', reason, 'quantity', quantity)
          ORDER BY reason ASC
        ) AS write_off_reasons
      FROM reason_totals
      GROUP BY source_key
    ),
    base_grouped_rows AS (
      SELECT
        eligible_rows.source_key,
        'LOOSE_ITEM' AS source_type,
        eligible_rows.donation_id,
        (ARRAY_AGG(eligible_rows.donor_name ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS donor_name,
        (ARRAY_AGG(eligible_rows.donor_name_public ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS donor_name_public,
        (ARRAY_AGG(eligible_rows.donor_type ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS donor_type,
        (ARRAY_AGG(eligible_rows.disaster_event_id ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS disaster_event_id,
        (ARRAY_AGG(eligible_rows.disaster_event_title ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS disaster_event_title,
        (ARRAY_AGG(eligible_rows.item_name ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS item_name,
        NULL::text AS relief_pack_name,
        'pc'::text AS unit_of_measure,
        NULL::int AS pack_quantity,
        SUM(eligible_rows.quantity_received)::int AS quantity_received,
        SUM(eligible_rows.quantity_distributed)::int AS quantity_distributed,
        SUM(eligible_rows.quantity_written_off)::int AS quantity_written_off,
        SUM(eligible_rows.quantity_remaining)::int AS quantity_remaining,
        (ARRAY_AGG(eligible_rows.received_at ORDER BY eligible_rows.received_at DESC, eligible_rows.donor_name ASC, eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS sort_received_at,
        (ARRAY_AGG(eligible_rows.donor_name ORDER BY eligible_rows.received_at DESC, eligible_rows.donor_name ASC, eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS sort_donor_name,
        (ARRAY_AGG(eligible_rows.item_name ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS sort_item_name,
        (ARRAY_AGG(eligible_rows.donation_item_id ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS sort_donation_item_id,
        (ARRAY_AGG(eligible_rows.donor_key ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS donor_key
      FROM eligible_rows
      WHERE eligible_rows.source_type = 'LOOSE_ITEM'
      GROUP BY eligible_rows.source_key, eligible_rows.donation_id

      UNION ALL

      SELECT
        eligible_rows.source_key,
        'RELIEF_PACK' AS source_type,
        eligible_rows.donation_id,
        (ARRAY_AGG(eligible_rows.donor_name ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS donor_name,
        (ARRAY_AGG(eligible_rows.donor_name_public ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS donor_name_public,
        (ARRAY_AGG(eligible_rows.donor_type ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS donor_type,
        (ARRAY_AGG(eligible_rows.disaster_event_id ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS disaster_event_id,
        (ARRAY_AGG(eligible_rows.disaster_event_title ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS disaster_event_title,
        (ARRAY_AGG(eligible_rows.pack_name ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS item_name,
        (ARRAY_AGG(eligible_rows.pack_name ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS relief_pack_name,
        'pack'::text AS unit_of_measure,
        (ARRAY_AGG(eligible_rows.pack_quantity ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS pack_quantity,
        (ARRAY_AGG(eligible_rows.pack_quantity ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS quantity_received,
        MIN(FLOOR(
          eligible_rows.quantity_distributed::numeric /
            NULLIF(eligible_rows.quantity_per_pack, 0)
        ))::int AS quantity_distributed,
        MIN(FLOOR(
          eligible_rows.quantity_written_off::numeric /
            NULLIF(eligible_rows.quantity_per_pack, 0)
        ))::int AS quantity_written_off,
        MIN(FLOOR(
          eligible_rows.quantity_remaining::numeric /
            NULLIF(eligible_rows.quantity_per_pack, 0)
        ))::int AS quantity_remaining,
        (ARRAY_AGG(eligible_rows.received_at ORDER BY eligible_rows.received_at DESC, eligible_rows.donor_name ASC, eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS sort_received_at,
        (ARRAY_AGG(eligible_rows.donor_name ORDER BY eligible_rows.received_at DESC, eligible_rows.donor_name ASC, eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS sort_donor_name,
        (ARRAY_AGG(eligible_rows.item_name ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS sort_item_name,
        (ARRAY_AGG(eligible_rows.donation_item_id ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS sort_donation_item_id,
        (ARRAY_AGG(eligible_rows.donor_key ORDER BY eligible_rows.item_name ASC NULLS LAST, eligible_rows.donation_item_id ASC))[1] AS donor_key
      FROM eligible_rows
      WHERE eligible_rows.source_type = 'RELIEF_PACK'
      GROUP BY eligible_rows.source_key, eligible_rows.donation_id
    ),
    grouped_rows AS (
      SELECT
        base_grouped_rows.*,
        COALESCE(reason_arrays.write_off_reasons, '[]'::json) AS write_off_reasons
      FROM base_grouped_rows
      LEFT JOIN reason_arrays
        ON reason_arrays.source_key = base_grouped_rows.source_key
    ),
    donor_first_rows AS (
      SELECT DISTINCT ON (grouped_rows.donor_key)
        grouped_rows.donor_key,
        grouped_rows.sort_received_at,
        grouped_rows.sort_donor_name,
        grouped_rows.sort_item_name,
        grouped_rows.sort_donation_item_id,
        grouped_rows.source_key
      FROM grouped_rows
      WHERE grouped_rows.donor_name_public IS NOT TRUE
        OR NULLIF(BTRIM(COALESCE(grouped_rows.donor_name, '')), '') IS NULL
      ORDER BY
        grouped_rows.donor_key,
        grouped_rows.sort_received_at DESC,
        grouped_rows.sort_donor_name ASC,
        grouped_rows.sort_item_name ASC NULLS LAST,
        grouped_rows.sort_donation_item_id ASC,
        grouped_rows.source_key ASC
    ),
    donor_labels AS (
      SELECT
        donor_first_rows.donor_key,
        ROW_NUMBER() OVER (
          ORDER BY
            donor_first_rows.sort_received_at DESC,
            donor_first_rows.sort_donor_name ASC,
            donor_first_rows.sort_item_name ASC NULLS LAST,
            donor_first_rows.sort_donation_item_id ASC,
            donor_first_rows.source_key ASC
        )::int AS donor_label_number
      FROM donor_first_rows
    ),
    ordered_rows AS (
      SELECT
        grouped_rows.*,
        donor_labels.donor_label_number
      FROM grouped_rows
      LEFT JOIN donor_labels
        ON donor_labels.donor_key = grouped_rows.donor_key
    )
  `;
};

const getPaginatedDonationItemTransparencySummary = async (
  disasterEventId,
  pagination,
  dbClient = pool,
) => {
  const disasterEventIds = normalizeDisasterEventFilter(disasterEventId);
  const page = Number(pagination?.page);
  const pageSize = Number(pagination?.pageSize);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw new Error("Invalid public transparency pagination options");
  }

  const hasDonorNamePublicColumn = await hasDonationDonorNamePublicColumn(
    dbClient,
  );
  const groupedCte = buildPublicTransparencyGroupedCte({
    hasDonorNamePublicColumn,
    disasterEventIds,
  });
  const eventValues = disasterEventIds.length > 0 ? [disasterEventIds] : [];
  const countResult = await dbClient.query(
    `${groupedCte}
      SELECT
        COUNT(*)::int AS total_items,
        COALESCE(SUM(CASE WHEN source_type = 'LOOSE_ITEM' THEN quantity_received ELSE 0 END), 0)::int AS total_loose_items_received,
        COALESCE(SUM(CASE WHEN source_type = 'LOOSE_ITEM' THEN quantity_distributed ELSE 0 END), 0)::int AS total_loose_items_distributed,
        COALESCE(SUM(CASE WHEN source_type = 'LOOSE_ITEM' THEN quantity_remaining ELSE 0 END), 0)::int AS total_loose_items_remaining,
        COALESCE(SUM(CASE WHEN source_type = 'RELIEF_PACK' THEN quantity_received ELSE 0 END), 0)::int AS total_relief_packs_received,
        COALESCE(SUM(CASE WHEN source_type = 'RELIEF_PACK' THEN quantity_distributed ELSE 0 END), 0)::int AS total_relief_packs_distributed,
        COALESCE(SUM(CASE WHEN source_type = 'RELIEF_PACK' THEN quantity_remaining ELSE 0 END), 0)::int AS total_relief_packs_remaining
      FROM grouped_rows
    `,
    eventValues,
  );

  const countRow = countResult.rows[0] || {};
  const totalItems = Number(countRow.total_items || 0);
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0;
  const effectivePage = totalPages > 0 ? Math.min(page, totalPages) : 1;
  const limitParamIndex = eventValues.length + 1;
  const offsetParamIndex = eventValues.length + 2;
  const rowsResult = await dbClient.query(
    `${groupedCte}
      SELECT
        source_key,
        source_type,
        donation_id,
        donor_name,
        donor_name_public,
        donor_type,
        disaster_event_id,
        disaster_event_title,
        item_name,
        relief_pack_name,
        unit_of_measure,
        pack_quantity,
        quantity_received,
        quantity_distributed,
        quantity_written_off,
        quantity_remaining,
        write_off_reasons,
        donor_label_number
      FROM ordered_rows
      ORDER BY
        sort_received_at DESC,
        sort_donor_name ASC,
        sort_item_name ASC NULLS LAST,
        sort_donation_item_id ASC,
        source_key ASC
      LIMIT $${limitParamIndex}
      OFFSET $${offsetParamIndex}
    `,
    [...eventValues, pageSize, (effectivePage - 1) * pageSize],
  );

  return {
    rows: rowsResult.rows,
    totalItems,
    page: effectivePage,
    pageSize,
    totals: {
      loose_items_received: Number(countRow.total_loose_items_received || 0),
      loose_items_distributed: Number(
        countRow.total_loose_items_distributed || 0,
      ),
      loose_items_remaining: Number(countRow.total_loose_items_remaining || 0),
      relief_packs_received: Number(countRow.total_relief_packs_received || 0),
      relief_packs_distributed: Number(
        countRow.total_relief_packs_distributed || 0,
      ),
      relief_packs_remaining: Number(countRow.total_relief_packs_remaining || 0),
    },
  };
};

const getDonationItemTransparencySummary = async (
  disasterEventId,
  optionsOrDbClient = null,
  maybeDbClient = pool,
) => {
  if (isDatabaseClient(optionsOrDbClient)) {
    return getDonationItemTransparencySummaryLegacy(
      disasterEventId,
      optionsOrDbClient,
    );
  }

  if (optionsOrDbClient && typeof optionsOrDbClient === "object") {
    return getPaginatedDonationItemTransparencySummary(
      disasterEventId,
      optionsOrDbClient,
      maybeDbClient,
    );
  }

  return getDonationItemTransparencySummaryLegacy(
    disasterEventId,
    maybeDbClient,
  );
};

const getDonationTransparencyExportRows = async (
  disasterEventId,
  dbClient = pool,
) => {
  const values = [];
  const conditions = [`d.status <> 'CANCELLED'`];

  if (disasterEventId) {
    values.push(disasterEventId);
    conditions.push(`d.disaster_event_id = $${values.length}`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await dbClient.query(
    `
      SELECT
        d.donor_name,
        de.title AS disaster_event,
        d.received_at,
        d.created_at,
        ii.item_name,
        ii.unit_of_measure,
        di.quantity_received,
        COALESCE(distributed.quantity_distributed, 0)::int AS quantity_distributed,
        COALESCE(written_off.quantity_written_off, 0)::int AS quantity_written_off,
        COALESCE(written_off.write_off_reasons, '') AS write_off_reasons,
        COALESCE(ib.quantity_available, 0)::int AS remaining_stock
      FROM donation_items di
      INNER JOIN donations d ON d.id = di.donation_id
      INNER JOIN disaster_events de ON de.id = d.disaster_event_id
      INNER JOIN inventory_items ii ON ii.id = di.inventory_item_id
      LEFT JOIN inventory_batches ib ON ib.id = di.inventory_batch_id
      LEFT JOIN LATERAL (
        SELECT GREATEST(
          COALESCE(SUM(
            CASE
              WHEN it.transaction_type = 'OUTFLOW' THEN it.quantity
              WHEN it.transaction_type = 'RETURN' THEN -it.quantity
              ELSE 0
            END
          ), 0),
          0
        )::int AS quantity_distributed
        FROM inventory_transactions it
        WHERE it.inventory_batch_id = di.inventory_batch_id
          AND it.transaction_type IN ('OUTFLOW', 'RETURN')
          AND it.reference_type = 'DISTRIBUTION'
      ) distributed ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(reason_rows.quantity), 0)::int AS quantity_written_off,
          COALESCE(
            STRING_AGG(
              CONCAT(reason_rows.reason_label, ': ', reason_rows.quantity),
              ', '
              ORDER BY reason_rows.reason_label ASC
            ),
            ''
          ) AS write_off_reasons
        FROM (
          SELECT
            INITCAP(LOWER(it.transaction_type)) AS reason_label,
            SUM(it.quantity)::int AS quantity
          FROM inventory_transactions it
          WHERE it.inventory_batch_id = di.inventory_batch_id
            AND it.transaction_type IN ('EXPIRED', 'MISSING', 'DAMAGED', 'SPOILED', 'STOLEN', 'OTHER')
          GROUP BY it.transaction_type
        ) reason_rows
      ) written_off ON TRUE
      ${whereClause}
      ORDER BY d.received_at DESC, d.created_at DESC, d.donor_name ASC, ii.item_name ASC
    `,
    values,
  );

  return result.rows;
};

const getDonationInventoryTransactions = async (donationId, dbClient = pool) => {
  const hasOtherStatusColumn =
    await hasInventoryTransactionOtherStatusColumn(dbClient);
  const result = await dbClient.query(
    `
      SELECT
        it.id,
        it.disaster_event_id,
        it.inventory_batch_id,
        it.transaction_type,
        it.quantity,
        it.reference_type,
        it.reference_id,
        it.performed_by,
        it.performed_at,
        it.remarks,
        ${hasOtherStatusColumn ? "it.other_status" : "NULL::text"} AS other_status,
        it.created_at,
        ib.batch_no,
        ib.status AS batch_status,
        ib.quantity_available,
        ib.expiration_date,
        ii.id AS inventory_item_id,
        ii.item_code,
        ii.item_name,
        u.first_name AS performed_by_first_name,
        u.last_name AS performed_by_last_name
      FROM inventory_transactions it
      INNER JOIN donation_items di ON di.id = it.reference_id
      INNER JOIN inventory_batches ib ON ib.id = it.inventory_batch_id
      INNER JOIN inventory_items ii ON ii.id = ib.inventory_item_id
      LEFT JOIN users u ON u.id = it.performed_by
      WHERE it.reference_type = 'DONATION'
        AND di.donation_id = $1
      ORDER BY it.performed_at DESC, it.created_at DESC
    `,
    [donationId],
  );

  return result.rows;
};

module.exports = {
  getDisasterEventById,
  getInventoryItemById,
  getInventoryItemByIdForUpdate,
  getInventoryItemByName,
  getUserById,
  getDonationNeeds,
  getDonationNeedById,
  insertDonationNeed,
  updateDonationNeed,
  deleteDonationNeed,
  getDonations,
  getDonationById,
  getDonationByIdForUpdate,
  getDonationItemsByDonationId,
  getDonationItemById,
  getDonationItemByIdForUpdate,
  insertDonation,
  updateDonation,
  updateDonationPublicName,
  renameDonorAcrossDonations,
  deleteDonation,
  insertDonationItem,
  updateDonationItem,
  syncDonationInventoryTransactions,
  deleteDonationItem,
  getInventoryBatchByIdForUpdate,
  insertInventoryBatch,
  updateInventoryBatchStock,
  insertInventoryTransaction,
  getPublicDonationDisasterSummaries,
  getDefaultEmergencyDonationNeeds,
  getPublicForecastSuggestions,
  getPublicRecentDonationSummaries,
  getDonationSummaryTotals,
  getDonationItemTransparencySummary,
  getDonationTransparencyExportRows,
  getDonationInventoryTransactions,
};
