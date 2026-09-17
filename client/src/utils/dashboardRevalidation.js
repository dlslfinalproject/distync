import { useEffect, useRef } from "react";

export const DASHBOARD_REVALIDATION_EVENT = "distync-dashboard-revalidate";

export const useDashboardRevalidation = (onRevalidate, { enabled = true } = {}) => {
  const callbackRef = useRef(onRevalidate);

  useEffect(() => {
    callbackRef.current = onRevalidate;
  }, [onRevalidate]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return undefined;
    }

    const handleRevalidation = (event) => {
      callbackRef.current?.(event?.detail || {});
    };

    window.addEventListener(
      DASHBOARD_REVALIDATION_EVENT,
      handleRevalidation,
    );

    return () => {
      window.removeEventListener(
        DASHBOARD_REVALIDATION_EVENT,
        handleRevalidation,
      );
    };
  }, [enabled]);
};
