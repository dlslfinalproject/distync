const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

let uploadResult = { data: { path: "stored/path.png" }, error: null };
const uploadCalls = [];
const mockSupabaseClient = {
  storage: {
    from(bucketName) {
      return {
        upload: async (path, buffer, options) => {
          uploadCalls.push({ bucketName, path, buffer, options });
          return uploadResult;
        },
      };
    },
  },
};

const storageServicePath = require.resolve(
  "../src/services/profilePictureStorage.service",
);
const originalModuleLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (
    request === "@supabase/supabase-js" &&
    parent?.filename === storageServicePath
  ) {
    return { createClient: () => mockSupabaseClient };
  }

  return originalModuleLoad.call(this, request, parent, isMain);
};

const {
  PROFILE_PICTURE_MAX_BASE64_ENCODED_LENGTH,
  PROFILE_PICTURE_MAX_FILE_SIZE_BYTES,
  getMaxBase64EncodedLength,
  parseProfilePictureUpload,
  uploadProfilePicture,
} = require("../src/services/profilePictureStorage.service");
Module._load = originalModuleLoad;

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x00,
]);

const buildPngBuffer = (byteLength) => {
  const buffer = Buffer.alloc(byteLength);
  PNG_SIGNATURE.copy(buffer, 0);
  return buffer;
};

const validUpload = {
  userId: "private-user-id",
  fileName: "private-original.png",
  mimeType: "image/png",
  fileDataBase64: buildPngBuffer(12).toString("base64"),
};

const withStorageConfig = async (callback, overrides = {}) => {
  const envNames = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VITE_SUPABASE_URL",
    "PROFILE_PICTURE_STORAGE_BUCKET",
  ];
  const savedEnv = new Map(envNames.map((name) => [name, process.env[name]]));
  Object.assign(process.env, {
    SUPABASE_URL: "https://project-123.supabase.co?private=query",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-secret-value",
    PROFILE_PICTURE_STORAGE_BUCKET: "distync-profile-pictures",
    ...overrides,
  });

  try {
    return await callback();
  } finally {
    for (const [name, value] of savedEnv) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
};

