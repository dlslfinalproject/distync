const crypto = require("crypto");

const {
  getSupabaseStorageClient,
  normalizeStoragePath,
} = require("./profilePictureStorage.service");
const {
  isValidFamilyHeadPhotoDataUrl,
} = require("../validators/householdRegistration.validator");

const CLAIM_PROOF_PHOTO_BUCKET =
  String(process.env.CLAIM_PROOF_PHOTO_STORAGE_BUCKET || "").trim() ||
  "distync-claim-proof-photos";
const CLAIM_PROOF_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const CLAIM_PROOF_PHOTO_MAX_DIMENSION = 1600;
const CLAIM_PROOF_PHOTO_SIGNED_URL_TTL_SECONDS = 5 * 60;
const DATA_URL_PATTERN = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/i;

const createPhotoError = (
  message,
  code = "CLAIM_PROOF_PHOTO_INVALID",
  statusCode = 400,
) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const getJpegDimensions = (bytes) => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ]);
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }

    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }

    if (offset >= bytes.length) {
      return null;
    }

    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) {
      return null;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 2 > bytes.length) {
      return null;
    }

    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return null;
    }

    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) {
        return null;
      }
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  return null;
};

const parseClaimProofPhotoDataUrl = (value) => {
  if (typeof value !== "string") {
    throw createPhotoError("Capture a claim-time photo before confirming.");
  }

  const match = DATA_URL_PATTERN.exec(value.trim());
  if (!match || match[1].length % 4 !== 0) {
    throw createPhotoError("Claim proof must be a supported JPEG photo.");
  }

  const buffer = Buffer.from(match[1], "base64");
  if (
    !buffer.length ||
    buffer.length > CLAIM_PROOF_PHOTO_MAX_BYTES ||
    buffer.toString("base64") !== match[1] ||
    !isValidFamilyHeadPhotoDataUrl(`data:image/jpeg;base64,${match[1]}`)
  ) {
    throw createPhotoError("Claim proof must be a readable photo under 2 MB.");
  }

  const dimensions = getJpegDimensions(buffer);
  if (
    !dimensions?.width ||
    !dimensions?.height ||
    Math.max(dimensions.width, dimensions.height) >
      CLAIM_PROOF_PHOTO_MAX_DIMENSION
  ) {
    throw createPhotoError(
      "Claim proof dimensions must be 1600 pixels or smaller on each side.",
    );
  }

  return {
    buffer,
    mimeType: "image/jpeg",
    fileExtension: "jpg",
    width: dimensions.width,
    height: dimensions.height,
    sizeBytes: buffer.length,
    sha256: sha256(buffer),
  };
};

const getClaimProofPhotoMetadata = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const parsed = parseClaimProofPhotoDataUrl(value);
    return {
      proof_photo_present: true,
      proof_photo_sha256: parsed.sha256,
      proof_photo_mime_type: parsed.mimeType,
      proof_photo_size_bytes: parsed.sizeBytes,
      proof_photo_width: parsed.width,
      proof_photo_height: parsed.height,
      valid: true,
    };
  } catch {
    return {
      proof_photo_present: true,
      proof_photo_sha256: sha256(Buffer.from(value.trim(), "utf8")),
      proof_photo_mime_type: "invalid",
      proof_photo_size_bytes: null,
      proof_photo_width: null,
      proof_photo_height: null,
      valid: false,
    };
  }
};

const safePathSegment = (value, fallback) => {
  const normalized = String(value || "").trim();
  return /^[A-Za-z0-9_-]{1,80}$/.test(normalized) ? normalized : fallback;
};

const buildClaimProofPhotoPath = ({
  disasterEventId,
  barangayId,
  operationId,
  sha256: photoHash,
  fileExtension = "jpg",
}) => {
  if (!String(operationId || "").trim()) {
    throw createPhotoError(
      "Claim proof operation identity is required.",
      "CLAIM_PROOF_OPERATION_ID_REQUIRED",
    );
  }
  if (!/^[a-f0-9]{64}$/i.test(String(photoHash || ""))) {
    throw createPhotoError("Claim proof hash is invalid.");
  }

  const operationHash = sha256(Buffer.from(String(operationId), "utf8")).slice(0, 32);
  return [
    safePathSegment(disasterEventId, "unknown-event"),
    safePathSegment(barangayId, "outside-malvar"),
    "claims",
    "operations",
    operationHash,
    `${photoHash}.${fileExtension}`,
  ].join("/");
};

const isClaimProofPhotoPath = (path) => {
  const normalized = normalizeStoragePath(path);
  return Boolean(
    normalized &&
      /^[A-Za-z0-9_-]{1,80}\/[A-Za-z0-9_-]{1,80}\/claims\/operations\/[a-f0-9]{32}\/[a-f0-9]{64}\.jpg$/i.test(
        normalized,
      ),
  );
};

