import React from "react";
import FormModalShell from "../shared/FormModalShell";
import { pageHeaderStyles } from "../layout/PageHeader";
import { getQrScanBlockingErrorConfig } from "../../features/stubs/stubQrScanErrors";

const modalStyles = {
  centeredContent: {
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    gap: 0,
  },
  centeredTitle: {
    margin: 0,
    color: "#1f2937",
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: 1.3,
  },
  centeredMessage: {
    margin: "12px auto 0",
    color: "#6b7280",
    fontSize: "14px",
    fontWeight: 400,
    lineHeight: 1.6,
    maxWidth: "320px",
  },
  centeredDetailBlock: {
    display: "grid",
    justifyItems: "center",
    gap: "6px",
    marginTop: "12px",
  },
  centeredFooter: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "14px",
    marginTop: "24px",
    flexWrap: "wrap",
    width: "100%",
  },
  detailGrid: {
    display: "grid",
    gap: "12px",
  },
  detailGroup: {
    border: "1px solid #dce6f1",
    borderRadius: "18px",
    backgroundColor: "#f8fbfe",
    overflow: "hidden",
  },
  detailCard: {
    display: "grid",
    gap: "6px",
    padding: "16px 18px",
    borderRadius: "16px",
    border: "1px solid #dce6f1",
    backgroundColor: "#f8fbfe",
  },
  detailRow: {
    display: "grid",
    gap: "6px",
    padding: "14px 18px",
  },
  detailRowDivider: {
    borderTop: "1px solid #dce6f1",
  },
  detailRowCompactTop: {
    paddingTop: "16px",
  },
  detailLabel: {
    margin: 0,
    color: "#60758c",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  detailValue: {
    margin: 0,
    color: "#17324d",
    fontSize: "15px",
    fontWeight: 400,
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  centeredSecondaryButton: {
    ...pageHeaderStyles.secondaryButton,
    minHeight: "44px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 700,
    minWidth: 0,
    width: "100%",
    padding: "0 18px",
    flex: "1 1 0",
    boxShadow: "none",
  },
  centeredPrimaryButton: {
    ...pageHeaderStyles.primaryButton,
    minHeight: "44px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 700,
    minWidth: 0,
    width: "100%",
    padding: "0 18px",
    flex: "1 1 0",
    boxShadow: "0 8px 18px rgba(58, 97, 141, 0.16)",
  },
};

const StubQrScanErrorModal = ({
  isOpen,
  error,
  onTryAgain,
  onCloseScanner,
}) => {
  const modalContent = getQrScanBlockingErrorConfig(error);
  const description = modalContent.hideDescription ? "" : modalContent.message;
  const useDetailCards = modalContent.detailLayout === "cards";
  const isCenteredAlert = modalContent.layout === "centeredAlert";
  const isNarrowViewport =
    typeof window !== "undefined" ? window.innerWidth <= 420 : false;
  const isCompactViewport =
    typeof window !== "undefined" ? window.innerWidth <= 600 : false;
  const centeredMessageStyle = {
    ...modalStyles.centeredMessage,
    ...(modalContent.messageStyle || {}),
    ...(modalContent.messageStyle?.whiteSpace === "nowrap" && isCompactViewport
      ? { whiteSpace: "normal" }
      : null),
  };
  const actionButtons = (
    <>
      <button
        type="button"
        onClick={onCloseScanner}
        style={
          isCenteredAlert
            ? {
                ...modalStyles.centeredSecondaryButton,
                ...(isNarrowViewport
                  ? { flex: "1 1 100%", maxWidth: "100%" }
                  : null),
              }
            : pageHeaderStyles.secondaryButton
        }
      >
        Close Scanner
      </button>
      <button
        type="button"
        onClick={onTryAgain}
        style={
          isCenteredAlert
            ? {
                ...modalStyles.centeredPrimaryButton,
                ...(isNarrowViewport
                  ? { flex: "1 1 100%", maxWidth: "100%" }
                  : null),
              }
            : pageHeaderStyles.primaryButton
        }
      >
        Try Again
      </button>
    </>
  );

  return (
    <FormModalShell
      isOpen={isOpen}
      title={isCenteredAlert ? "" : modalContent.title}
      description={isCenteredAlert ? "" : description}
      maxWidth={
        isCenteredAlert
          ? modalContent.maxWidth || "420px"
          : "520px"
      }
      zIndex={1700}
      overlayStyle={{
        backgroundColor: "rgba(15, 23, 42, 0.64)",
      }}
      contentStyle={
        isCenteredAlert
          ? {
              padding: "28px 32px 26px",
            }
          : undefined
      }
      onClose={onTryAgain}
      showCloseButton={!isCenteredAlert}
      closeOnBackdrop={false}
      footer={isCenteredAlert ? null : actionButtons}
    >
      {isCenteredAlert ? (
        <div style={modalStyles.centeredContent}>
          <h3 style={modalStyles.centeredTitle}>{modalContent.title}</h3>
          {description ? (
            <p style={centeredMessageStyle}>{description}</p>
          ) : null}
          {modalContent.detailRows.length > 0 ? (
            <div style={modalStyles.centeredDetailBlock}>
              {modalContent.detailRows.map((detailRow) => (
                <React.Fragment
                  key={`${detailRow.label}-${detailRow.value}`}
                >
                  <p style={modalStyles.detailLabel}>{detailRow.label}</p>
                  <p style={modalStyles.detailValue}>{detailRow.value}</p>
                </React.Fragment>
              ))}
            </div>
          ) : null}
          <div
            style={{
              ...modalStyles.centeredFooter,
              ...(isNarrowViewport ? { flexDirection: "column" } : null),
            }}
          >
            {actionButtons}
          </div>
        </div>
      ) : modalContent.detailRows.length > 0 ? (
        useDetailCards ? (
          <div style={modalStyles.detailGrid}>
            {modalContent.detailRows.map((detailRow) => (
              <div
                key={`${detailRow.label}-${detailRow.value}`}
                style={modalStyles.detailCard}
              >
                <p style={modalStyles.detailLabel}>{detailRow.label}</p>
                <p style={modalStyles.detailValue}>{detailRow.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div style={modalStyles.detailGroup}>
            {modalContent.detailRows.map((detailRow, index) => (
              <div
                key={`${detailRow.label}-${detailRow.value}`}
                style={{
                  ...modalStyles.detailRow,
                  ...(index > 0 ? modalStyles.detailRowDivider : null),
                  ...(index === 0 ? modalStyles.detailRowCompactTop : null),
                }}
              >
                <p style={modalStyles.detailLabel}>{detailRow.label}</p>
                <p style={modalStyles.detailValue}>{detailRow.value}</p>
              </div>
            ))}
          </div>
        )
      ) : null}
    </FormModalShell>
  );
};

export default StubQrScanErrorModal;
