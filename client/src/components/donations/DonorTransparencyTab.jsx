import React from "react";
import { shellStyles } from "../layout/BarangayLayout";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1080px",
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
    verticalAlign: "top",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },
  centeredBodyCell: {
    textAlign: "center",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  mutedText: {
    color: "#6b8298",
    fontSize: "13px",
  },
  stackedList: {
    display: "grid",
    gap: "4px",
  },
};

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value || 0));
const formatQuantityWithUnit = (value, unit) =>
  `${formatNumber(value)} ${unit || "items"}`;
const formatWriteOffReason = (reason) => {
  const normalizedReason = String(reason || "").trim();

  if (!normalizedReason) {
    return "--";
  }

  return normalizedReason
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const DonorTransparencyTab = ({
  portalData,
  transparencyRows: providedTransparencyRows,
  showDisasterEventColumn = false,
}) => {
  const transparencyRows =
    providedTransparencyRows ||
    portalData.transparency_summary?.received_vs_distributed ||
    [];

  return (
    <section className="mayor-donation-management-records-card" style={shellStyles.card}>
        <div
          style={{
            marginBottom: "20px",
            display: "grid",
            gap: "16px",
          }}
        >
          <h3 style={{ margin: 0, color: "#17324d" }}>
            Donation Item Transparency
          </h3>
        </div>

        {transparencyRows.length === 0 ? (
          <p style={shellStyles.mutedText}>
            No donated inventory summaries are available yet.
          </p>
        ) : (
          <div className="mayor-donation-management-table-scroll" style={{ overflowX: "auto" }}>
            <table className="mayor-donation-management-table" style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.headerCell}>Donor Name</th>
                  {showDisasterEventColumn ? (
                    <th
                      style={{
                        ...tableStyles.headerCell,
                        textAlign: "center",
                      }}
                    >
                      Disaster Event
                    </th>
                  ) : null}
                  <th style={tableStyles.headerCell}>Item Name</th>
                  <th
                    style={{
                      ...tableStyles.headerCell,
                      textAlign: "center",
                    }}
                  >
                    Received
                  </th>
                  <th
                    style={{
                      ...tableStyles.headerCell,
                      textAlign: "center",
                    }}
                  >
                    Distributed
                  </th>
                  <th
                    style={{
                      ...tableStyles.headerCell,
                      textAlign: "center",
                    }}
                  >
                    Written Off
                  </th>
                  <th
                    style={{
                      ...tableStyles.headerCell,
                      textAlign: "center",
                    }}
                  >
                    Remaining Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {transparencyRows.map((row) => (
                  <tr
                    key={row.public_key || `${row.donor_name}-${row.item_name}`}
                  >
                    <td style={tableStyles.bodyCell}>
                      <span style={{ fontWeight: 700 }}>
                        {row.donor_name || "--"}
                      </span>
                    </td>
                    {showDisasterEventColumn ? (
                      <td
                        style={{
                          ...tableStyles.bodyCell,
                          ...tableStyles.centeredBodyCell,
                        }}
                      >
                        {row.disaster_event_title || "--"}
                      </td>
                    ) : null}
                    <td style={tableStyles.bodyCell}>
                      {row.item_name || "--"}
                    </td>
                    <td
                      style={{
                        ...tableStyles.bodyCell,
                        ...tableStyles.centeredBodyCell,
                      }}
                    >
                      {formatQuantityWithUnit(
                        row.quantity_received,
                        row.unit_of_measure,
                      )}
                    </td>
                    <td
                      style={{
                        ...tableStyles.bodyCell,
                        ...tableStyles.centeredBodyCell,
                      }}
                    >
                      {formatQuantityWithUnit(
                        row.quantity_distributed,
                        row.unit_of_measure,
                      )}
                    </td>
                    <td
                      style={{
                        ...tableStyles.bodyCell,
                        ...tableStyles.centeredBodyCell,
                      }}
                    >
                      <div style={tableStyles.stackedList}>
                        <div>
                          {formatQuantityWithUnit(
                            row.quantity_written_off,
                            row.unit_of_measure,
                          )}
                        </div>
                        {(row.write_off_reasons || []).map((reasonRow) => (
                          <div
                            key={`${row.public_key}-${reasonRow.reason}`}
                            style={tableStyles.mutedText}
                          >
                            {formatWriteOffReason(reasonRow.reason)}:{" "}
                            {formatQuantityWithUnit(
                              reasonRow.quantity,
                              row.unit_of_measure,
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td
                      style={{
                        ...tableStyles.bodyCell,
                        ...tableStyles.centeredBodyCell,
                      }}
                    >
                      {formatQuantityWithUnit(
                        row.quantity_remaining,
                        row.unit_of_measure,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
};

export default DonorTransparencyTab;
