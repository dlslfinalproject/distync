export const INVENTORY_DISTRIBUTION_VIEW_TABS = Object.freeze({
  ACTIVE: "active",
  ENDED: "ended",
});

export const DISASTER_EVENT_STATUSES = Object.freeze({
  ACTIVE: "ACTIVE",
  CLOSED: "CLOSED",
});

export const shouldLoadInventoryDistributionStubDashboard = ({
  activeTab,
  disasterEventStatus,
}) =>
  activeTab === INVENTORY_DISTRIBUTION_VIEW_TABS.ACTIVE &&
  disasterEventStatus === DISASTER_EVENT_STATUSES.ACTIVE;

export const getInventoryDistributionStubDashboardBarangayIds = ({
  activeTab,
  disasterEventStatus,
  selectedBarangayId = "",
  selectableBarangays = [],
}) => {
  if (
    !shouldLoadInventoryDistributionStubDashboard({
      activeTab,
      disasterEventStatus,
    })
  ) {
    return [];
  }

  if (selectedBarangayId) {
    return [selectedBarangayId];
  }

  return selectableBarangays.map((barangay) => barangay?.id).filter(Boolean);
};
