import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import QrScanner from "qr-scanner";
import qrScannerWorkerPath from "qr-scanner/qr-scanner-worker.min.js?url";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import StubSummaryCard from "../../components/distribution/StubSummaryCard";
import StubClaimConfirmModal from "../../components/stubs/StubClaimConfirmModal";
import { shellStyles } from "../../components/layout/BarangayLayout";
import { useAuth } from "../../context/AuthContext";
import {
  claimStub,
  fetchStubDetails,
  verifyStub,
} from "../../features/stubs/stubService";
import { extractStubQrValue } from "../../utils/stubQr";
import {
  UNTRUSTED_DISTRIBUTION_TARGET_MESSAGE,
  isServerVerifiedDistributionTarget,
  markDistributionTargetAsServerVerified,
  markDistributionTargetAsUnverified,
} from "../../features/distribution/distributionTargetProvenance";

QrScanner.WORKER_PATH = qrScannerWorkerPath;

const qrLookupStyles = {
  field: {
    width: "100%",
    minHeight: "48px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid #d2deea",
    boxSizing: "border-box",
    fontSize: "14px",
    color: "#21405f",
    backgroundColor: "#ffffff",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#4f677f",
    fontSize: "13px",
    fontWeight: 700,
  },
  video: {
    width: "100%",
    maxWidth: "320px",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "16px",
    border: "1px solid #d3dfeb",
    backgroundColor: "#0f2236",
  },
};

const buildStubContextFromDetails = (stubDetails) => {
  if (!stubDetails) {
    return null;
  }

  const context = {
    stub_id: stubDetails.id,
    household_id: stubDetails.household?.id || "",
    disaster_event_id: stubDetails.disaster_event?.id || "",
    display_stub_no: stubDetails.display_stub_no || "",
    stub_no: stubDetails.stub_no || "--",
    serial_no: stubDetails.serial_no || "--",
    status: stubDetails.status || "--",
    family_head_name: stubDetails.household?.family_head_name || "--",
    barangay_name: stubDetails.barangay?.name || "--",
    household_size: stubDetails.household?.household_size || 0,
    family_head_photo_url: stubDetails.household?.family_head_photo_url || "",
    photo_captured_at: stubDetails.household?.photo_captured_at || "",
    photo_verification_notes:
      stubDetails.household?.photo_verification_notes || "",
    qr_code_value: stubDetails.qr_code_value || "",
    qr_status: stubDetails.qr_status || "",
    qr_notes: stubDetails.qr_notes || "",
  };

  return stubDetails.is_cached_offline
    ? markDistributionTargetAsUnverified(context)
    : markDistributionTargetAsServerVerified(context);
};

const buildStubContextFromLocation = (locationState, searchParams) => {
  if (locationState?.stubContext) {
    return markDistributionTargetAsUnverified({
      stub_id: locationState.stubContext.stub_id || "",
      household_id: locationState.stubContext.household_id || "",
      disaster_event_id: locationState.stubContext.disaster_event_id || "",
      display_stub_no: locationState.stubContext.display_stub_no || "",
      stub_no: locationState.stubContext.stub_no || "--",
      serial_no: locationState.stubContext.serial_no || "--",
      status: locationState.stubContext.status || "--",
      family_head_name: locationState.stubContext.family_head_name || "--",
      barangay_name: locationState.stubContext.barangay_name || "--",
      household_size: Number(locationState.stubContext.household_size || 0),
      family_head_photo_url: locationState.stubContext.family_head_photo_url || "",
      photo_captured_at: locationState.stubContext.photo_captured_at || "",
      photo_verification_notes:
        locationState.stubContext.photo_verification_notes || "",
      qr_code_value: locationState.stubContext.qr_code_value || "",
      qr_status: locationState.stubContext.qr_status || "",
      qr_notes: locationState.stubContext.qr_notes || "",
    });
  }

  const stubId = searchParams.get("stub_id");
  const householdId = searchParams.get("household_id");
  const disasterEventId = searchParams.get("disaster_event_id");

  if (!stubId || !householdId || !disasterEventId) {
    return null;
  }

  return markDistributionTargetAsUnverified({
    stub_id: stubId,
    household_id: householdId,
    disaster_event_id: disasterEventId,
    display_stub_no: searchParams.get("display_stub_no") || "",
    stub_no: searchParams.get("stub_no") || "--",
    serial_no: searchParams.get("serial_no") || "--",
    status: searchParams.get("status") || "--",
    family_head_name: searchParams.get("family_head_name") || "--",
    barangay_name: searchParams.get("barangay_name") || "--",
    household_size: Number(searchParams.get("household_size") || 0),
    family_head_photo_url: searchParams.get("family_head_photo_url") || "",
    photo_captured_at: searchParams.get("photo_captured_at") || "",
    photo_verification_notes:
      searchParams.get("photo_verification_notes") || "",
    qr_code_value: searchParams.get("qr_code_value") || "",
    qr_status: searchParams.get("qr_status") || "",
    qr_notes: searchParams.get("qr_notes") || "",
  });
};

