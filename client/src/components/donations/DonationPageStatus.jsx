import React from "react";

const bannerStyles = {
  marginTop: "18px",
  padding: "14px 16px",
  borderRadius: "14px",
  fontSize: "14px",
  fontWeight: 600,
};

const DonationPageStatus = ({ successMessage, errorMessage }) => {
  return (
    <>
      {successMessage ? (
        <div
          style={{
            ...bannerStyles,
            backgroundColor: "#edfdf4",
            border: "1px solid #ccebd9",
            color: "#1f6b48",
          }}
        >
          {successMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div
          style={{
            ...bannerStyles,
            backgroundColor: "#fff3f1",
            border: "1px solid #f1d2cc",
            color: "#9d4d58",
          }}
        >
          {errorMessage}
        </div>
      ) : null}
    </>
  );
};

export default DonationPageStatus;
