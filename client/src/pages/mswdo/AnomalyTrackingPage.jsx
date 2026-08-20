import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiAlertTriangle, FiEye, FiFilter, FiSearch } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { pageSpacingStyles, shellStyles } from "../../components/layout/BarangayLayout";
import EmptyState from "../../components/shared/EmptyState";
import ErrorState from "../../components/shared/ErrorState";
import FormModalShell from "../../components/shared/FormModalShell";
import LoadingState from "../../components/shared/LoadingState";
import StatusCard from "../../components/shared/StatusCard";
import ResponsiveFilterPopover from "../../components/shared/ResponsiveFilterPopover";
import {
  fetchAllDisasterEvents,
  fetchBarangayDisasterEventOptions,
  fetchBarangays,
} from "../../features/disaster-events/disasterEventService";
import {
  formatAnomalyType,
  getAnomalyActionRequired,
  getAnomalyActionSummary,
  getAnomalyExplanation,
  getAnomalyOwner,
  getAnomalyTypesForScope,
  getAnomalyPresentation,
} from "../../features/mswdo-reports/anomalyPresentation";
import { fetchMswdoAnomalies } from "../../features/mswdo-reports/mswdoReportService";

const inputStyles = {
  width: "100%",
  minHeight: "46px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #cfddeb",
  backgroundColor: "#f8fbfe",
  color: "#1f3b57",
  fontSize: "14px",
  boxSizing: "border-box",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#5f7892",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "14px 16px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "16px",
    borderBottom: "1px solid #edf3f8",
    color: "#17324d",
    fontSize: "14px",
    verticalAlign: "middle",
    lineHeight: 1.5,
  },
};

const searchInputStyles = {
  ...inputStyles,
  paddingLeft: "44px",
  backgroundColor: "#ffffff",
};

const filterPopoverStyles = {
  title: {
    margin: "0 0 16px",
    color: "#17324d",
    fontSize: "18px",
    fontWeight: 800,
  },
};

const statusFilters = [
  { value: "all", label: "All" },
  { value: "open", label: "Needs Review" },
  { value: "resolved", label: "No Action Required / Referred" },
  { value: "failed", label: "Sync Retry Needed" },
];

const orderOptions = [
  { value: "newest", label: "Newest-Oldest" },
  { value: "oldest", label: "Oldest-Newest" },
  { value: "az", label: "Sort A-Z" },
  { value: "za", label: "Sort Z-A" },
];

const DEFAULT_PAGE_SIZE = 50;
const pageSizeOptions = [25, 50, 100];

const modalStyles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
    gap: "16px",
  },
  card: {
    padding: "16px",
    borderRadius: "16px",
    backgroundColor: "#f8fbfe",
    border: "1px solid #d6e2ee",
  },
  value: {
    color: "#17324d",
    fontSize: "14px",
    lineHeight: 1.6,
    wordBreak: "break-word",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
  },
};

const statusPalette = {
  open: {
    backgroundColor: "#fff4dc",
    borderColor: "#f2d49a",
    color: "#8a5a00",
  },
  resolved: {
    backgroundColor: "#e8f7ee",
    borderColor: "#c3e8d0",
    color: "#0b7a3b",
  },
  failed: {
    backgroundColor: "#fdecec",
    borderColor: "#f5c2c7",
    color: "#b23b47",
  },
};

const paginationStyles = {
  wrapper: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
    marginTop: "18px",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  pageText: {
    color: "#17324d",
    fontSize: "14px",
    fontWeight: 700,
  },
  resultText: {
    color: "#5f7892",
    fontSize: "14px",
    fontWeight: 600,
  },
};

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatEventLabel = (row) => row?.title || row?.disaster_event_title || "--";

const normalizeBarangayName = (value) => String(value || "").trim().toLowerCase();

const mergeUniqueEvents = (...eventGroups) => {
  const eventMap = new Map();

  eventGroups.flat().forEach((event) => {
    if (!event?.id || eventMap.has(String(event.id))) {
      return;
    }

    eventMap.set(String(event.id), event);
  });

  return [...eventMap.values()];
};

