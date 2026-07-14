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
import InventoryBatchesPage from "../pages/inventory/InventoryBatchesPage";
import InventoryItemsPage from "../pages/inventory/InventoryItemsPage";
import InventoryDistributionPage from "../pages/inventory/InventoryDistributionPage";
import MayorNotificationsPage from "../pages/inventory/MayorNotificationsPage";
import SyncManagementPage from "../pages/SyncManagementPage";
import InventoryTransactionsPage from "../pages/inventory/InventoryTransactionsPage";
import ReliefPackTemplatesPage from "../pages/inventory/ReliefPackTemplatesPage";
import SuppliersPage from "../pages/inventory/SuppliersPage";
import DonationInformationPage from "../pages/donor/DonationInformationPage";
import DistributionHistoryPage from "../pages/DistributionHistoryPage";
import SystemLogReviewPage from "../pages/SystemLogReviewPage";
import AnalyticsDashboardPage from "../pages/mswdo/AnalyticsDashboardPage";
import AnomalyTrackingPage from "../pages/mswdo/AnomalyTrackingPage";
import ConsolidatedMasterlistPage from "../pages/mswdo/ConsolidatedMasterlistPage";
import DisasterEventReportsPage from "../pages/mswdo/DisasterEventReportsPage";
import DisasterEventsPage from "../pages/mswdo/DisasterEventsPage";
import PrintStubsPage from "../pages/mswdo/PrintStubsPage";
import StubDistributionPageMswdo from "../pages/mswdo/StubDistributionPage";
import StubClaimHistoryPage from "../pages/mswdo/StubClaimHistoryPage";
import RoleSwitcherPage from "../pages/RoleSwitcherPage";
import RoleSettingsPage from "../pages/settings/RoleSettingsPage";
import { useAuth } from "../context/AuthContext";
import { ACCESS_MODES, getAccessMode, getEntryRouteForMode } from "../utils/accessMode";
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
  const resolvedAccessMode = getAccessMode();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DefaultAppRedirect />} />
        <Route path="/access" element={<AccessPage />} />
        <Route path="/verify-stub" element={<VerifyStubPage />} />
        <Route
          path="/role-switcher"
          element={
            resolvedAccessMode === ACCESS_MODES.DEVELOPMENT ? (
              <RoleSwitcherPage />
            ) : (
              <Navigate to={getEntryRouteForMode(resolvedAccessMode)} replace />
            )
          }
        />
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
            path="distribution-history"
            element={<DistributionHistoryPage />}
          />
          <Route
            path="stub-distribution"
            element={<StubDistributionPage />}
          />
          <Route path="notifications" element={<MayorNotificationsPage />} />
          <Route path="sync" element={<SyncManagementPage />} />
          <Route path="settings" element={<RoleSettingsPage />} />
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
          <Route
            path="distribution-history"
            element={<DistributionHistoryPage />}
          />
        <Route
          path="stub-claim-history"
          element={<StubClaimHistoryPage />}
        />
        <Route path="disaster-events" element={<DisasterEventsPage />} />
        <Route
          path="disaster-reports"
          element={<DisasterEventReportsPage />}
          />
          <Route path="anomalies" element={<AnomalyTrackingPage />} />
          <Route path="notifications" element={<MayorNotificationsPage />} />
          <Route path="sync" element={<SyncManagementPage />} />
          <Route path="settings" element={<RoleSettingsPage />} />
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
          path="/barangay/print/stubs"
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
          <Route path="batches" element={<InventoryBatchesPage />} />
          <Route
            path="transactions"
            element={<InventoryTransactionsPage />}
          />
          <Route path="notifications" element={<MayorNotificationsPage />} />
          <Route path="sync" element={<SyncManagementPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route
            path="relief-pack-templates"
            element={<ReliefPackTemplatesPage />}
          />
          <Route
            path="distribution"
            element={<InventoryDistributionPage />}
          />
          <Route
            path="distribution-history"
            element={<DistributionHistoryPage />}
          />
          <Route path="system-logs" element={<SystemLogReviewPage />} />
          <Route path="donations" element={<DonationManagementPage />} />
          <Route path="settings" element={<RoleSettingsPage />} />
        </Route>
        <Route path="/donations" element={<DonationInformationPage />} />
        <Route path="/donor/information" element={<DonationInformationPage />} />
        <Route path="*" element={<DefaultAppRedirect />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
