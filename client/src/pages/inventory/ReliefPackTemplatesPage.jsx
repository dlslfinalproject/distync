import React, { useEffect, useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import ReliefPackTemplateFormModal from "../../components/relief-pack-templates/ReliefPackTemplateFormModal";
import ReliefPackTemplateItemsEditor from "../../components/relief-pack-templates/ReliefPackTemplateItemsEditor";
import ReliefPackTemplatesTable from "../../components/relief-pack-templates/ReliefPackTemplatesTable";
import {
  createReliefPackTemplate,
  fetchInventoryItems,
  fetchReliefPackTemplateById,
  fetchReliefPackTemplates,
  replaceReliefPackTemplateItems,
  updateReliefPackTemplate,
} from "../../features/relief-pack-templates/reliefPackTemplateService";

const selectStyles = {
  minHeight: "52px",
  padding: "0 14px",
  borderRadius: "16px",
  border: "1px solid #d3dfec",
  backgroundColor: "#ffffff",
  color: "#234260",
  fontSize: "14px",
};

const ReliefPackTemplatesPage = () => {
  const [filters, setFilters] = useState({
    search: "",
    is_active: "",
  });
  const [templates, setTemplates] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [modalErrorMessage, setModalErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingItems, setIsSavingItems] = useState(false);
  const [itemsErrorMessage, setItemsErrorMessage] = useState("");

  const loadTemplates = async (activeFilters = filters) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [templateResponse, inventoryItemResponse] = await Promise.all([
        fetchReliefPackTemplates(activeFilters),
        fetchInventoryItems(),
      ]);

      setTemplates(templateResponse || []);
      setInventoryItems(inventoryItemResponse || []);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplateDetail = async (templateId) => {
    try {
      const response = await fetchReliefPackTemplateById(templateId);
      setSelectedTemplate(response);
      setSelectedTemplateId(templateId);
      setItemsErrorMessage("");
    } catch (error) {
      setItemsErrorMessage(error.message);
    }
  };

  useEffect(() => {
    loadTemplates(filters);
  }, []);

  const handleFilterChange = (fieldName, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: value,
    }));
  };

  const handleApplyFilters = async () => {
    await loadTemplates(filters);
  };

  const handleOpenCreateModal = () => {
    setModalMode("create");
    setModalErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (templateId) => {
    setModalMode("edit");
    setModalErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);

    await loadTemplateDetail(templateId);
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
      if (modalMode === "edit" && selectedTemplateId) {
        const response = await updateReliefPackTemplate(selectedTemplateId, {
          name: payload.name,
          description: payload.description,
          based_on_family_size: payload.based_on_family_size,
          based_on_sector: payload.based_on_sector,
          is_active: payload.is_active,
        });
        setSuccessMessage(
          response.message || "Relief pack template updated successfully",
        );
        await loadTemplateDetail(selectedTemplateId);
      } else {
        const response = await createReliefPackTemplate(payload);
        setSuccessMessage(
          response.message || "Relief pack template created successfully",
        );

        if (response.data?.id) {
          await loadTemplateDetail(response.data.id);
        }
      }

      setIsModalOpen(false);
      await loadTemplates(filters);
    } catch (error) {
      setModalErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveItems = async (payload) => {
    if (!selectedTemplateId) {
      return;
    }

    setIsSavingItems(true);
    setItemsErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await replaceReliefPackTemplateItems(
        selectedTemplateId,
        payload,
      );
      setSuccessMessage(
        response.message || "Relief pack template items updated successfully",
      );
      await loadTemplateDetail(selectedTemplateId);
      await loadTemplates(filters);
    } catch (error) {
      setItemsErrorMessage(error.message);
    } finally {
      setIsSavingItems(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Inventory Workspace"
        title="RELIEF PACK TEMPLATES"
        description="Create reusable relief pack headers, review template details, and replace the full list of item requirements."
        actions={[
          {
            label: "Create Template",
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
              placeholder="Search template name or description"
            />

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

      <ReliefPackTemplatesTable
        rows={templates}
        isLoading={isLoading}
        errorMessage={errorMessage}
        selectedTemplateId={selectedTemplateId}
        onSelectTemplate={loadTemplateDetail}
        onEditTemplate={handleOpenEditModal}
      />

      <ReliefPackTemplateItemsEditor
        template={selectedTemplate}
        inventoryItems={inventoryItems}
        isSaving={isSavingItems}
        errorMessage={itemsErrorMessage}
        onSaveItems={handleSaveItems}
      />

      <ReliefPackTemplateFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        templateData={modalMode === "edit" ? selectedTemplate : null}
        isSubmitting={isSubmitting}
        errorMessage={modalErrorMessage}
        onClose={handleCloseModal}
        onSubmit={handleSubmitModal}
      />
    </>
  );
};

export default ReliefPackTemplatesPage;
