import React, { useEffect, useState } from "react";

export const BARANGAY_OFFLINE_MODE_TITLE = "Offline Mode Active";
export const BARANGAY_OFFLINE_MODE_MESSAGE =
  "You can continue supported offline actions. DISTYNC will save changes on this device and synchronize them when the internet connection returns.";

const noticeStyles = {
  backgroundColor: "#ffffff",
  border: "1px solid #d7e2ef",
  borderRadius: "18px",
  padding: "clamp(18px, 2vw, 24px)",
  boxShadow: "0 10px 24px rgba(76, 101, 132, 0.08)",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  display: "grid",
  gap: "8px",
  borderColor: "#cbdbea",
};

const BarangayOfflineModeNotice = ({ secondaryMessage = "" }) => {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <section aria-live="polite" aria-label={BARANGAY_OFFLINE_MODE_TITLE} role="status" style={noticeStyles}>
      <h2 style={{ margin: 0, color: "#17324d", fontSize: "17px" }}>
        {BARANGAY_OFFLINE_MODE_TITLE}
      </h2>
      <p style={{ margin: 0, color: "#60738a", fontSize: "14px", lineHeight: 1.6 }}>
        {BARANGAY_OFFLINE_MODE_MESSAGE}
      </p>
      {secondaryMessage ? (
        <p style={{ margin: "2px 0 0", color: "#60738a", fontSize: "14px", lineHeight: 1.6 }}>
          {secondaryMessage}
        </p>
      ) : null}
    </section>
  );
};

export default BarangayOfflineModeNotice;
