import React from "react";
import SearchBar from "../shared/SearchBar";
import { pageHeaderStyles } from "../layout/PageHeader";
import { FiUserPlus, FiFilter } from "react-icons/fi";

const MasterlistToolbar = ({
  searchValue,
  onSearchChange,
  onOpenRegisterFamily,
  hideRegisterButton, // New prop to control visibility
}) => {
  return (
    <section
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap",
      }}
    >
      <SearchBar
        value={searchValue}
        onChange={onSearchChange}
        placeholder="Search family head, address, or sectors"
      />

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <button
          type="button"
          style={{
            ...pageHeaderStyles.secondaryButton,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FiFilter size={16} />
          Filter
        </button>
        {/* Only show Register button if not hidden by the activeTab state */}
        {!hideRegisterButton && (
          <button
            type="button"
            onClick={onOpenRegisterFamily}
            style={{
              ...pageHeaderStyles.primaryButton,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FiUserPlus size={16} />
            Register Family
          </button>
        )}
      </div>
    </section>
  );
};

export default MasterlistToolbar;
