import { useEffect, useRef } from "react";

const completedPageLoadKeys = new Set();

export const hasRememberedPageLoad = (pageKey) =>
  completedPageLoadKeys.has(String(pageKey || ""));

export const rememberPageLoad = (pageKey) => {
  const normalizedPageKey = String(pageKey || "");

  if (normalizedPageKey) {
    completedPageLoadKeys.add(normalizedPageKey);
  }
};

export const clearRememberedPageLoads = () => {
  completedPageLoadKeys.clear();
};

export const useRememberedInitialLoading = ({
  pageKey,
  isLoading,
  errorMessage = "",
}) => {
  const normalizedPageKey = String(pageKey || "");
  const wasLoadedBeforeMountRef = useRef(
    hasRememberedPageLoad(normalizedPageKey),
  );
  const observedLoadingRef = useRef(Boolean(isLoading));

  useEffect(() => {
    if (isLoading) {
      observedLoadingRef.current = true;
      return;
    }

    if (
      observedLoadingRef.current &&
      !errorMessage
    ) {
      rememberPageLoad(normalizedPageKey);
    }
  }, [errorMessage, isLoading, normalizedPageKey]);

  return Boolean(isLoading) &&
    !wasLoadedBeforeMountRef.current &&
    !hasRememberedPageLoad(normalizedPageKey);
};
