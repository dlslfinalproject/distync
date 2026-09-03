import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { buildQueuedHouseholdDetails } from "../src/features/masterlist/barangayMasterlistUi.js";

const readSource = (path) =>
  readFile(new URL(`../src/${path}`, import.meta.url), "utf8");

test("offline preparation fetches complete details and gates READY on the required photo", async () => {
  const source = await readSource("offline/offlinePreparation.js");

  assert.match(source, /OFFLINE_CACHE_VERSION = 2/);
  assert.match(source, /fetchHouseholdDetailsWithBoundedConcurrency/);
  assert.match(source, /Math\.min\(4, queue\.length\)/);
  assert.match(source, /family_head_photo_url/);
  assert.match(source, /offline_household_details/);
});

test("legacy readiness requires refresh when detail or photo completeness is absent", async () => {
  const source = await readSource("features/offline/useBarangayOfflinePreparation.js");

  assert.match(source, /existing\?\.cache_version === OFFLINE_CACHE_VERSION/);
  assert.match(source, /hasCompleteHouseholdDetails/);
  assert.match(source, /OFFLINE_PREPARATION_STATUS\.NEEDS_REFRESH/);
});

test("pending CREATE detail projection retains the local required photo", () => {
  const details = buildQueuedHouseholdDetails({
    id: "sync-1",
    entityLocalId: "local-1",
    clientTimestamp: "2026-09-03T08:22:00.000Z",
    payload: {
      family_head: { first_name: "Alex", last_name: "Reyes" },
      family_head_photo_url: "data:image/jpeg;base64,local-photo",
      members: [],
    },
  });

  assert.equal(
    details.household.family_head_photo_url,
    "data:image/jpeg;base64,local-photo",
  );
});
