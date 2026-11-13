const assert = require("node:assert/strict");
const test = require("node:test");

const EVENT_TYPHOON = "11111111-1111-4111-8111-111111111111";
const EVENT_FLOOD = "22222222-2222-4222-8222-222222222222";
const EVENT_CLOSED = "66666666-6666-4666-8666-666666666666";
const STANDARD_TEMPLATE = "33333333-3333-4333-8333-333333333333";
const ADDITIONAL_TEMPLATE = "44444444-4444-4444-8444-444444444444";
const FLOOD_TEMPLATE = "55555555-5555-4555-8555-555555555555";
const INACTIVE_TEMPLATE = "77777777-7777-4777-8777-777777777777";
const BARANGAY_ONE = "88888888-8888-4888-8888-888888888888";
const BARANGAY_TWO = "99999999-9999-4999-8999-999999999999";
const SECTOR_ONE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECTOR_TWO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const normalize = (value) => String(value || "").trim().toUpperCase();

const isLegacyEligible = (household) => {
  if (normalize(household.stub?.status) !== "ISSUED") {
    return false;
  }

  if (normalize(household.current_stay_type) !== "EVAC_CENTER") {
    return false;
  }

  if (household.is_active === false || !household.latest_attendance) {
    return false;
  }

  if (household.latest_attendance.time_out) {
    return false;
  }

  return normalize(household.latest_attendance.status) === "PRESENT";
};

const isLegacyTemplateApplicable = (template, disasterType) => {
  if (template.applies_to_all_disasters !== false) {
    return true;
  }

  return (template.disaster_types || []).some(
    (templateType) =>
      templateType === disasterType ||
      (templateType === "Other" &&
        ![
          "Typhoon",
          "Flood",
          "Earthquake",
          "Landslide",
          "Volcanic Eruption",
          "Storm Surge",
          "Drought / El Niño",
          "Tsunami",
          "Fire",
        ].includes(disasterType)),
  );
};

const getLegacyHouseholdSectorIds = (household) => [
  ...(household.household_sectors || []).map((sector) => sector.id),
  ...(household.members || []).flatMap((member) =>
    (member.sectors || []).map((sector) => sector.id),
  ),
];

const getLegacyMultiplier = (template, householdSize) => {
  if (!template.based_on_family_size) {
    return 1;
  }

  const coverage = Number.parseInt(String(template.description || "").trim(), 10);
  return Number.isInteger(coverage) && coverage > 0
    ? Math.max(1, Math.ceil(householdSize / coverage))
    : 1;
};

const calculateLegacyDemand = ({ templates, events, households }) => {
  const rows = new Map();

  events
    .filter((event) => normalize(event.status) === "ACTIVE")
    .forEach((event) => {
      templates
        .filter((template) => template.is_active !== false)
        .filter((template) =>
          isLegacyTemplateApplicable(template, event.disaster_type),
        )
        .forEach((template) => {
          households
            .filter(
              (household) =>
                household.disaster_event_id === event.id &&
                isLegacyEligible(household),
            )
            .filter((household) => {
              if (!template.is_additional_pack) {
                return true;
              }

              const templateSectorIds = new Set(template.sector_ids || []);
              return getLegacyHouseholdSectorIds(household).some((sectorId) =>
                templateSectorIds.has(sectorId),
              );
            })
            .forEach((household) => {
              const key = [
                template.id,
                event.id,
                household.barangay_id,
              ].join("|");
              const current = rows.get(key) || {
                template_id: template.id,
                disaster_event_id: event.id,
                barangay_id: household.barangay_id,
                families_count: 0,
                packs_needed: 0,
              };

              current.families_count += 1;
              current.packs_needed += getLegacyMultiplier(
                template,
                household.household_size,
              );
              rows.set(key, current);
            });
        });
    });

  return [...rows.values()].sort((left, right) =>
    [left.template_id, left.disaster_event_id, left.barangay_id].join("|")
      .localeCompare(
        [right.template_id, right.disaster_event_id, right.barangay_id].join("|"),
      ),
  );
};

const household = (overrides = {}) => ({
  disaster_event_id: EVENT_TYPHOON,
  barangay_id: BARANGAY_ONE,
  household_size: 1,
  current_stay_type: "EVAC_CENTER",
  is_active: true,
  stub: { status: "ISSUED" },
  latest_attendance: { status: "PRESENT", time_out: null },
  household_sectors: [],
  members: [],
  ...overrides,
});

