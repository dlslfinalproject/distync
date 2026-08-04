import React, { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import qrScannerWorkerPath from "qr-scanner/qr-scanner-worker.min.js?url";
import { FiX } from "react-icons/fi";
import { MdQrCodeScanner } from "react-icons/md";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";
import { extractStubQrValue } from "../../utils/stubQr";

QrScanner.WORKER_PATH = qrScannerWorkerPath;

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
  video: {
    width: "100%",
    minHeight: "320px",
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
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <div style={modalStyles.topBar}>
          <div>
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

        <section style={modalStyles.scannerCard}>
          <video ref={videoRef} style={modalStyles.video} muted playsInline />
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

        <div style={modalStyles.actions}>
          <button
            type="button"
            onClick={handleClose}
            style={pageHeaderStyles.secondaryButton}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled
            style={{
              ...pageHeaderStyles.primaryButton,
              opacity: 0.8,
              cursor: "default",
            }}
          >
            <MdQrCodeScanner size={18} />
            Waiting for QR
          </button>
        </div>
      </div>
    </div>
  );
};

export default StubQrScanModal;
