import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { renderGoogleSignInButton } from "../features/auth/authService";
import { measureGoogleButtonWidth } from "../features/auth/googleButtonSizing";
import { ACCESS_MODES, getAccessMode } from "../utils/accessMode";
import {
  ROLE_CODES,
  getDefaultRouteForRole,
} from "../utils/roleSession";
import AccessBrandPanel from "../components/access/AccessBrandPanel";
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
    let renderFrame = 0;
    let renderRequestId = 0;
    let isRendering = false;
    let lastRenderedWidth = 0;

    const setupGoogleButton = async (requestId) => {
      const buttonElement = googleButtonRef.current;

      if (isDevelopmentMode || !buttonElement) {
        return;
      }

      if (!googleClientId) {
        setIsGoogleReady(false);
        return;
      }

      const nextRenderedWidth = measureGoogleButtonWidth(buttonElement);

      if (!nextRenderedWidth) {
        lastRenderedWidth = 0;
        return;
      }

      if (isRendering) {
        return;
      }

      if (nextRenderedWidth === lastRenderedWidth && buttonElement.childElementCount > 0) {
        return;
      }

      isRendering = true;
      let renderedButtonWidth = 0;
      let renderSucceeded = false;

      try {
        renderedButtonWidth = await renderGoogleSignInButton({
          element: buttonElement,
          clientId: googleClientId,
          isActive: () => isMounted && requestId === renderRequestId,
          onCredential: (credential) => {
            if (isMounted) {
              void handleGoogleCredential(credential);
            }
          },
        });

        if (isMounted && requestId === renderRequestId) {
          lastRenderedWidth = renderedButtonWidth;
          renderSucceeded = renderedButtonWidth > 0;
          setIsGoogleReady(renderSucceeded);
        }
      } catch (_error) {
        if (isMounted && requestId === renderRequestId) {
          lastRenderedWidth = 0;
          setIsGoogleReady(false);
        }
      } finally {
        isRendering = false;

        if (!isMounted) {
          return;
        }

        const currentRenderedWidth = measureGoogleButtonWidth(googleButtonRef.current);
        const hasNewerRequest = requestId !== renderRequestId;
        const needsFollowUpRender =
          renderSucceeded &&
          currentRenderedWidth > 0 &&
          currentRenderedWidth !== lastRenderedWidth;

        if (hasNewerRequest || needsFollowUpRender) {
          queueGoogleButtonSetup();
        }
      }
    };

    const queueGoogleButtonSetup = () => {
      window.cancelAnimationFrame(renderFrame);
      const requestId = ++renderRequestId;
      renderFrame = window.requestAnimationFrame(() => {
        void setupGoogleButton(requestId);
      });
    };

    queueGoogleButtonSetup();

    const buttonElement = googleButtonRef.current;
    const resizeObserver =
      !isDevelopmentMode && buttonElement && "ResizeObserver" in window
        ? new ResizeObserver(queueGoogleButtonSetup)
        : null;

    if (resizeObserver && buttonElement) {
      resizeObserver.observe(buttonElement);
    }

    window.addEventListener("resize", queueGoogleButtonSetup);
    window.addEventListener("orientationchange", queueGoogleButtonSetup);

    return () => {
      isMounted = false;
      renderRequestId += 1;
      window.cancelAnimationFrame(renderFrame);
      window.removeEventListener("resize", queueGoogleButtonSetup);
      window.removeEventListener("orientationchange", queueGoogleButtonSetup);
      resizeObserver?.disconnect();
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
      <div className="distync-access-page__shell">
        <StaffAccessPanel
          googleButtonRef={googleButtonRef}
          isAuthLoading={isAuthLoading}
          isGoogleReady={isGoogleReady}
          onDonationPortalAccess={handleDonorAccess}
          pageError={combinedError}
        />
      </div>
      <AccessBrandPanel />
    </div>
  );
};

export default AccessPage;
