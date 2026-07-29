const { createClient } = require("@supabase/supabase-js");

const PROFILE_PICTURE_MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
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

const getStorageConfig = () => {
  const supabaseUrl =
    normalizeEnvValue(process.env.SUPABASE_URL) ||
    normalizeEnvValue(process.env.VITE_SUPABASE_URL);
  const supabaseKey =
    normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    normalizeEnvValue(process.env.SUPABASE_ANON_KEY) ||
    normalizeEnvValue(process.env.VITE_SUPABASE_ANON_KEY);
  const bucketName =
    normalizeEnvValue(process.env.PROFILE_PICTURE_STORAGE_BUCKET) ||
    "profile-pictures";

  return {
    supabaseUrl,
    supabaseKey,
    bucketName,
    isConfigured: Boolean(supabaseUrl && supabaseKey && bucketName),
  };
};

const getSupabaseStorageClient = () => {
  const config = getStorageConfig();

  if (!config.isConfigured) {
    return null;
  }

  if (!supabaseStorageClient) {
    supabaseStorageClient = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseStorageClient;
};

const parseDataUrl = (dataUrl) => {
  const normalizedValue = normalizeEnvValue(dataUrl);
  const match = normalizedValue.match(
    /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i,
  );

  if (!match) {
    return null;
  }

  const mimeType = match[1].toLowerCase();
  const base64Payload = match[2];

  if (!PROFILE_PICTURE_ALLOWED_MIME_TYPES.has(mimeType)) {
    return null;
  }

  const buffer = Buffer.from(base64Payload, "base64");

  if (!buffer.length) {
    return null;
  }

  return {
    mimeType,
    buffer,
    fileExtension:
      PROFILE_PICTURE_FILE_EXTENSION_BY_MIME[mimeType] || "bin",
  };
};

const sanitizeFileName = (value = "") => {
  const trimmedValue = normalizeEnvValue(value);

  if (!trimmedValue) {
    return "profile-picture";
  }

  return trimmedValue.replace(/[^a-zA-Z0-9._-]/g, "-");
};

const buildProfilePicturePath = ({ userId, roleCode, fileExtension }) => {
  const safeRoleCode = normalizeEnvValue(roleCode || "unknown").toLowerCase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  return `${userId}/${safeRoleCode}/${timestamp}.${fileExtension}`;
};

const buildPublicUrl = ({ supabaseUrl, bucketName, storagePath }) => {
  const normalizedBaseUrl = normalizeEnvValue(supabaseUrl).replace(/\/+$/, "");
  const encodedSegments = String(storagePath || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${normalizedBaseUrl}/storage/v1/object/public/${bucketName}/${encodedSegments}`;
};

const isSupportedProfilePictureReference = (value = "") => {
  const trimmedValue = normalizeEnvValue(value);

  if (!trimmedValue) {
    return true;
  }

  if (trimmedValue.startsWith("data:image/")) {
    return true;
  }

  if (trimmedValue.startsWith("/")) {
    return true;
  }

  try {
    const parsedUrl = new URL(trimmedValue);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch (_error) {
    return false;
  }
};

const isStorageReady = () => getStorageConfig().isConfigured;

const uploadProfilePicture = async ({
  userId,
  roleCode,
  profilePictureDataUrl,
  fileName,
}) => {
  const parsedFile = parseDataUrl(profilePictureDataUrl);

  if (!parsedFile) {
    const error = new Error("Profile picture must be a valid JPG, PNG, or WEBP image.");
    error.statusCode = 400;
    throw error;
  }

  if (parsedFile.buffer.length > PROFILE_PICTURE_MAX_FILE_SIZE_BYTES) {
    const error = new Error("Profile picture is too large.");
    error.statusCode = 400;
    throw error;
  }

  const config = getStorageConfig();
  const supabase = getSupabaseStorageClient();

  if (!config.isConfigured || !supabase) {
    return {
      storageMode: "database",
      profilePictureReference: normalizeEnvValue(profilePictureDataUrl),
      profilePictureFileName: sanitizeFileName(fileName),
    };
  }

  const storagePath = buildProfilePicturePath({
    userId,
    roleCode,
    fileExtension: parsedFile.fileExtension,
  });
  const { error } = await supabase.storage
    .from(config.bucketName)
    .upload(storagePath, parsedFile.buffer, {
      contentType: parsedFile.mimeType,
      upsert: true,
      cacheControl: "3600",
    });

  if (error) {
    const uploadError = new Error("Failed to upload the profile picture.");
    uploadError.statusCode = 500;
    throw uploadError;
  }

  return {
    storageMode: "storage",
    profilePictureReference: buildPublicUrl({
      supabaseUrl: config.supabaseUrl,
      bucketName: config.bucketName,
      storagePath,
    }),
    profilePictureFileName: sanitizeFileName(fileName),
  };
};

const extractStoragePathFromUrl = (value = "") => {
  const trimmedValue = normalizeEnvValue(value);
  const config = getStorageConfig();

  if (!trimmedValue || !config.isConfigured) {
    return "";
  }

  const expectedPrefix = `${normalizeEnvValue(config.supabaseUrl).replace(/\/+$/, "")}/storage/v1/object/public/${config.bucketName}/`;

  if (!trimmedValue.startsWith(expectedPrefix)) {
    return "";
  }

  return trimmedValue
    .slice(expectedPrefix.length)
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");
};

const removeProfilePicture = async (value = "") => {
  const storagePath = extractStoragePathFromUrl(value);
  const config = getStorageConfig();
  const supabase = getSupabaseStorageClient();

  if (!storagePath || !config.isConfigured || !supabase) {
    return false;
  }

  const { error } = await supabase.storage.from(config.bucketName).remove([storagePath]);

  if (error) {
    return false;
  }

  return true;
};

module.exports = {
  PROFILE_PICTURE_MAX_FILE_SIZE_BYTES,
  PROFILE_PICTURE_ALLOWED_MIME_TYPES,
  extractStoragePathFromUrl,
  isStorageReady,
  isSupportedProfilePictureReference,
  removeProfilePicture,
  uploadProfilePicture,
};
