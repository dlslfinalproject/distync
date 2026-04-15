import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { shellStyles } from "../components/layout/BarangayLayout";
import { useAuth } from "../context/AuthContext";
import { renderGoogleSignInButton } from "../features/auth/authService";
import { ACCESS_MODES, getAccessMode } from "../utils/accessMode";
import {
  ROLE_CODES,
  getDefaultRouteForRole,
} from "../utils/roleSession";

const AccessPage = () => {
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const [pageError, setPageError] = useState("");
  const accessMode = getAccessMode();
  const {
    authError,
    clearAuthError,
    continueAsDonor,
    isAuthLoading,
    signInWithGoogleCredential,
  } = useAuth();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const isDemoMode = useMemo(() => {
    return accessMode === ACCESS_MODES.DEMO;
  }, [accessMode]);

  const handleGoogleCredential = useCallback(
    async (credential) => {
      clearAuthError();
      setPageError("");

      if (!credential) {
        setPageError("Google sign-in did not return a credential");
        return;
      }

      try {
        const sessionPayload = await signInWithGoogleCredential(credential);

        navigate(getDefaultRouteForRole(sessionPayload.user.role), {
          replace: true,
        });
      } catch (error) {
        setPageError(error.message || "Google sign-in failed");
      }
    },
    [clearAuthError, navigate, signInWithGoogleCredential],
  );

  useEffect(() => {
    let isMounted = true;

    const setupGoogleButton = async () => {
      if (!isDemoMode || !googleButtonRef.current) {
        return;
      }

      if (!googleClientId) {
        setPageError("VITE_GOOGLE_CLIENT_ID is missing");
        return;
      }

      try {
        await renderGoogleSignInButton({
          element: googleButtonRef.current,
          clientId: googleClientId,
          onCredential: (credential) => {
            if (isMounted) {
              handleGoogleCredential(credential);
            }
          },
        });
      } catch (error) {
        if (isMounted) {
          setPageError(error.message || "Failed to load Google Sign-In");
        }
      }
    };

    setupGoogleButton();

    return () => {
      isMounted = false;
    };
  }, [
    googleClientId,
    handleGoogleCredential,
    isDemoMode,
  ]);

  useEffect(() => {
    if (isDemoMode && authError) {
      setPageError(authError);
    }
  }, [authError, isDemoMode]);

  const handleDonorAccess = () => {
    clearAuthError();
    setPageError("");
    continueAsDonor();
    navigate(getDefaultRouteForRole(ROLE_CODES.DONOR), { replace: true });
  };

  const handleDevelopmentStaffAccess = () => {
    clearAuthError();
    setPageError("");
    navigate("/role-switcher", { replace: true });
  };

  return (
    <div
      style={{
        ...shellStyles.page,
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "min(1080px, 100%)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
          gap: "20px",
        }}
      >
        <section
          style={{
            ...shellStyles.card,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            background: "linear-gradient(180deg, #ffffff 0%, #f5faff 100%)",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#60738a",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {isDemoMode ? "Demo Access Mode" : "Access Entry"}
          </p>
          <h1 style={{ margin: 0, color: "#17324d", fontSize: "36px" }}>
            Welcome to DISTYNC
          </h1>
          <p style={shellStyles.mutedText}>
            This entry flow is ready for demos now and structured so we can plug
            real authentication into the same redirect logic later.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginTop: "6px",
            }}
          >
            <div
              style={{
                ...shellStyles.card,
                padding: "18px",
                textAlign: "left",
                backgroundColor: "#ffffff",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#6a8097",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Authorized User Access
              </p>
              <h2 style={{ margin: "10px 0 0", color: "#17324d", fontSize: "22px" }}>
                Staff Login Path
              </h2>
              <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
                {isDemoMode
                  ? "Sign in with the authorized Google account linked to your DISTYNC user record. Your role will be loaded from the database."
                  : "Development Mode uses the role switcher for fast testing instead of Google sign-in."}
              </p>
              {isDemoMode ? (
                <>
                  <div
                    ref={googleButtonRef}
                    style={{ marginTop: "18px", minHeight: "44px" }}
                  />
                  {isAuthLoading ? (
                    <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                      Verifying Google sign-in...
                    </p>
                  ) : null}
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleDevelopmentStaffAccess}
                  style={{
                    marginTop: "18px",
                    border: "1px solid #c7d7e8",
                    borderRadius: "999px",
                    backgroundColor: "#ffffff",
                    color: "#24496e",
                    padding: "12px 18px",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Continue to Role Switcher
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleDonorAccess}
              style={{
                ...shellStyles.card,
                padding: "18px",
                textAlign: "left",
                cursor: "pointer",
                backgroundColor: "#ffffff",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#6a8097",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Donor / NGO Public Access
              </p>
              <h2 style={{ margin: "10px 0 0", color: "#17324d", fontSize: "22px" }}>
                Public Donation View
              </h2>
              <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
                Continue directly into the donor-facing route without the staff
                access step.
              </p>
            </button>
          </div>

          {pageError || authError ? (
            <section
              style={{
                border: "1px solid #efc7ca",
                borderRadius: "18px",
                padding: "18px",
                backgroundColor: "#fff6f7",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#9f4652",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Sign-In Error
              </p>
              <p style={{ ...shellStyles.mutedText, marginTop: "10px", color: "#8f4c55" }}>
                {pageError || authError}
              </p>
            </section>
          ) : null}
        </section>

        <aside
          style={{
            ...shellStyles.card,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                color: "#60738a",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Current App Mode
            </p>
            <h2 style={{ margin: "10px 0 0", color: "#17324d", fontSize: "28px" }}>
              {accessMode}
            </h2>
          </div>

          <div
            style={{
              borderRadius: "16px",
              backgroundColor: "#f6faff",
              border: "1px solid #d7e2ef",
              padding: "18px",
            }}
          >
            <h3 style={{ margin: 0, color: "#17324d", fontSize: "18px" }}>
              Future auth hook point
            </h3>
            <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
              Authorized users now go through backend verification, while donor
              access stays public and the development role switcher stays available
              in Development Mode.
            </p>
          </div>

          <div
            style={{
              borderRadius: "16px",
              backgroundColor: "#fdfefe",
              border: "1px solid #d7e2ef",
              padding: "18px",
            }}
          >
            <h3 style={{ margin: 0, color: "#17324d", fontSize: "18px" }}>
              What this mode gives us now
            </h3>
            <ul
              style={{
                margin: "12px 0 0",
                paddingLeft: "18px",
                color: "#60738a",
                lineHeight: 1.7,
              }}
            >
              <li>Role-based redirects</li>
              <li>Role-based sidebar navigation</li>
              <li>Fast demo entry without backend auth changes</li>
              <li>One route guard pattern we can reuse later</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AccessPage;
