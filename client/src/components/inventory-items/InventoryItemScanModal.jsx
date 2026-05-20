import React, { useEffect, useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import { BarcodeFormat, BrowserMultiFormatReader } from "@zxing/browser";
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
  width: "min(860px, 100%)",
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
  minHeight: "48px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #d2deea",
  boxSizing: "border-box",
  fontSize: "14px",
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

  cameraPreview: {
    width: "100%",
    minHeight: "260px",
    borderRadius: "18px",
    backgroundColor: "#10263d",
    objectFit: "cover",
    border: "1px solid #cfe0f0",
  },

  cameraPlaceholder: {
    minHeight: "260px",
    borderRadius: "18px",
    border: "1px dashed #c6d5e3",
    backgroundColor: "#f8fbfe",
    color: "#4f677f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "24px",
    lineHeight: 1.6,
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

  errorText: {
    margin: "10px 0 0",
    color: "#b91c1c",
    fontSize: "13px",
    fontWeight: 600,
  },

  cameraActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "14px",
  },
};

const BARCODE_FORMATS = [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODABAR,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
];

const InventoryItemScanModal = ({
  isOpen,
  scanForm,
  onClose,
  onSubmit,
  onInputChange,
}) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scannerReaderRef = useRef(null);
  const scannerControlsRef = useRef(null);
  const [cameraError, setCameraError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);

  const stopCamera = () => {
    if (scannerControlsRef.current) {
      scannerControlsRef.current.stop();
      scannerControlsRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      if (typeof videoRef.current.pause === "function") {
        videoRef.current.pause();
      }
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError("");
    setFeedbackMessage("");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraError(
        "Camera access is not available on this browser. Enter the barcode manually instead.",
      );
      return;
    }

    if (!scannerReaderRef.current) {
      scannerReaderRef.current = new BrowserMultiFormatReader();
      scannerReaderRef.current.possibleFormats = BARCODE_FORMATS;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      const scannerControls = await scannerReaderRef.current.decodeFromStream(
        mediaStream,
        videoRef.current,
        (result, error) => {
          if (result?.getText()) {
            const detectedValue = result.getText().trim();

            if (!detectedValue) {
              return;
            }

            onInputChange("barcodeNumber", detectedValue);
            setFeedbackMessage(`Barcode detected: ${detectedValue}`);
            setCameraError("");
            stopCamera();
            return;
          }

          if (
            error &&
            error.name !== "NotFoundException" &&
            error.name !== "ChecksumException" &&
            error.name !== "FormatException"
          ) {
            setCameraError(
              error.message ||
                "Unable to scan barcode from the current camera feed.",
            );
          }
        },
      );

      scannerControlsRef.current = scannerControls;
      setIsCameraActive(true);
    } catch (error) {
      console.error("Inventory barcode scanner getUserMedia failed:", error);
      const permissionDenied =
        error?.name === "NotAllowedError" || error?.name === "SecurityError";
      const noCameraFound =
        error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError";

      if (permissionDenied) {
        setCameraError(
          "Camera permission was denied. Enter the barcode manually instead.",
        );
      } else if (noCameraFound) {
        setCameraError(
          "No camera was found on this device. Enter the barcode manually instead.",
        );
      } else {
        setCameraError(
          error?.message ||
            "Unable to open the camera right now. Enter the barcode manually instead.",
        );
      }

      stopCamera();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCameraError("");
      setFeedbackMessage("");
      return undefined;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div style={scanModalOverlayStyle}>
      <div style={scanModalStyle}>
        <div style={styles.scanModalHeader}>
          <div>
            <h3 style={styles.scanModalTitle}>Scan Item</h3>
            <p style={styles.scanModalDescription}>
              Scan a barcode using your device camera, or enter it manually if
              camera access is unavailable.
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
          <section style={{ ...shellStyles.card, padding: "18px 20px" }}>
            <h3 style={styles.scanModalSectionTitle}>Camera Scanner</h3>

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                ...styles.cameraPreview,
                display: isCameraActive ? "block" : "none",
                height: "auto",
              }}
            />

            {!isCameraActive && (
              <div style={styles.cameraPlaceholder}>
                Open the camera to scan a barcode here. If camera access is not
                available, you can still type the barcode manually below.
              </div>
            )}

            <div style={styles.cameraActions}>
              <button
                type="button"
                onClick={startCamera}
                style={pageHeaderStyles.secondaryButton}
              >
                {isCameraActive ? "Restart Camera" : "Open Camera"}
              </button>

              {isCameraActive && (
                <button
                  type="button"
                  onClick={stopCamera}
                  style={pageHeaderStyles.secondaryButton}
                >
                  Stop Camera
                </button>
              )}
            </div>

            {feedbackMessage && (
              <p style={styles.feedbackText}>{feedbackMessage}</p>
            )}

            {cameraError && <p style={styles.errorText}>{cameraError}</p>}

            <p style={styles.helperText}>
              Hold the barcode steady inside the camera view. The barcode field
              will fill automatically after a successful scan.
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
                  type="text"
                  value={scanForm.barcodeNumber}
                  onChange={(e) =>
                    onInputChange("barcodeNumber", e.target.value)
                  }
                  style={scanModalInputStyle}
                  placeholder="Enter barcode number"
                />
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
              disabled={!scanForm.barcodeNumber.trim()}
            >
              Continue to Add Item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryItemScanModal;
