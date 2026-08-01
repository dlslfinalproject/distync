import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import PageHeader from "../components/layout/PageHeader";
import { shellStyles } from "../components/layout/BarangayLayout";
import DonationFilters from "../components/donations/DonationFilters";
import DonationPageStatus from "../components/donations/DonationPageStatus";
import DonationPageTabs from "../components/donations/DonationPageTabs";
import DonationModal from "../components/donations/DonationModal";
import DonationsTab from "../components/donations/DonationsTab";
import DonationDetailModal from "../components/donations/DonationDetailModal";
import DonorTransparencyTab from "../components/donations/DonorTransparencyTab";
import ConfirmationModal from "../components/shared/ConfirmationModal";
import ExportModal from "../components/shared/ExportModal";
import FeedbackToast from "../components/shared/FeedbackToast";
import StatusCard from "../components/shared/StatusCard";
import { fetchAllDisasterEvents } from "../features/disaster-events/disasterEventService";
import { fetchInventoryItems } from "../features/inventory-items/inventoryItemService";
import {
  exportDonationTransparencySummary,
  fetchDonationPortalData,
  fetchDonations,
} from "../features/donations/donationService";
import { mergeDonationsWithSyncStatus } from "../features/donations/donationSync";
import {
  defaultPortalData,
  filterDonations,
  filterDonationsByDonorTypes,
  filterDonationsByType,
  getAvailableDonationTabs,
  getDonationTypeLabel,
  getDonationPageMeta,
  getSelectedDonationEventLabel,
  sortDonations,
} from "../features/donations/donationPageUi";
import { useDonationManagementModals } from "../features/donations/useDonationManagementModals";
import { useAuth } from "../context/AuthContext";
import db from "../offline/db";
import { subscribeToSyncUpdates } from "../offline/syncService";
import { getVisibleSyncQueueEntries } from "../offline/syncQueue";
import {
  buildExportSuccessMessage,
  COMMON_EXPORT_FORMAT_OPTIONS,
  downloadExportFile,
  NO_EXPORT_DATA_MESSAGE,
  resolveExportErrorMessage,
} from "../utils/exportHelpers";
import {
  formatDonationDateTime,
  formatDonorType,
} from "../features/donations/donationFormatters";

const getDonationItemSummary = (donation) => {
  const items = donation.items || [];

  if (items.length === 0) {
    return {
      label: "--",
      quantityLabel: "0",
    };
  }

  const reliefPackRemarks = items
    .map((item) => item.remarks || "")
    .filter((remarks) => remarks.startsWith("Relief Pack:"));

  if (reliefPackRemarks.length === items.length) {
    const reliefPackLabel = reliefPackRemarks[0]
      .replace("Relief Pack:", "")
      .split(".")[0]
      .trim();
    const packQuantity = reliefPackLabel.match(/\sx\s(\d+)$/i)?.[1];
    const reliefPackName = reliefPackLabel.replace(/\sx\s\d+$/i, "").trim();

    return {
      label: reliefPackName || "Relief Pack",
      quantityLabel: packQuantity
        ? `${packQuantity} relief pack(s)`
        : `${donation.total_quantity_received} item unit(s)`,
    };
  }

  if (items.length === 1) {
    return {
      label: items[0].inventory_item?.item_name || "Inventory item",
      quantityLabel: `${items[0].quantity_received} ${
        items[0].inventory_item?.unit_of_measure || "unit(s)"
      }`,
    };
  }

  return {
    label: `${items.length} donated item entries`,
    quantityLabel: `${donation.total_quantity_received} item unit(s)`,
  };
};

const escapeCsvValue = (value) => {
  const normalizedValue = String(value ?? "");
  const escapedValue = normalizedValue.replace(/"/g, "\"\"");
  return `"${escapedValue}"`;
};

const buildDonationCsv = (rows) => {
  const headers = ["Donor", "Donor Type", "Item", "Quantity", "Date", "Sync"];
  const lines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((donation) => {
      const itemSummary = getDonationItemSummary(donation);

      return [
        donation.donor_name || "--",
        formatDonorType(donation.donor_type, donation.donor_type_other),
        itemSummary.label,
        itemSummary.quantityLabel,
        formatDonationDateTime(donation.received_at),
        donation.sync_status || "--",
      ]
        .map(escapeCsvValue)
        .join(",");
    }),
  ];

  return lines.join("\n");
};

