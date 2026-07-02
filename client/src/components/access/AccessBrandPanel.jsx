import React from "react";
import distyncLogo from "../../assets/distync-logo.png";
import "./accessPage.css";

const AccessBrandPanel = () => {
  return (
    <section className="distync-access-page__panel distync-access-page__brand-panel">
      <div className="distync-access-page__brand-header">
        <img
          src={distyncLogo}
          alt="DISTYNC official logo"
          className="distync-access-page__brand-logo"
        />
        <div className="distync-access-page__eyebrow">
          <span className="distync-access-page__eyebrow-dot" aria-hidden="true" />
          Secure Staff Access
        </div>
      </div>

      <div className="distync-access-page__section">
        <h1 className="distync-access-page__title">
          Disaster Relief Management System
        </h1>
        <p className="distync-access-page__subtitle">
          Municipal Social Welfare and Development Office, Malvar, Batangas
        </p>
        <p className="distync-access-page__brand-copy distync-access-page__brand-copy--lead">
          Supports disaster relief coordination, evacuee monitoring, inventory
          tracking, and distribution operations for authorized LGU personnel.
        </p>
      </div>

      <div className="distync-access-page__section">
        <h2 className="distync-access-page__section-title">Authorized Offices</h2>
        <p className="distync-access-page__brand-copy">
          Municipal Social Welfare and Development Office
        </p>
        <p className="distync-access-page__brand-copy">Office of the Mayor</p>
        <p className="distync-access-page__brand-copy">Barangay Officials</p>
      </div>

      <div className="distync-access-page__section">
        <h2 className="distync-access-page__section-title">Access Notice</h2>
        <p className="distync-access-page__brand-copy">
          Sign in using an active staff account issued by the assigned system
          administrator.
        </p>
      </div>

      <div className="distync-access-page__brand-footer">
        Internal Government Use Only
      </div>
    </section>
  );
};

export default AccessBrandPanel;
