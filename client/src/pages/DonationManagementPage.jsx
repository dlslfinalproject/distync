import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FiX } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../components/layout/PageHeader";
import { shellStyles } from "../components/layout/BarangayLayout";
import DonationFilters from "../components/donations/DonationFilters";
import DonationPageStatus from "../components/donations/DonationPageStatus";
import DonationPageTabs from "../components/donations/DonationPageTabs";
import DonationModal from "../components/donations/DonationModal";
import DonationsTab from "../components/donations/DonationsTab";
import DonationDetailModal from "../components/donations/DonationDetailModal";
import DonationDonorNameVisibilityModal from "../components/donations/DonationDonorNameVisibilityModal";
import DonorTransparencyTab from "../components/donations/DonorTransparencyTab";
import ConfirmationModal from "../components/shared/ConfirmationModal";
import FeedbackToast from "../components/shared/FeedbackToast";
import StatusCard from "../components/shared/StatusCard";
import { fetchAllDisasterEvents } from "../features/disaster-events/disasterEventService";
import { fetchInventoryItems } from "../features/inventory-items/inventoryItemService";
import {
  exportDonationTransparencySummary,
  exportReceivedDonationsReport,
  fetchDonationPortalData,
  fetchDonations,
  reassignLeftoverDonationStock,
  updateDonationPublicName,
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
import db from "../offline/db.js";
import { subscribeToSyncUpdates } from "../offline/syncService";
import { getVisibleSyncQueueEntries } from "../offline/syncQueue";
import {
  buildExportSuccessMessage,
  COMMON_EXPORT_FORMAT_OPTIONS,
  downloadExportFile,
  NO_EXPORT_DATA_MESSAGE,
  resolveExportErrorMessage,
} from "../utils/exportHelpers";
import { formatDonorType } from "../features/donations/donationFormatters";

const formatSummaryNumber = (value) =>
  new Intl.NumberFormat().format(Number(value || 0));

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

const parsePerFamilyAllocationRemark = (remarks) => {
  const matchedRemark = String(remarks || "")
    .trim()
    .match(/^Per Family Allocation:\s*(\d+)$/i);

  return Number(matchedRemark?.[1] || 0);
};

const isReliefPackDonationRemark = (remarks) =>
  String(remarks || "").trim().toLowerCase().startsWith("relief pack:");

const isExpiredDate = (value) => {
  if (!value) {
    return false;
  }

  const expirationDate = new Date(value);

  if (Number.isNaN(expirationDate.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expirationDate.setHours(0, 0, 0, 0);

  return expirationDate < today;
};

const getDonationLeftoverItems = (donation) => {
  return (donation?.items || [])
    .filter((item) => {
      const inventoryBatch = item?.inventory_batch || {};
      const quantityAvailable = Number(inventoryBatch.quantity_available || 0);
      const batchStatus = String(inventoryBatch.status || "").toUpperCase();
      const perFamilyAllocation = parsePerFamilyAllocationRemark(item?.remarks);

      return (
        quantityAvailable > 0 &&
        perFamilyAllocation > 0 &&
        !isReliefPackDonationRemark(item?.remarks) &&
        ["AVAILABLE", "LOW_STOCK"].includes(batchStatus) &&
        !isExpiredDate(inventoryBatch.expiration_date)
      );
    })
    .map((item) => ({
      ...item,
      quantity_available: Number(item?.inventory_batch?.quantity_available || 0),
      per_family_allocation: parsePerFamilyAllocationRemark(item?.remarks),
    }));
};

const canReassignDonationLeftoverStock = (donation) => {
  const status = String(donation?.disaster_event?.status || "").toUpperCase();
  return (
    ["CLOSED", "ARCHIVED"].includes(status) &&
    getDonationLeftoverItems(donation).length > 0
  );
};

const exportFilterStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(23, 50, 77, 0.42)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1500,
  },
  modal: {
    width: "min(760px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    backgroundColor: "#ffffff",
    borderRadius: "24px",
    boxShadow: "0 24px 54px rgba(31, 64, 95, 0.22)",
    padding: "28px",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "20px",
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "26px",
    fontWeight: 800,
  },
  closeButton: {
    border: "1px solid #c6d8ea",
    borderRadius: "14px",
    width: "42px",
    height: "42px",
    backgroundColor: "#f8fbfe",
    color: "#24496e",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  detailsCard: {
    ...shellStyles.card,
    marginBottom: "18px",
  },
  detailsTitle: {
    margin: "0 0 14px",
    color: "#17324d",
    fontSize: "18px",
    fontWeight: 800,
  },
  firstRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 2fr) minmax(180px, 1fr)",
    gap: "16px",
    alignItems: "start",
    marginBottom: "16px",
  },
  secondRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "16px",
    alignItems: "start",
  },
  field: {
    display: "grid",
    gap: "8px",
  },
  label: {
    display: "block",
    color: "#48627d",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  select: {
    width: "100%",
    minHeight: "48px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid #cbdbea",
    boxSizing: "border-box",
    fontSize: "14px",
    color: "#17324d",
    backgroundColor: "#f8fbfe",
    outline: "none",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    flexWrap: "wrap",
  },
};

