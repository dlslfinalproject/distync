const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const handleJsonResponse = async (response, fallbackMessage) => {
  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseData?.message || fallbackMessage);
  }

  return responseData;
};

const fetchActiveDisasterEvents = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/disaster-events/active`);
  return handleJsonResponse(response, "Failed to fetch active disaster events");
};

const fetchMasterlist = async (disasterEventId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/masterlist?disaster_event_id=${disasterEventId}`,
  );

  return handleJsonResponse(response, "Failed to fetch masterlist summary");
};

const fetchInventoryBatches = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/inventory-batches`);
  return handleJsonResponse(response, "Failed to fetch inventory batches");
};

const fetchInventoryTransactions = async () => {
  const response = await fetch(`${API_BASE_URL}/api/v1/inventory-transactions`);
  return handleJsonResponse(response, "Failed to fetch inventory transactions");
};

const buildSectorSummary = (households) => {
  const counts = new Map();

  households.forEach((household) => {
    (household.household_sectors || []).forEach((sector) => {
      counts.set(sector.name, (counts.get(sector.name) || 0) + 1);
    });

    (household.members || []).forEach((member) => {
      (member.sectors || []).forEach((sector) => {
        counts.set(sector.name, (counts.get(sector.name) || 0) + 1);
      });
    });
  });

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
};

const buildBarangaySummary = (households) => {
  const counts = new Map();

  households.forEach((household) => {
    const barangayName = household.barangay?.name || "Unknown";
    const evacueeCount = household.members?.length || household.household_size || 0;

    counts.set(barangayName, (counts.get(barangayName) || 0) + evacueeCount);
  });

  return [...counts.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((left, right) => right.total - left.total);
};

const buildLowStockSummary = (batches) => {
  return batches
    .filter(
      (batch) =>
        batch.status === "LOW_STOCK" ||
        (batch.quantity_available > 0 && batch.quantity_available <= 10),
    )
    .map((batch) => ({
      id: batch.id,
      batch_no: batch.batch_no,
      item_name: batch.inventory_item?.item_name || "--",
      quantity_available: batch.quantity_available,
      status: batch.status,
    }))
    .sort((left, right) => left.quantity_available - right.quantity_available)
    .slice(0, 8);
};

export const fetchDescriptiveAnalytics = async () => {
  const activeEvents = await fetchActiveDisasterEvents();
  const activeDisasterEvent = activeEvents?.[0] || null;

  if (!activeDisasterEvent) {
    return {
      activeDisasterEvent: null,
      summaryCards: [],
      barangaySummary: [],
      commonSectors: [],
      lowStockItems: [],
      totalDistributions: null,
    };
  }

  const [masterlist, inventoryBatches, inventoryTransactions] = await Promise.all([
    fetchMasterlist(activeDisasterEvent.id),
    fetchInventoryBatches(),
    fetchInventoryTransactions(),
  ]);

  const households = masterlist.data || [];
  const totalHouseholds = masterlist.count || 0;
  const totalEvacuees = households.reduce((sum, household) => {
    return sum + (household.members?.length || household.household_size || 0);
  }, 0);

  const distributionLinkedTransactions = (inventoryTransactions || []).filter(
    (transaction) => transaction.reference_type === "DISTRIBUTION",
  );

  return {
    activeDisasterEvent,
    summaryCards: [
      {
        label: "Total Households",
        value: totalHouseholds,
        helperText: "Registered households from the active disaster event.",
      },
      {
        label: "Total Evacuees",
        value: totalEvacuees,
        helperText: "Combined evacuee count from the current masterlist.",
      },
      {
        label: "Total Distributions",
        value: distributionLinkedTransactions.length,
        helperText:
          "Based on currently available inventory transactions tagged as DISTRIBUTION.",
      },
    ],
    barangaySummary: buildBarangaySummary(households),
    commonSectors: buildSectorSummary(households),
    lowStockItems: buildLowStockSummary(inventoryBatches || []),
    totalDistributions: distributionLinkedTransactions.length,
  };
};
