import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FiFileText, FiFilter } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { pageSpacingStyles, shellStyles } from "../../components/layout/BarangayLayout";
import ExportModal from "../../components/shared/ExportModal";
import FeedbackToast from "../../components/shared/FeedbackToast";
import SearchBar from "../../components/shared/SearchBar";
import InventoryTransactionDetailModal from "../../components/inventory-transactions/InventoryTransactionDetailModal";
import InventoryTransactionsTable from "../../components/inventory-transactions/InventoryTransactionsTable";
import {
  exportInventoryTransactions,
  fetchInventoryTransactions,
} from "../../features/inventory-transactions/inventoryTransactionService";
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

const summaryGridStyles = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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

const toolbarStyles = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  margin: "0 0 24px",
  flexWrap: "wrap",
};

const searchWrapStyles = {
  flex: "1 1 420px",
  minWidth: "260px",
};

const inlineSelectWrapStyles = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flex: "0 0 auto",
};

const inlineSelectLabelStyles = {
  color: "#17324d",
  fontSize: "14px",
  fontWeight: 700,
};

const inlineSelectStyles = {
  minWidth: "120px",
  border: "1px solid #c7d6e5",
  borderRadius: "12px",
  padding: "10px 12px",
  backgroundColor: "#ffffff",
  color: "#17324d",
  fontSize: "14px",
  fontWeight: 600,
  boxSizing: "border-box",
  appearance: "auto",
};

const filterPanelStyles = {
  panel: {
    position: "fixed",
    width: "min(360px, calc(100vw - 32px))",
    backgroundColor: "#ffffff",
    border: "1px solid #d6e2ef",
    borderRadius: "18px",
    boxShadow: "0 18px 36px rgba(31, 64, 95, 0.16)",
    padding: "18px",
    zIndex: 1200,
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "16px",
    fontWeight: 800,
  },
  field: {
    display: "grid",
    gap: "8px",
  },
  label: {
    color: "#55718b",
    fontSize: "13px",
    fontWeight: 700,
  },
  select: {
    minHeight: "44px",
    borderRadius: "14px",
    border: "1px solid #d0ddeb",
    backgroundColor: "#ffffff",
    color: "#17324d",
    padding: "10px 12px",
    fontSize: "14px",
    fontWeight: 600,
  },
  list: {
    display: "grid",
    gap: "10px",
    overflowY: "auto",
    flex: "1 1 auto",
    minHeight: 0,
    paddingRight: "4px",
  },
  option: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#1f405f",
    fontSize: "14px",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "auto",
  },
  clearAction: {
    border: "none",
    background: "transparent",
    color: "#55718b",
    padding: "2px 0",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  },
};

const FILTER_PANEL_GAP = 12;
const FILTER_PANEL_VIEWPORT_PADDING = 16;
const MIN_FILTER_PANEL_HEIGHT = 220;

const getFilterPanelPosition = ({ triggerRect, panelHeight }) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const constrainedPanelWidth = Math.min(
    360,
    viewportWidth - FILTER_PANEL_VIEWPORT_PADDING * 2,
  );
  const safePanelHeight = Math.max(panelHeight || 0, MIN_FILTER_PANEL_HEIGHT);
  const spaceBelow =
    viewportHeight - triggerRect.bottom - FILTER_PANEL_VIEWPORT_PADDING;
  const spaceAbove = triggerRect.top - FILTER_PANEL_VIEWPORT_PADDING;
  const shouldOpenBelow =
    spaceBelow >= MIN_FILTER_PANEL_HEIGHT || spaceBelow >= spaceAbove;

  let left = triggerRect.right - constrainedPanelWidth;
  left = Math.min(
    Math.max(left, FILTER_PANEL_VIEWPORT_PADDING),
    viewportWidth - constrainedPanelWidth - FILTER_PANEL_VIEWPORT_PADDING,
  );

  if (shouldOpenBelow) {
    const top = Math.max(
      FILTER_PANEL_VIEWPORT_PADDING,
      triggerRect.bottom + FILTER_PANEL_GAP,
    );
    const availableHeight =
      viewportHeight - top - FILTER_PANEL_VIEWPORT_PADDING;

    return {
      top,
      left,
      maxHeight: Math.max(availableHeight, 0),
    };
  }

  const maxHeight = Math.max(
    triggerRect.top - FILTER_PANEL_GAP - FILTER_PANEL_VIEWPORT_PADDING,
    0,
  );
  const top = Math.max(
    FILTER_PANEL_VIEWPORT_PADDING,
    triggerRect.top - FILTER_PANEL_GAP - Math.min(safePanelHeight, maxHeight),
  );

  return {
    top,
    left,
    maxHeight,
  };
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

