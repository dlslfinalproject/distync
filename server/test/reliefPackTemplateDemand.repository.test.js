const assert = require("node:assert/strict");
const test = require("node:test");

const pool = require("../src/config/db");
const reliefPackTemplateRepository = require("../src/repositories/reliefPackTemplate.repository");

const EVENT_A = "11111111-1111-4111-8111-111111111111";
const EVENT_B = "22222222-2222-4222-8222-222222222222";
const TEMPLATE_ID = "33333333-3333-4333-8333-333333333333";
const BARANGAY_ID = "44444444-4444-4444-8444-444444444444";

const originalPoolQuery = pool.query;

test.afterEach(() => {
  pool.query = originalPoolQuery;
});

test("relief pack demand aggregates multiple events in one parameterized query", async () => {
  let queryCallCount = 0;
  let capturedQuery = "";
  let capturedValues = null;
  const aggregateRows = [
    {
      template_id: TEMPLATE_ID,
      disaster_event_id: EVENT_A,
      barangay_id: BARANGAY_ID,
      barangay_name: "Barangay One",
      families_count: 2,
      packs_needed: 3,
    },
  ];

  pool.query = async (query, values) => {
    queryCallCount += 1;
    capturedQuery = query;
    capturedValues = values;
    return { rows: aggregateRows };
  };

  const result = await reliefPackTemplateRepository.getReliefPackTemplateDemand([
    EVENT_A,
    EVENT_B,
  ]);

  assert.deepEqual(result, aggregateRows);
  assert.equal(queryCallCount, 1);
  assert.deepEqual(capturedValues, [[EVENT_A, EVENT_B]]);
  assert.match(capturedQuery, /de\.id\s*=\s*ANY\(\$1::uuid\[\]\)/i);
  assert.match(capturedQuery, /de\.status\s*=\s*'ACTIVE'/i);
  assert.match(capturedQuery, /rpt\.is_active\s*=\s*TRUE/i);
  assert.match(capturedQuery, /hs\.is_active\s*=\s*TRUE/i);
  assert.match(
    capturedQuery,
    /UPPER\(BTRIM\(COALESCE\(hs\.current_stay_type/i,
  );
  assert.match(
    capturedQuery,
    /UPPER\(BTRIM\(COALESCE\(ao\.attendance_status/i,
  );
  assert.match(capturedQuery, /ao\.attendance_time_out\s+IS\s+NULL/i);
  assert.match(
    capturedQuery,
    /UPPER\(BTRIM\(COALESCE\(ls\.status/i,
  );
  assert.match(capturedQuery, /'ISSUED'/i);
  assert.match(capturedQuery, /DISTINCT\s+ON\s*\(s\.household_id\)/i);
  assert.match(capturedQuery, /household_sectors/i);
  assert.match(capturedQuery, /evacuee_sectors/i);
  assert.match(capturedQuery, /e\.is_active\s*=\s*TRUE/i);
  assert.match(capturedQuery, /based_on_family_size/i);
  assert.match(capturedQuery, /CEIL\([\s\S]*COALESCE\(eh\.household_size/i);
  assert.match(capturedQuery, /applies_to_all_disasters/i);
  assert.match(capturedQuery, /relief_pack_template_disaster_types/i);
  assert.match(capturedQuery, /COUNT\(\*\)::integer\s+AS\s+families_count/i);
  assert.match(capturedQuery, /SUM\(packs_needed\)::integer\s+AS\s+packs_needed/i);
  assert.match(capturedQuery, /GROUP BY\s+template_id[\s\S]*disaster_event_id/i);
  assert.doesNotMatch(capturedQuery, /SELECT\s+\*/i);
  assert.doesNotMatch(
    capturedQuery,
    /\b(first_name|middle_name|last_name|contact_number|photo|photo_url)\b/i,
  );
});

test("empty demand results stay empty without a raw household payload", async () => {
  let capturedValues = null;

  pool.query = async (_query, values) => {
    capturedValues = values;
    return { rows: [] };
  };

  const result = await reliefPackTemplateRepository.getReliefPackTemplateDemand([]);

  assert.deepEqual(result, []);
  assert.deepEqual(capturedValues, [[]]);
});

test("template list item details are opt-in and returned set-wise for the page", async () => {
  let capturedQuery = "";

  pool.query = async (query) => {
    capturedQuery = query;
    return { rows: [] };
  };

  await reliefPackTemplateRepository.getReliefPackTemplates({
    is_active: null,
    based_on_family_size: null,
    based_on_sector: null,
    search: "",
    disaster_type: null,
  });

  assert.doesNotMatch(capturedQuery, /relief_pack_template_items/i);

  await reliefPackTemplateRepository.getReliefPackTemplates({
    is_active: null,
    based_on_family_size: null,
    based_on_sector: null,
    search: "",
    disaster_type: null,
    include_items: true,
  });

  assert.match(capturedQuery, /relief_pack_template_items/i);
  assert.match(capturedQuery, /json_agg\([\s\S]*json_build_object/i);
  assert.match(capturedQuery, /quantity_required/i);
  assert.match(capturedQuery, /inventory_item/i);
  assert.match(capturedQuery, /ORDER BY\s+ii\.item_name\s+ASC/i);
});
