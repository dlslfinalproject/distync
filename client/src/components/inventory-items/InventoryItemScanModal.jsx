import React, { useEffect, useRef } from "react";
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
  width: "min(720px, 100%)",
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
  minHeight: "52px",
  padding: "14px 16px",
  borderRadius: "14px",
  border: "1px solid #d2deea",
  boxSizing: "border-box",
  fontSize: "16px",
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
  helperText: {
    margin: "10px 0 0",
    color: "#4f677f",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  feedbackText: {
    margin: "10px 0 0",
    color: "#17324d",
    fontSize: "13px",
    fontWeight: 600,
  },
  scannerHintCard: {
    padding: "18px 20px",
    backgroundColor: "#f8fbfe",
    border: "1px solid #d7e2ef",
    borderRadius: "18px",
  },
  scannerStatus: {
    margin: 0,
    color: "#17324d",
    fontSize: "14px",
    fontWeight: 700,
  },
};

const normalizeBarcodeInput = (value) => {
  return String(value || "").replace(/\s+/g, "").trim();
};

const InventoryItemScanModal = ({
  isOpen,
  scanForm,
  matchedItemName,
  onClose,
  onSubmit,
  onInputChange,
}) => {
  const barcodeInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      barcodeInputRef.current?.focus();
      barcodeInputRef.current?.select();
    }, 50);

    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const trimmedBarcode = normalizeBarcodeInput(scanForm.barcodeNumber);

  return (
    <div style={scanModalOverlayStyle}>
      <div style={scanModalStyle}>
        <div style={styles.scanModalHeader}>
          <div>
            <h3 style={styles.scanModalTitle}>Scan Item</h3>
            <p style={styles.scanModalDescription}>
              Scan a barcode or enter it manually.
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
          <section style={styles.scannerHintCard}>
            <h3 style={styles.scanModalSectionTitle}>Warehouse Scanner Input</h3>
            <p style={styles.scannerStatus}>Ready to scan.</p>
            <p style={styles.helperText}>
              Keep the barcode field selected while scanning.
            </p>
          </section>

          <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={styles.scanModalSectionTitle}>Barcode Details</h3>

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
                  ref={barcodeInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={scanForm.barcodeNumber}
                  onChange={(event) =>
                    onInputChange(
                      "barcodeNumber",
                      normalizeBarcodeInput(event.target.value),
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && trimmedBarcode) {
                      event.preventDefault();
                      onSubmit();
                    }
                  }}
                  style={scanModalInputStyle}
                  placeholder="Scan or enter barcode"
                />

                {matchedItemName && (
                  <p style={styles.feedbackText}>
                    Matched item: {matchedItemName}
                  </p>
                )}

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
              disabled={!trimmedBarcode}
            >
              {matchedItemName ? "Open Inventory Item" : "Continue to Add Item"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryItemScanModal;
