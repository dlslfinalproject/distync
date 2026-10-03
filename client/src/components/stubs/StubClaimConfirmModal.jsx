import React, { useEffect, useRef, useState } from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import { RELATIONSHIP_OPTIONS } from "../../utils/registrationOptions";
import { resolveClaimProof } from "../../features/stubs/claimProofWorkflow";
import {
  normalizeImageDrawableToDataUrl,
  normalizeImageFileToDataUrl,
} from "../../utils/imageProcessing.js";
import QrCodePanel from "./QrCodePanel";
import { FiCamera, FiCheckCircle, FiImage, FiRotateCcw } from "react-icons/fi";

const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(18, 34, 51, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding:
      "max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px))",
    zIndex: 1200,
  },
  modal: {
    width: "100%",
    maxWidth: "560px",
    maxHeight: "calc(100vh - 36px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: 0,
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
    marginTop: 0,
    flexWrap: "wrap",
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
  familyHeadCard: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: 0,
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
    paddingRight: 0,
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

const formatFamilyMemberDetails = (member) => {
  const details = [member?.full_name || "Unnamed member"];
  const relationship = formatRelationship(member?.relationship_to_head);
  const ageValue = member?.age_value ?? member?.age;

  if (relationship) {
    details.push(relationship);
  }
  if (ageValue !== null && ageValue !== undefined && ageValue !== "") {
    const ageText =
      member?.age_value !== null && member?.age_value !== undefined
        ? `${ageValue}${member?.age_unit ? ` ${member.age_unit}` : ""}`
        : String(ageValue);
    details.push(ageText);
  }

  return details.join(" — ");
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
  claimInitiationSource = "",
  qrReferenceValue = "",
}) => {
  const [proofPhotoDataUrl, setProofPhotoDataUrl] = useState("");
  const [proofPhotoCapturedAt, setProofPhotoCapturedAt] = useState("");
  const [isProofPhotoReady, setIsProofPhotoReady] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const cameraVideoRef = useRef(null);
  const photoFileInputRef = useRef(null);
  const dialogHeadingRef = useRef(null);
  const submissionStartedRef = useRef(false);
  const captureRequestRef = useRef(0);

  useEffect(() => {
    if (!isOpen) {
      captureRequestRef.current += 1;
      submissionStartedRef.current = false;
      setIsCameraOpen(false);
      setIsCameraReady(false);
      setProofPhotoDataUrl("");
      setProofPhotoCapturedAt("");
      setIsProofPhotoReady(false);
      setIsPreparingPhoto(false);
      setCameraError("");
      return;
    }
    captureRequestRef.current += 1;
    submissionStartedRef.current = false;
    setProofPhotoDataUrl("");
    setProofPhotoCapturedAt("");
    setIsProofPhotoReady(false);
    setIsPreparingPhoto(false);
    setIsCameraReady(false);
    setCameraError("");
    setIsCameraOpen(false);
  }, [isOpen, stubDetails?.id]);

  const claimProof =
    selectedCount === 1
      ? resolveClaimProof({
          stubDetails,
          claimInitiationSource,
          qrReferenceValue,
          isLoadingStubDetails,
        })
      : {
          isResolved: false,
          isQrProofAvailable: false,
          proofType: "",
          qrReferenceValue: "",
        };
  const proofType = claimProof.proofType;
  const resolvedQrReferenceValue = claimProof.qrReferenceValue;
  const hasClaimProof =
    selectedCount > 1 ||
    (proofType === "QR" && Boolean(resolvedQrReferenceValue)) ||
    (proofType === "PHOTO" && Boolean(proofPhotoDataUrl) && isProofPhotoReady);
  const isConfirmDisabled =
    isSubmitting || isLoadingStubDetails || isPreparingPhoto || !hasClaimProof;

  useEffect(() => {
    if (
      !isOpen ||
      !claimProof.isResolved ||
      proofType !== "PHOTO" ||
      isSubmitting
    ) {
      return;
    }

    setIsCameraReady(false);
    setCameraError("");
    setIsCameraOpen(true);
  }, [
    claimProof.isResolved,
    isOpen,
    isSubmitting,
    proofType,
    stubDetails?.id,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previouslyFocusedElement = document.activeElement;
    dialogHeadingRef.current?.focus();
    return () => previouslyFocusedElement?.focus?.();
  }, [isOpen]);

  useEffect(() => {
    if (!isSubmitting) {
      submissionStartedRef.current = false;
    }
  }, [isSubmitting]);

  useEffect(() => {
    if (!isOpen || !isCameraOpen || proofType !== "PHOTO") {
      return undefined;
    }

    let cancelled = false;
    let stream = null;
    const openCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("This device does not provide camera access.");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (cameraVideoRef.current) {
          const video = cameraVideoRef.current;
          video.srcObject = stream;
          video.onloadedmetadata = () => {
            setIsCameraReady(Boolean(video.videoWidth && video.videoHeight));
          };
          await video.play().catch(() => undefined);
          if (video.videoWidth && video.videoHeight) {
            setIsCameraReady(true);
          }
        }
      } catch {
        if (!cancelled) {
          setCameraError(
            "Camera unavailable. Choose a photo from this device or try again.",
          );
          setIsCameraOpen(false);
          setIsCameraReady(false);
        }
      }
    };

    openCamera();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      if (cameraVideoRef.current) {
        cameraVideoRef.current.onloadedmetadata = null;
        cameraVideoRef.current.srcObject = null;
      }
    };
  }, [isOpen, isCameraOpen, proofType, stubDetails?.id]);

  const captureProofPhoto = async () => {
    const video = cameraVideoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setCameraError("Wait for the camera preview, then capture the photo.");
      return;
    }
    const requestId = ++captureRequestRef.current;
    setIsPreparingPhoto(true);
    setCameraError("");
    try {
      const photo = await normalizeImageDrawableToDataUrl(
        video,
        video.videoWidth,
        video.videoHeight,
        { maxDimension: 1600, maxOutputBytes: 2 * 1024 * 1024 },
      );
      if (
        requestId !== captureRequestRef.current ||
        !isOpen ||
        proofType !== "PHOTO" ||
        isSubmitting
      ) {
        return;
      }
      setProofPhotoDataUrl(photo);
      setProofPhotoCapturedAt(new Date().toISOString());
      setIsProofPhotoReady(true);
      setIsCameraOpen(false);
      setIsCameraReady(false);
    } catch {
      setCameraError(
        "Unable to prepare this photo. Please take another photo and try again.",
      );
    } finally {
      if (requestId === captureRequestRef.current) {
        setIsPreparingPhoto(false);
      }
    }
  };

  const handleProofPhotoFileChange = async (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile || proofType !== "PHOTO" || isSubmitting) {
      return;
    }

    const requestId = ++captureRequestRef.current;
    setIsCameraOpen(false);
    setIsCameraReady(false);
    setIsPreparingPhoto(true);
    setCameraError("");
    setProofPhotoDataUrl("");
    setProofPhotoCapturedAt("");
    setIsProofPhotoReady(false);

    try {
      const photo = await normalizeImageFileToDataUrl(selectedFile, {
        maxSourceBytes: 8 * 1024 * 1024,
        maxDimension: 1600,
        maxOutputBytes: 2 * 1024 * 1024,
      });
      if (
        requestId !== captureRequestRef.current ||
        !isOpen ||
        proofType !== "PHOTO" ||
        isSubmitting
      ) {
        return;
      }

      setProofPhotoDataUrl(photo);
      setProofPhotoCapturedAt(new Date().toISOString());
      setIsProofPhotoReady(true);
    } catch {
      if (requestId === captureRequestRef.current) {
        setCameraError(
          "Unable to use this photo. Please take another photo or choose a different image.",
        );
      }
    } finally {
      if (requestId === captureRequestRef.current) {
        setIsPreparingPhoto(false);
      }
    }
  };

  const openDevicePhotoPicker = () => {
    if (isSubmitting || isPreparingPhoto) {
      return;
    }
    photoFileInputRef.current?.click();
  };

  const startCameraCapture = ({ replacePhoto = false } = {}) => {
    if (isSubmitting || isPreparingPhoto) {
      return;
    }
    captureRequestRef.current += 1;
    setIsCameraReady(false);
    if (replacePhoto) {
      setProofPhotoDataUrl("");
      setProofPhotoCapturedAt("");
      setIsProofPhotoReady(false);
    }
    setCameraError("");
    setIsCameraOpen(true);
  };

  const handleConfirm = () => {
    if (isSubmitting || submissionStartedRef.current) {
      return;
    }
    if (selectedCount > 1) {
      submissionStartedRef.current = true;
      onConfirm?.();
      return;
    }
    if (proofType === "QR" && resolvedQrReferenceValue) {
      submissionStartedRef.current = true;
      onConfirm?.({
        proofType: "QR",
        qrReferenceValue: resolvedQrReferenceValue,
        proofPhotoDataUrl: "",
        proofPhotoCapturedAt: "",
      });
      return;
    }
    if (
      proofType === "PHOTO" &&
      proofPhotoDataUrl &&
      isProofPhotoReady &&
      !isPreparingPhoto
    ) {
      submissionStartedRef.current = true;
      onConfirm?.({
        proofType: "PHOTO",
        qrReferenceValue: "",
        proofPhotoDataUrl,
        proofPhotoCapturedAt,
      });
    }
  };

  if (!isOpen) {
    return null;
  }

  const familyMembers = Array.isArray(stubDetails?.household?.members)
    ? stubDetails.household.members
    : [];
  const reliefPackParts = buildReliefPackDisplayParts(stubDetails);
  const reliefPackDisplay = reliefPackParts.reliefPackDisplay;
  const donatedReliefPackNames = getDonatedReliefPackNames(stubDetails);
  const disasterEventName =
    stubDetails?.disaster_event?.title ||
    stubDetails?.disaster_event?.name ||
    "--";
  const selectedStubSummaries = selectedStubs.map(getSelectedStubSummary);
  const distributionMessage =
    selectedCount > 1
      ? "Are you sure these relief distributions are correct?"
      : "Are you sure this relief distribution is correct?";
  const handleDialogKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!isSubmitting) {
        onCancel?.();
      }
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = event.currentTarget.querySelectorAll(
      "button:not(:disabled)",
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (!firstElement || !lastElement) {
      return;
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div className="stub-claim-confirm-modal-backdrop" style={modalStyles.overlay}>
      <div
        className="stub-claim-confirm-modal"
        style={modalStyles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-distribution-title"
        aria-describedby="claim-distribution-message"
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
      >
        <header className="stub-claim-confirm-header">
          <h3
            id="claim-distribution-title"
            ref={dialogHeadingRef}
            tabIndex={-1}
            style={modalStyles.title}
          >
            Confirm Relief Distribution
          </h3>
          <p id="claim-distribution-message" style={modalStyles.message}>
            {distributionMessage}
          </p>
        </header>
        <div className="stub-claim-confirm-body">
          {selectedCount === 1 ? (
            <section className="claim-stub-number-card" aria-label="Stub number">
              <p className="claim-card-label">Stub Number</p>
              <p className="claim-stub-number-value">
                {getDisplayStubNumber(stubDetails)}
              </p>
            </section>
          ) : null}
          {selectedCount === 1 ? (
            <section
              className="claim-qr-relief-card"
              aria-label={proofType === "QR" ? "QR code and relief pack" : "Relief pack"}
            >
              {proofType === "QR" ? (
                <>
                  <p className="claim-card-label">QR Code</p>
                  <QrCodePanel
                    value={resolvedQrReferenceValue}
                    showValue={false}
                    containerStyle={{ width: "100%", alignItems: "center" }}
                    imageStyle={{ width: "148px", maxWidth: "100%" }}
                  />
                </>
              ) : null}
              <div className="claim-qr-relief-details">
                <div>
                  <p className="claim-card-label">Relief Pack</p>
                  <p className="claim-card-value">{reliefPackDisplay}</p>
                </div>
                <div>
                  <p className="claim-card-label">Disaster Event</p>
                  <p className="claim-card-supporting-value">{disasterEventName}</p>
                </div>
              </div>
            </section>
          ) : null}
          {stubDetails?.offline_household_details_unavailable ? (
            <p className="claim-offline-details-note">
              Complete household details are not available in the current offline data.
            </p>
          ) : null}

          {selectedCount === 1 ? (
            <section
              className="stub-claim-confirm-content"
              aria-labelledby="claim-household-verification-title"
            >
              <h4
                id="claim-household-verification-title"
                className="claim-household-title"
              >
                Household Verification
              </h4>

              <div className="stub-claim-confirm-family-head">
                <div>
                  <p style={modalStyles.label}>Household / Family Head</p>
                  <p style={modalStyles.value}>
                    {stubDetails?.household?.family_head_name ||
                      stubDetails?.family_head_name ||
                      "--"}
                  </p>
                  {stubDetails?.household?.photo_captured_at ? (
                    <p style={modalStyles.capturedText}>
                      Captured:{" "}
                      {formatPhotoCapturedAt(stubDetails.household.photo_captured_at)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="claim-household-members">
                {familyMembers.length > 0 ? (
                  <>
                    <p className="claim-household-members-label">Family Members</p>
                    <ul className="claim-household-member-list">
                      {familyMembers.map((member) => (
                        <li key={member.evacuee_id || member.full_name}>
                          {formatFamilyMemberDetails(member)}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="claim-household-empty">
                    <strong>Family Members:</strong> None recorded
                  </p>
                )}
              </div>
            </section>
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

        {selectedCount === 1 ? (
          <section
            className={`claim-proof-workflow claim-proof-workflow--${proofType || "checking"}`}
            aria-labelledby="claim-proof-section-title"
          >
            <div className="claim-proof-heading">
              <div>
                <h4
                  id="claim-proof-section-title"
                  className="claim-proof-section-title"
                >
                  Photo Proof of Receipt
                </h4>
              </div>
              <span
                className={`claim-proof-state-badge claim-proof-state-badge--${proofType || "checking"}`}
                role="status"
              >
                {proofType === "QR"
                  ? "Not Required — Stub QR Verified"
                  : proofType === "PHOTO"
                    ? "Required"
                    : "Waiting for Claim Verification"}
              </span>
            </div>
            {proofType === "QR" ? (
              <p className="claim-proof-informational">
                The physical Stub QR was verified.
              </p>
            ) : proofType === "PHOTO" ? (
              <div className="claim-proof-required-notice">
                <strong>Physical Stub Unavailable</strong>
                <span>
                  Verify the household, then photograph the relief handover.
                </span>
              </div>
            ) : (
              <p
                className="claim-proof-informational"
                role="status"
                aria-live="polite"
              >
                A verified physical QR scan or an explicit unavailable-Stub
                claim is required.
              </p>
            )}
            {proofType === "PHOTO" ? (
              <section
                className="claim-proof-capture"
                aria-labelledby="claim-proof-photo-title"
              >
                <p id="claim-proof-photo-title" className="claim-proof-guidance">
                  Include the recipient and relief goods in a clear photo.
                </p>
                <input
                  ref={photoFileInputRef}
                  className="claim-proof-file-input"
                  type="file"
                  accept="image/*"
                  aria-label="Choose a claim proof photo from this device"
                  tabIndex={-1}
                  onChange={handleProofPhotoFileChange}
                />
                {isCameraOpen ? (
                  <>
                    <video
                      ref={cameraVideoRef}
                      autoPlay
                      muted
                      playsInline
                      aria-label="Live claim proof camera preview"
                      className="claim-proof-camera-preview"
                    />
                    <div className="claim-proof-capture-actions">
                      <button
                        type="button"
                        onClick={captureProofPhoto}
                        disabled={!isCameraReady || isPreparingPhoto || isSubmitting}
                        className="claim-proof-take-photo"
                      >
                        <FiCamera aria-hidden="true" size={18} />
                        {isPreparingPhoto ? "Preparing photo…" : "Capture Photo"}
                      </button>
                      <button
                        type="button"
                        onClick={openDevicePhotoPicker}
                        disabled={isPreparingPhoto || isSubmitting}
                        style={pageHeaderStyles.secondaryButton}
                      >
                        <FiImage aria-hidden="true" size={17} />
                        Choose from Device
                      </button>
                    </div>
                    {!isCameraReady && !isPreparingPhoto ? (
                      <p className="claim-proof-preparing" role="status" aria-live="polite">
                        Opening camera…
                      </p>
                    ) : null}
                  </>
                ) : proofPhotoDataUrl ? (
                  <>
                    <div className="claim-proof-photo-frame">
                      <img
                        src={proofPhotoDataUrl}
                        alt="Claim handoff proof preview"
                        className="claim-proof-photo-preview"
                      />
                    </div>
                    <p className="claim-proof-photo-ready" role="status" aria-live="polite">
                      <FiCheckCircle aria-hidden="true" size={17} />
                      Photo ready
                    </p>
                    <p className="claim-proof-captured-at">
                      Captured {formatPhotoCapturedAt(proofPhotoCapturedAt)}
                    </p>
                    <div className="claim-proof-capture-actions">
                      <button
                        type="button"
                        onClick={() => startCameraCapture({ replacePhoto: true })}
                        disabled={isSubmitting || isPreparingPhoto}
                        style={pageHeaderStyles.secondaryButton}
                      >
                        <FiRotateCcw aria-hidden="true" size={17} />
                        Retake Photo
                      </button>
                      <button
                        type="button"
                        onClick={openDevicePhotoPicker}
                        disabled={isSubmitting || isPreparingPhoto}
                        style={pageHeaderStyles.secondaryButton}
                      >
                        <FiImage aria-hidden="true" size={17} />
                        Choose Another Photo
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="claim-proof-capture-actions">
                    <button
                      type="button"
                      onClick={() => startCameraCapture()}
                      disabled={isSubmitting || isPreparingPhoto}
                      className="claim-proof-take-photo"
                    >
                      <FiCamera aria-hidden="true" size={18} />
                      {cameraError ? "Open Camera" : "Take Photo"}
                    </button>
                    <button
                      type="button"
                      onClick={openDevicePhotoPicker}
                      disabled={isSubmitting || isPreparingPhoto}
                      style={pageHeaderStyles.secondaryButton}
                    >
                      <FiImage aria-hidden="true" size={17} />
                      Choose from Device
                    </button>
                  </div>
                )}
                {isPreparingPhoto ? (
                  <p className="claim-proof-preparing" role="status" aria-live="polite">
                    Preparing photo…
                  </p>
                ) : null}
                {cameraError ? (
                  <p className="claim-proof-error" role="alert">
                    {cameraError}
                  </p>
                ) : null}
              </section>
            ) : null}
          </section>
        ) : null}
          {isSubmitting ? (
            <p className="claim-distribution-processing" role="status" aria-live="polite">
              {selectedCount > 1
                ? "Recording the selected relief distributions."
                : proofType === "PHOTO"
                  ? "Recording the claim and securing the photo proof."
                  : "Recording the relief distribution."}
            </p>
          ) : null}
        </div>
        <div className="stub-claim-confirm-actions" style={modalStyles.actions}>
          <button
            type="button"
            onClick={() => {
              captureRequestRef.current += 1;
              setIsCameraOpen(false);
              onCancel?.();
            }}
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
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            style={{
              ...pageHeaderStyles.primaryButton,
              opacity: isConfirmDisabled ? 0.58 : 1,
              cursor: isSubmitting
                ? "wait"
                : isConfirmDisabled
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {isSubmitting
              ? "Processing distribution…"
              : selectedCount > 1
                ? "Confirm Distributions"
                : "Confirm Distribution"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StubClaimConfirmModal;
