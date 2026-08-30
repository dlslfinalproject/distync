import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "../../context/AuthContext";
import { FiFileText, FiFilter } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import { pageSpacingStyles, shellStyles } from "../../components/layout/BarangayLayout";
import ExportModal from "../../components/shared/ExportModal";
import FeedbackToast from "../../components/shared/FeedbackToast";
import SearchBar from "../../components/shared/SearchBar";
import ResponsiveFilterPopover from "../../components/shared/ResponsiveFilterPopover";
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
import db from "../../offline/db.js";
import { buildSyncDescriptor, findSyncEntry } from "../../offline/syncStatus";
import { subscribeToSyncUpdates } from "../../offline/syncService";
import { getVisibleSyncQueueEntries } from "../../offline/syncQueue";
import {
  canUseMayorInventoryCacheAfterError,
  getMayorInventoryCacheSnapshot,
} from "../../offline/mayorInventoryCache";
import { mergeInventoryBatchesWithSyncStatus } from "../../offline/mayorInventoryOfflineModel";
import { ROLE_CODES } from "../../utils/roleSession";
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

const transactionFilterGridStyles = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "16px",
  alignItems: "end",
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

const inflowTransactionTypes = new Set(["INFLOW", "RETURN", "ADJUSTMENT"]);
const outflowTransactionTypes = new Set([
  "OUTFLOW",
  "EXPIRED",
  "DAMAGED",
  "MISSING",
  "SPOILED",
  "STOLEN",
  "OTHER",
]);

