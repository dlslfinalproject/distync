import React from "react";
import { MAYOR_OFFLINE_ACCESS_MESSAGE } from "../../features/offline/mayorOfflineAccess";

const noticeStyles = {
  backgroundColor: "#ffffff",
  border: "1px solid #d7e2ef",
  borderRadius: "18px",
  padding: "clamp(24px, 3vw, 36px)",
  boxShadow: "0 10px 24px rgba(76, 101, 132, 0.08)",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

const MayorOfflineAccessNotice = () => (
  <section
    aria-live="polite"
    aria-label="Online access required"
    role="status"
    style={noticeStyles}
  >
    <h2
      style={{
        margin: 0,
        color: "#17324d",
        fontSize: "18px",
        lineHeight: 1.35,
      }}
    >
      {MAYOR_OFFLINE_ACCESS_MESSAGE}
    </h2>
  </section>
);

export default MayorOfflineAccessNotice;
