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
import { prepareModeScopedBrowserState } from "./utils/browserStorageIsolation";

const root = ReactDOM.createRoot(document.getElementById("root"));

const renderConfigurationErrorScreen = () => {
  console.error(
    "DISTYNC frontend configuration error: VITE_ACCESS_MODE must be set exactly to DEVELOPMENT or DEMO.",
  );

  root.render(
    <React.StrictMode>
      <AccessModeConfigurationScreen />
    </React.StrictMode>,
  );
};

const bootstrapApplication = async () => {
  getAccessMode();
  await prepareModeScopedBrowserState();
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
};

bootstrapApplication().catch((error) => {
  if (error instanceof AccessModeConfigurationError) {
    renderConfigurationErrorScreen();
    return;
  }

  throw error;
});
