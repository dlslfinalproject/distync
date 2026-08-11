import React, { useEffect, useMemo, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../components/layout/PageHeader";
import {
  pageSpacingStyles,
  shellStyles,
} from "../components/layout/BarangayLayout";
import EmptyState from "../components/shared/EmptyState";
import SearchBar from "../components/shared/SearchBar";
import StatusCard from "../components/shared/StatusCard";
import { fetchSystemLogReview } from "../features/system-logs/systemLogService";

const ALL_MODULES_VALUE = "all";
const MODULE_FILTER_OPTIONS = [
  { value: ALL_MODULES_VALUE, label: "All" },
  { value: "Inventory", label: "Inventory" },
  { value: "Relief Pack", label: "Relief Pack" },
  { value: "Donation", label: "Donation" },
  { value: "Distribution", label: "Distribution" },
];

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
  },
  th: {
    padding: "12px 14px",
    textAlign: "left",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px",
    borderBottom: "1px solid #edf3f8",
    color: "#21405f",
    fontSize: "14px",
    verticalAlign: "top",
    lineHeight: 1.5,
  },
  actionColumn: {
    width: "148px",
  },
  moduleColumn: {
    width: "92px",
  },
  recordColumn: {
    width: "32%",
  },
  performedByColumn: {
    width: "150px",
  },
  dateColumn: {
    width: "138px",
  },
  viewColumn: {
    width: "100px",
  },
  centeredColumn: {
    textAlign: "center",
  },
  wrapCell: {
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },
  strong: {
    color: "#17324d",
    fontWeight: 800,
  },
  muted: {
    color: "#60738a",
    fontSize: "12px",
    marginTop: "4px",
  },
};

