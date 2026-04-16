import React, { useState } from "react";

// --- Shared Styles ---
const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1000,
};

const modalStyles = {
  width: "min(650px, 100%)",
  maxHeight: "90vh",
  backgroundColor: "#ffffff",
  borderRadius: "22px",
  boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
  padding: "40px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
};

const scrollContainerStyles = {
  flex: 1,
  overflowY: "auto",
  margin: "10px 0",
  paddingRight: "8px",
};

const inputStyles = {
  width: "100%",
  height: "40px",
  padding: "8px 16px",
  borderRadius: "20px",
  border: "none",
  backgroundColor: "#e9ecef",
  boxSizing: "border-box",
  fontSize: "14px",
  color: "#333",
};

const labelStyles = {
  display: "block",
  marginBottom: "10px",
  color: "#2d3748",
  fontSize: "16px",
  fontWeight: "700",
};

const eventCardStyles = (isSelected) => ({
  display: "flex",
  alignItems: "center",
  gap: "15px",
  padding: "16px 20px",
  borderRadius: "14px",
  border: "1px solid #dcdde1",
  backgroundColor: isSelected ? "#f8f9fa" : "#ffffff",
  marginBottom: "12px",
  cursor: "pointer",
  transition: "all 0.2s ease",
});

const primaryBtnStyle = {
  backgroundColor: "#34495e",
  color: "white",
  border: "none",
  borderRadius: "20px",
  padding: "10px 24px",
  fontWeight: "600",
  cursor: "pointer",
};

const secondaryBtnStyle = {
  backgroundColor: "#dcdde1",
  color: "#2f3640",
  border: "none",
  borderRadius: "20px",
  padding: "10px 40px",
  fontWeight: "600",
  cursor: "pointer",
};

const ReliefPackTemplateFormModal = ({ isOpen, onClose, onSubmit, isSubmitting }) => {
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

  const handleFinalSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...formValues, disasterEvents: selectedEvents });
  };

  return (
    <div style={overlayStyles}>
      <div style={modalStyles}>
        {/* Header - Stays fixed */}
        <h2 style={{ margin: "0 0 8px 0", color: "#2c3e50", fontSize: "28px" }}>
          Add Relief Pack
        </h2>
        <h4 style={{ margin: "0 0 10px 0", color: "#34495e", fontSize: "18px", fontWeight: "700" }}>
          Pack Information
        </h4>

        <div style={scrollContainerStyles} className="custom-scrollbar">
          {step === 1 ? (
            /* --- STEP 1: Pack Details --- */
            <div style={{ padding: "10px 2px" }}>
              <div style={{ marginBottom: "25px", display: "flex", alignItems: "center", gap: "20px" }}>
                <label style={{ ...labelStyles, marginBottom: 0, minWidth: "120px" }}>Pack Name</label>
                <input
                  name="packName"
                  style={inputStyles}
                  value={formValues.packName}
                  onChange={handleInputChange}
                  placeholder="e.g. Standard Food Pack"
                />
              </div>

              <div style={{ display: "flex", gap: "15px", marginBottom: "25px", alignItems: "flex-end" }}>
                <div style={{ flex: 2 }}>
                  <label style={labelStyles}>Add Item to Pack</label>
                  <select name="selectedItem" style={{ ...inputStyles, appearance: "none" }} value={formValues.selectedItem} onChange={handleInputChange}>
                    <option value="">Select Item</option>
                    <option value="rice">Rice (5kg)</option>
                    <option value="canned">Canned Goods</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyles}>Quantity</label>
                  <input name="quantity" type="number" style={inputStyles} value={formValues.quantity} onChange={handleInputChange} />
                </div>
                <button type="button" style={{ ...primaryBtnStyle, height: "40px" }}>+ Add Item</button>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyles}>Family per Pack</label>
                <input name="familyPerPack" style={inputStyles} value={formValues.familyPerPack} onChange={handleInputChange} />
              </div>
            </div>
          ) : (
            /* --- STEP 2: Disaster Events --- */
            <div>
              <p style={{ margin: "0 0 15px 0", color: "#2c3e50", fontWeight: "600", fontSize: "16px" }}>
                Select Disaster Events
              </p>
              {events.map((event) => (
                <div key={event.id} style={eventCardStyles(selectedEvents.includes(event.id))} onClick={() => toggleEvent(event.id)}>
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event.id)}
                    onChange={() => {}} 
                    style={{ width: "20px", height: "20px", cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ fontWeight: "700", color: "#2c3e50", fontSize: "16px" }}>{event.name}</div>
                    <div style={{ fontSize: "13px", color: "#7f8c8d" }}>{event.families}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "20px" }}>
          {step === 1 ? (
            <>
              <button type="button" onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
              <button type="button" onClick={handleNext} style={{ ...primaryBtnStyle, padding: "10px 60px" }}>Next</button>
            </>
          ) : (
            <>
              <button type="button" onClick={handlePrevious} style={secondaryBtnStyle}>Previous</button>
              <button type="button" onClick={handleFinalSubmit} disabled={isSubmitting} style={{ ...primaryBtnStyle, padding: "10px 50px" }}>
                {isSubmitting ? "Creating..." : "Create Pack"}
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default ReliefPackTemplateFormModal;