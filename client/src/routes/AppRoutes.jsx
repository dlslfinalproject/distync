import React from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import BarangayLayout from "../components/layout/BarangayLayout";
import BarangayMasterlistPage from "../pages/barangay/BarangayMasterlistPage";
import DescriptiveAnalyticsPage from "../pages/dashboard/DescriptiveAnalyticsPage";
import DistributionTransactionPage from "../pages/barangay/DistributionTransactionPage";
import StubVerificationPage from "../pages/barangay/StubVerificationPage";
import InventoryBatchesPage from "../pages/inventory/InventoryBatchesPage";
import InventoryItemsPage from "../pages/inventory/InventoryItemsPage";
import InventoryTransactionsPage from "../pages/inventory/InventoryTransactionsPage";
import ReliefPackTemplatesPage from "../pages/inventory/ReliefPackTemplatesPage";
import SuppliersPage from "../pages/inventory/SuppliersPage";

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/barangay/masterlist" replace />} />
        <Route path="/barangay" element={<BarangayLayout />}>
          <Route
            path="descriptive-analytics"
            element={<DescriptiveAnalyticsPage />}
          />
          <Route path="masterlist" element={<BarangayMasterlistPage />} />
          <Route
            path="distribution-transaction"
            element={<DistributionTransactionPage />}
          />
          <Route path="inventory-batches" element={<InventoryBatchesPage />} />
          <Route path="inventory-items" element={<InventoryItemsPage />} />
          <Route
            path="relief-pack-templates"
            element={<ReliefPackTemplatesPage />}
          />
          <Route
            path="inventory-transactions"
            element={<InventoryTransactionsPage />}
          />
          <Route path="suppliers" element={<SuppliersPage />} />
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