const getEventBarangayScope = (event) => {
  const ids = new Set();
  const names = new Set();

  const addBarangay = (barangay) => {
    if (!barangay) {
      return;
    }

    if (typeof barangay === "object") {
      if (barangay.id) {
        ids.add(String(barangay.id));
      }

      if (barangay.barangay_id) {
        ids.add(String(barangay.barangay_id));
      }

      if (barangay.name) {
        names.add(normalizeBarangayName(barangay.name));
      }

      if (barangay.barangay_name) {
        names.add(normalizeBarangayName(barangay.barangay_name));
      }

      return;
    }

    ids.add(String(barangay));
    names.add(normalizeBarangayName(barangay));
  };

  const addBarangayNamesFromText = (value) => {
    if (!value || /all barangays/i.test(String(value))) {
      return;
    }

    String(value)
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .forEach((name) => names.add(normalizeBarangayName(name)));
  };

  [
    event?.affected_barangays,
    event?.affectedBarangays,
    event?.barangays,
    event?.affected_barangay_ids,
    event?.affectedBarangayIds,
    event?.barangay_ids,
  ].forEach((collection) => {
    if (Array.isArray(collection)) {
      collection.forEach(addBarangay);
    }
  });

  [
    event?.affected_barangays_text,
    event?.affectedBarangaysText,
    event?.affected_barangay_names,
    event?.affectedBarangayNames,
  ].forEach(addBarangayNamesFromText);

  return { ids, names };
};

const isBarangayInEventScope = (barangay, scope) => {
  if (!scope || (scope.ids.size === 0 && scope.names.size === 0)) {
    return true;
  }

  return (
    scope.ids.has(String(barangay.id)) ||
    scope.names.has(normalizeBarangayName(barangay.name))
  );
};

const getStatusCategory = (row) => {
  const status = String(row?.status || "").toUpperCase();
  const resolution = String(row?.resolution_status || "").toUpperCase();

  if (status === "FAILED" || status === "ERROR") {
    return "failed";
  }

  if (status === "OPEN" || resolution.includes("PENDING") || resolution.includes("RECOMMENDED")) {
    return "open";
  }

  return "resolved";
};

const getStatusLabel = (row) => {
  const category = getStatusCategory(row);

  if (category === "open") {
    return getAnomalyPresentation(row?.anomaly_type).statusHint || "Needs Review";
  }

  if (category === "failed") {
    return "Sync Retry Needed";
  }

  return "No Action Required / Referred";
};

const StatusPill = ({ row }) => {
  const category = getStatusCategory(row);
  const palette = statusPalette[category] || statusPalette.open;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "5px 10px",
        borderRadius: "999px",
        border: `1px solid ${palette.borderColor}`,
        backgroundColor: palette.backgroundColor,
        color: palette.color,
        fontSize: "12px",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {getStatusLabel(row)}
    </span>
  );
};

const modalPanelStyles = {
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
  overflowX: "hidden",
  borderRadius: "20px",
};

