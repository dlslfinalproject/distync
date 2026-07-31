import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import AccessModeConfigurationScreen from "./components/shared/AccessModeConfigurationScreen";
import { AuthProvider } from "./context/AuthContext";
import { initializeSyncService } from "./offline/syncService";
import { registerDistyncServiceWorker } from "./pwa/registerServiceWorker";
import AppRoutes from "./routes/AppRoutes";
import {
  AccessModeConfigurationError,
  getAccessMode,
} from "./utils/accessMode";
import { installAuthenticatedFetch } from "./utils/apiClient";

const root = ReactDOM.createRoot(document.getElementById("root"));

const renderConfigurationErrorScreen = () => {
  console.error(
    "DISTYNC configuration error: VITE_ACCESS_MODE must be set to DEVELOPMENT or DEMO.",
  );

  root.render(
    <React.StrictMode>
      <AccessModeConfigurationScreen />
    </React.StrictMode>,
  );
};

try {
  getAccessMode();
  installAuthenticatedFetch();
  initializeSyncService();
  registerDistyncServiceWorker();

  root.render(
    <React.StrictMode>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </React.StrictMode>,
  );
} catch (error) {
  if (error instanceof AccessModeConfigurationError) {
    renderConfigurationErrorScreen();
  } else {
    throw error;
  }
}
