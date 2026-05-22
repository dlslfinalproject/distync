import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";
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

const DonationModal = ({
  isOpen,
  formValues,
  itemDraft,
  inventoryItems,
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
  onStartEditItem,
  onCancelEditItem,
  onSubmit,
}) => {
  if (!isOpen) {
    return null;
  }

  const isEditingDonation = Boolean(formValues.id);

  return (
    <div style={overlayStyles}>
      <div style={modalStyles}>
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
            <p
              style={{
                margin: "8px 0 0",
                color: "#60738a",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              Capture the donor record and the donated inventory items that should feed stock tracking.
            </p>
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
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
            }}
          >
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
              <label htmlFor="donor_name" style={labelStyles}>
                Donor Name
              </label>
              <input
                id="donor_name"
                value={formValues.donor_name}
                onChange={(event) => onFormChange("donor_name", event.target.value)}
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
                Donation Status
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

            <div>
              <label htmlFor="contact_information" style={labelStyles}>
                Contact Information
              </label>
              <input
                id="contact_information"
                value={formValues.contact_information}
                onChange={(event) => onFormChange("contact_information", event.target.value)}
                style={inputStyles}
              />
            </div>

            <div>
              <label htmlFor="received_at" style={labelStyles}>
                Received At
              </label>
              <input
                id="received_at"
                type="datetime-local"
                value={formValues.received_at}
                onChange={(event) => onFormChange("received_at", event.target.value)}
                style={inputStyles}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="donation_remarks" style={labelStyles}>
                Remarks
              </label>
              <textarea
                id="donation_remarks"
                value={formValues.remarks}
                onChange={(event) => onFormChange("remarks", event.target.value)}
                style={{ ...inputStyles, minHeight: "88px", resize: "vertical" }}
              />
            </div>
          </div>

          <section
            style={{
              marginTop: "24px",
              borderTop: "1px solid #e4edf6",
              paddingTop: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h4 style={{ margin: 0, color: "#17324d", fontSize: "18px" }}>
                  Donation Items
                </h4>
                <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
                  Each item received here creates or updates donated stock and adds a donation inventory transaction.
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "16px",
                marginTop: "18px",
              }}
            >
              <div>
                <label htmlFor="item_inventory_item_id" style={labelStyles}>
                  Inventory Item
                </label>
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
              </div>

              <div>
                <label htmlFor="item_quantity" style={labelStyles}>
                  Quantity Received
                </label>
                <input
                  id="item_quantity"
                  type="number"
                  min="1"
                  value={itemDraft.quantity_received}
                  onChange={(event) =>
                    onItemDraftChange(
                      "quantity_received",
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

              <div>
                <label htmlFor="item_storage_location" style={labelStyles}>
                  Storage Location
                </label>
                <input
                  id="item_storage_location"
                  value={itemDraft.storage_location}
                  onChange={(event) => onItemDraftChange("storage_location", event.target.value)}
                  style={inputStyles}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="item_remarks" style={labelStyles}>
                  Item Remarks
                </label>
                <textarea
                  id="item_remarks"
                  value={itemDraft.remarks}
                  onChange={(event) => onItemDraftChange("remarks", event.target.value)}
                  style={{ ...inputStyles, minHeight: "84px", resize: "vertical" }}
                />
              </div>
            </div>

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

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                marginTop: "16px",
                flexWrap: "wrap",
              }}
            >
              {editingItemId ? (
                <button
                  type="button"
                  onClick={onCancelEditItem}
                  style={pageHeaderStyles.secondaryButton}
                >
                  Cancel Item Edit
                </button>
              ) : null}
              <button
                type="button"
                onClick={editingItemId ? onEditExistingItem : onAddItemDraft}
                style={pageHeaderStyles.secondaryButton}
              >
                {editingItemId ? "Save Item Changes" : "Add Item"}
              </button>
            </div>

            <div style={{ overflowX: "auto", marginTop: "18px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Item", "Quantity", "Batch", "Expiry", "Remarks", "Actions"].map((label) => (
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
                        colSpan={6}
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
                    formValues.items.map((item) => (
                      <tr key={item.id || `${item.inventory_item_id}-${item.quantity_received}-${item.remarks}`}>
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
                          {item.remarks || "--"}
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