const DistributionTransactionPage = () => {
  const { authenticatedUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qrScannerVideoRef = useRef(null);
  const qrScannerInstanceRef = useRef(null);

  const [stubContext, setStubContext] = useState(() =>
    buildStubContextFromLocation(location.state, searchParams),
  );
  const [verifiedStubDetails, setVerifiedStubDetails] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoadingStubDetails, setIsLoadingStubDetails] = useState(false);
  const [qrLookupValue, setQrLookupValue] = useState("");
  const [isResolvingQrLookup, setIsResolvingQrLookup] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [qrScannerMessage, setQrScannerMessage] = useState("");
  const canUseQrScanner =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    Boolean(window.isSecureContext);
  const hasTrustedStubContext = isServerVerifiedDistributionTarget(stubContext);

  useEffect(() => {
    const currentStubContext = buildStubContextFromLocation(
      location.state,
      searchParams,
    );

    setStubContext(currentStubContext);

  }, [location.state, searchParams]);

  useEffect(() => {
    if (!stubContext?.stub_id) {
      return;
    }

    let isMounted = true;

    const loadStubDetails = async () => {
      setIsLoadingStubDetails(true);

      try {
        const stubDetails = await fetchStubDetails(stubContext.stub_id);

        if (!isMounted) {
          return;
        }

        setVerifiedStubDetails(stubDetails);
        setStubContext((currentValue) => {
          if (!currentValue) {
            return currentValue;
          }

          return {
            ...currentValue,
            ...buildStubContextFromDetails(stubDetails),
          };
        });
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error.message || "Failed to load family head verification photo.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingStubDetails(false);
        }
      }
    };

    loadStubDetails();

    return () => {
      isMounted = false;
    };
  }, [stubContext?.stub_id]);

  useEffect(() => {
    if (!isQrScannerOpen || !qrScannerVideoRef.current) {
      return;
    }

    setQrScannerMessage("");

    const scanner = new QrScanner(
      qrScannerVideoRef.current,
      (scanResult) => {
        const scannedValue =
          typeof scanResult === "string" ? scanResult : scanResult?.data || "";

        if (!scannedValue) {
          return;
        }

        setQrLookupValue(scannedValue);
        setIsQrScannerOpen(false);
        void resolveStubFromQrLookup(scannedValue);
      },
      {
        returnDetailedScanResult: true,
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
      },
    );

    qrScannerInstanceRef.current = scanner;

    scanner.start().catch(() => {
      setQrScannerMessage(
        "Unable to start QR camera scanning. You can enter the QR reference manually instead.",
      );
      setIsQrScannerOpen(false);
    });

    return () => {
      scanner.stop();
      scanner.destroy();
      qrScannerInstanceRef.current = null;
    };
  }, [isQrScannerOpen]);

  const handleCloseQrScanner = () => {
    qrScannerInstanceRef.current?.stop();
    qrScannerInstanceRef.current?.destroy();
    qrScannerInstanceRef.current = null;
    setIsQrScannerOpen(false);
  };

  const resolveStubFromQrLookup = async (lookupValue) => {
    const normalizedValue = extractStubQrValue(lookupValue);

    if (!normalizedValue) {
      setErrorMessage("Enter or scan a QR reference value first.");
      setSuccessMessage("");
      return;
    }

    setIsResolvingQrLookup(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const verification = await verifyStub({
        qrCodeValue: normalizedValue,
      });

      const resolvedStubId = verification?.data?.stub?.id;

      if (!resolvedStubId) {
        throw new Error("QR lookup did not return a valid stub record.");
      }

      const stubDetails = await fetchStubDetails(resolvedStubId);
      const nextStubContext = buildStubContextFromDetails(stubDetails);

      setVerifiedStubDetails(stubDetails);
      setStubContext(nextStubContext);
      setQrLookupValue(normalizedValue);

      if (verification?.data?.is_claimable) {
        setSuccessMessage("QR verified successfully. You can now record distribution.");
      } else {
        setErrorMessage(
          verification?.data?.reason ||
            verification?.message ||
            "This QR-linked stub is not claimable.",
        );
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to resolve the QR reference.");
    } finally {
      setIsResolvingQrLookup(false);
    }
  };

  const handleConfirmDistribution = async () => {
    if (!isServerVerifiedDistributionTarget(stubContext)) {
      setErrorMessage(UNTRUSTED_DISTRIBUTION_TARGET_MESSAGE);
      setSuccessMessage("");
      return;
    }

    if (!verifiedStubDetails || verifiedStubDetails.status !== "ISSUED") {
      setErrorMessage("Selected stub is not claimable for distribution.");
      setSuccessMessage("");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await claimStub({
        stubId: stubContext.stub_id,
        userId: authenticatedUser?.id || "",
        disasterEventId: stubContext.disaster_event_id,
        disasterEventTitle:
          verifiedStubDetails.disaster_event?.title ||
          verifiedStubDetails.disaster_event?.name ||
          "",
      });
      const isQueuedOffline =
        response?.queued_offline || response?.data?.status === "PENDING_SYNC";
      const nextStatus = isQueuedOffline
        ? "PENDING_SYNC"
        : response?.data?.status || "CLAIMED";

      setSuccessMessage(
        isQueuedOffline
          ? "Distribution saved offline. It will synchronize when connectivity is restored."
          : "Distribution recorded successfully.",
      );
      setVerifiedStubDetails((currentValue) =>
        currentValue
          ? {
              ...currentValue,
              status: nextStatus,
            }
          : currentValue,
      );
      setStubContext((currentValue) =>
        currentValue
          ? {
              ...currentValue,
              status: nextStatus,
            }
          : currentValue,
      );
    } catch (error) {
      setErrorMessage(error.message || "Unable to record the relief distribution.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Barangay Workspace"
        title="DISTRIBUTION TRANSACTION"
        description="Confirm the assigned relief packs after a stub has been verified. Eligible loose donations are used first, followed by Malvar LGU inventory."
        actions={[
          {
            label: "Back to Verification",
            variant: "secondary",
            onClick: () => navigate("/barangay/stub-distribution"),
          },
        ]}
      />

      <section style={shellStyles.card}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 1fr) auto auto",
            gap: "12px",
            alignItems: "end",
          }}
        >
          <div>
            <label htmlFor="qr_reference_lookup" style={qrLookupStyles.label}>
              QR Reference Lookup
            </label>
            <input
              id="qr_reference_lookup"
              type="text"
              value={qrLookupValue}
              onChange={(event) => setQrLookupValue(event.target.value)}
              placeholder="Scan or enter the stub QR reference value"
              style={qrLookupStyles.field}
            />
          </div>

          <button
            type="button"
            onClick={() => resolveStubFromQrLookup(qrLookupValue)}
            disabled={isResolvingQrLookup}
            style={{
              ...pageHeaderStyles.primaryButton,
              minHeight: "48px",
              opacity: isResolvingQrLookup ? 0.7 : 1,
            }}
          >
            {isResolvingQrLookup ? "Verifying..." : "Verify QR"}
          </button>

          <button
            type="button"
            onClick={() => setIsQrScannerOpen((currentValue) => !currentValue)}
            disabled={!canUseQrScanner || isResolvingQrLookup}
            style={{
              ...pageHeaderStyles.secondaryButton,
              minHeight: "48px",
              opacity: !canUseQrScanner || isResolvingQrLookup ? 0.7 : 1,
              cursor:
                !canUseQrScanner || isResolvingQrLookup
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {isQrScannerOpen ? "Close Scanner" : "Scan QR"}
          </button>
        </div>

        <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
          QR verification identifies the household. The distribution confirmation
          uses the same eligibility and relief-pack assignment rules as the Barangay
          dashboard.
        </p>

        {!canUseQrScanner ? (
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Camera QR scanning is available only on HTTPS or localhost in a supported browser.
          </p>
        ) : null}

        {qrScannerMessage ? (
          <p style={{ ...shellStyles.mutedText, marginTop: "8px", color: "#a14d58" }}>
            {qrScannerMessage}
          </p>
        ) : null}

        {isQrScannerOpen ? (
          <div style={{ marginTop: "16px" }}>
            <video
              ref={qrScannerVideoRef}
              style={qrLookupStyles.video}
              muted
              playsInline
            />
            <div style={{ marginTop: "12px" }}>
              <button
                type="button"
                onClick={handleCloseQrScanner}
                style={pageHeaderStyles.secondaryButton}
              >
                Stop Scanner
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <StubSummaryCard
        stubContext={stubContext}
        isLoadingStubDetails={isLoadingStubDetails}
      />

      {errorMessage ? (
        <section style={shellStyles.card}>
          <p style={{ ...shellStyles.mutedText, color: "#a14d58", margin: 0 }}>
            {errorMessage}
          </p>
        </section>
      ) : null}

      {successMessage ? (
        <section style={shellStyles.card}>
          <p style={{ ...shellStyles.mutedText, color: "#2f6f4e", margin: 0 }}>
            {successMessage}
          </p>
        </section>
      ) : null}

      <StubClaimConfirmModal
        isOpen={
          hasTrustedStubContext &&
          verifiedStubDetails?.status === "ISSUED"
        }
        isSubmitting={isSubmitting}
        isLoadingStubDetails={isLoadingStubDetails}
        onCancel={() => navigate("/barangay/stub-distribution")}
        onConfirm={handleConfirmDistribution}
        stubDetails={verifiedStubDetails}
      />
    </>
  );
};

export default DistributionTransactionPage;
