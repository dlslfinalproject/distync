import React from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import BarangayLayout from "../components/layout/BarangayLayout";
import BarangayMasterlistPage from "../pages/barangay/BarangayMasterlistPage";
import StubVerificationPage from "../pages/barangay/StubVerificationPage";

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/barangay/masterlist" replace />} />
        <Route path="/barangay" element={<BarangayLayout />}>
          <Route path="masterlist" element={<BarangayMasterlistPage />} />
          <Route
            path="stub-verification"
            element={<StubVerificationPage />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/barangay/masterlist" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
