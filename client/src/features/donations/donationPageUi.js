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
    received_vs_distributed: [],
  },
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
  const matchedEvent = disasterEvents.find((event) => event.id === selectedEventId);
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
