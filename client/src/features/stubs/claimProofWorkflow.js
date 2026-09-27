export const CLAIM_INITIATION_SOURCE = Object.freeze({
  VERIFIED_QR_SCAN: "VERIFIED_QR_SCAN",
  STUB_UNAVAILABLE: "STUB_UNAVAILABLE",
});

export const resolveClaimProof = ({
  stubDetails,
  claimInitiationSource = "",
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

  if (claimInitiationSource === CLAIM_INITIATION_SOURCE.VERIFIED_QR_SCAN) {
    const scannedQrReference = String(qrReferenceValue || "").trim();
    const isVerifiedQrReference = Boolean(
      scannedQrReference &&
        canonicalQrReference &&
        scannedQrReference === canonicalQrReference &&
        qrStatus === "ACTIVE",
    );

    return {
      isResolved: isVerifiedQrReference,
      isQrProofAvailable: isVerifiedQrReference,
      proofType: isVerifiedQrReference ? "QR" : "",
      qrReferenceValue: isVerifiedQrReference ? scannedQrReference : "",
    };
  }

  if (claimInitiationSource === CLAIM_INITIATION_SOURCE.STUB_UNAVAILABLE) {
    return {
      isResolved: true,
      isQrProofAvailable: false,
      proofType: "PHOTO",
      qrReferenceValue: "",
    };
  }

  return {
    isResolved: false,
    isQrProofAvailable: false,
    proofType: "",
    qrReferenceValue: "",
  };
};
