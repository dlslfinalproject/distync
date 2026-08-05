import React from "react";
import { FiAlertCircle, FiCheckCircle, FiClock } from "react-icons/fi";
import { shellStyles } from "../layout/BarangayLayout";

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1180px",
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
  countBadge: {
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
  mutedText: {
    color: "#6b8298",
    fontSize: "13px",
  },
};

const getStatusMeta = (status) => {
  if (status === "CLAIMED") {
    return {
      label: "Claimed",
      icon: <FiCheckCircle size={14} />,
      style: {
        backgroundColor: "#e6f5ec",
        color: "#2d7a4f",
        border: "1px solid transparent",
      },
    };
  }

  if (status === "PENDING") {
    return {
      label: "For Claim",
      icon: <FiClock size={14} />,
      style: {
        backgroundColor: "#fff4db",
        color: "#9a6400",
        border: "1px solid transparent",
      },
    };
  }

  return {
    label: "Not Distributed",
    icon: <FiAlertCircle size={14} />,
    style: {
      backgroundColor: "#f6ebeb",
      color: "#9d4d58",
      border: "1px solid transparent",
    },
  };
};

const renderReliefPackItems = (row) => {
  if (
    Array.isArray(row.relief_pack_templates) &&
    row.relief_pack_templates.length > 0
  ) {
    return (
      <div style={{ display: "grid", gap: "12px" }}>
        {row.relief_pack_templates.map((template) => (
          <div
            key={template.id || template.name}
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              backgroundColor: "#f8fbfe",
              border: "1px solid #e0eaf4",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <strong>{template.name || "Relief Pack"}</strong>
              {template.is_additional_pack ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    backgroundColor: "#eaf3fc",
                    color: "#356592",
                    fontSize: "11px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  Additional Sector Pack
                </span>
              ) : null}
            </div>

            {Array.isArray(template.items) && template.items.length > 0 ? (
              <div style={{ display: "grid", gap: "6px" }}>
                {template.items.map((item) => (
                  <div key={item.id || item.inventory_item_id}>
                    {item.inventory_item?.item_name || "Unnamed Item"} ({item.quantity_required}{" "}
                    {Number(item.quantity_required) === 1 ? "unit" : "units"})
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (row.relief_pack_name && row.relief_pack_name !== "--") {
    return row.relief_pack_name;
  }

  if (!Array.isArray(row.relief_pack_items) || row.relief_pack_items.length === 0) {
    return (
      <span style={tableStyles.mutedText}>
        Relief pack items will appear here once a template is linked.
      </span>
    );
  }

  return (
    <div style={{ display: "grid", gap: "6px" }}>
      {row.relief_pack_items.map((item) => (
        <div key={item.id || item.inventory_item_id}>
          {item.inventory_item?.item_name || "Unnamed Item"} ({item.quantity_required}{" "}
          {Number(item.quantity_required) === 1 ? "unit" : "units"})
        </div>
      ))}
    </div>
  );
};

const InventoryDistributionTable = ({
  rows,
  isLoading,
  errorMessage,
  hasSelectedEvent,
}) => {
  if (!hasSelectedEvent) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Distribution</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Select a disaster event to load distribution records.
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Distribution</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          Loading distribution records...
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section style={shellStyles.card}>
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Distribution</h3>
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
        <h3 style={{ marginTop: 0, color: "#17324d" }}>Inventory Distribution</h3>
        <p style={{ ...shellStyles.mutedText, marginTop: "10px" }}>
          No matching records found. Try adjusting your search or filters.
        </p>
      </section>
    );
  }

  return (
    <section style={shellStyles.card}>
      <div style={{ marginBottom: "18px" }}>
        <h3 style={{ margin: 0, color: "#17324d" }}>Family Distribution Records</h3>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.headerCell}>Family Head</th>
              <th style={tableStyles.headerCell}>Address</th>
              <th style={tableStyles.headerCell}>Family Members</th>
              <th style={tableStyles.headerCell}>Sectors</th>
              <th style={tableStyles.headerCell}>Relief Pack</th>
              <th style={tableStyles.headerCell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const statusMeta = getStatusMeta(row.distribution_status);

              return (
                <tr key={row.household_id}>
                  <td style={tableStyles.bodyCell}>
                    <div style={{ fontWeight: 700 }}>{row.family_head_name}</div>
                    {row.barangay_name ? (
                      <div style={{ ...tableStyles.mutedText, marginTop: "4px" }}>
                        {row.barangay_name}
                      </div>
                    ) : null}
                  </td>
                  <td style={tableStyles.bodyCell}>{row.address}</td>
                  <td style={tableStyles.bodyCell}>
                    <span style={tableStyles.countBadge}>{row.family_members_count}</span>
                  </td>
                  <td style={tableStyles.bodyCell}>
                    {row.sectors_text && row.sectors_text !== "-" ? (
                      row.sectors_text
                    ) : (
                      <span style={tableStyles.mutedText}>No sector tags</span>
                    )}
                  </td>
                  <td style={tableStyles.bodyCell}>{renderReliefPackItems(row)}</td>
                  <td style={tableStyles.bodyCell}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 700,
                        ...statusMeta.style,
                      }}
                    >
                      {statusMeta.icon}
                      {statusMeta.label}
                    </span>
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

export default InventoryDistributionTable;
