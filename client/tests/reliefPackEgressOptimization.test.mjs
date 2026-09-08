import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  buildReliefPackTemplateDemandFromAggregates,
  formatDisasterEventOptionLabel,
} from "../src/features/relief-pack-templates/reliefPackDemandAggregation.mjs";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

const EVENT_A = "11111111-1111-4111-8111-111111111111";
const EVENT_B = "22222222-2222-4222-8222-222222222222";
const TEMPLATE_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_TEMPLATE_ID = "55555555-5555-4555-8555-555555555555";
const BARANGAY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BARANGAY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("aggregate demand projection preserves per-event and per-barangay totals", () => {
  const event = {
    id: EVENT_A,
    event_code: "DE-2026-0001",
    title: "DE-2026-0001: Typhoon response",
    disaster_type: "Typhoon",
  };
  const template = { id: TEMPLATE_ID };
  const aggregates = [
    {
      template_id: TEMPLATE_ID,
      disaster_event_id: EVENT_A,
      barangay_id: BARANGAY_A,
      barangay_name: "Barangay A",
      families_count: 2,
      packs_needed: 3,
    },
    {
      template_id: TEMPLATE_ID,
      disaster_event_id: EVENT_A,
      barangay_id: BARANGAY_B,
      barangay_name: "Barangay B",
      families_count: 1,
      packs_needed: 2,
    },
    {
      template_id: TEMPLATE_ID,
      disaster_event_id: EVENT_B,
      barangay_id: BARANGAY_A,
      barangay_name: "Barangay A",
      families_count: 99,
      packs_needed: 99,
    },
    {
      template_id: OTHER_TEMPLATE_ID,
      disaster_event_id: EVENT_A,
      barangay_id: BARANGAY_A,
      barangay_name: "Barangay A",
      families_count: 50,
      packs_needed: 50,
    },
  ];

  const result = buildReliefPackTemplateDemandFromAggregates(
    template,
    aggregates,
    event,
  );

  assert.equal(formatDisasterEventOptionLabel(event), "Typhoon response");
  assert.equal(result.neededPacks, 5);
  assert.deepEqual(
    result.perBarangayDemand.map(({ barangay_id, families_count, packs_needed }) => ({
      barangay_id,
      families_count,
      packs_needed,
    })),
    [
      { barangay_id: BARANGAY_A, families_count: 2, packs_needed: 3 },
      { barangay_id: BARANGAY_B, families_count: 1, packs_needed: 2 },
    ],
  );
  assert.deepEqual(result.perEventDemand, [
    {
      disaster_event_id: EVENT_A,
      disaster_event_name: "Typhoon response",
      families_count: 3,
      packs_needed: 5,
    },
  ]);
});

test("empty events and no eligible households remain zero-demand states", () => {
  const result = buildReliefPackTemplateDemandFromAggregates(
    { id: TEMPLATE_ID },
    [],
    { id: EVENT_A, title: "Flood response", disaster_type: "Flood" },
  );

  assert.deepEqual(result, {
    neededPacks: 0,
    perBarangayDemand: [],
    perEventDemand: [],
  });
});

test("Relief Pack Templates uses the aggregate endpoint and retains required refresh triggers", async () => {
  const [pageSource, demandServiceSource, templateServiceSource] =
    await Promise.all([
      readSource(["pages", "inventory", "ReliefPackTemplatesPage.jsx"]),
      readSource([
        "features",
        "relief-pack-templates",
        "reliefPackDemandService.js",
      ]),
      readSource([
        "features",
        "relief-pack-templates",
        "reliefPackTemplateService.js",
      ]),
    ]);

  assert.doesNotMatch(pageSource, /fetchConsolidatedMasterlist/);
  assert.doesNotMatch(pageSource, /\/api\/v1\/masterlist/);
  assert.match(pageSource, /fetchReliefPackDemand/);
  assert.match(pageSource, /demandAggregates/);
  assert.match(pageSource, /fetchReliefPackTemplates\(\{\s*is_active:\s*"",\s*include_items:\s*true\s*\}\)/);
  assert.doesNotMatch(
    pageSource,
    /Promise\.all\(\s*\(templateResponse\s*\|\|\s*\[\]\)\.map\([\s\S]*fetchReliefPackTemplateById/,
  );
  assert.match(pageSource, /setInterval\(refreshInventoryDrivenMetrics,\s*30000\)/);
  assert.match(
    pageSource,
    /loadReliefPackPage\(\{ silent: true, includeStaticOptions: false \}\)/,
  );
  assert.match(pageSource, /setInterval\(loadAggregatedDemand,\s*30000\)/);
  assert.match(pageSource, /addEventListener\("focus",\s*refreshInventoryDrivenMetrics\)/);
  assert.match(pageSource, /addEventListener\("visibilitychange",\s*handleVisibilityRefresh\)/);
  assert.match(pageSource, /pageRefreshInFlightRef/);
  assert.match(pageSource, /demandRefreshInFlightRef/);
  assert.match(pageSource, /pageRefreshFollowUpRef/);
  assert.match(
    pageSource,
    /const existingRequest = pageRefreshInFlightRef\.current;[\s\S]*?if \(silent\) \{\s*return existingRequest\.promise;/,
  );
  assert.match(pageSource, /pageRefreshFollowUpRef\.current = true/);
  assert.match(
    pageSource,
    /existingRequest\?\.scopeKey === demandScopeKey[\s\S]*?return existingRequest\.promise;/,
  );
  assert.match(demandServiceSource, /relief-pack-templates\/demand/);
  assert.match(demandServiceSource, /disaster_event_ids/);
  assert.match(templateServiceSource, /include_items/);
});

test("Relief Pack Templates keeps demand error and empty-state handling", async () => {
  const source = await readSource(["pages", "inventory", "ReliefPackTemplatesPage.jsx"]);

  assert.match(source, /const emptyDashboardState = \{\s*rows:\s*\[\],\s*\}/);
  assert.match(source, /setAggregatedDemand\(emptyDashboardState\)/);
  assert.match(source, /catch \(_error\) \{[\s\S]*setAggregatedDemand\(emptyDashboardState\)/);
  assert.match(source, /if \(disasterEventIds\.length === 0\)/);
});

test("successful template mutations still await the page refresh", async () => {
  const source = await readSource(["pages", "inventory", "ReliefPackTemplatesPage.jsx"]);

  assert.match(source, /await updateReliefPackTemplateStatus\([\s\S]*?await loadReliefPackPage\(\)/);
  assert.match(source, /await updateReliefPackTemplate\([\s\S]*?await loadReliefPackPage\(\)/);
  assert.match(source, /await createReliefPackTemplate\([\s\S]*?await loadReliefPackPage\(\)/);
});
