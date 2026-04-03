import React, { useEffect, useState } from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { pageHeaderStyles } from "../layout/PageHeader";

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

const createEmptyItemRow = () => ({
  id: `${Date.now()}-${Math.random()}`,
  inventory_item_id: "",
  quantity_required: 1,
});

const ReliefPackTemplateItemsEditor = ({
  template,
  inventoryItems,
  isSaving,
  errorMessage,
  onSaveItems,
}) => {
  const [draftItems, setDraftItems] = useState([createEmptyItemRow()]);

  useEffect(() => {
    if (!template?.items || template.items.length === 0) {
      setDraftItems([createEmptyItemRow()]);
      return;
    }

    setDraftItems(
      template.items.map((item, index) => ({
        id: item.id || `${Date.now()}-${index}`,
        inventory_item_id: item.inventory_item_id,
        quantity_required: item.quantity_required,
      })),
    );
  }, [template]);

  if (!template) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Template Detail</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Select one relief pack template from the table to view details and edit
          the full item list.
        </p>
      </section>
    );
  }

  const handleItemChange = (rowId, fieldName, fieldValue) => {
    setDraftItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== rowId) {
          return item;
        }

        if (fieldName === "quantity_required") {
          return {
            ...item,
            quantity_required:
              fieldValue === "" ? "" : Number.parseInt(fieldValue, 10),
          };
        }

        return {
          ...item,
          [fieldName]: fieldValue,
        };
      }),
    );
  };

  const handleAddItem = () => {
    setDraftItems((currentItems) => [...currentItems, createEmptyItemRow()]);
  };

  const handleRemoveItem = (rowId) => {
    setDraftItems((currentItems) => currentItems.filter((item) => item.id !== rowId));
  };

  const handleSave = () => {
    onSaveItems({
      items: draftItems.map((item) => ({
        inventory_item_id: item.inventory_item_id,
        quantity_required: item.quantity_required,
      })),
    });
  };

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
          <h3 style={{ margin: 0, color: "#17324d" }}>{template.name}</h3>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            {template.description || "No description provided."}
          </p>
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Family Size Based: {template.based_on_family_size ? "Yes" : "No"} |
            Sector Based: {template.based_on_sector ? "Yes" : "No"} | Active:{" "}
            {template.is_active ? "Yes" : "No"}
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddItem}
          disabled={isSaving}
          style={{
            ...pageHeaderStyles.secondaryButton,
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          Add Item Row
        </button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.headerCell}>Inventory Item</th>
              <th style={tableStyles.headerCell}>Quantity Required</th>
              <th style={tableStyles.headerCell}>Action</th>
            </tr>
          </thead>
          <tbody>
            {draftItems.map((item) => (
              <tr key={item.id}>
                <td style={tableStyles.bodyCell}>
                  <select
                    value={item.inventory_item_id}
                    onChange={(event) =>
                      handleItemChange(
                        item.id,
                        "inventory_item_id",
                        event.target.value,
                      )
                    }
                    style={tableStyles.input}
                  >
                    <option value="">Select inventory item</option>
                    {inventoryItems.map((inventoryItem) => (
                      <option key={inventoryItem.id} value={inventoryItem.id}>
                        {inventoryItem.item_name} ({inventoryItem.item_code})
                      </option>
                    ))}
                  </select>
                </td>
                <td style={tableStyles.bodyCell}>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity_required}
                    onChange={(event) =>
                      handleItemChange(
                        item.id,
                        "quantity_required",
                        event.target.value,
                      )
                    }
                    style={tableStyles.input}
                  />
                </td>
                <td style={tableStyles.bodyCell}>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    disabled={isSaving || draftItems.length === 1}
                    style={{
                      ...pageHeaderStyles.secondaryButton,
                      opacity: isSaving || draftItems.length === 1 ? 0.7 : 1,
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {errorMessage ? (
        <div
          style={{
            marginTop: "18px",
            padding: "14px 16px",
            borderRadius: "14px",
            backgroundColor: "#fff3f1",
            border: "1px solid #f1d2cc",
            color: "#9d4d58",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "12px",
          flexWrap: "wrap",
          marginTop: "20px",
        }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          style={{
            ...pageHeaderStyles.primaryButton,
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? "Saving Items..." : "Replace Item List"}
        </button>
      </div>
    </section>
  );
};

export default ReliefPackTemplateItemsEditor;
