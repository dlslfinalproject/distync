import React from "react";
import SearchBar from "../shared/SearchBar";
import { pageHeaderStyles } from "../layout/PageHeader";

const MasterlistToolbar = ({
  searchValue,
  onSearchChange,
  onOpenRegisterFamily,
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
        <button type="button" style={pageHeaderStyles.secondaryButton}>
          Filter
        </button>
        <button
          type="button"
          onClick={onOpenRegisterFamily}
          style={pageHeaderStyles.primaryButton}
        >
          Register Family
        </button>
      </div>
    </section>
  );
};

export default MasterlistToolbar;
