const test = require("node:test");
const assert = require("node:assert/strict");

const profileStorage = require("../src/services/profilePictureStorage.service");

const buildJpeg = ({ scanByteCount = 1, width = 1, height = 1 } = {}) => {
  const frame = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  ]);
  return Buffer.concat([
    frame,
    Buffer.alloc(scanByteCount, 0x01),
    Buffer.from([0xff, 0xd9]),
  ]);
};

const toDataUrl = (buffer, mimeType = "image/jpeg") =>
  `data:${mimeType};base64,${buffer.toString("base64")}`;

const loadServiceWithStorage = (storageClient) => {
  const servicePath = require.resolve("../src/services/claimProofPhotoStorage.service");
  const originalStorageGetter = profileStorage.getSupabaseStorageClient;
  const originalServiceModule = require.cache[servicePath];
  const originalEnvironment = {
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.CLAIM_PROOF_PHOTO_STORAGE_BUCKET,
  };

  process.env.SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-service-role-key";
  process.env.CLAIM_PROOF_PHOTO_STORAGE_BUCKET = "distync-claim-proof-photos";
  profileStorage.getSupabaseStorageClient = () => storageClient;
  delete require.cache[servicePath];

  const restoreEnvironment = () => {
    profileStorage.getSupabaseStorageClient = originalStorageGetter;
    if (originalEnvironment.supabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalEnvironment.supabaseUrl;
    if (originalEnvironment.serviceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnvironment.serviceRoleKey;
    if (originalEnvironment.bucket === undefined) delete process.env.CLAIM_PROOF_PHOTO_STORAGE_BUCKET;
    else process.env.CLAIM_PROOF_PHOTO_STORAGE_BUCKET = originalEnvironment.bucket;
  };

  try {
    const service = require(servicePath);
    return {
      service,
      restore() {
        delete require.cache[servicePath];
        if (originalServiceModule) require.cache[servicePath] = originalServiceModule;
        restoreEnvironment();
      },
    };
  } catch (error) {
    restoreEnvironment();
    throw error;
  }
};

const createStorageClient = ({ uploadError = null } = {}) => {
  const objects = new Map();
  const calls = { uploads: [], downloads: [], signedUrls: [], removals: [] };
  const client = {
    storage: {
      from(bucket) {
        return {
          async upload(path, bytes, options) {
            calls.uploads.push({ bucket, path, options });
            if (uploadError) return { data: null, error: uploadError };
            if (objects.has(path)) {
              return { data: null, error: new Error("object already exists") };
            }
            objects.set(path, Buffer.from(bytes));
            return { data: { path }, error: null };
          },
          async download(path) {
            calls.downloads.push({ bucket, path });
            const bytes = objects.get(path);
            return bytes
              ? { data: new Blob([bytes]), error: null }
              : { data: null, error: new Error("object missing") };
          },
          async createSignedUrl(path, ttl) {
            calls.signedUrls.push({ bucket, path, ttl });
            return {
              data: { signedUrl: `https://storage.example/sign/${path}?token=short` },
              error: null,
            };
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

test("claim-proof Storage validates JPEGs and uploads deterministic private objects without overwrite", async () => {
  const { client, calls } = createStorageClient();
  const loaded = loadServiceWithStorage(client);
  try {
    const imageA = buildJpeg();
    const imageB = buildJpeg({ scanByteCount: 2 });
    const first = await loaded.service.uploadClaimProofPhoto({
      dataUrl: toDataUrl(imageA),
      disasterEventId: "event-1",
      barangayId: "barangay-1",
      operationId: "stable-claim-operation",
    });
    const retry = await loaded.service.uploadClaimProofPhoto({
      dataUrl: toDataUrl(imageA),
      disasterEventId: "event-1",
      barangayId: "barangay-1",
      operationId: "stable-claim-operation",
    });
    const changed = loaded.service.parseClaimProofPhotoDataUrl(toDataUrl(imageB));
    const changedPath = loaded.service.buildClaimProofPhotoPath({
      disasterEventId: "event-1",
      barangayId: "barangay-1",
      operationId: "stable-claim-operation",
      sha256: changed.sha256,
    });

    assert.match(first.path, /^event-1\/barangay-1\/claims\/operations\/[a-f0-9]{32}\/[a-f0-9]{64}\.jpg$/);
    assert.equal(first.path, retry.path);
    assert.equal(retry.created, false);
    assert.notEqual(changedPath, first.path);
    assert.equal(first.mimeType, "image/jpeg");
    assert.equal(first.sizeBytes, imageA.length);
    assert.equal(calls.uploads[0].bucket, "distync-claim-proof-photos");
    assert.equal(calls.uploads[0].options.contentType, "image/jpeg");
    assert.equal(calls.uploads[0].options.upsert, false);
    assert.equal(calls.uploads[0].options.cacheControl, "0");
    assert.equal(calls.downloads.length, 1);
  } finally {
    loaded.restore();
  }
});

test("claim-proof Storage rejects non-JPEG MIME, invalid signatures, oversized data, and large dimensions", () => {
  const loaded = loadServiceWithStorage(createStorageClient().client);
  try {
    assert.throws(
      () => loaded.service.parseClaimProofPhotoDataUrl(toDataUrl(buildJpeg(), "image/png")),
      { code: "CLAIM_PROOF_PHOTO_INVALID" },
    );
    assert.throws(
      () => loaded.service.parseClaimProofPhotoDataUrl(toDataUrl(Buffer.from("not an image"))),
      { code: "CLAIM_PROOF_PHOTO_INVALID" },
    );
    assert.throws(
      () => loaded.service.parseClaimProofPhotoDataUrl(toDataUrl(buildJpeg({ scanByteCount: 2 * 1024 * 1024 }))),
      { code: "CLAIM_PROOF_PHOTO_INVALID" },
    );
    assert.throws(
      () => loaded.service.parseClaimProofPhotoDataUrl(toDataUrl(buildJpeg({ width: 1601 }))),
      { code: "CLAIM_PROOF_PHOTO_INVALID" },
    );
  } finally {
    loaded.restore();
  }
});

test("claim-proof Storage rejects an existing deterministic path with different bytes and reports upload failure", async () => {
  const { client, objects } = createStorageClient({ uploadError: new Error("already exists") });
  const loaded = loadServiceWithStorage(client);
  try {
    const image = buildJpeg();
    const parsed = loaded.service.parseClaimProofPhotoDataUrl(toDataUrl(image));
    const path = loaded.service.buildClaimProofPhotoPath({
      disasterEventId: "event-1",
      barangayId: "barangay-1",
      operationId: "sync-1",
      sha256: parsed.sha256,
    });
    objects.set(path, Buffer.from("different bytes"));

    await assert.rejects(
      loaded.service.uploadClaimProofPhoto({
        dataUrl: toDataUrl(image),
        disasterEventId: "event-1",
        barangayId: "barangay-1",
        operationId: "sync-1",
      }),
      { code: "CLAIM_PROOF_PHOTO_UPLOAD_FAILED", statusCode: 503 },
    );
  } finally {
    loaded.restore();
  }
});

test("claim-proof signed URLs expire in five minutes and cleanup removes only unreferenced paths", async () => {
  const { client, calls } = createStorageClient();
  const loaded = loadServiceWithStorage(client);
  try {
    const path = "event-1/barangay-1/claims/operations/0123456789abcdef0123456789abcdef/" + "a".repeat(64) + ".jpg";
    const signed = await loaded.service.createSignedClaimProofPhotoUrl(path);
    assert.equal(loaded.service.CLAIM_PROOF_PHOTO_SIGNED_URL_TTL_SECONDS, 300);
    assert.equal(calls.signedUrls[0].ttl, 300);
    assert.equal(typeof signed.url, "string");
    assert.equal(Date.parse(signed.expiresAt) > Date.now(), true);

    const referencedClient = {
      query: async () => ({ rows: [{ exists: 1 }] }),
    };
    assert.equal(
      await loaded.service.removeUnreferencedClaimProofPhoto({ path, dbClient: referencedClient }),
      false,
    );
    assert.equal(calls.removals.length, 0);

    let referenceChecks = 0;
    const unreferencedClient = {
      query: async () => {
        referenceChecks += 1;
        return { rows: [] };
      },
    };
    assert.equal(
      await loaded.service.removeUnreferencedClaimProofPhoto({ path, dbClient: unreferencedClient }),
      true,
    );
    assert.equal(referenceChecks, 2);
    assert.deepEqual(calls.removals[0].paths, [path]);

    assert.equal(
      await loaded.service.removeUnreferencedClaimProofPhoto({ path: "untrusted/path.jpg", dbClient: unreferencedClient }),
      false,
    );
  } finally {
    loaded.restore();
  }
});
