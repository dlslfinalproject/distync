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
import DescriptiveAnalyticsPage from "../pages/dashboard/DescriptiveAnalyticsPage";
import DistributionTransactionPage from "../pages/barangay/DistributionTransactionPage";
import StubVerificationPage from "../pages/barangay/StubVerificationPage";
import InventoryBatchesPage from "../pages/inventory/InventoryBatchesPage";
import InventoryItemsPage from "../pages/inventory/InventoryItemsPage";
import InventoryTransactionsPage from "../pages/inventory/InventoryTransactionsPage";
import ReliefPackTemplatesPage from "../pages/inventory/ReliefPackTemplatesPage";
import DonationInformationPage from "../pages/donor/DonationInformationPage";
import AnalyticsDashboardPage from "../pages/mswdo/AnalyticsDashboardPage";
import ConsolidatedMasterlistPage from "../pages/mswdo/ConsolidatedMasterlistPage";
import DisasterEventsPage from "../pages/mswdo/DisasterEventsPage";
import RoleSwitcherPage from "../pages/RoleSwitcherPage";
import SuppliersPage from "../pages/inventory/SuppliersPage";
import { getAccessMode, getEntryRouteForMode } from "../utils/accessMode";
import {
  getCurrentRole,
  getDefaultRouteForRole,
} from "../utils/roleSession";

const DefaultAppRedirect = () => {
  const currentRole = getCurrentRole();
  const accessMode = getAccessMode();

  if (!currentRole) {
    return <Navigate to={getEntryRouteForMode(accessMode)} replace />;
  }

  return <Navigate to={getDefaultRouteForRole(currentRole)} replace />;
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DefaultAppRedirect />} />
        <Route path="/access" element={<AccessPage />} />
        <Route path="/role-switcher" element={<RoleSwitcherPage />} />
        <Route
          path="/barangay"
          element={
            <RoleProtectedRoute>
              <BarangayLayout />
            </RoleProtectedRoute>
          }
        >
          <Route
            path="descriptive-analytics"
            element={<DescriptiveAnalyticsPage />}
          />
          <Route path="masterlist" element={<BarangayMasterlistPage />} />
          <Route
            path="distribution-transaction"
            element={<DistributionTransactionPage />}
          />
          <Route
            path="stub-verification"
            element={<StubVerificationPage />}
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
          <Route path="disaster-events" element={<DisasterEventsPage />} />
        </Route>
        <Route
          path="/inventory"
          element={
            <RoleProtectedRoute>
              <BarangayLayout />
            </RoleProtectedRoute>
          }
        >
          <Route path="items" element={<InventoryItemsPage />} />
          <Route path="batches" element={<InventoryBatchesPage />} />
          <Route
            path="transactions"
            element={<InventoryTransactionsPage />}
          />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route
            path="relief-pack-templates"
            element={<ReliefPackTemplatesPage />}
          />
        </Route>
        <Route
          path="/donations"
          element={
            <RoleProtectedRoute>
              <BarangayLayout />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<DonationInformationPage />} />
        </Route>
        <Route
          path="/donor"
          element={
            <RoleProtectedRoute>
              <BarangayLayout />
            </RoleProtectedRoute>
          }
        >
          <Route path="information" element={<DonationInformationPage />} />
        </Route>
        <Route path="*" element={<DefaultAppRedirect />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
