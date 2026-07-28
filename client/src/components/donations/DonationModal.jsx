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
const RELIEF_PACK_REMARK_PREFIX = "Relief Pack:";

const getDonationItemDisplayName = (item) =>
  item?.item_name || item?.inventory_item?.item_name || "Inventory item";

const getDonationItemDisplayUnit = (item) =>
  item?.unit_of_measure || item?.inventory_item?.unit_of_measure || "";

const parseReliefPackRemark = (remarks) => {
  const normalizedRemarks = String(remarks || "").trim();

  if (
    normalizedRemarks &&
    normalizedRemarks.toLowerCase().startsWith(
      RELIEF_PACK_REMARK_PREFIX.toLowerCase(),
    )
  ) {
    const remarkBody = normalizedRemarks
      .slice(RELIEF_PACK_REMARK_PREFIX.length)
      .trim();
    const quantityMatch = remarkBody.match(/^(.*?)(?:\s+x\s+(\d+))$/i);

    if (quantityMatch) {
      return {
        name: quantityMatch[1].trim(),
        quantity: Number(quantityMatch[2]),
      };
    }

    return {
      name: remarkBody,
      quantity: null,
    };
  }

  return null;
};

const summaryCardStyles = {
  border: "1px solid #dbe6f0",
  borderRadius: "14px",
  backgroundColor: "#f8fbff",
  padding: "14px 16px",
};

const getQuantityLabel = (quantity, unit) =>
  `${quantity ?? 0}${unit ? ` ${unit}` : ""}`;

const buildDonationItemGroups = (items) => {
  const groups = [];
  const persistedPackGroups = new Map();
  let packIndex = 0;

  items.forEach((item) => {
    if (item?.entry_type === "RELIEF_PACK") {
      packIndex += 1;
      groups.push({
        key: item.draft_id || item.id || `pack-${packIndex}`,
        type: "pack",
        title: item.relief_pack_name || `Pack ${packIndex}`,
        subtitle: "",
        supportingText: `${item.relief_pack_quantity} relief packs`,
        lines: (item.relief_pack_items || []).map((packItem) => ({
          key: packItem.draft_id || packItem.item_name,
          label: packItem.item_name || "Inventory item",
          quantity: getQuantityLabel(
            getReliefPackItemTotal(packItem, item.relief_pack_quantity),
            packItem.unit_of_measure,
          ),
        })),
        canRemove: !item.id,
        sourceItem: item,
      });
      return;
    }

    const persistedPackMeta = parseReliefPackRemark(item?.remarks);

    if (persistedPackMeta) {
      const persistedPackKey = `${persistedPackMeta.name}::${
        persistedPackMeta.quantity ?? ""
      }`;
      let group = persistedPackGroups.get(persistedPackKey);

      if (!group) {
        packIndex += 1;
        group = {
          key: item.id || `saved-pack-${packIndex}`,
          type: "pack",
          title: persistedPackMeta.name || `Pack ${packIndex}`,
          subtitle: "",
          supportingText: persistedPackMeta.quantity
            ? `${persistedPackMeta.quantity} relief packs`
            : "",
          lines: [],
          canRemove: false,
          sourceItem: item,
        };
        persistedPackGroups.set(persistedPackKey, group);
        groups.push(group);
      }

      group.lines.push({
        key: item.id || `${group.key}-${group.lines.length}`,
        label: getDonationItemDisplayName(item),
        quantity: getQuantityLabel(
          item.quantity_received,
          getDonationItemDisplayUnit(item),
        ),
      });
      return;
    }

    groups.push({
      key: item.draft_id || item.id || getDonationItemDisplayName(item),
      type: "item",
      title: getDonationItemDisplayName(item),
      subtitle: "",
      supportingText: getQuantityLabel(
        item.quantity_received,
        getDonationItemDisplayUnit(item),
      ),
      lines: [],
      canRemove: !item.id,
      sourceItem: item,
    });
  });

  return groups;
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
  const editingDonationItem =
    formValues.items.find((item) => item.id === editingItemId) || null;
  const editingInventoryItem =
    inventoryItems.find((item) => item.id === itemDraft.inventory_item_id) || null;
  const editingInventoryItemName =
    editingDonationItem
      ? getDonationItemDisplayName(editingDonationItem)
      : editingInventoryItem?.item_name || "";
  const donationItemGroups = buildDonationItemGroups(formValues.items);

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
                    <option key={type.value} value={type.value}>
                      {type.label}
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
                ) : editingItemId && !isAddingReliefPack ? (
                  <input
                    id="item_inventory_item_id"
                    value={editingInventoryItemName}
                    style={{
                      ...inputStyles,
                      backgroundColor: "#f4f8fc",
                      color: "#4f677f",
                    }}
                    readOnly
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

            {donationItemGroups.length > 0 ? (
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
                {donationItemGroups.map((group) => (
                  <div
                    key={group.key}
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
                      {group.type === "pack" ? (
                        <>
                          <strong style={{ color: "#17324d" }}>
                            {group.title}
                          </strong>
                          {group.subtitle ? (
                            <span style={{ color: "#60738a", fontSize: "14px" }}>
                              {group.subtitle}
                            </span>
                          ) : null}
                          {group.supportingText ? (
                            <span style={{ color: "#60738a", fontSize: "14px" }}>
                              {group.supportingText}
                            </span>
                          ) : null}
                          <div
                            style={{
                              display: "grid",
                              gap: "8px",
                              marginTop: "4px",
                            }}
                          >
                            {group.lines.map((line) => (
                              <div
                                key={line.key}
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "8px",
                                  color: "#2f4e6d",
                                  fontSize: "14px",
                                }}
                              >
                                <span style={{ fontWeight: 700 }}>{line.label}</span>
                                <span style={{ color: "#60738a" }}>
                                  - {line.quantity}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <strong style={{ color: "#17324d" }}>
                            {group.title}
                          </strong>
                          <span style={{ color: "#60738a", fontSize: "14px" }}>
                            {group.supportingText}
                          </span>
                        </>
                      )}
                    </div>

                    {group.canRemove ? (
                      <button
                        type="button"
                        onClick={() => onRemoveDraftItem(group.sourceItem)}
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
