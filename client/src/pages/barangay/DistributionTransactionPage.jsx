import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "../../components/layout/PageHeader";
import StubSummaryCard from "../../components/distribution/StubSummaryCard";
import DistributionForm from "../../components/distribution/DistributionForm";
import {
  fetchInventoryBatches,
  fetchInventoryItems,
  fetchReliefPackTemplateById,
  fetchReliefPackTemplates,
  recordDistributionTransaction,
} from "../../features/distribution/distributionService";

const createEmptyReleasedItem = () => ({
  id: `${Date.now()}-${Math.random()}`,
  inventory_item_id: "",
  inventory_batch_id: "",
  quantity_released: 1,
});

const buildStubContextFromLocation = (locationState, searchParams) => {
  if (locationState?.stubContext) {
    return locationState.stubContext;
  }

  const stubId = searchParams.get("stub_id");
  const householdId = searchParams.get("household_id");
  const disasterEventId = searchParams.get("disaster_event_id");

  if (!stubId || !householdId || !disasterEventId) {
    return null;
  }

  return {
    stub_id: stubId,
    household_id: householdId,
    disaster_event_id: disasterEventId,
    stub_no: searchParams.get("stub_no") || "--",
    serial_no: searchParams.get("serial_no") || "--",
    status: searchParams.get("status") || "--",
    family_head_name: searchParams.get("family_head_name") || "--",
    barangay_name: searchParams.get("barangay_name") || "--",
    household_size: Number(searchParams.get("household_size") || 0),
  };
};

const DistributionTransactionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stubContext, setStubContext] = useState(() =>
    buildStubContextFromLocation(location.state, searchParams),
  );
  const [claimedByName, setClaimedByName] = useState(
    location.state?.stubContext?.family_head_name || "",
  );
  const [remarks, setRemarks] = useState("");
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [releasedItems, setReleasedItems] = useState([createEmptyReleasedItem()]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const loadFormOptions = async () => {
      setIsLoadingData(true);
      setErrorMessage("");

      try {
        const [templateList, itemList, batchList] = await Promise.all([
          fetchReliefPackTemplates(),
          fetchInventoryItems(),
          fetchInventoryBatches(),
        ]);

        setTemplates(templateList || []);
        setInventoryItems(itemList || []);
        setInventoryBatches(batchList || []);
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadFormOptions();
  }, []);

  useEffect(() => {
    const currentStubContext = buildStubContextFromLocation(
      location.state,
      searchParams,
    );

    setStubContext(currentStubContext);

    if (location.state?.stubContext?.family_head_name) {
      setClaimedByName(location.state.stubContext.family_head_name);
    }
  }, [location.state, searchParams]);

  const availableInventoryBatches = useMemo(() => {
    return inventoryBatches.filter(
      (batch) => batch.quantity_available > 0 && batch.status !== "EXPIRED",
    );
  }, [inventoryBatches]);

  const updateReleasedItem = (rowId, fieldName, fieldValue) => {
    setReleasedItems((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        if (fieldName === "inventory_item_id") {
          return {
            ...row,
            inventory_item_id: fieldValue,
            inventory_batch_id: "",
          };
        }

        if (fieldName === "quantity_released") {
          return {
            ...row,
            quantity_released:
              fieldValue === "" ? "" : Number.parseInt(fieldValue, 10),
          };
        }

        return {
          ...row,
          [fieldName]: fieldValue,
        };
      }),
    );
  };

  const handleAddItemRow = () => {
    setReleasedItems((currentRows) => [...currentRows, createEmptyReleasedItem()]);
  };

  const handleRemoveItemRow = (rowId) => {
    setReleasedItems((currentRows) =>
      currentRows.filter((row) => row.id !== rowId),
    );
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    try {
      const template = await fetchReliefPackTemplateById(selectedTemplateId);

      if (!template.items || template.items.length === 0) {
        setReleasedItems([createEmptyReleasedItem()]);
        return;
      }

      setReleasedItems(
        template.items.map((item, index) => ({
          id: `${Date.now()}-${index}`,
          inventory_item_id: item.inventory_item_id,
          inventory_batch_id: "",
          quantity_released: item.quantity_required,
        })),
      );
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const validateForm = () => {
    if (!stubContext) {
      return "No stub was selected for distribution.";
    }

    if (!claimedByName.trim()) {
      return "claimed_by_name is required.";
    }

    if (releasedItems.length === 0) {
      return "Add at least one released item.";
    }

    for (const row of releasedItems) {
      if (!row.inventory_item_id) {
        return "Each released item row must have an inventory item.";
      }

      if (!row.inventory_batch_id) {
        return "Each released item row must have a selected batch.";
      }

      if (!Number.isInteger(row.quantity_released) || row.quantity_released <= 0) {
        return "Each released item quantity must be a positive integer.";
      }

      const batch = availableInventoryBatches.find(
        (currentBatch) => currentBatch.id === row.inventory_batch_id,
      );

      if (!batch) {
        return "One or more selected batches are no longer available.";
      }

      if (batch.inventory_item_id !== row.inventory_item_id) {
        return "Selected batch does not match the chosen inventory item.";
      }

      if (row.quantity_released > batch.quantity_available) {
        return `Quantity exceeds available stock for batch ${batch.batch_no}.`;
      }
    }

    return "";
  };

  const handleSubmit = async () => {
    const validationMessage = validateForm();

    if (validationMessage) {
      setErrorMessage(validationMessage);
      setSuccessMessage("");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await recordDistributionTransaction({
        disaster_event_id: stubContext.disaster_event_id,
        household_id: stubContext.household_id,
        stub_id: stubContext.stub_id,
        claimed_by_name: claimedByName.trim(),
        verified_by: null,
        device_id: null,
        is_offline_encoded: false,
        sync_status: "SYNCED",
        remarks: remarks.trim() || null,
        items: releasedItems.map((row) => ({
          inventory_item_id: row.inventory_item_id,
          inventory_batch_id: row.inventory_batch_id,
          quantity_released: row.quantity_released,
        })),
      });

      setSuccessMessage(response.message || "Distribution recorded successfully.");
      setReleasedItems([createEmptyReleasedItem()]);
      setSelectedTemplateId("");
      setRemarks("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Barangay Workspace"
        title="DISTRIBUTION TRANSACTION"
        description="Record actual relief claiming after a stub has been verified and select the exact item batches being released."
        actions={[
          {
            label: "Back to Verification",
            variant: "secondary",
            onClick: () => navigate("/barangay/stub-distribution"),
          },
        ]}
      />

      <StubSummaryCard stubContext={stubContext} />

      <DistributionForm
        claimedByName={claimedByName}
        remarks={remarks}
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        inventoryItems={inventoryItems}
        inventoryBatches={availableInventoryBatches}
        releasedItems={releasedItems}
        errorMessage={errorMessage}
        successMessage={successMessage}
        isSubmitting={isSubmitting}
        isLoadingData={isLoadingData}
        onClaimedByNameChange={setClaimedByName}
        onRemarksChange={setRemarks}
        onTemplateChange={setSelectedTemplateId}
        onApplyTemplate={handleApplyTemplate}
        onAddItemRow={handleAddItemRow}
        onRemoveItemRow={handleRemoveItemRow}
        onUpdateItemRow={updateReleasedItem}
        onSubmit={handleSubmit}
      />
    </>
  );
};

export default DistributionTransactionPage;
