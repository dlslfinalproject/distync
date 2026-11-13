import React, { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { pageHeaderStyles } from "../layout/PageHeader";

const overlayStyles = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(21, 40, 63, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  zIndex: 1500,
};

const modalStyles = {
  width: "min(560px, 100%)",
  backgroundColor: "#eef5fb",
  borderRadius: "22px",
  border: "1px solid #d7e2ef",
  boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  padding: "24px",
  boxSizing: "border-box",
};

const sectionCardStyles = {
  border: "1px solid #d7e2ef",
  borderRadius: "18px",
  padding: "18px 20px",
  backgroundColor: "#ffffff",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
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

const lockedInputStyles = {
  ...inputStyles,
  backgroundColor: "#eef5fb",
  color: "#5f7891",
};

const errorTextStyles = {
  margin: "6px 0 0",
  color: "#c53030",
  fontSize: "12px",
  lineHeight: 1.4,
};

const errorBoxStyles = {
  marginTop: "4px",
  padding: "12px 14px",
  borderRadius: "12px",
  backgroundColor: "#fff1f2",
  color: "#e11d48",
  fontSize: "13px",
  fontWeight: 500,
  border: "1px solid #ffe4e6",
};

const formatDateInputValue = (value) => {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
};

const getTodayDateInputValue = () => {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
};

const isValidDateInputValue = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsedDate.getTime());
};

const InventoryBatchExpiryModal = ({
  isOpen,
  batch,
  itemUnit = "pc",
  isPerishable = false,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [expirationDate, setExpirationDate] = useState("");
  const [fieldError, setFieldError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setExpirationDate(formatDateInputValue(batch?.expiration_date));
    setFieldError("");
  }, [batch, isOpen]);

  if (!isOpen || !batch) {
    return null;
  }

  const handleSubmit = (event) => {
    event.preventDefault();

    if (isPerishable && !expirationDate) {
      setFieldError("Expiration date is required.");
      return;
    }

    if (!expirationDate) {
      setFieldError("");
      onSubmit({
        expiration_date: null,
      });
      return;
    }

    if (!isValidDateInputValue(expirationDate)) {
      setFieldError("Enter a valid expiration date.");
      return;
    }

    if (expirationDate < getTodayDateInputValue()) {
      setFieldError("Expiration date cannot be earlier than today.");
      return;
    }

    setFieldError("");
    onSubmit({
      expiration_date: expirationDate,
    });
  };

  return (
    <div className="inventory-batch-expiry-modal-backdrop" style={overlayStyles}>
      <div className="inventory-batch-expiry-modal" style={modalStyles}>
        <div
          className="inventory-batch-expiry-modal-topbar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ margin: 0, color: "#17324d", fontSize: "26px" }}>
            Edit Batch Expiry
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={pageHeaderStyles.secondaryButton}
            aria-label="Close"
          >
            <FiX />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "18px" }}
        >
          <section className="inventory-batch-expiry-section" style={sectionCardStyles}>
            <div
              className="inventory-batch-expiry-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
                gap: "18px",
              }}
            >
              <div>
                <label style={labelStyles}>Batch Number</label>
                <input
                  type="text"
                  value={batch.batch_no || "--"}
                  readOnly
                  style={lockedInputStyles}
                />
              </div>
              <div>
                <label style={labelStyles}>Current Stock</label>
                <input
                  type="text"
                  value={`${Number(batch.quantity_available || 0).toLocaleString()} ${itemUnit}`}
                  readOnly
                  style={lockedInputStyles}
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="batch_expiration_date" style={labelStyles}>
                  Expiration Date
                </label>
                <input
                  id="batch_expiration_date"
                  type="date"
                  value={expirationDate}
                  onChange={(event) => {
                    setExpirationDate(event.target.value);
                    setFieldError("");
                  }}
                  style={inputStyles}
                  aria-invalid={Boolean(fieldError)}
                />
                {fieldError ? <p style={errorTextStyles}>{fieldError}</p> : null}
              </div>
            </div>
          </section>

          {errorMessage ? <div style={errorBoxStyles}>{errorMessage}</div> : null}

          <div
            className="inventory-batch-expiry-actions"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={pageHeaderStyles.secondaryButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                ...pageHeaderStyles.primaryButton,
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryBatchExpiryModal;
