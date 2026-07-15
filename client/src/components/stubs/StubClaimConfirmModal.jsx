import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";
import { RELATIONSHIP_OPTIONS } from "../../utils/registrationOptions";
import QrCodePanel from "./QrCodePanel";

const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(18, 34, 51, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "18px",
    zIndex: 1200,
  },
  modal: {
    width: "100%",
    maxWidth: "520px",
    maxHeight: "calc(100vh - 36px)",
    overflowY: "auto",
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "24px",
    boxShadow: "0 24px 48px rgba(20, 48, 78, 0.2)",
    boxSizing: "border-box",
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
    marginTop: "18px",
    flexWrap: "wrap",
  },
  photoSection: {
    marginTop: "16px",
    display: "grid",
    gap: "12px",
    justifyItems: "center",
  },
  infoCard: {
    width: "100%",
    padding: "14px",
    borderRadius: "16px",
    border: "1px solid #e1eaf3",
    backgroundColor: "#f8fbfe",
    boxSizing: "border-box",
    textAlign: "center",
  },
  label: {
    margin: 0,
    color: "#60738a",
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 700,
  },
  value: {
    margin: "6px 0 0",
    color: "#17324d",
    fontSize: "15px",
    fontWeight: 800,
    lineHeight: 1.4,
  },
  qrCard: {
    width: "100%",
    padding: "14px",
    borderRadius: "16px",
    border: "1px solid #e1eaf3",
    backgroundColor: "#f8fbfe",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },
  qrPanel: {
    width: "100%",
    alignItems: "center",
  },
  qrImage: {
    width: "160px",
    maxWidth: "160px",
  },
  qrValue: {
    width: "100%",
    maxWidth: "420px",
    margin: "0 auto",
    textAlign: "center",
    overflowWrap: "anywhere",
  },
  familyHeadCard: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "12px",
    borderRadius: "16px",
    border: "1px solid #d7e2ef",
    backgroundColor: "#f8fbfe",
    boxSizing: "border-box",
    textAlign: "left",
  },
  photoPreview: {
    width: "76px",
    height: "76px",
    objectFit: "cover",
    borderRadius: "12px",
    border: "1px solid #d5e0ea",
    backgroundColor: "#eaf2f8",
    flex: "0 0 auto",
  },
  photoPlaceholder: {
    width: "76px",
    height: "76px",
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
    flex: "0 0 auto",
  },
  membersList: {
    width: "100%",
    margin: 0,
    paddingLeft: "18px",
    color: "#21405f",
    fontSize: "14px",
    lineHeight: 1.7,
    textAlign: "left",
  },
  capturedText: {
    margin: "6px 0 0",
    color: "#60738a",
    fontSize: "12px",
    lineHeight: 1.4,
  },
  bulkList: {
    width: "100%",
    marginTop: "16px",
    display: "grid",
    gap: "10px",
    maxHeight: "320px",
    overflowY: "auto",
    paddingRight: "4px",
    boxSizing: "border-box",
  },
  bulkItem: {
    width: "100%",
    padding: "12px",
    borderRadius: "16px",
    border: "1px solid #e1eaf3",
    backgroundColor: "#f8fbfe",
    boxSizing: "border-box",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "8px 12px",
    alignItems: "center",
  },
  bulkName: {
    margin: 0,
    color: "#17324d",
    fontSize: "15px",
    fontWeight: 800,
    lineHeight: 1.4,
  },
  bulkMeta: {
    margin: 0,
    color: "#60738a",
    fontSize: "12px",
    lineHeight: 1.5,
  },
};

const formatPhotoCapturedAt = (value) => {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsedDate);
};

const formatRelationship = (value) => {
  const relationshipOption = RELATIONSHIP_OPTIONS.find(
    (option) => option.value === value,
  );

  return relationshipOption?.label || value || "";
};

const getReliefPackDisplay = (value) => {
  const normalizedValue = String(value || "").trim();

  return normalizedValue ? normalizedValue.toUpperCase() : "-";
};

const getDisplayStubNumber = (stub) => {
  if (stub?.display_stub_no) {
    return stub.display_stub_no;
  }

  const sequenceNo = Number(stub?.stub_sequence_no || stub?.stub_number || 0);

  return sequenceNo > 0 ? `STUB#${sequenceNo}` : "--";
};

const getSelectedStubSummary = (stub) => {
  const reliefPackName =
    stub?.relief_pack_template_name ||
    stub?.relief_pack_name ||
    stub?.released_items_summary ||
    stub?.assigned_relief_packs?.map((template) => template?.name).filter(Boolean).join(", ") ||
    stub?.distribution_transaction?.relief_pack_template_name ||
    stub?.distribution_transaction?.released_items_summary ||
    "";

  return {
    id: stub?.id || stub?.stub_id || stub?.stub_no,
    familyHeadName:
      stub?.household?.family_head_name || stub?.family_head_name || "--",
    stubNumber: getDisplayStubNumber(stub),
    householdSize:
      stub?.household?.members_count ??
      stub?.members_count ??
      stub?.household_size ??
      0,
    reliefPackDisplay: getReliefPackDisplay(reliefPackName),
  };
};

