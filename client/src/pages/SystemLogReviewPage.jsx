import React, { useEffect, useMemo, useState } from "react";
import { FiEye, FiRefreshCw } from "react-icons/fi";
import PageHeader, { pageHeaderStyles } from "../components/layout/PageHeader";
import {
  pageSpacingStyles,
  shellStyles,
} from "../components/layout/BarangayLayout";
import EmptyState from "../components/shared/EmptyState";
import SearchBar from "../components/shared/SearchBar";
import DetailsModalShell from "../components/shared/DetailsModalShell";
import TablePagination from "../components/shared/TablePagination";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
} from "../features/pagination/pagination.mjs";
import { fetchSystemLogReview } from "../features/system-logs/systemLogService";

const ALL_MODULES_VALUE = "all";
const MODULE_FILTER_OPTIONS = [
  { value: ALL_MODULES_VALUE, label: "All" },
  { value: "Inventory", label: "Inventory" },
  { value: "Relief Pack", label: "Relief Pack" },
  { value: "Donation", label: "Donation" },
  { value: "Distribution", label: "Distribution" },
  { value: "Sync", label: "Sync Center" },
];
const ALL_AUDIT_ACTIONS_VALUE = "all";
const AUDIT_ACTION_FILTER_OPTIONS = [
  {
    value: ALL_AUDIT_ACTIONS_VALUE,
    label: "All audit actions",
    modules: [ALL_MODULES_VALUE, "Inventory", "Relief Pack", "Donation", "Distribution"],
  },
  { value: "item_created", label: "Item Created", modules: ["Inventory"] },
  { value: "packaging_added", label: "Packaging Added", modules: ["Inventory"] },
  {
    value: "item_details_edited",
    label: "Item Details Edited",
    modules: ["Inventory"],
  },
  { value: "stock_added", label: "Stock Added", modules: ["Inventory"] },
  {
    value: "stock_adjusted",
    label: "Stock Adjusted",
    modules: ["Inventory"],
  },
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
  {
    value: "sync_conflict_resolution",
    label: "Sync Conflict Resolved",
    modules: ["Sync"],
  },
];

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "auto",
    minWidth: "940px",
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
    width: "132px",
    minWidth: "132px",
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
  actionValue: {
    fontWeight: 700,
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
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
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
    fontWeight: 700,
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
    timeZone: "Asia/Manila",
  }).format(new Date(value));
};

const formatBackendEnumText = (value) => {
  if (value === null || value === undefined) {
    return value;
  }

  return String(value).replace(
    /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g,
    (token) =>
      token
        .split("_")
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(" "),
  );
};

const formatEntityLabel = (entry) => {
  if (entry.record_label) {
    return entry.record_label;
  }

  return "Inventory record";
};

const getRecordLines = (entry) => {
  const lines =
    Array.isArray(entry.record_lines) && entry.record_lines.length
      ? entry.record_lines.filter(Boolean)
      : [formatEntityLabel(entry)];

  return lines.map(formatBackendEnumText);
};

const InfoField = ({ label, value }) => (
  <div>
    <p style={detailModalStyles.label}>{label}</p>
    <p style={detailModalStyles.value}>{value || "--"}</p>
  </div>
);

const AuditDetailChangesTable = ({ changes, isCreatedRecord }) => {
  if (!changes.length) {
    return (
      <p style={detailModalStyles.emptyText}>
        No recorded details are available for this audit record.
      </p>
    );
  }

  return (
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
  );
};

const getDonationItemDetailChanges = (item) => {
  return [
    {
      field: "item_name",
      label: "Item Name",
      new_value: item.item_name || "--",
    },
    {
      field: "quantity_received",
      label: "Quantity Received",
      new_value: item.quantity_received || "--",
    },
    {
      field: "unit_of_measure",
      label: "Unit",
      new_value: item.unit_of_measure || "--",
    },
    {
      field: "packaging",
      label: "Packaging",
      new_value: item.packaging || "--",
    },
    {
      field: "batch_no",
      label: "Batch Number",
      new_value: item.batch_no || "--",
    },
    {
      field: "expiration_date",
      label: "Expiration Date",
      new_value: item.expiration_date || "No expiration date recorded",
    },
    {
      field: "remarks",
      label: "Remarks",
      new_value: item.remarks || "--",
    },
  ];
};

