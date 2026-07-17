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
        { key: "transparency", label: "Transparency Summary" },
      ]
    : [{ key: "transparency", label: "Transparency Summary" }];
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
      }
    : {
        title: "DONATION SUMMARY",
        description:
          "Review donor transparency summaries using live database-backed data.",
      };
};
