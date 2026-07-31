import React, { useEffect, useState } from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { pageHeaderStyles } from "../layout/PageHeader";
import HouseholdFormSection from "./HouseholdFormSection";
import FamilyHeadSection from "./FamilyHeadSection";
import MembersSection from "./MembersSection";
import HouseholdConditionsSection from "./HouseholdConditionsSection";
import DataPrivacyConsentModal from "./DataPrivacyConsentModal";
import { FiX } from "react-icons/fi";
import {
  HOUSEHOLD_PRIVACY_CONFIRM_BUTTON_LABEL,
  HOUSEHOLD_PRIVACY_NOTICE_VERSION,
  HOUSEHOLD_REGISTRATION_FLOW_STEPS,
  getInitialHouseholdRegistrationFlowStep,
} from "../../features/household-registration/privacyNotice.mjs";

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
  const [flowStep, setFlowStep] = useState(
    HOUSEHOLD_REGISTRATION_FLOW_STEPS.PRIVACY_NOTICE,
  );
  const [isPrivacyConfirmed, setIsPrivacyConfirmed] = useState(false);
  const [privacyErrorMessage, setPrivacyErrorMessage] = useState("");
  const [pendingPrivacyAcknowledgment, setPendingPrivacyAcknowledgment] =
    useState(null);

  useEffect(() => {
    if (!isOpen) {
      setFlowStep(HOUSEHOLD_REGISTRATION_FLOW_STEPS.PRIVACY_NOTICE);
      setIsPrivacyConfirmed(false);
      setPrivacyErrorMessage("");
      setPendingPrivacyAcknowledgment(null);
      return;
    }

    setFlowStep(
      getInitialHouseholdRegistrationFlowStep({
        requiresPrivacyAcknowledgment: form.requiresPrivacyAcknowledgment,
      }),
    );
    setIsPrivacyConfirmed(false);
    setPrivacyErrorMessage("");
    setPendingPrivacyAcknowledgment(null);
  }, [form.requiresPrivacyAcknowledgment, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleClose = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setFlowStep(HOUSEHOLD_REGISTRATION_FLOW_STEPS.PRIVACY_NOTICE);
    setIsPrivacyConfirmed(false);
    setPrivacyErrorMessage("");
    setPendingPrivacyAcknowledgment(null);
    form.resetForm();
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setFlowStep(HOUSEHOLD_REGISTRATION_FLOW_STEPS.SUBMITTING);

    const wasSuccessful = await form.submitRegistration(
      pendingPrivacyAcknowledgment,
    );

    if (wasSuccessful) {
      setFlowStep(HOUSEHOLD_REGISTRATION_FLOW_STEPS.COMPLETED);
      handleClose();
      return;
    }

    setFlowStep(HOUSEHOLD_REGISTRATION_FLOW_STEPS.REGISTRATION_FORM);
  };

  const handleCancelPrivacyNotice = () => {
    if (form.isSubmitting) {
      return;
    }

    handleClose();
  };

  const handleAcknowledgePrivacyNotice = () => {
    const privacyAcknowledgment = form.createPrivacyAcknowledgment();

    setPendingPrivacyAcknowledgment(privacyAcknowledgment);
    setFlowStep(HOUSEHOLD_REGISTRATION_FLOW_STEPS.REGISTRATION_FORM);
    setPrivacyErrorMessage("");
    setIsPrivacyConfirmed(false);
    form.clearFormMessages();
  };

  const showPrivacyNotice =
    flowStep === HOUSEHOLD_REGISTRATION_FLOW_STEPS.PRIVACY_NOTICE;

  return (
    <>
      {flowStep === HOUSEHOLD_REGISTRATION_FLOW_STEPS.REGISTRATION_FORM ? (
        <div style={modalStyles.backdrop}>
          <div style={modalStyles.modal}>
            <div style={modalStyles.topBar}>
              <div>
                <h2 style={{ ...pageHeaderStyles.title, fontSize: "30px" }}>
                  {form.isEditMode ? "Edit Household" : "Register Family"}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                style={modalStyles.closeButton}
                aria-label="Close registration modal"
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
      ) : null}

      <DataPrivacyConsentModal
        isOpen={showPrivacyNotice}
        noticeVersion={HOUSEHOLD_PRIVACY_NOTICE_VERSION}
        isChecked={isPrivacyConfirmed}
        errorMessage={privacyErrorMessage}
        isSubmitting={false}
        confirmLabel={HOUSEHOLD_PRIVACY_CONFIRM_BUTTON_LABEL}
        onToggleChecked={(nextValue) => {
          setIsPrivacyConfirmed(nextValue);

          if (nextValue) {
            setPrivacyErrorMessage("");
          }
        }}
        onCancel={handleCancelPrivacyNotice}
        onConfirm={handleAcknowledgePrivacyNotice}
      />
    </>
  );
};

export default RegisterFamilyModal;
