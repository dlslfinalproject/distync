import React from "react";
import SearchBar from "../shared/SearchBar";
import { pageHeaderStyles } from "../layout/PageHeader";
import { FiFilter } from "react-icons/fi";

const StubSearchBar = ({ searchValue, onSearchChange, onSearchSubmit }) => {
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
      {/* Search Input Container */}
      <div style={{ flex: "1" }}>
        <SearchBar
          value={searchValue}
          onChange={onSearchChange}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              onSearchSubmit();
            }
          }}
          placeholder="Search stub number or family head"
        />
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "12px" }}>
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
      </div>
    </section>
  );
};

export default StubSearchBar;
