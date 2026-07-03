import React from "react";
import distyncLogo from "../../assets/distync-logo.png";
import "./accessPage.css";

const StaffAccessPanel = ({
  activeView,
  authError,
  email,
  fieldErrors,
  googleButtonRef,
  isAuthLoading,
  isGoogleReady,
  isResetLoading,
  onBackToLogin,
  onDonationPortalAccess,
  onEmailChange,
  onForgotPassword,
  onPasswordChange,
  onResetEmailChange,
  onResetSubmit,
  onSubmit,
  pageError,
  password,
  passwordVisible,
  resetEmail,
  resetFeedback,
  resetFieldError,
  setPasswordVisible,
}) => {
  const errorMessage = pageError || authError;
  const isResetView = activeView === "reset";

  return (
    <section className="distync-access-page__panel distync-access-page__auth-panel">
      <div className="distync-access-page__card-brand">
        <img
          src={distyncLogo}
          alt="DISTYNC official logo"
          className="distync-access-page__card-logo"
        />
        <p className="distync-access-page__card-system">DISTYNC</p>
      </div>

      <div className="distync-access-page__auth-header">
        <h1 className="distync-access-page__auth-title">
          {isResetView ? "Reset Password" : "Disaster Relief Management System"}
        </h1>
        <p className="distync-access-page__auth-description">
          {isResetView
            ? "Enter your registered staff email address. If the account exists, reset instructions will be sent."
            : "Secure access for authorized personnel of MSWDO, the Office of the Mayor, and Barangay Offices in Malvar, Batangas."}
        </p>
      </div>

      {!isResetView && errorMessage ? (
        <section className="distync-access-page__alert" role="alert" aria-live="polite">
          <p className="distync-access-page__alert-title">Access Error</p>
          <p className="distync-access-page__alert-message">{errorMessage}</p>
        </section>
      ) : null}

      {isResetView ? (
        <>
          {resetFeedback.type ? (
            <section
              className={`distync-access-page__alert ${
                resetFeedback.type === "success"
                  ? "distync-access-page__alert--success"
                  : ""
              }`}
              role="status"
              aria-live="polite"
            >
              <p className="distync-access-page__alert-title">
                {resetFeedback.type === "success" ? "Request Sent" : "Reset Error"}
              </p>
              <p className="distync-access-page__alert-message">
                {resetFeedback.message}
              </p>
            </section>
          ) : null}

          <form className="distync-access-page__form" onSubmit={onResetSubmit} noValidate>
            <div className="distync-access-page__field-group">
              <label
                className="distync-access-page__label"
                htmlFor="distync-reset-email"
              >
                Email Address
              </label>
              <div className="distync-access-page__input-shell">
                <input
                  id="distync-reset-email"
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(event) => onResetEmailChange(event.target.value)}
                  placeholder="name@agency.gov.ph"
                  className={`distync-access-page__input${
                    resetFieldError ? " distync-access-page__input--error" : ""
                  }`}
                  disabled={isResetLoading}
                  aria-invalid={resetFieldError ? "true" : "false"}
                  aria-describedby={
                    resetFieldError ? "distync-reset-email-error" : undefined
                  }
                />
              </div>
              {resetFieldError ? (
                <p
                  id="distync-reset-email-error"
                  className="distync-access-page__field-error"
                >
                  {resetFieldError}
                </p>
              ) : null}
            </div>

            <div className="distync-access-page__form-actions">
              <button
                type="submit"
                disabled={isResetLoading}
                className="distync-access-page__submit-button"
              >
                {isResetLoading ? "Sending Request..." : "Send Reset Instructions"}
              </button>

              <button
                type="button"
                onClick={onBackToLogin}
                className="distync-access-page__secondary-link"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <form className="distync-access-page__form" onSubmit={onSubmit} noValidate>
            <div className="distync-access-page__field-group">
              <label className="distync-access-page__label" htmlFor="distync-access-email">
                Email Address
              </label>
              <div className="distync-access-page__input-shell">
                <input
                  id="distync-access-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                  placeholder="name@agency.gov.ph"
                  className={`distync-access-page__input${
                    fieldErrors.email ? " distync-access-page__input--error" : ""
                  }`}
                  disabled={isAuthLoading}
                  aria-invalid={fieldErrors.email ? "true" : "false"}
                  aria-describedby={fieldErrors.email ? "distync-access-email-error" : undefined}
                />
              </div>
              {fieldErrors.email ? (
                <p id="distync-access-email-error" className="distync-access-page__field-error">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div className="distync-access-page__field-group">
              <label className="distync-access-page__label" htmlFor="distync-access-password">
                Password
              </label>
              <div className="distync-access-page__input-shell">
                <input
                  id="distync-access-password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  placeholder="Enter your password"
                  className={`distync-access-page__input distync-access-page__input--with-toggle${
                    fieldErrors.password ? " distync-access-page__input--error" : ""
                  }`}
                  disabled={isAuthLoading}
                  aria-invalid={fieldErrors.password ? "true" : "false"}
                  aria-describedby={
                    fieldErrors.password ? "distync-access-password-error" : undefined
                  }
                />
                <button
                  type="button"
                  className="distync-access-page__toggle-button"
                  onClick={() => setPasswordVisible((currentValue) => !currentValue)}
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                >
                  {passwordVisible ? "Hide" : "Show"}
                </button>
              </div>
              {fieldErrors.password ? (
                <p
                  id="distync-access-password-error"
                  className="distync-access-page__field-error"
                >
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            <div className="distync-access-page__form-actions">
              <button
                type="submit"
                disabled={isAuthLoading}
                className="distync-access-page__submit-button"
              >
                {isAuthLoading ? "Signing In..." : "Login"}
              </button>

              <button
                type="button"
                onClick={onForgotPassword}
                className="distync-access-page__secondary-link"
              >
                Forgot password?
              </button>

              <button
                type="button"
                disabled
                className="distync-access-page__secondary-link distync-access-page__secondary-link--muted"
              >
                For account creation, contact the system administrator.
              </button>
            </div>
          </form>

          <section className="distync-access-page__google-access">
            <div className="distync-access-page__separator">
              <span>or continue with</span>
            </div>
            <div
              ref={googleButtonRef}
              className="distync-access-page__google-button"
              aria-label="Google sign-in"
            />
            {!isGoogleReady ? (
              <p className="distync-access-page__support-text">
                Google sign-in is unavailable in this environment.
              </p>
            ) : null}
          </section>
        </>
      )}

      <section className="distync-access-page__public-access">
        <p className="distync-access-page__public-access-label">Public Access</p>
        <button
          type="button"
          onClick={onDonationPortalAccess}
          className="distync-access-page__portal-link"
        >
          <span className="distync-access-page__portal-link-title">
            Public Donation Transparency Portal
          </span>
          <span className="distync-access-page__portal-link-copy">
            View donation needs and public transparency information.
          </span>
        </button>
      </section>
    </section>
  );
};

export default StaffAccessPanel;
