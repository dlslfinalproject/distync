import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiPrinter, FiX } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import QrCodePanel from "../../components/stubs/QrCodePanel";
import {
  fetchAllDisasterEvents,
  fetchBarangays,
} from "../../features/disaster-events/disasterEventService";
import {
  fetchBarangayStubDashboard,
  fetchMunicipalStubDashboard,
  fetchStubDetails,
} from "../../features/stubs/stubService";

const ALL_BARANGAYS = "__ALL_BARANGAYS__";

const printStyles = `
  @page {
    size: A4 portrait;
    margin: 6mm;
  }

  body {
    margin: 0;
    font-family: Arial, sans-serif;
    background: #edf4fb;
    color: #17324d;
  }

  @media print {
    body {
      background: #ffffff;
    }

    .stub-print-toolbar {
      display: none !important;
    }

    .stub-print-page {
      padding: 0 !important;
      background: #ffffff !important;
    }

    .stub-print-page__content {
      max-width: none !important;
      padding: 0 !important;
    }

    .stub-print-grid {
      gap: 2mm !important;
    }

    .stub-print-card {
      box-shadow: none !important;
      margin: 0 !important;
      page-break-inside: avoid;
      break-inside: avoid;
    }
  }
`;

const pageStyles = {
  page: {
    minHeight: "100vh",
    padding: "16px",
    boxSizing: "border-box",
    background:
      "linear-gradient(180deg, #edf4fb 0%, #e5eef7 50%, #dde7f2 100%)",
  },
  content: {
    maxWidth: "1200px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    backgroundColor: "#ffffff",
    border: "1px solid #d7e2ef",
    borderRadius: "18px",
    padding: "18px 20px",
    boxShadow: "0 10px 24px rgba(76, 101, 132, 0.08)",
  },
  toolbarTitle: {
    margin: 0,
    color: "#17324d",
    fontSize: "22px",
    fontWeight: 800,
  },
  toolbarText: {
    margin: "6px 0 0",
    color: "#60738a",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  toolbarActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  button: {
    border: "1px solid #c6d8ea",
    borderRadius: "14px",
    padding: "12px 18px",
    backgroundColor: "#f8fbfe",
    color: "#24496e",
    fontSize: "14px",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },
  primaryButton: {
    backgroundColor: "#214b77",
    borderColor: "#214b77",
    color: "#ffffff",
  },
  infoCard: {
    backgroundColor: "#ffffff",
    border: "1px solid #d7e2ef",
    borderRadius: "18px",
    padding: "18px 20px",
    boxShadow: "0 10px 24px rgba(76, 101, 132, 0.08)",
  },
  mutedText: {
    margin: 0,
    color: "#60738a",
    fontSize: "14px",
    lineHeight: 1.6,
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))",
    gap: "8px",
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px dashed #17324d",
    borderRadius: "8px",
    padding: "8px",
    boxShadow: "0 4px 12px rgba(76, 101, 132, 0.08)",
    display: "grid",
    gap: "6px",
    justifyItems: "center",
    alignContent: "start",
  },
  eyebrow: {
    margin: 0,
    color: "#48627d",
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    textAlign: "center",
  },
  stubNumber: {
    margin: 0,
    color: "#17324d",
    fontSize: "15px",
    fontWeight: 800,
  },
  familyHead: {
    margin: 0,
    color: "#17324d",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.25,
    textAlign: "center",
    overflowWrap: "anywhere",
  },
  qrColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    alignItems: "center",
    width: "100%",
  },
  qrWrap: {
    width: "100%",
    maxWidth: "104px",
  },
};

