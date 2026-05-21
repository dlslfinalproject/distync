import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import { initializeSyncService } from "./offline/syncService";
import { registerDistyncServiceWorker } from "./pwa/registerServiceWorker";
import AppRoutes from "./routes/AppRoutes";
import { installAuthenticatedFetch } from "./utils/apiClient";

installAuthenticatedFetch();
initializeSyncService();
registerDistyncServiceWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </React.StrictMode>,
);