const AnomalyDetailModal = ({ anomaly, onClose, finalFocusRef, isBarangayScope }) => {
  if (!anomaly) {
    return null;
  }

  const presentation = getAnomalyPresentation(anomaly.anomaly_type);
  const isSyncAnomaly = anomaly.anomaly_type === "SYNC_CONFLICT" || anomaly.anomaly_type === "SYNC_FAILED";

  return (
    <FormModalShell
      isOpen
      title="Anomaly Details"
      onClose={onClose}
      closeButtonLabel="Close anomaly details"
      closeOnBackdrop={false}
      finalFocusRef={finalFocusRef}
      maxWidth="min(760px, 100vw)"
      overlayStyle={{ padding: "16px" }}
      contentStyle={modalPanelStyles}
      footer={
        <div style={modalStyles.actions}>
          <button type="button" onClick={onClose} style={pageHeaderStyles.secondaryButton}>
            Close
          </button>
        </div>
      }
    >
      <div style={{ ...modalStyles.card, marginBottom: "16px" }}>
        <div style={labelStyles}>Issue</div>
        <div style={modalStyles.value}>
          <strong>{presentation.label}</strong>
          {"\n"}
          {presentation.explanation}
        </div>
      </div>

      <div style={modalStyles.grid}>
        <div style={modalStyles.card}>
          <div style={labelStyles}>Anomaly Type</div>
          <div style={modalStyles.value}>{formatAnomalyType(anomaly.anomaly_type)}</div>
        </div>

        <div style={modalStyles.card}>
          <div style={labelStyles}>Status</div>
          <div style={modalStyles.value}>
            <StatusPill row={anomaly} />
          </div>
        </div>

        <div style={modalStyles.card}>
          <div style={labelStyles}>Disaster Event</div>
          <div style={modalStyles.value}>{formatEventLabel(anomaly)}</div>
        </div>

        <div style={modalStyles.card}>
          <div style={labelStyles}>Barangay</div>
          <div style={modalStyles.value}>{anomaly.barangay_name || "--"}</div>
        </div>

        <div style={modalStyles.card}>
          <div style={labelStyles}>Household / Stub</div>
          <div style={modalStyles.value}>{anomaly.family_head_name || "--"}</div>
        </div>

        <div style={modalStyles.card}>
          <div style={labelStyles}>Detected At</div>
          <div style={modalStyles.value}>{formatDateTime(anomaly.occurred_at)}</div>
        </div>

        <div style={{ ...modalStyles.card, gridColumn: "1 / -1" }}>
          <div style={labelStyles}>Why It Was Flagged</div>
          <div style={modalStyles.value}>{getAnomalyExplanation(anomaly)}</div>
        </div>

        <div style={{ ...modalStyles.card, gridColumn: "1 / -1" }}>
          <div style={labelStyles}>What You Need To Do</div>
          <div style={modalStyles.value}>
            Barangay action required: {getAnomalyActionRequired(anomaly)}
            {"\n"}
            Recommended next step: {getAnomalyActionSummary(anomaly)}
            {"\n"}
            Responsible office: {getAnomalyOwner(anomaly)}
          </div>
        </div>

        {isSyncAnomaly && isBarangayScope ? (
          <div style={{ ...modalStyles.card, gridColumn: "1 / -1" }}>
            <div style={labelStyles}>Related Information</div>
            <div style={modalStyles.value}>
              This item is primarily handled in Sync Center. Review the local queue,
              server history, and conflict details there before taking operational action.
            </div>
          </div>
        ) : null}

        <div style={{ ...modalStyles.card, gridColumn: "1 / -1" }}>
          <div style={labelStyles}>Technical Reference</div>
          <div style={modalStyles.value}>
            Current state: {anomaly.resolution_status || anomaly.status || "--"}
            {anomaly.reference_id ? `\nReference: ${anomaly.reference_id}` : ""}
            {anomaly.source_type ? `\nSource: ${anomaly.source_type}` : ""}
            {anomaly.source_id ? `\nSource ID: ${anomaly.source_id}` : ""}
          </div>
        </div>
      </div>
    </FormModalShell>
  );
};

