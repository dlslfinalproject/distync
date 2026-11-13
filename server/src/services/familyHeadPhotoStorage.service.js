const crypto = require("crypto");

const {
  getSupabaseStorageClient,
  normalizeStoragePath,
} = require("./profilePictureStorage.service");
const {
  isValidFamilyHeadPhotoDataUrl,
} = require("../validators/householdRegistration.validator");

const FAMILY_HEAD_PHOTO_BUCKET =
  String(process.env.FAMILY_HEAD_PHOTO_STORAGE_BUCKET || "").trim() ||
  "distync-family-head-photos";
const FAMILY_HEAD_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const FAMILY_HEAD_PHOTO_SIGNED_URL_TTL_SECONDS = 5 * 60;
const DATA_URL_PATTERN =
  /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/i;
const MIME_EXTENSION = Object.freeze({
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
});

const createPhotoError = (message, code = "FAMILY_HEAD_PHOTO_INVALID", statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const parseFamilyHeadPhotoDataUrl = (value) => {
  if (typeof value !== "string") {
    throw createPhotoError("Family head photo data is invalid.");
  }

  const normalizedValue = value.trim();
  const match = DATA_URL_PATTERN.exec(normalizedValue);
  if (!match || !isValidFamilyHeadPhotoDataUrl(normalizedValue)) {
    throw createPhotoError(
      "Family head photo must be a supported, readable image.",
    );
  }

  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > FAMILY_HEAD_PHOTO_MAX_BYTES) {
    throw createPhotoError("Family head photo must be 2 MB or smaller.");
  }

  return {
    buffer,
    mimeType,
    fileExtension: MIME_EXTENSION[mimeType],
    sizeBytes: buffer.length,
    sha256: sha256(buffer),
  };
};

const getFamilyHeadPhotoMetadata = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalizedValue = value.trim();
  const match = DATA_URL_PATTERN.exec(normalizedValue);
  if (match) {
    try {
      const parsed = parseFamilyHeadPhotoDataUrl(normalizedValue);
      return {
        photo_present: true,
        photo_sha256: parsed.sha256,
        photo_mime_type: parsed.mimeType,
        photo_size_bytes: parsed.sizeBytes,
      };
    } catch {
      // Keep invalid requests identifiable for sync idempotency without retaining
      // their submitted data. The registration validator returns the safe error.
      return {
        photo_present: true,
        photo_sha256: sha256(Buffer.from(normalizedValue, "utf8")),
        photo_mime_type: "invalid",
        photo_size_bytes: null,
      };
    }
  }

  return {
    photo_present: true,
    photo_sha256: sha256(Buffer.from(normalizedValue, "utf8")),
    photo_mime_type: "legacy-reference",
    photo_size_bytes: null,
  };
};

const safePathSegment = (value, fallback) => {
  const normalized = String(value || "").trim();
  return /^[A-Za-z0-9_-]{1,80}$/.test(normalized) ? normalized : fallback;
};

const buildFamilyHeadPhotoPath = ({
  disasterEventId,
  barangayId,
  operationId,
  householdId,
  sha256: photoHash,
  fileExtension,
}) => {
  const ownerSegment = householdId
    ? `households/${safePathSegment(householdId, "unknown")}`
    : `operations/${sha256(Buffer.from(String(operationId || "missing"), "utf8")).slice(0, 32)}`;
  return [
    safePathSegment(disasterEventId, "unknown-event"),
    safePathSegment(barangayId, "outside-malvar"),
    ownerSegment,
    `${photoHash}.${fileExtension}`,
  ].join("/");
};

const getStorage = () => {
  const supabaseUrl =
    String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const serviceRoleKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  ).trim();
  const storage = getSupabaseStorageClient();
  if (!supabaseUrl || !serviceRoleKey || !storage) {
    throw createPhotoError(
      "Family head photo storage is not configured on the server.",
      "FAMILY_HEAD_PHOTO_STORAGE_UNAVAILABLE",
      503,
    );
  }
  return storage;
};

const downloadAndVerifyExistingObject = async ({ storage, path, expectedHash }) => {
  const { data, error } = await storage.storage
    .from(FAMILY_HEAD_PHOTO_BUCKET)
    .download(path);
  if (error || !data) {
    return false;
  }

  const bytes = Buffer.from(await data.arrayBuffer());
  return sha256(bytes) === expectedHash;
};