const donationEventSummaryStyles = {
  selectorCard: {
    ...shellStyles.card,
    padding: "24px",
  },
  selectorGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr)",
    gap: "18px",
  },
  selectorLabel: {
    display: "block",
    marginBottom: "8px",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  selectorInput: {
    width: "100%",
    minHeight: "46px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid #cfddeb",
    boxSizing: "border-box",
    fontSize: "14px",
    color: "#1f3b57",
    backgroundColor: "#f8fbfe",
  },
  overviewSection: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
  },
};

const DonationManagementPage = () => {
  const { currentRole } = useAuth();
  const canManageDonations = currentRole === "MAYOR";
  const availableTabs = getAvailableDonationTabs(canManageDonations);

  const [activeTab, setActiveTab] = useState(
    canManageDonations ? "donations" : "transparency",
  );
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [donations, setDonations] = useState([]);
  const [portalData, setPortalData] = useState(defaultPortalData);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [donationSearch, setDonationSearch] = useState("");
  const [donationTypeFilter, setDonationTypeFilter] = useState("");
  const [donationToolbarFilters, setDonationToolbarFilters] = useState({
    sortOrder: "newest",
    donorTypes: [],
  });
  const [transparencyItemSearch, setTransparencyItemSearch] = useState("");
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
    useLiveQuery(() => getVisibleSyncQueueEntries(), [], []) || [];

  const loadPageData = async (eventId = selectedEventId) => {
    setIsLoading(true);
    setPageErrorMessage("");

    try {
      const [eventRows, inventoryItemRows] =
        await Promise.all([
          fetchAllDisasterEvents(),
          canManageDonations
            ? fetchInventoryItems({ is_active: true })
            : Promise.resolve([]),
        ]);

      const resolvedEventId = eventId || "";

      const [donationRows, donationPortal] = await Promise.all([
        canManageDonations
          ? fetchDonations({
              disaster_event_id: resolvedEventId || undefined,
              search: donationSearch || undefined,
            })
          : Promise.resolve([]),
        fetchDonationPortalData({
          disaster_event_id: resolvedEventId || undefined,
        }),
      ]);

      setDisasterEvents(Array.isArray(eventRows) ? eventRows : []);
      setInventoryItems(Array.isArray(inventoryItemRows) ? inventoryItemRows : []);
      setDonations(Array.isArray(donationRows) ? donationRows : []);
      setPortalData(donationPortal || defaultPortalData);
    } catch (error) {
      setPageErrorMessage(error.message || "Failed to load donation management data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageDonations) {
      setActiveTab("transparency");
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

  const donationsWithSyncStatus = useMemo(() => {
    return mergeDonationsWithSyncStatus({
      donations,
      syncQueueEntries,
      selectedEventId,
      inventoryItems,
      disasterEvents,
    });
  }, [disasterEvents, donations, inventoryItems, selectedEventId, syncQueueEntries]);

  const donorSuggestions = useMemo(() => {
    const donorMap = new Map();

    donationsWithSyncStatus.forEach((donation) => {
      const donorName = String(donation?.donor_name || "").trim();

      if (!donorName) {
        return;
      }

      const normalizedDonorName = donorName.toLowerCase();
      const donationTimestamp = new Date(
        donation?.created_at || donation?.received_at || 0,
      ).getTime();
      const normalizedTimestamp = Number.isNaN(donationTimestamp)
        ? Number.POSITIVE_INFINITY
        : donationTimestamp;
      const existingDonorRecord = donorMap.get(normalizedDonorName);

      if (
        !existingDonorRecord ||
        normalizedTimestamp < existingDonorRecord.first_saved_at
      ) {
        donorMap.set(normalizedDonorName, {
          donor_name: donorName,
          donor_type: donation?.donor_type || "INDIVIDUAL",
          donor_type_other: donation?.donor_type_other || "",
          donor_type_label: formatDonorType(
            donation?.donor_type,
            donation?.donor_type_other,
          ),
          first_saved_at: normalizedTimestamp,
        });
      }
    });

    return Array.from(donorMap.values()).sort((leftDonor, rightDonor) =>
      String(leftDonor?.donor_name || "").localeCompare(
        String(rightDonor?.donor_name || ""),
        undefined,
        { sensitivity: "base" },
      ),
    );
  }, [donationsWithSyncStatus]);

  const donationSummaryCards = useMemo(() => {
    const totalDonations = donationsWithSyncStatus.length;
    const uniqueDonors = new Set(
      donationsWithSyncStatus
        .map((donation) => String(donation?.donor_name || "").trim().toLowerCase())
        .filter(Boolean),
    ).size;
    const looseItemDonations = donationsWithSyncStatus.filter(
      (donation) => getDonationTypeLabel(donation) === "Loose Item",
    ).length;
    const reliefPackDonations = donationsWithSyncStatus.filter(
      (donation) => getDonationTypeLabel(donation) === "Relief Pack",
    ).length;

    return [
      {
        label: "Total Donations",
        value: String(totalDonations),
      },
      {
        label: "Total Donors",
        value: String(uniqueDonors),
      },
      {
        label: "Loose Item Donations",
        value: String(looseItemDonations),
      },
      {
        label: "Relief Pack Donations",
        value: String(reliefPackDonations),
      },
    ];
  }, [donationsWithSyncStatus]);

  const filteredDonations = useMemo(() => {
    return sortDonations(
      filterDonationsByDonorTypes(
        filterDonationsByType(
          filterDonations(donationsWithSyncStatus, donationSearch),
          donationTypeFilter,
        ),
        donationToolbarFilters.donorTypes,
      ),
      donationToolbarFilters.sortOrder,
    );
  }, [
    donationsWithSyncStatus,
    donationSearch,
    donationTypeFilter,
    donationToolbarFilters.donorTypes,
    donationToolbarFilters.sortOrder,
  ]);

  const selectedEventLabel = useMemo(() => {
    return getSelectedDonationEventLabel(disasterEvents, selectedEventId);
  }, [disasterEvents, selectedEventId]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) {
      return null;
    }

    return disasterEvents.find((eventRow) => eventRow.id === selectedEventId) || null;
  }, [disasterEvents, selectedEventId]);

  const {
    deleteConfirmation,
    isDeleteSubmitting,
    isDonationModalOpen,
    isDonationDetailModalOpen,
    isDonationDetailLoading,
    donationDetailErrorMessage,
    selectedDonationDetail,
    donationForm,
    donationErrorMessage,
    donationFieldErrors,
    donationItemErrorMessage,
    isDonationItemBarcodeLookupLoading,
    donationItemFieldErrors,
    isDonationSubmitting,
    donationItemDraft,
    editingDonationItemId,
    handleDonationFormChange,
    handleDonationItemDraftChange,
    handleReliefPackDraftItemChange,
    handleSelectExistingInventoryItem,
    clearSelectedExistingInventoryItem,
    openDonationModal,
    closeDonationModal,
    openDonationDetailModal,
    closeDonationDetailModal,
    submitDonation,
    addDraftDonationItem,
    addPackItemToDraft,
    removePackItemFromDraft,
    startEditDonationItem,
    cancelEditDonationItem,
    saveExistingDonationItem,
    removeDraftDonationItem,
    addExistingDonationItem,
    handleCancelDeleteConfirmation,
    handleConfirmDelete,
  } = useDonationManagementModals({
    selectedEventId,
    inventoryItems,
    donorSuggestions,
    loadPageData,
    setSuccessMessage,
    setPageErrorMessage,
    setExportFeedback,
  });

  const downloadFile = (file) => {
    downloadExportFile(file);
  };

  const handleDonationToolbarFilterChange = (fieldName, fieldValue) => {
    setDonationToolbarFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: fieldValue,
    }));
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

  const handleExportDonations = () => {
    setPageErrorMessage("");
    setSuccessMessage("");

    if (filteredDonations.length === 0) {
      setExportFeedback({
        type: "error",
        message: NO_EXPORT_DATA_MESSAGE,
      });
      return;
    }

    try {
      const csvContent = buildDonationCsv(filteredDonations);
      const eventLabel = selectedEventLabel
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
      const file = {
        blob: new Blob([csvContent], { type: "text/csv;charset=utf-8;" }),
        filename: `donations-${eventLabel || "all-events"}.csv`,
      };

      downloadFile(file);
      setExportFeedback({
        type: "success",
        message: buildExportSuccessMessage("Donation records"),
      });
    } catch (error) {
      setExportFeedback({
        type: "error",
        message: resolveExportErrorMessage(
          error,
          "Failed to export donation records.",
        ),
      });
    }
  };

  const pageMeta = getDonationPageMeta(canManageDonations);

  return (
    <>
      <PageHeader title={pageMeta.title} description={pageMeta.description} />

      <section style={donationEventSummaryStyles.selectorCard}>
        <div style={donationEventSummaryStyles.selectorGrid}>
          <div>
            <label
              htmlFor="donation-management-page-disaster-event"
              style={donationEventSummaryStyles.selectorLabel}
            >
              Disaster Event
            </label>
            <select
              id="donation-management-page-disaster-event"
              value={selectedEventId}
              onChange={(event) => {
                const nextEventId = event.target.value;
                setSelectedEventId(nextEventId);
                loadPageData(nextEventId);
              }}
              style={donationEventSummaryStyles.selectorInput}
            >
              <option value="">All disaster events</option>
              {disasterEvents.map((eventRow) => (
                <option key={eventRow.id} value={eventRow.id}>
                  {eventRow.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {activeTab === "donations" ? (
        <section style={donationEventSummaryStyles.overviewSection}>
          {donationSummaryCards.map((card) => (
            <StatusCard
              key={card.label}
              label={card.label}
              value={card.value}
            />
          ))}
        </section>
      ) : null}

      <DonationFilters
        activeTab={activeTab}
        canManageDonations={canManageDonations}
        selectedEventId={selectedEventId}
        disasterEvents={disasterEvents}
        donationSearch={donationSearch}
        donationTypeFilter={donationTypeFilter}
        donationToolbarFilters={donationToolbarFilters}
        onSelectedEventChange={(nextEventId) => {
          setSelectedEventId(nextEventId);
          loadPageData(nextEventId);
        }}
        onDonationSearchChange={setDonationSearch}
        onDonationTypeFilterChange={setDonationTypeFilter}
        onDonationToolbarFilterChange={handleDonationToolbarFilterChange}
        onOpenDonationModal={() => openDonationModal()}
        onExportDonations={handleExportDonations}
        isExportingTransparency={isExportingTransparency}
        onOpenTransparencyExport={() => {
          setSelectedTransparencyExportFormat("csv");
          setExportFeedback({ type: "", message: "" });
          setIsTransparencyExportModalOpen(true);
        }}
        showEventSelector={false}
        showTransparencyActions={false}
      />

      <section style={shellStyles.card}>
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

      {activeTab === "donations" ? (
        <DonationsTab
          isLoading={isLoading}
          filteredDonations={filteredDonations}
          showDisasterEventColumn={!selectedEventId}
          selectedEventLabel={selectedEventLabel}
          onOpenDonationDetail={openDonationDetailModal}
          onOpenDonationModal={openDonationModal}
        />
      ) : null}

      {activeTab === "transparency" ? (
        <DonorTransparencyTab
          portalData={portalData}
          selectedEventLabel={selectedEventLabel}
          selectedEvent={selectedEvent}
          itemSearch={transparencyItemSearch}
          onItemSearchChange={setTransparencyItemSearch}
        />
      ) : null}

      {canManageDonations ? (
        <DonationModal
          isOpen={isDonationModalOpen}
          formValues={donationForm}
          itemDraft={donationItemDraft}
          inventoryItems={inventoryItems}
          donorSuggestions={donorSuggestions}
          disasterEvents={disasterEvents}
          isSubmitting={isDonationSubmitting}
          errorMessage={donationErrorMessage}
          fieldErrors={donationFieldErrors}
          itemErrorMessage={donationItemErrorMessage}
          isBarcodeLookupLoading={isDonationItemBarcodeLookupLoading}
          itemFieldErrors={donationItemFieldErrors}
          editingItemId={editingDonationItemId}
          onClose={closeDonationModal}
          onFormChange={handleDonationFormChange}
          onItemDraftChange={handleDonationItemDraftChange}
          onReliefPackDraftItemChange={handleReliefPackDraftItemChange}
          onSelectExistingInventoryItem={handleSelectExistingInventoryItem}
          onClearSelectedExistingInventoryItem={clearSelectedExistingInventoryItem}
          onAddItemDraft={donationForm.id ? addExistingDonationItem : addDraftDonationItem}
          onEditExistingItem={saveExistingDonationItem}
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
        onClose={closeDonationDetailModal}
      />
    </>
  );
};

export default DonationManagementPage;
