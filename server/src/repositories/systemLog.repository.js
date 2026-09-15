const pool = require("../config/db");

const insertAuditLog = async (payload, dbClient = pool) => {
  const query = `
    INSERT INTO audit_logs (
      user_id,
      role_code,
      device_id,
      action,
      entity_type,
      entity_id,
      old_values_json,
      new_values_json,
      ip_address,
      source_event_key,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, NOW())
    ON CONFLICT (source_event_key)
    WHERE source_event_key IS NOT NULL
    DO NOTHING
    RETURNING *
  `;

  const values = [
    payload.user_id || null,
    payload.role_code || null,
    payload.device_id || null,
    payload.action,
    payload.entity_type,
    payload.entity_id || null,
    JSON.stringify(payload.old_values_json || {}),
    JSON.stringify(payload.new_values_json || {}),
    payload.ip_address || null,
    payload.source_event_key || null,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const insertErrorLog = async (payload, dbClient = pool) => {
  const query = `
    INSERT INTO error_logs (
      user_id,
      device_id,
      module_name,
      error_code,
      error_message,
      stack_trace,
      severity,
      reference_type,
      reference_id,
      context_json,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())
    RETURNING *
  `;

  const values = [
    payload.user_id || null,
    payload.device_id || null,
    payload.module_name,
    payload.error_code || null,
    payload.error_message,
    payload.stack_trace || null,
    payload.severity || "ERROR",
    payload.reference_type || null,
    payload.reference_id || null,
    JSON.stringify(payload.context_json || {}),
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
};

const AUDIT_LOG_RETENTION_YEARS = 5;

const getAuditLogs = async (
  {
    auditAction = "all",
    dateFrom = "",
    dateTo = "",
    limit = 50,
    module = "all",
    page = 1,
    search = "",
  } = {},
  dbClient = pool,
) => {
  const shouldLimit = Number.isInteger(limit);
  const offset = shouldLimit ? (page - 1) * limit : 0;
  const values = [];
  const auditTimestampExpression =
    "COALESCE(dt_direct.distribution_date, CASE WHEN al.action = 'SYNC_CONFLICT_RESOLUTION' THEN sc_direct.resolved_at END, al.created_at)";
  const normalizedModule = String(module || "all").trim().toLowerCase();
  const normalizedAuditAction = String(auditAction || "all").trim().toLowerCase();
  const normalizedSearch = String(search || "").trim();
  const moduleCountConditions = {
    inventory: `
      (
        al.entity_type IN (
          'INVENTORY_ITEM',
          'INVENTORY_ITEM_STOCK_FORM',
          'INVENTORY_BATCH'
        )
        OR (
          al.entity_type = 'INVENTORY_TRANSACTION'
          AND COALESCE(it_direct.reference_type, '') <> 'DONATION'
        )
      )
    `,
    "relief pack": "al.entity_type = 'RELIEF_PACK_TEMPLATE'",
    donation: `
      (
        al.entity_type IN ('DONATION', 'DONATION_ITEM')
        OR (
          al.entity_type = 'INVENTORY_TRANSACTION'
          AND it_direct.reference_type = 'DONATION'
        )
      )
    `,
    distribution: "al.entity_type = 'DISTRIBUTION_TRANSACTION'",
    sync: "al.entity_type IN ('SYNC_CONFLICT', 'SYNC_TRANSACTION')",
  };
  let moduleClause = "";

  if (normalizedModule !== "all") {
    const moduleConditions = {
      inventory: `AND ${moduleCountConditions.inventory}`,
      "relief pack": `AND ${moduleCountConditions["relief pack"]}`,
      donation: `AND ${moduleCountConditions.donation}`,
      distribution: `AND ${moduleCountConditions.distribution}`,
      sync: `AND ${moduleCountConditions.sync}`,
    };

    moduleClause = moduleConditions[normalizedModule] || "";
  }

  let auditActionClause = "";

  if (normalizedAuditAction !== "all") {
    const auditActionConditions = {
      item_created: `
        al.entity_type = 'INVENTORY_ITEM'
        AND al.action = 'INVENTORY_ITEM_CREATE'
      `,
      item_details_edited: `
        al.entity_type = 'INVENTORY_ITEM'
        AND al.action = 'INVENTORY_ITEM_UPDATE'
      `,
      packaging_added: `
        al.entity_type = 'INVENTORY_ITEM_STOCK_FORM'
        AND al.action = 'INVENTORY_ITEM_STOCK_FORM_CREATE'
        AND al.new_values_json->>'is_additional_packaging' = 'true'
      `,
      stock_added: `
        (
          (
            al.entity_type = 'INVENTORY_BATCH'
            AND al.action = 'INVENTORY_BATCH_CREATE'
          )
          OR (
            al.entity_type = 'INVENTORY_TRANSACTION'
            AND al.action = 'INVENTORY_TRANSACTION_CREATE'
            AND al.new_values_json->>'transaction_type' = 'INFLOW'
            AND COALESCE(it_direct.reference_type, '') <> 'DONATION'
          )
        )
      `,
      written_off: `
        al.entity_type = 'INVENTORY_TRANSACTION'
        AND al.action = 'INVENTORY_TRANSACTION_CREATE'
        AND al.new_values_json->>'transaction_type' IN (
          'EXPIRED',
          'MISSING',
          'DAMAGED',
          'SPOILED',
          'STOLEN',
          'OTHER'
        )
      `,
      relief_pack_template_created: `
        al.entity_type = 'RELIEF_PACK_TEMPLATE'
        AND al.action = 'RELIEF_PACK_TEMPLATE_CREATE'
      `,
      relief_pack_details_edited: `
        al.entity_type = 'RELIEF_PACK_TEMPLATE'
        AND al.action IN (
          'RELIEF_PACK_TEMPLATE_UPDATE',
          'RELIEF_PACK_TEMPLATE_UPDATED',
          'RELIEF_PACK_TEMPLATE_ITEMS_UPDATED'
        )
      `,
      donation_entry: `
        al.entity_type = 'DONATION'
        AND al.action = 'DONATION_CREATE'
      `,
      donation_details_edited: `
        (
          (
            al.entity_type = 'DONATION'
            AND al.action IN ('DONATION_UPDATE', 'DONATION_PUBLIC_NAME_UPDATE')
          )
          OR (
            al.entity_type = 'DONATION_ITEM'
            AND al.action = 'DONATION_ITEM_UPDATE'
          )
        )
      `,
      distributed_items: `
        al.entity_type = 'DISTRIBUTION_TRANSACTION'
        AND al.action IN ('DISTRIBUTION_RECORD', 'DISTRIBUTION_QR_CLAIM')
      `,
      sync_conflict_resolution: `
        al.entity_type = 'SYNC_CONFLICT'
        AND al.action = 'SYNC_CONFLICT_RESOLUTION'
        AND sc_direct.entity_type IN (
          'INVENTORY_ITEM',
          'INVENTORY_BATCH',
          'INVENTORY_TRANSACTION'
        )
      `,
    };

    auditActionClause = auditActionConditions[normalizedAuditAction]
      ? `AND (${auditActionConditions[normalizedAuditAction]})`
      : "";
  }

  let dateClause = "";

  if (dateFrom) {
    values.push(dateFrom);
    dateClause += ` AND ${auditTimestampExpression} >= $${values.length}::date`;
  }

  if (dateTo) {
    values.push(dateTo);
    dateClause += ` AND ${auditTimestampExpression} < ($${values.length}::date + INTERVAL '1 day')`;
  }

  let searchClause = "";

  if (normalizedSearch) {
    values.push(`%${normalizedSearch}%`);
    const searchParam = `$${values.length}`;
    searchClause = `
      AND (
        CASE
          WHEN al.entity_type = 'INVENTORY_ITEM'
            AND al.action = 'INVENTORY_ITEM_CREATE'
            THEN 'item created'
          WHEN al.entity_type = 'INVENTORY_ITEM'
            AND al.action = 'INVENTORY_ITEM_UPDATE'
            THEN 'item details edited'
          WHEN al.entity_type = 'INVENTORY_ITEM_STOCK_FORM'
            AND al.action = 'INVENTORY_ITEM_STOCK_FORM_CREATE'
            AND al.new_values_json->>'is_additional_packaging' = 'true'
            THEN 'packaging added'
          WHEN al.entity_type = 'INVENTORY_BATCH'
            AND al.action IN ('INVENTORY_BATCH_CREATE', 'INVENTORY_BATCH_UPDATE')
            THEN 'stock added batch expiry updated'
          WHEN al.entity_type = 'INVENTORY_TRANSACTION'
            AND it_direct.reference_type = 'DONATION'
            AND al.new_values_json->>'transaction_type' = 'INFLOW'
            THEN 'donated stock added'
          WHEN al.entity_type = 'INVENTORY_TRANSACTION'
            AND it_direct.reference_type = 'DONATION'
            AND al.new_values_json->>'transaction_type' = 'OUTFLOW'
            THEN 'donated stock removed'
          WHEN al.entity_type = 'INVENTORY_TRANSACTION'
            AND al.new_values_json->>'transaction_type' = 'INFLOW'
            THEN 'stock added'
          WHEN al.entity_type = 'RELIEF_PACK_TEMPLATE'
            AND al.action = 'RELIEF_PACK_TEMPLATE_CREATE'
            THEN 'relief pack template created'
          WHEN al.entity_type = 'RELIEF_PACK_TEMPLATE'
            AND al.action IN (
              'RELIEF_PACK_TEMPLATE_UPDATE',
              'RELIEF_PACK_TEMPLATE_UPDATED',
              'RELIEF_PACK_TEMPLATE_ITEMS_UPDATED'
            )
            THEN 'relief pack details edited'
          WHEN al.entity_type = 'DONATION'
            AND al.action = 'DONATION_CREATE'
            THEN 'donation entry'
          WHEN al.entity_type = 'DONATION'
            AND al.action IN ('DONATION_UPDATE', 'DONATION_PUBLIC_NAME_UPDATE')
            THEN 'donation details edited'
          WHEN al.entity_type = 'DONATION_ITEM'
            AND al.action = 'DONATION_ITEM_UPDATE'
            THEN 'donation details edited'
          WHEN al.entity_type = 'DISTRIBUTION_TRANSACTION'
            AND al.action IN ('DISTRIBUTION_RECORD', 'DISTRIBUTION_QR_CLAIM')
            THEN 'distributed items'
          WHEN al.entity_type = 'SYNC_CONFLICT'
            AND al.action = 'SYNC_CONFLICT_RESOLUTION'
            THEN 'sync conflict resolved'
          ELSE REPLACE(LOWER(COALESCE(al.action, '')), '_', ' ')
        END ILIKE ${searchParam}
        OR u.first_name ILIKE ${searchParam}
        OR u.last_name ILIKE ${searchParam}
        OR u.email ILIKE ${searchParam}
        OR CONCAT_WS(' ', u.first_name, u.last_name) ILIKE ${searchParam}
        OR ii_direct.item_name ILIKE ${searchParam}
        OR ii_batch.item_name ILIKE ${searchParam}
        OR ii_transaction.item_name ILIKE ${searchParam}
        OR ii_stock_form.item_name ILIKE ${searchParam}
        OR ib_direct.batch_no ILIKE ${searchParam}
        OR ib_transaction.batch_no ILIKE ${searchParam}
        OR rpt_direct.name ILIKE ${searchParam}
        OR d_direct.donor_name ILIKE ${searchParam}
        OR d_item.donor_name ILIKE ${searchParam}
        OR d_transaction.donor_name ILIKE ${searchParam}
        OR u_distribution.first_name ILIKE ${searchParam}
        OR u_distribution.last_name ILIKE ${searchParam}
        OR u_distribution.email ILIKE ${searchParam}
        OR CONCAT_WS(
          ' ',
          u_distribution.first_name,
          u_distribution.last_name
        ) ILIKE ${searchParam}
        OR EXISTS (
          SELECT 1
          FROM donation_items donation_item_search
          INNER JOIN inventory_items donation_item_inventory_search
            ON donation_item_inventory_search.id = donation_item_search.inventory_item_id
          WHERE donation_item_search.donation_id = d_direct.id
            AND donation_item_inventory_search.item_name ILIKE ${searchParam}
        )
        OR EXISTS (
          SELECT 1
          FROM distribution_transaction_relief_pack_templates dtrpt_search
            WHERE dtrpt_search.distribution_transaction_id = dt_direct.id
            AND dtrpt_search.name_snapshot ILIKE ${searchParam}
        )
      )
    `;
  }

  const limitClause = shouldLimit
    ? (() => {
        values.push(limit, offset);
        return `LIMIT $${values.length - 1} OFFSET $${values.length}`;
      })()
    : "";
  const query = `
    SELECT
      al.id,
      COUNT(*) OVER() AS total_count,
      COUNT(*) FILTER (WHERE ${moduleCountConditions.inventory}) OVER()
        AS inventory_count,
      COUNT(*) FILTER (WHERE ${moduleCountConditions["relief pack"]}) OVER()
        AS relief_pack_count,
      COUNT(*) FILTER (WHERE ${moduleCountConditions.donation}) OVER()
        AS donation_count,
      COUNT(*) FILTER (WHERE ${moduleCountConditions.distribution}) OVER()
        AS distribution_count,
      al.action,
      al.entity_type,
      al.entity_id,
      al.role_code,
      al.old_values_json,
      al.new_values_json,
      al.ip_address,
      al.created_at,
      sc_direct.entity_type AS sync_conflict_entity_type,
      sc_direct.conflict_type AS sync_conflict_type,
      sc_direct.local_payload_json AS sync_conflict_local_payload_json,
      sc_direct.server_payload_json AS sync_conflict_server_payload_json,
      st_sync.client_timestamp AS sync_conflict_client_timestamp,
      st_sync.created_at AS sync_conflict_transaction_created_at,
      sc_direct.resolution_action AS sync_conflict_resolution_action,
      sc_direct.resolution_reason AS sync_conflict_resolution_reason,
      sc_direct.resolved_payload_json AS sync_conflict_resolved_payload_json,
      sc_direct.resolved_at AS sync_conflict_resolved_at,
      u.id AS user_id,
      u.first_name,
      u.last_name,
      u.email,
      COALESCE(
        ii_direct.item_name,
        ii_batch.item_name,
        ii_transaction.item_name,
        ii_stock_form.item_name
      ) AS inventory_item_name,
      COALESCE(
        ii_direct.item_code,
        ii_batch.item_code,
        ii_transaction.item_code,
        ii_stock_form.item_code
      ) AS inventory_item_code,
      COALESCE(
        ii_direct.category,
        ii_batch.category,
        ii_transaction.category,
        ii_stock_form.category
      ) AS inventory_item_category,
      COALESCE(
        ii_direct.unit_of_measure,
        ii_batch.unit_of_measure,
        ii_transaction.unit_of_measure,
        ii_stock_form.unit_of_measure
      ) AS inventory_item_unit_of_measure,
      COALESCE(
        ii_direct.unit_of_measure_value,
        ii_batch.unit_of_measure_value,
        ii_transaction.unit_of_measure_value,
        ii_stock_form.unit_of_measure_value
      ) AS inventory_item_unit_of_measure_value,
      COALESCE(
        ii_direct.reorder_level,
        ii_batch.reorder_level,
        ii_transaction.reorder_level,
        ii_stock_form.reorder_level
      ) AS inventory_item_reorder_level,
      COALESCE(
        iisf_batch.packaging,
        iisf_transaction.packaging,
        iisf_direct.packaging
      ) AS inventory_packaging,
      COALESCE(
        iisf_batch.units_per_packaging,
        iisf_transaction.units_per_packaging,
        iisf_direct.units_per_packaging
      ) AS inventory_units_per_packaging,
      COALESCE(
        iisf_batch.unit_of_measure,
        iisf_transaction.unit_of_measure,
        iisf_direct.unit_of_measure
      ) AS inventory_packaging_unit_of_measure,
      COALESCE(
        ib_direct.batch_no,
        ib_transaction.batch_no
      ) AS inventory_batch_no,
      COALESCE(
        ib_direct.source_type,
        ib_transaction.source_type
      ) AS inventory_source_type,
      COALESCE(
        ib_direct.expiration_date,
        ib_transaction.expiration_date
      ) AS inventory_expiration_date,
      COALESCE(
        ib_direct.received_at,
        ib_transaction.received_at
      ) AS inventory_received_at,
      it_direct.reference_type AS inventory_transaction_reference_type,
      COALESCE(
        iisf_batch.barcode,
        iisf_transaction.barcode,
        ii_direct.barcode,
        ii_batch.barcode,
        ii_transaction.barcode
      ) AS inventory_barcode,
      rpt_direct.name AS relief_pack_template_name,
      rpt_direct.is_active AS relief_pack_template_is_active,
      (
        SELECT COALESCE(
          jsonb_object_agg(sector_lookup.id::text, sector_lookup.name),
          '{}'::jsonb
        )
        FROM sectors sector_lookup
        WHERE al.entity_type = 'RELIEF_PACK_TEMPLATE'
      ) AS relief_pack_sector_name_map,
      COALESCE(
        d_direct.id,
        d_item.id,
        d_transaction.id
      ) AS donation_id,
      COALESCE(
        d_direct.donor_name,
        d_item.donor_name,
        d_transaction.donor_name,
        al.new_values_json->>'donor_name',
        al.old_values_json->>'donor_name'
      ) AS donation_donor_name,
      COALESCE(
        d_direct.status,
        d_item.status,
        d_transaction.status,
        al.new_values_json->>'status',
        al.old_values_json->>'status'
      ) AS donation_status,
      COALESCE(
        de_donation.title,
        al.new_values_json->>'disaster_event_title',
        al.old_values_json->>'disaster_event_title'
      ) AS donation_disaster_event_title,
      donation_items.items AS donation_items_json,
      donation_adjustment_details.details AS donation_adjustment_json,
      dt_direct.distribution_date,
      dt_direct.distribution_status,
      dt_direct.verified_by AS distribution_verified_by,
      u_distribution.first_name AS distribution_verified_by_first_name,
      u_distribution.last_name AS distribution_verified_by_last_name,
      u_distribution.email AS distribution_verified_by_email,
      distribution_template_names.names AS distribution_relief_pack_template_name,
      distribution_template_names.names AS distribution_relief_pack_template_names,
      distribution_items.items AS distribution_items_json
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    LEFT JOIN sync_conflicts sc_direct
      ON al.entity_type = 'SYNC_CONFLICT'
      AND sc_direct.id = al.entity_id
    LEFT JOIN sync_transactions st_sync
      ON st_sync.id = sc_direct.sync_transaction_id
    LEFT JOIN inventory_items ii_direct
      ON al.entity_type = 'INVENTORY_ITEM'
      AND ii_direct.id = al.entity_id
    LEFT JOIN inventory_batches ib_direct
      ON al.entity_type = 'INVENTORY_BATCH'
      AND ib_direct.id = al.entity_id
    LEFT JOIN inventory_items ii_batch
      ON ii_batch.id = ib_direct.inventory_item_id
    LEFT JOIN inventory_item_stock_forms iisf_batch
      ON iisf_batch.id = ib_direct.inventory_item_stock_form_id
    LEFT JOIN inventory_transactions it_direct
      ON al.entity_type = 'INVENTORY_TRANSACTION'
      AND it_direct.id = al.entity_id
    LEFT JOIN inventory_batches ib_transaction
      ON ib_transaction.id = it_direct.inventory_batch_id
    LEFT JOIN inventory_items ii_transaction
      ON ii_transaction.id = ib_transaction.inventory_item_id
    LEFT JOIN inventory_item_stock_forms iisf_transaction
      ON iisf_transaction.id = ib_transaction.inventory_item_stock_form_id
    LEFT JOIN inventory_item_stock_forms iisf_direct
      ON al.entity_type = 'INVENTORY_ITEM_STOCK_FORM'
      AND iisf_direct.id = al.entity_id
    LEFT JOIN inventory_items ii_stock_form
      ON ii_stock_form.id = iisf_direct.inventory_item_id
    LEFT JOIN relief_pack_templates rpt_direct
      ON al.entity_type = 'RELIEF_PACK_TEMPLATE'
      AND rpt_direct.id = al.entity_id
    LEFT JOIN donations d_direct
      ON al.entity_type = 'DONATION'
      AND d_direct.id = al.entity_id
    LEFT JOIN donation_items di_direct
      ON al.entity_type = 'DONATION_ITEM'
      AND di_direct.id = al.entity_id
    LEFT JOIN donations d_item
      ON d_item.id = di_direct.donation_id
    LEFT JOIN donation_items di_transaction
      ON al.entity_type = 'INVENTORY_TRANSACTION'
      AND it_direct.reference_type = 'DONATION'
      AND di_transaction.id = it_direct.reference_id
    LEFT JOIN donations d_transaction
      ON d_transaction.id = di_transaction.donation_id
    LEFT JOIN disaster_events de_donation
      ON de_donation.id = COALESCE(
        d_direct.disaster_event_id,
        d_item.disaster_event_id,
        d_transaction.disaster_event_id
      )
    LEFT JOIN distribution_transactions dt_direct
      ON al.entity_type = 'DISTRIBUTION_TRANSACTION'
      AND dt_direct.id = al.entity_id
    LEFT JOIN users u_distribution
      ON u_distribution.id = dt_direct.verified_by
    LEFT JOIN LATERAL (
      SELECT STRING_AGG(
        DISTINCT linked_template_row.name_snapshot,
        ', ' ORDER BY linked_template_row.name_snapshot
      ) AS names
      FROM distribution_transaction_relief_pack_templates linked_template_row
      WHERE linked_template_row.distribution_transaction_id = dt_direct.id
    ) distribution_template_names ON TRUE
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
          jsonb_build_object(
          'item_code', ii_donation.item_code,
          'item_name', ii_donation.item_name,
          'category', ii_donation.category,
          'quantity_received', di_donation.quantity_received,
          'unit_of_measure', ii_donation.unit_of_measure,
          'packaging', stock_forms_donation.packaging,
          'units_per_packaging', stock_forms_donation.units_per_packaging,
          'batch_no', ib_donation.batch_no,
          'expiration_date', ib_donation.expiration_date,
          'inventory_transaction_remarks', (
            SELECT it_donation.remarks
            FROM inventory_transactions it_donation
            WHERE it_donation.reference_type = 'DONATION'
              AND it_donation.reference_id = di_donation.id
            ORDER BY it_donation.performed_at ASC NULLS LAST,
              it_donation.created_at ASC,
              it_donation.id ASC
            LIMIT 1
          ),
          'remarks', di_donation.remarks
        )
        ORDER BY di_donation.created_at ASC, ii_donation.item_name ASC
      ) AS items
      FROM donation_items di_donation
      INNER JOIN inventory_items ii_donation
        ON ii_donation.id = di_donation.inventory_item_id
      LEFT JOIN inventory_batches ib_donation
        ON ib_donation.id = di_donation.inventory_batch_id
      LEFT JOIN inventory_item_stock_forms stock_forms_donation
        ON stock_forms_donation.id = ib_donation.inventory_item_stock_form_id
      WHERE di_donation.donation_id = COALESCE(
        d_direct.id,
        d_item.id,
        d_transaction.id
      )
    ) donation_items ON TRUE
    LEFT JOIN LATERAL (
      SELECT jsonb_build_object(
        'id', adjustment_log.id,
        'old_values_json', adjustment_log.old_values_json,
        'new_values_json', adjustment_log.new_values_json,
        'created_at', adjustment_log.created_at
      ) AS details
      FROM audit_logs adjustment_log
      WHERE al.entity_type = 'DONATION_ITEM'
        AND al.action = 'DONATION_ITEM_UPDATE'
        AND adjustment_log.entity_type = 'INVENTORY_TRANSACTION'
        AND adjustment_log.action = 'INVENTORY_TRANSACTION_CREATE'
        AND COALESCE(
          adjustment_log.new_values_json->>'reference_type',
          ''
        ) = 'DONATION'
        AND (
          adjustment_log.id::text = NULLIF(
            al.new_values_json->>'adjustment_transaction_id',
            ''
          )
          OR (
            al.new_values_json->>'adjustment_transaction_id' IS NULL
            AND adjustment_log.new_values_json->>'reference_id' = al.entity_id::text
            AND (
              adjustment_log.new_values_json->>'transaction_type' = 'ADJUSTMENT'
              OR LOWER(COALESCE(adjustment_log.new_values_json->>'remarks', ''))
                LIKE 'adjusted up donation stock%'
              OR LOWER(COALESCE(adjustment_log.new_values_json->>'remarks', ''))
                LIKE 'adjusted down donation stock%'
              OR LOWER(COALESCE(adjustment_log.new_values_json->>'remarks', ''))
                LIKE '%donation adjustment%'
            )
            AND adjustment_log.created_at >= al.created_at
            AND adjustment_log.created_at <= al.created_at + INTERVAL '1 minute'
          )
        )
      ORDER BY adjustment_log.created_at ASC
      LIMIT 1
    ) donation_adjustment_details ON TRUE
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'item_name', COALESCE(
            dti_distribution.item_name_snapshot,
            ii_distribution.item_name
          ),
          'quantity_released', dti_distribution.quantity_released,
          'unit_of_measure', COALESCE(
            dti_distribution.unit_of_measure_snapshot,
            ii_distribution.unit_of_measure
          ),
          'batch_no', ib_distribution.batch_no,
          'donor_name', d_distribution.donor_name,
          'donation_remarks', di_distribution.remarks,
          'source_type', ib_distribution.source_type
        )
        ORDER BY COALESCE(
          dti_distribution.item_name_snapshot,
          ii_distribution.item_name
        ) ASC, dti_distribution.created_at ASC
      ) AS items
      FROM distribution_transaction_items dti_distribution
      INNER JOIN inventory_items ii_distribution
        ON ii_distribution.id = dti_distribution.inventory_item_id
      INNER JOIN inventory_batches ib_distribution
        ON ib_distribution.id = dti_distribution.inventory_batch_id
      LEFT JOIN donation_items di_distribution
        ON di_distribution.inventory_batch_id = dti_distribution.inventory_batch_id
        AND di_distribution.inventory_item_id = dti_distribution.inventory_item_id
      LEFT JOIN donations d_distribution
        ON d_distribution.id = di_distribution.donation_id
      WHERE dti_distribution.distribution_transaction_id = dt_direct.id
    ) distribution_items ON TRUE
    WHERE al.created_at >= NOW() - INTERVAL '${AUDIT_LOG_RETENTION_YEARS} years'
      AND NOT (
        al.entity_type = 'INVENTORY_ITEM_STOCK_FORM'
        AND al.action = 'INVENTORY_ITEM_STOCK_FORM_CREATE'
        AND COALESCE(al.new_values_json->>'is_additional_packaging', 'false') <> 'true'
      )
      AND NOT (
        al.entity_type = 'INVENTORY_TRANSACTION'
        AND al.action = 'INVENTORY_TRANSACTION_CREATE'
        AND COALESCE(
          it_direct.reference_type,
          al.new_values_json->>'reference_type',
          ''
        ) = 'DONATION'
        AND (
          al.new_values_json->>'transaction_type' = 'ADJUSTMENT'
          OR LOWER(COALESCE(al.new_values_json->>'remarks', ''))
            LIKE 'adjusted up donation stock%'
          OR LOWER(COALESCE(al.new_values_json->>'remarks', ''))
            LIKE 'adjusted down donation stock%'
          OR LOWER(COALESCE(al.new_values_json->>'remarks', ''))
            LIKE '%donation adjustment%'
        )
      )
      -- A regular stock-in creates both an inventory batch and an inventory
      -- transaction audit row. The transaction is the user-facing Stock Added
      -- event; keep the batch row only when its transaction audit is missing.
      AND NOT (
        al.entity_type = 'INVENTORY_BATCH'
        AND al.action = 'INVENTORY_BATCH_CREATE'
        AND EXISTS (
          SELECT 1
          FROM audit_logs transaction_audit
          WHERE transaction_audit.entity_type = 'INVENTORY_TRANSACTION'
            AND transaction_audit.action = 'INVENTORY_TRANSACTION_CREATE'
            AND transaction_audit.new_values_json->>'transaction_type' = 'INFLOW'
            AND COALESCE(
              transaction_audit.new_values_json->>'reference_type',
              ''
            ) <> 'DONATION'
            AND transaction_audit.new_values_json->>'inventory_batch_id' = al.entity_id::text
        )
      )
      AND (
        (
          (
            (
              al.entity_type = 'INVENTORY_ITEM'
              AND al.action IN (
                'INVENTORY_ITEM_CREATE',
                'INVENTORY_ITEM_UPDATE',
                'INVENTORY_ITEM_REORDER_LEVEL_UPDATE'
              )
            )
            OR (
              al.entity_type = 'INVENTORY_ITEM_STOCK_FORM'
              AND al.action IN (
                'INVENTORY_ITEM_STOCK_FORM_CREATE',
                'INVENTORY_ITEM_STOCK_FORM_UPDATE'
              )
            )
            OR (
              al.entity_type = 'INVENTORY_BATCH'
              AND al.action IN ('INVENTORY_BATCH_CREATE', 'INVENTORY_BATCH_UPDATE')
            )
            OR (
              al.entity_type = 'INVENTORY_TRANSACTION'
              AND al.action = 'INVENTORY_TRANSACTION_CREATE'
              AND al.new_values_json->>'transaction_type' IN (
                'INFLOW',
                'RETURN',
                'EXPIRED',
                'MISSING',
                'DAMAGED',
                'SPOILED',
                'STOLEN',
                'OTHER'
              )
            )
            OR (
              al.entity_type = 'INVENTORY_TRANSACTION'
              AND al.action = 'INVENTORY_TRANSACTION_CREATE'
              AND it_direct.reference_type = 'DONATION'
            )
          )
        )
        OR (
          al.entity_type = 'RELIEF_PACK_TEMPLATE'
          AND al.action IN (
            'RELIEF_PACK_TEMPLATE_CREATE',
            'RELIEF_PACK_TEMPLATE_UPDATE',
            'RELIEF_PACK_TEMPLATE_UPDATED',
            'RELIEF_PACK_TEMPLATE_ITEMS_UPDATED'
          )
        )
        OR (
          al.entity_type = 'DONATION'
          AND al.action IN (
            'DONATION_CREATE',
            'DONATION_UPDATE',
            'DONATION_PUBLIC_NAME_UPDATE'
          )
        )
        OR (
          al.entity_type = 'DONATION_ITEM'
          AND al.action = 'DONATION_ITEM_UPDATE'
        )
        OR (
          al.entity_type = 'DISTRIBUTION_TRANSACTION'
          AND al.action IN (
            'DISTRIBUTION_RECORD',
            'DISTRIBUTION_QR_CLAIM'
          )
        )
        OR (
          al.entity_type = 'SYNC_CONFLICT'
          AND al.action = 'SYNC_CONFLICT_RESOLUTION'
        )
        OR (
          al.entity_type = 'SYNC_TRANSACTION'
          AND al.action = 'SYNC_RETRY_REQUEST'
        )
      )
      ${moduleClause}
      ${auditActionClause}
      ${dateClause}
      ${searchClause}
    ORDER BY ${auditTimestampExpression} DESC, al.id DESC
    ${limitClause}
  `;

  const result = await dbClient.query(query, values);
  return result.rows;
};

const getErrorLogs = async ({ limit = 50 } = {}, dbClient = pool) => {
  const limitClause = Number.isInteger(limit) ? "LIMIT $1" : "";
  const values = Number.isInteger(limit) ? [limit] : [];
  const query = `
    SELECT
      el.id,
      el.module_name,
      el.error_code,
      el.error_message,
      el.stack_trace,
      el.severity,
      el.reference_type,
      el.reference_id,
      el.context_json,
      el.created_at,
      u.id AS user_id,
      u.first_name,
      u.last_name,
      u.email
    FROM error_logs el
    LEFT JOIN users u ON u.id = el.user_id
    ORDER BY el.created_at DESC
    ${limitClause}
  `;

  const result = await dbClient.query(query, values);
  return result.rows;
};

const getInventoryItemCreationRelatedAuditLogs = async (
  { itemIds = [] } = {},
  dbClient = pool,
) => {
  const normalizedItemIds = Array.from(
    new Set(
      (Array.isArray(itemIds) ? itemIds : [])
        .map((itemId) => String(itemId || "").trim())
        .filter(Boolean),
    ),
  );

  if (!normalizedItemIds.length) {
    return [];
  }

  const query = `
    SELECT
      al.id,
      al.action,
      al.entity_type,
      al.entity_id,
      al.role_code,
      al.old_values_json,
      al.new_values_json,
      al.ip_address,
      al.created_at,
      CASE
        WHEN al.entity_type = 'INVENTORY_ITEM_STOCK_FORM'
          THEN iisf_related.inventory_item_id::text
        WHEN al.entity_type = 'INVENTORY_BATCH'
          THEN ib_related.inventory_item_id::text
        WHEN al.entity_type = 'INVENTORY_TRANSACTION'
          THEN ib_transaction.inventory_item_id::text
        ELSE NULL
      END AS related_inventory_item_id
    FROM audit_logs al
    LEFT JOIN inventory_item_stock_forms iisf_related
      ON al.entity_type = 'INVENTORY_ITEM_STOCK_FORM'
      AND iisf_related.id = al.entity_id
    LEFT JOIN inventory_batches ib_related
      ON al.entity_type = 'INVENTORY_BATCH'
      AND ib_related.id = al.entity_id
    LEFT JOIN inventory_transactions it_related
      ON al.entity_type = 'INVENTORY_TRANSACTION'
      AND it_related.id = al.entity_id
    LEFT JOIN inventory_batches ib_transaction
      ON al.entity_type = 'INVENTORY_TRANSACTION'
      AND ib_transaction.id = it_related.inventory_batch_id
    WHERE al.created_at >= NOW() - INTERVAL '${AUDIT_LOG_RETENTION_YEARS} years'
      AND (
        (
          al.entity_type = 'INVENTORY_ITEM_STOCK_FORM'
          AND al.action = 'INVENTORY_ITEM_STOCK_FORM_CREATE'
          AND iisf_related.inventory_item_id::text = ANY($1::text[])
        )
        OR (
          al.entity_type = 'INVENTORY_BATCH'
          AND al.action = 'INVENTORY_BATCH_CREATE'
          AND ib_related.inventory_item_id::text = ANY($1::text[])
        )
        OR (
          al.entity_type = 'INVENTORY_TRANSACTION'
          AND al.action = 'INVENTORY_TRANSACTION_CREATE'
          AND al.new_values_json->>'transaction_type' = 'INFLOW'
          AND COALESCE(
            it_related.reference_type,
            al.new_values_json->>'reference_type',
            ''
          ) <> 'DONATION'
          AND ib_transaction.inventory_item_id::text = ANY($1::text[])
        )
      )
    ORDER BY al.created_at ASC, al.id ASC
  `;

  const result = await dbClient.query(query, [normalizedItemIds]);
  return result.rows;
};

const getInventoryPackagingAddedRelatedAuditLogs = async (
  { stockFormIds = [] } = {},
  dbClient = pool,
) => {
  const normalizedStockFormIds = Array.from(
    new Set(
      (Array.isArray(stockFormIds) ? stockFormIds : [])
        .map((stockFormId) => String(stockFormId || "").trim())
        .filter(Boolean),
    ),
  );

  if (!normalizedStockFormIds.length) {
    return [];
  }

  const query = `
    SELECT
      al.id,
      al.action,
      al.entity_type,
      al.entity_id,
      al.role_code,
      al.old_values_json,
      al.new_values_json,
      al.ip_address,
      al.created_at,
      CASE
        WHEN al.entity_type = 'INVENTORY_BATCH'
          THEN ib_related.inventory_item_stock_form_id::text
        WHEN al.entity_type = 'INVENTORY_TRANSACTION'
          THEN ib_transaction.inventory_item_stock_form_id::text
        ELSE NULL
      END AS related_inventory_item_stock_form_id
    FROM audit_logs al
    LEFT JOIN inventory_batches ib_related
      ON al.entity_type = 'INVENTORY_BATCH'
      AND ib_related.id = al.entity_id
    LEFT JOIN inventory_transactions it_related
      ON al.entity_type = 'INVENTORY_TRANSACTION'
      AND it_related.id = al.entity_id
    LEFT JOIN inventory_batches ib_transaction
      ON al.entity_type = 'INVENTORY_TRANSACTION'
      AND ib_transaction.id = it_related.inventory_batch_id
    WHERE al.created_at >= NOW() - INTERVAL '${AUDIT_LOG_RETENTION_YEARS} years'
      AND (
        (
          al.entity_type = 'INVENTORY_BATCH'
          AND al.action = 'INVENTORY_BATCH_CREATE'
          AND ib_related.inventory_item_stock_form_id::text = ANY($1::text[])
        )
        OR (
          al.entity_type = 'INVENTORY_TRANSACTION'
          AND al.action = 'INVENTORY_TRANSACTION_CREATE'
          AND al.new_values_json->>'transaction_type' = 'INFLOW'
          AND ib_transaction.inventory_item_stock_form_id::text = ANY($1::text[])
        )
      )
    ORDER BY al.created_at ASC, al.id ASC
  `;

  const result = await dbClient.query(query, [normalizedStockFormIds]);
  return result.rows;
};

const getAuditLogsByEntity = async (
  { entityType, entityId, limit = 20 },
  dbClient = pool,
) => {
  const query = `
    SELECT
      al.id,
      al.action,
      al.entity_type,
      al.entity_id,
      al.role_code,
      al.old_values_json,
      al.new_values_json,
      al.ip_address,
      al.created_at,
      u.id AS user_id,
      u.first_name,
      u.last_name,
      u.email
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE al.entity_type = $1
      AND al.entity_id = $2
    ORDER BY al.created_at DESC
    LIMIT $3
  `;

  const result = await dbClient.query(query, [entityType, entityId, limit]);
  return result.rows;
};

module.exports = {
  getAuditLogs,
  getAuditLogsByEntity,
  getInventoryItemCreationRelatedAuditLogs,
  getInventoryPackagingAddedRelatedAuditLogs,
  getErrorLogs,
  insertAuditLog,
  insertErrorLog,
};
