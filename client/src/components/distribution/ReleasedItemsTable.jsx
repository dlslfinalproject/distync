import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  headerCell: {
    padding: "14px 12px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "nowrap",
  },
  bodyCell: {
    padding: "14px 12px",
    color: "#21405f",
    borderBottom: "1px solid #edf3f8",
    fontSize: "14px",
    verticalAlign: "top",
  },
  input: {
    width: "100%",
    minHeight: "44px",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid #d2deea",
    boxSizing: "border-box",
    fontSize: "14px",
    color: "#21405f",
    backgroundColor: "#ffffff",
  },
};

const ReleasedItemsTable = ({
  rows,
  inventoryItems,
  inventoryBatches,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
  isDisabled,
  usesTemplateFifo = false,
}) => {
  return (
    <section style={shellStyles.card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "18px",
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: "#17324d" }}>Released Items</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            {usesTemplateFifo
              ? "This relief pack will deduct its configured items automatically using FIFO from the oldest available batches."
              : "Add one or more item rows, then select the matching batch and quantity to release."}
          </p>
        </div>

        {usesTemplateFifo ? null : (
          <button
            type="button"
            onClick={onAddRow}
            disabled={isDisabled}
            style={{
              ...pageHeaderStyles.secondaryButton,
              opacity: isDisabled ? 0.7 : 1,
            }}
          >
            Add Item Row
          </button>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.headerCell}>Inventory Item</th>
              <th style={tableStyles.headerCell}>Batch</th>
              <th style={tableStyles.headerCell}>Quantity</th>
              <th style={tableStyles.headerCell}>
                {usesTemplateFifo ? "FIFO Source" : "Available"}
              </th>
              {usesTemplateFifo ? null : (
                <th style={tableStyles.headerCell}>Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const availableBatches = inventoryBatches.filter((batch) => {
                if (!row.inventory_item_id) {
                  return batch.quantity_available > 0;
                }

                return (
                  batch.inventory_item_id === row.inventory_item_id &&
                  batch.quantity_available > 0
                );
              });

              const selectedBatch =
                inventoryBatches.find((batch) => batch.id === row.inventory_batch_id) ||
                null;

              return (
                <tr key={row.id}>
                  <td style={tableStyles.bodyCell}>
                    {usesTemplateFifo ? (
                      <div>
                        {inventoryItems.find((item) => item.id === row.inventory_item_id)
                          ?.item_name || "--"}
                      </div>
                    ) : (
                      <select
                        value={row.inventory_item_id}
                        onChange={(event) =>
                          onUpdateRow(row.id, "inventory_item_id", event.target.value)
                        }
                        disabled={isDisabled}
                        style={tableStyles.input}
                      >
                        <option value="">Select inventory item</option>
                        {inventoryItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.item_name} ({item.item_code})
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td style={tableStyles.bodyCell}>
                    {usesTemplateFifo ? (
                      <span style={{ color: "#5f7288", fontWeight: 600 }}>
                        Automatic FIFO
                      </span>
                    ) : (
                      <select
                        value={row.inventory_batch_id}
                        onChange={(event) =>
                          onUpdateRow(row.id, "inventory_batch_id", event.target.value)
                        }
                        disabled={isDisabled || !row.inventory_item_id}
                        style={tableStyles.input}
                      >
                        <option value="">Select batch</option>
                        {availableBatches.map((batch) => (
                          <option key={batch.id} value={batch.id}>
                            {batch.batch_no} ({batch.quantity_available} available)
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td style={tableStyles.bodyCell}>
                    {usesTemplateFifo ? (
                      <div>{row.quantity_released}</div>
                    ) : (
                      <input
                        type="number"
                        min="1"
                        value={row.quantity_released}
                        onChange={(event) =>
                          onUpdateRow(row.id, "quantity_released", event.target.value)
                        }
                        disabled={isDisabled}
                        style={tableStyles.input}
                      />
                    )}
                  </td>
                  <td style={tableStyles.bodyCell}>
                    {usesTemplateFifo
                      ? "Oldest available batch first"
                      : selectedBatch
                        ? selectedBatch.quantity_available
                        : "--"}
                  </td>
                  {usesTemplateFifo ? null : (
                    <td style={tableStyles.bodyCell}>
                      <button
                        type="button"
                        onClick={() => onRemoveRow(row.id)}
                        disabled={isDisabled || rows.length === 1}
                        style={{
                          ...pageHeaderStyles.secondaryButton,
                          minWidth: "120px",
                          opacity: isDisabled || rows.length === 1 ? 0.7 : 1,
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ ...shellStyles.mutedText, marginTop: "14px" }}>
        {usesTemplateFifo
          ? "Inventory deduction follows the configured relief pack contents and automatically consumes the oldest eligible stock first."
          : "Choose the exact inventory batch that will be deducted for each released item."}
      </p>
    </section>
  );
};

export default ReleasedItemsTable;
