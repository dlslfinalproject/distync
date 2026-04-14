import React from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";

const DonationInformationPage = () => {
  return (
    <>
      <PageHeader
        eyebrow="Donor Workspace"
        title="DONATION INFORMATION"
        description="Temporary donor-facing landing page for development and demo navigation."
      />

      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Donation Information</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          This is a temporary placeholder page for the Donor / NGO role while the
          donor-facing module is still being developed.
        </p>
      </section>
    </>
  );
};

export default DonationInformationPage;