test("server aggregate contract preserves the old demand result across events and eligibility states", () => {
  const templates = [
    {
      id: STANDARD_TEMPLATE,
      is_active: true,
      based_on_family_size: true,
      description: "4",
      is_additional_pack: false,
      applies_to_all_disasters: true,
      disaster_types: [],
    },
    {
      id: ADDITIONAL_TEMPLATE,
      is_active: true,
      based_on_family_size: false,
      description: null,
      is_additional_pack: true,
      sector_ids: [SECTOR_ONE, SECTOR_TWO],
      applies_to_all_disasters: true,
      disaster_types: [],
    },
    {
      id: FLOOD_TEMPLATE,
      is_active: true,
      based_on_family_size: false,
      description: null,
      is_additional_pack: false,
      applies_to_all_disasters: false,
      disaster_types: ["Flood"],
    },
    {
      id: INACTIVE_TEMPLATE,
      is_active: false,
      based_on_family_size: false,
      description: null,
      is_additional_pack: false,
      applies_to_all_disasters: true,
      disaster_types: [],
    },
  ];
  const events = [
    { id: EVENT_TYPHOON, status: "ACTIVE", disaster_type: "Typhoon" },
    { id: EVENT_FLOOD, status: "ACTIVE", disaster_type: "Flood" },
    { id: EVENT_CLOSED, status: "CLOSED", disaster_type: "Flood" },
  ];
  const households = [
    household({ household_size: 5 }),
    household({ household_size: 2, barangay_id: BARANGAY_TWO }),
    household({
      disaster_event_id: EVENT_TYPHOON,
      household_size: 4,
      stub: { status: "CLAIMED" },
    }),
    household({
      disaster_event_id: EVENT_TYPHOON,
      household_size: 4,
      is_active: false,
    }),
    household({
      disaster_event_id: EVENT_TYPHOON,
      household_size: 4,
      current_stay_type: "RELATIVES",
    }),
    household({
      disaster_event_id: EVENT_TYPHOON,
      household_size: 4,
      latest_attendance: { status: "LEFT", time_out: "2026-09-07T01:00:00Z" },
    }),
    household({
      disaster_event_id: EVENT_TYPHOON,
      household_size: 4,
      latest_attendance: null,
    }),
    household({
      disaster_event_id: EVENT_TYPHOON,
      household_size: 7,
      household_sectors: [{ id: SECTOR_ONE }],
    }),
    household({
      disaster_event_id: EVENT_FLOOD,
      barangay_id: BARANGAY_ONE,
      household_size: 9,
      members: [{ sectors: [{ id: SECTOR_TWO }] }],
    }),
    household({
      disaster_event_id: EVENT_CLOSED,
      household_size: 20,
      members: [{ sectors: [{ id: SECTOR_ONE }] }],
    }),
  ];

  const result = calculateLegacyDemand({ templates, events, households });

  assert.deepEqual(result, [
    {
      template_id: ADDITIONAL_TEMPLATE,
      disaster_event_id: EVENT_FLOOD,
      barangay_id: BARANGAY_ONE,
      families_count: 1,
      packs_needed: 1,
    },
    {
      template_id: ADDITIONAL_TEMPLATE,
      disaster_event_id: EVENT_TYPHOON,
      barangay_id: BARANGAY_ONE,
      families_count: 1,
      packs_needed: 1,
    },
    {
      template_id: STANDARD_TEMPLATE,
      disaster_event_id: EVENT_FLOOD,
      barangay_id: BARANGAY_ONE,
      families_count: 1,
      packs_needed: 3,
    },
    {
      template_id: STANDARD_TEMPLATE,
      disaster_event_id: EVENT_TYPHOON,
      barangay_id: BARANGAY_ONE,
      families_count: 2,
      packs_needed: 4,
    },
    {
      template_id: STANDARD_TEMPLATE,
      disaster_event_id: EVENT_TYPHOON,
      barangay_id: BARANGAY_TWO,
      families_count: 1,
      packs_needed: 1,
    },
    {
      template_id: FLOOD_TEMPLATE,
      disaster_event_id: EVENT_FLOOD,
      barangay_id: BARANGAY_ONE,
      families_count: 1,
      packs_needed: 1,
    },
  ].sort((left, right) =>
    [left.template_id, left.disaster_event_id, left.barangay_id].join("|")
      .localeCompare(
        [right.template_id, right.disaster_event_id, right.barangay_id].join("|"),
      ),
  ),
  );
});

test("empty active event scope and no eligible households produce no demand rows", () => {
  const result = calculateLegacyDemand({
    templates: [
      {
        id: STANDARD_TEMPLATE,
        is_active: true,
        based_on_family_size: false,
        is_additional_pack: false,
        applies_to_all_disasters: true,
      },
    ],
    events: [],
    households: [],
  });

  assert.deepEqual(result, []);
});
