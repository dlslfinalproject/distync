import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FiFileText } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import ExportModal from "../../components/shared/ExportModal";
import FeedbackToast from "../../components/shared/FeedbackToast";
import SearchBar from "../../components/shared/SearchBar";
import InventoryTransactionDetailModal from "../../components/inventory-transactions/InventoryTransactionDetailModal";
import InventoryTransactionsTable from "../../components/inventory-transactions/InventoryTransactionsTable";
import {
  exportInventoryTransactions,
  fetchInventoryTransactions,
} from "../../features/inventory-transactions/inventoryTransactionService";
import { fetchDistributionHistory } from "../../features/distribution/distributionService";
import { fetchInventoryItems } from "../../features/inventory-items/inventoryItemService";
import { fetchInventoryBatches } from "../../features/inventory-batches/inventoryBatchService";
import {
  buildInventoryTrackingMap,
  getTrackedExpirationDate,
  isDateExpired,
} from "../../features/inventory-items/inventoryItemStockStatus";
import { fetchSystemLogReview } from "../../features/system-logs/systemLogService";
import db from "../../offline/db";
import { buildSyncDescriptor, findSyncEntry } from "../../offline/syncStatus";
import { subscribeToSyncUpdates } from "../../offline/syncService";
import {
  buildExportSuccessMessage,
  COMMON_EXPORT_FORMAT_OPTIONS,
  downloadExportFile,
  NO_EXPORT_DATA_MESSAGE,
  resolveExportErrorMessage,
} from "../../utils/exportHelpers";

const selectStyles = {
  minHeight: "52px",
  padding: "0 14px",
  borderRadius: "16px",
  border: "1px solid #d3dfec",
  backgroundColor: "#ffffff",
  color: "#234260",
  fontSize: "14px",
};

const summaryGridStyles = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

const pageStackStyles = {
  flex: 1,
  minWidth: 0,
  maxWidth: "100%",
  overflowX: "hidden",
};

const overviewSectionStyles = {
  marginTop: "24px",
  marginBottom: "24px",
};

const summaryCardStyles = {
  backgroundColor: "#ffffff",
  border: "1px solid #d7e3ef",
  borderRadius: "18px",
  padding: "18px 20px",
  boxShadow: "0 10px 24px rgba(31, 59, 87, 0.08)",
};

const summaryEyebrowStyles = {
  margin: 0,
  color: "#67819c",
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontWeight: 700,
};

const summaryValueStyles = {
  margin: "12px 0 0",
  color: "#17324d",
  fontSize: "34px",
  fontWeight: 800,
  lineHeight: 1,
};

const summaryHelperStyles = {
  margin: "12px 0 0",
  color: "#60738a",
  fontSize: "14px",
  lineHeight: 1.6,
};

const subtabWrapStyles = {
  borderBottom: "1px solid #d6e2ef",
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  overflowX: "auto",
};

const getSubtabStyles = (isActive) => ({
  padding: "12px 24px",
  border: "none",
  borderBottom: isActive ? "3px solid #17324d" : "3px solid transparent",
  background: "none",
  color: isActive ? "#17324d" : "#6b8298",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 700,
  whiteSpace: "nowrap",
});

const sectionTitleStyles = {
  margin: 0,
  color: "#17324d",
  fontSize: "22px",
};

const toolbarSectionStyles = {
  alignItems: "center",
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "minmax(260px, 1.3fr) minmax(180px, 0.7fr) minmax(180px, 0.7fr) minmax(180px, 0.7fr) auto",
  margin: "0 0 24px",
};

const toolbarSelectStyles = {
  ...selectStyles,
  minWidth: 0,
  width: "100%",
};

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "860px",
  },
  th: {
    padding: "12px 14px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px",
    borderBottom: "1px solid #edf3f8",
    color: "#21405f",
    fontSize: "14px",
    verticalAlign: "top",
    lineHeight: 1.6,
  },
};

const auditEntityTypes = new Set([
  "INVENTORY_ITEM",
  "INVENTORY_BATCH",
  "INVENTORY_TRANSACTION",
  "SUPPLIER",
]);

const inflowTransactionTypes = new Set(["INFLOW", "RETURN", "ADJUSTMENT"]);
const outflowTransactionTypes = new Set([
  "OUTFLOW",
  "EXPIRED",
  "DAMAGED",
  "MISSING",
  "SPOILED",
  "STOLEN",
]);

