import React, { useEffect, useState } from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";
import { FiX } from "react-icons/fi";

/* ================= STYLES ================= */

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
  width: "min(860px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#eef5fb",
  borderRadius: "22px",
  border: "1px solid #d7e2ef",
  boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  padding: "24px",
  boxSizing: "border-box",
};

const scrollContainerStyles = {
  flex: 1,
  overflowY: "auto",
  margin: "0",
  paddingRight: "4px",
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
  outline: "none",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
};

const eventCardStyles = (isSelected) => ({
  display: "flex",
  alignItems: "center",
  gap: "15px",
  padding: "16px 20px",
  borderRadius: "14px",
  border: "1px solid #dcdde1",
  backgroundColor: isSelected ? "#f8fbfe" : "#ffffff",
  marginBottom: "12px",
  cursor: "pointer",
  transition: "all 0.2s ease",
});

const primaryBtnStyle = {
  ...pageHeaderStyles.primaryButton,
  minHeight: "48px",
  borderRadius: "14px",
  padding: "12px 24px",
  fontWeight: 600,
};

const secondaryBtnStyle = {
  ...pageHeaderStyles.secondaryButton,
  minHeight: "48px",
  borderRadius: "14px",
  padding: "12px 24px",
  fontWeight: 600,
};

const helperTextStyles = {
  margin: "0 0 14px",
  color: "#6b8298",
  fontSize: "14px",
  fontWeight: 500,
};

const itemPreviewWrapStyles = {
  border: "1px solid #d4dfeb",
  borderRadius: "14px",
  backgroundColor: "#f8fbfe",
  padding: "14px 16px",
};

const itemPreviewTitleStyles = {
  margin: "0 0 10px",
  color: "#17324d",
  fontSize: "14px",
  fontWeight: 700,
};

const itemChipStyles = {
  display: "inline-flex",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: "999px",
  border: "1px solid #d4dfeb",
  backgroundColor: "#ffffff",
  color: "#385a7b",
  fontSize: "13px",
  fontWeight: 600,
  marginRight: "8px",
  marginBottom: "8px",
};

const ReliefPackTemplateFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [step, setStep] = useState(1);
  const [formValues, setFormValues] = useState({
    packName: "",
    selectedItem: "",
    quantity: "",
    familyPerPack: "",
  });

  const [selectedEvents, setSelectedEvents] = useState([1, 2]);
  const [events] = useState([
    { id: 1, name: "Typhoon Kristine", families: "1250 families" },
    { id: 2, name: "Earthquake 5.2", families: "40 families" },
    { id: 3, name: "Landslide (Bagong Pook)", families: "40 families" },
    { id: 4, name: "Flood Zone B", families: "300 families" },
  ]);
  const [packItems, setPackItems] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setFormValues({
      packName: "",
      selectedItem: "",
      quantity: "",
      familyPerPack: "",
    });
    setSelectedEvents([1, 2]);
    setPackItems([]);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const toggleEvent = (id) => {
    setSelectedEvents((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const handleNext = () => setStep(2);
  const handlePrevious = () => setStep(1);

  const handleAddItem = () => {
    if (!formValues.selectedItem || !formValues.quantity) return;

    setPackItems((prev) => [
      ...prev,
      {
        id: `${formValues.selectedItem}-${Date.now()}`,
        item: formValues.selectedItem,
        quantity: formValues.quantity,
      },
    ]);

    setFormValues((prev) => ({
      ...prev,
      selectedItem: "",
      quantity: "",
    }));
  };

  const handleFinalSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...formValues, disasterEvents: selectedEvents, items: packItems });
  };

  return (
    <div style={overlayStyles}>
      <div style={modalStyles}>
        {/* Header */}
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
              Add Relief Pack
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={pageHeaderStyles.secondaryButton}
          >
            <FiX />
          </button>
        </div>

        <div style={scrollContainerStyles} className="custom-scrollbar">
          <form
            onSubmit={handleFinalSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
          >
            {step === 1 ? (
              <>
                {/* SECTION 1 */}
                <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
                  <h3 style={{ margin: "0 0 12px", color: "#17324d" }}>
                    Pack Information
                  </h3>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "18px",
                    }}
                  >
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={labelStyles}>Pack Name</label>
                      <input
                        name="packName"
                        style={inputStyles}
                        value={formValues.packName}
                        onChange={handleInputChange}
                        placeholder="e.g. Standard Food Pack"
                      />
                    </div>

                    <div>
                      <label style={labelStyles}>Add Item to Pack</label>
                      <select
                        name="selectedItem"
                        style={inputStyles}
                        value={formValues.selectedItem}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Item</option>
                        <option value="rice">Rice (5kg)</option>
                        <option value="canned">Canned Goods</option>
                      </select>
                    </div>

                    <div>
                      <label style={labelStyles}>Quantity</label>
                      <input
                        name="quantity"
                        type="number"
                        style={inputStyles}
                        value={formValues.quantity}
                        onChange={handleInputChange}
                        placeholder="0"
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
                        onClick={handleAddItem}
                        style={{ ...primaryBtnStyle, width: "100%" }}
                      >
                        + Add Item
                      </button>
                    </div>

                    <div>
                      <label style={labelStyles}>Family per Pack</label>
                      <input
                        name="familyPerPack"
                        style={inputStyles}
                        value={formValues.familyPerPack}
                        onChange={handleInputChange}
                        placeholder="e.g. 1 family"
                      />
                    </div>
                  </div>
                </section>

                {/* SECTION 2 */}
                <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
                  <h3 style={{ margin: "0 0 12px", color: "#17324d" }}>
                    Pack Items
                  </h3>

                  {packItems.length === 0 ? (
                    <p style={helperTextStyles}>
                      No items have been added to this pack yet.
                    </p>
                  ) : (
                    <div style={itemPreviewWrapStyles}>
                      <h4 style={itemPreviewTitleStyles}>Added Items</h4>
                      <div>
                        {packItems.map((packItem) => (
                          <span key={packItem.id} style={itemChipStyles}>
                            {packItem.item} · {packItem.quantity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              </>
            ) : (
              /* SECTION 3 */
              <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
                <h3 style={{ margin: "0 0 12px", color: "#17324d" }}>
                  Select Disaster Events
                </h3>

                <p style={helperTextStyles}>
                  Choose one or more disaster events where this relief pack will be available.
                </p>

                {events.map((event) => (
                  <div
                    key={event.id}
                    style={eventCardStyles(selectedEvents.includes(event.id))}
                    onClick={() => toggleEvent(event.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event.id)}
                      onChange={() => {}}
                      style={{ width: "20px", height: "20px", cursor: "pointer" }}
                    />
                    <div>
                      <div
                        style={{
                          fontWeight: "700",
                          color: "#2c3e50",
                          fontSize: "16px",
                        }}
                      >
                        {event.name}
                      </div>
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#7f8c8d",
                        }}
                      >
                        {event.families}
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Footer Buttons */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                marginTop: "10px",
                flexWrap: "wrap",
              }}
            >
              {step === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    style={secondaryBtnStyle}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    style={primaryBtnStyle}
                  >
                    Next
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handlePrevious}
                    style={secondaryBtnStyle}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={isSubmitting}
                    style={{
                      ...primaryBtnStyle,
                      opacity: isSubmitting ? 0.7 : 1,
                    }}
                  >
                    {isSubmitting ? "Creating..." : "Create Pack"}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
        `}</style>
      </div>
    </div>
  );
};

export default ReliefPackTemplateFormModal;