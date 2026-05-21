import React, { useEffect, useState } from "react";
import { shellStyles } from "../layout/BarangayLayout";
import { MdDoorFront } from "react-icons/md";
import { FiMoreHorizontal } from "react-icons/fi";
import SyncStatusBadge from "../shared/SyncStatusBadge";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "860px",
  },
  headerCell: {
    padding: "14px 16px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "nowrap",
  },
  bodyCell: {
    padding: "16px",
    color: "#21405f",
    borderBottom: "1px solid #edf3f8",
    fontSize: "14px",
    verticalAlign: "middle",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  actionHeaderCell: {
    width: "88px",
    minWidth: "88px",
    textAlign: "center",
  },
  actionBodyCell: {
    width: "88px",
    minWidth: "88px",
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  departureButton: {
    border: "1px solid #c6d8ea",
    borderRadius: "12px",
    width: "40px",
    height: "40px",
    backgroundColor: "#f7fbfe",
    color: "#24496e",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  actionMenuButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#24496e",
  },
  dropdown: {
    position: "fixed",
    background: "#fff",
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(18, 39, 60, 0.16)",
    padding: "8px",
    zIndex: 1300,
    minWidth: "176px",
    display: "grid",
    gap: "6px",
    border: "1px solid #d7e2ef",
  },
  dropdownButton: {
    border: "none",
    borderRadius: "10px",
    width: "100%",
    backgroundColor: "#ffffff",
    color: "#24496e",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    cursor: "pointer",
    padding: "10px 12px",
    fontSize: "14px",
    fontWeight: 600,
    textAlign: "left",
  },
  membersBadge: {
    display: "inline-block",
    minWidth: "36px",
    textAlign: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    backgroundColor: "#e5f1fb",
    color: "#356592",
    fontSize: "12px",
    fontWeight: 700,
  },
};

const MasterlistTable = ({
  rows,
  isLoading,
  errorMessage,
  hasSelectedEvent,
  onMarkDeparted,
  onViewHousehold,
  onEditHousehold,
  onArchiveHousehold,
  isDepartureReadOnly = false,
  departureReadOnlyText = "-",
  selectedHouseholds,
  onToggleSelect,
  onSelectAll,
}) => {
  const [activeMenu, setActiveMenu] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
  });
  const safeSelectedHouseholds = Array.isArray(selectedHouseholds)
    ? selectedHouseholds
    : [];
  const canUseSelection =
    typeof onToggleSelect === "function" && typeof onSelectAll === "function";

  useEffect(() => {
    if (!activeMenu) {
      return undefined;
    }

    const handleCloseMenu = (event) => {
      const menuElement = event.target?.closest?.(
        "[data-masterlist-action-menu='true']",
      );
      const menuButtonElement = event.target?.closest?.(
        "[data-masterlist-action-button='true']",
      );

      if (menuElement || menuButtonElement) {
        return;
      }

      setActiveMenu(null);
      setSelectedRow(null);
    };

    document.addEventListener("mousedown", handleCloseMenu);
    window.addEventListener("scroll", handleCloseMenu, true);
    window.addEventListener("resize", handleCloseMenu);

    return () => {
      document.removeEventListener("mousedown", handleCloseMenu);
      window.removeEventListener("scroll", handleCloseMenu, true);
      window.removeEventListener("resize", handleCloseMenu);
    };
  }, [activeMenu]);

  const handleToggleMenu = (event, row) => {
    event.stopPropagation();
    event.preventDefault();

    const buttonRect = event.currentTarget.getBoundingClientRect();
    const dropdownWidth = 176;
    const dropdownHeight = 132;
    const spacing = 8;

    const shouldOpenUpward =
      window.innerHeight - buttonRect.bottom < dropdownHeight + spacing;

    const calculatedLeft = Math.min(
      Math.max(buttonRect.left + buttonRect.width / 2 - dropdownWidth / 2, 12),
      window.innerWidth - dropdownWidth - 12,
    );

    const calculatedTop = shouldOpenUpward
      ? buttonRect.top - dropdownHeight - spacing
      : buttonRect.bottom + spacing;

    setMenuPosition({
      top: calculatedTop,
      left: calculatedLeft,
    });

    console.log("Selected row:", row);

    setActiveMenu((currentValue) =>
      currentValue === row.household_id ? null : row.household_id,
    );
    setSelectedRow((currentValue) =>
      currentValue?.household_id === row.household_id ? null : row,
    );
  };

  if (!hasSelectedEvent) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Registered Family</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Please select a disaster event to load the masterlist.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Registered Family</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Loading masterlist data...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Registered Family</h3>
        <p
          style={{
            ...shellStyles.mutedText,
            marginTop: "10px",
            color: "#a14d58",
          }}
        >
          {errorMessage}
        </p>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Registered Family</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No registered families were found for the current filters.
        </p>
      </section>
    );
  }

  const selectableRows = isDepartureReadOnly
    ? []
    : rows.filter(
        (row) => !row.departure_time_value && row.can_record_departure,
      );

  const areAllSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) =>
      safeSelectedHouseholds.includes(row.household_id),
    );

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Registered Family</h3>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th
                style={{
                  ...tableStyles.headerCell,
                  width: "56px",
                  textAlign: "center",
                }}
              >
                <input
                  type="checkbox"
                  checked={areAllSelected}
                  onChange={onSelectAll}
                  disabled={!canUseSelection || !selectableRows.length}
                />
              </th>
              <th style={tableStyles.headerCell}>Family Head</th>
              <th style={tableStyles.headerCell}>Address</th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  textAlign: "center",
                }}
              >
                Members
              </th>
              <th style={tableStyles.headerCell}>Sectors</th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  textAlign: "center",
                }}
              >
                Sync
              </th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  textAlign: "center",
                }}
              >
                Arrival Time
              </th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  textAlign: "center",
                }}
              >
                Departure Time
              </th>
              <th
                style={{
                  ...tableStyles.headerCell,
                  ...tableStyles.actionHeaderCell,
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelectable =
                !isDepartureReadOnly &&
                !row.departure_time_value &&
                row.can_record_departure &&
                !row.is_local_only;
              const isSelected = safeSelectedHouseholds.includes(
                row.household_id,
              );

              return (
                <tr key={row.household_id}>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!canUseSelection || !isSelectable}
                      onChange={() => onToggleSelect(row.household_id)}
                    />
                  </td>
                  <td style={tableStyles.bodyCell}>{row.family_head_name}</td>
                  <td style={tableStyles.bodyCell}>{row.address}</td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                    }}
                  >
                    <span style={tableStyles.membersBadge}>
                      {row.members_count}
                    </span>
                  </td>
                  <td style={tableStyles.bodyCell}>{row.sectors_text}</td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                    }}
                  >
                    <SyncStatusBadge status={row.sync_status} compact />
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                    }}
                  >
                    {row.arrival_time_text}
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      textAlign: "center",
                    }}
                  >
                    {isDepartureReadOnly ? (
                      departureReadOnlyText || "-"
                    ) : row.is_local_only ? (
                      <span style={{ color: "#60738a", fontSize: "12px", fontWeight: 700 }}>
                        Waiting for sync
                      </span>
                    ) : row.departure_time_value ? (
                      row.departure_time_text
                    ) : row.can_record_departure ? (
                      <button
                        type="button"
                        onClick={() => onMarkDeparted(row.household_id)}
                        style={tableStyles.departureButton}
                        title="Mark Departed"
                      >
                        <MdDoorFront size={18} />
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...tableStyles.actionBodyCell,
                      position: "relative",
                    }}
                  >
                    <button
                      type="button"
                      onClick={(event) => handleToggleMenu(event, row)}
                      style={tableStyles.actionMenuButton}
                      title={row.is_local_only ? "Available after sync" : "Actions"}
                      aria-label="Actions"
                      disabled={row.is_local_only}
                      data-masterlist-action-button="true"
                    >
                      <FiMoreHorizontal size={18} />
                    </button>

                    {activeMenu === row.household_id && selectedRow ? (
                      <div
                        style={{
                          ...tableStyles.dropdown,
                          top: `${menuPosition.top}px`,
                          left: `${menuPosition.left}px`,
                        }}
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={(event) => event.stopPropagation()}
                        data-masterlist-action-menu="true"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onViewHousehold?.(selectedRow.household_id);
                            setActiveMenu(null);
                            setSelectedRow(null);
                          }}
                          style={tableStyles.dropdownButton}
                          disabled={typeof onViewHousehold !== "function"}
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onEditHousehold?.(selectedRow.household_id);
                            setActiveMenu(null);
                            setSelectedRow(null);
                          }}
                          style={tableStyles.dropdownButton}
                          disabled={
                            typeof onEditHousehold !== "function" ||
                            selectedRow.is_active === false
                          }
                          title={
                            selectedRow.is_active === false
                              ? "Archived households cannot be edited"
                              : "Edit Household"
                          }
                        >
                          Edit Household
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onArchiveHousehold?.(selectedRow.household_id);
                            setActiveMenu(null);
                            setSelectedRow(null);
                          }}
                          style={{
                            ...tableStyles.dropdownButton,
                            color:
                              selectedRow.is_active === false ? "#8f9fb0" : "#8a5d22",
                          }}
                          disabled={
                            typeof onArchiveHousehold !== "function" ||
                            selectedRow.is_active === false
                          }
                          title={
                            selectedRow.is_active === false
                              ? "Household already archived"
                              : "Archive Household"
                          }
                        >
                          Archive Household
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default MasterlistTable;