const filterStyles = {
  grid: {
    ...pageSpacingStyles.filterGrid,
  },
  field: {
    minHeight: "52px",
    padding: "0 14px",
    borderRadius: "16px",
    border: "1px solid #d3dfec",
    backgroundColor: "#ffffff",
    color: "#234260",
    fontSize: "14px",
    boxSizing: "border-box",
    outline: "none",
    boxShadow: "0 8px 18px rgba(75, 101, 132, 0.05)",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  fieldGroup: {
    minWidth: 0,
  },
};

const formatActionLabel = (entryOrValue) => {
  const value =
    typeof entryOrValue === "object"
      ? entryOrValue.action_label || entryOrValue.action
      : entryOrValue;

  if (!value) {
    return "-";
  }

  return String(value);
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatEntityLabel = (entry) => {
  if (entry.record_label) {
    return entry.record_label;
  }

  return "Inventory record";
};

const getRecordLines = (entry) => {
  if (Array.isArray(entry.record_lines) && entry.record_lines.length) {
    return entry.record_lines.filter(Boolean);
  }

  return [formatEntityLabel(entry)];
};

const matchesSearch = (entry, searchTerm) => {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  if (!normalizedSearchTerm) {
    return true;
  }

  return [
    entry.action_label,
    entry.action_detail,
    formatActionLabel(entry),
    entry.module,
    entry.record_label,
    ...(Array.isArray(entry.record_lines) ? entry.record_lines : []),
    entry.performed_by,
    entry.details?.changed_fields,
    entry.details?.previous_fields,
  ]
    .filter(Boolean)
    .some((value) =>
      String(value).toLowerCase().includes(normalizedSearchTerm),
    );
};

const SystemLogReviewPage = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModule, setSelectedModule] = useState(ALL_MODULES_VALUE);

  const loadLogs = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchSystemLogReview({
        type: "audit",
        limit: "all",
      });

      setAuditLogs(response.audit_logs || []);
    } catch (error) {
      setErrorMessage(error.message || "Failed to load audit trail.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs
      .filter((entry) => {
        const moduleMatches =
          selectedModule === ALL_MODULES_VALUE ||
          entry.module === selectedModule;

        return moduleMatches && matchesSearch(entry, searchTerm);
      })
      .sort((firstEntry, secondEntry) => {
        const firstTime = new Date(firstEntry.timestamp || 0).getTime();
        const secondTime = new Date(secondEntry.timestamp || 0).getTime();

        return secondTime - firstTime;
      });
  }, [auditLogs, searchTerm, selectedModule]);

  const summary = useMemo(() => {
    const stockMovementCount = auditLogs.filter((entry) =>
      ["Stock Added", "Stock Adjusted", "Written Off"].includes(
        formatActionLabel(entry),
      ),
    ).length;
    const itemRecordCount = auditLogs.filter((entry) =>
      ["Item Created", "Item Details Edited"].includes(formatActionLabel(entry)),
    ).length;
    const reliefPackTemplateCount = auditLogs.filter((entry) =>
      [
        "Relief Pack Template Created",
        "Relief Pack Details Edited",
      ].includes(formatActionLabel(entry)),
    ).length;
    const donationRecordCount = auditLogs.filter(
      (entry) => entry.module === "Donation",
    ).length;

    return {
      total: auditLogs.length,
      stockMovementCount,
      itemRecordCount,
      reliefPackTemplateCount,
      donationRecordCount,
      visibleCount: filteredAuditLogs.length,
    };
  }, [auditLogs, filteredAuditLogs.length]);

  return (
    <div style={pageSpacingStyles.pageStack}>
      <PageHeader
        title="AUDIT TRAIL"
        description="Read-only activity history for inventory, relief pack, and donation records."
        actions={[
          {
            label: isLoading ? "Refreshing..." : "Refresh",
            onClick: loadLogs,
            disabled: isLoading,
            variant: "secondary",
          },
        ]}
      />

      <div style={shellStyles.statGrid}>
        <StatusCard
          label="Audit Entries Loaded"
          value={summary.total}
          description="Showing finalized inventory, relief pack, and donation audit records."
          accentColor="#4c86be"
        />
        <StatusCard
          label="Stock Movements"
          value={summary.stockMovementCount}
          description="Stock added, adjusted, or written off."
          accentColor="#5b8f72"
        />
        <StatusCard
          label="Item Record Changes"
          value={summary.itemRecordCount}
          description="Items created or item details edited."
          accentColor="#b8844b"
        />
        <StatusCard
          label="Relief Pack Changes"
          value={summary.reliefPackTemplateCount}
          description="Templates created or details edited."
          accentColor="#a76c6c"
        />
        <StatusCard
          label="Donation Records"
          value={summary.donationRecordCount}
          description="Donation entries, detail edits, and write-offs."
          accentColor="#5e8f9d"
        />
        <StatusCard
          label="Matching Current Filters"
          value={summary.visibleCount}
          description="Rows shown after applying search and filters."
          accentColor="#7a6fa8"
        />
      </div>

      <section style={shellStyles.card}>
        <div style={filterStyles.grid}>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by user, action, affected record, or field"
          />

          <label style={filterStyles.fieldGroup}>
            <span style={filterStyles.label}>Module</span>
            <select
              value={selectedModule}
              onChange={(event) => setSelectedModule(event.target.value)}
              style={filterStyles.field}
            >
              {MODULE_FILTER_OPTIONS.map((moduleOption) => (
                <option key={moduleOption.value} value={moduleOption.value}>
                  {moduleOption.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {errorMessage ? (
        <section style={shellStyles.card}>
          <p style={{ margin: 0, color: "#9d4d58", fontWeight: 700 }}>
            {errorMessage}
          </p>
        </section>
      ) : null}

      <section style={shellStyles.card}>
        <div style={pageSpacingStyles.toolbar}>
          <div>
            <h3 style={{ margin: 0, color: "#17324d" }}>Activity Records</h3>
            <p style={{ ...shellStyles.mutedText, marginTop: "6px" }}>
              Showing {summary.visibleCount} of {summary.total} audit entries.
            </p>
          </div>

          <button
            type="button"
            onClick={loadLogs}
            style={pageHeaderStyles.secondaryButton}
            disabled={isLoading}
          >
            <FiRefreshCw />
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {isLoading ? (
          <EmptyState message="Loading audit trail records..." />
        ) : filteredAuditLogs.length === 0 ? (
          <EmptyState message="No matching audit records found. Try adjusting the search or filters." />
        ) : (
          <div style={{ marginTop: "18px", overflowX: "auto" }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={{ ...tableStyles.th, ...tableStyles.actionColumn }}>Audit Action</th>
                  <th style={{ ...tableStyles.th, ...tableStyles.moduleColumn }}>Module</th>
                  <th style={{ ...tableStyles.th, ...tableStyles.recordColumn }}>Record</th>
                  <th style={{ ...tableStyles.th, ...tableStyles.performedByColumn }}>Performed By</th>
                  <th style={{ ...tableStyles.th, ...tableStyles.dateColumn, ...tableStyles.centeredColumn }}>Date & Time</th>
                  <th style={{ ...tableStyles.th, ...tableStyles.viewColumn, ...tableStyles.centeredColumn }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.map((entry) => {
                  return (
                    <tr key={entry.id}>
                      <td style={{ ...tableStyles.td, ...tableStyles.actionColumn }}>
                        <div style={tableStyles.strong}>
                          {formatActionLabel(entry)}
                        </div>
                        {entry.action_detail ? (
                          <div style={tableStyles.muted}>
                            {entry.action_detail}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ ...tableStyles.td, ...tableStyles.moduleColumn }}>{entry.module}</td>
                      <td style={{ ...tableStyles.td, ...tableStyles.recordColumn, ...tableStyles.wrapCell }}>
                        {getRecordLines(entry).map((line, index) => (
                          <div
                            key={`${entry.id}-record-${index}`}
                            style={index === 0 ? tableStyles.strong : tableStyles.muted}
                          >
                            {line}
                          </div>
                        ))}
                      </td>
                      <td style={{ ...tableStyles.td, ...tableStyles.performedByColumn }}>
                        <div style={tableStyles.strong}>{entry.performed_by}</div>
                        {entry.role_code ? (
                          <div style={tableStyles.muted}>{entry.role_code}</div>
                        ) : null}
                      </td>
                      <td style={{ ...tableStyles.td, ...tableStyles.dateColumn, ...tableStyles.centeredColumn }}>
                        {formatDateTime(entry.timestamp)}
                      </td>
                      <td style={{ ...tableStyles.td, ...tableStyles.viewColumn, ...tableStyles.centeredColumn }}>
                        <button
                          type="button"
                          style={pageHeaderStyles.secondaryButton}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default SystemLogReviewPage;