const parseStubIds = (value) => {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const getAffectedBarangayIds = (event) => {
  if (!Array.isArray(event?.affected_barangays)) {
    return [];
  }

  return [
    ...new Set(
      event.affected_barangays
        .map((barangay) =>
          typeof barangay === "string"
            ? barangay
            : barangay?.id || barangay?.barangay_id || "",
        )
        .filter(Boolean),
    ),
  ];
};

const getDashboardRowsForPrint = async ({ eventId, barangayId }) => {
  if (barangayId !== ALL_BARANGAYS) {
    const payload = await fetchBarangayStubDashboard({
      disasterEventId: eventId,
      barangayId,
    });

    return Array.isArray(payload?.data) ? payload.data : [];
  }

  const eventsPayload = await fetchAllDisasterEvents();
  const selectedEvent = (Array.isArray(eventsPayload) ? eventsPayload : []).find(
    (event) => event.id === eventId,
  );

  if (!selectedEvent) {
    throw new Error("The selected disaster event could not be found.");
  }

  if (selectedEvent.status === "ACTIVE") {
    const payload = await fetchMunicipalStubDashboard({
      disasterEventId: eventId,
    });

    return Array.isArray(payload?.data) ? payload.data : [];
  }

  const barangaysPayload = await fetchBarangays();
  const availableBarangayIds = new Set(
    (Array.isArray(barangaysPayload) ? barangaysPayload : []).map(
      (barangay) => barangay.id,
    ),
  );
  const affectedBarangayIds = getAffectedBarangayIds(selectedEvent).filter(
    (affectedBarangayId) => availableBarangayIds.has(affectedBarangayId),
  );
  const barangayPayloads = await Promise.all(
    affectedBarangayIds.map((affectedBarangayId) =>
      fetchBarangayStubDashboard({
        disasterEventId: eventId,
        barangayId: affectedBarangayId,
      }),
    ),
  );

  return barangayPayloads.flatMap((payload) =>
    Array.isArray(payload?.data) ? payload.data : [],
  );
};

const getStubIssuedDate = (stub) => {
  const timestamp = stub?.issued_at || stub?.created_at || "";
  const parsedDate = new Date(timestamp);

  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
};

const getStubFamilyHeadName = (stub) =>
  String(stub?.household?.family_head_name || "").trim();

const getStubSequenceNumber = (stub) => {
  const displayValue = String(stub?.display_stub_no || "");
  const displayMatch = displayValue.match(/\d+/);

  if (displayMatch) {
    return Number(displayMatch[0]);
  }

  return Number(stub?.stub_sequence_no || stub?.stub_number || 0);
};

const matchesPrintStatus = (row, statusFilter) => {
  if (!statusFilter) {
    return true;
  }

  if (statusFilter === "CLAIMED") {
    return String(row?.status || "").toUpperCase() === "CLAIMED";
  }

  if (statusFilter === "ISSUED") {
    return (
      String(row?.status || "").toUpperCase() === "ISSUED" &&
      ["FOR_CLAIM", "NOT_PRESENT"].includes(
        String(row?.presentation_status || "").toUpperCase(),
      )
    );
  }

  return String(row?.status || "").toUpperCase() === statusFilter;
};

const sortStubDetails = (stubDetails, sortOrder) => {
  return [...stubDetails].sort((left, right) => {
    if (sortOrder === "newest_oldest") {
      return getStubIssuedDate(right) - getStubIssuedDate(left);
    }

    if (sortOrder === "oldest_newest") {
      return getStubIssuedDate(left) - getStubIssuedDate(right);
    }

    if (sortOrder === "az" || sortOrder === "za") {
      const compareResult = getStubFamilyHeadName(left).localeCompare(
        getStubFamilyHeadName(right),
      );

      return sortOrder === "az" ? compareResult : -compareResult;
    }

    return getStubSequenceNumber(left) - getStubSequenceNumber(right);
  });
};

const waitForRenderedQrCodes = async (containerElement) => {
  await new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });

  const deadline = Date.now() + 4000;

  while (Date.now() < deadline) {
    const images = Array.from(containerElement?.querySelectorAll("img") || []);
    const allImagesReady =
      images.length > 0 && images.every((image) => image.complete);

    if (allImagesReady) {
      break;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 120));
  }

  await new Promise((resolve) => window.setTimeout(resolve, 200));
};