const transactionTypeFilterOptions = [
  { value: "", label: "All transaction types" },
  { value: "Stock-Up", label: "Stock-Up" },
  { value: "Donated", label: "Donation" },
  { value: "Donation Adjustment", label: "Donation Adjustment" },
  { value: "Distributed", label: "Distributed" },
  { value: "Damaged", label: "Damaged" },
  { value: "Spoiled", label: "Spoiled" },
  { value: "Missing", label: "Missing" },
  { value: "Stolen", label: "Stolen" },
  { value: "Expired", label: "Expired" },
  { value: "Other", label: "Other" },
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
    other_status: entry.payload?.other_status || null,
    quantity: entry.payload?.quantity || 0,
    inventory_transaction_reference_no: null,
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
    sync_status: batch.sync_status || "SYNCED",
    is_local_only: Boolean(batch.is_local_only),
    client_sync_id: batch.client_sync_id || null,
    inventory_item: batch.inventory_item || null,
    creator: batch.creator || null,
    source_label: getBatchSourceLabel(batch),
    source_details: getBatchSourceDetails(batch, "Malvar LGU"),
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

const getBatchSourceLabel = (batch) => {
  const sourceType = String(batch?.source_type || "").toUpperCase();

  if (sourceType === "DONATED") {
    return "Donors";
  }

  return "Malvar LGU";
};

const getBatchSourceDetails = (batch, fallback = "--") => {
  const sourceType = String(batch?.source_type || "").toUpperCase();

  if (sourceType === "DONATED") {
    return batch?.donation?.donor_name || "Donors";
  }

  return fallback;
};

const getSourceLabel = (transaction, batch) => {
  if (
    transaction.reference_type === "DONATION" ||
    transaction.donation?.donor_name ||
    batch?.source_type === "DONATED"
  ) {
    return "Donors";
  }

  return getBatchSourceLabel(batch);
};

const getSourceDetails = (transaction, batch) => {
  if (
    transaction.reference_type === "DONATION" ||
    transaction.donation?.donor_name ||
    batch?.source_type === "DONATED"
  ) {
    return (
      transaction.donation?.donor_name ||
      batch?.donation?.donor_name ||
      "Donors"
    );
  }

  return getBatchSourceDetails(batch, "Malvar LGU");
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

const isDonationAdjustmentRow = (row) => {
  const referenceType = String(row.reference_type || "").toUpperCase();
  const transactionType = String(row.transaction_type || "").toUpperCase();
  const remarks = String(row.remarks || "").trim().toLowerCase();

  if (referenceType !== "DONATION") {
    return false;
  }

  if (transactionType === "ADJUSTMENT") {
    return true;
  }

  return (
    remarks.startsWith("adjusted up donation stock") ||
    remarks.startsWith("adjusted down donation stock") ||
    remarks.includes("donation adjustment")
  );
};

const getTransactionTypeLabel = (row) => {
  const transactionDirection = String(row.transaction_direction || "").toUpperCase();
  const sourceLabel = String(row.source_label || "").toUpperCase();
  const referenceType = String(row.reference_type || "").toUpperCase();
  const transactionType = String(row.transaction_type || "").toUpperCase();

  if (isDonationAdjustmentRow(row)) {
    return "Donation Adjustment";
  }

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

const matchesSearch = (row, searchValue) => {
  const normalizedSearch = String(searchValue || "").trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  const searchableFields = [
    row.id,
    row.transaction_type,
    row.other_status,
    row.transaction_direction,
    row.inventory_item?.item_name,
    row.inventory_item?.item_code,
    row.inventory_transaction_reference_no,
    row.source_label,
    row.source_details,
    row.remarks,
  ];

  return searchableFields.some((fieldValue) =>
    String(fieldValue || "").toLowerCase().includes(normalizedSearch),
  );
};

const SummaryCard = ({ label, value, helper }) => (
  <article style={summaryCardStyles}>
    <p style={summaryEyebrowStyles}>{label}</p>
    <p style={summaryValueStyles}>{value}</p>
    {helper ? <p style={summaryHelperStyles}>{helper}</p> : null}
  </article>
);

const InventoryTransactionsPage = () => {
  const { currentRole } = useAuth();
  const isMayorPortal = currentRole === ROLE_CODES.MAYOR;
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );
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
  const syncQueueEntries =
    useLiveQuery(() => getVisibleSyncQueueEntries(), [], []) || [];
  const downloadFile = (file) => {
    downloadExportFile(file);
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const loadPageData = async (activeFilters = filters) => {
    setIsLoading(true);
    setErrorMessage("");

    if (!isOnline && isMayorPortal) {
      const cacheRow = await getMayorInventoryCacheSnapshot();

      if (cacheRow) {
        setInventoryTransactions(cacheRow.transactions || []);
        setInventoryItems(cacheRow.items || []);
        setInventoryBatches(cacheRow.batches || []);
      } else {
        setErrorMessage(
          "Inventory transaction history is not prepared on this device yet. Connect to DISTYNC to view it.",
        );
      }

      setIsLoading(false);
      return;
    }

    try {
      const [transactionResponse, itemResponse, batchResponse] = await Promise.all([
        fetchInventoryTransactions(),
        fetchInventoryItems(),
        fetchInventoryBatches(),
      ]);

      setInventoryTransactions(transactionResponse || []);
      setInventoryItems(itemResponse || []);
      setInventoryBatches(batchResponse || []);
    } catch (error) {
      if (isMayorPortal && canUseMayorInventoryCacheAfterError(error)) {
        const cacheRow = await getMayorInventoryCacheSnapshot();
        if (cacheRow) {
          setInventoryTransactions(cacheRow.transactions || []);
          setInventoryItems(cacheRow.items || []);
          setInventoryBatches(cacheRow.batches || []);
        } else {
          setErrorMessage(error.message || "Failed to load inventory transactions.");
        }
      } else {
        setErrorMessage(error.message || "Failed to load inventory transactions.");
      }
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

  const inventoryBatchesForDisplay = useMemo(
    () =>
      mergeInventoryBatchesWithSyncStatus({
        inventoryBatches,
        inventoryItems,
        syncQueueEntries,
      }),
    [inventoryBatches, inventoryItems, syncQueueEntries],
  );

  const inventoryBatchOptions = useMemo(() => {
    if (!filters.inventory_item_id) {
      return [];
    }

    return inventoryBatchesForDisplay
      .filter(
        (batch) =>
          String(batch.inventory_item_id || batch.inventory_item?.id || "") ===
          String(filters.inventory_item_id),
      )
      .sort((left, right) => String(left.batch_no || "").localeCompare(String(right.batch_no || "")));
  }, [filters.inventory_item_id, inventoryBatchesForDisplay]);

  const batchById = useMemo(() => {
    return new Map(
      inventoryBatchesForDisplay.map((batch) => [
        batch.id,
        {
          id: batch.id,
          batch_no: batch.batch_no || "",
          source_type: batch.source_type,
          supplier_id: batch.supplier_id,
          supplier: batch.supplier || null,
          supplier_name: batch.supplier?.name || "",
          donation: batch.donation || null,
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
  }, [inventoryBatchesForDisplay]);

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

      const linkedBatch =
        batchById.get(transaction.inventory_batch_id) ||
        transaction.inventory_batch ||
        null;

      return {
        ...transaction,
        transaction_direction: getTransactionDirection(transaction.transaction_type),
        source_label: getSourceLabel(transaction, linkedBatch),
        source_details: getSourceDetails(transaction, linkedBatch),
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
        const queuedRow = buildQueuedInventoryTransaction(
          entry,
          inventoryBatchesForDisplay,
        );
        const linkedBatch = batchById.get(queuedRow.inventory_batch_id);

        return {
          ...queuedRow,
          transaction_direction: getTransactionDirection(queuedRow.transaction_type),
          source_label: getSourceLabel(queuedRow, linkedBatch),
          source_details: getSourceDetails(queuedRow, linkedBatch),
        };
      });

    return [...optimisticRows, ...syncedRows];
  }, [
    batchById,
    inventoryBatchesForDisplay,
    inventoryTransactions,
    syncQueueEntries,
  ]);

  const mergedTransactionRows = useMemo(() => {
    const batchInflowRows = buildBatchInflowRows(
      inventoryBatchesForDisplay,
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
    inventoryBatchesForDisplay,
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
      inventoryBatchesForDisplay,
      inventoryTransactionsWithSyncStatus,
    );
  }, [
    inventoryBatchesForDisplay,
    inventoryItems,
    inventoryTransactionsWithSyncStatus,
  ]);

  const summaryMetrics = useMemo(() => {
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
      return [
        "EXPIRED",
        "DAMAGED",
        "MISSING",
        "SPOILED",
        "STOLEN",
        "OTHER",
      ].includes(
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
  }, [
    inventoryBatchesForDisplay,
    inventoryItems,
    mergedTransactionRows,
    trackingMap,
  ]);

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

  return (
    <div className="inventory-tracking-page" style={pageStackStyles}>
      <PageHeader title="INVENTORY TRACKING MANAGEMENT" />

      <section
        className="inventory-tracking-filter-card"
        style={{ ...shellStyles.card, marginTop: "18px" }}
      >
          <div
            className="inventory-tracking-filter-grid"
            style={transactionFilterGridStyles}
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

      <section
        className="inventory-tracking-overview"
        style={overviewSectionStyles}
      >
        <div className="inventory-tracking-summary-grid" style={summaryGridStyles}>
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

      <section className="inventory-tracking-toolbar" style={toolbarStyles}>
          <div className="inventory-tracking-search-wrap" style={searchWrapStyles}>
            <SearchBar
              value={toolbarState.search}
              onChange={(value) => handleToolbarChange("search", value)}
              placeholder="Search item name, batch number, status, remarks, or code"
            />
          </div>

          <div className="inventory-tracking-movement-filter" style={inlineSelectWrapStyles}>
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

          <div className="inventory-tracking-filter-button-wrap">
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
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  {...triggerProps}
                >
                  <FiFilter size={16} />
                  {activeToolbarFilterCount > 0
                    ? `Filter (${activeToolbarFilterCount})`
                    : "Filter"}
                </button>
              )}
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
            </ResponsiveFilterPopover>
          </div>

          <button
            className="inventory-tracking-export-button"
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

      <section className="inventory-tracking-records-card" style={shellStyles.card}>
        <div style={{ marginBottom: "18px" }}>
          <h3 style={sectionTitleStyles}>Inventory Transactions</h3>
        </div>

        <InventoryTransactionsTable
          rows={displayedRows}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onViewDetails={handleOpenTransactionDetail}
        />
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
