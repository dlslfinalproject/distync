import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/layout/PageHeader";
import { shellStyles } from "../components/layout/BarangayLayout";
import DonationFilters from "../components/donations/DonationFilters";
import DonationModal from "../components/donations/DonationModal";
import DonationNeedModal from "../components/donations/DonationNeedModal";
import DonationNeedsTab from "../components/donations/DonationNeedsTab";
import DonationsTab from "../components/donations/DonationsTab";
import DonationDetailModal from "../components/donations/DonationDetailModal";
import DonorTransparencyTab from "../components/donations/DonorTransparencyTab";
import ExportModal from "../components/shared/ExportModal";
import FeedbackToast from "../components/shared/FeedbackToast";
import { fetchAllDisasterEvents } from "../features/disaster-events/disasterEventService";
import { fetchInventoryItems } from "../features/inventory-items/inventoryItemService";
import {
  createDonation,
  fetchDonationDetail,
  createDonationItem,
  createDonationNeed,
  deleteDonation,
  deleteDonationItem,
  deleteDonationNeed,
  exportDonationTransparencySummary,
  fetchDonationById,
  fetchDonationNeeds,
  fetchDonationPortalData,
  fetchDonations,
  updateDonation,
  updateDonationItem,
  updateDonationNeed,
} from "../features/donations/donationService";
import {
  mergeDonationsWithSyncStatus,
  mergeDonationNeedsWithSyncStatus,
} from "../features/donations/donationSync";
import {
  backButtonStyles,
  createDonationForm,
  createDonationItemForm,
  createNeedForm,
} from "../features/donations/donationUi";
import { useAuth } from "../context/AuthContext";
import { getDefaultRouteForRole } from "../utils/roleSession";
import db from "../offline/db";
import { subscribeToSyncUpdates } from "../offline/syncService";
import {
  buildExportSuccessMessage,
  COMMON_EXPORT_FORMAT_OPTIONS,
  downloadExportFile,
  NO_EXPORT_DATA_MESSAGE,
  resolveExportErrorMessage,
} from "../utils/exportHelpers";

const defaultPortalData = {
  donation_needs: [],
  transparency_summary: {
    total_donations_received: 0,
    total_quantity_received: 0,
    total_donated_items_distributed: 0,
    remaining_donated_inventory: 0,
    received_vs_distributed: [],
  },
};

