import React from "react";
import { FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";

const COLORS = {
  muted: "#6b8298",
};

const scanModalOverlayStyle = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(21, 40, 63, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1200,
};

const scanModalStyle = {
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

const scanModalInputStyle = {
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

const scanModalLabelStyle = {
  display: "block",
  marginBottom: "8px",
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
};

const styles = {
  scanModalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "20px",
  },

  scanModalTitle: {
    margin: 0,
    color: "#17324d",
    fontSize: "26px",
  },

  scanModalDescription: {
    margin: "8px 0 0",
    color: COLORS.muted,
    fontSize: "14px",
    lineHeight: 1.5,
    maxWidth: "560px",
  },

  scanModalSectionTitle: {
    margin: "0 0 12px",
    color: "#17324d",
  },

  scanModalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "10px",
    flexWrap: "wrap",
  },
};

const InventoryItemScanModal = ({
  isOpen,
  scanForm,
  onClose,
  onSubmit,
  onInputChange,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div style={scanModalOverlayStyle}>
      <div style={scanModalStyle}>
        <div style={styles.scanModalHeader}>
          <div>
            <h3 style={styles.scanModalTitle}>Scan Item</h3>
            <p style={styles.scanModalDescription}>
              Actual barcode scanner or scanning app support can be used later.
              For now, enter the barcode number manually to add the item
              details.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={pageHeaderStyles.secondaryButton}
          >
            <FiX />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={styles.scanModalSectionTitle}>Scan Details</h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "18px",
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={scanModalLabelStyle}>Barcode Number</label>
                <input
                  type="text"
                  value={scanForm.barcodeNumber}
                  onChange={(e) =>
                    onInputChange("barcodeNumber", e.target.value)
                  }
                  style={scanModalInputStyle}
                  placeholder="Enter barcode number"
                />
              </div>

              <div>
                <label style={scanModalLabelStyle}>Reorder Level</label>
                <input
                  type="text"
                  value={scanForm.reorderLevel}
                  onChange={(e) =>
                    onInputChange("reorderLevel", e.target.value)
                  }
                  style={scanModalInputStyle}
                  placeholder="Set reorder level"
                />
              </div>
            </div>
          </section>

          <div style={styles.scanModalFooter}>
            <button
              type="button"
              onClick={onClose}
              style={pageHeaderStyles.secondaryButton}
            >
              Cancel
            </button>

            <button
              type="button"
              style={pageHeaderStyles.primaryButton}
              onClick={onSubmit}
            >
              Add Item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryItemScanModal;
