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
  const auditTimestampExpression = "COALESCE(dt_direct.distribution_date, al.created_at)";
  const normalizedModule = String(module || "all").trim().toLowerCase();
  const normalizedAuditAction = String(auditAction || "all").trim().toLowerCase();
  const normalizedSearch = String(search || "").trim();
  const moduleCountConditions = {
    inventory: `
      (
        al.entity_type IN ('INVENTORY_ITEM', 'INVENTORY_BATCH')
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
  };
  let moduleClause = "";

  if (normalizedModule !== "all") {
    const moduleConditions = {
      inventory: `AND ${moduleCountConditions.inventory}`,
      "relief pack": `AND ${moduleCountConditions["relief pack"]}`,
      donation: `AND ${moduleCountConditions.donation}`,
      distribution: `AND ${moduleCountConditions.distribution}`,
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
      stock_added: `
        (
          (
            al.entity_type = 'INVENTORY_BATCH'
            AND al.action = 'INVENTORY_BATCH_CREATE'
          )
          OR (
            al.entity_type = 'INVENTORY_TRANSACTION'
            AND al.action = 'INVENTORY_TRANSACTION_CREATE'
            AND al.new_values_json->>'transaction_type' IN ('INFLOW', 'RETURN')
          )
        )
      `,
      stock_adjusted: `
        al.entity_type = 'INVENTORY_TRANSACTION'
        AND al.action = 'INVENTORY_TRANSACTION_CREATE'
        AND al.new_values_json->>'transaction_type' = 'ADJUSTMENT'
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
            AND al.action = 'DONATION_UPDATE'
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
        al.action ILIKE ${searchParam}
        OR al.entity_type ILIKE ${searchParam}
        OR al.role_code ILIKE ${searchParam}
        OR al.entity_id::text ILIKE ${searchParam}
        OR u.first_name ILIKE ${searchParam}
        OR u.last_name ILIKE ${searchParam}
        OR u.email ILIKE ${searchParam}
        OR CONCAT_WS(' ', u.first_name, u.last_name) ILIKE ${searchParam}
        OR ii_direct.item_name ILIKE ${searchParam}
        OR ii_batch.item_name ILIKE ${searchParam}
        OR ii_transaction.item_name ILIKE ${searchParam}
        OR ii_direct.barcode ILIKE ${searchParam}
        OR ii_batch.barcode ILIKE ${searchParam}
        OR ii_transaction.barcode ILIKE ${searchParam}
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
        OR rpt_distribution.name ILIKE ${searchParam}
        OR EXISTS (
          SELECT 1
          FROM distribution_transaction_relief_pack_templates dtrpt_search
          INNER JOIN relief_pack_templates rpt_search
            ON rpt_search.id = dtrpt_search.relief_pack_template_id
          WHERE dtrpt_search.distribution_transaction_id = dt_direct.id
            AND rpt_search.name ILIKE ${searchParam}
        )
        OR al.old_values_json::text ILIKE ${searchParam}
        OR al.new_values_json::text ILIKE ${searchParam}
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
      u.id AS user_id,
      u.first_name,
      u.last_name,
      u.email,
      COALESCE(
        ii_direct.item_name,
        ii_batch.item_name,
        ii_transaction.item_name
      ) AS inventory_item_name,
      COALESCE(
        ii_direct.is_active,
        ii_batch.is_active,
        ii_transaction.is_active
      ) AS inventory_item_is_active,
      COALESCE(
        ib_direct.batch_no,
        ib_transaction.batch_no
      ) AS inventory_batch_no,
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
      donation_items.items AS donation_items_json,
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
    LEFT JOIN distribution_transactions dt_direct
      ON al.entity_type = 'DISTRIBUTION_TRANSACTION'
      AND dt_direct.id = al.entity_id
    LEFT JOIN users u_distribution
      ON u_distribution.id = dt_direct.verified_by
    LEFT JOIN relief_pack_templates rpt_distribution
      ON rpt_distribution.id = dt_direct.relief_pack_template_id
    LEFT JOIN LATERAL (
      SELECT STRING_AGG(
        DISTINCT linked_template.name,
        ', ' ORDER BY linked_template.name
      ) AS names
      FROM relief_pack_templates linked_template
      WHERE linked_template.id = dt_direct.relief_pack_template_id
        OR EXISTS (
          SELECT 1
          FROM distribution_transaction_relief_pack_templates linked_template_row
          WHERE linked_template_row.distribution_transaction_id = dt_direct.id
            AND linked_template_row.relief_pack_template_id = linked_template.id
        )
    ) distribution_template_names ON TRUE
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'item_name', ii_donation.item_name,
          'quantity_received', di_donation.quantity_received,
          'unit_of_measure', ii_donation.unit_of_measure,
          'remarks', di_donation.remarks
        )
        ORDER BY di_donation.created_at ASC, ii_donation.item_name ASC
      ) AS items
      FROM donation_items di_donation
      INNER JOIN inventory_items ii_donation
        ON ii_donation.id = di_donation.inventory_item_id
      WHERE di_donation.donation_id = COALESCE(
        d_direct.id,
        d_item.id,
        d_transaction.id
      )
    ) donation_items ON TRUE
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'item_name', ii_distribution.item_name,
          'quantity_released', dti_distribution.quantity_released,
          'unit_of_measure', ii_distribution.unit_of_measure,
          'batch_no', ib_distribution.batch_no,
          'donor_name', d_distribution.donor_name,
          'donation_remarks', di_distribution.remarks,
          'source_type', ib_distribution.source_type
        )
        ORDER BY ii_distribution.item_name ASC, dti_distribution.created_at ASC
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
      AND (
        (
          (
            (
              al.entity_type = 'INVENTORY_ITEM'
              AND al.action IN ('INVENTORY_ITEM_CREATE', 'INVENTORY_ITEM_UPDATE')
            )
            OR (
              al.entity_type = 'INVENTORY_BATCH'
              AND al.action = 'INVENTORY_BATCH_CREATE'
            )
            OR (
              al.entity_type = 'INVENTORY_BATCH'
              AND al.action = 'INVENTORY_BATCH_UPDATE'
              AND al.old_values_json->>'expiration_date'
                IS DISTINCT FROM al.new_values_json->>'expiration_date'
            )
            OR (
              al.entity_type = 'INVENTORY_TRANSACTION'
              AND al.action = 'INVENTORY_TRANSACTION_CREATE'
              AND al.new_values_json->>'transaction_type' IN (
                'INFLOW',
                'RETURN',
                'ADJUSTMENT',
                'EXPIRED',
                'MISSING',
                'DAMAGED',
                'SPOILED',
                'STOLEN',
                'OTHER'
              )
            )
          )
          AND COALESCE(
            ii_direct.is_active,
            ii_batch.is_active,
            ii_transaction.is_active
          ) IS TRUE
        )
        OR (
          al.entity_type = 'RELIEF_PACK_TEMPLATE'
          AND al.action IN (
            'RELIEF_PACK_TEMPLATE_CREATE',
            'RELIEF_PACK_TEMPLATE_UPDATE',
            'RELIEF_PACK_TEMPLATE_UPDATED',
            'RELIEF_PACK_TEMPLATE_ITEMS_UPDATED'
          )
          AND COALESCE(
            rpt_direct.is_active,
            NULLIF(al.new_values_json->>'is_active', '')::boolean,
            TRUE
          ) IS TRUE
        )
        OR (
          al.entity_type = 'DONATION'
          AND al.action IN (
            'DONATION_CREATE',
            'DONATION_UPDATE'
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
          AND COALESCE(
            dt_direct.distribution_status,
            al.new_values_json->>'distribution_status'
          ) = 'CLAIMED'
        )
      )
      ${moduleClause}
      ${auditActionClause}
      ${dateClause}
      ${searchClause}
    ORDER BY al.created_at DESC, al.id DESC
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
  getErrorLogs,
  insertAuditLog,
  insertErrorLog,
};
