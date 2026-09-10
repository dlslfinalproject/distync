import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveFamilyHeadPhoto } from "../src/features/masterlist/familyHeadPhoto.js";

const read = (...parts) =>
  fs.readFile(path.join(process.cwd(), ...parts), "utf8");

test("BAR-PHOTO-01 shared resolver prefers the prepared local photo offline", () => {
  assert.equal(
    resolveFamilyHeadPhoto(
      {
        family_head_photo_data_url: "data:image/jpeg;base64,prepared",
        family_head_photo_url: "https://example.test/remote.jpg",
      },
      { isOffline: true },
    ),
    "data:image/jpeg;base64,prepared",
  );
});

test("BAR-PHOTO-02 shared resolver fails closed offline when no local photo exists", () => {
  assert.equal(
    resolveFamilyHeadPhoto(
      { family_head_photo_url: "https://example.test/remote.jpg" },
      { isOffline: true },
    ),
    "",
  );
});

test("BAR-PHOTO-03 distribution continues to use the shared photo resolver", async () => {
  const source = await read("src", "components", "stubs", "StubDetailModal.jsx");
  assert.match(source, /resolveFamilyHeadPhoto/);
});

test("MSWDO-PHOTO-01 preparation includes complete masterlist rows in photo hydration", async () => {
  const source = await read("src", "features", "offline", "mswdoOfflinePreparation.js");
  assert.match(source, /hydratePhotos\(\[\.\.\.masterlistRows, \.\.\.stubRows\]\)/);
  assert.match(source, /const requiredPhotoRows = \[\.\.\.masterlistRows, \.\.\.stubRows\]/);
});

test("MSWDO-PHOTO-02 departure preview uses the durable MSWDO snapshot by household", async () => {
  const hook = await read("src", "features", "mswdo-masterlist", "useMswdoMasterlistPage.js");
  const helper = await read("src", "features", "mswdo-masterlist", "mswdoMasterlistOfflinePhoto.js");
  assert.match(hook, /getMswdoOfflineHouseholdDetails/);
  assert.match(helper, /row\?\.household_id \|\| row\?\.id/);
});

test("MSWDO-PHOTO-03 offline departure preview does not require another network request", async () => {
  const hook = await read("src", "features", "mswdo-masterlist", "useMswdoMasterlistPage.js");
  assert.match(hook, /navigator\.onLine !== false/);
  assert.match(hook, /getMswdoOfflineHouseholdDetails\(\{[\s\S]*eventId/);
});

test("MSWDO-PHOTO-04 distribution and masterlist use the same household photo field", async () => {
  const cache = await read("src", "features", "stubs", "stubCache.js");
  const prep = await read("src", "features", "offline", "mswdoOfflinePreparation.js");
  assert.match(cache, /family_head_photo_data_url/);
  assert.match(prep, /family_head_photo_data_url/);
});

test("MSWDO-PHOTO-05 missing authoritative photo remains a legitimate empty fallback", () => {
  assert.equal(resolveFamilyHeadPhoto({}, { isOffline: true }), "");
});

test("MSWDO-PHOTO-06 durable lookup is scoped through the existing preparation snapshot", async () => {
  const helper = await read("src", "features", "mswdo-masterlist", "mswdoMasterlistOfflinePhoto.js");
  assert.match(helper, /readMswdoOfflineSnapshot\(\{ userId, eventId \}\)/);
  assert.match(helper, /datasets\?\.masterlist\?\.rows/);
});