const uploadFamilyHeadPhoto = async ({
  dataUrl,
  disasterEventId,
  barangayId,
  operationId,
  householdId = null,
}) => {
  const parsed = parseFamilyHeadPhotoDataUrl(dataUrl);
  const path = buildFamilyHeadPhotoPath({
    disasterEventId,
    barangayId,
    operationId,
    householdId,
    sha256: parsed.sha256,
    fileExtension: parsed.fileExtension,
  });
  const storage = getStorage();
  const { error } = await storage.storage
    .from(FAMILY_HEAD_PHOTO_BUCKET)
    .upload(path, parsed.buffer, {
      contentType: parsed.mimeType,
      upsert: false,
      cacheControl: "0",
    });

  if (error) {
    const verifiedExistingObject = await downloadAndVerifyExistingObject({
      storage,
      path,
      expectedHash: parsed.sha256,
    });
    if (!verifiedExistingObject) {
      throw createPhotoError(
        "Family head photo could not be uploaded. Retry the registration when storage is available.",
        "FAMILY_HEAD_PHOTO_UPLOAD_FAILED",
        503,
      );
    }
    return {
      path,
      sha256: parsed.sha256,
      mimeType: parsed.mimeType,
      sizeBytes: parsed.sizeBytes,
      created: false,
    };
  }

  return {
    path,
    sha256: parsed.sha256,
    mimeType: parsed.mimeType,
    sizeBytes: parsed.sizeBytes,
    created: true,
  };
};

const createSignedFamilyHeadPhotoUrl = async (path) => {
  const storagePath = normalizeStoragePath(path);
  if (!storagePath) {
    return null;
  }

  const storage = getStorage();
  const { data, error } = await storage.storage
    .from(FAMILY_HEAD_PHOTO_BUCKET)
    .createSignedUrl(storagePath, FAMILY_HEAD_PHOTO_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw createPhotoError(
      "Family head photo is temporarily unavailable.",
      "FAMILY_HEAD_PHOTO_RETRIEVAL_FAILED",
      503,
    );
  }

  return {
    url: data.signedUrl,
    expiresAt: new Date(
      Date.now() + FAMILY_HEAD_PHOTO_SIGNED_URL_TTL_SECONDS * 1000,
    ).toISOString(),
  };
};

const resolveFamilyHeadPhoto = async ({
  familyHeadPhotoPath,
  legacyPhotoUrl,
}) => {
  if (familyHeadPhotoPath) {
    return createSignedFamilyHeadPhotoUrl(familyHeadPhotoPath);
  }
  const legacyUrl = String(legacyPhotoUrl || "").trim();
  return legacyUrl ? { url: legacyUrl, expiresAt: null } : null;
};

const removeUnreferencedFamilyHeadPhoto = async ({
  path,
  dbClient,
}) => {
  const storagePath = normalizeStoragePath(path);
  if (!storagePath) {
    return false;
  }

  try {
    const referenceDbClient = dbClient || require("../config/db");
    const referenceResult = await referenceDbClient.query(
      `SELECT 1 FROM households WHERE family_head_photo_path = $1 LIMIT 1`,
      [storagePath],
    );
    if (referenceResult.rows.length > 0) {
      return false;
    }
  } catch (error) {
    console.warn("Family-head photo cleanup reference check failed", {
      path_sha256: sha256(Buffer.from(storagePath, "utf8")),
      error_code: error?.code || error?.name || "unknown",
    });
    return false;
  }

  try {
    const storage = getStorage();
    const { error } = await storage.storage
      .from(FAMILY_HEAD_PHOTO_BUCKET)
      .remove([storagePath]);
    if (error) {
      console.warn("Family-head photo orphan cleanup failed", {
        path_sha256: sha256(Buffer.from(storagePath, "utf8")),
        error_code: error?.statusCode || error?.name || "storage-error",
      });
      return false;
    }
    return true;
  } catch (error) {
    console.warn("Family-head photo orphan cleanup failed", {
      path_sha256: sha256(Buffer.from(storagePath, "utf8")),
      error_code: error?.code || error?.name || "unknown",
    });
    return false;
  }
};

module.exports = {
  FAMILY_HEAD_PHOTO_BUCKET,
  FAMILY_HEAD_PHOTO_MAX_BYTES,
  FAMILY_HEAD_PHOTO_SIGNED_URL_TTL_SECONDS,
  buildFamilyHeadPhotoPath,
  createSignedFamilyHeadPhotoUrl,
  getFamilyHeadPhotoMetadata,
  parseFamilyHeadPhotoDataUrl,
  removeUnreferencedFamilyHeadPhoto,
  resolveFamilyHeadPhoto,
  uploadFamilyHeadPhoto,
};
