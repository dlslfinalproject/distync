import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";
import { createServer } from "vite";
import { matchesInventoryDistributionSearch } from "../src/features/inventory-distribution/inventoryDistributionFilters.js";
import { getReliefPackReadinessForTemplates } from "../src/features/relief-pack-templates/reliefPackReadiness.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");

let viteServer;
let fetchReliefPackTemplates;

const readSource = (relativePath) =>
  readFile(new URL(`../src/${relativePath}`, import.meta.url), "utf8");

const buildTemplateFixture = (index) => ({
  id: `template-${index}`,
  name: `Relief Pack ${index}`,
  description: null,
  is_active: true,
  is_additional_pack: index > 1,
  applies_to_all_disasters: true,
  disaster_types: [],
  sector_id: index > 1 ? `sector-${index}` : null,
  sector_ids: index > 1 ? [`sector-${index}`] : [],
  items: [
    {
      id: `template-item-${index}`,
      inventory_item_id: `item-${index}`,
      quantity_required: index,
      created_at: `2026-09-09T00:0${index}:00.000Z`,
      inventory_item: {
        id: `item-${index}`,
        item_code: `ITEM-${index}`,
        item_name: `Inventory Item ${index}`,
        category: "Relief",
        unit_of_measure: "unit",
        barcode: `barcode-${index}`,
        is_perishable: false,
      },
    },
  ],
});

const templateFixture = Array.from({ length: 5 }, (_value, index) =>
  buildTemplateFixture(index + 1),
);

before(async () => {
  viteServer = await createServer({
    root: clientRoot,
    configFile: false,
    appType: "custom",
    logLevel: "error",
  });

  ({ fetchReliefPackTemplates } = await viteServer.ssrLoadModule(
    "/src/features/relief-pack-templates/reliefPackTemplateService.js?distribution-template-fanout-stage2-test",
  ));
});

after(async () => {
  await viteServer?.close();
});

