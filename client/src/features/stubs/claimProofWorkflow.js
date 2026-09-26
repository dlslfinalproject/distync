export const resolveClaimProof = ({
  stubDetails,
  qrReferenceValue = "",
  isLoadingStubDetails = false,
} = {}) => {
  if (isLoadingStubDetails || !stubDetails?.id) {
    return {
      isResolved: false,
      isQrProofAvailable: false,
      proofType: "",
      qrReferenceValue: "",
    };
  }

  const canonicalQrReference = String(stubDetails.qr_code_value || "").trim();
  const qrStatus = String(stubDetails.qr_status || "").trim().toUpperCase();
  // Online claim validation and offline readiness both require an active QR.
  const isQrProofAvailable = Boolean(
    canonicalQrReference && qrStatus === "ACTIVE",
  );

  if (isQrProofAvailable) {
    const scannedQrReference = String(qrReferenceValue || "").trim();

    return {
      isResolved: true,
      isQrProofAvailable: true,
      proofType: "QR",
      qrReferenceValue:
        scannedQrReference === canonicalQrReference
          ? scannedQrReference
          : canonicalQrReference,
    };
  }

  return {
    isResolved: true,
    isQrProofAvailable: false,
    proofType: "PHOTO",
    qrReferenceValue: "",
  };
};
