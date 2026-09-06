BEGIN;

-- A stub is the first assignment record for an evacuation-center household.
-- Keep the relief-pack definition that was assigned at issuance so later
-- template edits, deactivation, or item changes cannot rewrite the event
-- history shown for an unclaimed household.
ALTER TABLE public.stubs
  ADD COLUMN IF NOT EXISTS assigned_relief_pack_snapshots jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stubs_assigned_relief_pack_snapshots_array_check'
  ) THEN
    ALTER TABLE public.stubs
      ADD CONSTRAINT stubs_assigned_relief_pack_snapshots_array_check
      CHECK (
        assigned_relief_pack_snapshots IS NULL
        OR jsonb_typeof(assigned_relief_pack_snapshots) = 'array'
      );
  END IF;
END;
$$;

-- Existing issued rows predate this snapshot field. Capture the best
-- available assignment once, without overwriting any later application data.
-- Claimed rows are still rendered from their distribution transaction
-- snapshots, but backfilling them keeps the stub record complete as well.
WITH household_sector_scope AS (
  SELECT
    h.id AS household_id,
    ARRAY_AGG(DISTINCT sector_rows.sector_id)::uuid[] AS sector_ids
  FROM households h
  LEFT JOIN (
    SELECT
      hs.household_id,
      hs.sector_id
    FROM household_sectors hs

    UNION

    SELECT
      e.household_id,
      es.sector_id
    FROM evacuees e
    INNER JOIN evacuee_sectors es
      ON es.evacuee_id = e.id
    WHERE e.is_active = TRUE
  ) sector_rows
    ON sector_rows.household_id = h.id
  GROUP BY h.id
), assigned_templates AS (
  SELECT
    s.id AS stub_id,
    rpt.id AS relief_pack_template_id,
    rpt.name,
    CASE
      WHEN rpt.is_additional_pack = TRUE
       AND LEFT(
         COALESCE(rpt.description, ''),
         LENGTH('__relief_pack_sector_ids__:')
       ) = '__relief_pack_sector_ids__:'
      THEN NULL
      ELSE rpt.description
    END AS description,
    rpt.based_on_family_size,
    rpt.based_on_sector,
    rpt.is_additional_pack,
    rpt.sector_id,
    rpt.applies_to_all_disasters,
    de.disaster_type,
    CASE
      WHEN rpt.based_on_family_size = TRUE
       AND NULLIF(BTRIM(rpt.description), '') ~ '^[0-9]+$'
       AND NULLIF(BTRIM(rpt.description), '')::numeric > 0
       AND h.household_size > 0
      THEN GREATEST(
        1,
        CEIL(
          h.household_size::numeric /
          NULLIF(BTRIM(rpt.description), '')::numeric
        )
      )::integer
      ELSE 1
    END AS pack_multiplier,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'inventory_item_id', rpti.inventory_item_id,
          'item_code', ii.item_code,
          'item_name', ii.item_name,
          'category', ii.category,
          'unit_of_measure', ii.unit_of_measure,
          'quantity_required', rpti.quantity_required
        )
        ORDER BY ii.item_name ASC, rpti.id ASC
      ) FILTER (WHERE rpti.id IS NOT NULL),
      '[]'::jsonb
    ) AS items
  FROM stubs s
  INNER JOIN households h
    ON h.id = s.household_id
  INNER JOIN disaster_events de
    ON de.id = s.disaster_event_id
  INNER JOIN relief_pack_templates rpt
    ON rpt.is_active = TRUE
  LEFT JOIN relief_pack_template_items rpti
    ON rpti.template_id = rpt.id
  LEFT JOIN inventory_items ii
    ON ii.id = rpti.inventory_item_id
  LEFT JOIN household_sector_scope hss
    ON hss.household_id = h.id
  WHERE s.assigned_relief_pack_snapshots IS NULL
    AND (
      NULLIF(BTRIM(de.disaster_type), '') IS NULL
      OR rpt.applies_to_all_disasters = TRUE
      OR EXISTS (
        SELECT 1
        FROM relief_pack_template_disaster_types rptdt
        WHERE rptdt.template_id = rpt.id
          AND (
            rptdt.disaster_type = BTRIM(de.disaster_type)
            OR (
              BTRIM(de.disaster_type) NOT IN (
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
              AND rptdt.disaster_type = 'Other'
            )
          )
      )
    )
    AND (
      rpt.is_additional_pack = FALSE
      OR rpt.sector_id = ANY(COALESCE(hss.sector_ids, ARRAY[]::uuid[]))
      OR EXISTS (
        SELECT 1
        FROM JSONB_ARRAY_ELEMENTS_TEXT(
          CASE
            WHEN LEFT(
              COALESCE(rpt.description, ''),
              LENGTH('__relief_pack_sector_ids__:')
            ) = '__relief_pack_sector_ids__:'
            THEN SUBSTRING(
              rpt.description
              FROM LENGTH('__relief_pack_sector_ids__:') + 1
            )::jsonb
            ELSE '[]'::jsonb
          END
        ) encoded_sector(sector_id)
        WHERE encoded_sector.sector_id = ANY(
          ARRAY(
            SELECT sector_id::text
            FROM UNNEST(COALESCE(hss.sector_ids, ARRAY[]::uuid[])) AS sector_value(sector_id)
          )
        )
      )
    )
  GROUP BY
    s.id,
    rpt.id,
    rpt.name,
    rpt.description,
    rpt.based_on_family_size,
    rpt.based_on_sector,
    rpt.is_additional_pack,
    rpt.sector_id,
    rpt.applies_to_all_disasters,
    de.disaster_type,
    h.household_size
), snapshots_by_stub AS (
  SELECT
    stub_id,
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'relief_pack_template_id', relief_pack_template_id,
        'name', name,
        'description', description,
        'based_on_family_size', based_on_family_size,
        'based_on_sector', based_on_sector,
        'is_additional_pack', is_additional_pack,
        'sector_id', sector_id,
        'applies_to_all_disasters', applies_to_all_disasters,
        'disaster_type', disaster_type,
        'pack_multiplier', pack_multiplier,
        'items', items,
        'assigned_at', NOW()
      )
      ORDER BY
        is_additional_pack ASC,
        based_on_family_size DESC,
        name ASC,
        relief_pack_template_id ASC
    ) AS snapshots
  FROM assigned_templates
  GROUP BY stub_id
)
UPDATE public.stubs s
SET assigned_relief_pack_snapshots = COALESCE(
  snapshots_by_stub.snapshots,
  '[]'::jsonb
)
FROM snapshots_by_stub
WHERE s.id = snapshots_by_stub.stub_id
  AND s.assigned_relief_pack_snapshots IS NULL;

-- Rows with no currently applicable template still need an explicit empty
-- snapshot; otherwise a later template activation would appear as a new past
-- assignment. This is deliberately limited to the remaining legacy rows.
UPDATE public.stubs
SET assigned_relief_pack_snapshots = '[]'::jsonb
WHERE assigned_relief_pack_snapshots IS NULL;

CREATE INDEX IF NOT EXISTS stubs_assigned_relief_pack_snapshots_gin
  ON public.stubs USING gin (assigned_relief_pack_snapshots);

COMMIT;
