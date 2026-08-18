import React, { useEffect, useMemo, useState } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiRefreshCw,
} from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../components/layout/PageHeader";
import {
  pageSpacingStyles,
  shellStyles,
} from "../components/layout/BarangayLayout";
import EmptyState from "../components/shared/EmptyState";
import SearchBar from "../components/shared/SearchBar";
import DetailsModalShell from "../components/shared/DetailsModalShell";
import StatusCard from "../components/shared/StatusCard";
import { fetchSystemLogReview } from "../features/system-logs/systemLogService";

const ALL_MODULES_VALUE = "all";
const AUDIT_PAGE_SIZE = 50;
const MODULE_FILTER_OPTIONS = [
  { value: ALL_MODULES_VALUE, label: "All" },
  { value: "Inventory", label: "Inventory" },
  { value: "Relief Pack", label: "Relief Pack" },
  { value: "Donation", label: "Donation" },
  { value: "Distribution", label: "Distribution" },
];
const ALL_AUDIT_ACTIONS_VALUE = "all";
const AUDIT_ACTION_FILTER_OPTIONS = [
  {
    value: ALL_AUDIT_ACTIONS_VALUE,
    label: "All audit actions",
    modules: [ALL_MODULES_VALUE, "Inventory", "Relief Pack", "Donation", "Distribution"],
  },
  { value: "item_created", label: "Item Created", modules: ["Inventory"] },
  {
    value: "item_details_edited",
    label: "Item Details Edited",
    modules: ["Inventory"],
  },
  { value: "stock_added", label: "Stock Added", modules: ["Inventory"] },
  { value: "stock_adjusted", label: "Stock Adjusted", modules: ["Inventory"] },
  { value: "written_off", label: "Written Off", modules: ["Inventory", "Donation"] },
  {
    value: "relief_pack_template_created",
    label: "Relief Pack Template Created",
    modules: ["Relief Pack"],
  },
  {
    value: "relief_pack_details_edited",
    label: "Relief Pack Details Edited",
    modules: ["Relief Pack"],
  },
  { value: "donation_entry", label: "Donation Entry", modules: ["Donation"] },
  {
    value: "donation_details_edited",
    label: "Donation Details Edited",
    modules: ["Donation"],
  },
  {
    value: "distributed_items",
    label: "Distributed Items",
    modules: ["Distribution"],
  },
];

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "auto",
    minWidth: "860px",
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
    minWidth: "220px",
  },
  performedByColumn: {
    width: "160px",
  },
  dateColumn: {
    width: "138px",
    whiteSpace: "nowrap",
  },
  viewColumn: {
    width: "100px",
  },
  actionButton: {
    border: "1px solid #c6d8ea",
    borderRadius: "12px",
    width: "36px",
    height: "36px",
    padding: 0,
    backgroundColor: "#f8fbfe",
    color: "#2a4c6f",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
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
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    width: "100%",
  },
  searchWrap: {
    flex: "1 1 360px",
    minWidth: 0,
  },
  controlsWrap: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flex: "0 0 auto",
    flexWrap: "wrap",
  },
  actionGroup: {
    display: "flex",
    gap: "12px",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "flex-end",
    flex: "0 0 auto",
  },
  fieldGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
  field: {
    minHeight: "44px",
    minWidth: "120px",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid #c7d6e5",
    backgroundColor: "#ffffff",
    color: "#17324d",
    fontSize: "14px",
    fontWeight: 600,
    boxSizing: "border-box",
    outline: "none",
    appearance: "auto",
  },
  label: {
    color: "#17324d",
    fontSize: "14px",
    fontWeight: 700,
  },
  card: {
    ...shellStyles.card,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    alignItems: "end",
  },
  stackedFieldGroup: {
    display: "grid",
    gap: "8px",
    minWidth: 0,
  },
  cardField: {
    width: "100%",
    minWidth: 0,
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #cfddeb",
    backgroundColor: "#f8fbfe",
    color: "#1f3b57",
    fontSize: "14px",
    boxSizing: "border-box",
    outline: "none",
    appearance: "auto",
  },
  cardLabel: {
    display: "block",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
};

const auditSummaryStyles = {
  overviewSection: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "16px",
  },
};

