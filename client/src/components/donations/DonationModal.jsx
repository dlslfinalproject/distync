import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import TableActionsMenu from "../shared/TableActionsMenu";
import { formatDonationDateOnly } from "../../features/donations/donationFormatters";
import {
  donationStatuses,
  donorTypes,
  inputStyles,
  labelStyles,
  modalStyles,
  overlayStyles,
} from "../../features/donations/donationUi";

const sectionStyles = {
  border: "1px solid #d7e2ef",
  borderRadius: "18px",
  backgroundColor: "#ffffff",
  padding: "20px",
};

const sectionTitleStyles = {
  margin: "0 0 16px",
  color: "#17324d",
  fontSize: "20px",
};

const fieldGridStyles = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "18px",
};

const categoryOptions = [
  { value: "perishable", label: "Perishable" },
  { value: "non-perishable", label: "Non-Perishable" },
];

const unitOptions = ["pc", "kg", "g", "L", "mL"];
const packagingOptions = ["pack", "box", "carton", "case", "sack", "bottle"];

const DonationModal = ({
  isOpen,
  formValues,
  itemDraft,
  inventoryItems,
  reliefPackTemplates = [],
  disasterEvents,
  isSubmitting,
  errorMessage,
  itemErrorMessage,
  editingItemId,
  onClose,
  onFormChange,
  onItemDraftChange,
  onAddItemDraft,
  onEditExistingItem,
  onDeleteExistingItem,
  onRemoveDraftItem,
  onAddPackItemDraft,
  onRemovePackItemDraft,
  onStartEditItem,
  onCancelEditItem,
  onSubmit,
}) => {
  if (!isOpen) {
    return null;
  }

  const isEditingDonation = Boolean(formValues.id);
  const selectedReliefPackTemplate = reliefPackTemplates.find(
    (template) => template.id === itemDraft.relief_pack_template_id,
  );
  const isAddingReliefPack = itemDraft.entry_type === "RELIEF_PACK";
  const isDefiningNewItem =
    !editingItemId &&
    !isAddingReliefPack &&
    itemDraft.item_definition_mode === "NEW";
  const isDefiningNewPack =
    !editingItemId &&
    isAddingReliefPack &&
    itemDraft.pack_definition_mode === "NEW";
  const selectedReliefPackItems = isDefiningNewPack
    ? itemDraft.relief_pack_items
    : selectedReliefPackTemplate?.items || [];
  const selectedReliefPackName = isDefiningNewPack
    ? itemDraft.new_pack_name || "New Relief Pack"
    : selectedReliefPackTemplate?.name;

  return (
    <div style={overlayStyles}>
      <div style={{ ...modalStyles, backgroundColor: "#eef5fb" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: "#17324d", fontSize: "26px" }}>
              {isEditingDonation ? "Update Donation Record" : "Record Donation"}
            </h3>
          </div>
          <button type="button" onClick={onClose} style={pageHeaderStyles.secondaryButton}>
            Close
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <section style={sectionStyles}>
            <h3 style={sectionTitleStyles}>Donation Information</h3>

            <div style={fieldGridStyles}>
              <div>
                <label htmlFor="donor_name" style={labelStyles}>
                  Donor Name
                </label>
                <input
                  id="donor_name"
                  value={formValues.donor_name}
                  onChange={(event) => onFormChange("donor_name", event.target.value)}
                  style={inputStyles}
                  placeholder="Enter donor name"
                />
              </div>

              <div>
                <label htmlFor="donation_event" style={labelStyles}>
                  Disaster Event
                </label>
                <select
                  id="donation_event"
                  value={formValues.disaster_event_id}
                  onChange={(event) => onFormChange("disaster_event_id", event.target.value)}
                  style={inputStyles}
                >
                  <option value="">Select disaster event</option>
                  {disasterEvents.map((eventRow) => (
                    <option key={eventRow.id} value={eventRow.id}>
                      {eventRow.event_code} - {eventRow.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="received_at" style={labelStyles}>
                  Received Date
                </label>
                <input
                  id="received_at"
                  type="datetime-local"
                  value={formValues.received_at}
                  onChange={(event) => onFormChange("received_at", event.target.value)}
                  style={inputStyles}
                />
              </div>

              <div>
                <label htmlFor="donor_type" style={labelStyles}>
                  Donor Type
                </label>
                <select
                  id="donor_type"
                  value={formValues.donor_type}
                  onChange={(event) => onFormChange("donor_type", event.target.value)}
                  style={inputStyles}
                >
                  {donorTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="donation_status" style={labelStyles}>
                  Status
                </label>
                <select
                  id="donation_status"
                  value={formValues.status}
                  onChange={(event) => onFormChange("status", event.target.value)}
                  style={inputStyles}
                >
                  {donationStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section style={sectionStyles}>
            <h3 style={sectionTitleStyles}>Donation Items</h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "16px",
              }}
            >
              <div>
                <label htmlFor="donation_entry_type" style={labelStyles}>
                  Add Donation As
                </label>
                <select
                  id="donation_entry_type"
                  value={itemDraft.entry_type}
                  onChange={(event) => onItemDraftChange("entry_type", event.target.value)}
                  style={inputStyles}
                  disabled={Boolean(editingItemId)}
                >
                  <option value="ITEM">Item</option>
                  <option value="RELIEF_PACK">Relief Pack</option>
                </select>
              </div>

              {!editingItemId && !isAddingReliefPack ? (
                <div>
                  <label htmlFor="item_definition_mode" style={labelStyles}>
                    Item Source
                  </label>
                  <select
                    id="item_definition_mode"
                    value={itemDraft.item_definition_mode}
                    onChange={(event) =>
                      onItemDraftChange("item_definition_mode", event.target.value)
                    }
                    style={inputStyles}
                  >
                    <option value="EXISTING">Use Existing Item</option>
                    <option value="NEW">Define New Item</option>
                  </select>
                </div>
              ) : null}

              {!editingItemId && isAddingReliefPack ? (
                <div>
                  <label htmlFor="pack_definition_mode" style={labelStyles}>
                    Relief Pack Source
                  </label>
                  <select
                    id="pack_definition_mode"
                    value={itemDraft.pack_definition_mode}
                    onChange={(event) =>
                      onItemDraftChange("pack_definition_mode", event.target.value)
                    }
                    style={inputStyles}
                  >
                    <option value="EXISTING">Use Existing Pack</option>
                    <option value="NEW">Define New Pack</option>
                  </select>
                </div>
              ) : null}

              <div>
                <label htmlFor="item_inventory_item_id" style={labelStyles}>
                  {isAddingReliefPack ? "Relief Pack" : "Inventory Item"}
                </label>
                {isDefiningNewItem ? (
                  <input
                    id="new_item_name"
                    value={itemDraft.new_item_name}
                    onChange={(event) => onItemDraftChange("new_item_name", event.target.value)}
                    style={inputStyles}
                    placeholder="Enter item name"
                  />
                ) : isDefiningNewPack ? (
                  <input
                    id="new_pack_name"
                    value={itemDraft.new_pack_name}
                    onChange={(event) => onItemDraftChange("new_pack_name", event.target.value)}
                    style={inputStyles}
                    placeholder="Enter pack name"
                  />
                ) : isAddingReliefPack ? (
                  <select
                    id="item_relief_pack_template_id"
                    value={itemDraft.relief_pack_template_id}
                    onChange={(event) =>
                      onItemDraftChange("relief_pack_template_id", event.target.value)
                    }
                    style={inputStyles}
                    disabled={Boolean(editingItemId)}
                  >
                    <option value="">Select relief pack</option>
                    {reliefPackTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    id="item_inventory_item_id"
                    value={itemDraft.inventory_item_id}
                    onChange={(event) => onItemDraftChange("inventory_item_id", event.target.value)}
                    style={inputStyles}
                    disabled={Boolean(editingItemId)}
                  >
                    <option value="">Select inventory item</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.item_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {isDefiningNewItem ? (
                <>
                  <div>
                    <label htmlFor="new_item_category" style={labelStyles}>
                      Category
                    </label>
                    <select
                      id="new_item_category"
                      value={itemDraft.new_item_category}
                      onChange={(event) =>
                        onItemDraftChange("new_item_category", event.target.value)
                      }
                      style={inputStyles}
                    >
                      {categoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="new_item_unit" style={labelStyles}>
                      Unit of Measure
                    </label>
                    <select
                      id="new_item_unit"
                      value={itemDraft.new_item_unit_of_measure}
                      onChange={(event) =>
                        onItemDraftChange("new_item_unit_of_measure", event.target.value)
                      }
                      style={inputStyles}
                    >
                      {unitOptions.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="new_item_packaging" style={labelStyles}>
                      Packaging
                    </label>
                    <select
                      id="new_item_packaging"
                      value={itemDraft.new_item_packaging}
                      onChange={(event) =>
                        onItemDraftChange("new_item_packaging", event.target.value)
                      }
                      style={inputStyles}
                    >
                      {packagingOptions.map((packaging) => (
                        <option key={packaging} value={packaging}>
                          {packaging}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}

              <div>
                <label htmlFor="item_quantity" style={labelStyles}>
                  {isAddingReliefPack ? "Relief Pack Quantity" : "Quantity Received"}
                </label>
                <input
                  id="item_quantity"
                  type="number"
                  min="1"
                  value={
                    isAddingReliefPack
                      ? itemDraft.relief_pack_quantity
                      : itemDraft.quantity_received
                  }
                  onChange={(event) =>
                    onItemDraftChange(
                      isAddingReliefPack
                        ? "relief_pack_quantity"
                        : "quantity_received",
                      Number.parseInt(event.target.value || "1", 10),
                    )
                  }
                  style={inputStyles}
                />
              </div>

              <div>
                <label htmlFor="item_expiration_date" style={labelStyles}>
                  Expiration Date
                </label>
                <input
                  id="item_expiration_date"
                  type="date"
                  value={itemDraft.expiration_date}
                  onChange={(event) => onItemDraftChange("expiration_date", event.target.value)}
                  style={inputStyles}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "end",
                }}
              >
                <button
                  type="button"
                  onClick={editingItemId ? onEditExistingItem : onAddItemDraft}
                  style={{
                    ...pageHeaderStyles.primaryButton,
                    width: "100%",
                    minHeight: "48px",
                  }}
                >
                  {editingItemId
                    ? "Save Item"
                    : isAddingReliefPack
                      ? "+ Add Relief Pack"
                      : "+ Add Item"}
                </button>
              </div>
            </div>

            {isDefiningNewPack ? (
              <div
                style={{
                  marginTop: "16px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                }}
              >
                <div>
                  <label htmlFor="pack_item_inventory_item_id" style={labelStyles}>
                    Add Item to Pack
                  </label>
                  <select
                    id="pack_item_inventory_item_id"
                    value={itemDraft.pack_item_inventory_item_id}
                    onChange={(event) =>
                      onItemDraftChange("pack_item_inventory_item_id", event.target.value)
                    }
                    style={inputStyles}
                  >
                    <option value="">Select item</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.item_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="pack_item_quantity_required" style={labelStyles}>
                    Quantity per Pack
                  </label>
                  <input
                    id="pack_item_quantity_required"
                    type="number"
                    min="1"
                    value={itemDraft.pack_item_quantity_required}
                    onChange={(event) =>
                      onItemDraftChange(
                        "pack_item_quantity_required",
                        Number.parseInt(event.target.value || "1", 10),
                      )
                    }
                    style={inputStyles}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "end" }}>
                  <button
                    type="button"
                    onClick={onAddPackItemDraft}
                    style={{
                      ...pageHeaderStyles.secondaryButton,
                      width: "100%",
                      minHeight: "48px",
                    }}
                  >
                    + Add Pack Item
                  </button>
                </div>
              </div>
            ) : null}

            {isAddingReliefPack && (selectedReliefPackTemplate || isDefiningNewPack) ? (
              <div
                style={{
                  marginTop: "14px",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  backgroundColor: "#f8fbff",
                  border: "1px solid #dbe6f0",
                }}
              >
                <strong style={{ color: "#17324d" }}>{selectedReliefPackName}</strong>
                {selectedReliefPackItems.length === 0 ? (
                  <p style={{ margin: "8px 0 0", color: "#60738a", fontSize: "14px" }}>
                    This relief pack has no items yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
                    {selectedReliefPackItems.map((templateItem) => (
                      <span
                        key={templateItem.id || templateItem.inventory_item_id}
                        style={{
                          borderRadius: "999px",
                          backgroundColor: "#ffffff",
                          border: "1px solid #dbe6f0",
                          padding: "7px 10px",
                          color: "#2f4e6d",
                          fontSize: "13px",
                          fontWeight: 700,
                        }}
                      >
                        {templateItem.inventory_item?.item_name || "Inventory item"} x{" "}
                        {Number(templateItem.quantity_required || 0) *
                          Number(itemDraft.relief_pack_quantity || 0)}
                        {isDefiningNewPack ? (
                          <button
                            type="button"
                            onClick={() =>
                              onRemovePackItemDraft(templateItem.inventory_item_id)
                            }
                            style={{
                              marginLeft: "8px",
                              border: "none",
                              background: "transparent",
                              color: "#6b8298",
                              cursor: "pointer",
                              fontWeight: 800,
                            }}
                            aria-label={`Remove ${
                              templateItem.inventory_item?.item_name || "item"
                            }`}
                          >
                            x
                          </button>
                        ) : null}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {itemErrorMessage ? (
              <div
                style={{
                  marginTop: "16px",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  backgroundColor: "#fff3f1",
                  border: "1px solid #f1d2cc",
                  color: "#9d4d58",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                {itemErrorMessage}
              </div>
            ) : null}

            {editingItemId ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginTop: "16px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={onCancelEditItem}
                  style={pageHeaderStyles.secondaryButton}
                >
                  Cancel Item Edit
                </button>
              </div>
            ) : null}

            <div style={{ overflowX: "auto", marginTop: "18px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Item", "Quantity", "Batch", "Expiry", "Actions"].map((label) => (
                      <th
                        key={label}
                        style={{
                          padding: "12px 14px",
                          textAlign: "left",
                          fontSize: "12px",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "#66809c",
                          borderBottom: "1px solid #e0eaf4",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {formValues.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "18px 14px",
                          color: "#60738a",
                          fontSize: "14px",
                        }}
                      >
                        No donation items have been added yet.
                      </td>
                    </tr>
                  ) : (
                    formValues.items.map((item, index) => (
                      <tr key={item.id || `${item.inventory_item_id}-${item.quantity_received}-${index}`}>
                        <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                          {item.inventory_item?.item_name ||
                            inventoryItems.find((row) => row.id === item.inventory_item_id)?.item_name ||
                            "--"}
                        </td>
                        <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                          {item.quantity_received}
                        </td>
                        <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                          {item.inventory_batch?.batch_no || "Auto-generated"}
                        </td>
                        <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                          {formatDonationDateOnly(
                            item.expiration_date || item.inventory_batch?.expiration_date,
                          )}
                        </td>
                        <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              minHeight: "36px",
                            }}
                          >
                            <TableActionsMenu
                              row={item}
                              menuId={`donation-item-actions-${item.id || `${item.inventory_item_id}-${item.quantity_received}`}`}
                              buttonTitle="Donation item actions"
                              buttonAriaLabel="Donation item actions"
                              items={
                                item.id
                                  ? [
                                      {
                                        key: "edit",
                                        label: "Edit",
                                        onClick: (row) => onStartEditItem(row),
                                      },
                                      {
                                        key: "delete",
                                        label: "Delete",
                                        tone: "destructive",
                                        onClick: (row) => onDeleteExistingItem(row),
                                      },
                                    ]
                                  : [
                                      {
                                        key: "remove",
                                        label: "Remove",
                                        tone: "destructive",
                                        onClick: (row) => onRemoveDraftItem(row),
                                      },
                                    ]
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

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
              marginTop: "24px",
            }}
          >
            <button type="button" onClick={onClose} style={pageHeaderStyles.secondaryButton}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ ...pageHeaderStyles.primaryButton, opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting
                ? "Saving..."
                : isEditingDonation
                  ? "Update Donation"
                  : "Record Donation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DonationModal;