const AnomalyTrackingPage = ({
  scope = "mswdo",
  assignedBarangay = null,
  assignedBarangayId = "",
  scopedDisasterEvents = [],
  scopeErrorMessage = "",
}) => {
  const isBarangayScope = scope === "barangay";
  const availableAnomalyTypes = useMemo(
    () => getAnomalyTypesForScope(scope),
    [scope],
  );
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const [filters, setFilters] = useState({
    disaster_event_id: "",
    barangay_id: "",
    date_from: "",
    date_to: "",
  });
  const [viewState, setViewState] = useState({
    search: "",
    anomaly_type: "all",
    status: "all",
    order: "newest",
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const anomalyDetailsTriggerRef = useRef(null);
  const anomalyRecordsHeadingRef = useRef(null);
  const anomalyDetailsFinalFocusRef = useMemo(
    () => ({
      get current() {
        const triggerElement = anomalyDetailsTriggerRef.current;

        if (triggerElement?.isConnected && typeof triggerElement.focus === "function") {
          return triggerElement;
        }

        const fallbackElement = anomalyRecordsHeadingRef.current;

        if (fallbackElement?.isConnected && typeof fallbackElement.focus === "function") {
          return fallbackElement;
        }

        return null;
      },
    }),
    [],
  );

  const updateFilters = (updater) => {
    setPage(1);
    setFilters(updater);
  };

  const updateViewState = (updater) => {
    setPage(1);
    setViewState(updater);
  };

  const resolvedAssignedBarangay = useMemo(() => {
    if (!isBarangayScope) {
      return null;
    }

    if (assignedBarangay?.id) {
      return assignedBarangay;
    }

    const matchingBarangay = barangays.find(
      (barangay) => String(barangay.id) === String(assignedBarangayId),
    );

    if (matchingBarangay) {
      return matchingBarangay;
    }

    return assignedBarangayId ? { id: assignedBarangayId, name: "" } : null;
  }, [assignedBarangay, assignedBarangayId, barangays, isBarangayScope]);

  const scopedBarangays = useMemo(() => {
    if (!isBarangayScope) {
      return barangays;
    }

    return resolvedAssignedBarangay ? [resolvedAssignedBarangay] : [];
  }, [barangays, isBarangayScope, resolvedAssignedBarangay]);

  const availableDisasterEvents = useMemo(() => {
    if (!isBarangayScope) {
      return disasterEvents;
    }

    return mergeUniqueEvents(disasterEvents, scopedDisasterEvents);
  }, [disasterEvents, isBarangayScope, scopedDisasterEvents]);

  const selectedDisasterEvent = useMemo(
    () =>
      availableDisasterEvents.find(
        (event) => String(event.id) === String(filters.disaster_event_id),
      ) || null,
    [availableDisasterEvents, filters.disaster_event_id],
  );

  const availableBarangays = useMemo(() => {
    if (!selectedDisasterEvent) {
      return scopedBarangays;
    }

    const eventBarangayScope = getEventBarangayScope(selectedDisasterEvent);
    return scopedBarangays.filter((barangay) =>
      isBarangayInEventScope(barangay, eventBarangayScope),
    );
  }, [scopedBarangays, selectedDisasterEvent]);

  useEffect(() => {
    if (!isBarangayScope) {
      return;
    }

    setPage(1);
    setFilters((currentValue) => {
      const nextBarangayId = resolvedAssignedBarangay?.id || "";

      if (currentValue.barangay_id === nextBarangayId) {
        return currentValue;
      }

      return {
        ...currentValue,
        barangay_id: nextBarangayId,
      };
    });
  }, [isBarangayScope, resolvedAssignedBarangay?.id]);

  useEffect(() => {
    if (!isBarangayScope || !filters.disaster_event_id) {
      return;
    }

    const selectedEventIsAvailable = availableDisasterEvents.some(
      (event) => String(event.id) === String(filters.disaster_event_id),
    );

    if (selectedEventIsAvailable) {
      return;
    }

    setPage(1);
    setFilters((currentValue) => ({
      ...currentValue,
      disaster_event_id: "",
      barangay_id: resolvedAssignedBarangay?.id || "",
    }));
  }, [
    availableDisasterEvents,
    filters.disaster_event_id,
    isBarangayScope,
    resolvedAssignedBarangay?.id,
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadFilters = async () => {
      setIsLoadingFilters(true);

      try {
        const [eventRows, barangayRows] = await Promise.all([
          isBarangayScope
            ? fetchBarangayDisasterEventOptions()
            : fetchAllDisasterEvents(),
          fetchBarangays(),
        ]);

        if (!isMounted) {
          return;
        }

        setDisasterEvents(Array.isArray(eventRows) ? eventRows : []);
        setBarangays(Array.isArray(barangayRows) ? barangayRows : []);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message || "Failed to load anomaly filters.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingFilters(false);
        }
      }
    };

    loadFilters();

    return () => {
      isMounted = false;
    };
  }, [isBarangayScope]);

  useEffect(() => {
    let isMounted = true;

    const loadRows = async () => {
      if (isBarangayScope && !resolvedAssignedBarangay?.id) {
        setRows([]);
        setPagination({
          page,
          pageSize,
          totalItems: 0,
          totalPages: 0,
          hasPreviousPage: false,
          hasNextPage: false,
        });
        setErrorMessage(
          scopeErrorMessage || "No assigned barangay. Please contact administrator.",
        );
        setIsLoadingRows(false);
        return;
      }

      setIsLoadingRows(true);
      setErrorMessage("");

      try {
        const response = await fetchMswdoAnomalies({
          ...filters,
          barangay_id: isBarangayScope
            ? resolvedAssignedBarangay.id
            : filters.barangay_id,
          anomaly_type: viewState.anomaly_type === "all" ? "" : viewState.anomaly_type,
          status_category: viewState.status === "all" ? "" : viewState.status,
          search: viewState.search.trim(),
          order: viewState.order,
          page,
          pageSize,
        });

        if (!isMounted) {
          return;
        }

        setRows(Array.isArray(response.data) ? response.data : []);
        setPagination(
          response.pagination || {
            page,
            pageSize,
            totalItems: Array.isArray(response.data) ? response.data.length : 0,
            totalPages: Array.isArray(response.data) && response.data.length ? 1 : 0,
            hasPreviousPage: page > 1,
            hasNextPage: false,
          },
        );
      } catch (error) {
        if (isMounted) {
          setRows([]);
          setPagination({
            page,
            pageSize,
            totalItems: 0,
            totalPages: 0,
            hasPreviousPage: false,
            hasNextPage: false,
          });
          setErrorMessage(error.message || "Failed to load anomalies.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingRows(false);
        }
      }
    };

    loadRows();

    return () => {
      isMounted = false;
    };
  }, [
    filters,
    isBarangayScope,
    page,
    pageSize,
    resolvedAssignedBarangay?.id,
    scopeErrorMessage,
    viewState,
  ]);

  const summary = useMemo(() => {
    return rows.reduce(
      (currentSummary, row) => {
        currentSummary.total += 1;

        const category = getStatusCategory(row);

        if (category === "open") {
          currentSummary.open += 1;
        }

        if (category === "failed") {
          currentSummary.failed += 1;
        }

        if (category === "resolved") {
          currentSummary.resolved += 1;
        }

        return currentSummary;
      },
      {
        total: 0,
        open: 0,
        failed: 0,
        resolved: 0,
      },
    );
  }, [rows]);

  const hasActiveFilters = Boolean(
    filters.disaster_event_id ||
      (filters.barangay_id && !isBarangayScope) ||
      filters.date_from ||
      filters.date_to ||
      viewState.search.trim() ||
      viewState.anomaly_type !== "all" ||
      viewState.status !== "all",
  );
  const totalItems = pagination.totalItems || 0;
  const totalPages = pagination.totalPages || 0;
  const firstVisibleItem = totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const lastVisibleItem = totalItems === 0
    ? 0
    : Math.min(firstVisibleItem + rows.length - 1, totalItems);
  const shouldShowPaginationControls = totalItems > 0;
  const openAnomalyDetails = useCallback((row, event) => {
    anomalyDetailsTriggerRef.current = event.currentTarget;
    setSelectedAnomaly(row);
  }, []);
  const closeAnomalyDetails = useCallback(() => {
    setSelectedAnomaly(null);
  }, []);
  const paginationControls = shouldShowPaginationControls ? (
    <div style={paginationStyles.wrapper}>
      <div style={paginationStyles.controls}>
        <button
          type="button"
          onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
          disabled={!pagination.hasPreviousPage || isLoadingRows}
          style={pageHeaderStyles.secondaryButton}
        >
          Previous
        </button>
        <span style={paginationStyles.pageText}>
          Page {pagination.page} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage((currentPage) => currentPage + 1)}
          disabled={!pagination.hasNextPage || isLoadingRows}
          style={pageHeaderStyles.secondaryButton}
        >
          Next
        </button>
      </div>

      <label style={{ ...paginationStyles.controls, color: "#17324d", fontWeight: 700 }}>
        Rows per page
        <select
          value={pageSize}
          onChange={(event) => {
            setPage(1);
            setPageSize(Number(event.target.value));
          }}
          style={{
            minWidth: "92px",
            borderRadius: "12px",
            border: "1px solid #c7d6e5",
            backgroundColor: "#ffffff",
            color: "#17324d",
            padding: "10px 12px",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  ) : null;

  return (
    <div style={pageSpacingStyles.pageStack}>
      <PageHeader
        title={isBarangayScope ? "Anomaly Tracking" : "Anomaly Tracking Management"}
        description={
          isBarangayScope
            ? "Review unusual or inconsistent records detected in your Barangay's disaster-relief operations. Some issues may require your verification, while others may be referred to MSWDO or the Office of the Mayor."
            : "Monitor operational records that may need review across disaster-relief workflows."
        }
        actions={[]}
      />

      <section style={shellStyles.card}>
        <div style={pageSpacingStyles.filterGrid}>
          <div>
            <label htmlFor="anomaly-event" style={labelStyles}>
              Disaster Event
            </label>
            <select
              id="anomaly-event"
              value={filters.disaster_event_id}
              onChange={(event) =>
                updateFilters((currentValue) => ({
                  ...currentValue,
                  disaster_event_id: event.target.value,
                  barangay_id: isBarangayScope
                    ? resolvedAssignedBarangay?.id || ""
                    : "",
                }))
              }
              disabled={isLoadingFilters}
              style={inputStyles}
            >
              <option value="">All disaster events</option>
              {availableDisasterEvents.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title}
                </option>
              ))}
            </select>
          </div>

          {!isBarangayScope ? (
            <div>
              <label htmlFor="anomaly-barangay" style={labelStyles}>
                Barangay
              </label>
              <select
                id="anomaly-barangay"
                value={filters.barangay_id}
                onChange={(event) =>
                  updateFilters((currentValue) => ({
                    ...currentValue,
                    barangay_id: event.target.value,
                  }))
                }
                disabled={isLoadingFilters}
                style={inputStyles}
              >
                <option value="">All barangays</option>
                {availableBarangays.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label htmlFor="anomaly-type" style={labelStyles}>
              Anomaly Type
            </label>
            <select
              id="anomaly-type"
              value={viewState.anomaly_type}
              onChange={(event) =>
                updateViewState((currentValue) => ({
                  ...currentValue,
                  anomaly_type: event.target.value,
                }))
              }
              style={inputStyles}
            >
              {availableAnomalyTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="anomaly-date-from" style={labelStyles}>
              Date From
            </label>
            <input
              id="anomaly-date-from"
              type="date"
              value={filters.date_from}
              onChange={(event) =>
                updateFilters((currentValue) => ({
                  ...currentValue,
                  date_from: event.target.value,
                }))
              }
              style={inputStyles}
            />
          </div>

          <div>
            <label htmlFor="anomaly-date-to" style={labelStyles}>
              Date To
            </label>
            <input
              id="anomaly-date-to"
              type="date"
              value={filters.date_to}
              onChange={(event) =>
                updateFilters((currentValue) => ({
                  ...currentValue,
                  date_to: event.target.value,
                }))
              }
              style={inputStyles}
            />
          </div>
        </div>
      </section>

      <div style={shellStyles.statGrid}>
        <StatusCard label="Total Detected" value={totalItems} />
        <StatusCard label="Needs Review on Page" value={summary.open} />
        <StatusCard label="Sync Retry Needed on Page" value={summary.failed} />
        <StatusCard label="No Action / Referred on Page" value={summary.resolved} />
      </div>

      <div style={pageSpacingStyles.toolbar}>
        <div style={{ position: "relative", flex: "1 1 420px", minWidth: "260px" }}>
          <FiSearch
            size={18}
            style={{
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#6f8aa6",
            }}
          />
          <input
            type="search"
            value={viewState.search}
            onChange={(event) =>
              updateViewState((currentValue) => ({
                ...currentValue,
                search: event.target.value,
              }))
            }
            placeholder="Search anomaly type, family head, barangay, event, or reason"
            style={searchInputStyles}
          />
        </div>

        <div style={pageSpacingStyles.actionGroup}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#17324d",
              fontWeight: 700,
            }}
          >
            <label
              htmlFor="anomaly-status"
              style={{ margin: 0, fontSize: "14px" }}
            >
              Status
            </label>
            <select
              id="anomaly-status"
              value={viewState.status}
              onChange={(event) =>
                updateViewState((currentValue) => ({
                  ...currentValue,
                  status: event.target.value,
                }))
              }
              style={{
                minWidth: "120px",
                borderRadius: "12px",
                border: "1px solid #c7d6e5",
                backgroundColor: "#ffffff",
                color: "#17324d",
                padding: "10px 12px",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {statusFilters.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <ResponsiveFilterPopover
              isOpen={isFilterOpen}
              onOpenChange={setIsFilterOpen}
              title="Filter Records"
              trigger={({ ref, ...triggerProps }) => (
                <button
                  ref={ref}
                  type="button"
                  style={{
                    ...pageHeaderStyles.secondaryButton,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                  {...triggerProps}
                >
                  <FiFilter size={18} />
                  Filter
                </button>
              )}
            >
                <h3 style={filterPopoverStyles.title}>Filter Records</h3>
                <label htmlFor="anomaly-order" style={labelStyles}>
                  Order List
                </label>
                <select
                  id="anomaly-order"
                  value={viewState.order}
                  onChange={(event) =>
                    updateViewState((currentValue) => ({
                      ...currentValue,
                      order: event.target.value,
                    }))
                  }
                  style={inputStyles}
                >
                  {orderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
            </ResponsiveFilterPopover>
          </div>
        </div>
      </div>

      <section style={shellStyles.card}>
        <div style={pageSpacingStyles.tableHeader}>
          <h3
            ref={anomalyRecordsHeadingRef}
            tabIndex={-1}
            style={{ margin: 0, color: "#17324d", outline: "none" }}
          >
            Anomaly Records
          </h3>
          <span style={paginationStyles.resultText}>
            {totalItems === 0
              ? "No anomalies found"
              : `Showing ${firstVisibleItem}-${lastVisibleItem} of ${totalItems}`}
          </span>
        </div>

        {errorMessage ? <ErrorState message={errorMessage} style={{ marginBottom: "16px" }} /> : null}

        {isLoadingRows ? (
          <LoadingState message="Loading anomaly tracking..." />
        ) : rows.length === 0 ? (
          <EmptyState
            message={
              hasActiveFilters
                ? "No anomalies found for the current filters."
                : "No unusual or inconsistent records currently require review."
            }
          />
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyles.table}>
                <thead>
                  <tr>
                    <th style={tableStyles.th}>Anomaly Type</th>
                    <th style={tableStyles.th}>Disaster Event</th>
                    <th style={tableStyles.th}>Barangay</th>
                    <th style={tableStyles.th}>Household / Stub</th>
                    <th style={tableStyles.th}>Why Flagged</th>
                    <th style={tableStyles.th}>Action Required</th>
                    <th style={tableStyles.th}>Responsible Office</th>
                    <th style={tableStyles.th}>Status</th>
                    <th style={tableStyles.th}>Detected At</th>
                    <th style={{ ...tableStyles.th, textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr
                      key={`${row.anomaly_type}-${row.reference_id || "no-reference"}-${
                        row.source_type || "no-source"
                      }-${row.source_id || row.occurred_at || rowIndex}`}
                    >
                      <td style={tableStyles.td}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            fontWeight: 700,
                          }}
                        >
                          <FiAlertTriangle size={16} color="#9a6400" />
                          {formatAnomalyType(row.anomaly_type)}
                        </span>
                      </td>
                      <td style={tableStyles.td}>{formatEventLabel(row)}</td>
                      <td style={tableStyles.td}>{row.barangay_name || "--"}</td>
                      <td style={tableStyles.td}>{row.family_head_name || "--"}</td>
                      <td style={{ ...tableStyles.td, minWidth: "260px" }}>
                        {getAnomalyExplanation(row)}
                      </td>
                      <td style={{ ...tableStyles.td, minWidth: "220px" }}>
                        {getAnomalyActionSummary(row)}
                      </td>
                      <td style={tableStyles.td}>{getAnomalyOwner(row)}</td>
                      <td style={tableStyles.td}>
                        {getAnomalyActionRequired(row)}
                      </td>
                      <td style={tableStyles.td}>
                        <StatusPill row={row} />
                      </td>
                      <td style={tableStyles.td}>{formatDateTime(row.occurred_at)}</td>
                      <td style={{ ...tableStyles.td, textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={(event) => openAnomalyDetails(row, event)}
                          aria-label={`View details for ${formatAnomalyType(row.anomaly_type)}`}
                          title={`View details for ${formatAnomalyType(row.anomaly_type)}`}
                          style={{
                            width: "46px",
                            height: "46px",
                            borderRadius: "14px",
                            border: "1px solid #c6d8ea",
                            backgroundColor: "#f8fbfe",
                            color: "#24496e",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <FiEye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {paginationControls}
          </>
        )}
      </section>

      <AnomalyDetailModal
        anomaly={selectedAnomaly}
        onClose={closeAnomalyDetails}
        finalFocusRef={anomalyDetailsFinalFocusRef}
        isBarangayScope={isBarangayScope}
      />
    </div>
  );
};

export default AnomalyTrackingPage;
