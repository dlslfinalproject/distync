import React, { useEffect, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import SupplierFormModal from "../../components/suppliers/SupplierFormModal";
import SuppliersTable from "../../components/suppliers/SuppliersTable";
import {
  createSupplier,
  fetchSupplierById,
  fetchSuppliers,
  updateSupplier,
} from "../../features/suppliers/supplierService";

const selectStyles = {
  minHeight: "52px",
  padding: "0 14px",
  borderRadius: "16px",
  border: "1px solid #d3dfec",
  backgroundColor: "#ffffff",
  color: "#234260",
  fontSize: "14px",
};

const SuppliersPage = () => {
  const [filters, setFilters] = useState({
    search: "",
    has_moa: "",
  });
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [selectedSupplierData, setSelectedSupplierData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalErrorMessage, setModalErrorMessage] = useState("");

  const loadSuppliers = async (activeFilters = filters) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchSuppliers(activeFilters);
      setSuppliers(response || []);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers(filters);
  }, []);

  const handleFilterChange = (fieldName, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: value,
    }));
  };

  const handleApplyFilters = async () => {
    await loadSuppliers(filters);
  };

  const handleOpenCreateModal = () => {
    setModalMode("create");
    setSelectedSupplierId(null);
    setSelectedSupplierData(null);
    setModalErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (supplierId) => {
    setModalMode("edit");
    setSelectedSupplierId(supplierId);
    setSelectedSupplierData(null);
    setModalErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);

    try {
      const response = await fetchSupplierById(supplierId);
      setSelectedSupplierData(response);
    } catch (error) {
      setModalErrorMessage(error.message);
    }
  };

  const handleCloseModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setSelectedSupplierId(null);
    setSelectedSupplierData(null);
    setModalErrorMessage("");
  };

  const handleSubmitModal = async (payload) => {
    setIsSubmitting(true);
    setModalErrorMessage("");
    setSuccessMessage("");

    try {
      if (modalMode === "edit" && selectedSupplierId) {
        const response = await updateSupplier(selectedSupplierId, payload);
        setSuccessMessage(response.message || "Supplier updated successfully");
      } else {
        const response = await createSupplier(payload);
        setSuccessMessage(response.message || "Supplier created successfully");
      }

      setIsModalOpen(false);
      await loadSuppliers(filters);
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
        title="SUPPLIERS"
        description="Manage supplier reference data used by inventory batches, procurement tracking, and reporting."
        actions={[
          {
            label: "Create Supplier",
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
              placeholder="Search supplier name, contact person, or contact number"
            />

            <select
              value={filters.has_moa}
              onChange={(event) =>
                handleFilterChange("has_moa", event.target.value)
              }
              style={selectStyles}
            >
              <option value="">All MOA States</option>
              <option value="true">With MOA</option>
              <option value="false">Without MOA</option>
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

      <SuppliersTable
        rows={suppliers}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onEditSupplier={handleOpenEditModal}
      />

      <SupplierFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        supplierData={selectedSupplierData}
        isSubmitting={isSubmitting}
        errorMessage={modalErrorMessage}
        onClose={handleCloseModal}
        onSubmit={handleSubmitModal}
      />
    </>
  );
};

export default SuppliersPage;
