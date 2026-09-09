import { useEffect, useRef, useState } from "react";
import { fetchInventoryBatches } from "../inventory-batches/inventoryBatchService.js";
import {
  buildInventoryDistributionReadinessScopeKey,
  createInventoryDistributionReadinessRequestGuard,
} from "./inventoryDistributionReadiness.js";

const emptyReadinessState = {
  scopeKey: "",
  status: "idle",
  inventoryBatches: [],
  errorMessage: "",
};

export const useInventoryDistributionReadiness = ({
  isOpen = false,
  showReadinessStatus = false,
  row = null,
  disasterEventId = "",
  requestSequence = 0,
} = {}) => {
  const requestGuardRef = useRef(null);
  const [readinessState, setReadinessState] = useState(emptyReadinessState);
  const scopeKey = buildInventoryDistributionReadinessScopeKey({
    isOpen,
    showReadinessStatus,
    row,
    disasterEventId,
    requestSequence,
  });

  if (!requestGuardRef.current) {
    requestGuardRef.current = createInventoryDistributionReadinessRequestGuard();
  }

  useEffect(() => {
    const requestGuard = requestGuardRef.current;

    if (!scopeKey) {
      setReadinessState(emptyReadinessState);
      return () => {
        requestGuard.invalidate();
      };
    }

    const requestGeneration = requestGuard.start();
    let isMounted = true;

    setReadinessState({
      scopeKey,
      status: "loading",
      inventoryBatches: [],
      errorMessage: "",
    });

    // The batch service shares its in-flight promise through the existing
    // coordinator. Do not abort it from this page-local lifecycle because
    // another inventory consumer may be using the same request.
    void Promise.resolve()
      .then(() => fetchInventoryBatches())
      .then(
        (payload) => {
          if (!isMounted || !requestGuard.isCurrent(requestGeneration)) {
            return;
          }

          if (!Array.isArray(payload)) {
            setReadinessState({
              scopeKey,
              status: "error",
              inventoryBatches: [],
              errorMessage:
                "Inventory readiness is unavailable because the batch snapshot was not complete.",
            });
            return;
          }

          setReadinessState({
            scopeKey,
            status: "ready",
            inventoryBatches: payload,
            errorMessage: "",
          });
        },
        (error) => {
          if (!isMounted || !requestGuard.isCurrent(requestGeneration)) {
            return;
          }

          setReadinessState({
            scopeKey,
            status: "error",
            inventoryBatches: [],
            errorMessage:
              error?.message ||
              "Inventory readiness is unavailable because the batch snapshot could not be loaded.",
          });
        },
      );

    return () => {
      isMounted = false;
      requestGuard.invalidate();
    };
  }, [scopeKey]);

  const hasCurrentState = readinessState.scopeKey === scopeKey;
  const shouldLoadReadiness = Boolean(scopeKey);

  return {
    inventoryBatches:
      shouldLoadReadiness && hasCurrentState && readinessState.status === "ready"
        ? readinessState.inventoryBatches
        : [],
    isLoading:
      shouldLoadReadiness &&
      (!hasCurrentState || readinessState.status === "loading"),
    errorMessage:
      shouldLoadReadiness &&
      hasCurrentState &&
      readinessState.status === "error"
        ? readinessState.errorMessage
        : "",
  };
};
