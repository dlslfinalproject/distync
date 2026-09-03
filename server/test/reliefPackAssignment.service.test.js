const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getAssignedReliefPackTemplatesForSectorIds,
} = require("../src/services/reliefPackAssignment.service");

const buildTemplate = (overrides = {}) => ({
  id: "template-1",
  name: "Standard Relief Pack",
  is_active: true,
  is_additional_pack: false,
  applies_to_all_disasters: true,
  disaster_types: [],
  ...overrides,
});

test("relief pack assignment considers every household sector and event applicability", () => {
  const assignedTemplates = getAssignedReliefPackTemplatesForSectorIds(
    ["sector-senior", "sector-pregnant"],
    [
      buildTemplate(),
      buildTemplate({
        id: "multi-sector-pack",
        name: "Senior and Pregnant Pack",
        is_additional_pack: true,
        based_on_sector: true,
        sector_id: "sector-senior",
        description:
          '__relief_pack_sector_ids__:["sector-senior","sector-pregnant"]',
        applies_to_all_disasters: false,
        disaster_types: ["Typhoon"],
      }),
      buildTemplate({
        id: "legacy-sector-pack",
        name: "Legacy Senior Pack",
        is_additional_pack: true,
        based_on_sector: true,
        sector_id: "sector-senior",
        applies_to_all_disasters: false,
        disaster_types: ["Typhoon"],
      }),
      buildTemplate({
        id: "flood-only-pack",
        name: "Flood Pack",
        is_additional_pack: true,
        based_on_sector: true,
        sector_id: "sector-pregnant",
        applies_to_all_disasters: false,
        disaster_types: ["Flood"],
      }),
      buildTemplate({
        id: "inactive-pack",
        name: "Inactive Pack",
        is_active: false,
        is_additional_pack: true,
        based_on_sector: true,
        sector_id: "sector-senior",
      }),
    ],
    "Typhoon",
  );

  assert.deepEqual(
    assignedTemplates.map((template) => template.id),
    ["template-1", "multi-sector-pack", "legacy-sector-pack"],
  );
});

test("relief pack assignment treats non-standard event types as Other", () => {
  const assignedTemplates = getAssignedReliefPackTemplatesForSectorIds(
    ["sector-1"],
    [
      buildTemplate({
        id: "other-pack",
        name: "Other Disaster Pack",
        is_additional_pack: true,
        based_on_sector: true,
        sector_id: "sector-1",
        applies_to_all_disasters: false,
        disaster_types: ["Other"],
      }),
      buildTemplate({
        id: "fire-pack",
        name: "Fire Pack",
        is_additional_pack: true,
        based_on_sector: true,
        sector_id: "sector-1",
        applies_to_all_disasters: false,
        disaster_types: ["Fire"],
      }),
    ],
    "Chemical Spill",
  );

  assert.deepEqual(
    assignedTemplates.map((template) => template.id),
    ["other-pack"],
  );
});
