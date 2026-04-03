import React, { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import InventoryTransactionFormModal from "../../components/inventory-transactions/InventoryTransactionFormModal";
import InventoryTransactionsTable from "../../components/inventory-transactions/InventoryTransactionsTable";
import {
  createInventoryTransaction,
  fetchInventoryBatches,
  fetchInventoryTransactions,
} from "../../features/inventory-transactions/inventoryTransactionService";

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
  "INFLOW",
  "OUTFLOW",
  "ADJUSTMENT",
  "EXPIRED",
  "MISSING",
  "DAMAGED",
  "RETURN",
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
    inventory_batch_id: "",
    inventory_item_id: "",
    transaction_type: "",
    reference_type: "",
  });
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalErrorMessage, setModalErrorMessage] = useState("");

  const loadPageData = async (activeFilters = filters) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [transactionResponse, batchResponse] = await Promise.all([
        fetchInventoryTransactions(activeFilters),
        fetchInventoryBatches(),
      ]);

      setInventoryTransactions(transactionResponse || []);
      setInventoryBatches(batchResponse || []);
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
    const itemsById = new Map();

    inventoryBatches.forEach((batch) => {
      if (batch.inventory_item?.id && !itemsById.has(batch.inventory_item.id)) {
        itemsById.set(batch.inventory_item.id, batch.inventory_item);
      }
    });

    return [...itemsById.values()].sort((left, right) =>
      left.item_name.localeCompare(right.item_name),
    );
  }, [inventoryBatches]);

  const handleFilterChange = (fieldName, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: value,
    }));
  };

  const handleApplyFilters = async () => {
    await loadPageData(filters);
  };

  const handleOpenCreateModal = () => {
    setModalErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setModalErrorMessage("");
  };

  const handleSubmitModal = async (payload) => {
    setIsSubmitting(true);
    setModalErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await createInventoryTransaction(payload);
      setSuccessMessage(
        response.message || "Inventory transaction recorded successfully",
      );
      setIsModalOpen(false);
      await loadPageData(filters);
    } catch (error) {
      setModalErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Inventory Workspace"
        title="INVENTORY TRANSACTIONS"
        description="Review stock movement history and record new inflow, outflow, adjustment, return, or loss transactions."
        actions={[
          {
            label: "Create Transaction",
            onClick: handleOpenCreateModal,
          },
        ]}
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
              placeholder="Search batch no, item name, item code, or remarks"
            />

            <select
              value={filters.inventory_batch_id}
              onChange={(event) =>
                handleFilterChange("inventory_batch_id", event.target.value)
              }
              style={selectStyles}
            >
              <option value="">All Batches</option>
              {inventoryBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_no}
                </option>
              ))}
            </select>

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
              <option value="">All Transaction Types</option>
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

        {successMessage ? (
          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "14px",
              backgroundColor: "#edf8f1",
              border: "1px solid #cfe8d7",
              color: "#2f6c47",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {successMessage}
          </div>
        ) : null}
      </section>

      <InventoryTransactionsTable
        rows={inventoryTransactions}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />

      <InventoryTransactionFormModal
        isOpen={isModalOpen}
        inventoryBatches={inventoryBatches}
        isSubmitting={isSubmitting}
        errorMessage={modalErrorMessage}
        onClose={handleCloseModal}
        onSubmit={handleSubmitModal}
      />
    </>
  );
};

export default InventoryTransactionsPage;
