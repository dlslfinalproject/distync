import React, { useEffect, useState } from "react";

const DistyncLogo = ({ src, alt, ...imageProps }) => {
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const retryFailedImage = () => setRetryKey((current) => current + 1);

    window.addEventListener("online", retryFailedImage);
    return () => window.removeEventListener("online", retryFailedImage);
  }, []);

  return <img key={retryKey} src={src} alt={alt} {...imageProps} />;
};

export default DistyncLogo;
