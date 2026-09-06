import assert from "node:assert/strict";
import test from "node:test";

import {
  getReliefPackReadinessForTemplates,
  RELIEF_PACK_READINESS_STATUS,
} from "../src/features/relief-pack-templates/reliefPackReadiness.js";

const activeEvent = {
  id: "event-1",
  status: "ACTIVE",
};

const buildTemplate = (overrides = {}) => ({
  id: "template-1",
  name: "Standard Pack",
  is_active: true,
  is_additional_pack: false,
  based_on_family_size: false,
  items: [
    {
      inventory_item_id: "item-1",
      item_name: "Water",
      quantity_required: 1,
    },
  ],
  ...overrides,
});

const buildBatch = (overrides = {}) => ({
  id: "batch-1",
  inventory_item_id: "item-1",
  quantity_available: 1,
  status: "AVAILABLE",
  source_type: "LGU",
  expiration_date: null,
  ...overrides,
});

test("Mayor readiness treats a complete assigned pack as ready", () => {
  const result = getReliefPackReadinessForTemplates({
    templates: [buildTemplate()],
    inventoryBatches: [buildBatch()],
    targetDisasterEventId: activeEvent.id,
    disasterEvents: [activeEvent],
  });

  assert.equal(result.status, RELIEF_PACK_READINESS_STATUS.READY);
  assert.equal(result.byTemplateId.get("template-1").isReady, true);
  assert.equal(
    result.byTemplateId.get("template-1").label,
    "Ready for Distribution",
  );
});

test("Mayor readiness excludes near-expiring stock and requests replenishment", () => {
  const result = getReliefPackReadinessForTemplates({
    templates: [buildTemplate()],
    inventoryBatches: [
      buildBatch({
        expiration_date: "2026-09-20",
      }),
    ],
    targetDisasterEventId: activeEvent.id,
    disasterEvents: [activeEvent],
    referenceDate: new Date("2026-09-05T00:00:00.000Z"),
  });

  assert.equal(result.status, RELIEF_PACK_READINESS_STATUS.NEEDS_REPLENISHMENT);
  assert.equal(result.byTemplateId.get("template-1").isReady, false);
  assert.equal(
    result.byTemplateId.get("template-1").label,
    "Needs Replenishment",
  );
});

test("readiness preserves standard-pack priority when packs share an item stock pool", () => {
  const standardTemplate = buildTemplate({
    id: "standard-template",
    name: "Standard Pack",
    items: [
      {
        inventory_item_id: "item-1",
        item_name: "Water",
        quantity_required: 2,
      },
    ],
  });
  const additionalTemplate = buildTemplate({
    id: "additional-template",
    name: "Senior Pack",
    is_additional_pack: true,
    items: [
      {
        inventory_item_id: "item-1",
        item_name: "Water",
        quantity_required: 1,
      },
    ],
  });

  const result = getReliefPackReadinessForTemplates({
    templates: [additionalTemplate, standardTemplate],
    inventoryBatches: [buildBatch({ quantity_available: 2 })],
    targetDisasterEventId: activeEvent.id,
    disasterEvents: [activeEvent],
  });

  assert.equal(
    result.byTemplateId.get("standard-template").status,
    RELIEF_PACK_READINESS_STATUS.READY,
  );
  assert.equal(
    result.byTemplateId.get("additional-template").status,
    RELIEF_PACK_READINESS_STATUS.NEEDS_REPLENISHMENT,
  );
});
