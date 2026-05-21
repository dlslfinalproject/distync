import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { shellStyles } from "../components/layout/BarangayLayout";
import { useAuth } from "../context/AuthContext";
import { renderGoogleSignInButton } from "../features/auth/authService";
import { ACCESS_MODES, getAccessMode } from "../utils/accessMode";
import {
  ROLE_CODES,
  getDefaultRouteForRole,
} from "../utils/roleSession";

const inputStyles = {
  width: "100%",
  minHeight: "48px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #d2deea",
  backgroundColor: "#ffffff",
  color: "#21405f",
  fontSize: "14px",
  boxSizing: "border-box",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
};

const buttonStyles = {
  primary: {
    border: "none",
    borderRadius: "999px",
    backgroundColor: "#24496e",
    color: "#ffffff",
    padding: "12px 18px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondary: {
    border: "1px solid #c7d7e8",
    borderRadius: "999px",
    backgroundColor: "#ffffff",
    color: "#24496e",
    padding: "12px 18px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  link: {
    border: "none",
    background: "none",
    padding: 0,
    color: "#507192",
    fontSize: "13px",
    textAlign: "left",
  },
};

const AccessPage = () => {
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const [pageError, setPageError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const accessMode = getAccessMode();
  const {
    authError,
    clearAuthError,
    continueAsDonor,
    isAuthLoading,
    signInWithDemoCredentials,
    signInWithGoogleCredential,
  } = useAuth();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const isDemoMode = accessMode === ACCESS_MODES.DEMO;
  const isDevelopmentMode = accessMode === ACCESS_MODES.DEVELOPMENT;
  const isProductionMode = accessMode === ACCESS_MODES.PRODUCTION;

  const signInTitle = useMemo(() => {
    if (isDemoMode) {
      return "Demo Access Mode";
    }

    if (isProductionMode) {
      return "Staff Access";
    }

    return "Access Entry";
  }, [isDemoMode, isProductionMode]);

  const handleAuthenticatedRedirect = useCallback(
    (sessionPayload) => {
      navigate(getDefaultRouteForRole(sessionPayload.user.role), {
        replace: true,
      });
    },
    [navigate],
  );

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
        handleAuthenticatedRedirect(sessionPayload);
      } catch (error) {
        setPageError(error.message || "Google sign-in failed");
      }
    },
    [clearAuthError, handleAuthenticatedRedirect, signInWithGoogleCredential],
  );

  const handleDemoLogin = async (event) => {
    event.preventDefault();
    clearAuthError();
    setPageError("");

    if (!email.trim()) {
      setPageError("Email is required.");
      return;
    }

    if (!password) {
      setPageError("Password is required.");
      return;
    }

    try {
      const sessionPayload = await signInWithDemoCredentials({
        email: email.trim().toLowerCase(),
        password,
      });
      handleAuthenticatedRedirect(sessionPayload);
    } catch (error) {
      setPageError(error.message || "Demo sign-in failed");
    }
  };

  useEffect(() => {
    let isMounted = true;

    const setupGoogleButton = async () => {
      if (isDevelopmentMode || !googleButtonRef.current) {
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
  }, [googleClientId, handleGoogleCredential, isDevelopmentMode]);

  useEffect(() => {
    if (!isDevelopmentMode && authError) {
      setPageError(authError);
    }
  }, [authError, isDevelopmentMode]);

  const handleDonorAccess = () => {
    clearAuthError();
    setPageError("");
    continueAsDonor();
    navigate(getDefaultRouteForRole(ROLE_CODES.DONOR), { replace: true });
  };

  if (isDevelopmentMode) {
    return <Navigate to="/role-switcher" replace />;
  }

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
            {signInTitle}
          </p>
          <h1 style={{ margin: 0, color: "#17324d", fontSize: "36px" }}>
            Welcome to DISTYNC
          </h1>
          <p style={shellStyles.mutedText}>
            {isDemoMode
              ? "Sign in with approved demo credentials or Google access tied to an authorized DISTYNC user account."
              : "Sign in with the authorized Google account linked to your DISTYNC user record."}
          </p>

          {isDemoMode ? (
            <section
              style={{
                borderRadius: "16px",
                backgroundColor: "#f8fbfe",
                border: "1px solid #d7e2ef",
                padding: "18px",
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
                Demo Notice
              </p>
              <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
                Demo access mode only.
              </p>
            </section>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
              marginTop: "6px",
            }}
          >
            <section
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
                Staff Login Path
              </p>
              <h2 style={{ margin: "10px 0 0", color: "#17324d", fontSize: "22px" }}>
                {isDemoMode ? "Demo Login Dashboard" : "Authorized Google Sign-In"}
              </h2>
              <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
                {isDemoMode
                  ? "Use a valid DISTYNC user email and the demo password configured on the server, or continue with Google sign-in."
                  : "Continue with the authorized Google account linked to your DISTYNC user record."}
              </p>

              {isDemoMode ? (
                <form onSubmit={handleDemoLogin} style={{ marginTop: "18px", display: "grid", gap: "14px" }}>
                  <div>
                    <label htmlFor="demo-login-email" style={labelStyles}>
                      Email
                    </label>
                    <input
                      id="demo-login-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Enter your demo access email"
                      autoComplete="username"
                      style={inputStyles}
                      disabled={isAuthLoading}
                    />
                  </div>

                  <div>
                    <label htmlFor="demo-login-password" style={labelStyles}>
                      Password
                    </label>
                    <input
                      id="demo-login-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your demo password"
                      autoComplete="current-password"
                      style={inputStyles}
                      disabled={isAuthLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    style={{
                      ...buttonStyles.primary,
                      opacity: isAuthLoading ? 0.72 : 1,
                      cursor: isAuthLoading ? "wait" : "pointer",
                    }}
                  >
                    {isAuthLoading ? "Signing in..." : "Login"}
                  </button>

                  <button
                    type="button"
                    disabled
                    style={{
                      ...buttonStyles.link,
                      opacity: 0.7,
                      cursor: "not-allowed",
                    }}
                    title="Forgot password flow is not configured yet."
                  >
                    Forgot password? Contact the system administrator.
                  </button>
                </form>
              ) : null}

              <div
                style={{
                  marginTop: "18px",
                  display: "grid",
                  gap: "10px",
                }}
              >
                <div
                  ref={googleButtonRef}
                  style={{ minHeight: "44px" }}
                />
                {isAuthLoading ? (
                  <p style={{ ...shellStyles.mutedText, margin: 0 }}>
                    Verifying sign-in...
                  </p>
                ) : null}
              </div>
            </section>

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
              Current access behavior
            </h3>
            <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
              {isDemoMode
                ? "Demo mode supports server-validated email/password access and Google sign-in for authorized users."
                : "Production mode keeps the normal authorized Google sign-in path without exposing development shortcuts."}
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
              What stays protected
            </h3>
            <ul
              style={{
                margin: "12px 0 0",
                paddingLeft: "18px",
                color: "#60738a",
                lineHeight: 1.7,
              }}
            >
              <li>Development role switcher is hidden outside Development mode</li>
              <li>Inactive users cannot sign in</li>
              <li>Google staff access stays role-based</li>
              <li>Donor access remains separate from staff access</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AccessPage;
