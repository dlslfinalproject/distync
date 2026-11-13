import { normalizeDonorType } from "./donationFormatters";
import { getDonationTypeKey } from "./donationType";

export const defaultPortalData = {
  disaster_events: [],
  transparency_summary: {
    total_donations_received: 0,
    total_quantity_received: 0,
    total_donated_items_distributed: 0,
    total_donated_items_written_off: 0,
    remaining_donated_inventory: 0,
    total_loose_items_received: 0,
    total_loose_items_remaining: 0,
    total_relief_packs_received: 0,
    total_relief_packs_remaining: 0,
    received_vs_distributed: [],
  },
};

const normalizeDonationEventRow = (eventRow) => {
  if (!eventRow || typeof eventRow !== "object") {
    return null;
  }

  const id = String(eventRow.id || "").trim();
  const title = String(eventRow.title || eventRow.event_name || "").trim();

  if (!id || !title) {
    return null;
  }

  return {
    ...eventRow,
    id,
    title,
  };
};

export const normalizeDonationEventRows = (eventRows) => {
  const rows = Array.isArray(eventRows)
    ? eventRows
    : Array.isArray(eventRows?.data)
      ? eventRows.data
      : [];

  return rows.map(normalizeDonationEventRow).filter(Boolean);
};

export const getDonationSummaryCards = (donations) => {
  const receivedDonations = (Array.isArray(donations) ? donations : []).filter(
    (donation) => String(donation?.status || "").trim().toUpperCase() !== "CANCELLED",
  );
  const uniqueDonors = new Set(
    receivedDonations
      .map((donation) => String(donation?.donor_name || "").trim().toLowerCase())
      .filter(Boolean),
  ).size;
  const looseItemDonations = receivedDonations.filter(
    (donation) => getDonationTypeKey(donation?.items) === "LOOSE_ITEM",
  ).length;
  const reliefPackDonations = receivedDonations.filter(
    (donation) => getDonationTypeKey(donation?.items) === "RELIEF_PACK",
  ).length;

  return [
    {
      label: "Total Donations",
      value: String(receivedDonations.length),
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
};

export const getSelectedActiveDonationEventId = (eventRows, selectedEventId) => {
  const selectedEvent = (Array.isArray(eventRows) ? eventRows : []).find(
    (eventRow) => String(eventRow?.id || "") === String(selectedEventId || ""),
  );
  const normalizedStatus = String(selectedEvent?.status || "")
    .trim()
    .toUpperCase();

  return ["ACTIVE", "ONGOING"].includes(normalizedStatus)
    ? String(selectedEvent.id)
    : "";
};

export const getAvailableDonationTabs = (canManageDonations) => {
  return canManageDonations
    ? [
        { key: "donations", label: "Donations" },
        { key: "transparency", label: "Transparency Summary" },
      ]
    : [{ key: "transparency", label: "Transparency Summary" }];
};

export const filterDonations = (donationsWithSyncStatus, donationSearch) => {
  if (!donationSearch.trim()) {
    return donationsWithSyncStatus;
  }

  const normalizedSearch = donationSearch.trim().toLowerCase();

  return donationsWithSyncStatus.filter((donation) => {
    const items = Array.isArray(donation?.items) ? donation.items : [];

    return [
      donation.donor_name,
      ...items.map((item) => item?.inventory_item?.item_name),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch));
  });
};

export const getDonationTypeLabel = (donation) => {
  return getDonationTypeKey(donation?.items) === "RELIEF_PACK"
    ? "Relief Pack"
    : "Loose Item";
};

export const filterDonationsByType = (donationsWithSyncStatus, donationTypeFilter) => {
  const normalizedFilter = String(donationTypeFilter || "").trim().toUpperCase();

  if (!normalizedFilter) {
    return donationsWithSyncStatus;
  }

  return donationsWithSyncStatus.filter((donation) => {
    const donationTypeLabel = getDonationTypeLabel(donation);
    return String(donationTypeLabel).trim().toUpperCase() === normalizedFilter;
  });
};

export const filterDonationsByDonorTypes = (
  donationsWithSyncStatus,
  donorTypeFilters = [],
) => {
  const normalizedFilters = Array.isArray(donorTypeFilters)
    ? donorTypeFilters
        .map((value) => String(value || "").trim().toUpperCase())
        .filter(Boolean)
    : [];

  if (normalizedFilters.length === 0) {
    return donationsWithSyncStatus;
  }

  return donationsWithSyncStatus.filter((donation) =>
    normalizedFilters.includes(normalizeDonorType(donation?.donor_type)),
  );
};

export const sortDonations = (donationsWithSyncStatus, sortOrder = "newest") => {
  const rows = Array.isArray(donationsWithSyncStatus)
    ? [...donationsWithSyncStatus]
    : [];

  const getTimestamp = (donation) => {
    const parsedTimestamp = new Date(
      donation?.received_at || donation?.created_at || 0,
    ).getTime();
    return Number.isNaN(parsedTimestamp) ? 0 : parsedTimestamp;
  };

  if (sortOrder === "oldest") {
    return rows.sort((leftDonation, rightDonation) =>
      getTimestamp(leftDonation) - getTimestamp(rightDonation),
    );
  }

  if (sortOrder === "az") {
    return rows.sort((leftDonation, rightDonation) =>
      String(leftDonation?.donor_name || "").localeCompare(
        String(rightDonation?.donor_name || ""),
        undefined,
        { sensitivity: "base" },
      ),
    );
  }

  if (sortOrder === "za") {
    return rows.sort((leftDonation, rightDonation) =>
      String(rightDonation?.donor_name || "").localeCompare(
        String(leftDonation?.donor_name || ""),
        undefined,
        { sensitivity: "base" },
      ),
    );
  }

  return rows.sort((leftDonation, rightDonation) =>
    getTimestamp(rightDonation) - getTimestamp(leftDonation),
  );
};

export const getSelectedDonationEventLabel = (disasterEvents, selectedEventId) => {
  const matchedEvent = disasterEvents.find(
    (event) => String(event.id) === String(selectedEventId),
  );
  return matchedEvent ? matchedEvent.title : "All disaster events";
};

export const getDonationPageMeta = (canManageDonations) => {
  return canManageDonations
    ? {
        title: "DONATION MANAGEMENT",
      }
    : {
        title: "DONATION SUMMARY",
        description:
          "Review donor transparency summaries using live database-backed data.",
      };
};
