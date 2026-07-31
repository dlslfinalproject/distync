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
    ib.inventory_item_stock_form_id,
    ib.batch_no,
    ib.source_type,
    ib.quantity_available,
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
      `(d.donor_name ILIKE $${values.length} OR d.donor_type_other ILIKE $${values.length} OR d.contact_information ILIKE $${values.length} OR de.title ILIKE $${values.length} OR de.event_code ILIKE $${values.length})`,
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
  const disasterEventIds = normalizeDisasterEventFilter(disasterEventId);

  if (disasterEventIds.length > 0) {
    values.push(disasterEventIds);
    conditions.push(`dn.disaster_event_id = ANY($${values.length}::uuid[])`);
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
       AND ii.is_active = TRUE
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
    `(de.start_date IS NULL OR de.start_date <= CURRENT_DATE)`,
    `(de.end_date IS NULL OR de.end_date >= CURRENT_DATE)`,
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
        de.updated_at,
        COALESCE(affected_barangays.affected_barangays, '[]'::json) AS affected_barangays,
        COALESCE(barangay_summary.affected_barangays_count, 0)::int AS affected_barangays_count,
        COALESCE(household_summary.registered_households_count, 0)::int AS registered_households_count,
        COALESCE(individual_summary.affected_individuals_count, 0)::int AS affected_individuals_count,
        COALESCE(need_summary.published_need_count, 0)::int AS published_need_count,
        COALESCE(need_summary.published_needed_quantity, 0)::int AS published_needed_quantity
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
          AND h.is_active = TRUE
      ) household_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT e.id)::int AS affected_individuals_count
        FROM households h
        INNER JOIN evacuees e ON e.household_id = h.id
        WHERE h.disaster_event_id = de.id
          AND h.is_active = TRUE
          AND e.is_active = TRUE
      ) individual_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS published_need_count,
          COALESCE(SUM(dn.quantity_needed), 0)::int AS published_needed_quantity
        FROM donation_needs dn
        WHERE dn.disaster_event_id = de.id
          AND dn.is_active = TRUE
      ) need_summary ON TRUE
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        de.start_date DESC NULLS LAST,
        GREATEST(
          COALESCE(de.updated_at, de.created_at),
          de.created_at
        ) DESC,
        de.created_at DESC
      LIMIT 3
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
        WHERE ii.is_active = TRUE
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

  const values = [disasterEventIds, limit];

  const result = await dbClient.query(
    `
      SELECT
        MD5(d.id::text) AS public_key,
        d.donor_name,
        d.donor_type,
        d.received_at,
        d.status,
        COALESCE(item_summary.total_quantity_received, 0)::int AS total_quantity_received,
        COALESCE(item_summary.item_count, 0)::int AS item_count,
        COALESCE(item_summary.items, '[]'::json) AS items,
        CASE
          WHEN affected_barangays.affected_barangays_count = 1
            THEN affected_barangays.single_barangay_name
          WHEN affected_barangays.affected_barangays_count > 1
            THEN 'Multiple affected barangays'
          ELSE NULL
        END AS recipient_barangay_name
      FROM donations d
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT di.id)::int AS item_count,
          COALESCE(SUM(di.quantity_received), 0)::int AS total_quantity_received,
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
        INNER JOIN inventory_items ii ON ii.id = di.inventory_item_id
        WHERE di.donation_id = d.id
      ) item_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(DISTINCT b.id)::int AS affected_barangays_count,
          MIN(b.name) AS single_barangay_name
        FROM disaster_event_barangays deb
        INNER JOIN barangays b ON b.id = deb.barangay_id
        WHERE deb.disaster_event_id = d.disaster_event_id
          AND b.is_active = TRUE
      ) affected_barangays ON TRUE
      WHERE d.disaster_event_id = ANY($1::uuid[])
        AND d.status <> 'CANCELLED'
      ORDER BY d.received_at DESC, d.created_at DESC
      LIMIT $2
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
  const disasterEventIds = normalizeDisasterEventFilter(disasterEventId);

  if (disasterEventIds.length > 0) {
    values.push(disasterEventIds);
    donationConditions.push(`d.disaster_event_id = ANY($${values.length}::uuid[])`);
    distributionConditions.push(
      `it.disaster_event_id = ANY($${values.length}::uuid[])`,
    );
    distributionConditions.push(`EXISTS (
      SELECT 1
      FROM donation_items di
      INNER JOIN donations d ON d.id = di.donation_id
      WHERE di.inventory_batch_id = ib.id
        AND d.disaster_event_id = ANY($${values.length}::uuid[])
    )`);
    batchConditions.push(`EXISTS (
      SELECT 1
      FROM donation_items di
      INNER JOIN donations d ON d.id = di.donation_id
      WHERE di.inventory_batch_id = ib.id
        AND d.disaster_event_id = ANY($${values.length}::uuid[])
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
  const disasterEventIds = normalizeDisasterEventFilter(disasterEventId);

  if (disasterEventIds.length > 0) {
    values.push(disasterEventIds);
    conditions.push(`d.disaster_event_id = ANY($${values.length}::uuid[])`);
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
            ${
              disasterEventIds.length > 0
                ? `AND it.disaster_event_id = ANY($1::uuid[])
                   AND EXISTS (
                     SELECT 1
                     FROM donation_items di2
                     INNER JOIN donations d2 ON d2.id = di2.donation_id
                     WHERE di2.inventory_batch_id = ib2.id
                       AND d2.disaster_event_id = ANY($1::uuid[])
                   )`
                : ""
            }
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

const getDonationInventoryTransactions = async (donationId, dbClient = pool) => {
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
  getPublicDonationNeeds,
  getDefaultEmergencyDonationNeeds,
  getPublicForecastSuggestions,
  getPublicRecentDonationSummaries,
  getDonationSummaryTotals,
  getDonationItemTransparencySummary,
  getDonationTransparencyExportRows,
  getDonationInventoryTransactions,
};
