import React from "react";
import SearchBar from "../shared/SearchBar";
import { pageHeaderStyles } from "../layout/PageHeader";

const StubSearchBar = ({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  isSearching,
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
      <div style={{ flex: "1 1 420px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <SearchBar
          value={searchValue}
          onChange={onSearchChange}
          placeholder="Search stub number, serial number, or family head"
        />
        <button
          type="button"
          onClick={onSearchSubmit}
          disabled={isSearching}
          style={{
            ...pageHeaderStyles.primaryButton,
            opacity: isSearching ? 0.75 : 1,
          }}
        >
          {isSearching ? "Searching..." : "Search"}
        </button>
      </div>

      <button type="button" style={pageHeaderStyles.secondaryButton}>
        Filter
      </button>
    </section>
  );
};

export default StubSearchBar;
