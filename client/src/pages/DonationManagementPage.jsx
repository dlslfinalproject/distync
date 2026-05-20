import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader, { pageHeaderStyles } from "../components/layout/PageHeader";
import { shellStyles } from "../components/layout/BarangayLayout";
import SearchBar from "../components/shared/SearchBar";
import { fetchAllDisasterEvents } from "../features/disaster-events/disasterEventService";
import { fetchInventoryItems } from "../features/inventory-items/inventoryItemService";
import {
  createDonation,
  createDonationItem,
  createDonationNeed,
  deleteDonation,
  deleteDonationItem,
  deleteDonationNeed,
  fetchDonationById,
  fetchDonationNeeds,
  fetchDonationPortalData,
  fetchDonations,
  updateDonation,
  updateDonationItem,
  updateDonationNeed,
} from "../features/donations/donationService";
import { useAuth } from "../context/AuthContext";
import { getDefaultRouteForRole } from "../utils/roleSession";

const donorTypes = [
  "INDIVIDUAL",
  "NGO",
  "PRIVATE_ORGANIZATION",
  "GOVERNMENT_PARTNER",
  "OTHER",
];

const donationStatuses = [
  "RECEIVED",
  "PARTIALLY_DISTRIBUTED",
  "DISTRIBUTED",
  "CANCELLED",
];

const priorityLevels = ["URGENT", "HIGH", "MEDIUM", "LOW"];

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(21, 40, 63, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1000,
};

const modalStyles = {
  width: "min(980px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#ffffff",
  borderRadius: "22px",
  border: "1px solid #d7e2ef",
  boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  padding: "24px",
  boxSizing: "border-box",
};

const inputStyles = {
  width: "100%",
  minHeight: "48px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #d2deea",
  boxSizing: "border-box",
  fontSize: "14px",
  color: "#21405f",
  backgroundColor: "#ffffff",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
};

const compactButtonStyles = {
  border: "1px solid #c6d8ea",
  borderRadius: "12px",
  padding: "8px 12px",
  backgroundColor: "#f8fbfe",
  color: "#2a4c6f",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

const backButtonStyles = {
  background: "#0f2a44",
  border: "none",
  padding: "10px 16px",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: 600,
  color: "#ffffff",
  transition: "all 0.2s ease",
  boxShadow: "0 4px 12px rgba(15, 42, 68, 0.25)",
};

const badgePalette = {
  URGENT: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  HIGH: { backgroundColor: "#ffedd5", color: "#c2410c" },
  MEDIUM: { backgroundColor: "#fef3c7", color: "#b45309" },
  LOW: { backgroundColor: "#dcfce7", color: "#15803d" },
  RECEIVED: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  PARTIALLY_DISTRIBUTED: { backgroundColor: "#fef3c7", color: "#b45309" },
  DISTRIBUTED: { backgroundColor: "#dcfce7", color: "#15803d" },
  CANCELLED: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  ACTIVE: { backgroundColor: "#dcfce7", color: "#15803d" },
  INACTIVE: { backgroundColor: "#e2e8f0", color: "#475569" },
};

const createNeedForm = () => ({
  disaster_event_id: "",
  inventory_item_id: "",
  quantity_needed: 0,
  priority_level: "MEDIUM",
  notes: "",
  is_active: true,
});

const createDonationItemForm = () => ({
  inventory_item_id: "",
  quantity_received: 1,
  remarks: "",
  expiration_date: "",
  storage_location: "",
});

const createDonationForm = () => ({
  disaster_event_id: "",
  donor_name: "",
  donor_type: "INDIVIDUAL",
  contact_information: "",
  received_at: "",
  status: "RECEIVED",
  remarks: "",
  items: [],
});

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDateOnly = (value) => {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const StatusBadge = ({ label }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      borderRadius: "999px",
      padding: "4px 10px",
      fontSize: "12px",
      fontWeight: 700,
      ...(badgePalette[label] || {
        backgroundColor: "#e2e8f0",
        color: "#334155",
      }),
    }}
  >
    {label}
  </span>
);

