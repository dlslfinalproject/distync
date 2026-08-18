import React from "react";
import { FiEdit2 } from "react-icons/fi";
import DetailsModalShell from "../shared/DetailsModalShell";
import EmptyState from "../shared/EmptyState";
import ErrorState from "../shared/ErrorState";
import LoadingState from "../shared/LoadingState";
import { shellStyles } from "../layout/BarangayLayout";
import {
  formatNumericValue,
  formatUnitOfMeasurement,
} from "../../features/inventory-items/inventoryItemFormatting";

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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "16px",
  },
  itemInfoGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(300px, 2.4fr) repeat(3, minmax(110px, 0.8fr))",
    gap: "16px",
    alignItems: "start",
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
  },
  list: {
    display: "grid",
    gap: "12px",
  },
  listItem: {
    borderRadius: "14px",
    border: "1px solid #d9e5f0",
    backgroundColor: "#eef5fb",
    padding: "14px 16px",
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
  actionCell: {
    textAlign: "center",
    verticalAlign: "middle",
  },
  actionButton: {
    border: "1px solid #c6d8ea",
    borderRadius: "12px",
    width: "36px",
    height: "36px",
    padding: 0,
    backgroundColor: "#f8fbfe",
    color: "#2a4c6f",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
};

const formatDate = (value) => {
  if (!value) {
    return "--";
  }

  const normalizedValue =
    typeof value === "string" ? value.slice(0, 10) : value;
  const parsedDate = new Date(`${normalizedValue}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getTodayDate = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

const normalizeCalendarDate = (value) => {
  if (!value) {
    return null;
  }

  const normalizedValue =
    typeof value === "string" ? value.slice(0, 10) : value;
  const parsedDate = new Date(`${normalizedValue}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
};

const getBatchStatus = (batch) => {
  const quantityAvailable = Number(batch?.quantity_available || 0);
  const expirationDate = normalizeCalendarDate(batch?.expiration_date);
  const today = getTodayDate();

  if (quantityAvailable <= 0) {
    return "Depleted";
  }

  if (expirationDate && expirationDate.getTime() <= today.getTime()) {
    return "Expired";
  }

  if (expirationDate) {
    const daysUntilExpiration =
      (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntilExpiration > 0 && daysUntilExpiration <= 30) {
      return "Near Expiry";
    }
  }

  return "Available";
};

const getBatchStatusStyle = (status) => {
  if (status === "Near Expiry") {
    return {
      backgroundColor: "#ffedd5",
      color: "#c2410c",
    };
  }

  if (status === "Expired") {
    return {
      backgroundColor: "#fee2e2",
      color: "#b91c1c",
    };
  }

  if (status === "Depleted") {
    return {
      backgroundColor: "#e5e7eb",
      color: "#4b5563",
    };
  }

  return {
    backgroundColor: "#dcfce7",
    color: "#166534",
  };
};

const formatSourceLabel = (sourceType) => {
  const normalizedSourceType = String(sourceType || "").trim().toUpperCase();

  if (!normalizedSourceType) {
    return "Malvar LGU";
  }

  if (normalizedSourceType === "DONATED") {
    return "Donor";
  }

  return "Malvar LGU";
};

const getTotalStockOnHand = (batches) => {
  return batches.reduce((sum, batch) => {
    return sum + Number(batch?.quantity_available || 0);
  }, 0);
};

const getStockFormKey = (stockForm) => {
  return stockForm?.id || `${stockForm?.barcode || "no-barcode"}-${stockForm?.packaging || "packaging"}`;
};

const getNormalizedSourceType = (value) =>
  String(value || "").trim().toUpperCase();

const isDonationOnlyOriginItem = (item, batches = []) => {
  if (!item || batches.length === 0) {
    return false;
  }

  return batches.every((batch) => getNormalizedSourceType(batch?.source_type) === "DONATED");
};

const getReorderLevelDisplayValue = (item, batches = []) => {
  if (item?.low_stock_threshold !== null && item?.low_stock_threshold !== undefined) {
    return item.low_stock_threshold;
  }

  if (item?.reorder_level !== null && item?.reorder_level !== undefined) {
    return item.reorder_level;
  }

  return isDonationOnlyOriginItem(item, batches) ? "Not Yet Required" : "--";
};

const getSortableTimestamp = (value) => {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const parsedValue = new Date(value).getTime();
  return Number.isNaN(parsedValue) ? Number.POSITIVE_INFINITY : parsedValue;
};

const InventoryItemDetailModal = ({
  isOpen,
  isLoading,
  errorMessage,
  detail,
  onEditBatch,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  const item = detail?.item || null;
  const stockForms = Array.isArray(detail?.stock_forms) ? detail.stock_forms : [];
  const batches = Array.isArray(detail?.related_batches)
    ? [...detail.related_batches].sort((leftBatch, rightBatch) => {
        return (
          getSortableTimestamp(leftBatch?.received_at || leftBatch?.created_at) -
          getSortableTimestamp(rightBatch?.received_at || rightBatch?.created_at)
        );
      })
    : [];
  const totalStockOnHand = formatNumericValue(getTotalStockOnHand(batches));

  return (
    <DetailsModalShell
      isOpen={isOpen}
      title="View Details"
      onClose={onClose}
      maxWidth="980px"
      closeMode="icon"
      titleStyle={{ fontSize: "30px", fontWeight: 700 }}
      panelStyle={modalStyles.shellPanel}
      overlayClassName="inventory-item-detail-modal-backdrop"
      panelClassName="inventory-item-detail-modal"
    >
      {isLoading ? (
        <LoadingState message="Loading item details..." />
      ) : errorMessage ? (
        <ErrorState compact message={errorMessage} />
      ) : !item ? (
        <EmptyState compact message="Item details are unavailable." />
      ) : (
        <div style={{ display: "grid", gap: "20px" }}>
          <section className="inventory-item-detail-section" style={modalStyles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Item Information</h3>

            <div
              className="inventory-item-detail-info-grid"
              style={{ ...modalStyles.itemInfoGrid, marginTop: "16px" }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={modalStyles.label}>Item Name</p>
                <p style={modalStyles.value}>{item.item_name || "--"}</p>
              </div>
              <div>
                <p style={modalStyles.label}>Category</p>
                <p style={modalStyles.value}>{item.category || "--"}</p>
              </div>
              <div>
                <p style={modalStyles.label}>Total Stock</p>
                <p style={modalStyles.value}>
                  {totalStockOnHand} {item.unit_of_measure || "pc"}
                </p>
              </div>
              <div>
                <p style={modalStyles.label}>Reorder Level</p>
                <p style={modalStyles.value}>
                  {getReorderLevelDisplayValue(item, batches)}
                </p>
              </div>
            </div>
          </section>

          <section className="inventory-item-detail-section" style={modalStyles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>
              Stock Forms / Barcode / Packaging Forms
            </h3>

            {stockForms.length === 0 ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                No stock forms are recorded yet.
              </p>
            ) : (
              <div style={{ ...modalStyles.list, marginTop: "16px" }}>
                {stockForms.map((stockForm) => (
                  <div key={getStockFormKey(stockForm)} style={modalStyles.listItem}>
                    <div className="inventory-item-detail-stock-form-grid" style={modalStyles.grid}>
                      <div>
                        <p style={modalStyles.label}>Barcode</p>
                        <p style={modalStyles.value}>{stockForm.barcode || "--"}</p>
                      </div>
                      <div>
                        <p style={modalStyles.label}>Packaging</p>
                        <p style={modalStyles.value}>{stockForm.packaging || "--"}</p>
                      </div>
                      <div>
                        <p style={modalStyles.label}>Units per Packaging</p>
                        <p style={modalStyles.value}>
                          {stockForm.units_per_packaging ?? "--"}
                        </p>
                      </div>
                      <div>
                        <p style={modalStyles.label}>Unit of Measure</p>
                        <p style={modalStyles.value}>
                          {formatUnitOfMeasurement(stockForm)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="inventory-item-detail-section" style={modalStyles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Batch Information</h3>

            {batches.length === 0 ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                No batches are recorded yet.
              </p>
            ) : (
              <div className="inventory-item-detail-table-scroll" style={modalStyles.tableWrap}>
                <table className="inventory-item-detail-table" style={modalStyles.table}>
                  <thead>
                    <tr>
                      <th style={modalStyles.th}>Batch Number</th>
                      <th style={modalStyles.th}>Stock</th>
                      <th style={modalStyles.th}>Packaging</th>
                      <th style={modalStyles.th}>Expiry Date</th>
                      <th style={modalStyles.th}>Source</th>
                      <th style={modalStyles.th}>Status</th>
                      <th style={modalStyles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => {
                      const batchStatus = getBatchStatus(batch);
                      const batchPackaging =
                        batch.inventory_item_stock_form?.packaging ||
                        batch.stock_form_packaging ||
                        "--";

                      return (
                        <tr key={batch.id}>
                          <td style={modalStyles.td}>{batch.batch_no || "--"}</td>
                          <td style={modalStyles.td}>
                            {formatNumericValue(Number(batch.quantity_available || 0))}{" "}
                            {item.unit_of_measure || "pc"}
                          </td>
                          <td style={modalStyles.td}>{batchPackaging}</td>
                          <td style={modalStyles.td}>
                            {formatDate(batch.expiration_date)}
                          </td>
                          <td style={modalStyles.td}>
                            {formatSourceLabel(batch.source_type)}
                          </td>
                          <td style={modalStyles.td}>
                            <span
                              style={{
                                ...modalStyles.badge,
                                ...getBatchStatusStyle(batchStatus),
                              }}
                            >
                              {batchStatus}
                            </span>
                          </td>
                          <td
                            style={{
                              ...modalStyles.td,
                              ...modalStyles.actionCell,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => onEditBatch?.(batch)}
                              style={modalStyles.actionButton}
                              title="Edit Batch"
                              aria-label="Edit Batch"
                            >
                              <FiEdit2 size={14} />
                            </button>
                          </td>
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

export default InventoryItemDetailModal;
