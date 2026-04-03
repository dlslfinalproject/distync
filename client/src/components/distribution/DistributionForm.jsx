import React from "react";
import { pageHeaderStyles } from "../layout/PageHeader";
import { shellStyles } from "../layout/BarangayLayout";
import ReleasedItemsTable from "./ReleasedItemsTable";

const inputStyles = {
  width: "100%",
  minHeight: "48px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #d2deea",
  boxSizing: "border-box",
  fontSize: "14px",
  color: "#21405f",
  backgroundColor: "#ffffff",
};

const labelStyles = {
  display: "block",
  marginBottom: "8px",
  color: "#4f677f",
  fontSize: "13px",
  fontWeight: 700,
};

const DistributionForm = ({
  claimedByName,
  remarks,
  templates,
  selectedTemplateId,
  inventoryItems,
  inventoryBatches,
  releasedItems,
  errorMessage,
  successMessage,
  isSubmitting,
  isLoadingData,
  onClaimedByNameChange,
  onRemarksChange,
  onTemplateChange,
  onApplyTemplate,
  onAddItemRow,
  onRemoveItemRow,
  onUpdateItemRow,
  onSubmit,
}) => {
  return (
    <>
      <section style={shellStyles.card}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "18px",
          }}
        >
          <div>
            <label htmlFor="claimed_by_name" style={labelStyles}>
              Claimed By Name
            </label>
            <input
              id="claimed_by_name"
              type="text"
              value={claimedByName}
              onChange={(event) => onClaimedByNameChange(event.target.value)}
              placeholder="Enter claimant full name"
              style={inputStyles}
            />
          </div>

          <div>
            <label htmlFor="template_id" style={labelStyles}>
              Relief Pack Template
            </label>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <select
                id="template_id"
                value={selectedTemplateId}
                onChange={(event) => onTemplateChange(event.target.value)}
                style={{ ...inputStyles, flex: "1 1 220px" }}
              >
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onApplyTemplate}
                disabled={!selectedTemplateId || isLoadingData || isSubmitting}
                style={{
                  ...pageHeaderStyles.secondaryButton,
                  opacity:
                    !selectedTemplateId || isLoadingData || isSubmitting ? 0.7 : 1,
                }}
              >
                Apply Template
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "18px" }}>
          <label htmlFor="distribution_remarks" style={labelStyles}>
            Remarks
          </label>
          <textarea
            id="distribution_remarks"
            value={remarks}
            onChange={(event) => onRemarksChange(event.target.value)}
            placeholder="Optional notes about this release"
            style={{ ...inputStyles, minHeight: "110px", resize: "vertical" }}
          />
        </div>

        {errorMessage ? (
          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "14px",
              backgroundColor: "#fff3f1",
              border: "1px solid #f1d2cc",
              color: "#9d4d58",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div
            style={{
              marginTop: "18px",
              padding: "14px 16px",
              borderRadius: "14px",
              backgroundColor: "#edf8f1",
              border: "1px solid #cfe8d7",
              color: "#2f6c47",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {successMessage}
          </div>
        ) : null}
      </section>

      <ReleasedItemsTable
        rows={releasedItems}
        inventoryItems={inventoryItems}
        inventoryBatches={inventoryBatches}
        onAddRow={onAddItemRow}
        onRemoveRow={onRemoveItemRow}
        onUpdateRow={onUpdateItemRow}
        isDisabled={isLoadingData || isSubmitting}
      />

      <section
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={onSubmit}
          disabled={isLoadingData || isSubmitting}
          style={{
            ...pageHeaderStyles.primaryButton,
            opacity: isLoadingData || isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? "Recording Distribution..." : "Record Distribution"}
        </button>
      </section>
    </>
  );
};

export default DistributionForm;
