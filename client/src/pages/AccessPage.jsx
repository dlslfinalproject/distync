import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ACCESS_MODES, getAccessMode } from "../utils/accessMode";
import {
  ROLE_CODES,
  getDefaultRouteForRole,
} from "../utils/roleSession";
import AccessBrandPanel from "../components/access/AccessBrandPanel";
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
  const [pageError, setPageError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    email: "",
    password: "",
  });
  const accessMode = getAccessMode();
  const {
    authError,
    clearAuthError,
    continueAsDonor,
    isAuthLoading,
    signInWithDemoCredentials,
  } = useAuth();

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
      <div className="distync-access-page__shell">
        <AccessBrandPanel />

        <div className="distync-access-page__auth-column">
          <StaffAccessPanel
            authError=""
            email={email}
            fieldErrors={fieldErrors}
            isAuthLoading={isAuthLoading}
            onDonationPortalAccess={handleDonorAccess}
            onEmailChange={handleEmailChange}
            onPasswordChange={handlePasswordChange}
            onSubmit={handleLogin}
            pageError={combinedError}
            password={password}
            passwordVisible={passwordVisible}
            setPasswordVisible={setPasswordVisible}
          />
        </div>
      </div>
    </div>
  );
};

export default AccessPage;
