import React, { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import InventoryTransactionsTable from "../../components/inventory-transactions/InventoryTransactionsTable";
import { fetchInventoryTransactions } from "../../features/inventory-transactions/inventoryTransactionService";
import { fetchInventoryItems } from "../../features/inventory-items/inventoryItemService";

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
  "DISTRIBUTION",
  "SYNC",
  "SYSTEM",
];

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

  const inventoryItemOptions = useMemo(() => {
    return [...inventoryItems].sort((left, right) =>
      left.item_name.localeCompare(right.item_name),
    );
  }, [inventoryItems]);

  const handleFilterChange = (fieldName, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: value,
    }));
  };

  const handleApplyFilters = async () => {
    await loadPageData(filters);
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
        </div>
      </section>

      <InventoryTransactionsTable
        rows={inventoryTransactions}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />
    </>
  );
};

export default InventoryTransactionsPage;
