import {
  getAccessMode,
} from "../../../utils/accessMode.js";
import { getAuthenticatedSession } from "../../../utils/roleSession.js";

const inFlightReads = new Map();

const getRequestAuthScope = () => {
  if (typeof window === "undefined") {
    return "runtime";
  }

  try {
    const session = getAuthenticatedSession();
    return [
      getAccessMode(),
      session?.user?.id || "anonymous",
      session?.user?.role || "anonymous",
    ].join("|");
  } catch (_error) {
    return "runtime";
  }
};

const canonicalizeRequestUrl = (requestUrl) => {
  const rawUrl = String(requestUrl || "");

  try {
    const baseUrl =
      typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const url = new URL(rawUrl, baseUrl);
    url.searchParams.sort();
    return url.toString();
  } catch (_error) {
    return rawUrl;
  }
};

export const buildInventoryReadKey = (resource, requestUrl) =>
  `${getRequestAuthScope()}|${resource}|${canonicalizeRequestUrl(requestUrl)}`;

export const coalesceInventoryRead = (resource, requestUrl, request) => {
  if (typeof request !== "function") {
    throw new TypeError("coalesceInventoryRead requires a request function");
  }

  const key = buildInventoryReadKey(resource, requestUrl);
  const existingRequest = inFlightReads.get(key);

  if (existingRequest) {
    return existingRequest;
  }

  const requestPromise = Promise.resolve().then(request);
  inFlightReads.set(key, requestPromise);

  const clearRequest = () => {
    if (inFlightReads.get(key) === requestPromise) {
      inFlightReads.delete(key);
    }
  };

  void requestPromise.then(clearRequest, clearRequest);

  return requestPromise;
};
