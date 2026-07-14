import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiPrinter, FiX } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import QrCodePanel from "../../components/stubs/QrCodePanel";
import {
  fetchBarangayStubDashboard,
  fetchStubDetails,
} from "../../features/stubs/stubService";

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
      gap: 4mm !important;
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
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #17324d",
    borderRadius: "10px",
    padding: "12px",
    boxShadow: "0 6px 16px rgba(76, 101, 132, 0.08)",
    display: "grid",
    gap: "10px",
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
    fontSize: "18px",
    fontWeight: 800,
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
    maxWidth: "180px",
  },
};

const parseStubIds = (value) => {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const sortStubDetails = (stubDetails) => {
  return [...stubDetails].sort((left, right) => {
    const leftValue = left?.display_stub_no || "";
    const rightValue = right?.display_stub_no || "";

    return leftValue.localeCompare(rightValue);
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

          const dashboardPayload = await fetchBarangayStubDashboard({
            userId: null,
            disasterEventId: eventId,
            overrideBarangayId: barangayId,
          });

          const dashboardRows = Array.isArray(dashboardPayload?.data)
            ? dashboardPayload.data
            : [];

          stubIdsToLoad = dashboardRows
            .filter((row) => {
              if (!statusFilter) {
                return true;
              }

              return String(row.status || "").toUpperCase() === statusFilter;
            })
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
  }, [barangayId, eventId, requestedStubIds, statusFilter]);

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
                      />
                    </div>
                  </div>
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
