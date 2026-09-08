import React from "react";
import { FiFileText, FiPackage, FiPlus } from "react-icons/fi";
import { MdQrCodeScanner } from "react-icons/md";
import {
  inventoryPageStyles,
  primaryTopBtn,
  secondaryTopBtn,
} from "../../features/inventory-items/inventoryItemsPageUi";

const InventoryPageActions = ({
  exportingFormat,
  onOpenScanModal,
  onOpenCreateModal,
  onOpenExportModal,
  showScanAndAdd = true,
  showExport = true,
  isOffline = false,
}) => {
  return (
    <div className="inventory-items-actions-row" style={inventoryPageStyles.topActionsRow}>
      {showScanAndAdd && (
        <>
          <button type="button" style={primaryTopBtn} onClick={onOpenScanModal}>
            <MdQrCodeScanner size={16} />
            Scan Item
          </button>

          <button type="button" style={primaryTopBtn} onClick={onOpenCreateModal}>
            <span style={inventoryPageStyles.addItemIconWrap}>
              <FiPackage size={16} />
              <span style={inventoryPageStyles.addItemPlus}>
                <FiPlus size={10} strokeWidth={3} />
              </span>
            </span>
            Add Item
          </button>
        </>
      )}

      {showExport && (
        <button
          type="button"
          onClick={onOpenExportModal}
          disabled={Boolean(exportingFormat) || isOffline}
          title={
            isOffline
              ? "Exporting inventory data requires an internet connection."
              : "Export inventory"
          }
          style={{
            ...secondaryTopBtn,
            opacity: exportingFormat || isOffline ? 0.7 : 1,
            cursor: exportingFormat || isOffline ? "not-allowed" : "pointer",
          }}
        >
          <FiFileText size={16} />
          {exportingFormat
            ? `Exporting ${exportingFormat.toUpperCase()}...`
            : "Export"}
        </button>
      )}
    </div>
  );
};

export default InventoryPageActions;
