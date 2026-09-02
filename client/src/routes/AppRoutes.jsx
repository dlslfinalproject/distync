import React, { useMemo } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import BarangayLayout from "../components/layout/BarangayLayout";
import RoleProtectedRoute from "./RoleProtectedRoute";
import AccessPage from "../pages/AccessPage";
import BarangayMasterlistPage from "../pages/barangay/BarangayMasterlistPage";
import BarangayAnomalyTrackingPage from "../pages/barangay/BarangayAnomalyTrackingPage";
import DistributionTransactionPage from "../pages/barangay/DistributionTransactionPage";
import StubDistributionPage from "../pages/barangay/StubDistributionPage";
import VerifyStubPage from "../pages/VerifyStubPage";
import InventoryBatchesPage from "../pages/inventory/InventoryBatchesPage";
import InventoryItemsPage from "../pages/inventory/InventoryItemsPage";
import MayorAnomalyTrackingPage from "../pages/inventory/MayorAnomalyTrackingPage";
import InventoryDistributionPage from "../pages/inventory/InventoryDistributionPage";
import InventoryForecastsPage from "../pages/inventory/InventoryForecastsPage";
import NotificationCenterPage from "../pages/inventory/NotificationCenterPage";
import SyncManagementPage from "../pages/SyncManagementPage";
import InventoryTransactionsPage from "../pages/inventory/InventoryTransactionsPage";
import ReliefPackTemplatesPage from "../pages/inventory/ReliefPackTemplatesPage";
import DonationInformationPage from "../pages/donor/DonationInformationPage";
import DonationManagementPage from "../pages/DonationManagementPage";
import DistributionHistoryPage from "../pages/DistributionHistoryPage";
import SystemLogReviewPage from "../pages/SystemLogReviewPage";
import AnalyticsDashboardPage from "../pages/mswdo/AnalyticsDashboardPage";
import AnomalyTrackingPage from "../pages/mswdo/AnomalyTrackingPage";
import ConsolidatedMasterlistPage from "../pages/mswdo/ConsolidatedMasterlistPage";
import DisasterEventReportsPage from "../pages/mswdo/DisasterEventReportsPage";
import DisasterEventsPage from "../pages/mswdo/DisasterEventsPage";
import PrintStubsPage from "../pages/mswdo/PrintStubsPage";
import StubDistributionPageMswdo from "../pages/mswdo/StubDistributionPage";
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
  const router = useMemo(
    () =>
      createBrowserRouter([
        { path: "/", element: <DefaultAppRedirect /> },
        { path: "/access", element: <AccessPage /> },
        { path: "/verify-stub", element: <VerifyStubPage /> },
        {
          path: "/role-switcher",
          element:
            resolvedAccessMode === ACCESS_MODES.DEVELOPMENT ? (
              <RoleSwitcherPage />
            ) : (
              <Navigate to={getEntryRouteForMode(resolvedAccessMode)} replace />
            ),
        },
        {
          path: "/barangay",
          element: (
            <RoleProtectedRoute>
              <BarangayLayout />
            </RoleProtectedRoute>
          ),
          children: [
            { path: "masterlist", element: <BarangayMasterlistPage /> },
            {
              path: "distribution-transaction",
              element: <DistributionTransactionPage />,
            },
            {
              path: "distribution-history",
              element: <DistributionHistoryPage />,
            },
            { path: "anomalies", element: <BarangayAnomalyTrackingPage /> },
            { path: "stub-distribution", element: <StubDistributionPage /> },
            { path: "notifications", element: <NotificationCenterPage /> },
            { path: "sync", element: <SyncManagementPage /> },
            { path: "settings", element: <RoleSettingsPage /> },
          ],
        },
        {
          path: "/mswdo",
          element: (
            <RoleProtectedRoute>
              <BarangayLayout />
            </RoleProtectedRoute>
          ),
          children: [
            { path: "analytics", element: <AnalyticsDashboardPage /> },
            {
              path: "analytics-dashboard",
              element: <AnalyticsDashboardPage />,
            },
            {
              path: "consolidated-masterlist",
              element: <ConsolidatedMasterlistPage />,
            },
            {
              path: "stub-distribution",
              element: <StubDistributionPageMswdo />,
            },
            {
              path: "distribution-history",
              element: <DistributionHistoryPage />,
            },
            { path: "disaster-events", element: <DisasterEventsPage /> },
            {
              path: "disaster-reports",
              element: <DisasterEventReportsPage />,
            },
            { path: "anomalies", element: <AnomalyTrackingPage /> },
            { path: "notifications", element: <NotificationCenterPage /> },
            { path: "sync", element: <SyncManagementPage /> },
            { path: "settings", element: <RoleSettingsPage /> },
          ],
        },
        {
          path: "/mswdo/print/stubs",
          element: (
            <RoleProtectedRoute>
              <PrintStubsPage />
            </RoleProtectedRoute>
          ),
        },
        {
          path: "/barangay/print/stubs",
          element: (
            <RoleProtectedRoute>
              <PrintStubsPage />
            </RoleProtectedRoute>
          ),
        },
        {
          path: "/inventory",
          element: (
            <RoleProtectedRoute>
              <BarangayLayout />
            </RoleProtectedRoute>
          ),
          children: [
            { index: true, element: <Navigate to="items" replace /> },
            { path: "items", element: <InventoryItemsPage /> },
            { path: "batches", element: <InventoryBatchesPage /> },
            {
              path: "transactions",
              element: <InventoryTransactionsPage />,
            },
            { path: "notifications", element: <NotificationCenterPage /> },
            { path: "sync", element: <SyncManagementPage /> },
            { path: "anomalies", element: <MayorAnomalyTrackingPage /> },
            {
              path: "relief-pack-templates",
              element: <ReliefPackTemplatesPage />,
            },
            { path: "distribution", element: <InventoryDistributionPage /> },
            { path: "forecasts", element: <InventoryForecastsPage /> },
            { path: "donations", element: <DonationManagementPage /> },
            {
              path: "distribution-history",
              element: <DistributionHistoryPage />,
            },
            { path: "system-logs", element: <SystemLogReviewPage /> },
            { path: "settings", element: <RoleSettingsPage /> },
          ],
        },
        { path: "/donations", element: <DonationInformationPage /> },
        { path: "/donor/information", element: <DonationInformationPage /> },
        { path: "*", element: <DefaultAppRedirect /> },
      ]),
    [resolvedAccessMode],
  );

  return <RouterProvider router={router} />;
};

export default AppRoutes;
