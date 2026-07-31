import { getAccessMode } from "./accessMode.js";
import {
  getAuthenticatedSession,
  getAuthenticatedSessionForMode,
} from "./roleSession.js";

const API_BASE_URL =
  import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000";
const WINDOW_ORIGIN =
  typeof window === "undefined" ? "http://localhost" : window.location.origin;

const API_BASE_ORIGIN = new URL(API_BASE_URL, WINDOW_ORIGIN).origin;

const shouldAttachAccessToken = (requestUrl) => {
  return (
    requestUrl.origin === API_BASE_ORIGIN &&
    requestUrl.pathname.startsWith("/api/v1/") &&
    !requestUrl.pathname.startsWith("/api/v1/auth/")
  );
};

export const installAuthenticatedFetch = () => {
  if (window.__distyncAuthenticatedFetchInstalled) {
    return;
  }

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const request = new Request(input, init);
    const requestUrl = new URL(request.url, window.location.origin);

    if (!shouldAttachAccessToken(requestUrl)) {
      return nativeFetch(input, init);
    }

    const accessToken = getAuthenticatedAccessToken();

    if (!accessToken) {
      return nativeFetch(input, init);
    }

    const headers = new Headers(request.headers);

    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    return nativeFetch(
      new Request(request, {
        headers,
      }),
    );
  };

  window.__distyncAuthenticatedFetchInstalled = true;
};

export const getAuthenticatedAccessToken = () => {
  return getAuthenticatedSession()?.access_token || null;
};

export const getAuthenticatedAccessTokenForMode = (mode = getAccessMode()) => {
  return getAuthenticatedSessionForMode(mode)?.access_token || null;
};