const transactionTypeFilterOptions = [
  { value: "", label: "All transaction types" },
  { value: "Stock-Up", label: "Stock-Up" },
  { value: "Donated", label: "Donation" },
  { value: "Distributed", label: "Distributed" },
  { value: "Damaged", label: "Damaged" },
  { value: "Spoiled", label: "Spoiled" },
  { value: "Missing", label: "Missing" },
  { value: "Stolen", label: "Stolen" },
  { value: "Expired", label: "Expired" },
];

const movementFilterOptions = [
  { value: "", label: "All" },
  { value: "INFLOW", label: "Inflow" },
  { value: "OUTFLOW", label: "Outflow" },
];

const orderOptions = [
  { value: "newest", label: "Newest-Oldest" },
  { value: "oldest", label: "Oldest-Newest" },
  { value: "az", label: "Sort A-Z" },
  { value: "za", label: "Sort Z-A" },
];

const sourceOptions = [
  { value: "", label: "All sources" },
  { value: "Malvar LGU", label: "Malvar LGU" },
  { value: "Donors", label: "Donors" },
];

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
  totalInflow: 730,
  totalOutflow: 120,
  totalWriteOff: 30,
  nearExpiryItems: 2,
  expiredItems: 1,
  lowStockItems: 2,
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
      source_label: "Malvar LGU",
      source_details: row.barangay_name
        ? `${row.barangay_name} distribution release`
        : "Distribution release",
      reference_type: "DISTRIBUTION",
      remarks:
        [
          row.receipt_no ? `Receipt No: ${row.receipt_no}` : "",
          row.claimed_by_name ? `Claimed By: ${row.claimed_by_name}` : "",
          row.relief_pack_template_name || row.released_items_summary || "",
        ]
          .filter(Boolean)
          .join(" | "),
      sync_status: row.sync_status || "synced",
      is_local_only: false,
      inventory_item_id: null,
      performed_by_label: row.verified_by_name || "--",
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
    creator: batch.creator || null,
    source_label: "Malvar LGU",
    source_details: "Malvar LGU",
    performed_by_label: batch.creator?.full_name || "--",
  })).filter((row) => !batchesWithTransactionRows.has(String(row.inventory_batch_id || "")));
};

const normalizeQuantity = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
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
    return "Malvar LGU";
  }

  if (
    transaction.reference_type === "DONATION" ||
    batch?.source_type === "DONATED"
  ) {
    return "Donors";
  }

  if (batch?.supplier_id || batch?.source_type === "PURCHASED") {
    return "Malvar LGU";
  }

  return "Malvar LGU";
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