const DonationEntryPackContents = ({ contents }) => {
  if (!contents.length) {
    return (
      <p style={detailModalStyles.emptyText}>
        No relief pack contents are available for this audit record.
      </p>
    );
  }

  return (
    <div
      className="mayor-audit-trail-detail-table-scroll"
      style={detailModalStyles.tableWrap}
    >
      <table className="mayor-audit-trail-detail-table" style={detailModalStyles.table}>
        <thead>
          <tr>
            <th style={detailModalStyles.th}>Item Name</th>
            <th style={detailModalStyles.th}>Quantity Received</th>
            <th style={detailModalStyles.th}>Unit</th>
            <th style={detailModalStyles.th}>Packaging</th>
            <th style={detailModalStyles.th}>Batch Number</th>
            <th style={detailModalStyles.th}>Expiration Date</th>
          </tr>
        </thead>
        <tbody>
          {contents.map((content, index) => (
            <tr key={`${content.itemName || "item"}-${index}`}>
              <td style={detailModalStyles.td}>{content.itemName || "--"}</td>
              <td style={detailModalStyles.td}>{content.quantityReceived || "--"}</td>
              <td style={detailModalStyles.td}>{content.unitOfMeasure || "--"}</td>
              <td style={detailModalStyles.td}>{content.packaging || "--"}</td>
              <td style={detailModalStyles.td}>{content.batchNo || "--"}</td>
              <td style={detailModalStyles.td}>
                {content.expirationDate || "No expiration date recorded"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DonationEntryItemsDetails = ({ items }) => {
  const normalizedItems = Array.isArray(items) ? items : [];
  const looseItems = normalizedItems.filter(
    (item) => item.donation_type !== "Relief Pack",
  );
  const reliefPackItems = normalizedItems.filter(
    (item) => item.donation_type === "Relief Pack",
  );

  if (!normalizedItems.length) {
    return (
      <p style={detailModalStyles.emptyText}>
        No received donation items are available for this audit record.
      </p>
    );
  }

  return (
    <>
      {looseItems.length > 0 ? (
        <section
          className="mayor-audit-trail-detail-section"
          style={detailModalStyles.sectionCard}
        >
          <h3 style={{ margin: 0, color: "#17324d" }}>
            Donated Items (Loose Item)
          </h3>
          <div style={{ display: "grid", gap: "20px", marginTop: "16px" }}>
            {looseItems.map((item, index) => (
              <div key={[item.item_name, index].join("-")}>
                {looseItems.length > 1 ? (
                  <h4
                    style={{
                      margin: index === 0 ? 0 : "4px 0 0",
                      color: "#17324d",
                      fontSize: "18px",
                    }}
                  >
                    Donated Item {index + 1}
                  </h4>
                ) : null}
                <AuditDetailChangesTable
                  changes={getDonationItemDetailChanges(item)}
                  isCreatedRecord
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {reliefPackItems.length > 0 ? (
        <section
          className="mayor-audit-trail-detail-section"
          style={detailModalStyles.sectionCard}
        >
          <h3 style={{ margin: 0, color: "#17324d" }}>Pack Contents</h3>
          <div style={{ display: "grid", gap: "20px", marginTop: "16px" }}>
            {reliefPackItems.map((item, index) => (
              <div key={[item.relief_pack_name, index].join("-")}>
                {reliefPackItems.length > 1 ? (
                  <h4
                    style={{
                      margin: index === 0 ? 0 : "4px 0 0",
                      color: "#17324d",
                      fontSize: "18px",
                    }}
                  >
                    {item.relief_pack_name || `Relief Pack ${index + 1}`}
                  </h4>
                ) : null}
                <DonationEntryPackContents
                  contents={Array.isArray(item.relief_pack_contents)
                    ? item.relief_pack_contents
                    : []}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
};

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
  const isItemCreatedRecord =
    entry.entity_type === "INVENTORY_ITEM" &&
    entry.action === "INVENTORY_ITEM_CREATE";
  const isPackagingAddedRecord =
    entry.entity_type === "INVENTORY_ITEM_STOCK_FORM" &&
    entry.action === "INVENTORY_ITEM_STOCK_FORM_CREATE" &&
    entry.action_label === "Packaging Added";
  const isDonationEntryRecord =
    entry.entity_type === "DONATION" && entry.action === "DONATION_CREATE";
  const isDonationDetailsEditedRecord =
    entry.action_label === "Donation Details Edited" &&
    ["DONATION", "DONATION_ITEM"].includes(entry.entity_type);
  const isStockAddedRecord =
    entry.action_label === "Stock Added" &&
    ["INVENTORY_BATCH", "INVENTORY_TRANSACTION"].includes(entry.entity_type);
  const donationDetails = isDonationEntryRecord
    ? entry.audit_detail?.donation_details ?? changes
    : [];
  const donationItems = isDonationEntryRecord
    ? entry.audit_detail?.donation_items || []
    : [];
  const donationStockAdjustment = isDonationDetailsEditedRecord
    ? entry.audit_detail?.donation_stock_adjustment || []
    : [];
  const itemDetails = isItemCreatedRecord || isPackagingAddedRecord
    ? entry.audit_detail?.item_details ?? changes
    : isStockAddedRecord
      ? entry.audit_detail?.stock_addition || []
      : changes;
  const openingStockDetails = isItemCreatedRecord || isPackagingAddedRecord
    ? entry.audit_detail?.opening_stock || []
    : [];
  const openingTransactionDetails = isItemCreatedRecord || isPackagingAddedRecord
    ? entry.audit_detail?.opening_transaction || []
    : [];
  const stockTransactionDetails = isStockAddedRecord
    ? entry.audit_detail?.stock_transaction || []
    : [];

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
            {recordLines.map((line, index) => (
              <InfoField
                key={`${entry.id}-summary-record-${index}`}
                label={index === 0 ? "Record" : "Related Detail"}
                value={line}
              />
            ))}
            {entry.action_detail ? (
              <InfoField label="Summary" value={entry.action_detail} />
            ) : null}
            <InfoField label="Performed By" value={entry.performed_by} />
            <InfoField label="Audit Recorded At" value={formatDateTime(entry.timestamp)} />
          </div>
        </section>

        <section className="mayor-audit-trail-detail-section" style={detailModalStyles.sectionCard}>
          <h3 style={{ margin: 0, color: "#17324d" }}>
            {isDonationEntryRecord || isDonationDetailsEditedRecord
              ? "Donation Details"
              : isItemCreatedRecord || isPackagingAddedRecord
              ? "Item Details"
              : isStockAddedRecord
                ? "Stock Addition Details"
                : getChangeHeading(entry)}
          </h3>
          <AuditDetailChangesTable
            changes={isDonationEntryRecord ? donationDetails : itemDetails}
            isCreatedRecord={isCreatedRecord}
          />
          {isDonationDetailsEditedRecord && donationStockAdjustment.length > 0 ? (
            <>
              <h4
                style={{
                  margin: "24px 0 0",
                  color: "#17324d",
                  fontSize: "18px",
                }}
              >
                Related Stock Adjustment
              </h4>
              <AuditDetailChangesTable
                changes={donationStockAdjustment}
                isCreatedRecord
              />
            </>
          ) : null}
        </section>

        {isDonationEntryRecord && donationItems.length > 0 ? (
          <DonationEntryItemsDetails items={donationItems} />
        ) : null}

        {(isItemCreatedRecord || isPackagingAddedRecord) && openingStockDetails.length > 0 ? (
          <section className="mayor-audit-trail-detail-section" style={detailModalStyles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Opening Stock Details</h3>
            <AuditDetailChangesTable
              changes={openingStockDetails}
              isCreatedRecord
            />
          </section>
        ) : null}

        {(isItemCreatedRecord || isPackagingAddedRecord) && openingTransactionDetails.length > 0 ? (
          <section className="mayor-audit-trail-detail-section" style={detailModalStyles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Opening Transaction Details</h3>
            <AuditDetailChangesTable
              changes={openingTransactionDetails}
              isCreatedRecord
            />
          </section>
        ) : null}

        {isStockAddedRecord && stockTransactionDetails.length > 0 ? (
          <section className="mayor-audit-trail-detail-section" style={detailModalStyles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Stock Transaction Details</h3>
            <AuditDetailChangesTable
              changes={stockTransactionDetails}
              isCreatedRecord
            />
          </section>
        ) : null}

        {!isDonationEntryRecord && itemChanges.length > 0 ? (
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
    limit: DEFAULT_TABLE_PAGE_SIZE,
    total_records: 0,
    total_pages: 1,
    has_previous_page: false,
    has_next_page: false,
    retention_years: 5,
  });
  const [pageSize, setPageSize] = useState(DEFAULT_TABLE_PAGE_SIZE);
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
    nextPageSize = pageSize,
  ) => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchSystemLogReview({
        type: "audit",
        audit_action: auditAction,
        date_from: nextDateFrom,
        date_to: nextDateTo,
        limit: nextPageSize,
        module,
        page,
        search,
      });

      setAuditLogs(response.audit_logs || []);
      setPagination(
        response.pagination?.audit_logs || {
          page,
          limit: nextPageSize,
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
    pageSize,
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

  const hasActiveAuditFilters = Boolean(
    searchTerm.trim() ||
      selectedModule !== ALL_MODULES_VALUE ||
      selectedAuditAction !== ALL_AUDIT_ACTIONS_VALUE ||
      dateFrom ||
      dateTo,
  );

  const handleClearAllFilters = () => {
    setSearchTerm("");
    setSelectedModule(ALL_MODULES_VALUE);
    setSelectedAuditAction(ALL_AUDIT_ACTIONS_VALUE);
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const handlePageSizeChange = (nextPageSize) => {
    const normalizedPageSize = Number(nextPageSize);

    if (!TABLE_PAGE_SIZE_OPTIONS.includes(normalizedPageSize)) {
      return;
    }

    setPageSize(normalizedPageSize);
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

        {hasActiveAuditFilters ? (
          <div className="mayor-audit-trail-filter-actions">
            <button
              className="mayor-audit-trail-clear-filters"
              type="button"
              onClick={handleClearAllFilters}
              style={{
                border: "none",
                background: "transparent",
                color: "#55718b",
                padding: "2px 0",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </section>

      <div className="mayor-audit-trail-toolbar" style={filterStyles.toolbar}>
        <div className="mayor-audit-trail-search-wrap" style={filterStyles.searchWrap}>
          <SearchBar
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search action, item, batch number, donor, relief pack, or user"
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
          <h3 style={{ margin: 0, color: "#17324d" }}>Activity Records</h3>
        </div>

        <TablePagination
          totalItems={pagination.total_records}
          currentPage={pagination.page}
          pageSize={pagination.limit || pageSize}
          pageSizeOptions={TABLE_PAGE_SIZE_OPTIONS}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
          isVisible={!isLoading && !errorMessage && pagination.total_records > 0}
          disabled={isLoading}
          ariaLabel="Audit trail pagination"
          previousAriaLabel="Go to previous audit trail page"
          nextAriaLabel="Go to next audit trail page"
        />

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
                        <div style={tableStyles.actionValue}>
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
                          <div key={`${entry.id}-record-${index}`}>{line}</div>
                        ))}
                      </td>
                      <td style={{ ...tableStyles.td, ...tableStyles.performedByColumn, ...tableStyles.wrapCell }}>
                        {entry.performed_by}
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
