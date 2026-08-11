import React from "react";
import DetailsModalShell from "../shared/DetailsModalShell";
import EmptyState from "../shared/EmptyState";
import ErrorState from "../shared/ErrorState";
import LoadingState from "../shared/LoadingState";
import { shellStyles } from "../layout/BarangayLayout";
import { formatDonorType } from "../../features/donations/donationFormatters";

const modalStyles = {
  shellPanel: {
    backgroundColor: "#eef5fb",
    border: "1px solid #d7e2ef",
    boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  },
  sectionCard: {
    ...shellStyles.card,
    backgroundColor: "#ffffff",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    alignItems: "start",
  },
  itemCard: {
    borderRadius: "14px",
    border: "1px solid #d9e5f0",
    backgroundColor: "#eef5fb",
    padding: "14px 16px",
  },
  label: {
    margin: 0,
    color: "#66809c",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  value: {
    margin: "8px 0 0",
    color: "#21405f",
    fontSize: "15px",
    lineHeight: 1.55,
    wordBreak: "break-word",
  },
  list: {
    display: "grid",
    gap: "12px",
  },
  tableWrap: {
    overflowX: "auto",
    marginTop: "12px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "760px",
  },
  th: {
    padding: "10px 12px",
    textAlign: "left",
    fontSize: "12px",
    color: "#66809c",
    borderBottom: "1px solid #dfe8f2",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #edf3f8",
    color: "#21405f",
    fontSize: "14px",
    verticalAlign: "top",
  },
  mutedText: {
    margin: "6px 0 0",
    color: "#69839c",
    fontSize: "13px",
    lineHeight: 1.5,
  },
};

const formatDate = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatCategory = (value) => {
  if (!value) {
    return "--";
  }

  const normalizedValue = String(value).trim().toLowerCase();
  return normalizedValue === "non-perishable" ? "Non-Perishable" : "Perishable";
};

const formatQuantityWithUnit = (quantity, unitOfMeasure) => {
  const normalizedQuantity =
    quantity !== null && quantity !== undefined && quantity !== ""
      ? quantity
      : "--";
  const normalizedUnit = unitOfMeasure || "unit(s)";
  return `${normalizedQuantity} ${normalizedUnit}`;
};

const formatPackagingLabel = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (!normalizedValue) {
    return "unit(s)";
  }

  return normalizedValue === "piece" ? "piece" : normalizedValue;
};

const getReliefPackMeta = (remarks) => {
  const normalizedRemarks = String(remarks || "").trim();

  if (!normalizedRemarks.startsWith("Relief Pack:")) {
    return null;
  }

  const packLabel = normalizedRemarks.replace("Relief Pack:", "").split(".")[0].trim();
  const packQuantityMatch = packLabel.match(/\sx\s(\d+)$/i);
  const packQuantity = packQuantityMatch?.[1] ? Number(packQuantityMatch[1]) : null;
  const packName = packLabel.replace(/\sx\s\d+$/i, "").trim() || "Relief Pack";

  return {
    name: packName,
    quantity: packQuantity,
  };
};

const getPerFamilyAllocation = (remarks) => {
  const matchedRemark = String(remarks || "")
    .trim()
    .match(/^Per Family Allocation:\s*(\d+)$/i);

  return matchedRemark?.[1] || "";
};

const buildDonationPresentation = (items) => {
  const normalizedItems = Array.isArray(items) ? items : [];

  if (normalizedItems.length === 0) {
    return {
      donationType: "Loose Item",
      looseItems: [],
      reliefPacks: [],
      totalInventoryQuantity: 0,
      totalItemEntries: 0,
    };
  }

  const reliefPackGroups = new Map();
  const looseItems = [];
  let totalInventoryQuantity = 0;

  normalizedItems.forEach((item) => {
    totalInventoryQuantity += Number(item?.quantity_received || 0);

    const reliefPackMeta = getReliefPackMeta(item?.remarks);
    if (!reliefPackMeta) {
      looseItems.push(item);
      return;
    }

    const packKey = `${reliefPackMeta.name}::${reliefPackMeta.quantity || 0}`;
    const existingGroup = reliefPackGroups.get(packKey);

    if (existingGroup) {
      existingGroup.items.push(item);
      return;
    }

    reliefPackGroups.set(packKey, {
      name: reliefPackMeta.name,
      quantity: reliefPackMeta.quantity || 0,
      items: [item],
    });
  });

  const reliefPacks = Array.from(reliefPackGroups.values());
  const donationType =
    reliefPacks.length > 0 && looseItems.length === 0 ? "Relief Pack" : "Loose Item";

  return {
    donationType,
    looseItems,
    reliefPacks,
    totalInventoryQuantity,
    totalItemEntries: normalizedItems.length,
  };
};