const detailModalStyles = {
  shellPanel: {
    backgroundColor: "#eef5fb",
    border: "1px solid #d7e2ef",
    boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  },
  sectionCard: {
    ...shellStyles.card,
    backgroundColor: "#ffffff",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "16px",
    alignItems: "start",
  },
  label: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
  },
  value: {
    margin: "8px 0 0",
    color: "#21405f",
    fontSize: "15px",
    lineHeight: 1.55,
    wordBreak: "break-word",
  },
  tableWrap: {
    overflowX: "auto",
    marginTop: "14px",
    maxWidth: "100%",
    WebkitOverflowScrolling: "touch",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "auto",
    minWidth: "640px",
  },
  th: {
    padding: "10px 12px",
    textAlign: "left",
    fontSize: "12px",
    color: "#66809c",
    borderBottom: "1px solid #dfe8f2",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #edf3f8",
    color: "#21405f",
    fontSize: "14px",
    verticalAlign: "top",
    lineHeight: 1.5,
  },
  changedValue: {
    color: "#17324d",
    fontWeight: 800,
  },
  previousValue: {
    color: "#60738a",
  },
  emptyText: {
    margin: "12px 0 0",
    color: "#69839c",
    fontSize: "14px",
    lineHeight: 1.5,
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

const getRecordLineStyle = (entry, index) => {
  if (entry.module === "Distribution") {
    return tableStyles.strong;
  }

  return index === 0 ? tableStyles.strong : tableStyles.muted;
};

const InfoField = ({ label, value }) => (
  <div>
    <p style={detailModalStyles.label}>{label}</p>
    <p style={detailModalStyles.value}>{value || "--"}</p>
  </div>
);

const getChangeHeading = (entry) => {
  if (entry?.action?.includes("CREATE") || entry?.action_label?.includes("Created")) {
    return "Recorded Details";
  }

  return "Changes Made";
};

const isCreateAuditAction = (entry) =>
  entry?.action?.includes("CREATE") || entry?.action_label?.includes("Created");

const getAuditActionOptions = (moduleValue) => {
  if (moduleValue === ALL_MODULES_VALUE) {
    return AUDIT_ACTION_FILTER_OPTIONS;
  }

  return AUDIT_ACTION_FILTER_OPTIONS.filter((option) => {
    return (
      option.value === ALL_AUDIT_ACTIONS_VALUE ||
      option.modules.includes(moduleValue)
    );
  });
};

const AuditRecordDetailModal = ({ entry, onClose }) => {
  if (!entry) {
    return null;
  }

  const changes = entry.audit_detail?.changes || [];
  const itemChanges = entry.audit_detail?.item_changes || [];
  const distributedItems = entry.audit_detail?.distributed_items || [];
  const recordLines = getRecordLines(entry);
  const isCreatedRecord = isCreateAuditAction(entry);

  return (
    <DetailsModalShell
      isOpen={Boolean(entry)}
      title="Audit Records"
      onClose={onClose}
      maxWidth="940px"
      closeMode="icon"
      titleStyle={{ fontSize: "30px", fontWeight: 700 }}
      panelStyle={detailModalStyles.shellPanel}
    >
      <div style={{ display: "grid", gap: "20px" }}>
        <section className="mayor-audit-trail-detail-section" style={detailModalStyles.sectionCard}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Audit Summary</h3>
          <div style={{ ...detailModalStyles.grid, marginTop: "16px" }}>
            <InfoField label="Audit Action" value={formatActionLabel(entry)} />
            <InfoField label="Module" value={entry.module} />
            <InfoField label="Performed By" value={entry.performed_by} />
            <InfoField label="Date & Time" value={formatDateTime(entry.timestamp)} />
          </div>
        </section>

        <section className="mayor-audit-trail-detail-section" style={detailModalStyles.sectionCard}>
          <h3 style={{ margin: 0, color: "#17324d" }}>Record Information</h3>
          <div style={{ ...detailModalStyles.grid, marginTop: "16px" }}>
            {recordLines.map((line, index) => (
              <InfoField
                key={`${entry.id}-detail-record-${index}`}
                label={index === 0 ? "Record" : "Related Detail"}
                value={line}
              />
            ))}
            {entry.action_detail ? (
              <InfoField label="Summary" value={entry.action_detail} />
            ) : null}
          </div>
        </section>

        <section className="mayor-audit-trail-detail-section" style={detailModalStyles.sectionCard}>
          <h3 style={{ margin: 0, color: "#17324d" }}>{getChangeHeading(entry)}</h3>
          {changes.length === 0 ? (
            <p style={detailModalStyles.emptyText}>
              No field-level changes are available for this audit record.
            </p>
          ) : (
            <div className="mayor-audit-trail-detail-table-scroll" style={detailModalStyles.tableWrap}>
              <table className="mayor-audit-trail-detail-table" style={detailModalStyles.table}>
                <thead>
                  <tr>
                    <th style={detailModalStyles.th}>Field</th>
                    {isCreatedRecord ? (
                      <th style={detailModalStyles.th}>Created Value</th>
                    ) : (
                      <>
                        <th style={detailModalStyles.th}>Before</th>
                        <th style={detailModalStyles.th}>After</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change) => (
                    <tr key={change.field}>
                      <td style={detailModalStyles.td}>{change.label}</td>
                      {isCreatedRecord ? (
                        <td style={{ ...detailModalStyles.td, ...detailModalStyles.changedValue }}>
                          {change.new_value}
                        </td>
                      ) : (
                        <>
                          <td style={{ ...detailModalStyles.td, ...detailModalStyles.previousValue }}>
                            {change.previous_value}
                          </td>
                          <td style={{ ...detailModalStyles.td, ...detailModalStyles.changedValue }}>
                            {change.new_value}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {itemChanges.length > 0 ? (
          <section className="mayor-audit-trail-detail-section" style={detailModalStyles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Item Breakdown</h3>
            <div className="mayor-audit-trail-detail-table-scroll" style={detailModalStyles.tableWrap}>
              <table className="mayor-audit-trail-detail-table" style={detailModalStyles.table}>
                <thead>
                  <tr>
                    <th style={detailModalStyles.th}>Item</th>
                    {isCreatedRecord ? (
                      <>
                        <th style={detailModalStyles.th}>Quantity</th>
                        <th style={detailModalStyles.th}>Remarks</th>
                      </>
                    ) : (
                      <>
                        <th style={detailModalStyles.th}>Before</th>
                        <th style={detailModalStyles.th}>After</th>
                        <th style={detailModalStyles.th}>Change</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {itemChanges.map((item, index) => (
                    <tr key={`${item.item_name}-${index}`}>
                      <td style={detailModalStyles.td}>{item.item_name}</td>
                      {isCreatedRecord ? (
                        <>
                          <td style={{ ...detailModalStyles.td, ...detailModalStyles.changedValue }}>
                            {item.new_quantity} {item.unit_of_measure}
                          </td>
                          <td style={detailModalStyles.td}>{item.remarks || "--"}</td>
                        </>
                      ) : (
                        <>
                          <td style={detailModalStyles.td}>
                            {item.previous_quantity} {item.unit_of_measure}
                          </td>
                          <td style={{ ...detailModalStyles.td, ...detailModalStyles.changedValue }}>
                            {item.new_quantity} {item.unit_of_measure}
                          </td>
                          <td style={detailModalStyles.td}>{item.change_type}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {distributedItems.length > 0 ? (
          <section className="mayor-audit-trail-detail-section" style={detailModalStyles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Items Released</h3>
            <div className="mayor-audit-trail-detail-table-scroll" style={detailModalStyles.tableWrap}>
              <table className="mayor-audit-trail-detail-table" style={detailModalStyles.table}>
                <thead>
                  <tr>
                    <th style={detailModalStyles.th}>Item</th>
                    <th style={detailModalStyles.th}>Batch</th>
                    <th style={detailModalStyles.th}>Quantity</th>
                    <th style={detailModalStyles.th}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {distributedItems.map((item, index) => (
                    <tr key={`${item.item_name}-${index}`}>
                      <td style={detailModalStyles.td}>{item.item_name}</td>
                      <td style={detailModalStyles.td}>{item.batch_no}</td>
                      <td style={{ ...detailModalStyles.td, ...detailModalStyles.changedValue }}>
                        {item.quantity} {item.unit_of_measure}
                      </td>
                      <td style={detailModalStyles.td}>{item.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </DetailsModalShell>
  );
};

const SystemLogReviewPage = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: AUDIT_PAGE_SIZE,
    total_records: 0,
    total_pages: 1,
    has_previous_page: false,
    has_next_page: false,
    retention_years: 5,
  });
  const [auditSummary, setAuditSummary] = useState({
    total_matching_records: 0,
    inventory_records: 0,
    relief_pack_records: 0,
    donation_records: 0,
    distribution_records: 0,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModule, setSelectedModule] = useState(ALL_MODULES_VALUE);
  const [selectedAuditAction, setSelectedAuditAction] = useState(
    ALL_AUDIT_ACTIONS_VALUE,
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedAuditEntry, setSelectedAuditEntry] = useState(null);

  const loadLogs = async (
    page = currentPage,
    search = searchTerm,
    module = selectedModule,
    auditAction = selectedAuditAction,
    nextDateFrom = dateFrom,
    nextDateTo = dateTo,
  ) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchSystemLogReview({
        type: "audit",
        audit_action: auditAction,
        date_from: nextDateFrom,
        date_to: nextDateTo,
        limit: AUDIT_PAGE_SIZE,
        module,
        page,
        search,
      });

      setAuditLogs(response.audit_logs || []);
      setAuditSummary(
        response.summary?.audit_logs || {
          total_matching_records: response.audit_logs?.length || 0,
          inventory_records: 0,
          relief_pack_records: 0,
          donation_records: 0,
          distribution_records: 0,
        },
      );
      setPagination(
        response.pagination?.audit_logs || {
          page,
          limit: AUDIT_PAGE_SIZE,
          total_records: response.audit_logs?.length || 0,
          total_pages: 1,
          has_previous_page: false,
          has_next_page: false,
          retention_years: 5,
        },
      );
    } catch (error) {
      setErrorMessage(error.message || "Failed to load audit trail.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(
      currentPage,
      searchTerm,
      selectedModule,
      selectedAuditAction,
      dateFrom,
      dateTo,
    );
  }, [
    currentPage,
    searchTerm,
    selectedModule,
    selectedAuditAction,
    dateFrom,
    dateTo,
  ]);

  const handleSearchChange = (nextSearchTerm) => {
    setSearchTerm(nextSearchTerm);
    setCurrentPage(1);
  };

  const handleModuleChange = (nextModule) => {
    setSelectedModule(nextModule);
    setSelectedAuditAction(ALL_AUDIT_ACTIONS_VALUE);
    setCurrentPage(1);
  };

  const handleAuditActionChange = (nextAuditAction) => {
    setSelectedAuditAction(nextAuditAction);
    setCurrentPage(1);
  };

  const handleDateFromChange = (nextDateFrom) => {
    setDateFrom(nextDateFrom);
    setCurrentPage(1);
  };

  const handleDateToChange = (nextDateTo) => {
    setDateTo(nextDateTo);
    setCurrentPage(1);
  };

  const auditActionOptions = useMemo(
    () => getAuditActionOptions(selectedModule),
    [selectedModule],
  );

  const filteredAuditLogs = useMemo(() => {
    return [...auditLogs].sort((firstEntry, secondEntry) => {
      const firstTime = new Date(firstEntry.timestamp || 0).getTime();
      const secondTime = new Date(secondEntry.timestamp || 0).getTime();

      return secondTime - firstTime;
    });
  }, [auditLogs]);

  return (
    <div className="mayor-audit-trail-page" style={pageSpacingStyles.pageStack}>
      <PageHeader title="AUDIT TRAIL" />

      <section className="mayor-audit-trail-filter-card" style={filterStyles.card}>
        <label style={filterStyles.stackedFieldGroup}>
          <span style={filterStyles.cardLabel}>Module</span>
          <select
            value={selectedModule}
            onChange={(event) => handleModuleChange(event.target.value)}
            style={filterStyles.cardField}
          >
            {MODULE_FILTER_OPTIONS.map((moduleOption) => (
              <option key={moduleOption.value} value={moduleOption.value}>
                {moduleOption.label}
              </option>
            ))}
          </select>
        </label>

        <label style={filterStyles.stackedFieldGroup}>
          <span style={filterStyles.cardLabel}>Audit Action</span>
          <select
            value={selectedAuditAction}
            onChange={(event) => handleAuditActionChange(event.target.value)}
            style={filterStyles.cardField}
          >
            {auditActionOptions.map((actionOption) => (
              <option key={actionOption.value} value={actionOption.value}>
                {actionOption.label}
              </option>
            ))}
          </select>
        </label>

        <label style={filterStyles.stackedFieldGroup}>
          <span style={filterStyles.cardLabel}>Date From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => handleDateFromChange(event.target.value)}
            style={filterStyles.cardField}
            max={dateTo || undefined}
          />
        </label>

        <label style={filterStyles.stackedFieldGroup}>
          <span style={filterStyles.cardLabel}>Date To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => handleDateToChange(event.target.value)}
            style={filterStyles.cardField}
            min={dateFrom || undefined}
          />
        </label>
      </section>

      <section className="mayor-audit-trail-summary-grid" style={auditSummaryStyles.overviewSection}>
        <StatusCard
          label="Matching Records"
          value={auditSummary.total_matching_records}
        />
        <StatusCard
          label="Inventory Records"
          value={auditSummary.inventory_records}
        />
        <StatusCard
          label="Relief Pack Records"
          value={auditSummary.relief_pack_records}
        />
        <StatusCard
          label="Donation Records"
          value={auditSummary.donation_records}
        />
        <StatusCard
          label="Distribution Records"
          value={auditSummary.distribution_records}
        />
      </section>

      <div className="mayor-audit-trail-toolbar" style={filterStyles.toolbar}>
        <div className="mayor-audit-trail-search-wrap" style={filterStyles.searchWrap}>
          <SearchBar
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search action, module, record, item/barcode, donor, user, or role"
          />
        </div>

        <div className="mayor-audit-trail-controls-wrap" style={filterStyles.controlsWrap}>
          <div className="mayor-audit-trail-action-group" style={filterStyles.actionGroup}>
            <button
              type="button"
              onClick={() =>
                loadLogs(
                  currentPage,
                  searchTerm,
                  selectedModule,
                  selectedAuditAction,
                  dateFrom,
                  dateTo,
                )
              }
              style={pageHeaderStyles.primaryButton}
              disabled={isLoading}
            >
              <FiRefreshCw />
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <section style={shellStyles.card}>
          <p style={{ margin: 0, color: "#9d4d58", fontWeight: 700 }}>
            {errorMessage}
          </p>
        </section>
      ) : null}

      <section className="mayor-audit-trail-records-card" style={shellStyles.card}>
        <div className="mayor-audit-trail-records-toolbar" style={pageSpacingStyles.toolbar}>
          <div>
            <h3 style={{ margin: 0, color: "#17324d" }}>Activity Records</h3>
            <p style={{ ...shellStyles.mutedText, marginTop: "6px" }}>
              Showing {filteredAuditLogs.length} loaded entries from page{" "}
              {pagination.page} of {pagination.total_pages}.
            </p>
          </div>

          <div className="mayor-audit-trail-paginator" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              style={pageHeaderStyles.secondaryButton}
              disabled={isLoading || !pagination.has_previous_page}
              aria-label="Previous page"
              title="Previous page"
            >
              <FiChevronLeft />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => page + 1)}
              style={pageHeaderStyles.secondaryButton}
              disabled={isLoading || !pagination.has_next_page}
              aria-label="Next page"
              title="Next page"
            >
              <FiChevronRight />
            </button>
          </div>
        </div>

        {isLoading ? (
          <EmptyState message="Loading audit trail records..." />
        ) : filteredAuditLogs.length === 0 ? (
          <EmptyState message="No matching audit records found. Try adjusting the search or filters." />
        ) : (
          <div className="mayor-audit-trail-table-scroll" style={{ marginTop: "18px", overflowX: "auto" }}>
            <table className="mayor-audit-trail-table" style={tableStyles.table}>
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
                      <td style={{ ...tableStyles.td, ...tableStyles.actionColumn, ...tableStyles.wrapCell }}>
                        <div style={tableStyles.strong}>
                          {formatActionLabel(entry)}
                        </div>
                        {entry.action_detail ? (
                          <div style={tableStyles.muted}>
                            {entry.action_detail}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ ...tableStyles.td, ...tableStyles.moduleColumn, ...tableStyles.wrapCell }}>{entry.module}</td>
                      <td style={{ ...tableStyles.td, ...tableStyles.recordColumn, ...tableStyles.wrapCell }}>
                        {getRecordLines(entry).map((line, index) => (
                          <div
                            key={`${entry.id}-record-${index}`}
                            style={getRecordLineStyle(entry, index)}
                          >
                            {line}
                          </div>
                        ))}
                      </td>
                      <td style={{ ...tableStyles.td, ...tableStyles.performedByColumn, ...tableStyles.wrapCell }}>
                        <div style={tableStyles.strong}>{entry.performed_by}</div>
                      </td>
                      <td style={{ ...tableStyles.td, ...tableStyles.dateColumn, ...tableStyles.centeredColumn }}>
                        {formatDateTime(entry.timestamp)}
                      </td>
                      <td style={{ ...tableStyles.td, ...tableStyles.viewColumn, ...tableStyles.centeredColumn }}>
                        <button
                          type="button"
                          style={tableStyles.actionButton}
                          title="View Details"
                          aria-label="View Details"
                          onClick={() => setSelectedAuditEntry(entry)}
                        >
                          <FiEye size={18} />
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

      <AuditRecordDetailModal
        entry={selectedAuditEntry}
        onClose={() => setSelectedAuditEntry(null)}
      />
    </div>
  );
};

export default SystemLogReviewPage;