const captureStorageDiagnostic = async (callback) => {
  const originalConsoleError = console.error;
  const entries = [];
  console.error = (...args) => entries.push(args);

  try {
    await callback();
  } finally {
    console.error = originalConsoleError;
  }

  return entries;
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

test("successful profile picture upload does not emit the failure diagnostic", async () => {
  await withStorageConfig(async () => {
    uploadCalls.length = 0;
    uploadResult = { data: { path: "stored/path.png" }, error: null };
    let result;
    const entries = await captureStorageDiagnostic(async () => {
      result = await uploadProfilePicture(validUpload);
    });

    assert.equal(entries.length, 0);
    assert.equal(result.profilePictureFileName, "private-original.png");
    assert.match(result.profilePicturePath, /^private-user-id\//);
    assert.equal(uploadCalls.length, 1);
    assert.equal(uploadCalls[0].bucketName, "distync-profile-pictures");
    assert.equal(uploadCalls[0].buffer.toString("base64"), validUpload.fileDataBase64);
  });
});

test("Storage upload failure logs only sanitized metadata and keeps the generic error", async () => {
  await withStorageConfig(async () => {
    uploadCalls.length = 0;
    const storageError = Object.assign(
      new Error(
        "Forbidden\nURL https://project-123.supabase.co/storage/v1/object/sign/private.png?token=signed-token-secret\tservice-role-secret-value Authorization: Bearer jwt-secret-value",
      ),
      {
        name: "StorageApiError",
        status: 403,
        statusCode: "Unauthorized",
        originalError: new Error("raw-original-error-secret"),
      },
    );
    uploadResult = { data: null, error: storageError };

    const entries = await captureStorageDiagnostic(async () => {
      await assert.rejects(
        uploadProfilePicture(validUpload),
        (error) => {
          assert.equal(error.message, "Failed to upload the profile picture.");
          assert.equal(error.statusCode, 500);
          return true;
        },
      );
    });

    assert.equal(entries.length, 1);
    assert.equal(entries[0][0], "[profile-picture-storage:upload]");
    const diagnostic = entries[0][1];
    assert.equal(diagnostic.projectHost, "project-123.supabase.co");
    assert.equal(diagnostic.bucketName, "distync-profile-pictures");
    assert.equal(diagnostic.name, "StorageApiError");
    assert.equal(diagnostic.status, 403);
    assert.equal(diagnostic.statusCode, "Unauthorized");
    assert.match(diagnostic.message, /Forbidden/);
    assert.doesNotMatch(diagnostic.message, /[\r\n\t]/);

    const logOutput = JSON.stringify(entries);
    for (const privateValue of [
      "service-role-secret-value",
      "https://project-123.supabase.co?private=query",
      "signed-token-secret",
      "jwt-secret-value",
      "raw-original-error-secret",
      validUpload.fileDataBase64,
      "private-user-id",
      "private-original.png",
    ]) {
      assert.equal(logOutput.includes(privateValue), false, privateValue);
    }
    assert.equal(uploadCalls.length, 1);
    assert.equal(logOutput.includes(uploadCalls[0].buffer.toString("hex")), false);
    assert.equal(logOutput.includes("[REDACTED_URL]"), true);
    assert.equal(logOutput.includes("Authorization:"), false);
  });
});

test("Storage diagnostic message is bounded at 300 characters", async () => {
  await withStorageConfig(async () => {
    uploadResult = {
      data: null,
      error: Object.assign(new Error("x".repeat(500)), {
        name: "StorageApiError",
        status: 500,
        statusCode: "InternalError",
      }),
    };
    const entries = await captureStorageDiagnostic(() =>
      assert.rejects(
        uploadProfilePicture(validUpload),
        /Failed to upload the profile picture\./,
      ),
    );

    assert.equal(entries.length, 1);
    assert.equal(entries[0][1].message.length, 300);
  });
});

test("malformed Supabase URL and unknown error fields do not mask the generic error", async () => {
  await withStorageConfig(
    async () => {
      const unknownError = new Proxy(
        { originalError: new Error("raw transport details") },
        {
          get() {
            throw new Error("unexpected field getter");
          },
        },
      );
      uploadResult = { data: null, error: unknownError };
      const entries = await captureStorageDiagnostic(() =>
        assert.rejects(
          uploadProfilePicture(validUpload),
          (error) => {
            assert.equal(error.message, "Failed to upload the profile picture.");
            return true;
          },
        ),
      );

      assert.equal(entries.length, 1);
      assert.deepEqual(entries[0][1], {
        projectHost: null,
        bucketName: "distync-profile-pictures",
        name: null,
        status: null,
        statusCode: null,
        message: null,
      });
      assert.equal(JSON.stringify(entries).includes("raw transport details"), false);
    },
    { SUPABASE_URL: "not a valid URL" },
  );
});

test("StorageUnknownError uses only its safe top-level message", async () => {
  await withStorageConfig(async () => {
    uploadResult = {
      data: null,
      error: Object.assign(new Error("fetch failed"), {
        name: "StorageUnknownError",
        originalError: new Error("raw transport details"),
      }),
    };
    const entries = await captureStorageDiagnostic(() =>
      assert.rejects(
        uploadProfilePicture(validUpload),
        /Failed to upload the profile picture\./,
      ),
    );

    assert.equal(entries.length, 1);
    assert.equal(entries[0][1].name, "StorageUnknownError");
    assert.equal(entries[0][1].message, "fetch failed");
    assert.equal(JSON.stringify(entries).includes("raw transport details"), false);
  });
});

test("a logging failure cannot replace the generic profile picture error", async () => {
  await withStorageConfig(async () => {
    uploadResult = {
      data: null,
      error: Object.assign(new Error("storage unavailable"), {
        name: "StorageUnknownError",
      }),
    };
    const originalConsoleError = console.error;
    console.error = () => {
      throw new Error("logger failure");
    };

    try {
      await assert.rejects(
        uploadProfilePicture(validUpload),
        (error) => {
          assert.equal(error.message, "Failed to upload the profile picture.");
          return true;
        },
      );
    } finally {
      console.error = originalConsoleError;
    }
  });
});