const PrintStubsPage = () => {
  const [searchParams] = useSearchParams();
  const [stubDetails, setStubDetails] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasTriggeredAutoPrint, setHasTriggeredAutoPrint] = useState(false);
  const printableRootRef = useRef(null);

  const requestedStubIds = useMemo(
    () => parseStubIds(searchParams.get("stubIds")),
    [searchParams],
  );
  const eventId = searchParams.get("eventId") || "";
  const barangayId = searchParams.get("barangayId") || "";
  const statusFilter = (searchParams.get("status") || "").toUpperCase();
  const sortOrder = searchParams.get("sort_order") || "oldest_newest";

  useEffect(() => {
    let isMounted = true;

    const loadPrintableStubs = async () => {
      setIsLoading(true);
      setErrorMessage("");
      setHasTriggeredAutoPrint(false);

      try {
        let stubIdsToLoad = requestedStubIds;

        if (stubIdsToLoad.length === 0) {
          if (!eventId || !barangayId) {
            throw new Error("No printable stub request was provided.");
          }

          const dashboardRows = await getDashboardRowsForPrint({
            eventId,
            barangayId,
          });

          stubIdsToLoad = dashboardRows
            .filter((row) => matchesPrintStatus(row, statusFilter))
            .map((row) => row.id)
            .filter(Boolean);
        }

        if (stubIdsToLoad.length === 0) {
          throw new Error("No printable stub data is available for this request.");
        }

        const loadedStubDetails = await Promise.all(
          stubIdsToLoad.map((stubId) => fetchStubDetails(stubId)),
        );

        const printableStubDetails = sortStubDetails(
          loadedStubDetails.filter(Boolean),
          sortOrder,
        );

        if (!printableStubDetails.length) {
          throw new Error("No printable stub data is available for this request.");
        }

        if (isMounted) {
          setStubDetails(printableStubDetails);
        }
      } catch (error) {
        if (isMounted) {
          setStubDetails([]);
          setErrorMessage(
            error.message || "Unable to load the printable stub page.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPrintableStubs();

    return () => {
      isMounted = false;
    };
  }, [barangayId, eventId, requestedStubIds, sortOrder, statusFilter]);

  useEffect(() => {
    if (isLoading || errorMessage || !stubDetails.length || hasTriggeredAutoPrint) {
      return;
    }

    let isCancelled = false;

    const triggerPrint = async () => {
      await waitForRenderedQrCodes(printableRootRef.current);

      if (isCancelled) {
        return;
      }

      window.print();
      setHasTriggeredAutoPrint(true);
    };

    triggerPrint();

    return () => {
      isCancelled = true;
    };
  }, [errorMessage, hasTriggeredAutoPrint, isLoading, stubDetails]);

  return (
    <div className="stub-print-page" style={pageStyles.page}>
      <style>{printStyles}</style>

      <div className="stub-print-page__content" style={pageStyles.content}>
        <section className="stub-print-toolbar" style={pageStyles.toolbar}>
          <div>
            <h1 style={pageStyles.toolbarTitle}>Printable Relief Claim Stubs</h1>
            <p style={pageStyles.toolbarText}>
              Review the stub details and QR codes below. Use the print button if
              automatic printing does not start.
            </p>
          </div>

          <div style={pageStyles.toolbarActions}>
            <button
              type="button"
              onClick={() => window.print()}
              style={{ ...pageStyles.button, ...pageStyles.primaryButton }}
            >
              <FiPrinter size={16} />
              Print
            </button>
            <button
              type="button"
              onClick={() => window.close()}
              style={pageStyles.button}
            >
              <FiX size={16} />
              Close
            </button>
          </div>
        </section>

        {isLoading ? (
          <section style={pageStyles.infoCard}>
            <p style={pageStyles.mutedText}>
              Loading printable stub data and rendering QR codes...
            </p>
          </section>
        ) : errorMessage ? (
          <section style={pageStyles.infoCard}>
            <p style={{ ...pageStyles.mutedText, color: "#a14d58" }}>
              {errorMessage}
            </p>
          </section>
        ) : (
          <main
            ref={printableRootRef}
            className="stub-print-grid"
            style={pageStyles.cards}
          >
            {stubDetails.map((stub) => {
              return (
                <article
                  key={stub.id}
                  className="stub-print-card"
                  style={pageStyles.card}
                >
                  <p style={pageStyles.eyebrow}>DISTYNC Stub</p>
                  <h2 style={pageStyles.stubNumber}>
                    {stub.display_stub_no || "--"}
                  </h2>

                  <div style={pageStyles.qrColumn}>
                    <div style={pageStyles.qrWrap}>
                      <QrCodePanel
                        value={stub.qr_code_value}
                        emptyLabel="No QR available"
                        showValue={false}
                        imageStyle={{
                          borderRadius: "6px",
                          padding: "5px",
                        }}
                      />
                    </div>
                  </div>
                  <p style={pageStyles.familyHead}>
                    {stub.household?.family_head_name || "--"}
                  </p>
                </article>
              );
            })}
          </main>
        )}
      </div>
    </div>
  );
};

export default PrintStubsPage;