const getStorage = () => {
  const supabaseUrl =
    String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const storage = getSupabaseStorageClient();
  if (!supabaseUrl || !serviceRoleKey || !storage) {
    throw createPhotoError(
      "Claim proof photo storage is not configured on the server.",
      "CLAIM_PROOF_PHOTO_STORAGE_UNAVAILABLE",
      503,
    );
  }
  return storage;
};

const downloadAndVerifyExistingObject = async ({ storage, path, expectedHash }) => {
  const { data, error } = await storage.storage
    .from(CLAIM_PROOF_PHOTO_BUCKET)
    .download(path);
  if (error || !data) {
    return false;
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  return sha256(bytes) === expectedHash;
};

const uploadClaimProofPhoto = async ({
  dataUrl,
  disasterEventId,
  barangayId,
  operationId,
}) => {
  const parsed = parseClaimProofPhotoDataUrl(dataUrl);
  const path = buildClaimProofPhotoPath({
    disasterEventId,
    barangayId,
    operationId,
    sha256: parsed.sha256,
    fileExtension: parsed.fileExtension,
  });
  const storage = getStorage();
  const { error } = await storage.storage
    .from(CLAIM_PROOF_PHOTO_BUCKET)
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
        "Claim proof photo could not be stored. Retry the distribution when storage is available.",
        "CLAIM_PROOF_PHOTO_UPLOAD_FAILED",
        503,
      );
    }
    return {
      path,
      sha256: parsed.sha256,
      mimeType: parsed.mimeType,
      sizeBytes: parsed.sizeBytes,
      width: parsed.width,
      height: parsed.height,
      created: false,
    };
  }

  return {
    path,
    sha256: parsed.sha256,
    mimeType: parsed.mimeType,
    sizeBytes: parsed.sizeBytes,
    width: parsed.width,
    height: parsed.height,
    created: true,
  };
};

const createSignedClaimProofPhotoUrl = async (path) => {
  const storagePath = normalizeStoragePath(path);
  if (!isClaimProofPhotoPath(storagePath)) {
    throw createPhotoError(
      "Claim proof photo is unavailable.",
      "CLAIM_PROOF_PHOTO_RETRIEVAL_FAILED",
      503,
    );
  }

  const storage = getStorage();
  const { data, error } = await storage.storage
    .from(CLAIM_PROOF_PHOTO_BUCKET)
    .createSignedUrl(storagePath, CLAIM_PROOF_PHOTO_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw createPhotoError(
      "Claim proof photo is temporarily unavailable.",
      "CLAIM_PROOF_PHOTO_RETRIEVAL_FAILED",
      503,
    );
  }

  return {
    url: data.signedUrl,
    expiresAt: new Date(
      Date.now() + CLAIM_PROOF_PHOTO_SIGNED_URL_TTL_SECONDS * 1000,
    ).toISOString(),
  };
};

const hasDistributionReference = async ({ path, dbClient }) => {
  const client = dbClient || require("../config/db");
  const result = await client.query(
    `SELECT 1 FROM distribution_transactions WHERE proof_photo_path = $1 LIMIT 1`,
    [path],
  );
  return result.rows.length > 0;
};

const removeUnreferencedClaimProofPhoto = async ({ path, dbClient } = {}) => {
  const storagePath = normalizeStoragePath(path);
  if (!isClaimProofPhotoPath(storagePath)) {
    return false;
  }

  try {
    if (await hasDistributionReference({ path: storagePath, dbClient })) {
      return false;
    }
    // Repeat the reference check immediately before removal to narrow the race
    // with an accepting transaction.
    if (await hasDistributionReference({ path: storagePath, dbClient })) {
      return false;
    }

    const storage = getStorage();
    const { error } = await storage.storage
      .from(CLAIM_PROOF_PHOTO_BUCKET)
      .remove([storagePath]);
    return !error;
  } catch (error) {
    console.warn("Claim proof photo orphan cleanup failed", {
      path_sha256: sha256(Buffer.from(storagePath, "utf8")),
      error_code: error?.code || error?.name || "unknown",
    });
    return false;
  }
};

module.exports = {
  CLAIM_PROOF_PHOTO_BUCKET,
  CLAIM_PROOF_PHOTO_MAX_BYTES,
  CLAIM_PROOF_PHOTO_MAX_DIMENSION,
  CLAIM_PROOF_PHOTO_SIGNED_URL_TTL_SECONDS,
  buildClaimProofPhotoPath,
  createSignedClaimProofPhotoUrl,
  getClaimProofPhotoMetadata,
  isClaimProofPhotoPath,
  parseClaimProofPhotoDataUrl,
  removeUnreferencedClaimProofPhoto,
  uploadClaimProofPhoto,
};