const transactionTypes = [
  "INFLOW",
  "OUTFLOW",
  "EXPIRED",
  "DAMAGED",
  "MISSING",
  "RETURN",
  "ADJUSTMENT",
];

const sourceOptions = ["DONATION", "SUPPLIER", "DISTRIBUTION"];

const sampleTransactionRows = [
  {
    id: "TRX-2026-001",
    transaction_direction: "INFLOW",
    transaction_type: "INFLOW",
    inventory_item: {
      item_name: "Rice",
      item_code: "INV-RICE-001",
    },
    quantity: 250,
    performed_at: "2026-07-11T09:15:00+08:00",
    source_label: "Supplier",
    source_details: "Malvar Food Trading",
  },
  {
    id: "TRX-2026-002",
    transaction_direction: "INFLOW",
    transaction_type: "INFLOW",
    inventory_item: {
      item_name: "Canned Sardines",
      item_code: "INV-SARD-002",
    },
    quantity: 480,
    performed_at: "2026-07-11T10:05:00+08:00",
    source_label: "Donation",
    source_details: "Private Donor",
  },
  {
    id: "TRX-2026-003",
    transaction_direction: "OUTFLOW",
    transaction_type: "OUTFLOW",
    inventory_item: {
      item_name: "Relief Water",
      item_code: "INV-WATR-003",
    },
    quantity: 120,
    performed_at: "2026-07-11T11:40:00+08:00",
    source_label: "Distribution",
    source_details: "Validated distribution release",
  },
];

const sampleAuditEntries = [
  {
    id: "AUD-2026-001",
    action: "INVENTORY_BATCH_CREATE",
    performed_by: "Mayor Admin",
    role_code: "MAYOR",
    timestamp: "2026-07-11T09:10:00+08:00",
    details: {
      changed_fields: "batch_no, quantity_received, quantity_available",
    },
  },
  {
    id: "AUD-2026-002",
    action: "INVENTORY_TRANSACTION_CREATE",
    performed_by: "Warehouse Staff",
    role_code: "MAYOR",
    timestamp: "2026-07-11T11:42:00+08:00",
    details: {
      changed_fields: "transaction_type, quantity, reference_type",
    },
  },
];

const sampleSummaryMetrics = {
  currentStockOnHand: 730,
  lowStockItems: 2,
  expiredItems: 1,
  transactionsToday: 3,
};

const buildQueuedInventoryTransaction = (entry, inventoryBatches) => {
  const linkedBatch =
    inventoryBatches.find((batch) => batch.id === entry.payload?.inventory_batch_id) ||
    null;

  return {
    id: entry.entityLocalId || entry.id,
    performed_at: entry.clientTimestamp,
    inventory_item: linkedBatch?.inventory_item || null,
    inventory_batch_id: entry.payload?.inventory_batch_id || null,
    transaction_type: entry.payload?.transaction_type || "ADJUSTMENT",
    quantity: entry.payload?.quantity || 0,
    reference_type: entry.payload?.reference_type || "SYNC",
    remarks: entry.payload?.remarks || "",
    sync_status: entry.status,
    is_local_only: true,
  };
};

const buildDistributionOutflowRows = (distributionHistoryRows) => {
  if (!Array.isArray(distributionHistoryRows) || distributionHistoryRows.length === 0) {
    return [];
  }

  return distributionHistoryRows
    .filter((row) => row?.distribution_status === "CLAIMED")
    .map((row) => ({
      id: row.id,
      transaction_direction: "OUTFLOW",
      transaction_type: "OUTFLOW",
      batch_no: row.batch_no || "--",
      inventory_item: {
        item_name: row.released_items_summary || row.relief_pack_template_name || "--",
        item_code: row.relief_pack_template_name
          ? "Distributed relief pack"
          : "Distributed inventory item",
      },
      quantity: Number(row.total_quantity_released || 0),
      performed_at: row.distribution_date,
      source_label: "Distribution",
      source_details: row.barangay_name
        ? `${row.barangay_name} distribution release`
        : "Distribution release",
      reference_type: "DISTRIBUTION",
      remarks:
        row.relief_pack_template_name ||
        row.released_items_summary ||
        row.receipt_no ||
        "",
      sync_status: row.sync_status || "synced",
      is_local_only: false,
      inventory_item_id: null,
    }));
};

