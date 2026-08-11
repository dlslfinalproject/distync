import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import {
  inputStyles,
  labelStyles,
  modalStyles,
  overlayStyles,
  priorityLevels,
} from "../../features/donations/donationUi";

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
                {disasterEvents.map((eventRow) => (
                  <option key={eventRow.id} value={eventRow.id}>
                    {eventRow.event_code} - {eventRow.title}
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

export default DonationNeedModal;
