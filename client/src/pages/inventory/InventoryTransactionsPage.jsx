import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FiFileText } from "react-icons/fi";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import InventoryTransactionsTable from "../../components/inventory-transactions/InventoryTransactionsTable";
import {
  exportInventoryTransactions,
  fetchInventoryTransactions,
} from "../../features/inventory-transactions/inventoryTransactionService";
import { fetchInventoryItems } from "../../features/inventory-items/inventoryItemService";
import db from "../../offline/db";
import { buildSyncDescriptor, findSyncEntry } from "../../offline/syncStatus";
import { subscribeToSyncUpdates } from "../../offline/syncService";

const selectStyles = {
  minHeight: "52px",
  padding: "0 14px",
  borderRadius: "16px",
  border: "1px solid #d3dfec",
  backgroundColor: "#ffffff",
  color: "#234260",
  fontSize: "14px",
};

const transactionTypes = [
  "OUTFLOW",
  "EXPIRED",
  "ADJUSTMENT",
  "DAMAGED",
  "MISSING",
  "RETURN",
  "INFLOW",
];

const referenceTypes = [
  "MANUAL",
  "BARCODE_SCAN",
  "DONATION",
  "DISTRIBUTION",
  "SYNC",
  "SYSTEM",
];

const exportMenuStyles = {
  position: "absolute",
  top: "calc(100% + 10px)",
  right: 0,
  minWidth: "220px",
  padding: "8px",
  borderRadius: "14px",
  backgroundColor: "#ffffff",
  border: "1px solid #d7e2ef",
  boxShadow: "0 18px 36px rgba(23, 50, 77, 0.16)",
  display: "grid",
  gap: "6px",
  zIndex: 20,
};

const exportMenuButtonStyles = {
  border: "none",
  borderRadius: "10px",
  backgroundColor: "#f8fbfe",
  color: "#264564",
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

const NO_EXPORT_DATA_MESSAGE = "No available data to export.";

const buildQueuedInventoryTransaction = (entry, inventoryItems) => {
  return {
    id: entry.entityLocalId || entry.id,
    performed_at: entry.clientTimestamp,
    inventory_item:
      inventoryItems.find((item) => item.id === entry.payload?.inventory_item_id) ||
      null,
    transaction_type: entry.payload?.transaction_type || "ADJUSTMENT",
    quantity: entry.payload?.quantity || 0,
    reference_type: entry.payload?.reference_type || "SYNC",
    remarks: entry.payload?.remarks || "",
    sync_status: entry.status,
    is_local_only: true,
  };
};

const InventoryTransactionsPage = () => {
  const [filters, setFilters] = useState({
    search: "",
    inventory_item_id: "",
    transaction_type: "",
    reference_type: "",
  });
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isExporting, setIsExporting] = useState("");
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const syncQueueEntries =
    useLiveQuery(() => db.syncQueue.toArray(), [], []) || [];

  const downloadFile = (file) => {
    const downloadUrl = window.URL.createObjectURL(file.blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = file.filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(downloadUrl);
  };

  const loadPageData = async (activeFilters = filters) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [transactionResponse, itemResponse] = await Promise.all([
        fetchInventoryTransactions(activeFilters),
        fetchInventoryItems(),
      ]);

      setInventoryTransactions(transactionResponse || []);
      setInventoryItems(itemResponse || []);
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

      return {
        ...transaction,
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
      .map((entry) => buildQueuedInventoryTransaction(entry, inventoryItems));

    return [...optimisticRows, ...syncedRows];
  }, [inventoryItems, inventoryTransactions, syncQueueEntries]);

  const handleFilterChange = (fieldName, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: value,
    }));
  };

  const handleApplyFilters = async () => {
    await loadPageData(filters);
  };

  const handleExport = async (format) => {
    setErrorMessage("");
    setIsExportMenuOpen(false);

    if (inventoryTransactionsWithSyncStatus.length === 0) {
      setErrorMessage(NO_EXPORT_DATA_MESSAGE);
      return;
    }

    setIsExporting(format);

    try {
      const file = await exportInventoryTransactions(format, filters);
      downloadFile(file);
    } catch (error) {
      setErrorMessage(
        error.message?.includes("No ")
          ? NO_EXPORT_DATA_MESSAGE
          : error.message || "Failed to export inventory transactions.",
      );
    } finally {
      setIsExporting("");
    }
  };

  return (
    <>
      <PageHeader
        title="INVENTORY TRACKING"
      />

      <section style={shellStyles.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              flex: "1 1 900px",
            }}
          >
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
              style={selectStyles}
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
              style={selectStyles}
            >
              <option value="">All Activity Types</option>
              {transactionTypes.map((transactionType) => (
                <option key={transactionType} value={transactionType}>
                  {transactionType}
                </option>
              ))}
            </select>

            <select
              value={filters.reference_type}
              onChange={(event) =>
                handleFilterChange("reference_type", event.target.value)
              }
              style={selectStyles}
            >
              <option value="">All Reference Types</option>
              {referenceTypes.map((referenceType) => (
                <option key={referenceType} value={referenceType}>
                  {referenceType}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: "12px", position: "relative" }}>
            <button
              type="button"
              onClick={handleApplyFilters}
              style={{
                border: "none",
                borderRadius: "14px",
                padding: "12px 18px",
                background: "linear-gradient(135deg, #2f6499 0%, #4c86be 100%)",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 12px 24px rgba(58, 97, 141, 0.18)",
              }}
            >
              Apply Filters
            </button>

            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setIsExportMenuOpen((currentValue) => !currentValue)}
                disabled={Boolean(isExporting)}
                style={{
                  border: "1px solid #c6d8ea",
                  borderRadius: "14px",
                  padding: "12px 18px",
                  backgroundColor: "#f8fbfe",
                  color: "#2a4c6f",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: isExporting ? "not-allowed" : "pointer",
                  minHeight: "46px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  opacity: isExporting ? 0.7 : 1,
                }}
              >
                <FiFileText size={16} />
                {isExporting ? `Exporting ${isExporting.toUpperCase()}...` : "Export"}
              </button>

              {isExportMenuOpen ? (
                <div style={exportMenuStyles}>
                  {[
                    { key: "csv", label: "Export as CSV" },
                    { key: "excel", label: "Export as Excel" },
                    { key: "pdf", label: "Export as PDF" },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handleExport(option.key)}
                      style={exportMenuButtonStyles}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <InventoryTransactionsTable
        rows={inventoryTransactionsWithSyncStatus}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />
    </>
  );
};

export default InventoryTransactionsPage;