const getQuantityPerPackDisplay = (item, packQuantity) => {
  const normalizedPackQuantity = Number(packQuantity || 0);
  const normalizedItemQuantity = Number(item?.quantity_received || 0);
  const packaging =
    item?.inventory_batch?.stock_form_packaging ||
    item?.inventory_item_stock_form?.packaging ||
    item?.inventory_item?.packaging ||
    "piece";
  const unitsPerPackaging =
    String(packaging).trim().toLowerCase() === "piece"
      ? 1
      : Number(
          item?.inventory_batch?.stock_form_units_per_packaging ||
            item?.inventory_item_stock_form?.units_per_packaging ||
            0,
        ) || 0;

  if (normalizedPackQuantity > 0 && normalizedItemQuantity > 0) {
    const quantityPerReliefPack =
      String(packaging).trim().toLowerCase() === "piece"
        ? normalizedItemQuantity / normalizedPackQuantity
        : normalizedItemQuantity / (normalizedPackQuantity * unitsPerPackaging);
    return `${quantityPerReliefPack} ${formatPackagingLabel(packaging)}`;
  }

  return `-- ${formatPackagingLabel(packaging)}`;
};

const DonationDetailModal = ({
  isOpen,
  isLoading,
  errorMessage,
  detail,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  const donation = detail?.donation || null;
  const items = donation?.items || [];
  const eventTitle = donation?.disaster_event?.title || "--";
  const donationPresentation = buildDonationPresentation(items);
  const shouldShowPerFamilyAllocationColumn =
    donationPresentation.looseItems.length > 0;
  const itemsReceivedRows = shouldShowPerFamilyAllocationColumn
    ? donationPresentation.looseItems
    : items;

  return (
    <DetailsModalShell
      isOpen={isOpen}
      title="View Details"
      onClose={onClose}
      maxWidth="980px"
      closeMode="icon"
      titleStyle={{ fontSize: "30px", fontWeight: 700 }}
      panelStyle={modalStyles.shellPanel}
    >
      {isLoading ? (
        <LoadingState message="Loading donation detail..." />
      ) : errorMessage ? (
        <ErrorState compact message={errorMessage} />
      ) : !donation ? (
        <EmptyState compact message="Donation detail is unavailable." />
      ) : (
        <div style={{ display: "grid", gap: "20px" }}>
          <section style={modalStyles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Donation Information</h3>

            <div style={{ ...modalStyles.infoGrid, marginTop: "16px" }}>
              <div>
                <p style={modalStyles.label}>Donor Name</p>
                <p style={modalStyles.value}>{donation.donor_name || "--"}</p>
              </div>
              <div>
                <p style={modalStyles.label}>Donor Type</p>
                <p style={modalStyles.value}>
                  {formatDonorType(
                    donation.donor_type,
                    donation.donor_type_other,
                  )}
                </p>
              </div>
              <div>
                <p style={modalStyles.label}>Disaster Event</p>
                <p style={modalStyles.value}>{eventTitle}</p>
              </div>
              <div>
                <p style={modalStyles.label}>Received Date</p>
                <p style={modalStyles.value}>{formatDateTime(donation.received_at)}</p>
              </div>
            </div>
          </section>

          <section style={modalStyles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Donation Summary</h3>

            <div style={{ ...modalStyles.infoGrid, marginTop: "16px" }}>
              <div>
                <p style={modalStyles.label}>Donation Type</p>
                <p style={modalStyles.value}>{donationPresentation.donationType}</p>
              </div>
              <div>
                <p style={modalStyles.label}>Donated Item Entries</p>
                <p style={modalStyles.value}>{donationPresentation.totalItemEntries}</p>
              </div>
              <div>
                <p style={modalStyles.label}>Total Inventory Quantity Added</p>
                <p style={modalStyles.value}>{donationPresentation.totalInventoryQuantity}</p>
              </div>
            </div>
          </section>

          {donationPresentation.reliefPacks.length > 0 ? (
            <section style={modalStyles.sectionCard}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Relief Pack Details</h3>

              <div style={{ ...modalStyles.list, marginTop: "16px" }}>
                {donationPresentation.reliefPacks.map((packGroup, index) => (
                  <div key={`${packGroup.name}-${index}`}>
                    <div style={modalStyles.infoGrid}>
                      <div>
                        <p style={modalStyles.label}>Relief Pack Name</p>
                        <p style={modalStyles.value}>{packGroup.name}</p>
                      </div>
                      <div>
                        <p style={modalStyles.label}>Number of Relief Packs Received</p>
                        <p style={modalStyles.value}>{packGroup.quantity || "--"}</p>
                      </div>
                    </div>

                    <div style={modalStyles.tableWrap}>
                      <table style={modalStyles.table}>
                        <thead>
                          <tr>
                            <th style={modalStyles.th}>Item Name</th>
                            <th style={modalStyles.th}>Category</th>
                            <th style={modalStyles.th}>Quantity per Relief Pack</th>
                            <th style={modalStyles.th}>Expiration Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {packGroup.items.map((item) => (
                            <tr key={item.id}>
                              <td style={modalStyles.td}>
                                <div>{item.inventory_item?.item_name || "--"}</div>
                              </td>
                              <td style={modalStyles.td}>
                                {formatCategory(item.inventory_item?.category)}
                              </td>
                              <td style={modalStyles.td}>
                                {getQuantityPerPackDisplay(item, packGroup.quantity)}
                              </td>
                              <td style={modalStyles.td}>
                                {formatDate(
                                  item.inventory_batch?.expiration_date ||
                                    item.expiration_date,
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section style={modalStyles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Items Received</h3>

            {itemsReceivedRows.length === 0 ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                No donation items were recorded.
              </p>
            ) : (
              <div style={modalStyles.tableWrap}>
                <table style={modalStyles.table}>
                  <thead>
                    <tr>
                      <th style={modalStyles.th}>Item Name</th>
                      <th style={modalStyles.th}>Category</th>
                      <th style={modalStyles.th}>Quantity Added</th>
                      <th style={modalStyles.th}>Packaging</th>
                      <th style={modalStyles.th}>Batch Number</th>
                      <th style={modalStyles.th}>Expiration Date</th>
                      {shouldShowPerFamilyAllocationColumn ? (
                        <th style={modalStyles.th}>Per Family Allocation</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {itemsReceivedRows.map((item) => {
                      return (
                        <tr key={item.id}>
                          <td style={modalStyles.td}>
                            <div>{item.inventory_item?.item_name || "--"}</div>
                          </td>
                          <td style={modalStyles.td}>
                            {formatCategory(item.inventory_item?.category)}
                          </td>
                          <td style={modalStyles.td}>
                            {formatQuantityWithUnit(
                              item.quantity_received,
                              item.inventory_item?.unit_of_measure,
                            )}
                          </td>
                          <td style={modalStyles.td}>
                            {item.inventory_batch?.stock_form_packaging ||
                              item.inventory_item_stock_form?.packaging ||
                              "--"}
                          </td>
                          <td style={modalStyles.td}>
                            {item.inventory_batch?.batch_no || "--"}
                          </td>
                          <td style={modalStyles.td}>
                            {formatDate(
                              item.inventory_batch?.expiration_date ||
                                item.expiration_date,
                            )}
                          </td>
                          {shouldShowPerFamilyAllocationColumn ? (
                            <td style={modalStyles.td}>
                              {getPerFamilyAllocation(item.remarks) || "--"}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </DetailsModalShell>
  );
};

export default DonationDetailModal;
