import React, { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import qrScannerWorkerPath from "qr-scanner/qr-scanner-worker.min.js?url";
import { FiX } from "react-icons/fi";
import { MdQrCodeScanner } from "react-icons/md";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";
import { extractStubQrValue } from "../../utils/stubQr";

QrScanner.WORKER_PATH = qrScannerWorkerPath;

const SCAN_REGION_RATIO = 0.86;
const SCAN_REGION_CANVAS_SIZE = 480;

const getVisibleSourceRect = (video, videoWidth, videoHeight) => {
  const renderedWidth = video.offsetWidth || video.clientWidth || videoWidth;
  const renderedHeight = video.offsetHeight || video.clientHeight || videoHeight;

  if (!videoWidth || !videoHeight || !renderedWidth || !renderedHeight) {
    return {
      x: 0,
      y: 0,
      width: videoWidth,
      height: videoHeight,
    };
  }

  const objectFit = window.getComputedStyle(video).objectFit;

  if (objectFit !== "cover") {
    return {
      x: 0,
      y: 0,
      width: videoWidth,
      height: videoHeight,
    };
  }

  const sourceAspectRatio = videoWidth / videoHeight;
  const renderedAspectRatio = renderedWidth / renderedHeight;

  if (sourceAspectRatio > renderedAspectRatio) {
    const visibleWidth = Math.round(videoHeight * renderedAspectRatio);

    return {
      x: Math.round((videoWidth - visibleWidth) / 2),
      y: 0,
      width: visibleWidth,
      height: videoHeight,
    };
  }

  const visibleHeight = Math.round(videoWidth / renderedAspectRatio);

  return {
    x: 0,
    y: Math.round((videoHeight - visibleHeight) / 2),
    width: videoWidth,
    height: visibleHeight,
  };
};

const calculateGenerousScanRegion = (video) => {
  const videoWidth = video.videoWidth || video.offsetWidth || 0;
  const videoHeight = video.videoHeight || video.offsetHeight || 0;
  const visibleSourceRect = getVisibleSourceRect(video, videoWidth, videoHeight);
  const scanSize = Math.round(
    SCAN_REGION_RATIO *
      Math.min(
        visibleSourceRect.width || videoWidth,
        visibleSourceRect.height || videoHeight,
      ),
  );

  return {
    x: Math.round(
      visibleSourceRect.x + (visibleSourceRect.width - scanSize) / 2,
    ),
    y: Math.round(
      visibleSourceRect.y + (visibleSourceRect.height - scanSize) / 2,
    ),
    width: scanSize,
    height: scanSize,
    downScaledWidth: SCAN_REGION_CANVAS_SIZE,
    downScaledHeight: SCAN_REGION_CANVAS_SIZE,
  };
};

const modalStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(23, 39, 56, 0.48)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 1200,
  },
  modal: {
    width: "min(620px, 100%)",
    maxHeight: "calc(100vh - 48px)",
    overflowY: "auto",
    borderRadius: "24px",
    backgroundColor: "#ffffff",
    boxShadow: "0 24px 54px rgba(23, 50, 77, 0.24)",
    padding: "28px",
    boxSizing: "border-box",
  },
  topBar: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "20px",
  },
  closeButton: {
    border: "1px solid #c6d8ea",
    borderRadius: "14px",
    width: "46px",
    height: "46px",
    backgroundColor: "#f8fbfe",
    color: "#2a4c6f",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  scannerCard: {
    border: "1px solid #d6e2ef",
    borderRadius: "18px",
    backgroundColor: "#f8fbfe",
    padding: "16px",
  },
  scannerViewport: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "16px",
    backgroundColor: "#10243a",
  },
  video: {
    width: "100%",
    height: "100%",
    display: "block",
    borderRadius: "16px",
    backgroundColor: "#10243a",
    objectFit: "cover",
  },
  message: {
    margin: "14px 0 0",
    color: "#5d7188",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  error: {
    margin: "14px 0 0",
    color: "#9d4d58",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "22px",
    flexWrap: "wrap",
  },
};

