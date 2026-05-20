import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { pageHeaderStyles } from "../layout/PageHeader";
import HouseholdFormSection from "./HouseholdFormSection";
import FamilyHeadSection from "./FamilyHeadSection";
import MembersSection from "./MembersSection";
import HouseholdConditionsSection from "./HouseholdConditionsSection";
import { FiX } from "react-icons/fi";

const modalStyles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(16, 35, 52, 0.48)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "28px",
    boxSizing: "border-box",
    zIndex: 1000,
  },
  modal: {
    width: "min(1120px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    borderRadius: "24px",
    backgroundColor: "#f7fbff",
    boxShadow: "0 24px 48px rgba(18, 39, 60, 0.22)",
    border: "1px solid #d4e0ec",
    padding: "clamp(18px, 2vw, 28px)",
    boxSizing: "border-box",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "20px",
  },
  closeButton: {
    border: "1px solid #c4d6e8",
    backgroundColor: "#ffffff",
    color: "#2a4c6f",
    borderRadius: "14px",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  sections: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  feedback: {
    borderRadius: "14px",
    padding: "14px 16px",
    fontSize: "14px",
    fontWeight: 600,
  },
};

const RegisterFamilyModal = ({ isOpen, onClose, form }) => {
  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    form.resetForm();
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const wasSuccessful = await form.submitRegistration();

    if (wasSuccessful) {
      handleClose();
    }
  };

  return (
    <div style={modalStyles.backdrop}>
      <div style={modalStyles.modal}>
        <div style={modalStyles.topBar}>
          <div>
            <h2 style={{ ...pageHeaderStyles.title, fontSize: "30px" }}>
              {form.isEditMode ? "Edit Household" : "Register Family"}
            </h2>
            <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
              {form.isEditMode
                ? "Update the household profile and manage members below. You can add, edit, or remove incorrectly encoded members before saving."
                : "Complete the household, family head, member, and condition details below."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={modalStyles.closeButton}
          >
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={modalStyles.sections}>
          {form.errorMessage ? (
            <div
              style={{
                ...modalStyles.feedback,
                backgroundColor: "#fdecef",
                color: "#9c4151",
                border: "1px solid #f3c6cf",
              }}
            >
              {form.errorMessage}
            </div>
          ) : null}

          {form.successMessage ? (
            <div
              style={{
                ...modalStyles.feedback,
                backgroundColor: "#ecf9f1",
                color: "#2d7a51",
                border: "1px solid #c9ebd8",
              }}
            >
              {form.successMessage}
            </div>
          ) : null}

          <HouseholdFormSection form={form} />
          <FamilyHeadSection form={form} />
          <MembersSection form={form} />
          <HouseholdConditionsSection form={form} />

          <section style={shellStyles.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <p style={shellStyles.mutedText}>
                Household Size: <strong>{form.memberCount}</strong>
              </p>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleClose}
                  style={pageHeaderStyles.secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    form.isSubmitting ||
                    form.isLoadingOptions ||
                    form.isProcessingPhoto
                  }
                  style={{
                    ...pageHeaderStyles.primaryButton,
                    opacity:
                      form.isSubmitting ||
                      form.isLoadingOptions ||
                      form.isProcessingPhoto
                        ? 0.7
                        : 1,
                  }}
                >
                  {form.isSubmitting
                    ? form.isEditMode
                      ? "Updating..."
                      : "Saving..."
                    : form.isProcessingPhoto
                      ? "Processing Photo..."
                      : form.isEditMode
                        ? "Save Changes"
                        : "Register"}
                </button>
              </div>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
};

export default RegisterFamilyModal;
