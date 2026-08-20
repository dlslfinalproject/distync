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
  centeredValue: {
    margin: "6px 0 0",
    color: "#17324d",
    fontSize: "15px",
    fontWeight: 800,
    lineHeight: 1.4,
    textAlign: "center",
    width: "100%",
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
  donatedLooseList: {
    width: "100%",
    display: "grid",
    gap: "10px",
    marginTop: "8px",
  },
  donatedLooseItem: {
    display: "grid",
    gridTemplateColumns: "1fr 92px",
    gap: "10px",
    alignItems: "center",
    padding: "10px 12px",
    borderRadius: "14px",
    border: "1px solid #d7e2ef",
    backgroundColor: "#ffffff",
    boxSizing: "border-box",
    textAlign: "left",
  },
  donatedLooseName: {
    margin: 0,
    color: "#17324d",
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: 1.35,
  },
  donatedLooseMeta: {
    margin: "3px 0 0",
    color: "#60738a",
    fontSize: "12px",
    lineHeight: 1.4,
  },
  donatedLooseQuantity: {
    margin: 0,
    color: "#17324d",
    fontSize: "15px",
    fontWeight: 800,
    textAlign: "center",
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

const getTemplateFamilySizeCoverage = (template) => {
  const parsedCoverage = Number.parseInt(String(template?.description || "").trim(), 10);
  return Number.isInteger(parsedCoverage) && parsedCoverage > 0 ? parsedCoverage : 0;
};

const getReliefPackQuantityMultiplier = (template, householdSize) => {
  if (!template?.based_on_family_size) {
    return 1;
  }

  const normalizedHouseholdSize = Number.parseInt(String(householdSize || 0), 10);
  const familySizeCoverage = getTemplateFamilySizeCoverage(template);

  if (
    !Number.isInteger(normalizedHouseholdSize) ||
    normalizedHouseholdSize <= 0 ||
    familySizeCoverage <= 0
  ) {
    return 1;
  }

  return Math.max(1, Math.ceil(normalizedHouseholdSize / familySizeCoverage));
};

const getPrimaryAssignedReliefPackTemplate = (stub) => {
  const assignedTemplates = Array.isArray(stub?.assigned_relief_packs)
    ? stub.assigned_relief_packs
    : [];

  return (
    assignedTemplates.find((template) => !template?.is_additional_pack) ||
    assignedTemplates[0] ||
    null
  );
};

const buildReliefPackDisplayParts = (stub) => {
  const primaryTemplate = getPrimaryAssignedReliefPackTemplate(stub);
  const householdSize =
    stub?.household?.members_count ??
    stub?.members_count ??
    stub?.household?.household_size ??
    stub?.household_size ??
    0;
  const packMultiplier = getReliefPackQuantityMultiplier(primaryTemplate, householdSize);
  const reliefPackName =
    stub?.distribution_transaction?.relief_pack_template_name ||
    stub?.relief_pack_template_name ||
    stub?.relief_pack_name ||
    stub?.released_items_summary ||
    stub?.distribution_transaction?.released_items_summary ||
    primaryTemplate?.name ||
    "";
  const baseDisplay = getReliefPackDisplay(reliefPackName);

  if (packMultiplier <= 1) {
    return {
      reliefPackDisplay: baseDisplay,
      packMultiplier: 1,
      multiplierText: "",
    };
  }

  return {
    reliefPackDisplay: `${baseDisplay} (${packMultiplier})`,
    packMultiplier,
    multiplierText: `${packMultiplier} packs based on household size`,
  };
};

const getDonatedReliefPackNames = (stub) => {
  const donatedPacks = Array.isArray(stub?.available_donated_relief_packs)
    ? stub.available_donated_relief_packs
    : [];

  return donatedPacks
    .map((pack) => pack?.name)
    .filter(Boolean);
};

const getAvailableDonatedLooseItems = (stub) => {
  return Array.isArray(stub?.available_donated_loose_items)
    ? stub.available_donated_loose_items
    : [];
};

const getDonatedLooseItemNames = (stub) => {
  return getAvailableDonatedLooseItems(stub)
    .map((item) => {
      const allocation = Number(
        item?.quantity_released || item?.per_family_allocation || 0,
      );
      const itemName = item?.item_name || "";

      if (!itemName || allocation <= 0) {
        return "";
      }

      return `${itemName} x${allocation}`;
    })
    .filter(Boolean);
};

const getDisplayStubNumber = (stub) => {
  if (stub?.display_stub_no) {
    return stub.display_stub_no;
  }

  const sequenceNo = Number(stub?.stub_sequence_no || stub?.stub_number || 0);

  return sequenceNo > 0 ? `STUB#${sequenceNo}` : "--";
};

const getSelectedStubSummary = (stub) => {
  const reliefPackParts = buildReliefPackDisplayParts(stub);
  const donatedReliefPackNames = getDonatedReliefPackNames(stub);
  const donatedLooseItemNames = getDonatedLooseItemNames(stub);

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
    reliefPackDisplay: reliefPackParts.reliefPackDisplay,
    reliefPackMultiplierText: reliefPackParts.multiplierText,
    donatedReliefPackDisplay:
      donatedReliefPackNames.length > 0
        ? donatedReliefPackNames.join(", ").toUpperCase()
        : "",
    donatedLooseItemDisplay:
      donatedLooseItemNames.length > 0 ? donatedLooseItemNames.join(", ") : "",
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
  const reliefPackParts = buildReliefPackDisplayParts(stubDetails);
  const reliefPackDisplay = reliefPackParts.reliefPackDisplay;
  const donatedReliefPackNames = getDonatedReliefPackNames(stubDetails);
  const availableDonatedLooseItems = getAvailableDonatedLooseItems(stubDetails);
  const selectedStubSummaries = selectedStubs.map(getSelectedStubSummary);
  const canPickDonatedLooseItems =
    selectedCount === 1 && availableDonatedLooseItems.length > 0;
  const hasDonatedRelief =
    donatedReliefPackNames.length > 0 || canPickDonatedLooseItems;

  return (
    <div className="stub-claim-confirm-modal-backdrop" style={modalStyles.overlay}>
      <div className="stub-claim-confirm-modal" style={modalStyles.modal}>
        <h3 style={modalStyles.title}>Confirm Relief Distribution</h3>
        <p style={modalStyles.message}>{message}</p>

        {selectedCount === 1 ? (
          <div
            className="stub-claim-confirm-content"
            style={modalStyles.photoSection}
          >
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
              <p style={modalStyles.label}>Standard Relief</p>
              <p style={modalStyles.centeredValue}>{reliefPackDisplay}</p>
              {reliefPackParts.multiplierText ? (
                <p style={{ ...modalStyles.capturedText, textAlign: "center" }}>
                  {reliefPackParts.multiplierText}
                </p>
              ) : null}
              {hasDonatedRelief ? (
                <>
                  <p style={{ ...modalStyles.label, marginTop: "8px" }}>
                    Donated Relief
                  </p>
                  {donatedReliefPackNames.length > 0 ? (
                    <p style={modalStyles.centeredValue}>
                      {donatedReliefPackNames.join(", ").toUpperCase()}
                    </p>
                  ) : null}
                  {canPickDonatedLooseItems ? (
                    <div style={modalStyles.donatedLooseList}>
                      {availableDonatedLooseItems.map((item) => (
                        <div
                          key={item.donation_item_id}
                          style={modalStyles.donatedLooseItem}
                        >
                          <div>
                            <p style={modalStyles.donatedLooseName}>
                              {item.item_name || "--"}
                            </p>
                            <p style={modalStyles.donatedLooseMeta}>
                              {item.donor_name || "Donors"} | Available:{" "}
                              {item.quantity_available ?? 0}{" "}
                              {item.unit_of_measure || "unit(s)"}
                            </p>
                          </div>
                          <p style={modalStyles.donatedLooseQuantity}>
                            x{item.quantity_released || item.per_family_allocation || 0}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            <div
              className="stub-claim-confirm-family-head"
              style={modalStyles.familyHeadCard}
            >
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
          <div className="stub-claim-confirm-bulk-list" style={modalStyles.bulkList}>
            {selectedStubSummaries.length > 0 ? (
              selectedStubSummaries.map((stub, index) => (
                <div key={stub.id || `${stub.stubNumber}-${index}`} style={modalStyles.bulkItem}>
                  <div>
                    <p style={modalStyles.bulkName}>{stub.familyHeadName}</p>
                    <p style={modalStyles.bulkMeta}>
                      Stub Number: {stub.stubNumber}
                    </p>
                    <p style={modalStyles.bulkMeta}>
                      Standard Relief: {stub.reliefPackDisplay}
                    </p>
                    {stub.reliefPackMultiplierText ? (
                      <p style={modalStyles.bulkMeta}>
                        {stub.reliefPackMultiplierText}
                      </p>
                    ) : null}
                    {stub.donatedReliefPackDisplay ? (
                      <p style={modalStyles.bulkMeta}>
                        Donated Relief: {stub.donatedReliefPackDisplay}
                      </p>
                    ) : null}
                    {stub.donatedLooseItemDisplay ? (
                      <p style={modalStyles.bulkMeta}>
                        Donated Relief: {stub.donatedLooseItemDisplay}
                      </p>
                    ) : null}
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

        <div className="stub-claim-confirm-actions" style={modalStyles.actions}>
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