const donationExportDonationTypeOptions = [
  { value: "", label: "All" },
  { value: "LOOSE_ITEM", label: "Loose Item" },
  { value: "RELIEF_PACK", label: "Relief Pack" },
];

const donationExportDonorTypeOptions = [
  { value: "", label: "All" },
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "NGO", label: "NGO" },
  { value: "PRIVATE_ORGANIZATION", label: "Private Organization" },
  { value: "GOVERNMENT_PARTNER", label: "Government Partner" },
  { value: "OTHER", label: "Other" },
];

const donationExportSortOptions = [
  { value: "newest", label: "Newest-Oldest" },
  { value: "oldest", label: "Oldest-Newest" },
  { value: "az", label: "A-Z by Donor" },
  { value: "za", label: "Z-A by Donor" },
];

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
  const [transparencySearch, setTransparencySearch] = useState("");
  const [transparencyToolbarFilters, setTransparencyToolbarFilters] = useState({
    sortOrder: "newest",
    movements: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isDonationExportModalOpen, setIsDonationExportModalOpen] =
    useState(false);
  const [selectedDonationExportFormat, setSelectedDonationExportFormat] =
    useState("csv");
  const [donationExportFilters, setDonationExportFilters] = useState({
    disaster_event_id: "",
    donation_type: "",
    donor_type: "",
    sort_order: "newest",
  });
  const [isExportingDonations, setIsExportingDonations] = useState("");
  const [isExportingTransparency, setIsExportingTransparency] = useState("");
  const [isTransparencyExportModalOpen, setIsTransparencyExportModalOpen] =
    useState(false);
  const [selectedTransparencyExportFormat, setSelectedTransparencyExportFormat] =
    useState("csv");
  const [transparencyExportFilters, setTransparencyExportFilters] = useState({
    disaster_event_id: "",
    sort_order: "newest",
  });
  const [exportFeedback, setExportFeedback] = useState({
    type: "",
    message: "",
  });
  const [reassignModal, setReassignModal] = useState({
    isOpen: false,
    donation: null,
    leftoverItems: [],
    donationItemId: "",
    targetDisasterEventId: "",
    quantity: "",
    perFamilyAllocation: "",
    errorMessage: "",
    fieldErrors: {},
    isSubmitting: false,
  });
  const [donorNameVisibilityModal, setDonorNameVisibilityModal] = useState({
    isOpen: false,
    donation: null,
    errorMessage: "",
    isSubmitting: false,
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

  const transparencySummaryCards = useMemo(() => {
    const transparencySummary = portalData.transparency_summary || {};

    return [
      {
        label: "Total Donations Received",
        value: formatSummaryNumber(transparencySummary.total_donations_received),
      },
      {
        label: "Total Quantity Received",
        value: formatSummaryNumber(transparencySummary.total_quantity_received),
      },
      {
        label: "Total Donated Items Distributed",
        value: formatSummaryNumber(
          transparencySummary.total_donated_items_distributed,
        ),
      },
      {
        label: "Remaining Donated Inventory",
        value: formatSummaryNumber(transparencySummary.remaining_donated_inventory),
      },
    ];
  }, [portalData]);

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
    ).map((donation) => ({
      ...donation,
      can_reassign_leftover_stock: canReassignDonationLeftoverStock(donation),
    }));
  }, [
    donationsWithSyncStatus,
    donationSearch,
    donationTypeFilter,
    donationToolbarFilters.donorTypes,
    donationToolbarFilters.sortOrder,
  ]);

  const filteredTransparencyRows = useMemo(() => {
    const transparencyRows =
      portalData.transparency_summary?.received_vs_distributed || [];
    const normalizedSearch = transparencySearch.trim().toLowerCase();
    const selectedMovements = Array.isArray(transparencyToolbarFilters.movements)
      ? transparencyToolbarFilters.movements
      : [];

    const matchesSearch = (row) => {
      if (!normalizedSearch) {
        return true;
      }

      const writeOffReasonText = (row.write_off_reasons || [])
        .map((reasonRow) => reasonRow.reason)
        .join(" ");

      return [
        row.donor_name,
        row.item_name,
        row.disaster_event_title,
        writeOffReasonText,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    };

    const matchesMovement = (row) => {
      if (selectedMovements.length === 0) {
        return true;
      }

      return selectedMovements.some((movement) => {
        if (movement === "has_distributed") {
          return Number(row.quantity_distributed || 0) > 0;
        }

        if (movement === "has_write_off") {
          return Number(row.quantity_written_off || 0) > 0;
        }

        if (movement === "has_remaining") {
          return Number(row.quantity_remaining || 0) > 0;
        }

        if (movement === "no_remaining") {
          return Number(row.quantity_remaining || 0) === 0;
        }

        return false;
      });
    };

    const getTimestamp = (row) => {
      const timestamp = new Date(row.received_at || 0).getTime();
      return Number.isNaN(timestamp) ? 0 : timestamp;
    };

    const filteredRows = transparencyRows.filter(
      (row) => matchesSearch(row) && matchesMovement(row),
    );

    return filteredRows.sort((leftRow, rightRow) => {
      switch (transparencyToolbarFilters.sortOrder) {
        case "oldest":
          return getTimestamp(leftRow) - getTimestamp(rightRow);
        case "az":
          return String(leftRow.donor_name || "").localeCompare(
            String(rightRow.donor_name || ""),
          );
        case "za":
          return String(rightRow.donor_name || "").localeCompare(
            String(leftRow.donor_name || ""),
          );
        case "newest":
        default:
          return getTimestamp(rightRow) - getTimestamp(leftRow);
      }
    });
  }, [
    portalData,
    transparencySearch,
    transparencyToolbarFilters.movements,
    transparencyToolbarFilters.sortOrder,
  ]);

  const getReassignTargetEvents = (sourceDonation) => {
    return disasterEvents.filter((eventRow) => {
      const status = String(eventRow?.status || "").toUpperCase();

      return (
        eventRow?.id &&
        String(eventRow.id) !== String(sourceDonation?.disaster_event_id) &&
        !["CLOSED", "ARCHIVED"].includes(status)
      );
    });
  };

  const getSelectedReassignItem = () => {
    return (
      reassignModal.leftoverItems.find(
        (item) => String(item.id) === String(reassignModal.donationItemId),
      ) || null
    );
  };

  const openReassignLeftoverStockModal = (donation) => {
    const leftoverItems = getDonationLeftoverItems(donation);
    const targetEvents = getReassignTargetEvents(donation);
    const firstItem = leftoverItems[0] || null;

    setReassignModal({
      isOpen: true,
      donation,
      leftoverItems,
      donationItemId: firstItem?.id || "",
      targetDisasterEventId: targetEvents[0]?.id || "",
      quantity: firstItem?.quantity_available
        ? String(firstItem.quantity_available)
        : "",
      perFamilyAllocation: firstItem?.per_family_allocation
        ? String(firstItem.per_family_allocation)
        : "",
      errorMessage: "",
      fieldErrors: {},
      isSubmitting: false,
    });
  };

  const closeReassignLeftoverStockModal = () => {
    if (reassignModal.isSubmitting) {
      return;
    }

    setReassignModal({
      isOpen: false,
      donation: null,
      leftoverItems: [],
      donationItemId: "",
      targetDisasterEventId: "",
      quantity: "",
      perFamilyAllocation: "",
      errorMessage: "",
      fieldErrors: {},
      isSubmitting: false,
    });
  };

  const handleReassignFieldChange = (fieldName, value) => {
    setReassignModal((currentValues) => {
      const nextValues = {
        ...currentValues,
        [fieldName]: value,
        errorMessage: "",
        fieldErrors: {
          ...currentValues.fieldErrors,
          [fieldName]: "",
        },
      };

      if (fieldName === "donationItemId") {
        const selectedItem =
          currentValues.leftoverItems.find(
            (item) => String(item.id) === String(value),
          ) || null;

        nextValues.quantity = selectedItem?.quantity_available
          ? String(selectedItem.quantity_available)
          : "";
        nextValues.perFamilyAllocation = selectedItem?.per_family_allocation
          ? String(selectedItem.per_family_allocation)
          : "";
      }

      return nextValues;
    });
  };

  const validateReassignForm = () => {
    const nextErrors = {};
    const selectedItem = getSelectedReassignItem();
    const quantity = Number(reassignModal.quantity || 0);
    const perFamilyAllocation = Number(reassignModal.perFamilyAllocation || 0);
    const targetEvents = getReassignTargetEvents(reassignModal.donation);

    if (!selectedItem) {
      nextErrors.donationItemId = "Select leftover stock to reassign.";
    }

    if (!reassignModal.targetDisasterEventId) {
      nextErrors.targetDisasterEventId = "Select the target disaster event.";
    } else if (
      !targetEvents.some(
        (eventRow) =>
          String(eventRow.id) === String(reassignModal.targetDisasterEventId),
      )
    ) {
      nextErrors.targetDisasterEventId =
        "Target disaster event must be planned or active.";
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      nextErrors.quantity = "Quantity must be a positive whole number.";
    } else if (selectedItem && quantity > selectedItem.quantity_available) {
      nextErrors.quantity = "Quantity cannot exceed remaining stock.";
    }

    if (!Number.isInteger(perFamilyAllocation) || perFamilyAllocation <= 0) {
      nextErrors.perFamilyAllocation =
        "Per family allocation must be a positive whole number.";
    } else if (quantity > 0 && perFamilyAllocation > quantity) {
      nextErrors.perFamilyAllocation =
        "Per family allocation cannot exceed reassigned quantity.";
    }

    return nextErrors;
  };

  const submitReassignLeftoverStock = async (event) => {
    event.preventDefault();

    const fieldErrors = validateReassignForm();

    if (Object.values(fieldErrors).some(Boolean)) {
      setReassignModal((currentValues) => ({
        ...currentValues,
        fieldErrors,
      }));
      return;
    }

    setReassignModal((currentValues) => ({
      ...currentValues,
      isSubmitting: true,
      errorMessage: "",
    }));

    try {
      await reassignLeftoverDonationStock(reassignModal.donationItemId, {
        target_disaster_event_id: reassignModal.targetDisasterEventId,
        quantity: Number(reassignModal.quantity),
        per_family_allocation: Number(reassignModal.perFamilyAllocation),
      });
      await loadPageData(selectedEventId);
      setSuccessMessage("Leftover donated stock reassigned successfully.");
      setReassignModal({
        isOpen: false,
        donation: null,
        leftoverItems: [],
        donationItemId: "",
        targetDisasterEventId: "",
        quantity: "",
        perFamilyAllocation: "",
        errorMessage: "",
        fieldErrors: {},
        isSubmitting: false,
      });
    } catch (error) {
      setReassignModal((currentValues) => ({
        ...currentValues,
        isSubmitting: false,
        errorMessage:
          error.message || "Failed to reassign leftover donated stock.",
      }));
    }
  };

  const openDonorNameVisibilityModal = (donation) => {
    if (!donation?.id || donation.is_local_only) {
      return;
    }

    setDonorNameVisibilityModal({
      isOpen: true,
      donation,
      errorMessage: "",
      isSubmitting: false,
    });
  };

  const closeDonorNameVisibilityModal = () => {
    if (donorNameVisibilityModal.isSubmitting) {
      return;
    }

    setDonorNameVisibilityModal({
      isOpen: false,
      donation: null,
      errorMessage: "",
      isSubmitting: false,
    });
  };

  const confirmDonorNameVisibility = async () => {
    const donation = donorNameVisibilityModal.donation;

    if (!donation?.id || donorNameVisibilityModal.isSubmitting) {
      return;
    }

    const nextDonorNamePublic = donation.donor_name_public !== true;

    setDonorNameVisibilityModal((currentValues) => ({
      ...currentValues,
      isSubmitting: true,
      errorMessage: "",
    }));

    try {
      await updateDonationPublicName(donation.id, nextDonorNamePublic);
      await loadPageData(selectedEventId);
      setSuccessMessage(
        nextDonorNamePublic
          ? "Donor name published on the public donation page."
          : "Donor name hidden from the public donation page.",
      );
      setDonorNameVisibilityModal({
        isOpen: false,
        donation: null,
        errorMessage: "",
        isSubmitting: false,
      });
    } catch (error) {
      setDonorNameVisibilityModal((currentValues) => ({
        ...currentValues,
        isSubmitting: false,
        errorMessage:
          error.message || "Failed to update donor name visibility.",
      }));
    }
  };

  const selectedEventLabel = useMemo(() => {
    return getSelectedDonationEventLabel(disasterEvents, selectedEventId);
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

  const handleTransparencyToolbarFilterChange = (fieldName, fieldValue) => {
    setTransparencyToolbarFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: fieldValue,
    }));
  };

  const handleExportTransparency = async (format) => {
    setPageErrorMessage("");
    setSuccessMessage("");
    setIsTransparencyExportModalOpen(false);

    setIsExportingTransparency(format);

    try {
      const file = await exportDonationTransparencySummary(format, {
        ...transparencyExportFilters,
      });
      downloadFile(file);
      setExportFeedback({
        type: "success",
        message: buildExportSuccessMessage("Donation item transparency report"),
      });
    } catch (error) {
      setExportFeedback({
        type: "error",
        message: resolveExportErrorMessage(
          error,
          "Failed to export donation item transparency report.",
        ),
      });
    } finally {
      setIsExportingTransparency("");
    }
  };

  const handleTransparencyExportFilterChange = (fieldName, fieldValue) => {
    setTransparencyExportFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: fieldValue,
    }));
  };

  const resolveDonationExportType = () => {
    const normalizedDonationType = String(donationTypeFilter || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");

    return ["LOOSE_ITEM", "RELIEF_PACK"].includes(normalizedDonationType)
      ? normalizedDonationType
      : "";
  };

  const openDonationExportModal = () => {
    setPageErrorMessage("");
    setSuccessMessage("");
    setExportFeedback({ type: "", message: "" });

    if (filteredDonations.length === 0) {
      setExportFeedback({
        type: "error",
        message: NO_EXPORT_DATA_MESSAGE,
      });
      return;
    }

    setDonationExportFilters({
      disaster_event_id: selectedEventId,
      donation_type: resolveDonationExportType(),
      donor_type: "",
      sort_order: donationToolbarFilters.sortOrder || "newest",
    });
    setSelectedDonationExportFormat("csv");
    setIsDonationExportModalOpen(true);
  };

  const handleDonationExportFilterChange = (fieldName, fieldValue) => {
    setDonationExportFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: fieldValue,
    }));
  };

  const handleExportDonations = async (format) => {
    setPageErrorMessage("");
    setSuccessMessage("");
    setIsDonationExportModalOpen(false);
    setIsExportingDonations(format);

    try {
      const file = await exportReceivedDonationsReport(format, {
        ...donationExportFilters,
        search: donationSearch,
      });
      downloadFile(file);
      setExportFeedback({
        type: "success",
        message: buildExportSuccessMessage("Received donations report"),
      });
    } catch (error) {
      setExportFeedback({
        type: "error",
        message: resolveExportErrorMessage(
          error,
          "Failed to export received donations report.",
        ),
      });
    } finally {
      setIsExportingDonations("");
    }
  };

  const selectedReassignItem = getSelectedReassignItem();
  const reassignTargetEvents = getReassignTargetEvents(reassignModal.donation);
  const selectedReassignItemLabel = selectedReassignItem
    ? `${selectedReassignItem.inventory_item?.item_name || "Donation item"} - ${selectedReassignItem.quantity_available} ${selectedReassignItem.inventory_item?.unit_of_measure || "unit(s)"} remaining`
    : "";
  const pageMeta = getDonationPageMeta(canManageDonations);

  return (
    <div className="mayor-donation-management-page">
      <PageHeader title={pageMeta.title} description={pageMeta.description} />

      <section
        className="mayor-donation-management-event-card"
        style={donationEventSummaryStyles.selectorCard}
      >
        <div
          className="mayor-donation-management-event-grid"
          style={donationEventSummaryStyles.selectorGrid}
        >
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
        <section
          className="mayor-donation-management-summary-grid"
          style={donationEventSummaryStyles.overviewSection}
        >
          {donationSummaryCards.map((card) => (
            <StatusCard
              key={card.label}
              label={card.label}
              value={card.value}
            />
          ))}
        </section>
      ) : null}

      {activeTab === "transparency" ? (
        <section
          className="mayor-donation-management-summary-grid"
          style={donationEventSummaryStyles.overviewSection}
        >
          {transparencySummaryCards.map((card) => (
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
        transparencySearch={transparencySearch}
        transparencyToolbarFilters={transparencyToolbarFilters}
        onSelectedEventChange={(nextEventId) => {
          setSelectedEventId(nextEventId);
          loadPageData(nextEventId);
        }}
        onDonationSearchChange={setDonationSearch}
        onDonationTypeFilterChange={setDonationTypeFilter}
        onDonationToolbarFilterChange={handleDonationToolbarFilterChange}
        onTransparencySearchChange={setTransparencySearch}
        onTransparencyToolbarFilterChange={handleTransparencyToolbarFilterChange}
        onOpenDonationModal={() => openDonationModal()}
        onExportDonations={openDonationExportModal}
        isExportingTransparency={isExportingTransparency}
        onOpenTransparencyExport={() => {
          setSelectedTransparencyExportFormat("csv");
          setTransparencyExportFilters({
            disaster_event_id: selectedEventId,
            sort_order: transparencyToolbarFilters.sortOrder || "newest",
          });
          setExportFeedback({ type: "", message: "" });
          setIsTransparencyExportModalOpen(true);
        }}
        showEventSelector={false}
        showTransparencyActions
      />

      <section className="mayor-donation-management-tabs-card" style={shellStyles.card}>
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
          onOpenDonorNameVisibility={openDonorNameVisibilityModal}
        />
      ) : null}

      {activeTab === "transparency" ? (
        <DonorTransparencyTab
          portalData={portalData}
          transparencyRows={filteredTransparencyRows}
          showDisasterEventColumn={!selectedEventId}
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
          portalData={portalData}
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

      <DonationDonorNameVisibilityModal
        isOpen={donorNameVisibilityModal.isOpen}
        donation={donorNameVisibilityModal.donation}
        isSubmitting={donorNameVisibilityModal.isSubmitting}
        errorMessage={donorNameVisibilityModal.errorMessage}
        onCancel={closeDonorNameVisibilityModal}
        onConfirm={confirmDonorNameVisibility}
      />

      {reassignModal.isOpen ? (
        <div
          className="mayor-donation-management-export-modal-backdrop"
          style={exportFilterStyles.overlay}
        >
          <form
            onSubmit={submitReassignLeftoverStock}
            className="mayor-donation-management-export-modal"
            style={exportFilterStyles.modal}
          >
            <div
              className="mayor-donation-management-export-modal-topbar"
              style={exportFilterStyles.header}
            >
              <div>
                <h3 style={exportFilterStyles.title}>Reassign Leftover Stock</h3>
                <p style={{ ...shellStyles.mutedText, margin: "8px 0 0" }}>
                  Create a new donation record for another disaster event using
                  the remaining donated stock from this closed event.
                </p>
              </div>
              <button
                type="button"
                onClick={closeReassignLeftoverStockModal}
                disabled={reassignModal.isSubmitting}
                style={exportFilterStyles.closeButton}
                aria-label="Close reassign leftover stock modal"
              >
                <FiX size={20} />
              </button>
            </div>

            <section style={exportFilterStyles.detailsCard}>
              <h4 style={exportFilterStyles.detailsTitle}>Source Donation</h4>
              <div
                className="mayor-donation-management-export-grid"
                style={exportFilterStyles.secondRow}
              >
                <div>
                  <p style={exportFilterStyles.label}>Donor</p>
                  <p style={{ margin: "6px 0 0", color: "#17324d" }}>
                    {reassignModal.donation?.donor_name || "--"}
                  </p>
                </div>
                <div>
                  <p style={exportFilterStyles.label}>Source Event</p>
                  <p style={{ margin: "6px 0 0", color: "#17324d" }}>
                    {reassignModal.donation?.disaster_event?.title || "--"}
                  </p>
                </div>
                <div>
                  <p style={exportFilterStyles.label}>Selected Stock</p>
                  <p style={{ margin: "6px 0 0", color: "#17324d" }}>
                    {selectedReassignItemLabel || "--"}
                  </p>
                </div>
              </div>
            </section>

            <section style={exportFilterStyles.detailsCard}>
              <h4 style={exportFilterStyles.detailsTitle}>Reassignment Details</h4>
              {reassignModal.errorMessage ? (
                <p
                  style={{
                    ...shellStyles.errorText,
                    margin: "0 0 14px",
                  }}
                >
                  {reassignModal.errorMessage}
                </p>
              ) : null}
              <div
                className="mayor-donation-management-export-grid"
                style={exportFilterStyles.firstRow}
              >
                <div style={exportFilterStyles.field}>
                  <label
                    htmlFor="reassign-leftover-item"
                    style={exportFilterStyles.label}
                  >
                    Leftover Stock
                  </label>
                  <select
                    id="reassign-leftover-item"
                    value={reassignModal.donationItemId}
                    onChange={(event) =>
                      handleReassignFieldChange("donationItemId", event.target.value)
                    }
                    style={exportFilterStyles.select}
                    disabled={reassignModal.isSubmitting}
                  >
                    {reassignModal.leftoverItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.inventory_item?.item_name || "Donation item"} -{" "}
                        {item.quantity_available}{" "}
                        {item.inventory_item?.unit_of_measure || "unit(s)"}
                      </option>
                    ))}
                  </select>
                  {reassignModal.fieldErrors.donationItemId ? (
                    <p style={shellStyles.errorText}>
                      {reassignModal.fieldErrors.donationItemId}
                    </p>
                  ) : null}
                </div>

                <div style={exportFilterStyles.field}>
                  <label
                    htmlFor="reassign-target-event"
                    style={exportFilterStyles.label}
                  >
                    Target Disaster Event
                  </label>
                  <select
                    id="reassign-target-event"
                    value={reassignModal.targetDisasterEventId}
                    onChange={(event) =>
                      handleReassignFieldChange(
                        "targetDisasterEventId",
                        event.target.value,
                      )
                    }
                    style={exportFilterStyles.select}
                    disabled={reassignModal.isSubmitting}
                  >
                    <option value="">Select disaster event</option>
                    {reassignTargetEvents.map((eventRow) => (
                      <option key={eventRow.id} value={eventRow.id}>
                        {eventRow.title}
                      </option>
                    ))}
                  </select>
                  {reassignModal.fieldErrors.targetDisasterEventId ? (
                    <p style={shellStyles.errorText}>
                      {reassignModal.fieldErrors.targetDisasterEventId}
                    </p>
                  ) : null}
                </div>
              </div>

              <div
                className="mayor-donation-management-export-grid"
                style={exportFilterStyles.secondRow}
              >
                <div style={exportFilterStyles.field}>
                  <label
                    htmlFor="reassign-quantity"
                    style={exportFilterStyles.label}
                  >
                    Quantity to Reassign
                  </label>
                  <input
                    id="reassign-quantity"
                    type="number"
                    min="1"
                    step="1"
                    max={selectedReassignItem?.quantity_available || undefined}
                    value={reassignModal.quantity}
                    onChange={(event) =>
                      handleReassignFieldChange("quantity", event.target.value)
                    }
                    style={exportFilterStyles.select}
                    disabled={reassignModal.isSubmitting}
                  />
                  {reassignModal.fieldErrors.quantity ? (
                    <p style={shellStyles.errorText}>
                      {reassignModal.fieldErrors.quantity}
                    </p>
                  ) : null}
                </div>

                <div style={exportFilterStyles.field}>
                  <label
                    htmlFor="reassign-per-family-allocation"
                    style={exportFilterStyles.label}
                  >
                    Per Family Allocation
                  </label>
                  <input
                    id="reassign-per-family-allocation"
                    type="number"
                    min="1"
                    step="1"
                    max={reassignModal.quantity || undefined}
                    value={reassignModal.perFamilyAllocation}
                    onChange={(event) =>
                      handleReassignFieldChange(
                        "perFamilyAllocation",
                        event.target.value,
                      )
                    }
                    style={exportFilterStyles.select}
                    disabled={reassignModal.isSubmitting}
                  />
                  {reassignModal.fieldErrors.perFamilyAllocation ? (
                    <p style={shellStyles.errorText}>
                      {reassignModal.fieldErrors.perFamilyAllocation}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <div
              className="mayor-donation-management-export-actions"
              style={exportFilterStyles.actions}
            >
              <button
                type="button"
                onClick={closeReassignLeftoverStockModal}
                disabled={reassignModal.isSubmitting}
                style={pageHeaderStyles.secondaryButton}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reassignModal.isSubmitting}
                style={pageHeaderStyles.primaryButton}
              >
                {reassignModal.isSubmitting ? "Reassigning..." : "Reassign Stock"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isDonationExportModalOpen ? (
        <div
          className="mayor-donation-management-export-modal-backdrop"
          style={exportFilterStyles.overlay}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleExportDonations(selectedDonationExportFormat);
            }}
            className="mayor-donation-management-export-modal"
            style={exportFilterStyles.modal}
          >
            <div
              className="mayor-donation-management-export-modal-topbar"
              style={exportFilterStyles.header}
            >
              <h3 style={exportFilterStyles.title}>Received Donations Report</h3>
              <button
                type="button"
                onClick={() => {
                  if (!isExportingDonations) {
                    setIsDonationExportModalOpen(false);
                  }
                }}
                disabled={Boolean(isExportingDonations)}
                style={exportFilterStyles.closeButton}
                aria-label="Close received donations report export modal"
              >
                <FiX size={20} />
              </button>
            </div>

            <section style={exportFilterStyles.detailsCard}>
              <h4 style={exportFilterStyles.detailsTitle}>Export Details</h4>
              <div
                className="mayor-donation-management-export-grid"
                style={exportFilterStyles.firstRow}
              >
                <div style={exportFilterStyles.field}>
                  <label
                    htmlFor="received-donations-export-event"
                    style={exportFilterStyles.label}
                  >
                    Disaster Event
                  </label>
                  <select
                    id="received-donations-export-event"
                    value={donationExportFilters.disaster_event_id}
                    onChange={(event) =>
                      handleDonationExportFilterChange(
                        "disaster_event_id",
                        event.target.value,
                      )
                    }
                    style={exportFilterStyles.select}
                    disabled={Boolean(isExportingDonations)}
                  >
                    <option value="">All disaster events</option>
                    {disasterEvents.map((eventRow) => (
                      <option key={eventRow.id} value={eventRow.id}>
                        {eventRow.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={exportFilterStyles.field}>
                  <label
                    htmlFor="received-donations-export-type"
                    style={exportFilterStyles.label}
                  >
                    Donation Type
                  </label>
                  <select
                    id="received-donations-export-type"
                    value={donationExportFilters.donation_type}
                    onChange={(event) =>
                      handleDonationExportFilterChange(
                        "donation_type",
                        event.target.value,
                      )
                    }
                    style={exportFilterStyles.select}
                    disabled={Boolean(isExportingDonations)}
                  >
                    {donationExportDonationTypeOptions.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                className="mayor-donation-management-export-grid"
                style={exportFilterStyles.secondRow}
              >
                <div style={exportFilterStyles.field}>
                  <label
                    htmlFor="received-donations-export-donor-type"
                    style={exportFilterStyles.label}
                  >
                    Donor Type
                  </label>
                  <select
                    id="received-donations-export-donor-type"
                    value={donationExportFilters.donor_type}
                    onChange={(event) =>
                      handleDonationExportFilterChange(
                        "donor_type",
                        event.target.value,
                      )
                    }
                    style={exportFilterStyles.select}
                    disabled={Boolean(isExportingDonations)}
                  >
                    {donationExportDonorTypeOptions.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={exportFilterStyles.field}>
                  <label
                    htmlFor="received-donations-export-order"
                    style={exportFilterStyles.label}
                  >
                    Order List
                  </label>
                  <select
                    id="received-donations-export-order"
                    value={donationExportFilters.sort_order}
                    onChange={(event) =>
                      handleDonationExportFilterChange(
                        "sort_order",
                        event.target.value,
                      )
                    }
                    style={exportFilterStyles.select}
                    disabled={Boolean(isExportingDonations)}
                  >
                    {donationExportSortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={exportFilterStyles.field}>
                  <label
                    htmlFor="received-donations-export-format"
                    style={exportFilterStyles.label}
                  >
                    Format
                  </label>
                  <select
                    id="received-donations-export-format"
                    value={selectedDonationExportFormat}
                    onChange={(event) =>
                      setSelectedDonationExportFormat(event.target.value)
                    }
                    style={exportFilterStyles.select}
                    disabled={Boolean(isExportingDonations)}
                  >
                    {COMMON_EXPORT_FORMAT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <div
              className="mayor-donation-management-export-actions"
              style={exportFilterStyles.actions}
            >
              <button
                type="button"
                onClick={() => setIsDonationExportModalOpen(false)}
                disabled={Boolean(isExportingDonations)}
                style={pageHeaderStyles.secondaryButton}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Boolean(isExportingDonations)}
                style={{
                  ...pageHeaderStyles.primaryButton,
                  opacity: isExportingDonations ? 0.7 : 1,
                  cursor: isExportingDonations ? "not-allowed" : "pointer",
                }}
              >
                {isExportingDonations ? "Exporting..." : "Export"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isTransparencyExportModalOpen ? (
        <div
          className="mayor-donation-management-export-modal-backdrop"
          style={exportFilterStyles.overlay}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleExportTransparency(selectedTransparencyExportFormat);
            }}
            className="mayor-donation-management-export-modal"
            style={exportFilterStyles.modal}
          >
            <div
              className="mayor-donation-management-export-modal-topbar"
              style={exportFilterStyles.header}
            >
              <h3 style={exportFilterStyles.title}>
                Donation Item Transparency Report
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (!isExportingTransparency) {
                    setIsTransparencyExportModalOpen(false);
                  }
                }}
                disabled={Boolean(isExportingTransparency)}
                style={exportFilterStyles.closeButton}
                aria-label="Close donation item transparency report export modal"
              >
                <FiX size={20} />
              </button>
            </div>

            <section style={exportFilterStyles.detailsCard}>
              <h4 style={exportFilterStyles.detailsTitle}>Export Details</h4>
              <div
                className="mayor-donation-management-export-grid"
                style={exportFilterStyles.secondRow}
              >
                <div style={exportFilterStyles.field}>
                  <label
                    htmlFor="transparency-export-event"
                    style={exportFilterStyles.label}
                  >
                    Disaster Event
                  </label>
                  <select
                    id="transparency-export-event"
                    value={transparencyExportFilters.disaster_event_id}
                    onChange={(event) =>
                      handleTransparencyExportFilterChange(
                        "disaster_event_id",
                        event.target.value,
                      )
                    }
                    style={exportFilterStyles.select}
                    disabled={Boolean(isExportingTransparency)}
                  >
                    <option value="">All disaster events</option>
                    {disasterEvents.map((eventRow) => (
                      <option key={eventRow.id} value={eventRow.id}>
                        {eventRow.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={exportFilterStyles.field}>
                  <label
                    htmlFor="transparency-export-order"
                    style={exportFilterStyles.label}
                  >
                    Order List
                  </label>
                  <select
                    id="transparency-export-order"
                    value={transparencyExportFilters.sort_order}
                    onChange={(event) =>
                      handleTransparencyExportFilterChange(
                        "sort_order",
                        event.target.value,
                      )
                    }
                    style={exportFilterStyles.select}
                    disabled={Boolean(isExportingTransparency)}
                  >
                    {donationExportSortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={exportFilterStyles.field}>
                  <label
                    htmlFor="transparency-export-format"
                    style={exportFilterStyles.label}
                  >
                    Format
                  </label>
                  <select
                    id="transparency-export-format"
                    value={selectedTransparencyExportFormat}
                    onChange={(event) =>
                      setSelectedTransparencyExportFormat(event.target.value)
                    }
                    style={exportFilterStyles.select}
                    disabled={Boolean(isExportingTransparency)}
                  >
                    {COMMON_EXPORT_FORMAT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <div
              className="mayor-donation-management-export-actions"
              style={exportFilterStyles.actions}
            >
              <button
                type="button"
                onClick={() => setIsTransparencyExportModalOpen(false)}
                disabled={Boolean(isExportingTransparency)}
                style={pageHeaderStyles.secondaryButton}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Boolean(isExportingTransparency)}
                style={{
                  ...pageHeaderStyles.primaryButton,
                  opacity: isExportingTransparency ? 0.7 : 1,
                  cursor: isExportingTransparency ? "not-allowed" : "pointer",
                }}
              >
                {isExportingTransparency ? "Exporting..." : "Export"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

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
    </div>
  );
};

export default DonationManagementPage;
