import React, { useEffect } from "react";

const toastStyles = {
  container: {
    position: "fixed",
    top: "24px",
    right: "24px",
    width: "min(360px, calc(100vw - 32px))",
    zIndex: 1500,
  },
  toast: {
    borderRadius: "16px",
    padding: "14px 16px",
    boxShadow: "0 18px 36px rgba(23, 50, 77, 0.18)",
    border: "1px solid transparent",
    display: "grid",
    gap: "8px",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  title: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 800,
  },
  message: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  closeButton: {
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    fontSize: "18px",
    lineHeight: 1,
    padding: 0,
    color: "inherit",
  },
};

const typeStyles = {
  success: {
    backgroundColor: "#edf8f1",
    borderColor: "#cfe8d7",
    color: "#2f6c47",
    title: "Success",
  },
  error: {
    backgroundColor: "#fff3f1",
    borderColor: "#f1d2cc",
    color: "#9d4d58",
    title: "Error",
  },
  warning: {
    backgroundColor: "#fff8e6",
    borderColor: "#f2dfad",
    color: "#8a5d22",
    title: "Warning",
  },
  loading: {
    backgroundColor: "#eef6ff",
    borderColor: "#d1e3f8",
    color: "#2a4c6f",
    title: "Working",
  },
  info: {
    backgroundColor: "#eef6ff",
    borderColor: "#d1e3f8",
    color: "#2a4c6f",
    title: "Notice",
  },
};

const FeedbackToast = ({
  message,
  type = "info",
  title,
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    if (!message || !onClose || type === "loading") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      onClose();
    }, duration);

    return () => window.clearTimeout(timeoutId);
  }, [duration, message, onClose, type]);

  if (!message) {
    return null;
  }

  const selectedTypeStyles = typeStyles[type] || typeStyles.info;

  return (
    <div style={toastStyles.container}>
      <div
        style={{
          ...toastStyles.toast,
          backgroundColor: selectedTypeStyles.backgroundColor,
          borderColor: selectedTypeStyles.borderColor,
          color: selectedTypeStyles.color,
        }}
      >
        <div style={toastStyles.titleRow}>
          <p style={toastStyles.title}>{title || selectedTypeStyles.title}</p>
          <button
            type="button"
            onClick={onClose}
            style={toastStyles.closeButton}
            aria-label="Close message"
          >
            ×
          </button>
        </div>
        <p style={toastStyles.message}>{message}</p>
      </div>
    </div>
  );
};

export default FeedbackToast;
