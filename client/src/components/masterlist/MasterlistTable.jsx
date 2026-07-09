import React from "react";
import { FiEdit2, FiEye, FiLogIn, FiLogOut } from "react-icons/fi";
import { shellStyles } from "../layout/BarangayLayout";
import SyncStatusBadge from "../shared/SyncStatusBadge";
import EmptyState from "../shared/EmptyState";
import ErrorState from "../shared/ErrorState";
import LoadingState from "../shared/LoadingState";
import TableActionsMenu from "../shared/TableActionsMenu";

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
  archivedRow: {
    backgroundColor: "#f8fbfe",
  },
  archivedBodyCell: {
    color: "#5f7690",
  },
  archivedMembersBadge: {
    backgroundColor: "#eef5fb",
    color: "#6a87a6",
  },
  archivedCheckbox: {
    opacity: 0.65,
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
  onRestoreHousehold,
  isDepartureReadOnly = false,
  departureReadOnlyText = "-",
  selectedHouseholds,
  onToggleSelect,
  onSelectAll,
}) => {
  const safeSelectedHouseholds = Array.isArray(selectedHouseholds)
    ? selectedHouseholds
    : [];
  const canUseSelection =
    typeof onToggleSelect === "function" && typeof onSelectAll === "function";

  if (!hasSelectedEvent) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Registered Family</h3>
        <div style={{ marginTop: "10px" }}>
          <EmptyState
            compact
            message="Please select a disaster event to load the masterlist."
          />
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Registered Family</h3>
        <div style={{ marginTop: "10px" }}>
          <LoadingState message="Loading masterlist data..." />
        </div>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Registered Family</h3>
        <div style={{ marginTop: "10px" }}>
          <ErrorState compact message={errorMessage} />
        </div>
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Registered Family</h3>
        <div style={{ marginTop: "10px" }}>
          <EmptyState
            compact
            message="No registered families were found for the current filters."
          />
        </div>
      </section>
    );
  }

  const selectableRows = isDepartureReadOnly
    ? []
    : rows.filter(
        (row) => !row.departure_time_value && row.can_record_departure,
      );

  const buildActionItems = (row) => {
    const viewAction = {
      key: "view",
      label: "View Details",
      icon: <FiEye size={18} />,
      disabled: typeof onViewHousehold !== "function",
      onClick: (selectedRow) => onViewHousehold?.(selectedRow.household_id),
    };

    if (isDepartureReadOnly) {
      return [viewAction];
    }

    if (row.is_non_admitted_resident) {
      const nonAdmittedResidentActions = [
        viewAction,
        {
          key: "edit",
          label: "Edit Household",
          icon: <FiEdit2 size={18} />,
          disabled: typeof onEditHousehold !== "function",
          title: "Edit Household",
          onClick: (selectedRow) => onEditHousehold?.(selectedRow.household_id),
        },
      ];

      if (!row.has_used_admit_action) {
        nonAdmittedResidentActions.push({
          key: "admit",
          label: "Admit Household",
          icon: <FiLogIn size={18} />,
          disabled: typeof onRestoreHousehold !== "function",
          title: "Admit Household",
          onClick: (selectedRow) =>
            onRestoreHousehold?.(selectedRow.household_id),
        });
      }

      return nonAdmittedResidentActions;
    }

    if (row.is_operationally_active === false) {
      return [
        viewAction,
        {
          key: "return",
          label: "Re-admit Household",
          icon: <FiLogIn size={18} />,
          disabled: typeof onRestoreHousehold !== "function",
          title: "Re-admit Household",
          onClick: (selectedRow) =>
            onRestoreHousehold?.(selectedRow.household_id),
        },
      ];
    }

    return [
      viewAction,
      {
        key: "edit",
        label: "Edit Household",
        icon: <FiEdit2 size={18} />,
        disabled: typeof onEditHousehold !== "function",
        title: "Edit Household",
        onClick: (selectedRow) => onEditHousehold?.(selectedRow.household_id),
      },
    ];
  };

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
              const isArchivedRow = row.is_operationally_active === false;
              const isSelectable =
                !isDepartureReadOnly &&
                !row.departure_time_value &&
                row.can_record_departure &&
                !row.is_local_only;
              const isSelected = safeSelectedHouseholds.includes(
                row.household_id,
              );
              const actionItems = buildActionItems(row);

              return (
                <tr
                  key={row.household_id}
                  style={isArchivedRow ? tableStyles.archivedRow : undefined}
                >
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...(isArchivedRow ? tableStyles.archivedBodyCell : {}),
                      textAlign: "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!canUseSelection || !isSelectable}
                      onChange={() => onToggleSelect(row.household_id)}
                      style={isArchivedRow ? tableStyles.archivedCheckbox : undefined}
                    />
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...(isArchivedRow ? tableStyles.archivedBodyCell : {}),
                    }}
                  >
                    {row.family_head_name}
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...(isArchivedRow ? tableStyles.archivedBodyCell : {}),
                    }}
                  >
                    {row.address}
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...(isArchivedRow ? tableStyles.archivedBodyCell : {}),
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        ...tableStyles.membersBadge,
                        ...(isArchivedRow ? tableStyles.archivedMembersBadge : {}),
                      }}
                    >
                      {row.members_count}
                    </span>
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...(isArchivedRow ? tableStyles.archivedBodyCell : {}),
                    }}
                  >
                    {row.sectors_text}
                  </td>
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
                      ...(isArchivedRow ? tableStyles.archivedBodyCell : {}),
                      textAlign: "center",
                    }}
                  >
                    {row.arrival_time_text}
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...(isArchivedRow ? tableStyles.archivedBodyCell : {}),
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
                        <FiLogOut size={18} />
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td
                    style={{
                      ...tableStyles.bodyCell,
                      ...tableStyles.actionBodyCell,
                    }}
                  >
                    <TableActionsMenu
                      row={row}
                      menuId={row.household_id}
                      buttonTitle={
                        row.is_local_only ? "Available after sync" : "Actions"
                      }
                      buttonAriaLabel="Actions"
                      disabled={row.is_local_only}
                      onToggle={(selectedRow) => {
                        console.log("Selected row:", selectedRow);
                      }}
                      dataPrefix="masterlist-action"
                      menuWidth={actionItems.length > 2 ? 168 : 116}
                      variant="icon-grid"
                      items={actionItems}
                    />
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
