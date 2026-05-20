const pool = require("../config/db");

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

const donationSelect = `
  SELECT
    d.id,
    d.disaster_event_id,
    d.donor_name,
    d.donor_type,
    d.contact_information,
    d.received_by,
    d.received_at,
    d.status,
    d.remarks,
    d.created_at,
    d.updated_at,
    de.event_code,
    de.title AS disaster_event_title,
    u.first_name AS received_by_first_name,
    u.last_name AS received_by_last_name
  FROM donations d
  INNER JOIN disaster_events de ON de.id = d.disaster_event_id
  LEFT JOIN users u ON u.id = d.received_by
`;

const donationItemSelect = `
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
    ib.batch_no,
    ib.source_type,
    ib.quantity_available,
    ib.expiration_date,
    ib.storage_location
  FROM donation_items di
  INNER JOIN inventory_items ii ON ii.id = di.inventory_item_id
  LEFT JOIN inventory_batches ib ON ib.id = di.inventory_batch_id
`;

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
  const result = await dbClient.query(
    `
      SELECT
        id,
        item_code,
        item_name,
        category,
        unit_of_measure,
        is_active,
        is_perishable
      FROM inventory_items
      WHERE id = $1
    `,
    [id],
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
      `(d.donor_name ILIKE $${values.length} OR d.contact_information ILIKE $${values.length} OR de.title ILIKE $${values.length} OR de.event_code ILIKE $${values.length})`,
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await dbClient.query(
    `
      ${donationSelect}
      ${whereClause}
      ORDER BY d.received_at DESC, d.created_at DESC
    `,
    values,
  );

  return result.rows;
};

const getDonationById = async (id, dbClient = pool) => {
  const result = await dbClient.query(
    `
      ${donationSelect}
      WHERE d.id = $1
    `,
    [id],
  );

  return result.rows[0] || null;
};

const getDonationByIdForUpdate = async (id, dbClient) => {
  const result = await dbClient.query(
    `
      SELECT
        id,
        disaster_event_id,
        donor_name,
        donor_type,
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
  const result = await dbClient.query(
    `
      ${donationItemSelect}
      WHERE di.donation_id = $1
      ORDER BY di.created_at ASC, ii.item_name ASC
    `,
    [donationId],
  );

  return result.rows;
};

const getDonationItemById = async (id, dbClient = pool) => {
  const result = await dbClient.query(
    `
      ${donationItemSelect}
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
        contact_information,
        received_by,
        received_at,
        status,
        remarks,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()), $7, $8, NOW(), NOW())
      RETURNING id
    `,
    [
      payload.disaster_event_id,
      payload.donor_name,
      payload.donor_type,
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
          contact_information = $5,
          received_at = COALESCE($6, received_at),
          status = $7,
          remarks = $8,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [
      id,
      payload.disaster_event_id,
      payload.donor_name,
      payload.donor_type,
      payload.contact_information,
      payload.received_at,
      payload.status,
      payload.remarks,
    ],
  );

  return result.rows[0] || null;
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
        batch_no,
        source_type,
        quantity_received,
        quantity_available,
        expiration_date,
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
        supplier_id,
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
      VALUES ($1, $2, NULL, $3, $4, $5, $6, COALESCE($7, NOW()), $8, $9, $10, NOW(), NOW())
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
      RETURNING id
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

const getPublicDonationNeeds = async (disasterEventId, dbClient = pool) => {
  const values = [];
  const conditions = ["dn.is_active = TRUE"];

  if (disasterEventId) {
    values.push(disasterEventId);
    conditions.push(`dn.disaster_event_id = $${values.length}`);
  } else {
    conditions.push(`de.status = 'ACTIVE'`);
  }

  const result = await dbClient.query(
    `
      ${donationNeedSelect}
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        de.start_date DESC,
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

