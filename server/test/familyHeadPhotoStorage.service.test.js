const test = require("node:test");
const assert = require("node:assert/strict");

const profileStorage = require("../src/services/profilePictureStorage.service");

const buildJpeg = (scanByteCount = 1) => {
  const frame = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01,
    0x01, 0x01, 0x11, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00,
    0x00, 0x3f, 0x00,
  ]);
  return Buffer.concat([frame, Buffer.alloc(scanByteCount, 0x01), Buffer.from([0xff, 0xd9])]);
};

const toDataUrl = (buffer, mimeType = "image/jpeg") =>
  `data:${mimeType};base64,${buffer.toString("base64")}`;

const loadServiceWithStorage = (storageClient) => {
  const servicePath = require.resolve("../src/services/familyHeadPhotoStorage.service");
  const originalStorageGetter = profileStorage.getSupabaseStorageClient;
  const originalServiceModule = require.cache[servicePath];
  const originalEnvironment = {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.FAMILY_HEAD_PHOTO_STORAGE_BUCKET,
  };
  process.env.SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-role-key";
  process.env.FAMILY_HEAD_PHOTO_STORAGE_BUCKET = "distync-family-head-photos";
  profileStorage.getSupabaseStorageClient = () => storageClient;
  delete require.cache[servicePath];
  try {
    const service = require(servicePath);
    return {
      service,
      restore() {
        delete require.cache[servicePath];
        if (originalServiceModule) require.cache[servicePath] = originalServiceModule;
        profileStorage.getSupabaseStorageClient = originalStorageGetter;
        if (originalEnvironment.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
        else process.env.SUPABASE_URL = originalEnvironment.supabaseUrl;
        if (originalEnvironment.serviceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnvironment.serviceRoleKey;
        if (originalEnvironment.bucket === undefined) delete process.env.FAMILY_HEAD_PHOTO_STORAGE_BUCKET;
        else process.env.FAMILY_HEAD_PHOTO_STORAGE_BUCKET = originalEnvironment.bucket;
      },
    };
  } catch (error) {
    profileStorage.getSupabaseStorageClient = originalStorageGetter;
    if (originalEnvironment.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalEnvironment.supabaseUrl;
    if (originalEnvironment.serviceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnvironment.serviceRoleKey;
    if (originalEnvironment.bucket === undefined) delete process.env.FAMILY_HEAD_PHOTO_STORAGE_BUCKET;
    else process.env.FAMILY_HEAD_PHOTO_STORAGE_BUCKET = originalEnvironment.bucket;
    throw error;
  }
};

const createStorageClient = ({ uploadError = null, storedBytes = null } = {}) => {
  const objects = new Map();
  if (storedBytes) objects.set("existing", storedBytes);
  const calls = { uploads: [], downloads: [], signedUrls: [], removals: [] };
  const client = {
    storage: {
      from(bucket) {
        return {
          async upload(path, bytes, options) {
            calls.uploads.push({ bucket, path, options });
            if (uploadError) return { data: null, error: uploadError };
            objects.set(path, Buffer.from(bytes));
            return { data: { path }, error: null };
          },
          async download(path) {
            calls.downloads.push({ bucket, path });
            const bytes = objects.get(path);
            return bytes
              ? { data: new Blob([bytes]), error: null }
              : { data: null, error: new Error("missing") };
          },
          async createSignedUrl(path, ttl) {
            calls.signedUrls.push({ bucket, path, ttl });
            return { data: { signedUrl: `https://storage.example/sign/${path}?token=short` }, error: null };
          },
          async remove(paths) {
            calls.removals.push({ bucket, paths });
            paths.forEach((path) => objects.delete(path));
            return { data: paths, error: null };
          },
        };
      },
    },
  };
  return { client, objects, calls };
};

test("family-head Storage validates and uploads a JPEG through the shared server client", async () => {
  const { client, calls } = createStorageClient();
  const loaded = loadServiceWithStorage(client);
  try {
    const result = await loaded.service.uploadFamilyHeadPhoto({
      dataUrl: toDataUrl(buildJpeg()),
      disasterEventId: "event-1",
      barangayId: "barangay-1",
      operationId: "sync-1",
    });

    assert.match(result.path, /^event-1\/barangay-1\/operations\/[a-f0-9]{32}\/[a-f0-9]{64}\.jpg$/);
    assert.equal(result.mimeType, "image/jpeg");
    assert.equal(result.sizeBytes, buildJpeg().length);
    assert.equal(calls.uploads.length, 1);
    assert.equal(calls.uploads[0].options.upsert, false);
    assert.equal(calls.uploads[0].options.contentType, "image/jpeg");
  } finally {
    loaded.restore();
  }
});

test("family-head Storage accepts a supported GIF input and derives its extension", async () => {
  const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0, 0x3b]);
  const { client } = createStorageClient();
  const loaded = loadServiceWithStorage(client);
  try {
    const result = await loaded.service.uploadFamilyHeadPhoto({
      dataUrl: toDataUrl(gif, "image/gif"),
      disasterEventId: "event-1",
      barangayId: "barangay-1",
      operationId: "sync-1",
    });
    assert.match(result.path, /\.gif$/);
  } finally {
    loaded.restore();
  }
});

test("family-head Storage rejects invalid MIME, invalid signature, and oversized decoded data", () => {
  const loaded = loadServiceWithStorage(createStorageClient().client);
  try {
    assert.throws(
      () => loaded.service.parseFamilyHeadPhotoDataUrl(toDataUrl(buildJpeg(), "image/svg+xml")),
      { code: "FAMILY_HEAD_PHOTO_INVALID" },
    );
    assert.throws(
      () => loaded.service.parseFamilyHeadPhotoDataUrl(toDataUrl(Buffer.from("not an image"))),
      { code: "FAMILY_HEAD_PHOTO_INVALID" },
    );
    assert.throws(
      () => loaded.service.parseFamilyHeadPhotoDataUrl(toDataUrl(buildJpeg(2 * 1024 * 1024))),
      { code: "FAMILY_HEAD_PHOTO_INVALID" },
    );
  } finally {
    loaded.restore();
  }
});

test("family-head path is deterministic for an operation and changes with photo content", () => {
  const loaded = loadServiceWithStorage(createStorageClient().client);
  try {
    const first = loaded.service.parseFamilyHeadPhotoDataUrl(toDataUrl(buildJpeg()));
    const second = loaded.service.parseFamilyHeadPhotoDataUrl(toDataUrl(buildJpeg(2)));
    const pathFor = (photo) => loaded.service.buildFamilyHeadPhotoPath({
      disasterEventId: "event-1",
      barangayId: "barangay-1",
      operationId: "stable-sync-id",
      sha256: photo.sha256,
      fileExtension: photo.fileExtension,
    });
    assert.equal(pathFor(first), pathFor(first));
    assert.notEqual(pathFor(first), pathFor(second));
  } finally {
    loaded.restore();
  }
});

test("same-path Storage retry verifies existing bytes instead of overwriting them", async () => {
  const image = buildJpeg();
  const { client, objects, calls } = createStorageClient({ uploadError: new Error("already exists") });
  const loaded = loadServiceWithStorage(client);
  try {
    const first = loaded.service.parseFamilyHeadPhotoDataUrl(toDataUrl(image));
    const expectedPath = loaded.service.buildFamilyHeadPhotoPath({
      disasterEventId: "event-1",
      barangayId: "barangay-1",
      operationId: "sync-1",
      sha256: first.sha256,
      fileExtension: first.fileExtension,
    });
    objects.set(expectedPath, image);
    const result = await loaded.service.uploadFamilyHeadPhoto({
      dataUrl: toDataUrl(image),
      disasterEventId: "event-1",
      barangayId: "barangay-1",
      operationId: "sync-1",
    });
    assert.equal(result.path, expectedPath);
    assert.equal(result.created, false);
    assert.equal(calls.downloads.length, 1);
  } finally {
    loaded.restore();
  }
});

test("an existing deterministic object with different bytes is rejected", async () => {
  const image = buildJpeg();
  const { client, objects } = createStorageClient({ uploadError: new Error("already exists") });
  const loaded = loadServiceWithStorage(client);
  try {
    const parsed = loaded.service.parseFamilyHeadPhotoDataUrl(toDataUrl(image));
    const path = loaded.service.buildFamilyHeadPhotoPath({
      disasterEventId: "event-1",
      barangayId: "barangay-1",
      operationId: "sync-1",
      sha256: parsed.sha256,
      fileExtension: parsed.fileExtension,
    });
    objects.set(path, Buffer.from("different bytes"));
    await assert.rejects(
      loaded.service.uploadFamilyHeadPhoto({
        dataUrl: toDataUrl(image),
        disasterEventId: "event-1",
        barangayId: "barangay-1",
        operationId: "sync-1",
      }),
      { code: "FAMILY_HEAD_PHOTO_UPLOAD_FAILED" },
    );
  } finally {
    loaded.restore();
  }
});

test("upload failure is retryable and signed URLs are short-lived and never part of metadata", async () => {
  const { client } = createStorageClient({ uploadError: new Error("storage offline") });
  const loaded = loadServiceWithStorage(client);
  try {
    await assert.rejects(
      loaded.service.uploadFamilyHeadPhoto({
        dataUrl: toDataUrl(buildJpeg()),
        disasterEventId: "event-1",
        barangayId: "barangay-1",
        operationId: "sync-1",
      }),
      { code: "FAMILY_HEAD_PHOTO_UPLOAD_FAILED", statusCode: 503 },
    );

    const signed = await loaded.service.createSignedFamilyHeadPhotoUrl("event-1/barangay-1/households/1/photo.jpg");
    assert.equal(loaded.service.FAMILY_HEAD_PHOTO_SIGNED_URL_TTL_SECONDS, 300);
    assert.equal(typeof signed.url, "string");
    assert.equal(Object.hasOwn(loaded.service.getFamilyHeadPhotoMetadata(toDataUrl(buildJpeg())), "url"), false);
  } finally {
    loaded.restore();
  }
});
