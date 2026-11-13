import React, { useEffect, useMemo, useRef, useState } from "react";
import { shellStyles } from "../layout/BarangayLayout";
import DuplicateRegistrationSuggestionsSection from "./DuplicateRegistrationSuggestionsSection";
import { deriveAgeGroup } from "../../utils/ageGroup";
import {
  AGE_BASED_MEMBER_SECTOR_CODES,
  formatMemberSectorLabel,
  getCanonicalMemberSectorCode,
  isAgeBasedMemberSectorCode,
} from "../../utils/registrationOptions";

const fieldStyles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
  },
  nameGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "16px",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 220px) minmax(180px, 220px)",
    gap: "16px",
    marginTop: "18px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    color: "#55718b",
    fontSize: "13px",
    fontWeight: 700,
  },
  errorText: {
    margin: "6px 0 0",
    color: "#c53030",
    fontSize: "12px",
    lineHeight: 1.4,
  },
  input: {
    minHeight: "44px",
    border: "1px solid #d0ddeb",
    borderRadius: "14px",
    padding: "10px 12px",
    fontSize: "14px",
    color: "#1f405f",
    backgroundColor: "#ffffff",
    boxSizing: "border-box",
    width: "100%",
  },
  lockedInput: {
    backgroundColor: "#f8fbfe",
    color: "#60738a",
    cursor: "default",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  badge: {
    padding: "4px 10px",
    borderRadius: "999px",
    border: "1px solid #d4deea",
    backgroundColor: "#f2f7fb",
    color: "#58718c",
    fontSize: "12px",
    fontWeight: 700,
  },
  checkboxLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    color: "#4a6480",
    fontSize: "13px",
    fontWeight: 600,
  },
  helperText: {
    margin: "8px 0 0",
    color: "#6f859b",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  photoCard: {
    marginTop: "20px",
    padding: "16px",
    borderRadius: "16px",
    border: "1px dashed #cddbeb",
    backgroundColor: "#f9fcff",
  },
  photoPreview: {
    width: "100%",
    maxWidth: "240px",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "16px",
    border: "1px solid #d3dfeb",
    backgroundColor: "#eaf2f8",
  },
  videoPreview: {
    width: "100%",
    maxWidth: "240px",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "16px",
    border: "1px solid #d3dfeb",
    backgroundColor: "#0f2236",
  },
  photoPlaceholder: {
    width: "100%",
    maxWidth: "240px",
    aspectRatio: "4 / 3",
    borderRadius: "16px",
    border: "1px dashed #c8d8e8",
    backgroundColor: "#f0f6fb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6b8198",
    fontSize: "13px",
    fontWeight: 600,
    textAlign: "center",
    padding: "16px",
    boxSizing: "border-box",
  },
  textarea: {
    minHeight: "96px",
    resize: "vertical",
  },
  smallButton: {
    border: "1px solid #c7d7e6",
    borderRadius: "12px",
    backgroundColor: "#ffffff",
    color: "#24496e",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  warningText: {
    margin: "8px 0 0",
    color: "#a14d58",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.5,
  },
};

const stopMediaStream = (stream) => {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Stop the remaining tracks even if a browser track is already closed.
    }
  });
};

