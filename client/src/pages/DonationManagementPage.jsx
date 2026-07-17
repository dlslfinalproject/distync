import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import PageHeader from "../components/layout/PageHeader";
import { shellStyles } from "../components/layout/BarangayLayout";
import DonationFilters from "../components/donations/DonationFilters";
import DonationPageStatus from "../components/donations/DonationPageStatus";
import DonationPageTabs from "../components/donations/DonationPageTabs";
import DonationModal from "../components/donations/DonationModal";
import DonationNeedModal from "../components/donations/DonationNeedModal";
import DonationNeedsTab from "../components/donations/DonationNeedsTab";
import DonationsTab from "../components/donations/DonationsTab";
import DonationDetailModal from "../components/donations/DonationDetailModal";
import DonorTransparencyTab from "../components/donations/DonorTransparencyTab";
import ConfirmationModal from "../components/shared/ConfirmationModal";
import ExportModal from "../components/shared/ExportModal";
import FeedbackToast from "../components/shared/FeedbackToast";
import { fetchAllDisasterEvents } from "../features/disaster-events/disasterEventService";
import { fetchInventoryItems } from "../features/inventory-items/inventoryItemService";
import {
  fetchReliefPackTemplateById,
  fetchReliefPackTemplates,
} from "../features/relief-pack-templates/reliefPackTemplateService";
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
  createDonationForm,
  createDonationItemForm,
  createNeedForm,
} from "../features/donations/donationUi";
import {
  defaultPortalData,
  filterDonationNeeds,
  filterDonations,
  getAvailableDonationTabs,
  getDonationPageMeta,
  getSelectedDonationEventLabel,
} from "../features/donations/donationPageUi";
import { useDonationManagementModals } from "../features/donations/useDonationManagementModals";
import { useAuth } from "../context/AuthContext";
import db from "../offline/db";
import { subscribeToSyncUpdates } from "../offline/syncService";
import {
  buildExportSuccessMessage,
  COMMON_EXPORT_FORMAT_OPTIONS,
  downloadExportFile,
  NO_EXPORT_DATA_MESSAGE,
  resolveExportErrorMessage,
} from "../utils/exportHelpers";

const DonationManagementPage = () => {
  const { currentRole } = useAuth();
  const canManageDonations = currentRole === "MAYOR";
  const availableTabs = getAvailableDonationTabs(canManageDonations);

  const [activeTab, setActiveTab] = useState(
    canManageDonations ? "donations" : "needs",
  );
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [reliefPackTemplates, setReliefPackTemplates] = useState([]);
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

  const syncQueueEntries =
    useLiveQuery(() => db.syncQueue.toArray(), [], []) || [];

  const loadPageData = async (eventId = selectedEventId) => {
    setIsLoading(true);
    setPageErrorMessage("");

    try {
      const [
        eventRows,
        inventoryItemRows,
        reliefPackTemplateRows,
        donationNeedRows,
        donationRows,
        donationPortal,
      ] =
        await Promise.all([
          fetchAllDisasterEvents(),
          canManageDonations
            ? fetchInventoryItems({ is_active: true })
            : Promise.resolve([]),
          canManageDonations
            ? fetchReliefPackTemplates({ is_active: "true" })
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
      const activeReliefPackTemplates = Array.isArray(reliefPackTemplateRows)
        ? await Promise.all(
            reliefPackTemplateRows.map((template) =>
              fetchReliefPackTemplateById(template.id).catch(() => template),
            ),
          )
        : [];
      setReliefPackTemplates(activeReliefPackTemplates);
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
    return filterDonationNeeds(donationNeedsWithSyncStatus, needSearch);
  }, [donationNeedsWithSyncStatus, needSearch]);

  const filteredDonations = useMemo(() => {
    return filterDonations(donationsWithSyncStatus, donationSearch);
  }, [donationsWithSyncStatus, donationSearch]);

  const selectedEventLabel = useMemo(() => {
    return getSelectedDonationEventLabel(disasterEvents, selectedEventId);
  }, [disasterEvents, selectedEventId]);

  const {
    deleteConfirmation,
    isDeleteSubmitting,
    isNeedModalOpen,
    needForm,
    needErrorMessage,
    isNeedSubmitting,
    isDonationModalOpen,
    isDonationDetailModalOpen,
    isDonationDetailLoading,
    donationDetailErrorMessage,
    selectedDonationDetail,
    donationForm,
    donationErrorMessage,
    donationItemErrorMessage,
    isDonationSubmitting,
    donationItemDraft,
    editingDonationItemId,
    setNeedForm,
    setDonationForm,
    setDonationItemDraft,
    openNeedModal,
    closeNeedModal,
    openDonationModal,
    closeDonationModal,
    openDonationDetailModal,
    submitDonationNeed,
    submitDonation,
    addDraftDonationItem,
    addPackItemToDraft,
    removePackItemFromDraft,
    startEditDonationItem,
    cancelEditDonationItem,
    saveExistingDonationItem,
    removeDraftDonationItem,
    removeExistingDonationItem,
    addExistingDonationItem,
    handleDeleteDonationNeed,
    handleDeleteDonation,
    handleCancelDeleteConfirmation,
    handleConfirmDelete,
  } = useDonationManagementModals({
    selectedEventId,
    inventoryItems,
    reliefPackTemplates,
    loadPageData,
    setSuccessMessage,
    setPageErrorMessage,
    setExportFeedback,
  });

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

  const pageMeta = getDonationPageMeta(canManageDonations);

  return (
    <>
      <PageHeader title={pageMeta.title} description={pageMeta.description} />

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

        <DonationPageTabs
          availableTabs={availableTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <DonationPageStatus
          successMessage={successMessage}
          errorMessage={pageErrorMessage}
        />
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
          reliefPackTemplates={reliefPackTemplates}
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
          onAddPackItemDraft={addPackItemToDraft}
          onRemovePackItemDraft={removePackItemFromDraft}
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

      <ConfirmationModal
        isOpen={Boolean(deleteConfirmation)}
        title={deleteConfirmation?.title || "Confirm Delete"}
        message={deleteConfirmation?.message || ""}
        confirmLabel={deleteConfirmation?.confirmLabel || "Delete"}
        isSubmitting={isDeleteSubmitting}
        confirmButtonStyle={{
          background: "#b91c1c",
          borderColor: "#b91c1c",
        }}
        onCancel={handleCancelDeleteConfirmation}
        onConfirm={handleConfirmDelete}
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