const DonationManagementPage = () => {
  const navigate = useNavigate();
  const { currentRole } = useAuth();
  const canManageDonations = currentRole === "MAYOR";
  const availableTabs = canManageDonations
    ? [
        { key: "donations", label: "Donations" },
        { key: "needs", label: "Donation Needs" },
        { key: "transparency", label: "Transparency Summary" },
      ]
    : [
        { key: "needs", label: "Donation Needs" },
        { key: "transparency", label: "Transparency Summary" },
      ];

  const [activeTab, setActiveTab] = useState(
    canManageDonations ? "donations" : "needs",
  );
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [donationNeeds, setDonationNeeds] = useState([]);
  const [donations, setDonations] = useState([]);
  const [portalData, setPortalData] = useState(defaultPortalData);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [needSearch, setNeedSearch] = useState("");
  const [donationSearch, setDonationSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isExportingTransparency, setIsExportingTransparency] = useState("");
  const [isTransparencyExportModalOpen, setIsTransparencyExportModalOpen] =
    useState(false);
  const [selectedTransparencyExportFormat, setSelectedTransparencyExportFormat] =
    useState("csv");
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });
  const [isNeedModalOpen, setIsNeedModalOpen] = useState(false);
  const [needForm, setNeedForm] = useState(createNeedForm());
  const [needErrorMessage, setNeedErrorMessage] = useState("");
  const [isNeedSubmitting, setIsNeedSubmitting] = useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [isDonationDetailModalOpen, setIsDonationDetailModalOpen] = useState(false);
  const [isDonationDetailLoading, setIsDonationDetailLoading] = useState(false);
  const [donationDetailErrorMessage, setDonationDetailErrorMessage] = useState("");
  const [selectedDonationDetail, setSelectedDonationDetail] = useState(null);
  const [donationForm, setDonationForm] = useState(createDonationForm());
  const [donationErrorMessage, setDonationErrorMessage] = useState("");
  const [donationItemErrorMessage, setDonationItemErrorMessage] = useState("");
  const [isDonationSubmitting, setIsDonationSubmitting] = useState(false);
  const [donationItemDraft, setDonationItemDraft] = useState(createDonationItemForm());
  const [editingDonationItemId, setEditingDonationItemId] = useState("");

  const syncQueueEntries =
    useLiveQuery(() => db.syncQueue.toArray(), [], []) || [];

  const loadPageData = async (eventId = selectedEventId) => {
    setIsLoading(true);
    setPageErrorMessage("");

    try {
      const [eventRows, inventoryItemRows, donationNeedRows, donationRows, donationPortal] =
        await Promise.all([
          fetchAllDisasterEvents(),
          canManageDonations
            ? fetchInventoryItems({ is_active: true })
            : Promise.resolve([]),
          fetchDonationNeeds({
            disaster_event_id: eventId || undefined,
            search: needSearch || undefined,
          }),
          canManageDonations
            ? fetchDonations({
                disaster_event_id: eventId || undefined,
                search: donationSearch || undefined,
              })
            : Promise.resolve([]),
          fetchDonationPortalData({
            disaster_event_id: eventId || undefined,
          }),
        ]);

      setDisasterEvents(Array.isArray(eventRows) ? eventRows : []);
      setInventoryItems(Array.isArray(inventoryItemRows) ? inventoryItemRows : []);
      setDonationNeeds(Array.isArray(donationNeedRows) ? donationNeedRows : []);
      setDonations(Array.isArray(donationRows) ? donationRows : []);
      setPortalData(donationPortal || defaultPortalData);

      if (!eventId && Array.isArray(eventRows) && eventRows.length > 0) {
        setSelectedEventId(eventRows[0].id);
      }
    } catch (error) {
      setPageErrorMessage(error.message || "Failed to load donation management data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageDonations) {
      setActiveTab("needs");
    }

    loadPageData(selectedEventId);
  }, [canManageDonations]);

  useEffect(() => {
    const unsubscribe = subscribeToSyncUpdates(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        loadPageData(selectedEventId);
      }
    });

    return () => unsubscribe();
  }, [selectedEventId]);

  const donationNeedsWithSyncStatus = useMemo(() => {
    return mergeDonationNeedsWithSyncStatus({
      donationNeeds,
      syncQueueEntries,
      selectedEventId,
      inventoryItems,
      disasterEvents,
    });
  }, [disasterEvents, donationNeeds, inventoryItems, selectedEventId, syncQueueEntries]);

  const donationsWithSyncStatus = useMemo(() => {
    return mergeDonationsWithSyncStatus({
      donations,
      syncQueueEntries,
      selectedEventId,
      inventoryItems,
      disasterEvents,
    });
  }, [disasterEvents, donations, inventoryItems, selectedEventId, syncQueueEntries]);

  const filteredDonationNeeds = useMemo(() => {
    if (!needSearch.trim()) {
      return donationNeedsWithSyncStatus;
    }

    const normalizedSearch = needSearch.trim().toLowerCase();

    return donationNeedsWithSyncStatus.filter((need) =>
      [
        need.inventory_item?.item_name,
        need.inventory_item?.item_code,
        need.disaster_event?.title,
        need.disaster_event?.event_code,
        need.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
    );
  }, [donationNeedsWithSyncStatus, needSearch]);

  const filteredDonations = useMemo(() => {
    if (!donationSearch.trim()) {
      return donationsWithSyncStatus;
    }

    const normalizedSearch = donationSearch.trim().toLowerCase();

    return donationsWithSyncStatus.filter((donation) =>
      [
        donation.donor_name,
        donation.contact_information,
        donation.disaster_event?.title,
        donation.disaster_event?.event_code,
        donation.remarks,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
    );
  }, [donationsWithSyncStatus, donationSearch]);

  const selectedEventLabel = useMemo(() => {
    const matchedEvent = disasterEvents.find((event) => event.id === selectedEventId);
    return matchedEvent ? `${matchedEvent.event_code} - ${matchedEvent.title}` : "All Events";
  }, [disasterEvents, selectedEventId]);

  const openNeedModal = (donationNeed = null) => {
    setNeedErrorMessage("");
    setNeedForm(
      donationNeed
        ? {
            id: donationNeed.id,
            disaster_event_id: donationNeed.disaster_event_id,
            inventory_item_id: donationNeed.inventory_item_id,
            quantity_needed: donationNeed.quantity_needed,
            priority_level: donationNeed.priority_level,
            notes: donationNeed.notes || "",
            is_active: donationNeed.is_active,
          }
        : {
            ...createNeedForm(),
            disaster_event_id: selectedEventId || "",
          },
    );
    setIsNeedModalOpen(true);
  };

  const closeNeedModal = () => {
    setIsNeedModalOpen(false);
    setNeedForm(createNeedForm());
    setNeedErrorMessage("");
  };

  const openDonationModal = async (donationId = null) => {
    setDonationErrorMessage("");
    setDonationItemErrorMessage("");
    setEditingDonationItemId("");
    setDonationItemDraft(createDonationItemForm());

    if (!donationId) {
      setDonationForm({
        ...createDonationForm(),
        disaster_event_id: selectedEventId || "",
      });
      setIsDonationModalOpen(true);
      return;
    }

    try {
      const donation = await fetchDonationById(donationId);
      setDonationForm({
        id: donation.id,
        disaster_event_id: donation.disaster_event_id,
        donor_name: donation.donor_name,
        donor_type: donation.donor_type,
        contact_information: donation.contact_information || "",
        received_at: donation.received_at
          ? new Date(donation.received_at).toISOString().slice(0, 16)
          : "",
        status: donation.status,
        remarks: donation.remarks || "",
        items: donation.items || [],
      });
      setIsDonationModalOpen(true);
    } catch (error) {
      setPageErrorMessage(error.message || "Failed to load donation details.");
    }
  };

  const closeDonationModal = () => {
    setIsDonationModalOpen(false);
    setDonationForm(createDonationForm());
    setDonationErrorMessage("");
    setDonationItemErrorMessage("");
    setDonationItemDraft(createDonationItemForm());
    setEditingDonationItemId("");
  };

  const openDonationDetailModal = async (donationId) => {
    setIsDonationDetailModalOpen(true);
    setIsDonationDetailLoading(true);
    setDonationDetailErrorMessage("");
    setSelectedDonationDetail(null);

    try {
      const response = await fetchDonationDetail(donationId);
      setSelectedDonationDetail(response?.data || null);
    } catch (error) {
      setDonationDetailErrorMessage(error.message || "Failed to load donation detail.");
    } finally {
      setIsDonationDetailLoading(false);
    }
  };

  const submitDonationNeed = async () => {
    setIsNeedSubmitting(true);
    setNeedErrorMessage("");

    try {
      const payload = {
        disaster_event_id: needForm.disaster_event_id,
        inventory_item_id: needForm.inventory_item_id,
        quantity_needed: Number(needForm.quantity_needed),
        priority_level: needForm.priority_level,
        notes: needForm.notes.trim() || null,
        is_active: needForm.is_active,
      };

      if (needForm.id) {
        const response = await updateDonationNeed(needForm.id, payload);
        setSuccessMessage("Donation need updated successfully.");
        if (!response?.queued_offline) {
          await loadPageData(selectedEventId);
        }
      } else {
        const response = await createDonationNeed(payload);
        setSuccessMessage("Donation need created successfully.");
        if (!response?.queued_offline) {
          await loadPageData(selectedEventId);
        }
      }

      closeNeedModal();
    } catch (error) {
      setNeedErrorMessage(error.message || "Failed to save donation need.");
    } finally {
      setIsNeedSubmitting(false);
    }
  };

  const submitDonation = async () => {
    setIsDonationSubmitting(true);
    setDonationErrorMessage("");

    try {
      const payload = {
        disaster_event_id: donationForm.disaster_event_id,
        donor_name: donationForm.donor_name.trim(),
        donor_type: donationForm.donor_type,
        contact_information: donationForm.contact_information.trim() || null,
        received_at: donationForm.received_at
          ? new Date(donationForm.received_at).toISOString()
          : null,
        status: donationForm.status,
        remarks: donationForm.remarks.trim() || null,
      };

      if (!donationForm.id) {
        if (donationForm.items.length === 0) {
          throw new Error("Add at least one donated item before saving the donation record.");
        }

        const response = await createDonation({
          ...payload,
          items: donationForm.items.map((item) => ({
            inventory_item_id: item.inventory_item_id,
            quantity_received: Number(item.quantity_received),
            remarks: item.remarks || null,
            expiration_date: item.expiration_date || null,
            storage_location: item.storage_location || null,
          })),
        });
        setSuccessMessage("Donation recorded successfully.");
        if (!response?.queued_offline) {
          await loadPageData(selectedEventId);
        }
      } else {
        const response = await updateDonation(donationForm.id, payload);
        setSuccessMessage("Donation updated successfully.");
        if (!response?.queued_offline) {
          await loadPageData(selectedEventId);
        }
      }

      closeDonationModal();
    } catch (error) {
      setDonationErrorMessage(error.message || "Failed to save donation.");
    } finally {
      setIsDonationSubmitting(false);
    }
  };

  const addDraftDonationItem = () => {
    setDonationItemErrorMessage("");

    if (!donationItemDraft.inventory_item_id) {
      setDonationItemErrorMessage("Select an inventory item before adding it.");
      return;
    }

    setDonationForm((currentForm) => ({
      ...currentForm,
      items: [
        ...currentForm.items,
        {
          ...donationItemDraft,
          inventory_item_id: donationItemDraft.inventory_item_id,
          quantity_received: Number(donationItemDraft.quantity_received),
          inventory_item: inventoryItems.find(
            (item) => item.id === donationItemDraft.inventory_item_id,
          ),
        },
      ],
    }));
    setDonationItemDraft(createDonationItemForm());
  };

  const startEditDonationItem = (item) => {
    setEditingDonationItemId(item.id);
    setDonationItemDraft({
      inventory_item_id: item.inventory_item_id,
      quantity_received: item.quantity_received,
      remarks: item.remarks || "",
      expiration_date: item.inventory_batch?.expiration_date
        ? item.inventory_batch.expiration_date.slice(0, 10)
        : "",
      storage_location: item.inventory_batch?.storage_location || "",
    });
  };

  const cancelEditDonationItem = () => {
    setEditingDonationItemId("");
    setDonationItemDraft(createDonationItemForm());
    setDonationItemErrorMessage("");
  };

  const saveExistingDonationItem = async () => {
    if (!editingDonationItemId) {
      return;
    }

    setDonationItemErrorMessage("");

    try {
      await updateDonationItem(editingDonationItemId, {
        inventory_item_id: donationItemDraft.inventory_item_id,
        quantity_received: Number(donationItemDraft.quantity_received),
        remarks: donationItemDraft.remarks.trim() || null,
        expiration_date: donationItemDraft.expiration_date || null,
        storage_location: donationItemDraft.storage_location.trim() || null,
      });

      const refreshedDonation = await fetchDonationById(donationForm.id);
      setDonationForm((currentForm) => ({
        ...currentForm,
        items: refreshedDonation.items || [],
      }));
      setSuccessMessage("Donation item updated successfully.");
      cancelEditDonationItem();
      await loadPageData(selectedEventId);
    } catch (error) {
      setDonationItemErrorMessage(error.message || "Failed to update donation item.");
    }
  };

  const removeDraftDonationItem = (itemToRemove) => {
    setDonationForm((currentForm) => ({
      ...currentForm,
      items: currentForm.items.filter((item) => item !== itemToRemove),
    }));
  };

  const removeExistingDonationItem = async (item) => {
    const userConfirmed = window.confirm(
      "Remove this donation item from the donation record?",
    );

    if (!userConfirmed) {
      return;
    }

    try {
      await deleteDonationItem(item.id);
      const refreshedDonation = await fetchDonationById(donationForm.id);
      setDonationForm((currentForm) => ({
        ...currentForm,
        items: refreshedDonation.items || [],
      }));
      setSuccessMessage("Donation item deleted successfully.");
      cancelEditDonationItem();
      await loadPageData(selectedEventId);
    } catch (error) {
      setDonationItemErrorMessage(error.message || "Failed to delete donation item.");
    }
  };

  const addExistingDonationItem = async () => {
    if (!donationForm.id) {
      addDraftDonationItem();
      return;
    }

    setDonationItemErrorMessage("");

    try {
      await createDonationItem(donationForm.id, {
        inventory_item_id: donationItemDraft.inventory_item_id,
        quantity_received: Number(donationItemDraft.quantity_received),
        remarks: donationItemDraft.remarks.trim() || null,
        expiration_date: donationItemDraft.expiration_date || null,
        storage_location: donationItemDraft.storage_location.trim() || null,
      });
      const refreshedDonation = await fetchDonationById(donationForm.id);
      setDonationForm((currentForm) => ({
        ...currentForm,
        items: refreshedDonation.items || [],
      }));
      setDonationItemDraft(createDonationItemForm());
      setSuccessMessage("Donation item added successfully.");
      await loadPageData(selectedEventId);
    } catch (error) {
      setDonationItemErrorMessage(error.message || "Failed to add donation item.");
    }
  };

  const handleDeleteDonationNeed = async (donationNeed) => {
    const confirmed = window.confirm(
      `Delete the donation need for ${donationNeed.inventory_item?.item_name || "this item"}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteDonationNeed(donationNeed.id);
      setSuccessMessage("Donation need deleted successfully.");
      await loadPageData(selectedEventId);
    } catch (error) {
      setPageErrorMessage(error.message || "Failed to delete donation need.");
    }
  };

  const handleDeleteDonation = async (donation) => {
    const confirmed = window.confirm(
      `Delete the donation record for ${donation.donor_name}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteDonation(donation.id);
      setSuccessMessage("Donation deleted successfully.");
      await loadPageData(selectedEventId);
    } catch (error) {
      setPageErrorMessage(error.message || "Failed to delete donation.");
    }
  };

  const downloadFile = (file) => {
    downloadExportFile(file);
  };

  const handleExportTransparency = async (format) => {
    setPageErrorMessage("");
    setSuccessMessage("");
    setIsTransparencyExportModalOpen(false);

    if ((portalData.transparency_summary?.received_vs_distributed || []).length === 0) {
      setExportFeedback({
        type: "error",
        message: NO_EXPORT_DATA_MESSAGE,
      });
      return;
    }

    setIsExportingTransparency(format);

    try {
      const file = await exportDonationTransparencySummary(format, {
        disaster_event_id: selectedEventId,
      });
      downloadFile(file);
      setExportFeedback({
        type: "success",
        message: buildExportSuccessMessage("Donation transparency summary"),
      });
    } catch (error) {
      setExportFeedback({
        type: "error",
        message: resolveExportErrorMessage(
          error,
          "Failed to export donor transparency summary.",
        ),
      });
    } finally {
      setIsExportingTransparency("");
    }
  };

  const pageTitle = canManageDonations
    ? "DONATION MANAGEMENT"
    : "DONATION SUMMARY";
  const pageDescription = canManageDonations
    ? "Manage published donation needs, record received donations, and review donor transparency summaries using live database-backed data."
    : "Review published donation needs and donor transparency summaries using live database-backed data.";

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <button
          type="button"
          onClick={() =>
            navigate(getDefaultRouteForRole(currentRole), { replace: true })
          }
          style={backButtonStyles}
        >
          â† Back
        </button>
      </div>

      <PageHeader title={pageTitle} description={pageDescription} />

      <section style={shellStyles.card}>
        <DonationFilters
          activeTab={activeTab}
          canManageDonations={canManageDonations}
          selectedEventId={selectedEventId}
          disasterEvents={disasterEvents}
          needSearch={needSearch}
          donationSearch={donationSearch}
          onSelectedEventChange={(nextEventId) => {
            setSelectedEventId(nextEventId);
            loadPageData(nextEventId);
          }}
          onNeedSearchChange={setNeedSearch}
          onDonationSearchChange={setDonationSearch}
          onRefresh={() => loadPageData(selectedEventId)}
          onOpenNeedModal={() => openNeedModal()}
          onOpenDonationModal={() => openDonationModal()}
          isExportingTransparency={isExportingTransparency}
          onOpenTransparencyExport={() => {
            setSelectedTransparencyExportFormat("csv");
            setExportFeedback({ type: "", message: "" });
            setIsTransparencyExportModalOpen(true);
          }}
        />

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginTop: "18px",
          }}
        >
          {availableTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                border: "none",
                borderRadius: "999px",
                padding: "10px 16px",
                backgroundColor: activeTab === tab.key ? "#dbe8f6" : "#eef5fc",
                color: activeTab === tab.key ? "#17324d" : "#40617f",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {successMessage ? (
          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "14px",
              backgroundColor: "#edfdf4",
              border: "1px solid #ccebd9",
              color: "#1f6b48",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {successMessage}
          </div>
        ) : null}

        {pageErrorMessage ? (
          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "14px",
              backgroundColor: "#fff3f1",
              border: "1px solid #f1d2cc",
              color: "#9d4d58",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {pageErrorMessage}
          </div>
        ) : null}
      </section>

      {activeTab === "needs" ? (
        <DonationNeedsTab
          isLoading={isLoading}
          filteredDonationNeeds={filteredDonationNeeds}
          selectedEventLabel={selectedEventLabel}
          canManageDonations={canManageDonations}
          onOpenNeedModal={openNeedModal}
          onDeleteDonationNeed={handleDeleteDonationNeed}
        />
      ) : null}

      {activeTab === "donations" ? (
        <DonationsTab
          isLoading={isLoading}
          filteredDonations={filteredDonations}
          selectedEventLabel={selectedEventLabel}
          onOpenDonationDetail={openDonationDetailModal}
          onOpenDonationModal={openDonationModal}
          onDeleteDonation={handleDeleteDonation}
        />
      ) : null}

      {activeTab === "transparency" ? (
        <DonorTransparencyTab
          portalData={portalData}
          selectedEventLabel={selectedEventLabel}
        />
      ) : null}

      {canManageDonations ? (
        <DonationNeedModal
          isOpen={isNeedModalOpen}
          formValues={needForm}
          inventoryItems={inventoryItems}
          disasterEvents={disasterEvents}
          isSubmitting={isNeedSubmitting}
          errorMessage={needErrorMessage}
          onClose={closeNeedModal}
          onChange={(fieldName, value) =>
            setNeedForm((currentValues) => ({
              ...currentValues,
              [fieldName]: value,
            }))
          }
          onSubmit={submitDonationNeed}
        />
      ) : null}

      {canManageDonations ? (
        <DonationModal
          isOpen={isDonationModalOpen}
          formValues={donationForm}
          itemDraft={donationItemDraft}
          inventoryItems={inventoryItems}
          disasterEvents={disasterEvents}
          isSubmitting={isDonationSubmitting}
          errorMessage={donationErrorMessage}
          itemErrorMessage={donationItemErrorMessage}
          editingItemId={editingDonationItemId}
          onClose={closeDonationModal}
          onFormChange={(fieldName, value) =>
            setDonationForm((currentValues) => ({
              ...currentValues,
              [fieldName]: value,
            }))
          }
          onItemDraftChange={(fieldName, value) =>
            setDonationItemDraft((currentValues) => ({
              ...currentValues,
              [fieldName]: value,
            }))
          }
          onAddItemDraft={donationForm.id ? addExistingDonationItem : addDraftDonationItem}
          onEditExistingItem={saveExistingDonationItem}
          onDeleteExistingItem={removeExistingDonationItem}
          onRemoveDraftItem={removeDraftDonationItem}
          onStartEditItem={startEditDonationItem}
          onCancelEditItem={cancelEditDonationItem}
          onSubmit={submitDonation}
        />
      ) : null}

      <ExportModal
        isOpen={isTransparencyExportModalOpen}
        title="Export Donation Report"
        description="Choose the donation report and file format to generate."
        reportOptions={[
          {
            value: "DONATION_TRANSPARENCY_SUMMARY",
            label: "Donation Transparency Summary",
          },
        ]}
        formatOptions={COMMON_EXPORT_FORMAT_OPTIONS}
        selectedReportType="DONATION_TRANSPARENCY_SUMMARY"
        selectedFormat={selectedTransparencyExportFormat}
        isSubmitting={Boolean(isExportingTransparency)}
        onReportTypeChange={() => {}}
        onFormatChange={setSelectedTransparencyExportFormat}
        onClose={() => {
          if (!isExportingTransparency) {
            setIsTransparencyExportModalOpen(false);
          }
        }}
        onSubmit={() => handleExportTransparency(selectedTransparencyExportFormat)}
      />

      <FeedbackToast
        type={exportFeedback.type}
        message={exportFeedback.message}
        onClose={() => setExportFeedback({ type: "", message: "" })}
      />

      <DonationDetailModal
        isOpen={isDonationDetailModalOpen}
        isLoading={isDonationDetailLoading}
        errorMessage={donationDetailErrorMessage}
        detail={selectedDonationDetail}
        onClose={() => {
          setIsDonationDetailModalOpen(false);
          setSelectedDonationDetail(null);
          setDonationDetailErrorMessage("");
        }}
      />
    </>
  );
};

export default DonationManagementPage;
