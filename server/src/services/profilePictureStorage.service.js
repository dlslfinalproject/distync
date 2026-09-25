const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const PROFILE_PICTURE_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const getMaxBase64EncodedLength = (binaryByteLength) =>
  4 * Math.ceil(binaryByteLength / 3);
const PROFILE_PICTURE_MAX_BASE64_ENCODED_LENGTH = getMaxBase64EncodedLength(
  PROFILE_PICTURE_MAX_FILE_SIZE_BYTES,
);
const PROFILE_PICTURE_SIGNED_URL_TTL_SECONDS = 10 * 60;
const PROFILE_PICTURE_STORAGE_DIAGNOSTIC_MESSAGE_MAX_LENGTH = 300;
const PROFILE_PICTURE_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const PROFILE_PICTURE_FILE_EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

let supabaseStorageClient = null;

const normalizeEnvValue = (value) => {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const sanitizeStorageDiagnosticText = (value, config) => {
  if (typeof value !== "string") {
    return null;
  }

  let sanitizedValue = value.replace(/[\r\n\t\v\f\u2028\u2029]+/g, " ");
  const secrets = [config.supabaseServiceRoleKey, config.supabaseUrl].filter(
    (secret) => typeof secret === "string" && secret.length > 0,
  );

  for (const secret of secrets) {
    sanitizedValue = sanitizedValue.split(secret).join("[REDACTED]");
  }

  sanitizedValue = sanitizedValue
    .replace(
      /\bAuthorization\s*:\s*(?:Bearer\s+)?[^\s,;]+/gi,
      "[REDACTED_AUTH]",
    )
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[REDACTED_URL]");

  return sanitizedValue.slice(
    0,
    PROFILE_PICTURE_STORAGE_DIAGNOSTIC_MESSAGE_MAX_LENGTH,
  );
};

const getStorageErrorField = (error, field, isValid) => {
  try {
    const value = error?.[field];
    return isValid(value) ? value : null;
  } catch {
    return null;
  }
};

const logProfilePictureStorageUploadError = (error, config) => {
  let projectHost = null;

  try {
    projectHost = new URL(config.supabaseUrl).hostname || null;
  } catch {
    projectHost = null;
  }

  const diagnostic = {
    projectHost,
    bucketName: sanitizeStorageDiagnosticText(config.bucketName, config),
    name: sanitizeStorageDiagnosticText(
      getStorageErrorField(
        error,
        "name",
        (value) => typeof value === "string",
      ),
      config,
    ),
    status: getStorageErrorField(error, "status", Number.isInteger),
    statusCode: sanitizeStorageDiagnosticText(
      getStorageErrorField(
        error,
        "statusCode",
        (value) => typeof value === "string",
      ),
      config,
    ),
    message: sanitizeStorageDiagnosticText(
      getStorageErrorField(
        error,
        "message",
        (value) => typeof value === "string",
      ),
      config,
    ),
  };

  try {
    console.error("[profile-picture-storage:upload]", diagnostic);
  } catch {
    // Diagnostic logging must never replace the generic application error.
  }
};

const normalizeStoragePath = (value = "") => {
  const trimmedValue = normalizeEnvValue(value);

  if (
    !trimmedValue ||
    trimmedValue.startsWith("/") ||
    trimmedValue.includes("..") ||
    trimmedValue.includes("\\")
  ) {
    return "";
  }

  if (/^[a-z]+:/i.test(trimmedValue)) {
    return "";
  }

  return trimmedValue;
};

const getStorageConfig = () => {
  const supabaseUrl =
    normalizeEnvValue(process.env.SUPABASE_URL) ||
    normalizeEnvValue(process.env.VITE_SUPABASE_URL);
  const supabaseServiceRoleKey = normalizeEnvValue(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const bucketName =
    normalizeEnvValue(process.env.PROFILE_PICTURE_STORAGE_BUCKET) ||
    "distync-profile-pictures";

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    bucketName,
    isConfigured: Boolean(supabaseUrl && supabaseServiceRoleKey && bucketName),
  };
};

const getSupabaseStorageClient = () => {
  const config = getStorageConfig();

  if (!config.isConfigured) {
    return null;
  }

  if (!supabaseStorageClient) {
    supabaseStorageClient = createClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return supabaseStorageClient;
};

const ensureStorageConfigured = () => {
  const config = getStorageConfig();

  if (config.isConfigured) {
    return config;
  }

  const error = new Error(
    "Profile picture storage is not configured on the server.",
  );
  error.statusCode = 500;
  throw error;
};

const sanitizeFileName = (value = "") => {
  const trimmedValue = normalizeEnvValue(value);

  if (!trimmedValue) {
    return "profile-picture";
  }

  return trimmedValue.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
};

const hasApprovedImageSignature = ({ mimeType, buffer }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return false;
  }

  if (mimeType === "image/png") {
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return (
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (mimeType === "image/webp") {
    return (
      buffer.subarray(0, 4).equals(Buffer.from("RIFF")) &&
      buffer.subarray(8, 12).equals(Buffer.from("WEBP"))
    );
  }

  return false;
};

const parseProfilePictureUpload = ({
  mimeType,
  fileDataBase64,
}) => {
  const normalizedMimeType = normalizeEnvValue(mimeType).toLowerCase();
  const normalizedBase64 = normalizeEnvValue(fileDataBase64);

  if (!PROFILE_PICTURE_ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
    const error = new Error(
      "Profile picture must be a JPG, PNG, or WEBP image.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (!normalizedBase64 || !/^[A-Za-z0-9+/=]+$/.test(normalizedBase64)) {
    const error = new Error("Profile picture upload data is invalid.");
    error.statusCode = 400;
    throw error;
  }

  const buffer = Buffer.from(normalizedBase64, "base64");

  if (!buffer.length) {
    const error = new Error("Profile picture file is empty.");
    error.statusCode = 400;
    throw error;
  }

  if (buffer.length > PROFILE_PICTURE_MAX_FILE_SIZE_BYTES) {
    const error = new Error("Profile picture must be 2 MB or smaller.");
    error.statusCode = 400;
    throw error;
  }

  if (
    normalizedBase64.startsWith("data:") ||
    normalizedBase64.startsWith("http://") ||
    normalizedBase64.startsWith("https://") ||
    normalizedBase64.startsWith("/assets/") ||
    normalizedBase64.startsWith("/public/") ||
    normalizedBase64.startsWith("blob:") ||
    normalizedBase64.includes("\\") ||
    /^[a-z]:/i.test(normalizedBase64)
  ) {
    const error = new Error(
      "The selected profile picture could not be processed. Choose another image and try again.",
    );
    error.statusCode = 400;
    throw error;
  }
  if (!hasApprovedImageSignature({ mimeType: normalizedMimeType, buffer })) {
    const error = new Error(
      "The selected profile picture could not be processed. Choose another image and try again.",
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    mimeType: normalizedMimeType,
    buffer,
    fileExtension:
      PROFILE_PICTURE_FILE_EXTENSION_BY_MIME[normalizedMimeType] || "bin",
  };
};

const buildProfilePicturePath = ({ userId, fileExtension }) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${userId}/${timestamp}-${crypto.randomUUID()}.${fileExtension}`;
};

const createSignedProfilePictureUrl = async (profilePicturePath) => {
  const storagePath = normalizeStoragePath(profilePicturePath);

  if (!storagePath) {
    return {
      profilePictureUrl: "",
      profilePictureUrlExpiresAt: "",
    };
  }

  const config = ensureStorageConfigured();
  const supabase = getSupabaseStorageClient();
  const { data, error } = await supabase.storage
    .from(config.bucketName)
    .createSignedUrl(storagePath, PROFILE_PICTURE_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    const signedUrlError = new Error(
      "Failed to generate a profile picture URL.",
    );
    signedUrlError.statusCode = 500;
    throw signedUrlError;
  }

  return {
    profilePictureUrl: data.signedUrl,
    profilePictureUrlExpiresAt: new Date(
      Date.now() + PROFILE_PICTURE_SIGNED_URL_TTL_SECONDS * 1000,
    ).toISOString(),
  };
};

const uploadProfilePicture = async ({
  userId,
  fileName,
  mimeType,
  fileDataBase64,
}) => {
  const parsedFile = parseProfilePictureUpload({
    mimeType,
    fileDataBase64,
  });
  const config = ensureStorageConfigured();
  const supabase = getSupabaseStorageClient();
  const profilePicturePath = buildProfilePicturePath({
    userId,
    fileExtension: parsedFile.fileExtension,
  });
  const { error } = await supabase.storage
    .from(config.bucketName)
    .upload(profilePicturePath, parsedFile.buffer, {
      contentType: parsedFile.mimeType,
      upsert: false,
      cacheControl: "300",
    });

  if (error) {
    logProfilePictureStorageUploadError(error, config);

    const uploadError = new Error("Failed to upload the profile picture.");
    uploadError.statusCode = 500;
    throw uploadError;
  }

  return {
    profilePicturePath,
    profilePictureFileName: sanitizeFileName(fileName),
  };
};

const removeProfilePicture = async (profilePicturePath = "") => {
  const storagePath = normalizeStoragePath(profilePicturePath);

  if (!storagePath) {
    return false;
  }

  const config = ensureStorageConfigured();
  const supabase = getSupabaseStorageClient();
  const { error } = await supabase.storage
    .from(config.bucketName)
    .remove([storagePath]);

  if (error) {
    return false;
  }

  return true;
};

module.exports = {
  PROFILE_PICTURE_ALLOWED_MIME_TYPES,
  PROFILE_PICTURE_MAX_BASE64_ENCODED_LENGTH,
  PROFILE_PICTURE_MAX_FILE_SIZE_BYTES,
  PROFILE_PICTURE_SIGNED_URL_TTL_SECONDS,
  createSignedProfilePictureUrl,
  getMaxBase64EncodedLength,
  getStorageConfig,
  getSupabaseStorageClient,
  normalizeStoragePath,
  parseProfilePictureUpload,
  removeProfilePicture,
  uploadProfilePicture,
};
