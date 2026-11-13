import { getAccessMode } from "../utils/accessMode.js";
import { getModeStorageKey, readStorageValue, writeStorageValue } from "../utils/modeStorage.js";

const DEVICE_ID_STORAGE_SEGMENT = "offline-device-id";

const createFallbackDeviceId = () => {
  const randomHex = (length) => {
    let value = "";

    while (value.length < length) {
      value += Math.floor(Math.random() * 0x100000000)
        .toString(16)
        .padStart(8, "0");
    }

    return value.slice(0, length);
  };

  const value = randomHex(32).split("");
  value[12] = "4";
  value[16] = (8 + (Number.parseInt(value[16], 16) % 4)).toString(16);

  return [
    value.slice(0, 8).join(""),
    value.slice(8, 12).join(""),
    value.slice(12, 16).join(""),
    value.slice(16, 20).join(""),
    value.slice(20, 32).join(""),
  ].join("-");
};

const createDeviceId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return createFallbackDeviceId();
};

export const getOfflineDeviceId = (mode = getAccessMode()) => {
  if (typeof window === "undefined") {
    return null;
  }

  const storageKey = getModeStorageKey(DEVICE_ID_STORAGE_SEGMENT, mode);
  const storedDeviceId = readStorageValue(storageKey);

  if (storedDeviceId) {
    return storedDeviceId;
  }

  const deviceId = createDeviceId();
  writeStorageValue(storageKey, deviceId);
  return readStorageValue(storageKey) || deviceId;
};
