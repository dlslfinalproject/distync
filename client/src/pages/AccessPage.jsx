import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { renderGoogleSignInButton } from "../features/auth/authService";
import { ACCESS_MODES, getAccessMode } from "../utils/accessMode";
import {
  ROLE_CODES,
  getDefaultRouteForRole,
} from "../utils/roleSession";
import StaffAccessPanel from "../components/access/StaffAccessPanel";
import "../components/access/accessPage.css";

const getReadableAccessError = (message) => {
  const normalizedMessage = String(message || "").trim();

  if (!normalizedMessage) {
    return "";
  }

  if (
    normalizedMessage.includes("Failed to fetch") ||
    normalizedMessage.includes("NetworkError") ||
    normalizedMessage.includes("Load failed")
  ) {
    return "Unable to reach the DISTYNC server right now. Please check the internet connection and try again.";
  }

  return normalizedMessage;
};

const AccessPage = () => {
  const navigate = useNavigate();
  const googleButtonRef = React.useRef(null);
  const [pageError, setPageError] = useState("");
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const accessMode = getAccessMode();
  const {
    authError,
    clearAuthError,
    continueAsDonor,
    isAuthLoading,
    signInWithGoogleCredential,
  } = useAuth();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const isDevelopmentMode = accessMode === ACCESS_MODES.DEVELOPMENT;

  const combinedError = useMemo(() => {
    return getReadableAccessError(pageError || authError);
  }, [authError, pageError]);

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
        setPageError("Google sign-in did not finish correctly. Please try again.");
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

  useEffect(() => {
    let isMounted = true;

    const setupGoogleButton = async () => {
      if (isDevelopmentMode || !googleButtonRef.current) {
        return;
      }

      if (!googleClientId) {
        setIsGoogleReady(false);
        return;
      }

      try {
        await renderGoogleSignInButton({
          element: googleButtonRef.current,
          clientId: googleClientId,
          onCredential: (credential) => {
            if (isMounted) {
              void handleGoogleCredential(credential);
            }
          },
        });

        if (isMounted) {
          setIsGoogleReady(true);
        }
      } catch (_error) {
        if (isMounted) {
          setIsGoogleReady(false);
        }
      }
    };

    void setupGoogleButton();

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
    navigate(getDefaultRouteForRole(ROLE_CODES.DONOR));
  };

  if (isDevelopmentMode) {
    return <Navigate to="/role-switcher" replace />;
  }

  return (
    <div className="distync-access-page">
      <div className="distync-access-page__backdrop" aria-hidden="true" />
      <div className="distync-access-page__shell">
        <StaffAccessPanel
          googleButtonRef={googleButtonRef}
          isAuthLoading={isAuthLoading}
          isGoogleReady={isGoogleReady}
          onDonationPortalAccess={handleDonorAccess}
          pageError={combinedError}
        />
      </div>
    </div>
  );
};

export default AccessPage;