const StubClaimConfirmModal = ({
  isOpen,
  isSubmitting,
  isLoadingStubDetails = false,
  onCancel,
  onConfirm,
  selectedStubs = [],
  selectedCount = 1,
  stubDetails = null,
}) => {
  if (!isOpen) {
    return null;
  }

  const message =
    selectedCount > 1
      ? "Are you sure the selected stubs have been claimed?"
      : "Are you sure this stub has been claimed?";
  const familyMembers = Array.isArray(stubDetails?.household?.members)
    ? stubDetails.household.members
    : [];
  const reliefPackName =
    stubDetails?.distribution_transaction?.relief_pack_template_name ||
    stubDetails?.relief_pack_name ||
    stubDetails?.assigned_relief_packs
      ?.map((template) => template?.name)
      .filter(Boolean)
      .join(", ") ||
    stubDetails?.distribution_transaction?.released_items_summary ||
    "-";
  const reliefPackDisplay = getReliefPackDisplay(reliefPackName);
  const selectedStubSummaries = selectedStubs.map(getSelectedStubSummary);

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <h3 style={modalStyles.title}>Confirm Relief Distribution</h3>
        <p style={modalStyles.message}>{message}</p>

        {selectedCount === 1 ? (
          <div style={modalStyles.photoSection}>
            <div style={modalStyles.infoCard}>
              <p style={modalStyles.label}>Stub Number</p>
              <p style={modalStyles.value}>
                {getDisplayStubNumber(stubDetails)}
              </p>
            </div>

            <div style={modalStyles.qrCard}>
              <p style={modalStyles.label}>QR Code</p>
              <QrCodePanel
                value={stubDetails?.qr_code_value || ""}
                emptyLabel="No QR available"
                containerStyle={modalStyles.qrPanel}
                imageStyle={modalStyles.qrImage}
                valueStyle={modalStyles.qrValue}
              />
              <p style={modalStyles.label}>Relief Pack</p>
              <p style={modalStyles.value}>{reliefPackDisplay}</p>
            </div>

            <div style={modalStyles.familyHeadCard}>
              {isLoadingStubDetails ? (
                <div style={modalStyles.photoPlaceholder}>Loading photo...</div>
              ) : stubDetails?.household?.family_head_photo_url ? (
                <img
                  src={stubDetails.household.family_head_photo_url}
                  alt="Registered family head"
                  style={modalStyles.photoPreview}
                />
              ) : (
                <div style={modalStyles.photoPlaceholder}>No photo available</div>
              )}

              <div>
                <p style={modalStyles.label}>Family Head</p>
                <p style={modalStyles.value}>
                  {stubDetails?.household?.family_head_name || "--"}
                </p>
                {stubDetails?.household?.photo_captured_at ? (
                  <p style={modalStyles.capturedText}>
                    Captured:{" "}
                    {formatPhotoCapturedAt(stubDetails.household.photo_captured_at)}
                  </p>
                ) : null}
              </div>
            </div>

            <div style={modalStyles.infoCard}>
              <p style={modalStyles.label}>Family Members</p>
              {familyMembers.length > 0 ? (
                <ul style={modalStyles.membersList}>
                  {familyMembers.map((member) => (
                    <li key={member.evacuee_id || member.full_name}>
                      {member.full_name || "Unnamed member"}
                      {member.relationship_to_head
                        ? ` - ${formatRelationship(member.relationship_to_head)}`
                        : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ ...shellStyles.mutedText, margin: "8px 0 0" }}>
                  No additional family members recorded.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div style={modalStyles.bulkList}>
            {selectedStubSummaries.length > 0 ? (
              selectedStubSummaries.map((stub, index) => (
                <div key={stub.id || `${stub.stubNumber}-${index}`} style={modalStyles.bulkItem}>
                  <div>
                    <p style={modalStyles.bulkName}>{stub.familyHeadName}</p>
                    <p style={modalStyles.bulkMeta}>
                      Stub Number: {stub.stubNumber}
                    </p>
                    <p style={modalStyles.bulkMeta}>
                      Relief Pack: {stub.reliefPackDisplay}
                    </p>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <p style={modalStyles.label}>Household Size</p>
                    <p style={modalStyles.value}>{stub.householdSize}</p>
                  </div>
                </div>
              ))
            ) : (
              <div style={modalStyles.infoCard}>
                <p style={modalStyles.value}>{selectedCount} selected stubs</p>
              </div>
            )}
          </div>
        )}

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
            {isSubmitting ? "Marking as Claimed..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StubClaimConfirmModal;
