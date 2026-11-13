import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const messageConfigs = [
  {
    key: "success",
    color: "#2f6c47",
  },
  {
    key: "info",
    color: "#24496e",
  },
  {
    key: "error",
    color: "#a14d58",
  },
];

const MasterlistStatusMessages = ({ successMessage, infoMessage, errorMessage }) => {
  const messages = {
    success: successMessage,
    info: infoMessage,
    error: errorMessage,
  };

  return (
    <>
      {messageConfigs.map((config) =>
        messages[config.key] ? (
          <section key={config.key} style={shellStyles.card}>
            <p style={{ margin: 0, color: config.color, fontWeight: 700 }}>
              {messages[config.key]}
            </p>
          </section>
        ) : null,
      )}
    </>
  );
};

export default MasterlistStatusMessages;
