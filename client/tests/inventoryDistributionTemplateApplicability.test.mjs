import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  getAssignedReliefPackTemplatesForHousehold,
  getHouseholdSectorIds,
} from "../src/features/relief-pack-templates/reliefPackAssignment.js";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

const buildTemplate = (overrides = {}) => ({
  id: "standard",
  name: "Standard Relief Pack",
  is_active: true,
  is_additional_pack: false,
  applies_to_all_disasters: true,
  disaster_types: [],
  ...overrides,
});

test("inventory distribution assignment includes every active matching sector pack", () => {
  const household = {
    household_sectors: [{ id: "household-sector" }],
    members: [
      {
        is_active: true,
        sectors: [{ id: "active-member-sector" }],
      },
      {
        is_active: false,
        sectors: [{ id: "inactive-member-sector" }],
      },
    ],
  };

  assert.deepEqual(getHouseholdSectorIds(household), [
    "household-sector",
    "active-member-sector",
  ]);

  const assignedTemplates = getAssignedReliefPackTemplatesForHousehold(
    household,
    [
      buildTemplate(),
      buildTemplate({
        id: "multi-sector",
        name: "Multi-sector Pack",
        is_additional_pack: true,
        sector_id: "active-member-sector",
        sector_ids: ["inactive-member-sector", "active-member-sector"],
      }),
      buildTemplate({
        id: "inactive-sector-pack",
        name: "Inactive Sector Pack",
        is_additional_pack: true,
        sector_id: "inactive-member-sector",
        sector_ids: ["inactive-member-sector"],
      }),
    ],
    { disaster_type: "Typhoon" },
  );

  assert.deepEqual(
    assignedTemplates.map((template) => template.id),
    ["standard", "multi-sector"],
  );
});

test("inventory distribution assignment filters templates to the selected event type", () => {
  const assignedTemplates = getAssignedReliefPackTemplatesForHousehold(
    { household_sectors: [], members: [] },
    [
      buildTemplate({
        id: "typhoon-pack",
        name: "Typhoon Pack",
        applies_to_all_disasters: false,
        disaster_types: ["Typhoon"],
      }),
      buildTemplate({
        id: "flood-pack",
        name: "Flood Pack",
        applies_to_all_disasters: false,
        disaster_types: ["Flood"],
      }),
      buildTemplate({
        id: "all-events-pack",
        name: "All Events Pack",
      }),
    ],
    { disaster_type: "Typhoon" },
  );

  assert.deepEqual(
    assignedTemplates.map((template) => template.id),
    ["typhoon-pack", "all-events-pack"],
  );
});

test("inventory distribution requests templates for the selected disaster event", async () => {
  const [hookSource, templateServiceSource] = await Promise.all([
    readSource(["features", "inventory-distribution", "useInventoryDistribution.js"]),
    readSource(["features", "relief-pack-templates", "reliefPackTemplateService.js"]),
  ]);

  assert.match(
    hookSource,
    /fetchReliefPackTemplates\(\{[\s\S]*?is_active:\s*"true"[\s\S]*?disaster_event_id:\s*selectedDisasterEventId/,
  );
  assert.match(
    templateServiceSource,
    /filters\.disaster_event_id[\s\S]*?searchParams\.set\("disaster_event_id"/,
  );
});
