import React from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import BarangayLayout from "../components/layout/BarangayLayout";
import RoleProtectedRoute from "./RoleProtectedRoute";
import AccessPage from "../pages/AccessPage";
import BarangayMasterlistPage from "../pages/barangay/BarangayMasterlistPage";
import DistributionTransactionPage from "../pages/barangay/DistributionTransactionPage";
import StubDistributionPage from "../pages/barangay/StubDistributionPage";
import VerifyStubPage from "../pages/VerifyStubPage";
import DonationManagementPage from "../pages/DonationManagementPage";
import InventoryItemsPage from "../pages/inventory/InventoryItemsPage";
import InventoryDistributionPage from "../pages/inventory/InventoryDistributionPage";
import InventoryTransactionsPage from "../pages/inventory/InventoryTransactionsPage";
import ReliefPackTemplatesPage from "../pages/inventory/ReliefPackTemplatesPage";
import DonationInformationPage from "../pages/donor/DonationInformationPage";
import AnalyticsDashboardPage from "../pages/mswdo/AnalyticsDashboardPage";
import ConsolidatedMasterlistPage from "../pages/mswdo/ConsolidatedMasterlistPage";
import DisasterEventsPage from "../pages/mswdo/DisasterEventsPage";
import PrintStubsPage from "../pages/mswdo/PrintStubsPage";
import StubDistributionPageMswdo from "../pages/mswdo/StubDistributionPage";
import RoleSwitcherPage from "../pages/RoleSwitcherPage";
import { useAuth } from "../context/AuthContext";
import { getAccessMode, getEntryRouteForMode } from "../utils/accessMode";
import {
  getDefaultRouteForRole,
} from "../utils/roleSession";

const DefaultAppRedirect = () => {
  const { accessMode, currentRole } = useAuth();
  const resolvedAccessMode = accessMode || getAccessMode();

  if (!currentRole) {
    return <Navigate to={getEntryRouteForMode(resolvedAccessMode)} replace />;
  }

  return <Navigate to={getDefaultRouteForRole(currentRole)} replace />;
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DefaultAppRedirect />} />
        <Route path="/access" element={<AccessPage />} />
        <Route path="/verify-stub" element={<VerifyStubPage />} />
        <Route path="/role-switcher" element={<RoleSwitcherPage />} />
        <Route
          path="/barangay"
          element={
            <RoleProtectedRoute>
              <BarangayLayout />
            </RoleProtectedRoute>
          }
        >
          <Route path="masterlist" element={<BarangayMasterlistPage />} />
          <Route
            path="distribution-transaction"
            element={<DistributionTransactionPage />}
          />
          <Route
            path="stub-distribution"
            element={<StubDistributionPage />}
          />
        </Route>
        <Route
          path="/mswdo"
          element={
            <RoleProtectedRoute>
              <BarangayLayout />
            </RoleProtectedRoute>
          }
        >
          <Route
            path="analytics"
            element={<AnalyticsDashboardPage />}
          />
          <Route
            path="analytics-dashboard"
            element={<AnalyticsDashboardPage />}
          />
          <Route
            path="consolidated-masterlist"
            element={<ConsolidatedMasterlistPage />}
          />
          <Route
            path="stub-distribution"
            element={<StubDistributionPageMswdo />}
          />
          <Route path="donations" element={<DonationManagementPage />} />
          <Route path="disaster-events" element={<DisasterEventsPage />} />
        </Route>
        <Route
          path="/mswdo/print/stubs"
          element={
            <RoleProtectedRoute>
              <PrintStubsPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <RoleProtectedRoute>
              <BarangayLayout />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<Navigate to="items" replace />} />
          <Route path="items" element={<InventoryItemsPage />} />
          <Route
            path="batches"
            element={<Navigate to="/inventory/items" replace />}
          />
          <Route
            path="transactions"
            element={<InventoryTransactionsPage />}
          />
          <Route
            path="suppliers"
            element={<Navigate to="/inventory/items" replace />}
          />
          <Route
            path="relief-pack-templates"
            element={<ReliefPackTemplatesPage />}
          />
          <Route
            path="distribution"
            element={<InventoryDistributionPage />}
          />
          <Route path="donations" element={<DonationManagementPage />} />
        </Route>
        <Route path="/donations" element={<DonationInformationPage />} />
        <Route path="/donor/information" element={<DonationInformationPage />} />
        <Route path="*" element={<DefaultAppRedirect />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
