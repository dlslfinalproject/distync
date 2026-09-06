import test from "node:test";
import assert from "node:assert/strict";
import { resolveFamilyHeadPhoto } from "./familyHeadPhoto.js";

test("family head photo resolver prefers the cached data URL offline", () => {
  const cachedPhoto = "data:image/jpeg;base64,cached-photo";

  assert.equal(
    resolveFamilyHeadPhoto(
      {
        family_head_photo_url: "https://example.test/remote-photo.jpg",
        family_head_photo_data_url: cachedPhoto,
      },
      { isOffline: true },
    ),
    cachedPhoto,
  );
});

test("family head photo resolver does not use a remote URL offline", () => {
  assert.equal(
    resolveFamilyHeadPhoto(
      { family_head_photo_url: "https://example.test/remote-photo.jpg" },
      { isOffline: true },
    ),
    "",
  );
});

test("family head photo resolver uses the authoritative URL online", () => {
  const remotePhoto = "https://example.test/remote-photo.jpg";

  assert.equal(
    resolveFamilyHeadPhoto({ family_head_photo_url: remotePhoto }),
    remotePhoto,
  );
});
