import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import {
  exportMenuButtonStyles,
  exportMenuStyles,
} from "../../features/donations/donationUi";

const DonationExportModal = ({
  isOpen,
  isExporting,
  exportLabel,
  icon,
  options,
  onToggle,
  onSelectOption,
}) => {
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={onToggle}
        style={pageHeaderStyles.secondaryButton}
        disabled={isExporting}
      >
        {icon}
        {exportLabel}
      </button>

      {isOpen ? (
        <div style={exportMenuStyles}>
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onSelectOption(option.key)}
              style={exportMenuButtonStyles}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default DonationExportModal;
