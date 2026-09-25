import React, { useEffect, useRef, useState } from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";
import { RELATIONSHIP_OPTIONS } from "../../utils/registrationOptions";
import { resolveFamilyHeadPhoto } from "../../features/masterlist/familyHeadPhoto";
import {
  normalizeImageDrawableToDataUrl,
  normalizeImageFileToDataUrl,
} from "../../utils/imageProcessing.js";
import QrCodePanel from "./QrCodePanel";
import { FiCamera, FiCheckCircle, FiImage, FiRotateCcw } from "react-icons/fi";
import { MdQrCodeScanner } from "react-icons/md";

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
  initialProofType = "",
  qrReferenceValue = "",
  allowPhotoProof = true,
}) => {
  const [proofType, setProofType] = useState("");
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
    setProofType(
      initialProofType === "QR" && qrReferenceValue ? "QR" : "",
    );
    setProofPhotoDataUrl("");
    setProofPhotoCapturedAt("");
    setIsProofPhotoReady(false);
    setIsPreparingPhoto(false);
    setIsCameraReady(false);
    setCameraError("");
    setIsCameraOpen(false);
  }, [isOpen, stubDetails?.id, initialProofType, qrReferenceValue]);

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
    if (!isOpen || !isCameraOpen) {
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
  }, [isOpen, isCameraOpen]);

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
    if (proofType === "QR" && qrReferenceValue) {
      submissionStartedRef.current = true;
      onConfirm?.({
        proofType: "QR",
        qrReferenceValue,
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
  const familyHeadPhotoUrl = resolveFamilyHeadPhoto(stubDetails?.household, {
    isOffline: stubDetails?.is_cached_offline === true,
  });
  const selectedStubSummaries = selectedStubs.map(getSelectedStubSummary);
  const hasDonatedRelief = donatedReliefPackNames.length > 0;
  const distributionMessage =
    selectedCount > 1
      ? "Review the selected stubs and confirm after the relief handover."
      : "Review the distribution details, then confirm after the relief handover.";
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
      'button:not(:disabled), input[type="radio"]:not(:disabled)',
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
        {selectedCount === 1 ? (
          <section
            className="claim-proof-workflow"
            aria-labelledby="claim-proof-section-title"
          >
            <h4 id="claim-proof-section-title" className="claim-proof-section-title">
              Proof of Receipt
            </h4>
            <fieldset
              className="claim-proof-methods"
              disabled={isSubmitting || isLoadingStubDetails}
            >
              <legend>Choose proof method</legend>
              <div className="claim-proof-method-options">
                <label className="claim-proof-method-option">
                  <input
                    type="radio"
                    name="claim-proof-method"
                    value="QR"
                    checked={proofType === "QR"}
                    disabled={!qrReferenceValue || isSubmitting || isLoadingStubDetails}
                    onChange={() => {
                      captureRequestRef.current += 1;
                      setProofType("QR");
                      setProofPhotoDataUrl("");
                      setProofPhotoCapturedAt("");
                      setIsProofPhotoReady(false);
                      setIsCameraOpen(false);
                      setIsCameraReady(false);
                      setIsPreparingPhoto(false);
                      setCameraError("");
                    }}
                  />
                  <span className="claim-proof-method-card">
                    <MdQrCodeScanner aria-hidden="true" size={22} />
                    <span>
                      <strong>QR Code</strong>
                      <small>
                        {qrReferenceValue
                          ? "Scan the household distribution Stub QR code."
                          : "Scan and verify the household Stub QR code first."}
                      </small>
                    </span>
                  </span>
                </label>
                <label className="claim-proof-method-option">
                  <input
                    type="radio"
                    name="claim-proof-method"
                    value="PHOTO"
                    checked={proofType === "PHOTO"}
                    disabled={isSubmitting || isLoadingStubDetails || !allowPhotoProof}
                    onChange={() => {
                      captureRequestRef.current += 1;
                      setProofType("PHOTO");
                      setIsCameraOpen(false);
                      setIsCameraReady(false);
                      setIsPreparingPhoto(false);
                      setCameraError("");
                    }}
                  />
                  <span className="claim-proof-method-card">
                    <FiCamera aria-hidden="true" size={22} />
                    <span>
                      <strong>Photo Proof</strong>
                      <small>
                        Capture a photo as proof that the relief goods were received.
                      </small>
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
            {!allowPhotoProof ? (
              <p className="claim-proof-supporting-copy" style={modalStyles.capturedText}>
                Photo Proof capture is available to Barangay officials. Use a verified QR for this claim.
              </p>
            ) : null}
            {proofType === "PHOTO" ? (
              <section
                className="claim-proof-capture"
                aria-labelledby="claim-proof-photo-title"
              >
                <h5 id="claim-proof-photo-title" className="claim-proof-capture-title">
                  Photo guidelines
                </h5>
                <p className="claim-proof-guidance">
                  Capture a clear photo showing the recipient and the relief goods being handed over.
                  Make sure the image is visible and not blurred.
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
                      Photo ready for this distribution
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
                      Take Photo
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
        {stubDetails?.offline_household_details_unavailable ? (
          <p style={modalStyles.message}>
            Complete household details are not available in the current offline data.
          </p>
        ) : null}

        {selectedCount === 1 ? (
          <div
            className="stub-claim-confirm-content"
            style={modalStyles.photoSection}
          >
            <section
              className="claim-distribution-summary"
              aria-labelledby="claim-distribution-summary-title"
            >
              <h4 id="claim-distribution-summary-title">
                Distribution summary
              </h4>
              <dl className="claim-distribution-summary-grid">
                <div>
                  <dt>Household / Family Head</dt>
                  <dd>
                    {stubDetails?.household?.family_head_name ||
                      stubDetails?.family_head_name ||
                      "--"}
                  </dd>
                </div>
                <div>
                  <dt>Stub Number</dt>
                  <dd>{getDisplayStubNumber(stubDetails)}</dd>
                </div>
                <div>
                  <dt>Disaster Event</dt>
                  <dd>{disasterEventName}</dd>
                </div>
                <div>
                  <dt>Relief Pack</dt>
                  <dd>
                    {reliefPackDisplay}
                    {hasDonatedRelief
                      ? [" · Donated: ", donatedReliefPackNames.join(", ").toUpperCase()].join("")
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>Proof Method</dt>
                  <dd>
                    {proofType === "QR"
                      ? "QR Code"
                      : proofType === "PHOTO"
                        ? "Photo Proof"
                        : "Choose a method"}
                  </dd>
                </div>
                <div>
                  <dt>Proof Photo</dt>
                  <dd>
                    {proofType === "PHOTO"
                      ? isProofPhotoReady
                        ? "Attached"
                        : "Required"
                      : "Not used"}
                  </dd>
                </div>
              </dl>
            </section>

            {proofType === "QR" ? (
              <div style={modalStyles.qrCard}>
                <p style={modalStyles.label}>Stub QR Reference</p>
                <QrCodePanel
                  value={stubDetails?.qr_code_value || ""}
                  emptyLabel="No QR available"
                  showValue={false}
                  containerStyle={modalStyles.qrPanel}
                  imageStyle={modalStyles.qrImage}
                  valueStyle={modalStyles.qrValue}
                />
                {reliefPackParts.multiplierText ? (
                  <p style={{ ...modalStyles.capturedText, textAlign: "center" }}>
                    {reliefPackParts.multiplierText}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div
              className="stub-claim-confirm-family-head"
              style={modalStyles.familyHeadCard}
            >
              {isLoadingStubDetails ? (
                <div style={modalStyles.photoPlaceholder}>Loading registered photo...</div>
              ) : familyHeadPhotoUrl ? (
                <img
                  src={familyHeadPhotoUrl}
                  alt="Registered family head photo for manual identity verification"
                  style={modalStyles.photoPreview}
                />
              ) : (
                <div style={modalStyles.photoPlaceholder}>No registered photo available</div>
              )}

              <div>
                <p style={modalStyles.label}>Registered Family Head Photo</p>
                <p style={modalStyles.value}>
                  {stubDetails?.household?.family_head_name ||
                    stubDetails?.family_head_name ||
                    "--"}
                </p>
                <p style={modalStyles.capturedText}>
                  For manual identity verification only.
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
            disabled={
              isSubmitting ||
              isLoadingStubDetails ||
              isPreparingPhoto ||
              (selectedCount === 1 &&
                (proofType === "PHOTO"
                  ? !proofPhotoDataUrl || !isProofPhotoReady
                  : proofType !== "QR" || !qrReferenceValue))
            }
            style={{
              ...pageHeaderStyles.primaryButton,
              opacity:
                isSubmitting ||
                isLoadingStubDetails ||
                isPreparingPhoto ||
                (selectedCount === 1 &&
                  (proofType === "PHOTO"
                    ? !proofPhotoDataUrl || !isProofPhotoReady
                    : proofType !== "QR" || !qrReferenceValue))
                  ? 0.58
                  : 1,
              cursor: isSubmitting ? "wait" : "pointer",
            }}
          >
            {isSubmitting
              ? "Processing distribution…"
              : selectedCount > 1
                ? "Confirm Distributions"
                : "Confirm Distribution"}
          </button>
        </div>
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
    </div>
  );
};

export default StubClaimConfirmModal;
