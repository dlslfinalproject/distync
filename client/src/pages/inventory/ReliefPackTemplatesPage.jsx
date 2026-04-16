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
  minHeight: "45px",
  padding: "0 14px",
  borderRadius: "8px",
  border: "1px solid #d3dfec",
  backgroundColor: "#ffffff",
  color: "#234260",
  fontSize: "14px",
  width: "100%",
};

const tabTextStyle = (isActive) => ({
  fontSize: "15px",
  fontWeight: "600",
  padding: "10px 0",
  cursor: "pointer",
  color: isActive ? "#234260" : "#8a9eb1",
  borderBottom: isActive ? "3px solid #234260" : "3px solid transparent",
  transition: "all 0.2s ease",
});

const summaryBoxStyle = {
  backgroundColor: "#b4c7be",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "15px",
  color: "#234260",
};

const ReliefPackTemplatesPage = () => {
  const [activeTab, setActiveTab] = useState("relief-packs"); // 'relief-packs' or 'customization'
  const [filters, setFilters] = useState({ search: "", is_active: "" });
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

  const handleOpenCreateModal = () => {
    setModalMode("create");
    setModalErrorMessage("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (templateId) => {
    setModalMode("edit");
    setModalErrorMessage("");
    setIsModalOpen(true);
    await loadTemplateDetail(templateId);
  };

  const handleCloseModal = () => { if (!isSubmitting) setIsModalOpen(false); };

  const handleSubmitModal = async (payload) => {
    setIsSubmitting(true);
    try {
      if (modalMode === "edit" && selectedTemplateId) {
        await updateReliefPackTemplate(selectedTemplateId, payload);
      } else {
        await createReliefPackTemplate(payload);
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
    setIsSavingItems(true);
    try {
      await replaceReliefPackTemplateItems(selectedTemplateId, payload);
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
        eyebrow="Inventory"
        title="RELIEF PACK MANAGEMENT"
        actions={[{ label: "Create Relief Pack", onClick: handleOpenCreateModal }]}
      />

      {/* Tabs Navigation */}
      <div style={{ display: "flex", gap: "30px", borderBottom: "1px solid #e0e0e0", marginBottom: "2px" }}>
        <span 
          style={tabTextStyle(activeTab === "relief-packs")} 
          onClick={() => setActiveTab("relief-packs")}
        >
          RELIEF PACKS
        </span>
        <span 
          style={tabTextStyle(activeTab === "customization")} 
          onClick={() => setActiveTab("customization")}
        >
          PACK CUSTOMIZATION
        </span>
      </div>

      {activeTab === "relief-packs" ? (
        <section>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "14px", color: "#555", fontWeight: "600" }}>Select Disaster Event</label>
            <select style={selectStyles}>
              <option>-- Select Disaster Event --</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            {/* Basic Relief Packs Column */}
            <div style={shellStyles.card}>
              <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px" }}>BASIC RELIEF PACKS</h2>
              <div style={summaryBoxStyle}>
                <p style={{ margin: 0, fontWeight: "600" }}>Packs We Can Create</p>
                <h1 style={{ fontSize: "36px", margin: "5px 0" }}>1,000</h1>
              </div>
              <div style={summaryBoxStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ margin: 0, fontWeight: "600" }}>Needed Items</p>
                  <h1 style={{ fontSize: "36px", margin: 0 }}>300</h1>
                </div>
                <div style={{ fontSize: "12px", marginTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <span>Barangay Bagong Pook: 100</span>
                  <span>Barangay Poblacion: 20</span>
                </div>
              </div>
            </div>

            {/* Hygiene Kit Column */}
            <div style={shellStyles.card}>
              <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "20px" }}>Hygiene Kit</h2>
              <div style={summaryBoxStyle}>
                <p style={{ margin: 0, fontWeight: "600" }}>Packs We Can Create</p>
                <h1 style={{ fontSize: "36px", margin: "5px 0" }}>100</h1>
              </div>
              <div style={summaryBoxStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ margin: 0, fontWeight: "600" }}>Needed Items</p>
                  <h1 style={{ fontSize: "36px", margin: 0 }}>200</h1>
                </div>
              </div>
              <div style={{ ...summaryBoxStyle, backgroundColor: "#f8d7da", color: "#721c24" }}>
                <p style={{ margin: 0, fontWeight: "700" }}>Low Stocks</p>
                <p style={{ fontSize: "12px", margin: "5px 0 0" }}>Toothpaste will drop below reorder level (50)</p>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          <ReliefPackTemplatesTable
            rows={templates}
            isLoading={isLoading}
            onSelectTemplate={loadTemplateDetail}
            onEditTemplate={handleOpenEditModal}
          />
          <ReliefPackTemplateItemsEditor
            template={selectedTemplate}
            inventoryItems={inventoryItems}
            isSaving={isSavingItems}
            onSaveItems={handleSaveItems}
          />
        </>
      )}

      <ReliefPackTemplateFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        templateData={selectedTemplate}
        onClose={handleCloseModal}
        onSubmit={handleSubmitModal}
      />
    </>
  );
};

export default ReliefPackTemplatesPage;