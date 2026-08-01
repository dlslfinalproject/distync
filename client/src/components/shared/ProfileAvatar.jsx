import React, { useEffect, useMemo, useState } from "react";

const baseStyles = {
  width: "132px",
  height: "132px",
  borderRadius: "999px",
  border: "4px solid #e7f0fa",
  background:
    "linear-gradient(180deg, rgba(239, 246, 253, 1) 0%, rgba(227, 238, 249, 1) 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const imageStyles = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const fallbackStyles = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "linear-gradient(180deg, rgba(234, 242, 251, 1) 0%, rgba(220, 233, 247, 1) 100%)",
  color: "#2f6499",
  fontSize: "30px",
  fontWeight: 800,
  textAlign: "center",
};

const buildInitials = (displayName = "") => {
  const initials = String(displayName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "DU";
};

const ProfileAvatar = ({
  src = "",
  alt = "Profile picture",
  displayName = "",
  style = {},
  imageStyle = {},
  fallbackStyle = {},
  onError,
}) => {
  const [hasLoadError, setHasLoadError] = useState(false);
  const initials = useMemo(() => buildInitials(displayName), [displayName]);

  useEffect(() => {
    setHasLoadError(false);
  }, [src]);

  return (
    <div style={{ ...baseStyles, ...style }}>
      {src && !hasLoadError ? (
        <img
          src={src}
          alt={alt}
          style={{ ...imageStyles, ...imageStyle }}
          onError={() => {
            setHasLoadError(true);
            onError?.();
          }}
        />
      ) : (
        <div style={{ ...fallbackStyles, ...fallbackStyle }}>{initials}</div>
      )}
    </div>
  );
};

export default ProfileAvatar;