const buildBatchInflowRows = (inventoryBatches, transactionRows) => {
  if (!Array.isArray(inventoryBatches) || inventoryBatches.length === 0) {
    return [];
  }

  const batchesWithTransactionRows = new Set(
    (Array.isArray(transactionRows) ? transactionRows : [])
      .filter((row) => String(row.transaction_direction || "").toUpperCase() === "INFLOW")
      .map((row) => String(row.inventory_batch_id || "")),
  );

  return inventoryBatches.map((batch) => ({
    id: `BATCH-${batch.id}`,
    inventory_batch_id: batch.id,
    batch_no: batch.batch_no || "--",
    transaction_direction: "INFLOW",
    transaction_type: "INFLOW",
    quantity: Number(batch.quantity_received || 0),
    performed_at: batch.received_at || batch.created_at,
    reference_type: batch.source_type || "MANUAL",
    remarks: "",
    sync_status: "synced",
    is_local_only: false,
    inventory_item: batch.inventory_item || null,
    source_label: "Malvar LGU",
    source_details: "Malvar LGU",
    performed_by_label: batch.creator?.full_name || "--",
  })).filter((row) => !batchesWithTransactionRows.has(String(row.inventory_batch_id || "")));
};

const normalizeQuantity = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const isSameCalendarDate = (leftValue, rightValue) => {
  const left = new Date(leftValue);
  const right = new Date(rightValue);

  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) {
    return false;
  }

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
};

const getTransactionDirection = (transactionType) => {
  if (inflowTransactionTypes.has(transactionType)) {
    return "INFLOW";
  }

  if (outflowTransactionTypes.has(transactionType)) {
    return "OUTFLOW";
  }

  return transactionType || "--";
};

const getSourceLabel = (transaction, batch) => {
  const resolvedDirection = String(
    transaction.transaction_direction ||
      getTransactionDirection(transaction.transaction_type) ||
      "",
  ).toUpperCase();

  if (resolvedDirection === "INFLOW") {
    return "Malvar LGU";
  }

  if (
    resolvedDirection === "OUTFLOW" &&
    String(transaction.reference_type || "").toUpperCase() === "MANUAL"
  ) {
    return "Malvar LGU";
  }

  if (transaction.reference_type === "DISTRIBUTION") {
    return "Distribution";
  }

  if (
    transaction.reference_type === "DONATION" ||
    batch?.source_type === "DONATED"
  ) {
    return "Donation";
  }

  if (batch?.supplier_id || batch?.source_type === "PURCHASED") {
    return "Supplier";
  }

  return "Manual";
};

