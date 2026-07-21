import React from "react";
import distyncLogo from "../../assets/distync-logo.png";
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
        <p className="distync-access-page__card-system">DISTYNC</p>
      </div>

      <div className="distync-access-page__auth-header">
        <h1 className="distync-access-page__auth-title">
          Disaster Relief Management System
        </h1>
        <p className="distync-access-page__auth-description">
          Secure Google access for authorized personnel of MSWDO, the Office of
          the Mayor, and Barangay Offices in Malvar, Batangas.
        </p>
      </div>

      {errorMessage ? (
        <section className="distync-access-page__alert" role="alert" aria-live="polite">
          <p className="distync-access-page__alert-title">Access Error</p>
          <p className="distync-access-page__alert-message">{errorMessage}</p>
        </section>
      ) : null}

      <section className="distync-access-page__support-panel">
        <p className="distync-access-page__support-text">
          Authorized staff accounts are validated after Google sign-in. Use your
          official DISTYNC-linked Google account to continue.
        </p>
        <p className="distync-access-page__support-text">
          For account creation or access changes, contact the system
          administrator.
        </p>
      </section>

      <section className="distync-access-page__google-access">
        <div
          ref={googleButtonRef}
          className="distync-access-page__google-button"
          aria-label="Google sign-in"
        />
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
