import React from "react";

const LoadingState = ({ message = "Loading...", style }) => (
  <p
    style={{
      margin: 0,
      color: "#60738a",
      fontSize: "14px",
      lineHeight: 1.6,
      ...style,
    }}
  >
    {message}
  </p>
);

export default LoadingState;
