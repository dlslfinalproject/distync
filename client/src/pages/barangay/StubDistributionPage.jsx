import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import StubSearchBar from "../../components/stubs/StubSearchBar";
import StubResultsTable from "../../components/stubs/StubResultsTable";
import StubVerificationResult from "../../components/stubs/StubVerificationResult";
import { searchStubs, verifyStub } from "../../features/stubs/stubService";
import { 
  fetchActiveDisasterEvents, 
  fetchEndedDisasterEvents, 
  fetchBarangays 
} from "../../features/masterlist/masterlistService";

const infoCardStyles = {
  label: {
    margin: 0,
    color: "#6b8197",
    fontSize: "13px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  value: {
    margin: "10px 0 0",
    color: "#17324d",
    fontSize: "20px",
    fontWeight: 700,
  },
};

const getHouseholdSummaryText = (selectedStub) => {
  if (!selectedStub) return "No stub selected";
  return `${selectedStub.household.family_head_name} (${selectedStub.household.members_count || 0} members)`;
};

const getNextActionText = (verificationResult, selectedStub) => {
  if (verificationResult?.is_claimable) return "Ready to proceed";
  if (verificationResult && !verificationResult.is_claimable) return "Review verification result";
  if (selectedStub) return "Ready for verification";
  return "Select a stub";
};

const StubDistributionPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Tab and Filter States
  const [activeTab, setActiveTab] = useState("active");
  const [activeDisasterEvents, setActiveDisasterEvents] = useState([]);
  const [endedDisasterEvents, setEndedDisasterEvents] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [filterErrorMessage, setFilterErrorMessage] = useState("");

  // Search and Verification States
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStub, setSelectedStub] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const disasterEventId = searchParams.get("disaster_event_id");
  const barangayId = searchParams.get("barangay_id");

  // Load Initial Filter Data
  useEffect(() => {
    let isMounted = true;
    const loadFilters = async () => {
      setIsLoadingFilters(true);
      try {
        const [active, ended, brgy] = await Promise.all([
          fetchActiveDisasterEvents(),
          fetchEndedDisasterEvents(),
          fetchBarangays(),
        ]);

        if (!isMounted) return;

        setActiveDisasterEvents(Array.isArray(active) ? active : []);
        setEndedDisasterEvents(Array.isArray(ended) ? ended : []);
        setBarangays(Array.isArray(brgy) ? brgy : []);

        if (!searchParams.get("disaster_event_id") && active.length > 0) {
          handleDisasterEventChange(active[0].id);
        }
      } catch (error) {
        if (isMounted) setFilterErrorMessage(error.message);
      } finally {
        if (isMounted) setIsLoadingFilters(false);
      }
    };
    loadFilters();
    return () => { isMounted = false; };
  }, []);

  const handleDisasterEventChange = (value) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set("disaster_event_id", value);
    else nextParams.delete("disaster_event_id");
    setSearchParams(nextParams, { replace: true });
    
    // Clear results when event changes
    setSearchResults([]);
    setSelectedStub(null);
    setVerificationResult(null);
    setHasSearched(false);
  };

  const handleBarangayChange = (value) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set("barangay_id", value);
    else nextParams.delete("barangay_id");
    setSearchParams(nextParams, { replace: true });
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchError("Enter a stub number, serial number, or family head.");
      return;
    }
    setIsSearching(true);
    setSearchError("");
    setVerificationResult(null);
    try {
      const response = await searchStubs({
        query: searchTerm,
        disasterEventId,
        barangayId,
      });
      setSearchResults(response.data || []);
      setSelectedStub(response.data?.[0] || null);
      setHasSearched(true);
    } catch (error) {
      setSearchError(error.message);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleVerifySelected = async () => {
    if (!selectedStub) return;
    setIsVerifying(true);
    try {
      const response = await verifyStub({ stubNo: selectedStub.stub_no });
      setVerificationResult({ message: response.message, ...response.data });
    } catch (error) {
      setVerificationResult({ is_valid: false, is_claimable: false, message: error.message });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleProceedToDistribution = () => {
    if (!selectedStub || !verificationResult?.is_claimable) return;
    navigate("/barangay/distribution-transaction", {
      state: { stubContext: { ...selectedStub, family_head_name: selectedStub.household.family_head_name } },
    });
  };

  const selectedStatus = selectedStub?.status || "Waiting for input";
  const activeEvent = (activeTab === "active" ? activeDisasterEvents : endedDisasterEvents)
    .find(e => e.id === disasterEventId);
  const activeEventLabel = activeEvent ? `${activeEvent.event_code} - ${activeEvent.title}` : "No disaster event selected";

  return (
    <>
      <PageHeader
        eyebrow="Barangay Workspace"
        title="STUB DISTRIBUTION"
        description="Search, verify, and release relief items in one synchronized workflow."
      />

      <section style={shellStyles.card}>
        {/* Tab Navigation */}
        <div style={{ display: "flex", borderBottom: "1px solid #d6e2ef", marginBottom: "24px", gap: "8px" }}>
          <button
            onClick={() => setActiveTab("active")}
            style={{
              padding: "12px 24px", border: "none", background: "none", fontSize: "14px", fontWeight: 700,
              textTransform: "uppercase", color: activeTab === "active" ? "#17324d" : "#6b8298",
              borderBottom: activeTab === "active" ? "3px solid #17324d" : "3px solid transparent", cursor: "pointer"
            }}
          >
            Active Event
          </button>
          <button
            onClick={() => setActiveTab("ended")}
            style={{
              padding: "12px 24px", border: "none", background: "none", fontSize: "14px", fontWeight: 700,
              textTransform: "uppercase", color: activeTab === "ended" ? "#17324d" : "#6b8298",
              borderBottom: activeTab === "ended" ? "3px solid #17324d" : "3px solid transparent", cursor: "pointer"
            }}
          >
            Ended Event
          </button>
        </div>

        {/* Dropdowns */}
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <p style={{ margin: 0, color: "#6b8298", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" }}>
              {activeTab === "active" ? "Active" : "Completed"} Disaster Event
            </p>
            <h3 style={{ margin: "10px 0 0", color: "#17324d", fontSize: "24px" }}>
              {activeEventLabel}
              {activeTab === "active" && activeEvent && (
                <span style={{ marginLeft: "12px", fontSize: "12px", backgroundColor: "#e3f9e5", color: "#2f6c47", padding: "4px 8px", borderRadius: "6px" }}>ACTIVE</span>
              )}
            </h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", minWidth: "320px" }}>
            <select value={disasterEventId || ""} onChange={(e) => handleDisasterEventChange(e.target.value)} disabled={isLoadingFilters}>
              <option value="">Select {activeTab} event</option>
              {(activeTab === "active" ? activeDisasterEvents : endedDisasterEvents).map(e => (
                <option key={e.id} value={e.id}>{e.event_code} - {e.title}</option>
              ))}
            </select>
            <select value={barangayId || ""} onChange={(e) => handleBarangayChange(e.target.value)} disabled={isLoadingFilters}>
              <option value="">All barangays</option>
              {barangays.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
      </section>

      <StubSearchBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        onSearchSubmit={handleSearch}
        isSearching={isSearching}
      />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "18px" }}>
        <div style={shellStyles.card}>
          <p style={infoCardStyles.label}>Stub Status</p>
          <p style={infoCardStyles.value}>{selectedStatus}</p>
        </div>
        <div style={shellStyles.card}>
          <p style={infoCardStyles.label}>Household Summary</p>
          <p style={infoCardStyles.value}>{getHouseholdSummaryText(selectedStub)}</p>
        </div>
        <div style={shellStyles.card}>
          <p style={infoCardStyles.label}>Next Action</p>
          <p style={infoCardStyles.value}>{getNextActionText(verificationResult, selectedStub)}</p>
        </div>
      </section>

      <StubResultsTable
        rows={searchResults}
        isLoading={isSearching}
        errorMessage={searchError}
        hasSearched={hasSearched}
        selectedStubId={selectedStub?.id || null}
        onSelectStub={setSelectedStub}
        onVerifySelected={handleVerifySelected}
        isVerifying={isVerifying}
      />

      <StubVerificationResult result={verificationResult} selectedStub={selectedStub} />

      {verificationResult?.is_claimable && (
        <section style={shellStyles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, color: "#17324d" }}>Ready for Distribution</h3>
              <p style={{ ...shellStyles.mutedText, marginTop: "8px" }}>This stub is claimable. Record the release of relief items.</p>
            </div>
            <button onClick={handleProceedToDistribution} style={{ borderRadius: "14px", padding: "12px 18px", background: "#2f6499", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>
              Proceed to Distribution
            </button>
          </div>
        </section>
      )}
    </>
  );
};

export default StubDistributionPage;