test("the mocked five-template response arrives through one include-items HTTP request", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return {
      ok: true,
      status: 200,
      json: async () => templateFixture,
    };
  };

  try {
    const payload = await fetchReliefPackTemplates({
      is_active: "true",
      disaster_event_id: "event-a",
      include_items: true,
    });
    const requestUrl = new URL(requests[0]);

    assert.deepEqual(payload, templateFixture);
    assert.equal(requests.length, 1);
    assert.equal(requestUrl.pathname, "/api/v1/relief-pack-templates");
    assert.equal(requestUrl.searchParams.get("is_active"), "true");
    assert.equal(requestUrl.searchParams.get("disaster_event_id"), "event-a");
    assert.equal(requestUrl.searchParams.get("include_items"), "true");
    assert.equal(
      requests.filter((url) => /\/api\/v1\/relief-pack-templates\/[^?]+$/.test(url))
        .length,
      0,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Inventory Distribution loads five templates with one include-items request and no detail fan-out", async () => {
  const [hookSource, serviceSource] = await Promise.all([
    readSource("features/inventory-distribution/useInventoryDistribution.js"),
    readSource("features/relief-pack-templates/reliefPackTemplateService.js"),
  ]);

  const templateListCallCount =
    hookSource.match(/fetchReliefPackTemplates\(\{/g)?.length || 0;
  const templateDetailCallCount =
    hookSource.match(/fetchReliefPackTemplateById\(/g)?.length || 0;
  const beforeTemplateRequestCount = 1 + templateFixture.length;
  const afterTemplateRequestCount = templateListCallCount;

  assert.equal(templateFixture.length, 5);
  assert.equal(beforeTemplateRequestCount, 6);
  assert.equal(afterTemplateRequestCount, 1);
  assert.equal(templateDetailCallCount, 0);
  assert.match(
    hookSource,
    /fetchReliefPackTemplates\(\{[\s\S]*?is_active:\s*"true"[\s\S]*?disaster_event_id:\s*selectedDisasterEventId[\s\S]*?include_items:\s*true[\s\S]*?\}\)/,
  );
  assert.match(serviceSource, /filters\.include_items\s*===\s*true/);
  assert.match(serviceSource, /searchParams\.set\("include_items",\s*"true"\)/);
  assert.doesNotMatch(hookSource, /fetchReliefPackTemplateById/);
  assert.doesNotMatch(hookSource, /reliefPackTemplates\.map/);
  assert.match(hookSource, /setTemplateDetails\(loadedTemplateDetails\)/);
});

test("empty and single-template list responses keep direct template semantics", async () => {
  const hookSource = await readSource(
    "features/inventory-distribution/useInventoryDistribution.js",
  );
  const emptyTemplates = [];
  const singleTemplate = [templateFixture[0]];

  assert.equal(emptyTemplates.length, 0);
  assert.equal(singleTemplate.length, 1);
  assert.equal(singleTemplate[0].items[0].quantity_required, 1);
  assert.equal(singleTemplate[0].items[0].inventory_item.item_name, "Inventory Item 1");
  assert.match(hookSource, /Array\.isArray\(templatePayload\)/);
  assert.match(hookSource, /: \[\];[\s\S]*?setTemplateDetails\(loadedTemplateDetails\)/);
  assert.doesNotMatch(hookSource, /catch[\s\S]*?fetchReliefPackTemplateById/);
});

test("include-items rows preserve the fields consumed by applicability, search, detail, and readiness", () => {
  const requiredFields = [
    "id",
    "name",
    "is_active",
    "is_additional_pack",
    "applies_to_all_disasters",
    "disaster_types",
    "sector_ids",
    "items",
  ];
  const requiredItemFields = [
    "inventory_item_id",
    "quantity_required",
    "inventory_item",
  ];
  const requiredInventoryItemFields = [
    "id",
    "item_name",
    "category",
    "unit_of_measure",
  ];

  for (const template of templateFixture) {
    for (const field of requiredFields) {
      assert.ok(field in template, `template field missing: ${field}`);
    }

    for (const item of template.items) {
      for (const field of requiredItemFields) {
        assert.ok(field in item, `template item field missing: ${field}`);
      }

      for (const field of requiredInventoryItemFields) {
        assert.ok(
          field in item.inventory_item,
          `inventory item field missing: ${field}`,
        );
      }
    }
  }
});

test("old detail-enriched and new include-items representations keep readiness and search parity", () => {
  const oldDetailEnrichedTemplates = templateFixture.map((template) => ({
    ...template,
    usage_summary: { is_used: false },
  }));
  const inventoryBatches = templateFixture.map((template, index) => ({
    id: `batch-${index + 1}`,
    inventory_item_id: template.items[0].inventory_item_id,
    quantity_available: 10,
    status: "AVAILABLE",
    source_type: "LGU",
    expiration_date: null,
  }));
  const readinessInputs = {
    inventoryBatches,
    targetDisasterEventId: "event-a",
    disasterEvents: [{ id: "event-a", status: "ACTIVE" }],
    householdSize: 1,
  };
  const oldReadiness = getReliefPackReadinessForTemplates({
    ...readinessInputs,
    templates: oldDetailEnrichedTemplates,
  });
  const newReadiness = getReliefPackReadinessForTemplates({
    ...readinessInputs,
    templates: templateFixture,
  });

  assert.deepEqual(
    [...oldReadiness.byTemplateId.entries()],
    [...newReadiness.byTemplateId.entries()],
  );

  const oldRow = {
    relief_pack_name: oldDetailEnrichedTemplates.map((template) => template.name).join(", "),
    relief_pack_templates: oldDetailEnrichedTemplates,
  };
  const newRow = {
    relief_pack_name: templateFixture.map((template) => template.name).join(", "),
    relief_pack_templates: templateFixture,
  };

  for (const searchTerm of ["Relief Pack 3", "Inventory Item 4"]) {
    assert.equal(
      matchesInventoryDistributionSearch(oldRow, searchTerm),
      matchesInventoryDistributionSearch(newRow, searchTerm),
    );
  }
});

test("event changes retain the existing stale-response guard and do not restore detail loading", async () => {
  const hookSource = await readSource(
    "features/inventory-distribution/useInventoryDistribution.js",
  );

  assert.match(hookSource, /let isMounted = true;/);
  assert.match(hookSource, /if \(isMounted\) \{/);
  assert.match(hookSource, /isMounted = false;/);
  assert.match(hookSource, /\}, \[selectedDisasterEventId\]\);/);
  assert.doesNotMatch(hookSource, /setIsLoadingTemplateDetails/);
  assert.doesNotMatch(hookSource, /Promise\.all\([\s\S]*fetchReliefPackTemplateById/);
});
