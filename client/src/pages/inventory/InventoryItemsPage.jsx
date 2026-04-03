import React, { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import InventoryItemFormModal from "../../components/inventory-items/InventoryItemFormModal";
import InventoryItemsTable from "../../components/inventory-items/InventoryItemsTable";
import {
  createInventoryItem,
  fetchInventoryItemById,
  fetchInventoryItems,
  updateInventoryItem,
} from "../../features/inventory-items/inventoryItemService";

const selectStyles = {
  minHeight: "52px",
  padding: "0 14px",
  borderRadius: "16px",
  border: "1px solid #d3dfec",
  backgroundColor: "#ffffff",
  color: "#234260",
  fontSize: "14px",
};

const getUniqueCategories = (rows) => {
  return [...new Set(rows.map((row) => row.category).filter(Boolean))].sort();
};

const InventoryItemsPage = () => {
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    is_active: "",
    is_perishable: "",
  });
  const [inventoryItems, setInventoryItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedItemData, setSelectedItemData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalErrorMessage, setModalErrorMessage] = useState("");

  const loadInventoryItems = async (activeFilters = filters) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchInventoryItems(activeFilters);
      setInventoryItems(response || []);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInventoryItems(filters);
  }, []);

  const categories = useMemo(() => getUniqueCategories(inventoryItems), [inventoryItems]);

  const handleFilterChange = (fieldName, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: value,
    }));
  };

  const handleApplyFilters = async () => {
    await loadInventoryItems(filters);
  };

  const handleOpenCreateModal = () => {
    setModalMode("create");
    setSelectedItemId(null);
    setSelectedItemData(null);
    setModalErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (inventoryItemId) => {
    setModalMode("edit");
    setSelectedItemId(inventoryItemId);
    setSelectedItemData(null);
    setModalErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);

    try {
      const response = await fetchInventoryItemById(inventoryItemId);
      setSelectedItemData(response);
    } catch (error) {
      setModalErrorMessage(error.message);
    }
  };

  const handleCloseModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setSelectedItemId(null);
    setSelectedItemData(null);
    setModalErrorMessage("");
  };

  const handleSubmitModal = async (payload) => {
    setIsSubmitting(true);
    setModalErrorMessage("");
    setSuccessMessage("");

    try {
      if (modalMode === "edit" && selectedItemId) {
        const response = await updateInventoryItem(selectedItemId, payload);
        setSuccessMessage(response.message || "Inventory item updated successfully");
      } else {
        const response = await createInventoryItem(payload);
        setSuccessMessage(response.message || "Inventory item created successfully");
      }

      setIsModalOpen(false);
      await loadInventoryItems(filters);
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
        title="INVENTORY ITEMS"
        description="Manage the item master list used across batches, templates, donation planning, and distribution."
        actions={[
          {
            label: "Create Item",
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
              flex: "1 1 760px",
            }}
          >
            <SearchBar
              value={filters.search}
              onChange={(value) => handleFilterChange("search", value)}
              placeholder="Search item code or item name"
            />

            <select
              value={filters.category}
              onChange={(event) =>
                handleFilterChange("category", event.target.value)
              }
              style={selectStyles}
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={filters.is_active}
              onChange={(event) =>
                handleFilterChange("is_active", event.target.value)
              }
              style={selectStyles}
            >
              <option value="">All Active States</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>

            <select
              value={filters.is_perishable}
              onChange={(event) =>
                handleFilterChange("is_perishable", event.target.value)
              }
              style={selectStyles}
            >
              <option value="">All Perishable States</option>
              <option value="true">Perishable</option>
              <option value="false">Non-perishable</option>
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

      <InventoryItemsTable
        rows={inventoryItems}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onEditItem={handleOpenEditModal}
      />

      <InventoryItemFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        itemData={selectedItemData}
        isSubmitting={isSubmitting}
        errorMessage={modalErrorMessage}
        onClose={handleCloseModal}
        onSubmit={handleSubmitModal}
      />
    </>
  );
};

export default InventoryItemsPage;
