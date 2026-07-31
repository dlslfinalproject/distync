import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchStubDetails, verifyStub } from "../features/stubs/stubService";
import { ROLE_CODES } from "../utils/roleSession";
import { extractStubQrValue } from "../utils/stubQr";

const pageStyles = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    boxSizing: "border-box",
    background:
      "linear-gradient(180deg, #edf4fb 0%, #e5eef7 50%, #dde7f2 100%)",
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  },
  content: {
    width: "100%",
    maxWidth: "920px",
    margin: "0 auto",
    display: "grid",
    gap: "16px",
  },
  section: {
    backgroundColor: "#ffffff",
    border: "1px solid #dbe6f1",
    borderRadius: "14px",
    padding: "24px",
    boxShadow: "0 8px 18px rgba(76, 101, 132, 0.06)",
    display: "grid",
    gap: "14px",
  },
  eyebrow: {
    margin: 0,
    color: "#48627d",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    color: "#17324d",
    fontSize: "30px",
    fontWeight: 800,
  },
  text: {
    margin: 0,
    color: "#5e7288",
    fontSize: "15px",
    lineHeight: 1.6,
  },
  verificationLayout: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 280px) minmax(0, 1fr)",
    gap: "24px",
    alignItems: "start",
  },
  statusBanner: {
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: 700,
  },
  photoPreview: {
    width: "100%",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "14px",
    border: "1px solid #d5e1eb",
    backgroundColor: "#eaf2f8",
  },
  photoPlaceholder: {
    width: "100%",
    aspectRatio: "4 / 3",
    borderRadius: "14px",
    border: "1px dashed #cad9e8",
    backgroundColor: "#f4f8fb",
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
  photoMeta: {
    display: "grid",
    gap: "8px",
  },
  detailsList: {
    display: "grid",
    gap: "12px",
  },
  detailRow: {
    display: "grid",
    gridTemplateColumns: "180px minmax(0, 1fr)",
    gap: "12px",
    alignItems: "start",
    paddingBottom: "12px",
    borderBottom: "1px solid #edf3f8",
  },
  detailLabel: {
    margin: 0,
    color: "#60758c",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  detailValue: {
    margin: 0,
    color: "#17324d",
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1.45,
    wordBreak: "break-word",
  },
  actions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "14px",
    padding: "12px 18px",
    backgroundColor: "#214b77",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 700,
    width: "fit-content",
  },
  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "14px",
    padding: "12px 18px",
    backgroundColor: "#f8fbfe",
    border: "1px solid #c6d8ea",
    color: "#24496e",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 700,
    width: "fit-content",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 2000,
  },
  modal: {
    width: "100%",
    maxWidth: "460px",
    backgroundColor: "#ffffff",
    borderRadius: "16px",
    border: "1px solid #d7e2ef",
    padding: "24px",
    boxShadow: "0 18px 36px rgba(15, 23, 42, 0.18)",
    display: "grid",
    gap: "16px",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    flexWrap: "wrap",
  },
  secondaryButton: {
    borderRadius: "14px",
    padding: "12px 18px",
    backgroundColor: "#f8fbfe",
    border: "1px solid #c6d8ea",
    color: "#24496e",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  primaryButton: {
    borderRadius: "14px",
    padding: "12px 18px",
    backgroundColor: "#214b77",
    border: "1px solid #214b77",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
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

const getStatusBannerStyles = (status) => {
  if (status === "CLAIMED") {
    return {
      backgroundColor: "#fef0f1",
      color: "#9b3d4b",
      border: "1px solid #f2c5cb",
    };
  }

  if (status === "ISSUED") {
    return {
      backgroundColor: "#eef5fc",
      color: "#295f92",
      border: "1px solid #c8dbee",
    };
  }

  if (status === "CANCELLED") {
    return {
      backgroundColor: "#f6ebeb",
      color: "#9d4d58",
      border: "1px solid #ebc7ce",
    };
  }

  return {
    backgroundColor: "#eef2f6",
    color: "#5f7288",
    border: "1px solid #d6e0ea",
  };
};

const getDefaultWorkspaceLink = (role) => {
  if (role === ROLE_CODES.BARANGAY) {
    return "/barangay/stub-distribution";
  }

  if (role === ROLE_CODES.MSWDO) {
    return "/mswdo/stub-distribution";
  }

  return "/access";
};

const buildSectorText = (stubDetails) => {
  const sectorNames = (stubDetails?.household_sectors || [])
    .map((sector) => sector?.name)
    .filter(Boolean);

  if (sectorNames.length === 0) {
    return "No sector indicated.";
  }

  return sectorNames.join(", ");
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

const getPrimaryAssignedReliefPackTemplate = (stubDetails) => {
  const assignedTemplates = Array.isArray(stubDetails?.assigned_relief_packs)
    ? stubDetails.assigned_relief_packs
    : [];

  return (
    assignedTemplates.find((template) => !template?.is_additional_pack) ||
    assignedTemplates[0] ||
    null
  );
};

const buildReliefPackText = (stubDetails) => {
  const primaryTemplate = getPrimaryAssignedReliefPackTemplate(stubDetails);
  const packMultiplier = getReliefPackQuantityMultiplier(
    primaryTemplate,
    stubDetails?.household?.household_size,
  );
  const assignedPackNames = (stubDetails?.assigned_relief_packs || [])
    .map((template) => template?.name)
    .filter(Boolean)
    .join(", ");
  const basePackText =
    stubDetails?.distribution_transaction?.relief_pack_template_name ||
    stubDetails?.relief_pack_name ||
    assignedPackNames ||
    "--";

  return packMultiplier > 1 ? `${basePackText} (${packMultiplier})` : basePackText;
};

const buildBarangayDistributionLink = (stubDetails) => {
  if (!stubDetails) {
    return "/barangay/distribution-transaction";
  }

  const searchParams = new URLSearchParams({
    stub_id: stubDetails.id,
    household_id: stubDetails.household?.id || "",
    disaster_event_id: stubDetails.disaster_event?.id || "",
    display_stub_no: stubDetails.display_stub_no || "",
    stub_no: stubDetails.stub_no || "",
    qr_code_value: stubDetails.qr_code_value || "",
  });

  return `/barangay/distribution-transaction?${searchParams.toString()}`;
};

const VerifyStubPage = () => {
  const [searchParams] = useSearchParams();
  const { currentRole, isAuthenticated } = useAuth();
  const qrValue = useMemo(
    () => extractStubQrValue(searchParams.get("qr")),
    [searchParams],
  );
  const [stubDetails, setStubDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadStubVerification = async () => {
      if (!qrValue) {
        setErrorMessage("No QR value was found in this link. Please scan the stub again.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      setVerificationMessage("");

      try {
        const verification = await verifyStub({
          qrCodeValue: qrValue,
        });

        const resolvedStubId = verification?.data?.stub?.id;

        if (!resolvedStubId) {
          throw new Error("No stub record was linked to this QR code.");
        }

        const details = await fetchStubDetails(resolvedStubId);

        if (!isMounted) {
          return;
        }

        setStubDetails(details);
        setVerificationMessage(
          verification?.data?.reason ||
            verification?.message ||
            "Stub verification loaded successfully.",
        );
      } catch (error) {
        if (isMounted) {
          setStubDetails(null);
          setErrorMessage(error.message || "Unable to verify the scanned stub.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadStubVerification();

    return () => {
      isMounted = false;
    };
  }, [qrValue]);

  const canProceedToValidation =
    isAuthenticated &&
    (currentRole === ROLE_CODES.BARANGAY || currentRole === ROLE_CODES.MSWDO) &&
    stubDetails?.status === "ISSUED";

  const isClaimedStub = stubDetails?.status === "CLAIMED";
  const proceedLink =
    currentRole === ROLE_CODES.BARANGAY
      ? buildBarangayDistributionLink(stubDetails)
      : getDefaultWorkspaceLink(currentRole);

  return (
    <div style={pageStyles.page}>
      <div style={pageStyles.content}>
        <section style={pageStyles.section}>
          <p style={pageStyles.eyebrow}>DISTYNC Stub Verification</p>
          <h1 style={pageStyles.title}>Scanned Stub Information</h1>

          <p style={pageStyles.text}>
            This page looks up the household linked to the scanned stub QR code and
            shows its current claim status for verification.
          </p>

          {isLoading ? (
            <p style={pageStyles.text}>Loading stub verification data...</p>
          ) : errorMessage ? (
            <p style={{ ...pageStyles.text, color: "#a14d58" }}>{errorMessage}</p>
          ) : stubDetails ? (
            <>
              <div
                style={{
                  ...pageStyles.statusBanner,
                  ...getStatusBannerStyles(stubDetails.status),
                }}
              >
                {isClaimedStub
                  ? "This stub has already been claimed."
                  : `Claim status: ${stubDetails.status || "UNKNOWN"}`}
              </div>

              {verificationMessage && !isClaimedStub ? (
                <p style={pageStyles.text}>{verificationMessage}</p>
              ) : null}

              <div style={pageStyles.verificationLayout}>
                <div style={pageStyles.photoMeta}>
                  {stubDetails.household?.family_head_photo_url ? (
                    <img
                      src={stubDetails.household.family_head_photo_url}
                      alt="Registered family head"
                      style={pageStyles.photoPreview}
                    />
                  ) : (
                    <div style={pageStyles.photoPlaceholder}>No photo available</div>
                  )}

                  {stubDetails.household?.photo_captured_at ? (
                    <p style={pageStyles.text}>
                      Captured:{" "}
                      {formatPhotoCapturedAt(stubDetails.household.photo_captured_at)}
                    </p>
                  ) : null}

                  {stubDetails.household?.photo_verification_notes ? (
                    <p style={pageStyles.text}>
                      Notes: {stubDetails.household.photo_verification_notes}
                    </p>
                  ) : null}
                </div>

                <div style={pageStyles.detailsList}>
                  <div style={pageStyles.detailRow}>
                    <p style={pageStyles.detailLabel}>Stub Number</p>
                    <p style={pageStyles.detailValue}>
                      {stubDetails.display_stub_no || "--"}
                    </p>
                  </div>

                  <div style={pageStyles.detailRow}>
                    <p style={pageStyles.detailLabel}>Claim Status</p>
                    <p style={pageStyles.detailValue}>{stubDetails.status || "--"}</p>
                  </div>

                  <div style={pageStyles.detailRow}>
                    <p style={pageStyles.detailLabel}>Family Head Name</p>
                    <p style={pageStyles.detailValue}>
                      {stubDetails.household?.family_head_name || "--"}
                    </p>
                  </div>

                  <div style={pageStyles.detailRow}>
                    <p style={pageStyles.detailLabel}>Barangay</p>
                    <p style={pageStyles.detailValue}>
                      {stubDetails.barangay?.name || "--"}
                    </p>
                  </div>

                  <div style={pageStyles.detailRow}>
                    <p style={pageStyles.detailLabel}>Disaster Event</p>
                    <p style={pageStyles.detailValue}>
                      {[
                        stubDetails.disaster_event?.event_code,
                        stubDetails.disaster_event?.title,
                      ]
                        .filter(Boolean)
                        .join(" - ") || "--"}
                    </p>
                  </div>

                  <div style={pageStyles.detailRow}>
                    <p style={pageStyles.detailLabel}>Household Size</p>
                    <p style={pageStyles.detailValue}>
                      {stubDetails.household?.household_size ?? "--"}
                    </p>
                  </div>

                  <div style={pageStyles.detailRow}>
                    <p style={pageStyles.detailLabel}>Relief Pack</p>
                    <p style={pageStyles.detailValue}>
                      {buildReliefPackText(stubDetails)}
                    </p>
                  </div>

                  <div style={pageStyles.detailRow}>
                    <p style={pageStyles.detailLabel}>Sectors</p>
                    <p style={pageStyles.detailValue}>
                      {buildSectorText(stubDetails)}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </section>

        <section style={pageStyles.section}>
          <p style={pageStyles.eyebrow}>Next Step</p>

          {canProceedToValidation ? (
            <>
              <p style={pageStyles.text}>
                You are signed in with an authorized staff role. You can continue to
                claim or validate this stub in the appropriate DISTYNC workflow.
              </p>
              <div style={pageStyles.actions}>
                <Link to={proceedLink} style={pageStyles.primaryLink}>
                  {currentRole === ROLE_CODES.BARANGAY
                    ? "Proceed to Distribution Validation"
                    : "Open MSWDO Stub Validation"}
                </Link>
                <Link
                  to={getDefaultWorkspaceLink(currentRole)}
                  style={pageStyles.secondaryLink}
                >
                  Open Workspace
                </Link>
              </div>
            </>
          ) : isAuthenticated &&
            (currentRole === ROLE_CODES.BARANGAY ||
              currentRole === ROLE_CODES.MSWDO) ? (
            <p style={pageStyles.text}>
              This stub cannot proceed to validation because its current status is{" "}
              <strong>{stubDetails?.status || "UNKNOWN"}</strong>.
            </p>
          ) : (
            <>
              <p style={pageStyles.text}>
                Sign in with an authorized Barangay or MSWDO account to continue
                with claim or distribution validation.
              </p>
              <div style={pageStyles.actions}>
                <Link to="/access" style={pageStyles.primaryLink}>
                  Open DISTYNC Sign In
                </Link>
              </div>
            </>
          )}
        </section>
      </div>

    </div>
  );
};

export default VerifyStubPage;
