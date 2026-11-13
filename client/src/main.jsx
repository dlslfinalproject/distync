import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import AccessModeConfigurationScreen from "./components/shared/AccessModeConfigurationScreen";
import {
  AccessModeConfigurationError,
  getAccessMode,
} from "./utils/accessMode";
import { configureClientAccessMode } from "./config/clientEnv";

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
  configureClientAccessMode();
  getAccessMode();
  const [
    { AuthProvider },
    { initializeSyncService },
    { registerDistyncServiceWorker },
    { default: AppRoutes },
    { installAuthenticatedFetch },
    { prepareModeScopedBrowserState },
  ] = await Promise.all([
    import("./context/AuthContext"),
    import("./offline/syncService"),
    import("./pwa/registerServiceWorker"),
    import("./routes/AppRoutes"),
    import("./utils/apiClient"),
    import("./utils/browserStorageIsolation"),
  ]);

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
