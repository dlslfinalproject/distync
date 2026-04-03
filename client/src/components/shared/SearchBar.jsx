import React from "react";

const searchBarStyles = {
  wrapper: {
    flex: "1 1 320px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "52px",
    padding: "0 16px",
    borderRadius: "16px",
    border: "1px solid #d3dfec",
    backgroundColor: "#ffffff",
    boxShadow: "0 8px 18px rgba(75, 101, 132, 0.05)",
  },
  icon: {
    color: "#7790a7",
    fontSize: "16px",
  },
  input: {
    border: "none",
    outline: "none",
    width: "100%",
    fontSize: "14px",
    color: "#234260",
    backgroundColor: "transparent",
  },
};

const SearchBar = ({ value, onChange, placeholder }) => {
  return (
    <label style={searchBarStyles.wrapper}>
      <span style={searchBarStyles.icon}>Search</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={searchBarStyles.input}
      />
    </label>
  );
};

export default SearchBar;