const StubQrScanModal = ({
  isOpen,
  isProcessing = false,
  isInteractionBlocked = false,
  blockedQrValue = "",
  blockedQrUntil = 0,
  helperMessage = "",
  onClose,
  onScan,
}) => {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const scannerRef = useRef(null);
  const lastScannedValueRef = useRef("");
  const blockedScanRef = useRef({
    value: "",
    until: 0,
  });
  const [scannerMessage, setScannerMessage] = useState("");

  useEffect(() => {
    if (!isOpen || isInteractionBlocked || !videoRef.current) {
      return undefined;
    }

    let isMounted = true;
    setScannerMessage("");
    lastScannedValueRef.current = "";

    const scanner = new QrScanner(
      videoRef.current,
      (scanResult) => {
        const scannedValue =
          typeof scanResult === "string" ? scanResult : scanResult?.data || "";
        const qrValue = extractStubQrValue(scannedValue);

        if (
          !qrValue ||
          isProcessing ||
          isInteractionBlocked ||
          (blockedScanRef.current.value === qrValue &&
            blockedScanRef.current.until > Date.now()) ||
          lastScannedValueRef.current === qrValue
        ) {
          return;
        }

        lastScannedValueRef.current = qrValue;
        onScan?.(qrValue);
      },
      {
        returnDetailedScanResult: true,
        preferredCamera: "environment",
        calculateScanRegion: calculateGenerousScanRegion,
        overlay: overlayRef.current,
        highlightScanRegion: true,
        highlightCodeOutline: true,
      },
    );

    scannerRef.current = scanner;

    scanner.start().catch(() => {
      if (isMounted) {
        setScannerMessage(
          "Unable to start QR camera scanning. Please allow camera access or use manual confirmation.",
        );
      }
    });

    return () => {
      isMounted = false;
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [isInteractionBlocked, isOpen, isProcessing, onScan]);

  useEffect(() => {
    blockedScanRef.current = {
      value: blockedQrValue || "",
      until: Number(blockedQrUntil || 0),
    };

    if (!blockedQrValue) {
      lastScannedValueRef.current = "";
    }
  }, [blockedQrUntil, blockedQrValue]);

  const handleClose = () => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    onClose?.();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="stub-qr-scan-modal-backdrop" style={modalStyles.overlay}>
      <div className="stub-qr-scan-modal" style={modalStyles.modal}>
        <div className="stub-qr-scan-modal-topbar" style={modalStyles.topBar}>
          <div className="stub-qr-scan-modal-heading">
            <h2 style={{ ...pageHeaderStyles.title, fontSize: "30px" }}>
              Scan QR Stub
            </h2>
            <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
              Point the camera at the family QR stub to verify the record.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            style={modalStyles.closeButton}
            aria-label="Close QR scanner"
          >
            <FiX size={18} />
          </button>
        </div>

        <section className="stub-qr-scan-card" style={modalStyles.scannerCard}>
          <div
            className="stub-qr-scan-viewport"
            style={modalStyles.scannerViewport}
          >
            <video
              ref={videoRef}
              className="stub-qr-scan-video"
              style={modalStyles.video}
              muted
              playsInline
            />
            <div
              ref={overlayRef}
              className="stub-qr-scan-guide"
              aria-hidden="true"
            >
              <svg
                className="scan-region-highlight-svg"
                viewBox="0 0 238 238"
                preserveAspectRatio="none"
              >
                <path d="M31 2H10a8 8 0 0 0-8 8v21M207 2h21a8 8 0 0 1 8 8v21m0 176v21a8 8 0 0 1-8 8h-21m-176 0H10a8 8 0 0 1-8-8v-21" />
              </svg>
            </div>
          </div>
          {isProcessing ? (
            <p style={modalStyles.message}>Verifying scanned QR stub...</p>
          ) : scannerMessage ? (
            <p style={modalStyles.error}>{scannerMessage}</p>
          ) : helperMessage ? (
            <p style={modalStyles.message}>{helperMessage}</p>
          ) : (
            <p style={modalStyles.message}>
              Camera scanning works best on phones or devices with a rear camera.
            </p>
          )}
        </section>

        <div className="stub-qr-scan-actions" style={modalStyles.actions}>
          <button
            type="button"
            onClick={handleClose}
            style={pageHeaderStyles.secondaryButton}
          >
            Cancel
          </button>
          <div
            className="stub-qr-scan-status"
            role="status"
            aria-live="polite"
          >
            <MdQrCodeScanner size={18} />
            Waiting for QR
          </div>
        </div>
      </div>
    </div>
  );
};

export default StubQrScanModal;
