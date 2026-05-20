import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import QrScanner from "qr-scanner";
import qrScannerWorkerPath from "qr-scanner/qr-scanner-worker.min.js?url";
import PageHeader, { pageHeaderStyles } from "../../components/layout/PageHeader";
import StubSummaryCard from "../../components/distribution/StubSummaryCard";
import DistributionForm from "../../components/distribution/DistributionForm";
import { shellStyles } from "../../components/layout/BarangayLayout";
import { fetchStubDetails, verifyStub } from "../../features/stubs/stubService";
import { extractStubQrValue } from "../../utils/stubQr";
import {
  fetchInventoryBatches,
  fetchInventoryItems,
  fetchReliefPackTemplateById,
  fetchReliefPackTemplates,
  recordDistributionTransaction,
} from "../../features/distribution/distributionService";

QrScanner.WORKER_PATH = qrScannerWorkerPath;

const qrLookupStyles = {
  field: {
    width: "100%",
    minHeight: "48px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid #d2deea",
    boxSizing: "border-box",
    fontSize: "14px",
    color: "#21405f",
    backgroundColor: "#ffffff",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#4f677f",
    fontSize: "13px",
    fontWeight: 700,
  },
  video: {
    width: "100%",
    maxWidth: "320px",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "16px",
    border: "1px solid #d3dfeb",
    backgroundColor: "#0f2236",
  },
};

const createEmptyReleasedItem = () => ({
  id: `${Date.now()}-${Math.random()}`,
  inventory_item_id: "",
  inventory_batch_id: "",
  quantity_released: 1,
});

const buildStubContextFromDetails = (stubDetails) => {
  if (!stubDetails) {
    return null;
  }

  return {
    stub_id: stubDetails.id,
    household_id: stubDetails.household?.id || "",
    disaster_event_id: stubDetails.disaster_event?.id || "",
    stub_no: stubDetails.stub_no || "--",
    serial_no: stubDetails.serial_no || "--",
    status: stubDetails.status || "--",
    family_head_name: stubDetails.household?.family_head_name || "--",
    barangay_name: stubDetails.barangay?.name || "--",
    household_size: stubDetails.household?.household_size || 0,
    family_head_photo_url: stubDetails.household?.family_head_photo_url || "",
    photo_captured_at: stubDetails.household?.photo_captured_at || "",
    photo_verification_notes:
      stubDetails.household?.photo_verification_notes || "",
    qr_code_value: stubDetails.qr_code_value || "",
    qr_status: stubDetails.qr_status || "",
    qr_notes: stubDetails.qr_notes || "",
  };
};

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
    family_head_photo_url: searchParams.get("family_head_photo_url") || "",
    photo_captured_at: searchParams.get("photo_captured_at") || "",
    photo_verification_notes:
      searchParams.get("photo_verification_notes") || "",
    qr_code_value: searchParams.get("qr_code_value") || "",
    qr_status: searchParams.get("qr_status") || "",
    qr_notes: searchParams.get("qr_notes") || "",
  };
};

const DistributionTransactionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qrScannerVideoRef = useRef(null);
  const qrScannerInstanceRef = useRef(null);

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
  const [isLoadingStubDetails, setIsLoadingStubDetails] = useState(false);
  const [qrLookupValue, setQrLookupValue] = useState("");
  const [isResolvingQrLookup, setIsResolvingQrLookup] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [qrScannerMessage, setQrScannerMessage] = useState("");

  const canUseQrScanner =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    Boolean(window.isSecureContext);

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

  useEffect(() => {
    if (!stubContext?.stub_id) {
      return;
    }

    let isMounted = true;

    const loadStubDetails = async () => {
      setIsLoadingStubDetails(true);

      try {
        const stubDetails = await fetchStubDetails(stubContext.stub_id);

        if (!isMounted) {
          return;
        }

        setStubContext((currentValue) => {
          if (!currentValue) {
            return currentValue;
          }

          return {
            ...currentValue,
            ...buildStubContextFromDetails(stubDetails),
          };
        });
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error.message || "Failed to load family head verification photo.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingStubDetails(false);
        }
      }
    };

    loadStubDetails();

    return () => {
      isMounted = false;
    };
  }, [stubContext?.stub_id]);

  useEffect(() => {
    if (!isQrScannerOpen || !qrScannerVideoRef.current) {
      return;
    }

    setQrScannerMessage("");

    const scanner = new QrScanner(
      qrScannerVideoRef.current,
      (scanResult) => {
        const scannedValue =
          typeof scanResult === "string" ? scanResult : scanResult?.data || "";

        if (!scannedValue) {
          return;
        }

        setQrLookupValue(scannedValue);
        setIsQrScannerOpen(false);
        void resolveStubFromQrLookup(scannedValue);
      },
      {
        returnDetailedScanResult: true,
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
      },
    );

    qrScannerInstanceRef.current = scanner;

    scanner.start().catch(() => {
      setQrScannerMessage(
        "Unable to start QR camera scanning. You can enter the QR reference manually instead.",
      );
      setIsQrScannerOpen(false);
    });

    return () => {
      scanner.stop();
      scanner.destroy();
      qrScannerInstanceRef.current = null;
    };
  }, [isQrScannerOpen]);

  const handleCloseQrScanner = () => {
    qrScannerInstanceRef.current?.stop();
    qrScannerInstanceRef.current?.destroy();
    qrScannerInstanceRef.current = null;
    setIsQrScannerOpen(false);
  };

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

  const resolveStubFromQrLookup = async (lookupValue) => {
    const normalizedValue = extractStubQrValue(lookupValue);

    if (!normalizedValue) {
      setErrorMessage("Enter or scan a QR reference value first.");
      setSuccessMessage("");
      return;
    }

    setIsResolvingQrLookup(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const verification = await verifyStub({
        qrCodeValue: normalizedValue,
      });

      const resolvedStubId = verification?.data?.stub?.id;

      if (!resolvedStubId) {
        throw new Error("QR lookup did not return a valid stub record.");
      }

      const stubDetails = await fetchStubDetails(resolvedStubId);
      const nextStubContext = buildStubContextFromDetails(stubDetails);

      setStubContext(nextStubContext);
      setClaimedByName(nextStubContext?.family_head_name || "");
      setQrLookupValue(normalizedValue);

      if (verification?.data?.is_claimable) {
        setSuccessMessage("QR verified successfully. You can now record distribution.");
      } else {
        setErrorMessage(
          verification?.data?.reason ||
            verification?.message ||
            "This QR-linked stub is not claimable.",
        );
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to resolve the QR reference.");
    } finally {
      setIsResolvingQrLookup(false);
    }
  };

  const validateForm = () => {
    if (!stubContext) {
      return "No stub was selected for distribution.";
    }

    if (stubContext.status !== "ISSUED") {
      return "Selected stub is not claimable for distribution.";
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
        qr_reference_value: stubContext.qr_code_value || qrLookupValue.trim() || null,
        relief_pack_template_id: selectedTemplateId || null,
        remarks: remarks.trim() || null,
        items: releasedItems.map((row) => ({
          inventory_item_id: row.inventory_item_id,
          inventory_batch_id: row.inventory_batch_id,
          quantity_released: row.quantity_released,
        })),
      });

      setSuccessMessage(
        response.message
          ? `${response.message}${response.data?.receipt_no ? ` Receipt No: ${response.data.receipt_no}` : ""}`
          : "Distribution recorded successfully.",
      );
      setReleasedItems([createEmptyReleasedItem()]);
      setSelectedTemplateId("");
      setRemarks("");
      setStubContext((currentValue) =>
        currentValue
          ? {
              ...currentValue,
              status: response.data?.stub?.status || "CLAIMED",
            }
          : currentValue,
      );
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

      <section style={shellStyles.card}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 1fr) auto auto",
            gap: "12px",
            alignItems: "end",
          }}
        >
          <div>
            <label htmlFor="qr_reference_lookup" style={qrLookupStyles.label}>
              QR Reference Lookup
            </label>
            <input
              id="qr_reference_lookup"
              type="text"
              value={qrLookupValue}
              onChange={(event) => setQrLookupValue(event.target.value)}
              placeholder="Scan or enter the stub QR reference value"
              style={qrLookupStyles.field}
            />
          </div>

          <button
            type="button"
            onClick={() => resolveStubFromQrLookup(qrLookupValue)}
            disabled={isResolvingQrLookup}
            style={{
              ...pageHeaderStyles.primaryButton,
              minHeight: "48px",
              opacity: isResolvingQrLookup ? 0.7 : 1,
            }}
          >
            {isResolvingQrLookup ? "Verifying..." : "Verify QR"}
          </button>

          <button
            type="button"
            onClick={() => setIsQrScannerOpen((currentValue) => !currentValue)}
            disabled={!canUseQrScanner || isResolvingQrLookup}
            style={{
              ...pageHeaderStyles.secondaryButton,
              minHeight: "48px",
              opacity: !canUseQrScanner || isResolvingQrLookup ? 0.7 : 1,
              cursor:
                !canUseQrScanner || isResolvingQrLookup
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {isQrScannerOpen ? "Close Scanner" : "Scan QR"}
          </button>
        </div>

        <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
          Manual stub search and the existing stub-based workflow still work. QR lookup
          is an added proof-of-receipt and distribution validation path.
        </p>

        {!canUseQrScanner ? (
          <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>
            Camera QR scanning is available only on HTTPS or localhost in a supported browser.
          </p>
        ) : null}

        {qrScannerMessage ? (
          <p style={{ ...shellStyles.mutedText, marginTop: "8px", color: "#a14d58" }}>
            {qrScannerMessage}
          </p>
        ) : null}

        {isQrScannerOpen ? (
          <div style={{ marginTop: "16px" }}>
            <video
              ref={qrScannerVideoRef}
              style={qrLookupStyles.video}
              muted
              playsInline
            />
            <div style={{ marginTop: "12px" }}>
              <button
                type="button"
                onClick={handleCloseQrScanner}
                style={pageHeaderStyles.secondaryButton}
              >
                Stop Scanner
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <StubSummaryCard
        stubContext={stubContext}
        isLoadingStubDetails={isLoadingStubDetails}
      />

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
