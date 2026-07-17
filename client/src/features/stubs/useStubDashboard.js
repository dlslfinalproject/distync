import { useEffect, useMemo, useState } from "react";
import { fetchBarangayStubDashboard } from "./stubService";
import { getPendingLocalStubRows } from "./stubOfflineRows";

const emptyMetrics = {
  total_issued_stubs: 0,
  claimed_stubs: 0,
  unclaimed_stubs: 0,
  beneficiary_families: 0,
};

const emptyDashboard = {
  assigned_barangay: null,
  assigned_barangay_id: null,
  is_dev_override: false,
  disaster_event: null,
  metrics: emptyMetrics,
  count: 0,
  data: [],
};

const getFriendlyStubDashboardErrorMessage = (error) => {
  if (error?.code === "NO_ASSIGNED_BARANGAY") {
    return "No assigned barangay. Please contact administrator.";
  }

  if (error?.code === "INVALID_OVERRIDE_BARANGAY") {
    return "The selected fallback barangay is not available.";
  }

  if (error?.code === "BARANGAY_OVERRIDE_NOT_ALLOWED") {
    return "Fallback barangay selection is not available in this mode.";
  }

  if (error?.code === "NO_STUB_EVENT_DATA") {
    return "No data available for this barangay and selected disaster event.";
  }

  return "Unable to load the stub dashboard.";
};

export const useStubDashboard = ({
  userId,
  disasterEventId,
  overrideBarangayId,
  allowFallback,
  assignedBarangayId,
  sectorOptions = [],
}) => {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [pendingLocalRows, setPendingLocalRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const hasScopedBarangayContext = Boolean(userId || overrideBarangayId);

    if (!disasterEventId || !hasScopedBarangayContext) {
      setDashboard(emptyDashboard);
      setIsLoading(false);
      setErrorMessage("");
      return;
    }

    let isMounted = true;

    const loadDashboard = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetchBarangayStubDashboard({
          userId: userId || null,
          disasterEventId,
          overrideBarangayId: allowFallback ? overrideBarangayId || null : null,
        });

        if (isMounted) {
          const serverRows = Array.isArray(response.data) ? response.data : [];
          const scopedBarangayId =
            response.assigned_barangay_id ||
            overrideBarangayId ||
            assignedBarangayId ||
            null;
          const localRows = await getPendingLocalStubRows({
            disasterEventId,
            barangayId: scopedBarangayId,
            sectorOptions,
            existingHouseholdIds: serverRows.map(
              (row) => row.household?.id || row.household_id,
            ),
          });

          setDashboard({
            assigned_barangay: response.assigned_barangay || null,
            assigned_barangay_id: response.assigned_barangay_id || null,
            is_dev_override: Boolean(response.is_dev_override),
            disaster_event: response.disaster_event || null,
            metrics: response.metrics || emptyMetrics,
            count: response.count || 0,
            data: serverRows,
          });
          setPendingLocalRows(localRows);
        }
      } catch (error) {
        if (isMounted) {
          const localRows = await getPendingLocalStubRows({
            disasterEventId,
            barangayId: overrideBarangayId || assignedBarangayId || null,
            sectorOptions,
          });

          setDashboard(emptyDashboard);
          setPendingLocalRows(localRows);
          setErrorMessage(
            localRows.length > 0 ? "" : getFriendlyStubDashboardErrorMessage(error),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [
    allowFallback,
    assignedBarangayId,
    disasterEventId,
    overrideBarangayId,
    reloadKey,
    sectorOptions,
    userId,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleSyncQueueUpdated = () => {
      setReloadKey((currentValue) => currentValue + 1);
    };

    window.addEventListener("distync-sync-queue-updated", handleSyncQueueUpdated);

    return () => {
      window.removeEventListener(
        "distync-sync-queue-updated",
        handleSyncQueueUpdated,
      );
    };
  }, []);

  const summaryCards = useMemo(() => {
    return [
      {
        label: "Total Issued Stubs",
        value: dashboard.metrics.total_issued_stubs || 0,
      },
      {
        label: "Beneficiary Families",
        value: dashboard.metrics.beneficiary_families || 0,
      },
      {
        label: "Claimed Stubs",
        value: dashboard.metrics.claimed_stubs || 0,
      },
      {
        label: "Unclaimed Stubs",
        value: dashboard.metrics.unclaimed_stubs || 0,
      },
    ];
  }, [dashboard.metrics]);

  return {
    rows: [...pendingLocalRows, ...dashboard.data],
    summaryCards,
    isLoading,
    errorMessage,
    hasData: dashboard.data.length > 0,
    reloadDashboard: () => {
      setReloadKey((currentValue) => currentValue + 1);
    },
  };
};
