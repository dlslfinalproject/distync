const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.join(__dirname, "..", "..");
const migrationPath = path.join(
  repositoryRoot,
  "database",
  "migrations",
  "2026-09-05_add_stub_relief_pack_assignment_snapshots.sql",
);
const schemaPath = path.join(
  repositoryRoot,
  "database",
  "schema",
  "distync_schema.sql",
);
const householdRegistrationRepositoryPath = path.join(
  repositoryRoot,
  "server",
  "src",
  "repositories",
  "householdRegistration.repository.js",
);
const householdRegistrationServicePath = path.join(
  repositoryRoot,
  "server",
  "src",
  "services",
  "householdRegistration.service.js",
);
const stubServicePath = path.join(
  repositoryRoot,
  "server",
  "src",
  "services",
  "stub.service.js",
);
const masterlistServicePath = path.join(
  repositoryRoot,
  "server",
  "src",
  "services",
  "masterlist.service.js",
);
const distributionTransactionServicePath = path.join(
  repositoryRoot,
  "server",
  "src",
  "services",
  "distributionTransaction.service.js",
);
const automaticClaimServicePath = path.join(
  repositoryRoot,
  "server",
  "src",
  "services",
  "automaticReliefPackClaim.service.js",
);

const read = (filePath) => fs.readFileSync(filePath, "utf8");

test("assignment snapshot normalization distinguishes no snapshot from an explicit empty assignment", () => {
  const {
    normalizeReliefPackAssignmentSnapshots,
  } = require("../src/utils/reliefPackAssignmentSnapshot");

  assert.equal(normalizeReliefPackAssignmentSnapshots(null), null);
  assert.equal(normalizeReliefPackAssignmentSnapshots(undefined), null);
  assert.deepEqual(normalizeReliefPackAssignmentSnapshots("[]"), []);

  const [snapshot] = normalizeReliefPackAssignmentSnapshots([
    {
      id: "template-1",
      name: "Historical Relief Pack",
      is_additional_pack: false,
      pack_multiplier: 2,
      items: [
        {
          inventory_item_id: "item-1",
          item_name: "Water at issuance",
          category: "Non-Perishable",
          unit_of_measure: "pc",
          quantity_required: 1,
        },
      ],
    },
  ]);

  assert.equal(snapshot.id, "template-1");
  assert.equal(snapshot.assignment_snapshot, true);
  assert.equal(snapshot.pack_multiplier, 2);
  assert.equal(snapshot.items[0].item_name, "Water at issuance");
});

test("stub assignment migration stores an immutable JSON array with item composition", () => {
  const migration = read(migrationPath);
  const schema = read(schemaPath);

  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS assigned_relief_pack_snapshots jsonb/i,
  );
  assert.match(
    migration,
    /stubs_assigned_relief_pack_snapshots_array_check/i,
  );
  assert.match(
    migration,
    /jsonb_typeof\(assigned_relief_pack_snapshots\) = 'array'/i,
  );
  assert.match(migration, /assigned_relief_pack_snapshots IS NULL/i);
  assert.match(migration, /'items', items/i);
  assert.match(migration, /'pack_multiplier', pack_multiplier/i);
  assert.match(
    migration,
    /SET assigned_relief_pack_snapshots = '\[\]'::jsonb/i,
  );
  assert.match(schema, /assigned_relief_pack_snapshots jsonb/i);
});

test("active unclaimed paths use live assignments while historical paths use snapshots", () => {
  const registrationRepository = read(householdRegistrationRepositoryPath);
  const registrationService = read(householdRegistrationServicePath);
  const stubService = read(stubServicePath);
  const masterlistService = read(masterlistServicePath);
  const distributionService = read(distributionTransactionServicePath);
  const automaticClaimService = read(automaticClaimServicePath);
  const assignmentSnapshotUtility = read(
    path.join(
      repositoryRoot,
      "server",
      "src",
      "utils",
      "reliefPackAssignmentSnapshot.js",
    ),
  );

  assert.match(registrationRepository, /assigned_relief_pack_snapshots,\s*issued_at/);
  assert.match(registrationRepository, /stubData\.disaster_type/);
  assert.match(registrationRepository, /stubData\.assigned_sector_ids/);
  assert.match(registrationRepository, /stubData\.household_size/);
  assert.match(registrationService, /assignedReliefPackSectorIds/);
  assert.match(registrationService, /assigned_sector_ids: assignedReliefPackSectorIds/);
  assert.match(
    assignmentSnapshotUtility,
    /isLiveUnclaimedReliefPackAssignment/,
  );
  assert.match(stubService, /isLiveUnclaimedReliefPackAssignment/);
  assert.match(stubService, /liveAssignedReliefPacks/);
  assert.match(masterlistService, /assigned_relief_packs: assignedReliefPackSnapshots/);
  assert.match(
    distributionService,
    /assignedReliefPackSnapshots: stub\.assigned_relief_pack_snapshots/,
  );
  assert.match(distributionService, /preferCurrentAssignment = false/);
  assert.match(distributionService, /preferCurrentAssignment: true/);
  assert.match(automaticClaimService, /resolveAssignedReliefPackTemplatesForHousehold/);
  assert.doesNotMatch(
    automaticClaimService,
    /storedAssignedReliefPackTemplates\s*\?\?/,
  );
  assert.match(
    distributionService,
    /getEffectiveAssignedTemplatesForExport/,
  );
  assert.match(
    distributionService,
    /getReliefPackComponentItemIdsForExport/,
  );
  assert.match(
    distributionService,
    /excludedInventoryItemIds: assignedReliefPackComponentItemIds/,
  );
});
