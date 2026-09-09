import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sourcePath = (...segments) => path.join(process.cwd(), "src", ...segments);

const readSource = (relativePath) =>
  fs.readFile(sourcePath(...relativePath), "utf8");

test("donation management normalizes MSWDO-created event rows and counts received donations", async () => {
  const source = await readSource([
    "features",
    "donations",
    "donationPageUi.js",
  ]);

  assert.match(source, /export const normalizeDonationEventRows =/);
  assert.match(source, /eventRow\.title \|\| eventRow\.event_name/);
  assert.match(source, /id,\s*title,/);
  assert.match(source, /export const getDonationSummaryCards =/);
  assert.match(
    source,
    /status \|\| ""\)\.trim\(\)\.toUpperCase\(\) !== "CANCELLED"/,
  );
  assert.match(
    source,
    /getDonationTypeKey\(donation\?\.items\) === "LOOSE_ITEM"/,
  );
  assert.match(
    source,
    /getDonationTypeKey\(donation\?\.items\) === "RELIEF_PACK"/,
  );
});

test("donation management loads complete event-scoped data for local search and cards", async () => {
  const source = await readSource(["pages", "DonationManagementPage.jsx"]);

  assert.match(
    source,
    /setDisasterEvents\(normalizeDonationEventRows\(eventRows\)\)/,
  );
  assert.match(
    source,
    /fetchDonations\(\{\s*disaster_event_id: resolvedEventId \|\| undefined,\s*\}\)/s,
  );
  const donationFetchCall = source.match(/fetchDonations\(\{([\s\S]*?)\}\)/)?.[1] || "";
  assert.doesNotMatch(
    donationFetchCall,
    /search:\s*donationSearch/,
  );
  assert.match(
    source,
    /return getDonationSummaryCards\(donationsWithSyncStatus\)/,
  );
});

test("closed event filters do not preselect an invalid add-donation event", async () => {
  const [pageSource, hookSource] = await Promise.all([
    readSource(["pages", "DonationManagementPage.jsx"]),
    readSource(["features", "donations", "useDonationManagementModals.js"]),
  ]);

  assert.match(
    pageSource,
    /getSelectedActiveDonationEventId\(disasterEvents, selectedEventId\)/,
  );
  assert.match(pageSource, /selectedDonationEventId,/);
  assert.match(hookSource, /selectedDonationEventId = selectedEventId/);
  assert.match(
    hookSource,
    /disaster_event_id: selectedDonationEventId \|\| ""/,
  );
});

test("donation toolbar controls call the page filters and modal open handlers", async () => {
  const [pageSource, filtersSource] = await Promise.all([
    readSource(["pages", "DonationManagementPage.jsx"]),
    readSource(["components", "donations", "DonationFilters.jsx"]),
  ]);

  assert.match(filtersSource, /placeholder="Search by donor name or item name"/);
  assert.match(filtersSource, /onChange=\{onDonationSearchChange\}/);
  assert.match(filtersSource, /id="donation-type-filter"[\s\S]*?onChange=/);
  assert.match(filtersSource, /title="Filter Records"/);
  assert.match(filtersSource, /onClick=\{onOpenDonationModal\}/);
  assert.match(filtersSource, /onClick=\{onExportDonations\}/);
  assert.match(pageSource, /onOpenDonationModal=\{\(\) => openDonationModal\(\)\}/);
  assert.match(pageSource, /onExportDonations=\{openDonationExportModal\}/);
  assert.match(pageSource, /setIsDonationExportModalOpen\(true\)/);
});
