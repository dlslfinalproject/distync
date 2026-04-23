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
import { FiChevronDown } from "react-icons/fi";

const filterStyles = {
  field: {
    width: "100%",
    padding: "12px 14px",
    paddingRight: "42px",
    borderRadius: "12px",
    border: "1px solid #cfddeb",
    backgroundColor: "#f8fbfe",
    color: "#1f3b57",
    fontSize: "14px",
    boxSizing: "border-box",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    cursor: "pointer",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  selectWrap: {
    position: "relative",
    width: "100%",
  },
  selectIcon: {
    position: "absolute",
    right: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    color: "#5f7892",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

const tabTextStyle = (isActive) => ({
  padding: "12px 24px",
  border: "none",
  background: "none",
  fontSize: "14px",
  fontWeight: 700,
  textTransform: "uppercase",
  color: isActive ? "#17324d" : "#6b8298",
  borderBottom: isActive ? "3px solid #17324d" : "3px solid transparent",
  cursor: "pointer",
  transition: "all 0.2s ease",
});

const summaryBoxStyle = {
  backgroundColor: "#b4c7be",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "15px",
  color: "#234260",
  border: "1px solid rgba(35, 66, 96, 0.08)",
};

const cardTitleStyle = {
  margin: "0 0 20px",
  fontSize: "18px",
  fontWeight: 800,
  color: "#17324d",
};

const helperTextStyle = {
  margin: 0,
  color: "#6b8298",
  fontSize: "14px",
};

const staticCardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: "20px",
  alignItems: "stretch",
};

const staticCardStyle = {
  border: "1px solid #b7c7d8",
  borderRadius: "10px",
  backgroundColor: "#f8fbfe",
  padding: "18px 18px 16px",
  boxShadow: "0 2px 6px rgba(23, 50, 77, 0.10)",
  display: "flex",
  flexDirection: "column",
  minHeight: "100%",
};

const staticInnerBoxStyle = {
  backgroundColor: "#eef2f6",
  borderRadius: "10px",
  padding: "14px 16px",
  marginBottom: "2px",
  minHeight: "270px",
  display: "flex",
  flexDirection: "column",
};

const secondaryCardButtonStyle = {
  flex: 1,
  minHeight: "38px",
  borderRadius: "10px",
  border: "1px solid #bccbda",
  backgroundColor: "#f8fbfe",
  color: "#2f3f5d",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};

const primaryCardButtonStyle = {
  width: "100%",
  minHeight: "40px",
  borderRadius: "10px",
  border: "none",
  backgroundColor: "#3b4d73",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
};

const dummyTemplates = [
  {
    id: "basic-pack",
    name: "Basic Relief Pack",
    familyPerPack: "1 Family",
    items: [
      { name: "Rice (6kg)", quantity: "1 bag" },
      { name: "Ligo Sardines", quantity: "5 cans" },
      { name: "Argentina Corned Beef", quantity: "5 cans" },
      { name: "Lucky Me Chicken Noodles", quantity: "7 packs" },
      { name: "Bottled Water (300mL)", quantity: "10 bottles" },
      { name: "Sleeping Mats", quantity: "3 pcs" },
      { name: "Hygiene Kit", quantity: "1 bag" },
    ],
  },
  {
    id: "hygiene-kit",
    name: "Hygiene Kit",
    familyPerPack: "1 Family",
    items: [
      { name: "Toothbrush", quantity: "5 pcs" },
      { name: "Toothpaste", quantity: "3 sachet" },
      { name: "Soap", quantity: "1 pc" },
      { name: "Shampoo", quantity: "3 sachet" },
      { name: "Sanitary Napkin", quantity: "1 pack" },
      { name: "Diaper", quantity: "1 pack" },
    ],
  },
];

const ReliefPackTemplatesPage = () => {
  const [activeTab, setActiveTab] = useState("relief-packs");
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

  const handleCloseModal = () => {
    if (!isSubmitting) setIsModalOpen(false);
  };

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

  const filteredDummyTemplates = dummyTemplates.filter((template) => {
    const search = filters.search.trim().toLowerCase();
    if (!search) return true;

    const templateName = template.name.toLowerCase();
    const itemNames = template.items
      .map((item) => item.name.toLowerCase())
      .join(" ");

    return templateName.includes(search) || itemNames.includes(search);
  });

  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="RELIEF PACK MANAGEMENT"
        actions={[
          { label: "Create Relief Pack", onClick: handleOpenCreateModal },
        ]}
      />

      <section style={shellStyles.card}>
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #d6e2ef",
            marginBottom: "24px",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            style={tabTextStyle(activeTab === "relief-packs")}
            onClick={() => setActiveTab("relief-packs")}
          >
            Relief Packs
          </button>
          <button
            type="button"
            style={tabTextStyle(activeTab === "customization")}
            onClick={() => setActiveTab("customization")}
          >
            Pack Customization
          </button>
        </div>

        {activeTab === "relief-packs" ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
                alignItems: "end",
                marginBottom: "24px",
              }}
            >
              <div>
                <label style={filterStyles.label}>Active Disaster Event</label>
                <div style={filterStyles.selectWrap}>
                  <select style={filterStyles.field}>
                    <option>-- Select Disaster Event --</option>
                  </select>
                  <span style={filterStyles.selectIcon}>
                    <FiChevronDown size={16} />
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "20px",
              }}
            >
              <div style={shellStyles.card}>
                <h2 style={cardTitleStyle}>BASIC RELIEF PACKS</h2>

                <div style={summaryBoxStyle}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "15px" }}>
                    Packs We Can Create
                  </p>
                  <h1
                    style={{
                      fontSize: "36px",
                      margin: "8px 0 0",
                      fontWeight: 800,
                      lineHeight: 1.1,
                    }}
                  >
                    1,000
                  </h1>
                </div>

                <div style={summaryBoxStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "15px" }}>
                      Needed Items
                    </p>
                    <h1
                      style={{
                        fontSize: "36px",
                        margin: 0,
                        fontWeight: 800,
                        lineHeight: 1.1,
                      }}
                    >
                      300
                    </h1>
                  </div>

                  <div
                    style={{
                      fontSize: "12px",
                      marginTop: "12px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px 12px",
                      color: "#234260",
                      fontWeight: 600,
                    }}
                  >
                    <span>Barangay Bagong Pook: 100</span>
                    <span>Barangay Poblacion: 20</span>
                  </div>
                </div>
              </div>

              <div style={shellStyles.card}>
                <h2 style={cardTitleStyle}>HYGIENE KIT</h2>

                <div style={summaryBoxStyle}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "15px" }}>
                    Packs We Can Create
                  </p>
                  <h1
                    style={{
                      fontSize: "36px",
                      margin: "8px 0 0",
                      fontWeight: 800,
                      lineHeight: 1.1,
                    }}
                  >
                    100
                  </h1>
                </div>

                <div style={summaryBoxStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "15px" }}>
                      Needed Items
                    </p>
                    <h1
                      style={{
                        fontSize: "36px",
                        margin: 0,
                        fontWeight: 800,
                        lineHeight: 1.1,
                      }}
                    >
                      200
                    </h1>
                  </div>
                </div>

                <div
                  style={{
                    ...summaryBoxStyle,
                    backgroundColor: "#f8d7da",
                    color: "#721c24",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 800, fontSize: "15px" }}>
                    Low Stocks
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      margin: "8px 0 0",
                      fontWeight: 600,
                    }}
                  >
                    Toothpaste will drop below reorder level (50)
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <section style={{ ...shellStyles.card, marginBottom: "16px" }}>
              <div style={{ marginBottom: "16px" }}>
                <p
                  style={{
                    margin: 0,
                    color: "#17324d",
                    fontSize: "18px",
                    fontWeight: 800,
                  }}
                >
                  Relief Pack Templates
                </p>
                <p style={{ ...helperTextStyle, marginTop: "8px" }}>
                  Manage the pack structure, included items, and customization
                  for each relief pack template.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: "240px" }}>
                  <SearchBar
                    value={filters.search}
                    onChange={(value) =>
                      setFilters((prev) => ({ ...prev, search: value }))
                    }
                    placeholder="Search relief pack templates"
                  />
                </div>
              </div>
            </section>

            <section style={{ ...shellStyles.card, marginBottom: "16px" }}>
              <div style={staticCardGridStyle}>
                {filteredDummyTemplates.map((template) => (
                  <div key={template.id} style={staticCardStyle}>
                    <h3
                      style={{
                        margin: "0 0 12px",
                        color: "#2f3f5d",
                        fontSize: "22px",
                        fontWeight: 800,
                      }}
                    >
                      {template.name}
                    </h3>

                    <div style={staticInnerBoxStyle}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "10px",
                        }}
                      >
                        <span
                          style={{
                            color: "#2f3f5d",
                            fontWeight: 800,
                            fontSize: "16px",
                          }}
                        >
                          Items
                        </span>
                        <span
                          style={{
                            color: "#2f3f5d",
                            fontWeight: 800,
                            fontSize: "16px",
                          }}
                        >
                          {template.items.length}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: "6px",
                          marginBottom: "12px",
                        }}
                      >
                        {template.items.map((item, index) => (
                          <div
                            key={`${template.id}-${index}`}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              gap: "12px",
                              color: "#3a4a66",
                              fontSize: "14px",
                            }}
                          >
                            <span>{item.name}</span>
                            <span style={{ fontWeight: 600 }}>
                              {item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: "auto",
                          color: "#2f3f5d",
                          fontWeight: 800,
                          fontSize: "15px",
                        }}
                      >
                        <span>FAMILY PER PACK</span>
                        <span>{template.familyPerPack}</span>
                      </div>
                    </div>

                    <div style={{ marginTop: "auto" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          marginBottom: "10px",
                        }}
                      >
                        <button
                          type="button"
                          style={secondaryCardButtonStyle}
                          onClick={() =>
                            setSuccessMessage(`Edit clicked for "${template.name}".`)
                          }
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={secondaryCardButtonStyle}
                          onClick={() =>
                            setSuccessMessage(`Delete clicked for "${template.name}".`)
                          }
                        >
                          Delete
                        </button>
                      </div>

                      <button
                        type="button"
                        style={primaryCardButtonStyle}
                        onClick={() =>
                          setSuccessMessage(
                            `Assign to Disaster clicked for "${template.name}".`,
                          )
                        }
                      >
                        Assign to Disaster
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {successMessage ? (
              <section style={shellStyles.card}>
                <p style={{ ...helperTextStyle, color: "#17663a" }}>
                  {successMessage}
                </p>
              </section>
            ) : null}
          </>
        )}
      </section>

      <ReliefPackTemplateFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        templateData={selectedTemplate}
        onClose={handleCloseModal}
        onSubmit={handleSubmitModal}
        isSubmitting={isSubmitting}
      />

      <div style={{ display: "none" }}>
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
      </div>
    </>
  );
};

export default ReliefPackTemplatesPage;