const formatTransactionLabel = (value) => {
  const normalizedValue = String(value || "").trim().toUpperCase();

  if (!normalizedValue) {
    return "--";
  }

  return normalizedValue
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const getTransactionTypeLabel = (row) => {
  const transactionDirection = String(row.transaction_direction || "").toUpperCase();
  const sourceLabel = String(row.source_label || "").toUpperCase();
  const referenceType = String(row.reference_type || "").toUpperCase();
  const transactionType = String(row.transaction_type || "").toUpperCase();

  if (transactionDirection === "INFLOW") {
    if (sourceLabel === "DONATION" || referenceType === "DONATION") {
      return "Donated";
    }

    return "Stock-Up";
  }

  if (referenceType === "DISTRIBUTION") {
    return "Distributed";
  }

  return formatTransactionLabel(transactionType);
};

const getPerformedByLabel = (row) => {
  if (row.performer?.full_name) {
    return row.performer.full_name;
  }

  if (row.creator?.full_name) {
    return row.creator.full_name;
  }

  const fullName = [row.performed_by_first_name, row.performed_by_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName) {
    return fullName;
  }

  if (row.performed_by_name) {
    return row.performed_by_name;
  }

  if (row.performed_by) {
    return row.performed_by;
  }

  return row.is_local_only ? "Pending sync" : "Not recorded";
};

const isLowStockItem = (item, trackingStats) => {
  const reorderLevel = Number(item.reorder_level || 0);
  const onHand = Number(trackingStats?.onHand || 0);

  return reorderLevel > 0 && onHand > 0 && onHand <= reorderLevel;
};

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const matchesSearch = (row, searchValue) => {
  const normalizedSearch = String(searchValue || "").trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const searchableFields = [
    row.id,
    row.transaction_type,
    row.transaction_direction,
    row.inventory_item?.item_name,
    row.inventory_item?.item_code,
    row.source_label,
    row.source_details,
    row.remarks,
  ];

  return searchableFields.some((fieldValue) =>
    String(fieldValue || "").toLowerCase().includes(normalizedSearch),
  );
};

const getAuditChangedFields = (entry) => {
  const changedFields = entry.details?.changed_fields;
  return changedFields && changedFields !== "-" ? changedFields : "No field details";
};

const SummaryCard = ({ label, value, helper }) => (
  <article style={summaryCardStyles}>
    <p style={summaryEyebrowStyles}>{label}</p>
    <p style={summaryValueStyles}>{value}</p>
    {helper ? <p style={summaryHelperStyles}>{helper}</p> : null}
  </article>
);

const InventoryTransactionsPage = () => {
  const [activeSubtab, setActiveSubtab] = useState("transactions");
  const [filters, setFilters] = useState({
    search: "",
    inventory_item_id: "",
    transaction_type: "",
    source: "",
  });
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [distributionHistoryRows, setDistributionHistoryRows] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [inventoryAuditLogs, setInventoryAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isExporting, setIsExporting] = useState("");
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState("csv");
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });
  const [selectedTransactionDetail, setSelectedTransactionDetail] = useState(null);
  const syncQueueEntries =
    useLiveQuery(() => db.syncQueue.toArray(), [], []) || [];

  const downloadFile = (file) => {
    downloadExportFile(file);
  };

  const loadPageData = async (activeFilters = filters) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [
        transactionResponse,
        distributionResponse,
        itemResponse,
        batchResponse,
        systemLogResponse,
      ] = await Promise.all([
        fetchInventoryTransactions(),
        fetchDistributionHistory({
          limit: 200,
          status: "CLAIMED",
        }),
        fetchInventoryItems(),
        fetchInventoryBatches(),
        fetchSystemLogReview({ type: "audit", limit: 100 }),
      ]);

      setInventoryTransactions(transactionResponse || []);
      setDistributionHistoryRows(
        Array.isArray(distributionResponse?.data) ? distributionResponse.data : [],
      );
      setInventoryItems(itemResponse || []);
      setInventoryBatches(batchResponse || []);
      setInventoryAuditLogs(
        (systemLogResponse?.audit_logs || []).filter((entry) =>
          auditEntityTypes.has(entry.entity_type),
        ),
      );
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPageData(filters);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToSyncUpdates(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        loadPageData(filters);
      }
    });

    return () => unsubscribe();
  }, [filters]);

  const inventoryItemOptions = useMemo(() => {
    return [...inventoryItems].sort((left, right) =>
      left.item_name.localeCompare(right.item_name),
    );
  }, [inventoryItems]);

  const batchById = useMemo(() => {
    return new Map(
      inventoryBatches.map((batch) => [
        batch.id,
        {
          batch_no: batch.batch_no || "",
          source_type: batch.source_type,
          supplier_id: batch.supplier_id,
          supplier_name: batch.supplier?.name || "",
          inventory_item: batch.inventory_item || null,
        },
      ]),
    );
  }, [inventoryBatches]);

  const inventoryTransactionsWithSyncStatus = useMemo(() => {
    const syncedRows = inventoryTransactions.map((transaction) => {
      const matchingEntry = findSyncEntry(syncQueueEntries, (entry) => {
        return (
          entry.moduleName === "mayor-inventory" &&
          entry.entityType === "INVENTORY_TRANSACTION" &&
          (entry.entityServerId === transaction.id ||
            entry.entityLocalId === transaction.id)
        );
      });

      const linkedBatch = batchById.get(transaction.inventory_batch_id);

      return {
        ...transaction,
        transaction_direction: getTransactionDirection(transaction.transaction_type),
        source_label: getSourceLabel(transaction, linkedBatch),
        source_details:
          linkedBatch?.supplier_name && getSourceLabel(transaction, linkedBatch) === "Supplier"
            ? linkedBatch.supplier_name
            : transaction.reference_type || "--",
        sync_status: buildSyncDescriptor(matchingEntry).status,
        is_local_only: false,
      };
    });

    const optimisticRows = syncQueueEntries
      .filter((entry) => {
        return (
          entry.moduleName === "mayor-inventory" &&
          entry.actionKey === "INVENTORY_TRANSACTION_CREATE" &&
          !syncedRows.some(
            (transaction) =>
              transaction.id === entry.entityServerId ||
              transaction.id === entry.entityLocalId,
          )
        );
      })
      .map((entry) => {
        const queuedRow = buildQueuedInventoryTransaction(entry, inventoryBatches);
        const linkedBatch = batchById.get(queuedRow.inventory_batch_id);

        return {
          ...queuedRow,
          transaction_direction: getTransactionDirection(queuedRow.transaction_type),
          source_label: getSourceLabel(queuedRow, linkedBatch),
          source_details:
            linkedBatch?.supplier_name && getSourceLabel(queuedRow, linkedBatch) === "Supplier"
              ? linkedBatch.supplier_name
              : queuedRow.reference_type || "--",
        };
      });

    return [...optimisticRows, ...syncedRows];
  }, [batchById, inventoryBatches, inventoryTransactions, syncQueueEntries]);

  const mergedTransactionRows = useMemo(() => {
    const batchInflowRows = buildBatchInflowRows(
      inventoryBatches,
      inventoryTransactionsWithSyncStatus,
    );
    const distributionOutflowRows = buildDistributionOutflowRows(distributionHistoryRows);

    return [
      ...batchInflowRows,
      ...distributionOutflowRows,
      ...inventoryTransactionsWithSyncStatus,
    ]
      .map((row) => {
        const linkedBatch = batchById.get(row.inventory_batch_id);

        return {
          ...row,
          batch_no:
            row.batch_no ||
            row.inventory_batch?.batch_no ||
            linkedBatch?.batch_no ||
            "--",
          performed_by_label: getPerformedByLabel(row),
          transaction_type_label: getTransactionTypeLabel(row),
        };
      })
      .sort(
        (left, right) =>
          new Date(right.performed_at || 0).getTime() -
          new Date(left.performed_at || 0).getTime(),
      );
  }, [
    batchById,
    distributionHistoryRows,
    inventoryBatches,
    inventoryTransactionsWithSyncStatus,
  ]);

  const displayedRows = useMemo(() => {
    return mergedTransactionRows.filter((row) => {
      if (!matchesSearch(row, filters.search)) {
        return false;
      }

      if (
        filters.inventory_item_id &&
        row.inventory_item?.id !== filters.inventory_item_id
      ) {
        return false;
      }

      if (
        filters.transaction_type &&
        row.transaction_type !== filters.transaction_type &&
        row.transaction_direction !== filters.transaction_type
      ) {
        return false;
      }

      if (filters.source && row.source_label.toUpperCase() !== filters.source) {
        return false;
      }

      return true;
    });
  }, [
    filters.inventory_item_id,
    filters.search,
    filters.source,
    filters.transaction_type,
    mergedTransactionRows,
  ]);

  const trackingMap = useMemo(() => {
    return buildInventoryTrackingMap(
      inventoryItems,
      inventoryBatches,
      inventoryTransactionsWithSyncStatus,
    );
  }, [inventoryBatches, inventoryItems, inventoryTransactionsWithSyncStatus]);

  const summaryMetrics = useMemo(() => {
    if (
      !inventoryItems.length &&
      !inventoryBatches.length &&
      !mergedTransactionRows.length
    ) {
      return sampleSummaryMetrics;
    }

    const today = new Date();
    const currentStockOnHand = inventoryBatches.reduce(
      (sum, batch) => sum + normalizeQuantity(batch.quantity_available),
      0,
    );

    const lowStockItems = inventoryItems.filter((item) =>
      isLowStockItem(item, trackingMap.get(item.id)),
    ).length;

    const expiredItems = inventoryItems.filter((item) => {
      const trackingStats = trackingMap.get(item.id);
      const trackedExpirationDate = getTrackedExpirationDate(item, trackingStats);

      return (
        normalizeQuantity(trackingStats?.expired || 0) > 0 ||
        normalizeQuantity(trackingStats?.expiredOnHand || 0) > 0 ||
        isDateExpired(trackedExpirationDate)
      );
    }).length;

    const transactionsToday = mergedTransactionRows.filter((transaction) =>
      isSameCalendarDate(transaction.performed_at, today),
    ).length;

    return {
      currentStockOnHand,
      lowStockItems,
      expiredItems,
      transactionsToday,
    };
  }, [inventoryBatches, inventoryItems, mergedTransactionRows, trackingMap]);

  const latestAuditEntries = useMemo(() => {
    if (!inventoryAuditLogs.length && !mergedTransactionRows.length) {
      return sampleAuditEntries;
    }

    return inventoryAuditLogs.slice(0, 8);
  }, [inventoryAuditLogs]);

  const isPreviewMode = useMemo(() => {
    return (
      !isLoading &&
      !errorMessage &&
      !inventoryItems.length &&
      !inventoryBatches.length &&
      !mergedTransactionRows.length &&
      !inventoryAuditLogs.length
    );
  }, [
    errorMessage,
    inventoryAuditLogs.length,
    inventoryBatches.length,
    inventoryItems.length,
    mergedTransactionRows.length,
    isLoading,
  ]);

  const presentedRows = isPreviewMode ? sampleTransactionRows : displayedRows;

  const handleFilterChange = (fieldName, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: value,
    }));
  };

  const handleExport = async (format) => {
    setErrorMessage("");
    setIsExportModalOpen(false);

    if (displayedRows.length === 0) {
      setExportFeedback({
        type: "error",
        message: NO_EXPORT_DATA_MESSAGE,
      });
      return;
    }

    setIsExporting(format);

    try {
      const file = await exportInventoryTransactions(format, {
        search: filters.search,
        inventory_item_id: filters.inventory_item_id,
        transaction_type: filters.transaction_type,
      });
      downloadFile(file);
      setExportFeedback({
        type: "success",
        message: buildExportSuccessMessage("Inventory transactions report"),
      });
    } catch (error) {
      setExportFeedback({
        type: "error",
        message: resolveExportErrorMessage(
          error,
          "Failed to export inventory transactions.",
        ),
      });
    } finally {
      setIsExporting("");
    }
  };

  const handleOpenTransactionDetail = (row) => {
    setSelectedTransactionDetail(row);
  };

  return (
    <div style={pageStackStyles}>
      <PageHeader title="INVENTORY TRACKING MANAGEMENT" />

      <section style={overviewSectionStyles}>
        <div style={summaryGridStyles}>
        <SummaryCard
          label="Current Stock On Hand"
          value={summaryMetrics.currentStockOnHand}
          helper=""
        />
        <SummaryCard
          label="Low Stock Items"
          value={summaryMetrics.lowStockItems}
          helper=""
        />
        <SummaryCard
          label="Expired Items"
          value={summaryMetrics.expiredItems}
          helper=""
        />
        <SummaryCard
          label="Transactions Today"
          value={summaryMetrics.transactionsToday}
          helper=""
        />
        </div>
      </section>

      {activeSubtab === "transactions" ? (
        <div style={toolbarSectionStyles}>
          <SearchBar
            value={filters.search}
            onChange={(value) => handleFilterChange("search", value)}
            placeholder="Search item name, item code, or remarks"
          />

          <select
            value={filters.inventory_item_id}
            onChange={(event) =>
              handleFilterChange("inventory_item_id", event.target.value)
            }
            style={toolbarSelectStyles}
          >
            <option value="">All Items</option>
            {inventoryItemOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.item_name}
              </option>
            ))}
          </select>

          <select
            value={filters.transaction_type}
            onChange={(event) =>
              handleFilterChange("transaction_type", event.target.value)
            }
            style={toolbarSelectStyles}
          >
            <option value="">All Transaction Types</option>
            {transactionTypes.map((transactionType) => (
              <option key={transactionType} value={transactionType}>
                {transactionType}
              </option>
            ))}
          </select>

          <select
            value={filters.source}
            onChange={(event) => handleFilterChange("source", event.target.value)}
            style={toolbarSelectStyles}
          >
            <option value="">All Sources</option>
            {sourceOptions.map((sourceOption) => (
              <option key={sourceOption} value={sourceOption}>
                {sourceOption}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setSelectedExportFormat("csv");
              setExportFeedback({ type: "", message: "" });
              setIsExportModalOpen(true);
            }}
            disabled={Boolean(isExporting)}
            style={{
              ...pageHeaderStyles.secondaryButton,
              opacity: isExporting ? 0.7 : 1,
              cursor: isExporting ? "not-allowed" : "pointer",
            }}
          >
            <FiFileText size={16} />
            {isExporting ? `Exporting ${isExporting.toUpperCase()}...` : "Export"}
          </button>
        </div>
      ) : null}

      <section style={{ ...shellStyles.card, padding: "22px 36px 0", marginBottom: "24px" }}>
        <div style={subtabWrapStyles}>
          <button
            type="button"
            onClick={() => setActiveSubtab("transactions")}
            style={getSubtabStyles(activeSubtab === "transactions")}
          >
            Transactions
          </button>
          <button
            type="button"
            onClick={() => setActiveSubtab("audit")}
            style={getSubtabStyles(activeSubtab === "audit")}
          >
            Audit Trail
          </button>
        </div>
      </section>

      <section style={shellStyles.card}>
        {activeSubtab === "transactions" ? (
          <>
            <div style={{ marginBottom: "18px" }}>
              <h3 style={sectionTitleStyles}>Inventory Transactions</h3>
              {isPreviewMode ? (
                <p style={{ ...summaryHelperStyles, marginTop: "8px", color: "#2f6499" }}>
                  Showing sample records until live stock movement is available.
                </p>
              ) : null}
            </div>

            <InventoryTransactionsTable
              rows={presentedRows}
              isLoading={isLoading}
              errorMessage={errorMessage}
              onViewDetails={handleOpenTransactionDetail}
            />
          </>
        ) : (
          <>
            <div style={{ marginBottom: "18px" }}>
              <h3 style={sectionTitleStyles}>Audit Trail</h3>
              <p style={{ ...summaryHelperStyles, marginTop: "8px" }}>
                Changes made to inventory records.
              </p>
              {isPreviewMode ? (
                <p style={{ ...summaryHelperStyles, marginTop: "8px", color: "#2f6499" }}>
                  Showing sample audit entries until live audit logs are available.
                </p>
              ) : null}
            </div>

            {errorMessage ? (
              <p style={{ margin: 0, color: "#9d4d58", fontWeight: 700 }}>
                {errorMessage}
              </p>
            ) : latestAuditEntries.length === 0 ? (
              <p style={{ margin: 0, color: "#60738a", fontSize: "14px" }}>
                No inventory audit trail entries are available yet.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyles.table}>
                  <thead>
                    <tr>
                      <th style={tableStyles.th}>Action</th>
                      <th style={tableStyles.th}>Changed By</th>
                      <th style={tableStyles.th}>Date</th>
                      <th style={tableStyles.th}>What Was Changed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestAuditEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td style={tableStyles.td}>{entry.action}</td>
                        <td style={tableStyles.td}>
                          <div>{entry.performed_by}</div>
                          {entry.role_code ? (
                            <div style={{ color: "#6b8298", fontSize: "12px" }}>
                              {entry.role_code}
                            </div>
                          ) : null}
                        </td>
                        <td style={tableStyles.td}>{formatDateTime(entry.timestamp)}</td>
                        <td style={tableStyles.td}>{getAuditChangedFields(entry)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <ExportModal
        isOpen={isExportModalOpen}
        title="Export Inventory Report"
        description="Select the export format."
        reportOptions={[
          {
            value: "INVENTORY_TRANSACTIONS",
            label: "Inventory Transactions Report",
          },
        ]}
        formatOptions={COMMON_EXPORT_FORMAT_OPTIONS}
        selectedReportType="INVENTORY_TRANSACTIONS"
        selectedFormat={selectedExportFormat}
        isSubmitting={Boolean(isExporting)}
        onReportTypeChange={() => {}}
        onFormatChange={setSelectedExportFormat}
        onClose={() => {
          if (!isExporting) {
            setIsExportModalOpen(false);
          }
        }}
        onSubmit={() => handleExport(selectedExportFormat)}
      />

      <FeedbackToast
        type={exportFeedback.type}
        message={exportFeedback.message}
        onClose={() => setExportFeedback({ type: "", message: "" })}
      />

      <InventoryTransactionDetailModal
        isOpen={Boolean(selectedTransactionDetail)}
        row={selectedTransactionDetail}
        onClose={() => setSelectedTransactionDetail(null)}
      />
    </div>
  );
};

export default InventoryTransactionsPage;
