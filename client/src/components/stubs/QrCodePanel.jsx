import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildStubQrUrl } from "../../utils/stubQr";

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  image: {
    width: "100%",
    maxWidth: "220px",
    aspectRatio: "1 / 1",
    objectFit: "contain",
    borderRadius: "14px",
    border: "1px solid #d6e2ec",
    backgroundColor: "#ffffff",
    padding: "10px",
    boxSizing: "border-box",
  },
  placeholder: {
    width: "100%",
    maxWidth: "220px",
    aspectRatio: "1 / 1",
    borderRadius: "14px",
    border: "1px dashed #cad8e6",
    backgroundColor: "#f3f8fc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "14px",
    color: "#698099",
    fontSize: "13px",
    fontWeight: 600,
    boxSizing: "border-box",
  },
  value: {
    margin: 0,
    color: "#48627d",
    fontSize: "12px",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
};

const QrCodePanel = ({
  value,
  emptyLabel = "No QR available",
  containerStyle = {},
  imageStyle = {},
  valueStyle = {},
  showValue = true,
}) => {
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState("");

  useEffect(() => {
    let isMounted = true;

    const generateQrCode = async () => {
      if (!value) {
        setQrCodeImageUrl("");
        return;
      }

      try {
        const qrCodeValue = String(value || "").trim();
        const qrPayloadUrl = buildStubQrUrl(qrCodeValue);

        const imageUrl = await QRCode.toDataURL(qrPayloadUrl, {
          width: 220,
          margin: 1,
          color: {
            dark: "#17324d",
            light: "#ffffff",
          },
        });

        if (isMounted) {
          setQrCodeImageUrl(imageUrl);
        }
      } catch (_error) {
        if (isMounted) {
          setQrCodeImageUrl("");
        }
      }
    };

    generateQrCode();

    return () => {
      isMounted = false;
    };
  }, [value]);

  if (!value) {
    return <div style={{ ...styles.placeholder, ...imageStyle }}>{emptyLabel}</div>;
  }

  return (
    <div style={{ ...styles.container, ...containerStyle }}>
      {qrCodeImageUrl ? (
        <img
          src={qrCodeImageUrl}
          alt="Stub QR code"
          style={{ ...styles.image, ...imageStyle }}
        />
      ) : (
        <div style={{ ...styles.placeholder, ...imageStyle }}>
          Unable to render QR code
        </div>
      )}
      {showValue ? (
        <p style={{ ...styles.value, ...valueStyle }}>{value}</p>
      ) : null}
    </div>
  );
};

export default QrCodePanel;