const getDonationSummaryTotals = async (disasterEventId, dbClient = pool) => {
  const values = [];
  const donationConditions = [];
  const distributionConditions = [`ib.source_type = 'DONATED'`, `it.transaction_type = 'OUTFLOW'`, `it.reference_type = 'DISTRIBUTION'`];
  const batchConditions = [`ib.source_type = 'DONATED'`];

  if (disasterEventId) {
    values.push(disasterEventId);
    donationConditions.push(`d.disaster_event_id = $${values.length}`);
    distributionConditions.push(`it.disaster_event_id = $${values.length}`);
    batchConditions.push(`EXISTS (
      SELECT 1
      FROM donation_items di
      INNER JOIN donations d ON d.id = di.donation_id
      WHERE di.inventory_batch_id = ib.id
        AND d.disaster_event_id = $${values.length}
    )`);
  }

  const donationWhere =
    donationConditions.length > 0 ? `WHERE ${donationConditions.join(" AND ")}` : "";
  const distributionWhere = `WHERE ${distributionConditions.join(" AND ")}`;
  const batchWhere = `WHERE ${batchConditions.join(" AND ")}`;

  const [donationResult, distributionResult, batchResult] = await Promise.all([
    dbClient.query(
      `
        SELECT
          COUNT(DISTINCT d.id)::int AS total_donations_received,
          COALESCE(SUM(di.quantity_received), 0)::int AS total_quantity_received
        FROM donations d
        LEFT JOIN donation_items di ON di.donation_id = d.id
        ${donationWhere}
      `,
      values,
    ),
    dbClient.query(
      `
        SELECT COALESCE(SUM(it.quantity), 0)::int AS total_donated_items_distributed
        FROM inventory_transactions it
        INNER JOIN inventory_batches ib ON ib.id = it.inventory_batch_id
        ${distributionWhere}
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
    remaining_donated_inventory:
      batchResult.rows[0]?.remaining_donated_inventory || 0,
  };
};

const getDonationItemTransparencySummary = async (
  disasterEventId,
  dbClient = pool,
) => {
  const values = [];
  const conditions = [`ib.source_type = 'DONATED'`];

  if (disasterEventId) {
    values.push(disasterEventId);
    conditions.push(`d.disaster_event_id = $${values.length}`);
  }

  const result = await dbClient.query(
    `
      SELECT
        ii.id AS inventory_item_id,
        ii.item_code,
        ii.item_name,
        ii.unit_of_measure,
        COALESCE(SUM(di.quantity_received), 0)::int AS quantity_received,
        COALESCE(SUM(ib.quantity_available), 0)::int AS quantity_remaining,
        COALESCE((
          SELECT SUM(it.quantity)::int
          FROM inventory_transactions it
          INNER JOIN inventory_batches ib2 ON ib2.id = it.inventory_batch_id
          WHERE ib2.inventory_item_id = ii.id
            AND ib2.source_type = 'DONATED'
            AND it.transaction_type = 'OUTFLOW'
            AND it.reference_type = 'DISTRIBUTION'
            ${disasterEventId ? `AND it.disaster_event_id = $1` : ""}
        ), 0) AS quantity_distributed
      FROM donation_items di
      INNER JOIN donations d ON d.id = di.donation_id
      INNER JOIN inventory_items ii ON ii.id = di.inventory_item_id
      LEFT JOIN inventory_batches ib ON ib.id = di.inventory_batch_id
      WHERE ${conditions.join(" AND ")}
      GROUP BY ii.id, ii.item_code, ii.item_name, ii.unit_of_measure
      ORDER BY ii.item_name ASC
    `,
    values,
  );

  return result.rows;
};

const getDonationTransparencyExportRows = async (
  disasterEventId,
  dbClient = pool,
) => {
  const values = [];
  const conditions = [];

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
        ii.item_name,
        di.quantity_received,
        COALESCE(distributed.quantity_distributed, 0)::int AS quantity_distributed,
        COALESCE(ib.quantity_available, 0)::int AS remaining_stock
      FROM donation_items di
      INNER JOIN donations d ON d.id = di.donation_id
      INNER JOIN inventory_items ii ON ii.id = di.inventory_item_id
      LEFT JOIN inventory_batches ib ON ib.id = di.inventory_batch_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(it.quantity), 0)::int AS quantity_distributed
        FROM inventory_transactions it
        WHERE it.inventory_batch_id = di.inventory_batch_id
          AND it.transaction_type = 'OUTFLOW'
          AND it.reference_type = 'DISTRIBUTION'
      ) distributed ON TRUE
      ${whereClause}
      ORDER BY d.donor_name ASC, ii.item_name ASC
    `,
    values,
  );

  return result.rows;
};

module.exports = {
  getDisasterEventById,
  getInventoryItemById,
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
  deleteDonation,
  insertDonationItem,
  updateDonationItem,
  deleteDonationItem,
  getInventoryBatchByIdForUpdate,
  insertInventoryBatch,
  updateInventoryBatchStock,
  insertInventoryTransaction,
  getPublicDonationNeeds,
  getDonationSummaryTotals,
  getDonationItemTransparencySummary,
  getDonationTransparencyExportRows,
};