const DonationNeedModal = ({
  isOpen,
  formValues,
  inventoryItems,
  disasterEvents,
  isSubmitting,
  errorMessage,
  onClose,
  onChange,
  onSubmit,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div style={overlayStyles}>
      <div style={{ ...modalStyles, width: "min(760px, 100%)" }}>
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
              {formValues.id ? "Update Donation Need" : "Create Donation Need"}
            </h3>
            <p
              style={{
                margin: "8px 0 0",
                color: "#60738a",
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              Publish the active relief items and quantities that donors can see in the public portal.
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
              <label htmlFor="need_event" style={labelStyles}>
                Disaster Event
              </label>
              <select
                id="need_event"
                value={formValues.disaster_event_id}
                onChange={(event) => onChange("disaster_event_id", event.target.value)}
                style={inputStyles}
              >
                <option value="">Select disaster event</option>
                {disasterEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.event_code} - {event.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="need_item" style={labelStyles}>
                Inventory Item
              </label>
              <select
                id="need_item"
                value={formValues.inventory_item_id}
                onChange={(event) => onChange("inventory_item_id", event.target.value)}
                style={inputStyles}
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
              <label htmlFor="need_qty" style={labelStyles}>
                Quantity Needed
              </label>
              <input
                id="need_qty"
                type="number"
                min="0"
                value={formValues.quantity_needed}
                onChange={(event) =>
                  onChange("quantity_needed", Number.parseInt(event.target.value || "0", 10))
                }
                style={inputStyles}
              />
            </div>

            <div>
              <label htmlFor="need_priority" style={labelStyles}>
                Priority Level
              </label>
              <select
                id="need_priority"
                value={formValues.priority_level}
                onChange={(event) => onChange("priority_level", event.target.value)}
                style={inputStyles}
              >
                {priorityLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="need_notes" style={labelStyles}>
                Notes
              </label>
              <textarea
                id="need_notes"
                value={formValues.notes}
                onChange={(event) => onChange("notes", event.target.value)}
                style={{ ...inputStyles, minHeight: "96px", resize: "vertical" }}
              />
            </div>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                color: "#24496e",
                fontWeight: 700,
              }}
            >
              <input
                type="checkbox"
                checked={formValues.is_active}
                onChange={(event) => onChange("is_active", event.target.checked)}
              />
              Keep this donation need visible in the public portal
            </label>
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
              {isSubmitting ? "Saving..." : formValues.id ? "Update Need" : "Create Need"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

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
                {disasterEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.event_code} - {event.title}
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
                  onChange={(event) =>
                    onItemDraftChange("inventory_item_id", event.target.value)
                  }
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
                  {(isEditingDonation ? formValues.items : formValues.items).length === 0 ? (
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
                          {formatDateOnly(item.expiration_date || item.inventory_batch?.expiration_date)}
                        </td>
                        <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                          {item.remarks || "--"}
                        </td>
                        <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {item.id ? (
                              <>
                                <button type="button" onClick={() => onStartEditItem(item)} style={compactButtonStyles}>
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteExistingItem(item)}
                                  style={{ ...compactButtonStyles, color: "#b91c1c", borderColor: "#f1d2cc" }}
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onRemoveDraftItem(item)}
                                style={{ ...compactButtonStyles, color: "#b91c1c", borderColor: "#f1d2cc" }}
                              >
                                Remove
                              </button>
                            )}
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

const DonationManagementPage = () => {
  const navigate = useNavigate();
  const { currentRole } = useAuth();
  const canManageDonations = currentRole === "MAYOR";
  const availableTabs = canManageDonations
    ? [
        { key: "donations", label: "Donations" },
        { key: "needs", label: "Donation Needs" },
        { key: "transparency", label: "Transparency Summary" },
      ]
    : [
        { key: "needs", label: "Donation Needs" },
        { key: "transparency", label: "Transparency Summary" },
      ];
  const [activeTab, setActiveTab] = useState(
    canManageDonations ? "donations" : "needs",
  );
  const [disasterEvents, setDisasterEvents] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [donationNeeds, setDonationNeeds] = useState([]);
  const [donations, setDonations] = useState([]);
  const [portalData, setPortalData] = useState({
    donation_needs: [],
    transparency_summary: {
      total_donations_received: 0,
      total_quantity_received: 0,
      total_donated_items_distributed: 0,
      remaining_donated_inventory: 0,
      received_vs_distributed: [],
    },
  });
  const [selectedEventId, setSelectedEventId] = useState("");
  const [needSearch, setNeedSearch] = useState("");
  const [donationSearch, setDonationSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isNeedModalOpen, setIsNeedModalOpen] = useState(false);
  const [needForm, setNeedForm] = useState(createNeedForm());
  const [needErrorMessage, setNeedErrorMessage] = useState("");
  const [isNeedSubmitting, setIsNeedSubmitting] = useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [donationForm, setDonationForm] = useState(createDonationForm());
  const [donationErrorMessage, setDonationErrorMessage] = useState("");
  const [donationItemErrorMessage, setDonationItemErrorMessage] = useState("");
  const [isDonationSubmitting, setIsDonationSubmitting] = useState(false);
  const [donationItemDraft, setDonationItemDraft] = useState(createDonationItemForm());
  const [editingDonationItemId, setEditingDonationItemId] = useState("");

  const loadPageData = async (eventId = selectedEventId) => {
    setIsLoading(true);
    setPageErrorMessage("");

    try {
      const [eventRows, inventoryItemRows, donationNeedRows, donationRows, donationPortal] =
        await Promise.all([
          fetchAllDisasterEvents(),
          canManageDonations
            ? fetchInventoryItems({ is_active: true })
            : Promise.resolve([]),
          fetchDonationNeeds({
            disaster_event_id: eventId || undefined,
            search: needSearch || undefined,
          }),
          canManageDonations
            ? fetchDonations({
                disaster_event_id: eventId || undefined,
                search: donationSearch || undefined,
              })
            : Promise.resolve([]),
          fetchDonationPortalData({
            disaster_event_id: eventId || undefined,
          }),
        ]);

      setDisasterEvents(Array.isArray(eventRows) ? eventRows : []);
      setInventoryItems(Array.isArray(inventoryItemRows) ? inventoryItemRows : []);
      setDonationNeeds(Array.isArray(donationNeedRows) ? donationNeedRows : []);
      setDonations(Array.isArray(donationRows) ? donationRows : []);
      setPortalData(donationPortal || {
        donation_needs: [],
        transparency_summary: {
          total_donations_received: 0,
          total_quantity_received: 0,
          total_donated_items_distributed: 0,
          remaining_donated_inventory: 0,
          received_vs_distributed: [],
        },
      });

      if (!eventId && Array.isArray(eventRows) && eventRows.length > 0) {
        setSelectedEventId(eventRows[0].id);
      }
    } catch (error) {
      setPageErrorMessage(error.message || "Failed to load donation management data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageDonations) {
      setActiveTab("needs");
    }

    loadPageData(selectedEventId);
  }, [canManageDonations]);

  const filteredDonationNeeds = useMemo(() => {
    if (!needSearch.trim()) {
      return donationNeeds;
    }

    const normalizedSearch = needSearch.trim().toLowerCase();

    return donationNeeds.filter((need) =>
      [
        need.inventory_item?.item_name,
        need.inventory_item?.item_code,
        need.disaster_event?.title,
        need.disaster_event?.event_code,
        need.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
    );
  }, [donationNeeds, needSearch]);

  const filteredDonations = useMemo(() => {
    if (!donationSearch.trim()) {
      return donations;
    }

    const normalizedSearch = donationSearch.trim().toLowerCase();

    return donations.filter((donation) =>
      [
        donation.donor_name,
        donation.contact_information,
        donation.disaster_event?.title,
        donation.disaster_event?.event_code,
        donation.remarks,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
    );
  }, [donations, donationSearch]);

  const selectedEventLabel = useMemo(() => {
    const matchedEvent = disasterEvents.find((event) => event.id === selectedEventId);
    return matchedEvent ? `${matchedEvent.event_code} - ${matchedEvent.title}` : "All Events";
  }, [disasterEvents, selectedEventId]);

  const openNeedModal = (donationNeed = null) => {
    setNeedErrorMessage("");
    setNeedForm(
      donationNeed
        ? {
            id: donationNeed.id,
            disaster_event_id: donationNeed.disaster_event_id,
            inventory_item_id: donationNeed.inventory_item_id,
            quantity_needed: donationNeed.quantity_needed,
            priority_level: donationNeed.priority_level,
            notes: donationNeed.notes || "",
            is_active: donationNeed.is_active,
          }
        : {
            ...createNeedForm(),
            disaster_event_id: selectedEventId || "",
          },
    );
    setIsNeedModalOpen(true);
  };

  const closeNeedModal = () => {
    setIsNeedModalOpen(false);
    setNeedForm(createNeedForm());
    setNeedErrorMessage("");
  };

  const openDonationModal = async (donationId = null) => {
    setDonationErrorMessage("");
    setDonationItemErrorMessage("");
    setEditingDonationItemId("");
    setDonationItemDraft(createDonationItemForm());

    if (!donationId) {
      setDonationForm({
        ...createDonationForm(),
        disaster_event_id: selectedEventId || "",
      });
      setIsDonationModalOpen(true);
      return;
    }

    try {
      const donation = await fetchDonationById(donationId);
      setDonationForm({
        id: donation.id,
        disaster_event_id: donation.disaster_event_id,
        donor_name: donation.donor_name,
        donor_type: donation.donor_type,
        contact_information: donation.contact_information || "",
        received_at: donation.received_at
          ? new Date(donation.received_at).toISOString().slice(0, 16)
          : "",
        status: donation.status,
        remarks: donation.remarks || "",
        items: donation.items || [],
      });
      setIsDonationModalOpen(true);
    } catch (error) {
      setPageErrorMessage(error.message || "Failed to load donation details.");
    }
  };

  const closeDonationModal = () => {
    setIsDonationModalOpen(false);
    setDonationForm(createDonationForm());
    setDonationErrorMessage("");
    setDonationItemErrorMessage("");
    setDonationItemDraft(createDonationItemForm());
    setEditingDonationItemId("");
  };

  const submitDonationNeed = async () => {
    setIsNeedSubmitting(true);
    setNeedErrorMessage("");

    try {
      const payload = {
        disaster_event_id: needForm.disaster_event_id,
        inventory_item_id: needForm.inventory_item_id,
        quantity_needed: Number(needForm.quantity_needed),
        priority_level: needForm.priority_level,
        notes: needForm.notes.trim() || null,
        is_active: needForm.is_active,
      };

      if (needForm.id) {
        await updateDonationNeed(needForm.id, payload);
        setSuccessMessage("Donation need updated successfully.");
      } else {
        await createDonationNeed(payload);
        setSuccessMessage("Donation need created successfully.");
      }

      closeNeedModal();
      await loadPageData(selectedEventId);
    } catch (error) {
      setNeedErrorMessage(error.message || "Failed to save donation need.");
    } finally {
      setIsNeedSubmitting(false);
    }
  };

  const submitDonation = async () => {
    setIsDonationSubmitting(true);
    setDonationErrorMessage("");

    try {
      const payload = {
        disaster_event_id: donationForm.disaster_event_id,
        donor_name: donationForm.donor_name.trim(),
        donor_type: donationForm.donor_type,
        contact_information: donationForm.contact_information.trim() || null,
        received_at: donationForm.received_at
          ? new Date(donationForm.received_at).toISOString()
          : null,
        status: donationForm.status,
        remarks: donationForm.remarks.trim() || null,
      };

      if (!donationForm.id) {
        if (donationForm.items.length === 0) {
          throw new Error("Add at least one donated item before saving the donation record.");
        }

        await createDonation({
          ...payload,
          items: donationForm.items.map((item) => ({
            inventory_item_id: item.inventory_item_id,
            quantity_received: Number(item.quantity_received),
            remarks: item.remarks || null,
            expiration_date: item.expiration_date || null,
            storage_location: item.storage_location || null,
          })),
        });
        setSuccessMessage("Donation recorded successfully.");
      } else {
        await updateDonation(donationForm.id, payload);
        setSuccessMessage("Donation updated successfully.");
      }

      closeDonationModal();
      await loadPageData(selectedEventId);
    } catch (error) {
      setDonationErrorMessage(error.message || "Failed to save donation.");
    } finally {
      setIsDonationSubmitting(false);
    }
  };

  const addDraftDonationItem = () => {
    setDonationItemErrorMessage("");

    if (!donationItemDraft.inventory_item_id) {
      setDonationItemErrorMessage("Select an inventory item before adding it.");
      return;
    }

    setDonationForm((currentForm) => ({
      ...currentForm,
      items: [
        ...currentForm.items,
        {
          ...donationItemDraft,
          inventory_item_id: donationItemDraft.inventory_item_id,
          quantity_received: Number(donationItemDraft.quantity_received),
          inventory_item: inventoryItems.find(
            (item) => item.id === donationItemDraft.inventory_item_id,
          ),
        },
      ],
    }));
    setDonationItemDraft(createDonationItemForm());
  };

  const startEditDonationItem = (item) => {
    setEditingDonationItemId(item.id);
    setDonationItemDraft({
      inventory_item_id: item.inventory_item_id,
      quantity_received: item.quantity_received,
      remarks: item.remarks || "",
      expiration_date: item.inventory_batch?.expiration_date
        ? item.inventory_batch.expiration_date.slice(0, 10)
        : "",
      storage_location: item.inventory_batch?.storage_location || "",
    });
  };

  const cancelEditDonationItem = () => {
    setEditingDonationItemId("");
    setDonationItemDraft(createDonationItemForm());
    setDonationItemErrorMessage("");
  };

  const saveExistingDonationItem = async () => {
    if (!editingDonationItemId) {
      return;
    }

    setDonationItemErrorMessage("");

    try {
      await updateDonationItem(editingDonationItemId, {
        inventory_item_id: donationItemDraft.inventory_item_id,
        quantity_received: Number(donationItemDraft.quantity_received),
        remarks: donationItemDraft.remarks.trim() || null,
        expiration_date: donationItemDraft.expiration_date || null,
        storage_location: donationItemDraft.storage_location.trim() || null,
      });

      const refreshedDonation = await fetchDonationById(donationForm.id);
      setDonationForm((currentForm) => ({
        ...currentForm,
        items: refreshedDonation.items || [],
      }));
      setSuccessMessage("Donation item updated successfully.");
      cancelEditDonationItem();
      await loadPageData(selectedEventId);
    } catch (error) {
      setDonationItemErrorMessage(error.message || "Failed to update donation item.");
    }
  };

  const removeDraftDonationItem = (itemToRemove) => {
    setDonationForm((currentForm) => ({
      ...currentForm,
      items: currentForm.items.filter((item) => item !== itemToRemove),
    }));
  };

  const removeExistingDonationItem = async (item) => {
    const userConfirmed = window.confirm(
      "Remove this donation item from the donation record?",
    );

    if (!userConfirmed) {
      return;
    }

    try {
      await deleteDonationItem(item.id);
      const refreshedDonation = await fetchDonationById(donationForm.id);
      setDonationForm((currentForm) => ({
        ...currentForm,
        items: refreshedDonation.items || [],
      }));
      setSuccessMessage("Donation item deleted successfully.");
      cancelEditDonationItem();
      await loadPageData(selectedEventId);
    } catch (error) {
      setDonationItemErrorMessage(error.message || "Failed to delete donation item.");
    }
  };

  const addExistingDonationItem = async () => {
    if (!donationForm.id) {
      addDraftDonationItem();
      return;
    }

    setDonationItemErrorMessage("");

    try {
      await createDonationItem(donationForm.id, {
        inventory_item_id: donationItemDraft.inventory_item_id,
        quantity_received: Number(donationItemDraft.quantity_received),
        remarks: donationItemDraft.remarks.trim() || null,
        expiration_date: donationItemDraft.expiration_date || null,
        storage_location: donationItemDraft.storage_location.trim() || null,
      });
      const refreshedDonation = await fetchDonationById(donationForm.id);
      setDonationForm((currentForm) => ({
        ...currentForm,
        items: refreshedDonation.items || [],
      }));
      setDonationItemDraft(createDonationItemForm());
      setSuccessMessage("Donation item added successfully.");
      await loadPageData(selectedEventId);
    } catch (error) {
      setDonationItemErrorMessage(error.message || "Failed to add donation item.");
    }
  };

  const handleDeleteDonationNeed = async (donationNeed) => {
    const confirmed = window.confirm(
      `Delete the donation need for ${donationNeed.inventory_item?.item_name || "this item"}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteDonationNeed(donationNeed.id);
      setSuccessMessage("Donation need deleted successfully.");
      await loadPageData(selectedEventId);
    } catch (error) {
      setPageErrorMessage(error.message || "Failed to delete donation need.");
    }
  };

  const handleDeleteDonation = async (donation) => {
    const confirmed = window.confirm(
      `Delete the donation record for ${donation.donor_name}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteDonation(donation.id);
      setSuccessMessage("Donation deleted successfully.");
      await loadPageData(selectedEventId);
    } catch (error) {
      setPageErrorMessage(error.message || "Failed to delete donation.");
    }
  };

  const pageTitle = canManageDonations
    ? "DONATION MANAGEMENT"
    : "DONATION SUMMARY";
  const pageDescription = canManageDonations
    ? "Manage published donation needs, record received donations, and review donor transparency summaries using live database-backed data."
    : "Review published donation needs and donor transparency summaries using live database-backed data.";

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <button
          type="button"
          onClick={() =>
            navigate(getDefaultRouteForRole(currentRole), { replace: true })
          }
          style={backButtonStyles}
        >
          ← Back
        </button>
      </div>

      <PageHeader
        title={pageTitle}
        description={pageDescription}
      />

      <section style={shellStyles.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", flex: "1 1 760px" }}>
            <select
              value={selectedEventId}
              onChange={(event) => {
                const nextEventId = event.target.value;
                setSelectedEventId(nextEventId);
                loadPageData(nextEventId);
              }}
              style={{ ...inputStyles, maxWidth: "340px" }}
            >
              <option value="">All Events</option>
              {disasterEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.event_code} - {event.title}
                </option>
              ))}
            </select>

            {activeTab === "needs" ? (
              <SearchBar
                value={needSearch}
                onChange={setNeedSearch}
                placeholder="Search needs by item, event, or notes"
              />
            ) : activeTab === "donations" ? (
              <SearchBar
                value={donationSearch}
                onChange={setDonationSearch}
                placeholder="Search donations by donor, event, or remarks"
              />
            ) : null}
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => loadPageData(selectedEventId)}
              style={pageHeaderStyles.secondaryButton}
            >
              Refresh
            </button>
            {canManageDonations && activeTab === "needs" ? (
              <button type="button" onClick={() => openNeedModal()} style={pageHeaderStyles.primaryButton}>
                Create Donation Need
              </button>
            ) : canManageDonations && activeTab === "donations" ? (
              <button type="button" onClick={() => openDonationModal()} style={pageHeaderStyles.primaryButton}>
                Record Donation
              </button>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginTop: "18px",
          }}
        >
          {availableTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                border: "none",
                borderRadius: "999px",
                padding: "10px 16px",
                backgroundColor: activeTab === tab.key ? "#dbe8f6" : "#eef5fc",
                color: activeTab === tab.key ? "#17324d" : "#40617f",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {successMessage ? (
          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "14px",
              backgroundColor: "#edfdf4",
              border: "1px solid #ccebd9",
              color: "#1f6b48",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {successMessage}
          </div>
        ) : null}

        {pageErrorMessage ? (
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
            {pageErrorMessage}
          </div>
        ) : null}
      </section>

      {activeTab === "needs" ? (
        <section style={shellStyles.card}>
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Published Donation Needs</h3>
            <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
              Current filter: {selectedEventLabel}
            </p>
          </div>

          {isLoading ? (
            <p style={shellStyles.mutedText}>Loading donation needs...</p>
          ) : filteredDonationNeeds.length === 0 ? (
            <p style={shellStyles.mutedText}>
              No donation needs are available for the current filters.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {[
                      "Event",
                      "Item",
                      "Quantity Needed",
                      "Priority",
                      "Visibility",
                      "Notes",
                      ...(canManageDonations ? ["Actions"] : []),
                    ].map((label) => (
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
                  {filteredDonationNeeds.map((need) => (
                    <tr key={need.id}>
                      <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                        {need.disaster_event?.event_code} - {need.disaster_event?.title}
                      </td>
                      <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                        {need.inventory_item?.item_name}
                      </td>
                      <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                        {need.quantity_needed}
                      </td>
                      <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                        <StatusBadge label={need.priority_level} />
                      </td>
                      <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                        <StatusBadge label={need.is_active ? "ACTIVE" : "INACTIVE"} />
                      </td>
                      <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                        {need.notes || "--"}
                      </td>
                      {canManageDonations ? (
                        <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button type="button" onClick={() => openNeedModal(need)} style={compactButtonStyles}>
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDonationNeed(need)}
                              style={{ ...compactButtonStyles, color: "#b91c1c", borderColor: "#f1d2cc" }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "donations" ? (
        <section style={shellStyles.card}>
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Received Donations</h3>
            <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
              Current filter: {selectedEventLabel}
            </p>
          </div>

          {isLoading ? (
            <p style={shellStyles.mutedText}>Loading donation records...</p>
          ) : filteredDonations.length === 0 ? (
            <p style={shellStyles.mutedText}>
              No donations are available for the current filters yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Received At", "Donor", "Event", "Status", "Items", "Quantity", "Actions"].map((label) => (
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
                  {filteredDonations.map((donation) => (
                    <tr key={donation.id}>
                      <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                        {formatDateTime(donation.received_at)}
                      </td>
                      <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                        <div style={{ fontWeight: 700 }}>{donation.donor_name}</div>
                        <div style={{ color: "#60738a", fontSize: "13px" }}>{donation.donor_type}</div>
                      </td>
                      <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                        {donation.disaster_event?.event_code} - {donation.disaster_event?.title}
                      </td>
                      <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                        <StatusBadge label={donation.status} />
                      </td>
                      <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                        {donation.item_count}
                      </td>
                      <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                        {donation.total_quantity_received}
                      </td>
                      <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button type="button" onClick={() => openDonationModal(donation.id)} style={compactButtonStyles}>
                            View / Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDonation(donation)}
                            style={{ ...compactButtonStyles, color: "#b91c1c", borderColor: "#f1d2cc" }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "transparency" ? (
        <>
          <section style={shellStyles.card}>
            <div style={shellStyles.statGrid}>
              <div>
                <p style={shellStyles.mutedText}>Total Donations Received</p>
                <p style={shellStyles.statValue}>
                  {portalData.transparency_summary?.total_donations_received || 0}
                </p>
              </div>
              <div>
                <p style={shellStyles.mutedText}>Total Quantity Received</p>
                <p style={shellStyles.statValue}>
                  {portalData.transparency_summary?.total_quantity_received || 0}
                </p>
              </div>
              <div>
                <p style={shellStyles.mutedText}>Total Donated Items Distributed</p>
                <p style={shellStyles.statValue}>
                  {portalData.transparency_summary?.total_donated_items_distributed || 0}
                </p>
              </div>
              <div>
                <p style={shellStyles.mutedText}>Remaining Donated Inventory</p>
                <p style={shellStyles.statValue}>
                  {portalData.transparency_summary?.remaining_donated_inventory || 0}
                </p>
              </div>
            </div>
          </section>

          <section style={shellStyles.card}>
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>Received vs Distributed Per Item</h3>
              <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
                Current filter: {selectedEventLabel}
              </p>
            </div>

            {(portalData.transparency_summary?.received_vs_distributed || []).length === 0 ? (
              <p style={shellStyles.mutedText}>
                No donated inventory summaries are available yet.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Item", "Received", "Distributed", "Remaining"].map((label) => (
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
                    {portalData.transparency_summary.received_vs_distributed.map((row) => (
                      <tr key={row.inventory_item_id}>
                        <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                          {row.item_name}
                        </td>
                        <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                          {row.quantity_received}
                        </td>
                        <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                          {row.quantity_distributed}
                        </td>
                        <td style={{ padding: "14px", borderBottom: "1px solid #edf3f8" }}>
                          {row.quantity_remaining}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      {canManageDonations ? (
        <DonationNeedModal
          isOpen={isNeedModalOpen}
          formValues={needForm}
          inventoryItems={inventoryItems}
          disasterEvents={disasterEvents}
          isSubmitting={isNeedSubmitting}
          errorMessage={needErrorMessage}
          onClose={closeNeedModal}
          onChange={(fieldName, value) =>
            setNeedForm((currentValues) => ({
              ...currentValues,
              [fieldName]: value,
            }))
          }
          onSubmit={submitDonationNeed}
        />
      ) : null}

      {canManageDonations ? (
        <DonationModal
          isOpen={isDonationModalOpen}
          formValues={donationForm}
          itemDraft={donationItemDraft}
          inventoryItems={inventoryItems}
          disasterEvents={disasterEvents}
          isSubmitting={isDonationSubmitting}
          errorMessage={donationErrorMessage}
          itemErrorMessage={donationItemErrorMessage}
          editingItemId={editingDonationItemId}
          onClose={closeDonationModal}
          onFormChange={(fieldName, value) =>
            setDonationForm((currentValues) => ({
              ...currentValues,
              [fieldName]: value,
            }))
          }
          onItemDraftChange={(fieldName, value) =>
            setDonationItemDraft((currentValues) => ({
              ...currentValues,
              [fieldName]: value,
            }))
          }
          onAddItemDraft={donationForm.id ? addExistingDonationItem : addDraftDonationItem}
          onEditExistingItem={saveExistingDonationItem}
          onDeleteExistingItem={removeExistingDonationItem}
          onRemoveDraftItem={removeDraftDonationItem}
          onStartEditItem={startEditDonationItem}
          onCancelEditItem={cancelEditDonationItem}
          onSubmit={submitDonation}
        />
      ) : null}
    </>
  );
};

export default DonationManagementPage;
