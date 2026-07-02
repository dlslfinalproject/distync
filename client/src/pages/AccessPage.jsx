import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { renderGoogleSignInButton } from "../features/auth/authService";
import { requestPasswordReset } from "../features/auth/passwordResetService";
import { ACCESS_MODES, getAccessMode } from "../utils/accessMode";
import {
  ROLE_CODES,
  getDefaultRouteForRole,
} from "../utils/roleSession";
import StaffAccessPanel from "../components/access/StaffAccessPanel";
import "../components/access/accessPage.css";

const isValidEmail = (value) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
};

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

  if (normalizedMessage.includes("Invalid email or password")) {
    return "The email or password you entered is incorrect. Please review your credentials and try again.";
  }

  return normalizedMessage;
};

const AccessPage = () => {
  const navigate = useNavigate();
  const googleButtonRef = React.useRef(null);
  const [pageError, setPageError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [activeView, setActiveView] = useState("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetFieldError, setResetFieldError] = useState("");
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetFeedback, setResetFeedback] = useState({
    type: "",
    message: "",
  });
  const [fieldErrors, setFieldErrors] = useState({
    email: "",
    password: "",
  });
  const [isGoogleReady, setIsGoogleReady] = useState(false);
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

  const validateAccessForm = useCallback(() => {
    const nextErrors = {
      email: "",
      password: "",
    };

    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!isValidEmail(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    }

    setFieldErrors(nextErrors);

    return !nextErrors.email && !nextErrors.password;
  }, [email, password]);

  const validateResetEmail = useCallback(() => {
    if (!resetEmail.trim()) {
      setResetFieldError("Email is required.");
      return false;
    }

    if (!isValidEmail(resetEmail)) {
      setResetFieldError("Enter a valid email address.");
      return false;
    }

    setResetFieldError("");
    return true;
  }, [resetEmail]);

  const handleLogin = async (event) => {
    event.preventDefault();
    clearAuthError();
    setPageError("");
    setFieldErrors({
      email: "",
      password: "",
    });

    if (!validateAccessForm()) {
      return;
    }

    if (!isDemoMode) {
      setPageError(
        "Email and password sign-in is not available in this environment.",
      );
      return;
    }

    try {
      const sessionPayload = await signInWithDemoCredentials({
        email: email.trim().toLowerCase(),
        password,
      });
      handleAuthenticatedRedirect(sessionPayload);
    } catch (error) {
      setPageError(error.message || "Sign-in failed");
    }
  };

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

  const handleEmailChange = (value) => {
    setEmail(value);
    setPageError("");
    if (fieldErrors.email) {
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        email: "",
      }));
    }
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    setPageError("");
    if (fieldErrors.password) {
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        password: "",
      }));
    }
  };

  const handleOpenResetView = () => {
    setActiveView("reset");
    setResetEmail(email);
    setResetFieldError("");
    setResetFeedback({ type: "", message: "" });
    setPageError("");
    clearAuthError();
  };

  const handleBackToLogin = () => {
    setActiveView("login");
    setResetFieldError("");
    setResetFeedback({ type: "", message: "" });
  };

  const handleResetEmailChange = (value) => {
    setResetEmail(value);
    setResetFieldError("");
    setResetFeedback({ type: "", message: "" });
  };

  const handleSubmitResetRequest = async (event) => {
    event.preventDefault();
    setResetFeedback({ type: "", message: "" });

    if (!validateResetEmail()) {
      return;
    }

    setIsResetLoading(true);

    try {
      const response = await requestPasswordReset(resetEmail);
      setResetFeedback({
        type: "success",
        message: response.message,
      });
    } catch (error) {
      setResetFeedback({
        type: "error",
        message:
          error.message ||
          "We could not process the request at this time. Please try again or contact the system administrator.",
      });
    } finally {
      setIsResetLoading(false);
    }
  };

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
    <div className="distync-access-page">
      <div className="distync-access-page__backdrop" aria-hidden="true" />
      <div className="distync-access-page__shell">
        <StaffAccessPanel
          activeView={activeView}
          authError=""
          email={email}
          fieldErrors={fieldErrors}
          googleButtonRef={googleButtonRef}
          isAuthLoading={isAuthLoading}
          isGoogleReady={isGoogleReady}
          isResetLoading={isResetLoading}
          onBackToLogin={handleBackToLogin}
          onDonationPortalAccess={handleDonorAccess}
          onEmailChange={handleEmailChange}
          onForgotPassword={handleOpenResetView}
          onPasswordChange={handlePasswordChange}
          onResetEmailChange={handleResetEmailChange}
          onResetSubmit={handleSubmitResetRequest}
          onSubmit={handleLogin}
          pageError={combinedError}
          password={password}
          passwordVisible={passwordVisible}
          resetEmail={resetEmail}
          resetFeedback={resetFeedback}
          resetFieldError={resetFieldError}
          setPasswordVisible={setPasswordVisible}
        />
      </div>
    </div>
  );
};

export default AccessPage;
