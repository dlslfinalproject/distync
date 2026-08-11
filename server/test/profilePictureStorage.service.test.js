const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PROFILE_PICTURE_MAX_BASE64_ENCODED_LENGTH,
  PROFILE_PICTURE_MAX_FILE_SIZE_BYTES,
  getMaxBase64EncodedLength,
  parseProfilePictureUpload,
} = require("../src/services/profilePictureStorage.service");

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x00,
]);

const buildPngBuffer = (byteLength) => {
  const buffer = Buffer.alloc(byteLength);
  PNG_SIGNATURE.copy(buffer, 0);
  return buffer;
};

test("profile picture Base64 length calculation matches the 2 MB decoded limit", () => {
  assert.equal(PROFILE_PICTURE_MAX_FILE_SIZE_BYTES, 2 * 1024 * 1024);
  assert.equal(
    PROFILE_PICTURE_MAX_BASE64_ENCODED_LENGTH,
    getMaxBase64EncodedLength(PROFILE_PICTURE_MAX_FILE_SIZE_BYTES),
  );
  assert.equal(PROFILE_PICTURE_MAX_BASE64_ENCODED_LENGTH, 2796204);
});

test("parseProfilePictureUpload accepts decoded PNG content at and below 2 MB", () => {
  const justUnderLimit = parseProfilePictureUpload({
    mimeType: "image/png",
    fileDataBase64: buildPngBuffer(
      PROFILE_PICTURE_MAX_FILE_SIZE_BYTES - 1,
    ).toString("base64"),
  });
  const atLimit = parseProfilePictureUpload({
    mimeType: "image/png",
    fileDataBase64: buildPngBuffer(PROFILE_PICTURE_MAX_FILE_SIZE_BYTES).toString(
      "base64",
    ),
  });

  assert.equal(justUnderLimit.buffer.length, PROFILE_PICTURE_MAX_FILE_SIZE_BYTES - 1);
  assert.equal(atLimit.buffer.length, PROFILE_PICTURE_MAX_FILE_SIZE_BYTES);
});

test("parseProfilePictureUpload rejects decoded PNG content above 2 MB", () => {
  const overLimitBase64 = buildPngBuffer(
    PROFILE_PICTURE_MAX_FILE_SIZE_BYTES + 1,
  ).toString("base64");

  assert.ok(overLimitBase64.length <= PROFILE_PICTURE_MAX_BASE64_ENCODED_LENGTH);
  assert.throws(
    () =>
      parseProfilePictureUpload({
        mimeType: "image/png",
        fileDataBase64: overLimitBase64,
      }),
    /Profile picture must be 2 MB or smaller\./,
  );
});
