import React from "react";
import distyncLogo from "../../assets/distync-logo-cropped.png";
import "./accessPage.css";

const StaffAccessPanel = ({
  googleButtonRef,
  isAuthLoading,
  isGoogleReady,
  onDonationPortalAccess,
  pageError,
}) => {
  const errorMessage = pageError;

  return (
    <section className="distync-access-page__panel distync-access-page__auth-panel">
      <div className="distync-access-page__card-brand">
        <img
          src={distyncLogo}
          alt="DISTYNC official logo"
          className="distync-access-page__card-logo"
        />
        <div className="distync-access-page__brand-copy">
          <h1 className="distync-access-page__card-system">DISTYNC</h1>
          <p className="distync-access-page__card-subtitle">
            Disaster Relief Management
          </p>
        </div>
      </div>
      <p className="distync-access-page__tagline">
        Where Relief Stays in Sync and Service Stays Distinct
      </p>

      {errorMessage ? (
        <section className="distync-access-page__alert" role="alert" aria-live="polite">
          <p className="distync-access-page__alert-title">Access Error</p>
          <p className="distync-access-page__alert-message">{errorMessage}</p>
        </section>
      ) : null}

      <section className="distync-access-page__google-access">
        <div className="distync-access-page__welcome">
          <h2 className="distync-access-page__welcome-title">Welcome Back!</h2>
          <p className="distync-access-page__welcome-copy">
            Access your DISTYNC workspace securely.
          </p>
        </div>
        <div className="distync-access-page__sign-in-controls">
          <p className="distync-access-page__auth-description">
            Sign in using your authorized DISTYNC Google account:
          </p>
          <div
            ref={googleButtonRef}
            className="distync-access-page__google-button"
            aria-label="Google sign-in"
          />
        </div>
        {isAuthLoading ? (
          <p className="distync-access-page__support-text">
            Completing secure sign-in...
          </p>
        ) : null}
        {!isGoogleReady ? (
          <p className="distync-access-page__support-text">
            Google sign-in is unavailable in this environment.
          </p>
        ) : null}
      </section>

      <section className="distync-access-page__public-access">
        <p className="distync-access-page__public-access-label">Public Access</p>
        <button
          type="button"
          onClick={onDonationPortalAccess}
          className="distync-access-page__portal-link"
        >
          <span className="distync-access-page__portal-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" focusable="false">
              <path d="M24 4 42 12.5 24 21 6 12.5 24 4Z" />
              <path d="M5 16.5 22 24.5V44L5 35.5V16.5Z" />
              <path d="M26 24.5 43 16.5V35.5L26 44V24.5Z" />
              <path d="M31.5 22 39 18.5V25L31.5 28.5V22Z" fill="#ffffff" />
              <path d="M9.5 33 16 36.1V39.8L9.5 36.6V33Z" fill="#ffffff" />
              <path d="M9.8 12.5 24 5.8 38.2 12.5 32.5 15.2 18.3 8.5 9.8 12.5Z" fill="#ffffff" />
            </svg>
          </span>
          <span className="distync-access-page__portal-link-title">
            Public Donation Transparency Portal
          </span>
        </button>
      </section>
    </section>
  );
};

export default StaffAccessPanel;
