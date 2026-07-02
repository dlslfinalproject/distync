import React from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { pageHeaderStyles } from "../layout/PageHeader";

const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(18, 34, 51, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1200,
  },
  modal: {
    width: "100%",
    maxWidth: "460px",
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "28px",
    boxShadow: "0 24px 48px rgba(20, 48, 78, 0.2)",
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "22px",
  },
  message: {
    margin: "12px 0 0",
    color: "#5d7188",
    fontSize: "15px",
    lineHeight: 1.6,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
    flexWrap: "wrap",
  },
  photoSection: {
    marginTop: "20px",
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid #e1eaf3",
    backgroundColor: "#f8fbfe",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  photoPreview: {
    width: "100%",
    maxWidth: "220px",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "14px",
    border: "1px solid #d5e0ea",
    backgroundColor: "#eaf2f8",
  },
  photoPlaceholder: {
    width: "100%",
    maxWidth: "220px",
    aspectRatio: "4 / 3",
    borderRadius: "14px",
    border: "1px dashed #cbd9e7",
    backgroundColor: "#f3f8fc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#698099",
    fontSize: "13px",
    fontWeight: 600,
    textAlign: "center",
    padding: "14px",
    boxSizing: "border-box",
  },
  photoName: {
    margin: "12px 0 0",
    color: "#17324d",
    fontWeight: 700,
    textAlign: "center",
  },
  listSection: {
    marginTop: "20px",
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid #e1eaf3",
    backgroundColor: "#f8fbfe",
  },
  list: {
    marginTop: "12px",
    display: "grid",
    gap: "12px",
    maxHeight: "320px",
    overflowY: "auto",
    paddingRight: "4px",
  },
  listItem: {
    display: "grid",
    gridTemplateColumns: "72px minmax(0, 1fr)",
    alignItems: "center",
    gap: "12px",
    padding: "10px",
    borderRadius: "14px",
    backgroundColor: "#ffffff",
    border: "1px solid #dbe7f2",
  },
  listPhoto: {
    width: "72px",
    height: "72px",
    objectFit: "cover",
    borderRadius: "12px",
    border: "1px solid #d5e0ea",
    backgroundColor: "#eaf2f8",
  },
  listPhotoPlaceholder: {
    width: "72px",
    height: "72px",
    borderRadius: "12px",
    border: "1px dashed #cbd9e7",
    backgroundColor: "#f3f8fc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#698099",
    fontSize: "11px",
    fontWeight: 600,
    textAlign: "center",
    padding: "8px",
    boxSizing: "border-box",
  },
  listName: {
    margin: 0,
    color: "#17324d",
    fontWeight: 700,
    lineHeight: 1.4,
  },
};

const MasterlistDepartureConfirmModal = ({
  isOpen,
  isSubmitting,
  isLoadingHouseholdDetails = false,
  onCancel,
  onConfirm,
  selectedCount = 1,
  familyHeadName = "",
  familyHeadPhotoUrl = "",
  selectedHouseholdsPreview = [],
}) => {
  if (!isOpen) return null;

  const message =
    selectedCount > 1
      ? "Are you sure the selected families have departed?"
      : "Are you sure this family has departed?";

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <h3 style={modalStyles.title}>Confirm Departure</h3>

        <p style={modalStyles.message}>{message}</p>

        {selectedCount === 1 ? (
          <div style={modalStyles.photoSection}>
            {isLoadingHouseholdDetails ? (
              <p style={{ ...shellStyles.mutedText, margin: 0 }}>
                Loading registered family head photo...
              </p>
            ) : (
              <>
                {familyHeadPhotoUrl ? (
                  <img
                    src={familyHeadPhotoUrl}
                    alt="Registered family head"
                    style={modalStyles.photoPreview}
                  />
                ) : (
                  <div style={modalStyles.photoPlaceholder}>No photo available</div>
                )}

                <p style={modalStyles.photoName}>{familyHeadName || "--"}</p>
              </>
            )}
          </div>
        ) : selectedCount > 1 ? (
          <div style={modalStyles.listSection}>
            {isLoadingHouseholdDetails ? (
              <p style={{ ...shellStyles.mutedText, margin: 0 }}>
                Loading selected family head photos...
              </p>
            ) : selectedHouseholdsPreview.length === 0 ? (
              <p style={{ ...shellStyles.mutedText, margin: 0 }}>
                No selected families available for preview.
              </p>
            ) : (
              <div style={modalStyles.list}>
                {selectedHouseholdsPreview.map((household) => (
                  <div
                    key={household.household_id || household.family_head_name}
                    style={modalStyles.listItem}
                  >
                    {household.family_head_photo_url ? (
                      <img
                        src={household.family_head_photo_url}
                        alt="Registered family head"
                        style={modalStyles.listPhoto}
                      />
                    ) : (
                      <div style={modalStyles.listPhotoPlaceholder}>
                        No photo
                      </div>
                    )}

                    <p style={modalStyles.listName}>
                      {household.family_head_name || "--"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div style={modalStyles.actions}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            style={{
              ...pageHeaderStyles.secondaryButton,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            style={{
              ...pageHeaderStyles.primaryButton,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "wait" : "pointer",
            }}
          >
            {isSubmitting ? "Recording Departure..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MasterlistDepartureConfirmModal;
