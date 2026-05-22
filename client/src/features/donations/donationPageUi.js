export const defaultPortalData = {
  donation_needs: [],
  transparency_summary: {
    total_donations_received: 0,
    total_quantity_received: 0,
    total_donated_items_distributed: 0,
    remaining_donated_inventory: 0,
    received_vs_distributed: [],
  },
};

export const getAvailableDonationTabs = (canManageDonations) => {
  return canManageDonations
    ? [
        { key: "donations", label: "Donations" },
        { key: "needs", label: "Donation Needs" },
        { key: "transparency", label: "Transparency Summary" },
      ]
    : [
        { key: "needs", label: "Donation Needs" },
        { key: "transparency", label: "Transparency Summary" },
      ];
};

export const filterDonationNeeds = (donationNeedsWithSyncStatus, needSearch) => {
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
};

export const filterDonations = (donationsWithSyncStatus, donationSearch) => {
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
};

export const getSelectedDonationEventLabel = (disasterEvents, selectedEventId) => {
  const matchedEvent = disasterEvents.find((event) => event.id === selectedEventId);
  return matchedEvent ? `${matchedEvent.event_code} - ${matchedEvent.title}` : "All Events";
};

export const getDonationPageMeta = (canManageDonations) => {
  return canManageDonations
    ? {
        title: "DONATION MANAGEMENT",
        description:
          "Manage published donation needs, record received donations, and review donor transparency summaries using live database-backed data.",
      }
    : {
        title: "DONATION SUMMARY",
        description:
          "Review published donation needs and donor transparency summaries using live database-backed data.",
      };
};
