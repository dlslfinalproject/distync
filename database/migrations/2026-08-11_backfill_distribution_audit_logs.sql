-- Backfill Distribution audit logs.
-- Existing claimed distribution transactions should appear in Audit Trail as:
--   DISTRIBUTION_RECORD / DISTRIBUTION_QR_CLAIM -> Distributed Items
-- This migration does not change distribution, inventory, donation, or stub records.

BEGIN;

UPDATE audit_logs
SET action = 'DISTRIBUTION_RECORD'
WHERE entity_type = 'DISTRIBUTION_TRANSACTION'
  AND action IN (
    'DISTRIBUTION_CREATE',
    'DISTRIBUTION_CREATED',
    'DISTRIBUTION_RECORDED',
    'DISTRIBUTED_ITEMS'
  );

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
SELECT
  dt.verified_by,
  NULL,
  dt.device_id,
  CASE
    WHEN dt.qr_reference_value IS NULL THEN 'DISTRIBUTION_RECORD'
    ELSE 'DISTRIBUTION_QR_CLAIM'
  END,
  'DISTRIBUTION_TRANSACTION',
  dt.id,
  '{}'::jsonb,
  jsonb_build_object(
    'id', dt.id,
    'disaster_event_id', dt.disaster_event_id,
    'household_id', dt.household_id,
    'stub_id', dt.stub_id,
    'distribution_status', dt.distribution_status,
    'claimed_by_name', dt.claimed_by_name,
    'verified_by', dt.verified_by,
    'qr_reference_value', dt.qr_reference_value,
    'receipt_no', dt.receipt_no,
    'receipt_status', dt.receipt_status,
    'received_at', dt.received_at,
    'relief_pack_template_id', dt.relief_pack_template_id,
    'remarks', dt.remarks
  ),
  NULL,
  CONCAT('distribution-claim-backfill:', dt.id::text),
  dt.distribution_date
FROM distribution_transactions dt
WHERE dt.distribution_status = 'CLAIMED'
  AND NOT EXISTS (
    SELECT 1
    FROM audit_logs al
    WHERE al.entity_type = 'DISTRIBUTION_TRANSACTION'
      AND al.entity_id = dt.id
      AND al.action IN (
        'DISTRIBUTION_RECORD',
        'DISTRIBUTION_QR_CLAIM'
      )
  )
ON CONFLICT (source_event_key)
WHERE source_event_key IS NOT NULL
DO NOTHING;

COMMIT;
