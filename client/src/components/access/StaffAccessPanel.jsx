import React from "react";
import "./accessPage.css";

const StaffAccessPanel = ({
  authError,
  email,
  fieldErrors,
  isAuthLoading,
  onDonationPortalAccess,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  pageError,
  password,
  passwordVisible,
  setPasswordVisible,
}) => {
  const errorMessage = pageError || authError;

  return (
    <section className="distync-access-page__panel distync-access-page__auth-panel">
      <div className="distync-access-page__auth-header">
        <div className="distync-access-page__mode-badge">Staff Access</div>
        <h1 className="distync-access-page__auth-title">Sign In to DISTYNC</h1>
        <p className="distync-access-page__auth-description">
          Enter your authorized account credentials to continue to the system
          dashboard.
        </p>
      </div>

      {errorMessage ? (
        <section className="distync-access-page__alert" role="alert" aria-live="polite">
          <p className="distync-access-page__alert-title">Access Error</p>
          <p className="distync-access-page__alert-message">{errorMessage}</p>
        </section>
      ) : null}

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

        <button
          type="submit"
          disabled={isAuthLoading}
          className="distync-access-page__submit-button"
        >
          {isAuthLoading ? "Signing In..." : "Login"}
        </button>

        <button
          type="button"
          disabled
          className="distync-access-page__secondary-link"
          title="Password recovery flow is not configured in this interface yet."
        >
          Contact System Administrator
        </button>
      </form>

      <section className="distync-access-page__public-access">
        <p className="distync-access-page__public-access-label">Public Access</p>
        <button
          type="button"
          onClick={onDonationPortalAccess}
          className="distync-access-page__portal-link"
        >
          <span className="distync-access-page__portal-link-title">
            Open Public Donation Portal
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
