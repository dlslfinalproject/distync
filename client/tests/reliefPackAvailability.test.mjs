import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateSharedReliefPackInventory,
  sortReliefPackTemplatesForSharedInventory,
} from "../src/features/relief-pack-templates/reliefPackAvailability.js";

const buildTemplate = (overrides = {}) => ({
  id: "template-1",
  name: "Base Pack",
  is_active: true,
  is_additional_pack: false,
  based_on_family_size: false,
  items: [
    {
      inventory_item_id: "item-1",
      quantity_required: 1,
      inventory_item: { item_name: "Rice" },
    },
  ],
  ...overrides,
});

test("shared relief-pack allocation prioritizes standard templates and consumes one stock pool", () => {
  const standardTemplate = buildTemplate({
    id: "standard",
    name: "Standard Pack",
    items: [
      {
        inventory_item_id: "item-1",
        quantity_required: 2,
        inventory_item: { item_name: "Rice" },
      },
    ],
  });
  const additionalTemplate = buildTemplate({
    id: "additional",
    name: "Senior Pack",
    is_additional_pack: true,
    items: [
      {
        inventory_item_id: "item-1",
        quantity_required: 3,
        inventory_item: { item_name: "Rice" },
      },
    ],
  });

  const { allocationByTemplateId, remainingAvailabilityByItemId } =
    allocateSharedReliefPackInventory({
      templates: [additionalTemplate, standardTemplate],
      availabilityByItemId: new Map([["item-1", 4]]),
      demandByTemplateId: new Map([
        ["standard", { neededPacks: 1 }],
        ["additional", { neededPacks: 1 }],
      ]),
    });

  assert.equal(
    allocationByTemplateId.get("standard").packsWeCanCreate,
    1,
  );
  assert.equal(
    allocationByTemplateId.get("additional").packsWeCanCreate,
    0,
  );
  assert.equal(
    allocationByTemplateId.get("additional").availableStockByItemId.get("item-1"),
    2,
  );
  assert.deepEqual(allocationByTemplateId.get("additional").shortageItems, [
    {
      inventory_item_id: "item-1",
      item_name: "Rice",
      shortage_quantity: 1,
    },
  ]);
  assert.equal(remainingAvailabilityByItemId.get("item-1"), 2);
});

test("shared relief-pack allocation skips templates without current demand and caps stock to actual need", () => {
  const fireTemplate = buildTemplate({
    id: "fire",
    name: "Fire Relief Packs",
    items: [
      {
        inventory_item_id: "item-1",
        quantity_required: 2,
        inventory_item: { item_name: "Bath Towel" },
      },
    ],
  });
  const additionalTemplate = buildTemplate({
    id: "additional",
    name: "Marginalized Pack",
    is_additional_pack: true,
    items: [
      {
        inventory_item_id: "item-1",
        quantity_required: 3,
        inventory_item: { item_name: "Bath Towel" },
      },
    ],
  });

  const { allocationByTemplateId, remainingAvailabilityByItemId } =
    allocateSharedReliefPackInventory({
      templates: [fireTemplate, additionalTemplate],
      availabilityByItemId: new Map([["item-1", 40]]),
      demandByTemplateId: new Map([
        ["fire", { neededPacks: 0 }],
        ["additional", { neededPacks: 1 }],
      ]),
    });

  assert.equal(allocationByTemplateId.get("fire").packsWeCanCreate, 0);
  assert.equal(
    allocationByTemplateId.get("fire").allocatedStockByItemId.get("item-1"),
    0,
  );
  assert.equal(
    allocationByTemplateId.get("additional").packsWeCanCreate,
    1,
  );
  assert.equal(
    allocationByTemplateId.get("additional").availableStockByItemId.get("item-1"),
    40,
  );
  assert.equal(remainingAvailabilityByItemId.get("item-1"), 37);
});

test("shared relief-pack shortages use the stock left after higher-priority packs", () => {
  const standardTemplate = buildTemplate({
    id: "standard",
    name: "Standard Pack",
    items: [
      {
        inventory_item_id: "item-1",
        quantity_required: 2,
        inventory_item: { item_name: "Rice" },
      },
    ],
  });
  const additionalTemplate = buildTemplate({
    id: "additional",
    name: "Senior Pack",
    is_additional_pack: true,
    items: [
      {
        inventory_item_id: "item-1",
        quantity_required: 2,
        inventory_item: { item_name: "Rice" },
      },
    ],
  });

  const { allocationByTemplateId } = allocateSharedReliefPackInventory({
    templates: [standardTemplate, additionalTemplate],
    availabilityByItemId: new Map([["item-1", 3]]),
    demandByTemplateId: new Map([
      ["standard", { neededPacks: 1 }],
      ["additional", { neededPacks: 1 }],
    ]),
  });

  const additionalAllocation = allocationByTemplateId.get("additional");

  assert.equal(additionalAllocation.packsWeCanCreate, 0);
  assert.equal(
    additionalAllocation.availableStockByItemId.get("item-1"),
    1,
  );
  assert.deepEqual(additionalAllocation.shortageItems, [
    {
      inventory_item_id: "item-1",
      item_name: "Rice",
      shortage_quantity: 1,
    },
  ]);
});

test("shared relief-pack allocation remains deterministic and ignores inactive templates", () => {
  const familySizeTemplate = buildTemplate({
    id: "family-size",
    name: "Zeta Pack",
    based_on_family_size: true,
  });
  const standardTemplate = buildTemplate({
    id: "standard",
    name: "Alpha Pack",
  });
  const additionalTemplate = buildTemplate({
    id: "additional",
    name: "Additional Pack",
    is_additional_pack: true,
  });
  const inactiveTemplate = buildTemplate({
    id: "inactive",
    name: "Inactive Pack",
    is_active: false,
  });

  assert.deepEqual(
    sortReliefPackTemplatesForSharedInventory([
      additionalTemplate,
      standardTemplate,
      inactiveTemplate,
      familySizeTemplate,
    ]).map((template) => template.id),
    ["family-size", "standard", "additional"],
  );

  const { allocationByTemplateId } = allocateSharedReliefPackInventory({
    templates: [additionalTemplate, standardTemplate, inactiveTemplate],
    availabilityByItemId: new Map([["item-1", 2]]),
    demandByTemplateId: new Map([
      ["standard", { neededPacks: 1 }],
      ["additional", { neededPacks: 1 }],
    ]),
  });

  assert.equal(allocationByTemplateId.get("inactive").packsWeCanCreate, 0);
  assert.equal(allocationByTemplateId.get("standard").packsWeCanCreate, 1);
  assert.equal(allocationByTemplateId.get("additional").packsWeCanCreate, 1);
});
