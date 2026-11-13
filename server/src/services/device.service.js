const deviceRepository = require("../repositories/device.repository");

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createInvalidDeviceIdentityError = () => {
  const error = new Error(
    "device_id must be a valid persistent device UUID when provided",
  );
  error.statusCode = 400;
  error.code = "INVALID_DEVICE_IDENTITY";
  return error;
};

const createDeviceResolutionError = (cause) => {
  const error = new Error(
    "The synchronization device could not be resolved. Please retry synchronization.",
  );
  error.statusCode = 500;
  error.code = "DEVICE_RESOLUTION_FAILED";
  error.cause = cause;
  return error;
};

const normalizeClientDeviceUuid = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw createInvalidDeviceIdentityError();
  }

  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedValue) {
    return null;
  }

  if (!uuidPattern.test(normalizedValue)) {
    throw createInvalidDeviceIdentityError();
  }

  return normalizedValue;
};

const resolveCanonicalDeviceId = async ({
  clientDeviceUuid,
  dbClient = null,
} = {}) => {
  const normalizedClientDeviceUuid = normalizeClientDeviceUuid(clientDeviceUuid);

  if (!normalizedClientDeviceUuid) {
    return null;
  }

  try {
    const device = await deviceRepository.upsertDeviceByUuid(
      normalizedClientDeviceUuid,
      dbClient || undefined,
    );

    if (!device?.id) {
      throw new Error("The device repository did not return a canonical device id.");
    }

    return device.id;
  } catch (error) {
    throw createDeviceResolutionError(error);
  }
};

module.exports = {
  isValidClientDeviceUuid: (value) => {
    try {
      return Boolean(normalizeClientDeviceUuid(value));
    } catch (_error) {
      return false;
    }
  },
  normalizeClientDeviceUuid,
  resolveCanonicalDeviceId,
};
