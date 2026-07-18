import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import {
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
const getReliefPackItemTotal = (packItem, packQuantity) =>
  Number(packItem?.quantity_required || 0) * Number(packQuantity || 0);

const summaryCardStyles = {
  border: "1px solid #dbe6f0",
  borderRadius: "14px",
  backgroundColor: "#f8fbff",
  padding: "14px 16px",
};

const sectionHeaderRowStyles = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

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
  const isAddingReliefPack = itemDraft.entry_type === "RELIEF_PACK";
  const isDefiningNewItem = !editingItemId && !isAddingReliefPack;
  const isDefiningNewPack = !editingItemId && isAddingReliefPack;
  const selectedReliefPackItems = itemDraft.relief_pack_items;
  const selectedReliefPackName = itemDraft.new_pack_name || "New Relief Pack";
  const selectedPackQuantity = Number(itemDraft.relief_pack_quantity || 0);

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
              {isEditingDonation ? "Update Donation" : "Receive Donation"}
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
                  type="date"
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
            </div>
          </section>

          <section style={sectionStyles}>
            <div style={sectionHeaderRowStyles}>
              <h3 style={{ ...sectionTitleStyles, margin: 0 }}>Donation Items</h3>
            </div>

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
                  <option value="ITEM">Loose Item</option>
                  <option value="RELIEF_PACK">Relief Pack</option>
                </select>
              </div>

              <div>
                <label htmlFor="item_inventory_item_id" style={labelStyles}>
                  {isAddingReliefPack ? "Relief Pack Name" : "Inventory Item"}
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
                    placeholder="Enter relief pack name"
                  />
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

                </>
              ) : null}

              <div>
                <label htmlFor="item_quantity" style={labelStyles}>
                  {isAddingReliefPack ? "Number of Packs Received" : "Quantity Received"}
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
                      event.target.value,
                    )
                  }
                  style={inputStyles}
                />
              </div>

              {!isAddingReliefPack ? (
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
              ) : null}

            </div>

            {!isAddingReliefPack ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "16px",
                }}
              >
                <button
                  type="button"
                  onClick={editingItemId ? onEditExistingItem : onAddItemDraft}
                  style={{
                    ...pageHeaderStyles.primaryButton,
                    minHeight: "48px",
                    minWidth: "220px",
                  }}
                >
                  {editingItemId ? "Save Item" : "+ Add Item"}
                </button>
              </div>
            ) : null}

            {isDefiningNewPack ? (
              <div
                style={{
                  marginTop: "16px",
                  paddingTop: "16px",
                  borderTop: "1px solid #dbe6f0",
                }}
              >
                <h4
                  style={{
                    margin: "0 0 14px",
                    color: "#17324d",
                    fontSize: "16px",
                  }}
                >
                  Items Included in This Relief Pack
                </h4>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "16px",
                  }}
                >
                  <div>
                    <label htmlFor="pack_item_name" style={labelStyles}>
                      Item Name
                    </label>
                    <input
                      id="pack_item_name"
                      value={itemDraft.new_item_name}
                      onChange={(event) => onItemDraftChange("new_item_name", event.target.value)}
                      style={inputStyles}
                      placeholder="Enter item name"
                    />
                  </div>

                  <div>
                    <label htmlFor="pack_item_category" style={labelStyles}>
                      Category
                    </label>
                    <select
                      id="pack_item_category"
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
                    <label htmlFor="pack_item_unit" style={labelStyles}>
                      Unit of Measure
                    </label>
                    <select
                      id="pack_item_unit"
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
                          event.target.value,
                        )
                      }
                      style={inputStyles}
                    />
                  </div>

                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "16px",
                  }}
                >
                  <button
                    type="button"
                    onClick={onAddPackItemDraft}
                    style={{
                      ...pageHeaderStyles.secondaryButton,
                      minWidth: "220px",
                      minHeight: "48px",
                    }}
                  >
                    + Add Item to Pack
                  </button>
                </div>
              </div>
            ) : null}

            {isAddingReliefPack && isDefiningNewPack ? (
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
                    No items have been added to this relief pack yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
                    {selectedReliefPackItems.map((templateItem) => (
                      <span
                        key={templateItem.draft_id || templateItem.item_name}
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
                        {templateItem.item_name || "Inventory item"} x{" "}
                        {getReliefPackItemTotal(templateItem, selectedPackQuantity)} total
                        {isDefiningNewPack ? (
                          <button
                            type="button"
                            onClick={() =>
                              onRemovePackItemDraft(
                                templateItem.draft_id || templateItem.item_name,
                              )
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
                              templateItem.item_name || "item"
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

            {formValues.items.length > 0 ? (
              <div
                style={{
                  marginTop: "18px",
                  display: "grid",
                  gap: "12px",
                }}
              >
                <h4 style={{ margin: 0, color: "#17324d", fontSize: "16px" }}>
                  Items Added to This Donation
                </h4>
                {formValues.items.map((item) => (
                  <div
                    key={item.draft_id || item.id}
                    style={{
                      ...summaryCardStyles,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "16px",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "grid", gap: "6px" }}>
                      {item.entry_type === "RELIEF_PACK" ? (
                        <>
                          <strong style={{ color: "#17324d" }}>
                            {item.relief_pack_name}
                          </strong>
                          <span style={{ color: "#60738a", fontSize: "14px" }}>
                            {item.relief_pack_quantity} relief packs
                          </span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {(item.relief_pack_items || []).map((packItem) => (
                              <span
                                key={packItem.draft_id || packItem.item_name}
                                style={{
                                  borderRadius: "999px",
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #dbe6f0",
                                  padding: "6px 10px",
                                  color: "#2f4e6d",
                                  fontSize: "13px",
                                  fontWeight: 700,
                                }}
                              >
                                {packItem.item_name} x{" "}
                                {getReliefPackItemTotal(
                                  packItem,
                                  item.relief_pack_quantity,
                                )}{" "}
                                total
                              </span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <strong style={{ color: "#17324d" }}>{item.item_name}</strong>
                          <span style={{ color: "#60738a", fontSize: "14px" }}>
                            {item.quantity_received} {item.unit_of_measure}
                          </span>
                        </>
                      )}
                    </div>

                    {!item.id ? (
                      <button
                        type="button"
                        onClick={() => onRemoveDraftItem(item)}
                        style={pageHeaderStyles.secondaryButton}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
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
                  : "Add Donation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DonationModal;