const FamilyHeadSection = ({ form }) => {
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraRequestRef = useRef(0);
  const isMountedRef = useRef(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraErrorMessage, setCameraErrorMessage] = useState("");
  const isFamilyHeadProtected = form.isFamilyHeadProtected;
  const parsedFamilyHeadAgeValue = Number.parseInt(
    String(form.familyHead.age_value || "").trim(),
    10,
  );
  const derivedFamilyHeadAgeSector = deriveAgeGroup(
    Number.isInteger(parsedFamilyHeadAgeValue) && parsedFamilyHeadAgeValue >= 1
      ? parsedFamilyHeadAgeValue
      : null,
    "YEARS",
  );

  const canUseCamera = useMemo(() => {
    return (
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      Boolean(window.isSecureContext)
    );
  }, []);

  useEffect(() => {
    if (!videoRef.current || !cameraStream) {
      return;
    }

    cameraStreamRef.current = cameraStream;
    videoRef.current.srcObject = cameraStream;
  }, [cameraStream]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cameraRequestRef.current += 1;
      stopMediaStream(cameraStreamRef.current);
      cameraStreamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isFamilyHeadProtected) {
      cameraRequestRef.current += 1;
      stopMediaStream(cameraStreamRef.current);
      cameraStreamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraStream(null);
      setIsStartingCamera(false);
      setCameraErrorMessage("");
    }
  }, [isFamilyHeadProtected]);

  const handleStartCamera = async () => {
    if (isFamilyHeadProtected) {
      return;
    }

    if (!canUseCamera || isStartingCamera) {
      if (!canUseCamera) {
        setCameraErrorMessage(
          typeof navigator === "undefined" ||
            !navigator.mediaDevices?.getUserMedia
            ? "This browser does not support camera capture. You can upload a photo instead."
            : "Camera capture requires HTTPS or localhost. You can upload a photo instead.",
        );
      }
      return;
    }

    const requestId = cameraRequestRef.current + 1;
    cameraRequestRef.current = requestId;
    setIsStartingCamera(true);
    setCameraErrorMessage("");
    form.clearFormMessages();

    try {
      stopMediaStream(cameraStreamRef.current);
      cameraStreamRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      if (!isMountedRef.current || cameraRequestRef.current !== requestId) {
        stopMediaStream(stream);
        return;
      }

      cameraStreamRef.current = stream;
      setCameraStream(stream);
    } catch (error) {
      if (isMountedRef.current && cameraRequestRef.current === requestId) {
        const cameraErrorName = String(error?.name || "");
        setCameraErrorMessage(
          cameraErrorName === "NotAllowedError" ||
            cameraErrorName === "PermissionDeniedError"
            ? "Camera permission was denied. Allow camera access or upload a photo."
            : cameraErrorName === "NotFoundError" ||
                cameraErrorName === "DevicesNotFoundError"
              ? "No camera was found. You can upload a photo instead."
              : cameraErrorName === "NotReadableError"
                ? "The camera is busy or unavailable. Close other camera apps or upload a photo."
                : "Camera access failed. You can upload a photo instead.",
        );
        setCameraStream(null);
      }
    } finally {
      if (isMountedRef.current && cameraRequestRef.current === requestId) {
        setIsStartingCamera(false);
      }
    }
  };

  const handleStopCamera = () => {
    cameraRequestRef.current += 1;
    stopMediaStream(cameraStreamRef.current);
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStream(null);
    setIsStartingCamera(false);
  };

  const handleCapturePhoto = async () => {
    if (isFamilyHeadProtected) {
      return;
    }

    if (!videoRef.current) {
      setCameraErrorMessage("Camera preview is not ready yet.");
      return;
    }

    const videoElement = videoRef.current;
    const sourceWidth = videoElement.videoWidth;
    const sourceHeight = videoElement.videoHeight;
    if (!sourceWidth || !sourceHeight) {
      setCameraErrorMessage("Camera preview is not ready yet.");
      return;
    }

    try {
      const wasSelected = await form.setFamilyHeadPhotoFromCameraFrame(
        videoElement,
        sourceWidth,
        sourceHeight,
      );
      if (wasSelected) {
        handleStopCamera();
      }
    } catch {
      setCameraErrorMessage("The camera frame could not be processed. Try again.");
    }
  };

  const handleUploadFallback = async (event) => {
    if (isFamilyHeadProtected) {
      event.target.value = "";
      return;
    }

    const selectedFile = event.target.files?.[0] || null;
    handleStopCamera();
    setCameraErrorMessage("");
    form.clearFormMessages();
    await form.setFamilyHeadPhotoFromFile(selectedFile);
    event.target.value = "";
  };

  const nonAgeBasedSectors = form.memberSectorOptions.filter(
    (sector) =>
      !isAgeBasedMemberSectorCode(getCanonicalMemberSectorCode(sector.code)),
  );
  const familyHeadSuggestionState = form.duplicateSuggestionStates?.family_head;
  const familyHeadSuggestionGroups = familyHeadSuggestionState?.group
    ? [familyHeadSuggestionState.group]
    : [];

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <div style={fieldStyles.sectionHeader}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Family Head Information</h3>
          {isFamilyHeadProtected ? (
            <span style={fieldStyles.badge}>Protected Information</span>
          ) : null}
        </div>
      </div>

      <div className="household-registration-name-grid" style={fieldStyles.nameGrid}>
        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>First Name</span>
          <input
            type="text"
            value={form.familyHead.first_name}
            readOnly={isFamilyHeadProtected}
            onChange={(event) =>
              form.updateFamilyHeadField("first_name", event.target.value)
            }
            aria-invalid={Boolean(form.validationErrors.familyHead.first_name)}
            style={{
              ...fieldStyles.input,
              ...(isFamilyHeadProtected ? fieldStyles.lockedInput : {}),
            }}
          />
          {form.validationErrors.familyHead.first_name ? (
            <p style={fieldStyles.errorText}>
              {form.validationErrors.familyHead.first_name}
            </p>
          ) : null}
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Middle Name</span>
          <input
            type="text"
            value={form.familyHead.middle_name}
            readOnly={isFamilyHeadProtected}
            onChange={(event) =>
              form.updateFamilyHeadField("middle_name", event.target.value)
            }
            style={{
              ...fieldStyles.input,
              ...(isFamilyHeadProtected ? fieldStyles.lockedInput : {}),
            }}
          />
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Last Name</span>
          <input
            type="text"
            value={form.familyHead.last_name}
            readOnly={isFamilyHeadProtected}
            onChange={(event) =>
              form.updateFamilyHeadField("last_name", event.target.value)
            }
            aria-invalid={Boolean(form.validationErrors.familyHead.last_name)}
            style={{
              ...fieldStyles.input,
              ...(isFamilyHeadProtected ? fieldStyles.lockedInput : {}),
            }}
          />
          {form.validationErrors.familyHead.last_name ? (
            <p style={fieldStyles.errorText}>
              {form.validationErrors.familyHead.last_name}
            </p>
          ) : null}
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Suffix (If Applicable)</span>
          <input
            type="text"
            value={form.familyHead.suffix}
            readOnly={isFamilyHeadProtected}
            onChange={(event) =>
              form.updateFamilyHeadField("suffix", event.target.value)
            }
            style={{
              ...fieldStyles.input,
              ...(isFamilyHeadProtected ? fieldStyles.lockedInput : {}),
            }}
          />
        </label>
      </div>

      <div className="household-registration-detail-grid" style={fieldStyles.detailGrid}>
        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Age</span>
          <input
            type="text"
            inputMode="numeric"
            value={form.familyHead.age_value}
            readOnly={isFamilyHeadProtected}
            onChange={(event) =>
              form.updateFamilyHeadField("age_value", event.target.value)
            }
            aria-invalid={Boolean(form.validationErrors.familyHead.age_value)}
            style={{
              ...fieldStyles.input,
              ...(isFamilyHeadProtected ? fieldStyles.lockedInput : {}),
            }}
          />
          {form.validationErrors.familyHead.age_value ? (
            <p style={fieldStyles.errorText}>
              {form.validationErrors.familyHead.age_value}
            </p>
          ) : null}
        </label>

        <label style={fieldStyles.field}>
          <span style={fieldStyles.label}>Sex</span>
          <select
            value={form.familyHead.sex}
            onChange={(event) =>
              form.updateFamilyHeadField("sex", event.target.value)
            }
            disabled={isFamilyHeadProtected}
            style={{
              ...fieldStyles.input,
              ...(isFamilyHeadProtected ? fieldStyles.lockedInput : {}),
            }}
          >
            <option value="MALE">MALE</option>
            <option value="FEMALE">FEMALE</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: "18px" }}>
        <p style={{ ...shellStyles.mutedText, margin: "0 0 10px", fontWeight: 700 }}>
          Member Sectors
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {AGE_BASED_MEMBER_SECTOR_CODES.map((sectorCode) => {
              const isChecked = sectorCode === derivedFamilyHeadAgeSector;

              return (
                <label
                  key={sectorCode}
                  style={{
                    ...fieldStyles.checkboxLabel,
                    opacity: isChecked ? 1 : 0.8,
                  }}
                >
                  <input type="checkbox" checked={isChecked} disabled />
                  {formatMemberSectorLabel(sectorCode)}
                </label>
              );
            })}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {nonAgeBasedSectors.map((sector) => {
              const isChecked = form.familyHead.sector_ids.includes(sector.id);

              return (
                <label
                  key={sector.id}
                  style={fieldStyles.checkboxLabel}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isFamilyHeadProtected}
                    onChange={() => form.toggleFamilyHeadSector(sector.id)}
                  />
                  {formatMemberSectorLabel(sector)}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ marginTop: "20px" }}>
        <DuplicateRegistrationSuggestionsSection
          groups={familyHeadSuggestionGroups}
          isLoading={familyHeadSuggestionState?.status === "loading"}
          errorMessage={familyHeadSuggestionState?.errorMessage || ""}
        />
      </div>

      <div style={fieldStyles.photoCard}>
        <div style={{ marginBottom: "14px" }}>
          <p style={{ ...shellStyles.mutedText, margin: 0, fontWeight: 700 }}>
            Family Head Photo Verification
          </p>
          <p style={fieldStyles.helperText}>
            {isFamilyHeadProtected
              ? "The registered family head photo is locked after registration."
              : "A family head photo is required for relief verification. Use live camera capture when available, or upload an image as fallback."}
          </p>
          {form.validationErrors.family_head_photo_url ? (
            <p style={fieldStyles.errorText}>
              {form.validationErrors.family_head_photo_url}
            </p>
          ) : null}
        </div>

        <div
          className="household-registration-photo-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 240px) minmax(240px, 1fr)",
            gap: "18px",
            alignItems: "start",
          }}
        >
          <div>
            {cameraStream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={fieldStyles.videoPreview}
              />
            ) : form.familyHeadPhotoUrl ? (
              <img
                src={form.familyHeadPhotoUrl}
                alt="Family head preview"
                style={fieldStyles.photoPreview}
              />
            ) : (
              <div style={fieldStyles.photoPlaceholder}>No photo selected yet</div>
            )}

            <p style={fieldStyles.helperText}>
              {cameraStream
                ? "Live camera preview"
                : form.familyHeadPhotoFileName ||
                  "Capture a photo or upload an image file"}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {isFamilyHeadProtected ? (
              <p style={{ ...fieldStyles.helperText, margin: 0 }}>
                Photo capture and replacement are unavailable while editing an
                existing household.
              </p>
            ) : (
              <>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {!cameraStream ? (
                    <button
                      type="button"
                      onClick={handleStartCamera}
                      disabled={
                        !canUseCamera || isStartingCamera || form.isProcessingPhoto
                      }
                      style={{
                        ...fieldStyles.smallButton,
                        opacity:
                          !canUseCamera || isStartingCamera || form.isProcessingPhoto
                            ? 0.7
                            : 1,
                        cursor:
                          !canUseCamera || isStartingCamera || form.isProcessingPhoto
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {isStartingCamera ? "Starting Camera..." : "Open Camera"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleCapturePhoto}
                        disabled={form.isProcessingPhoto}
                        style={{
                          ...fieldStyles.smallButton,
                          opacity: form.isProcessingPhoto ? 0.7 : 1,
                          cursor: form.isProcessingPhoto ? "not-allowed" : "pointer",
                        }}
                      >
                        Capture Photo
                      </button>
                      <button
                        type="button"
                        onClick={handleStopCamera}
                        disabled={form.isProcessingPhoto}
                        style={{
                          ...fieldStyles.smallButton,
                          opacity: form.isProcessingPhoto ? 0.7 : 1,
                          cursor: form.isProcessingPhoto ? "not-allowed" : "pointer",
                        }}
                      >
                        Cancel Camera
                      </button>
                    </>
                  )}
                </div>

                <label style={fieldStyles.field}>
                  <span style={fieldStyles.label}>Upload Photo (Fallback)</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleUploadFallback}
                    aria-invalid={Boolean(form.validationErrors.family_head_photo_url)}
                    style={fieldStyles.input}
                  />
                  <p style={fieldStyles.helperText}>
                    Use this if camera permission is denied or the device has no camera.
                  </p>
                </label>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      handleStopCamera();
                      form.clearFamilyHeadPhoto();
                    }}
                    disabled={!form.familyHeadPhotoUrl || form.isProcessingPhoto}
                    style={{
                      ...fieldStyles.smallButton,
                      opacity:
                        !form.familyHeadPhotoUrl || form.isProcessingPhoto
                          ? 0.7
                          : 1,
                      cursor:
                        !form.familyHeadPhotoUrl || form.isProcessingPhoto
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    Remove Photo
                  </button>

                  {form.isProcessingPhoto ? (
                    <p style={{ ...fieldStyles.helperText, margin: 0 }}>
                      Processing selected photo...
                    </p>
                  ) : null}
                </div>

                {cameraErrorMessage ? (
                  <p style={fieldStyles.warningText}>{cameraErrorMessage}</p>
                ) : null}

                {!canUseCamera ? (
                  <p style={fieldStyles.helperText}>
                    Camera capture needs HTTPS or localhost in a supported browser.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FamilyHeadSection;
