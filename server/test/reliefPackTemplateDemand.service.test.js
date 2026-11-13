const assert = require("node:assert/strict");
const test = require("node:test");

const reliefPackTemplateRepository = require("../src/repositories/reliefPackTemplate.repository");
const reliefPackTemplateService = require("../src/services/reliefPackTemplate.service");

const EVENT_A = "11111111-1111-4111-8111-111111111111";
const EVENT_B = "22222222-2222-4222-8222-222222222222";

const originalGetReliefPackTemplateDemand =
  reliefPackTemplateRepository.getReliefPackTemplateDemand;

test.afterEach(() => {
  reliefPackTemplateRepository.getReliefPackTemplateDemand =
    originalGetReliefPackTemplateDemand;
});

test("relief pack demand service forwards the validated event scope once", async () => {
  let capturedEventIds = null;
  const aggregateRows = [
    {
      template_id: "33333333-3333-4333-8333-333333333333",
      disaster_event_id: EVENT_A,
      barangay_id: "44444444-4444-4444-8444-444444444444",
      barangay_name: "Barangay One",
      families_count: 1,
      packs_needed: 2,
    },
  ];

  reliefPackTemplateRepository.getReliefPackTemplateDemand = async (eventIds) => {
    capturedEventIds = eventIds;
    return aggregateRows;
  };

  const result = await reliefPackTemplateService.getReliefPackTemplateDemand({
    disaster_event_ids: [EVENT_A, EVENT_B],
  });

  assert.deepEqual(capturedEventIds, [EVENT_A, EVENT_B]);
  assert.deepEqual(result, aggregateRows);
});