const isUuidLikeValue = (value) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim(),
  );
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

  if (row.is_local_only) {
    return "Pending sync";
  }

  if (row.performed_by) {
    return isUuidLikeValue(row.performed_by) ? "Not recorded" : row.performed_by;
  }

  if (row.performed_by_label && row.performed_by_label !== "--") {
    return row.performed_by_label;
  }

  return "Not recorded";
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
    inventory_item_id: "",
    inventory_batch_id: "",
    transaction_type: "",
    date_from: "",
    date_to: "",
    source: "",
  });
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
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
  const [toolbarState, setToolbarState] = useState({
    search: "",
    movement: "",
    sortOrder: "newest",
    stockForms: [],
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterPanelPosition, setFilterPanelPosition] = useState({
    top: 0,
    left: 0,
    maxHeight: 320,
  });
  const filterButtonRef = useRef(null);
  const filterPanelRef = useRef(null);
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
        itemResponse,
        batchResponse,
        systemLogResponse,
      ] = await Promise.all([
        fetchInventoryTransactions(),
        fetchInventoryItems(),
        fetchInventoryBatches(),
        fetchSystemLogReview({ type: "audit", limit: 100 }),
      ]);

      setInventoryTransactions(transactionResponse || []);
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

  const inventoryBatchOptions = useMemo(() => {
    if (!filters.inventory_item_id) {
      return [];
    }

    return inventoryBatches
      .filter(
        (batch) =>
          String(batch.inventory_item_id || batch.inventory_item?.id || "") ===
          String(filters.inventory_item_id),
      )
      .sort((left, right) => String(left.batch_no || "").localeCompare(String(right.batch_no || "")));
  }, [filters.inventory_item_id, inventoryBatches]);

  const batchById = useMemo(() => {
    return new Map(
      inventoryBatches.map((batch) => [
        batch.id,
        {
          id: batch.id,
          batch_no: batch.batch_no || "",
          source_type: batch.source_type,
          supplier_id: batch.supplier_id,
          supplier_name: batch.supplier?.name || "",
          quantity_available: batch.quantity_available,
          expiration_date: batch.expiration_date || null,
          stock_form_packaging:
            batch.inventory_item_stock_form?.packaging ||
            batch.stock_form_packaging ||
            "",
          stock_form_units_per_packaging:
            batch.inventory_item_stock_form?.units_per_packaging ||
            batch.stock_form_units_per_packaging ||
            "",
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

    return [
      ...batchInflowRows,
      ...inventoryTransactionsWithSyncStatus,
    ]
      .map((row) => {
        const linkedBatch = batchById.get(row.inventory_batch_id);
        const resolvedInventoryItem =
          row.inventory_item ||
          row.inventory_batch?.inventory_item ||
          linkedBatch?.inventory_item ||
          null;
        const resolvedStockForm =
          row.inventory_item_stock_form ||
          row.inventory_batch?.inventory_item_stock_form ||
          null;

        return {
          ...row,
          inventory_item: resolvedInventoryItem,
          batch_no:
            row.batch_no ||
            row.inventory_batch?.batch_no ||
            linkedBatch?.batch_no ||
            "--",
          stock_form_label:
            row.inventory_item_stock_form?.packaging ||
            row.inventory_batch?.inventory_item_stock_form?.packaging ||
            linkedBatch?.stock_form_packaging ||
            "",
          units_per_packaging:
            row.inventory_item_stock_form?.units_per_packaging ||
            row.inventory_batch?.inventory_item_stock_form?.units_per_packaging ||
            row.stock_form_units_per_packaging ||
            linkedBatch?.stock_form_units_per_packaging ||
            "",
          quantity_available:
            row.quantity_available ??
            row.inventory_batch?.quantity_available ??
            linkedBatch?.quantity_available ??
            null,
          expiration_date:
            row.expiration_date ||
            row.inventory_batch?.expiration_date ||
            linkedBatch?.expiration_date ||
            null,
          inventory_item_stock_form: resolvedStockForm,
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
    inventoryBatches,
    inventoryTransactionsWithSyncStatus,
  ]);

  const displayedRows = useMemo(() => {
    const filteredRows = mergedTransactionRows.filter((row) => {
      if (
        filters.inventory_item_id &&
        row.inventory_item?.id !== filters.inventory_item_id
      ) {
        return false;
      }

      if (
        filters.inventory_batch_id &&
        String(row.inventory_batch_id || "") !== String(filters.inventory_batch_id)
      ) {
        return false;
      }

      if (
        filters.transaction_type &&
        row.transaction_type_label !== filters.transaction_type
      ) {
        return false;
      }

      if (filters.date_from) {
        const rowDate = new Date(row.performed_at || "");
        const fromDate = new Date(`${filters.date_from}T00:00:00`);

        if (Number.isNaN(rowDate.getTime()) || rowDate < fromDate) {
          return false;
        }
      }

      if (filters.date_to) {
        const rowDate = new Date(row.performed_at || "");
        const toDate = new Date(`${filters.date_to}T23:59:59`);

        if (Number.isNaN(rowDate.getTime()) || rowDate > toDate) {
          return false;
        }
      }

      if (filters.source && row.source_label !== filters.source) {
        return false;
      }

      if (
        toolbarState.search &&
        !matchesSearch(row, toolbarState.search)
      ) {
        return false;
      }

      if (
        toolbarState.movement &&
        String(row.transaction_direction || "").toUpperCase() !== toolbarState.movement
      ) {
        return false;
      }

      if (
        toolbarState.stockForms.length > 0 &&
        !toolbarState.stockForms.includes(String(row.stock_form_label || ""))
      ) {
        return false;
      }

      return true;
    });

    return [...filteredRows].sort((left, right) => {
      if (toolbarState.sortOrder === "oldest") {
        return (
          new Date(left.performed_at || 0).getTime() -
          new Date(right.performed_at || 0).getTime()
        );
      }

      if (toolbarState.sortOrder === "az") {
        return String(left.inventory_item?.item_name || "").localeCompare(
          String(right.inventory_item?.item_name || ""),
          undefined,
          { sensitivity: "base" },
        );
      }

      if (toolbarState.sortOrder === "za") {
        return String(right.inventory_item?.item_name || "").localeCompare(
          String(left.inventory_item?.item_name || ""),
          undefined,
          { sensitivity: "base" },
        );
      }

      return (
        new Date(right.performed_at || 0).getTime() -
        new Date(left.performed_at || 0).getTime()
      );
    });
  }, [
    filters.date_from,
    filters.date_to,
    filters.inventory_batch_id,
    filters.inventory_item_id,
    filters.source,
    filters.transaction_type,
    mergedTransactionRows,
    toolbarState.movement,
    toolbarState.search,
    toolbarState.sortOrder,
    toolbarState.stockForms,
  ]);

  const stockFormOptions = useMemo(() => {
    return [...new Set(
      mergedTransactionRows
        .map((row) => String(row.stock_form_label || "").trim())
        .filter(Boolean),
    )].sort((left, right) => left.localeCompare(right));
  }, [mergedTransactionRows]);

  const activeToolbarFilterCount =
    toolbarState.stockForms.length +
    (toolbarState.sortOrder !== "newest" ? 1 : 0);

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

    const totalInflow = mergedTransactionRows.reduce((sum, row) => {
      return row.transaction_direction === "INFLOW"
        ? sum + normalizeQuantity(row.quantity)
        : sum;
    }, 0);

    const totalOutflow = mergedTransactionRows.reduce((sum, row) => {
      return row.transaction_direction === "OUTFLOW"
        ? sum + normalizeQuantity(row.quantity)
        : sum;
    }, 0);

    const totalWriteOff = mergedTransactionRows.reduce((sum, row) => {
      return ["EXPIRED", "DAMAGED", "MISSING", "SPOILED", "STOLEN"].includes(
        String(row.transaction_type || "").toUpperCase(),
      )
        ? sum + normalizeQuantity(row.quantity)
        : sum;
    }, 0);

    const lowStockItems = inventoryItems.filter((item) =>
      isLowStockItem(item, trackingMap.get(item.id)),
    ).length;

    const nearExpiryItems = inventoryItems.filter((item) => {
      const trackingStats = trackingMap.get(item.id);
      const trackedExpirationDate = getTrackedExpirationDate(item, trackingStats);

      if (!trackedExpirationDate) {
        return false;
      }

      const expirationDate = new Date(trackedExpirationDate);
      const today = new Date();
      const todayDateOnly = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );

      if (Number.isNaN(expirationDate.getTime()) || expirationDate < todayDateOnly) {
        return false;
      }

      const daysUntilExpiry =
        (expirationDate.getTime() - todayDateOnly.getTime()) /
        (1000 * 60 * 60 * 24);

      return daysUntilExpiry <= 30;
    }).length;

    const expiredItems = inventoryItems.filter((item) => {
      const trackingStats = trackingMap.get(item.id);
      const trackedExpirationDate = getTrackedExpirationDate(item, trackingStats);

      return (
        normalizeQuantity(trackingStats?.expired || 0) > 0 ||
        normalizeQuantity(trackingStats?.expiredOnHand || 0) > 0 ||
        isDateExpired(trackedExpirationDate)
      );
    }).length;

    return {
      totalInflow,
      totalOutflow,
      totalWriteOff,
      nearExpiryItems,
      lowStockItems,
      expiredItems,
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
        inventory_item_id: filters.inventory_item_id,
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

  const handleFilterChange = (fieldName, value) => {
    setFilters((currentFilters) => {
      if (fieldName === "inventory_item_id") {
        return {
          ...currentFilters,
          inventory_item_id: value,
          inventory_batch_id: "",
        };
      }

      return {
        ...currentFilters,
        [fieldName]: value,
      };
    });
  };

  const handleToolbarChange = (fieldName, value) => {
    setToolbarState((currentValue) => ({
      ...currentValue,
      [fieldName]: value,
    }));
  };

  const handleToggleStockForm = (stockFormLabel) => {
    setToolbarState((currentValue) => {
      const nextStockForms = currentValue.stockForms.includes(stockFormLabel)
        ? currentValue.stockForms.filter((value) => value !== stockFormLabel)
        : [...currentValue.stockForms, stockFormLabel];

      return {
        ...currentValue,
        stockForms: nextStockForms,
      };
    });
  };

  const handleClearToolbarFilters = () => {
    setToolbarState((currentValue) => ({
      ...currentValue,
      sortOrder: "newest",
      stockForms: [],
    }));
  };

  const updateFilterPanelPosition = useCallback(() => {
    if (!filterButtonRef.current) {
      return;
    }

    const triggerRect = filterButtonRef.current.getBoundingClientRect();
    const panelHeight = filterPanelRef.current?.getBoundingClientRect().height || 0;

    setFilterPanelPosition(getFilterPanelPosition({ triggerRect, panelHeight }));
  }, []);

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    updateFilterPanelPosition();

    const handleWindowChange = () => {
      updateFilterPanelPosition();
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [activeToolbarFilterCount, isFilterOpen, updateFilterPanelPosition]);

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    const handleOutsideClick = (event) => {
      if (
        filterPanelRef.current?.contains(event.target) ||
        filterButtonRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsFilterOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isFilterOpen]);

  useEffect(() => {
    if (!isFilterOpen) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      updateFilterPanelPosition();
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [activeToolbarFilterCount, isFilterOpen, updateFilterPanelPosition]);

  return (
    <div style={pageStackStyles}>
      <PageHeader title="INVENTORY TRACKING MANAGEMENT" />

      {activeSubtab === "transactions" ? (
        <section style={{ ...shellStyles.card, marginTop: "18px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(180px, 1.1fr) minmax(180px, 1fr) minmax(180px, 1fr) minmax(160px, 0.9fr) minmax(160px, 0.9fr) minmax(180px, 1fr)",
              gap: "16px",
              alignItems: "end",
            }}
          >
            <div>
              <label htmlFor="tracking-item-filter" style={labelStyles}>
                Item
              </label>
              <select
                id="tracking-item-filter"
                value={filters.inventory_item_id}
                onChange={(event) =>
                  handleFilterChange("inventory_item_id", event.target.value)
                }
                style={inputStyles}
              >
                <option value="">All items</option>
                {inventoryItemOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tracking-batch-filter" style={labelStyles}>
                Batch
              </label>
              <select
                id="tracking-batch-filter"
                value={filters.inventory_batch_id}
                onChange={(event) =>
                  handleFilterChange("inventory_batch_id", event.target.value)
                }
                disabled={!filters.inventory_item_id}
                style={{
                  ...inputStyles,
                  opacity: !filters.inventory_item_id ? 0.7 : 1,
                  cursor: !filters.inventory_item_id ? "not-allowed" : "pointer",
                }}
              >
                <option value="">
                  {filters.inventory_item_id ? "All batches" : "Select an item first"}
                </option>
                {inventoryBatchOptions.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_no}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tracking-type-filter" style={labelStyles}>
                Transaction Type
              </label>
              <select
                id="tracking-type-filter"
                value={filters.transaction_type}
                onChange={(event) =>
                  handleFilterChange("transaction_type", event.target.value)
                }
                style={inputStyles}
              >
                {transactionTypeFilterOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tracking-date-from" style={labelStyles}>
                Date From
              </label>
              <input
                id="tracking-date-from"
                type="date"
                value={filters.date_from}
                onChange={(event) =>
                  handleFilterChange("date_from", event.target.value)
                }
                style={inputStyles}
              />
            </div>

            <div>
              <label htmlFor="tracking-date-to" style={labelStyles}>
                Date To
              </label>
              <input
                id="tracking-date-to"
                type="date"
                value={filters.date_to}
                onChange={(event) =>
                  handleFilterChange("date_to", event.target.value)
                }
                style={inputStyles}
              />
            </div>

            <div>
              <label htmlFor="tracking-source-filter" style={labelStyles}>
                Source
              </label>
              <select
                id="tracking-source-filter"
                value={filters.source}
                onChange={(event) => handleFilterChange("source", event.target.value)}
                style={inputStyles}
              >
                {sourceOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
      ) : null}

      <section style={overviewSectionStyles}>
        <div style={summaryGridStyles}>
        <SummaryCard
          label="Total Inflow"
          value={summaryMetrics.totalInflow}
          helper=""
        />
        <SummaryCard
          label="Total Outflow"
          value={summaryMetrics.totalOutflow}
          helper=""
        />
        <SummaryCard
          label="Total Write-Off"
          value={summaryMetrics.totalWriteOff}
          helper=""
        />
        <SummaryCard
          label="Near Expiry"
          value={summaryMetrics.nearExpiryItems}
          helper=""
        />
        <SummaryCard
          label="Expired"
          value={summaryMetrics.expiredItems}
          helper=""
        />
        <SummaryCard
          label="Low Stock Alerts"
          value={summaryMetrics.lowStockItems}
          helper=""
        />
        </div>
      </section>

      {activeSubtab === "transactions" ? (
        <section style={toolbarStyles}>
          <div style={searchWrapStyles}>
            <SearchBar
              value={toolbarState.search}
              onChange={(value) => handleToolbarChange("search", value)}
              placeholder="Search item name, batch number, remarks, or code"
            />
          </div>

          <div style={inlineSelectWrapStyles}>
            <label
              htmlFor="tracking-movement-filter"
              style={inlineSelectLabelStyles}
            >
              Movement
            </label>
            <select
              id="tracking-movement-filter"
              value={toolbarState.movement}
              onChange={(event) =>
                handleToolbarChange("movement", event.target.value)
              }
              style={inlineSelectStyles}
            >
              {movementFilterOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              ref={filterButtonRef}
              type="button"
              onClick={() => setIsFilterOpen((currentValue) => !currentValue)}
              style={{
                ...pageHeaderStyles.secondaryButton,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FiFilter size={16} />
              {activeToolbarFilterCount > 0
                ? `Filter (${activeToolbarFilterCount})`
                : "Filter"}
            </button>

            {isFilterOpen ? (
              <div
                ref={filterPanelRef}
                style={{
                  ...filterPanelStyles.panel,
                  top: filterPanelPosition.top,
                  left: filterPanelPosition.left,
                  maxHeight: filterPanelPosition.maxHeight,
                }}
              >
                <h3 style={filterPanelStyles.title}>Filter Records</h3>

                <label style={filterPanelStyles.field}>
                  <span style={filterPanelStyles.label}>Order List</span>
                  <select
                    value={toolbarState.sortOrder}
                    onChange={(event) =>
                      handleToolbarChange("sortOrder", event.target.value)
                    }
                    style={filterPanelStyles.select}
                  >
                    {orderOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <h3 style={filterPanelStyles.title}>Packaging / Stock Form</h3>

                <div style={filterPanelStyles.list}>
                  {stockFormOptions.length > 0 ? (
                    stockFormOptions.map((stockFormLabel) => (
                      <label key={stockFormLabel} style={filterPanelStyles.option}>
                        <input
                          type="checkbox"
                          checked={toolbarState.stockForms.includes(stockFormLabel)}
                          onChange={() => handleToggleStockForm(stockFormLabel)}
                          style={{ accentColor: "#2f6499" }}
                        />
                        <span>{stockFormLabel}</span>
                      </label>
                    ))
                  ) : (
                    <p style={{ margin: 0, color: "#5d7188", fontSize: "14px" }}>
                      No packaging or stock forms are available.
                    </p>
                  )}
                </div>

                <div style={filterPanelStyles.actions}>
                  <button
                    type="button"
                    onClick={handleClearToolbarFilters}
                    style={filterPanelStyles.clearAction}
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : null}
          </div>

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
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FiFileText size={16} />
            {isExporting ? `Exporting ${isExporting.toUpperCase()}...` : "Export"}
          </button>
        </section>
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
