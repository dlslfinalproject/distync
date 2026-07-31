const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const PROFILE_PICTURE_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const PROFILE_PICTURE_SIGNED_URL_TTL_SECONDS = 10 * 60;
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
    const error = new Error("Profile picture is too large.");
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
  PROFILE_PICTURE_MAX_FILE_SIZE_BYTES,
  PROFILE_PICTURE_SIGNED_URL_TTL_SECONDS,
  createSignedProfilePictureUrl,
  getStorageConfig,
  normalizeStoragePath,
  removeProfilePicture,
  uploadProfilePicture,
};
