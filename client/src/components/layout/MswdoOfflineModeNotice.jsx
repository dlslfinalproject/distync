import React, { useEffect, useState } from "react";

export const MSWDO_OFFLINE_MODE_TITLE = "Offline Mode Active";
export const MSWDO_OFFLINE_MODE_MESSAGE =
  "You can view saved evacuee masterlist and analytics data while offline.";
export const MSWDO_OFFLINE_MODE_LIMITATION =
  "Other functions require an internet connection.";

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

const MswdoOfflineModeNotice = () => {
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
    <section
      aria-live="polite"
      aria-label={MSWDO_OFFLINE_MODE_TITLE}
      role="status"
      style={noticeStyles}
    >
      <h2 style={{ margin: 0, color: "#17324d", fontSize: "17px" }}>
        {MSWDO_OFFLINE_MODE_TITLE}
      </h2>
      <p style={{ margin: 0, color: "#60738a", fontSize: "14px", lineHeight: 1.6 }}>
        {MSWDO_OFFLINE_MODE_MESSAGE}
      </p>
      <p style={{ margin: "2px 0 0", color: "#60738a", fontSize: "14px", lineHeight: 1.6 }}>
        {MSWDO_OFFLINE_MODE_LIMITATION}
      </p>
    </section>
  );
};

export default MswdoOfflineModeNotice;
