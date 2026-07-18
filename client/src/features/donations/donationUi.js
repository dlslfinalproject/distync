export const donorTypes = [
  "INDIVIDUAL",
  "NGO",
  "PRIVATE ORGANIZATION",
  "GOVERNMENT PARTNER",
  "OTHER",
];

export const donationStatuses = [
  "RECEIVED",
  "PARTIALLY_DISTRIBUTED",
  "DISTRIBUTED",
  "CANCELLED",
];

export const priorityLevels = ["URGENT", "HIGH", "MEDIUM", "LOW"];

export const NO_EXPORT_DATA_MESSAGE = "No available data to export.";

export const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(21, 40, 63, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1000,
};

export const modalStyles = {
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

export const inputStyles = {
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

export const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
};

export const compactButtonStyles = {
  border: "1px solid #c6d8ea",
  borderRadius: "12px",
  padding: "8px 12px",
  backgroundColor: "#f8fbfe",
  color: "#2a4c6f",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

export const exportMenuStyles = {
  position: "absolute",
  top: "calc(100% + 10px)",
  right: 0,
  minWidth: "220px",
  padding: "8px",
  borderRadius: "14px",
  backgroundColor: "#ffffff",
  border: "1px solid #d7e2ef",
  boxShadow: "0 18px 36px rgba(23, 50, 77, 0.16)",
  display: "grid",
  gap: "6px",
  zIndex: 20,
};

export const exportMenuButtonStyles = {
  border: "none",
  borderRadius: "10px",
  backgroundColor: "#f8fbfe",
  color: "#264564",
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
};

export const backButtonStyles = {
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

export const createNeedForm = () => ({
  disaster_event_id: "",
  inventory_item_id: "",
  quantity_needed: 0,
  priority_level: "MEDIUM",
  notes: "",
  is_active: true,
});

export const createDonationItemForm = () => ({
  entry_type: "ITEM",
  item_definition_mode: "NEW",
  inventory_item_id: "",
  new_item_name: "",
  new_item_category: "perishable",
  new_item_unit_of_measure: "pc",
  new_item_packaging: "pack",
  pack_definition_mode: "NEW",
  relief_pack_template_id: "",
  new_pack_name: "",
  pack_item_inventory_item_id: "",
  pack_item_quantity_required: "1",
  relief_pack_items: [],
  relief_pack_quantity: "1",
  quantity_received: "1",
  remarks: "",
  expiration_date: "",
  storage_location: "",
});

export const createDonationForm = () => ({
  disaster_event_id: "",
  donor_name: "",
  donor_type: "INDIVIDUAL",
  contact_information: "",
  received_at: "",
  status: "RECEIVED",
  remarks: "",
  items: [],
});
