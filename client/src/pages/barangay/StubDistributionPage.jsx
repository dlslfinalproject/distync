import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import BarangayDashboardOverview from "../../components/barangay-dashboard/BarangayDashboardOverview";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import { pageHeaderStyles } from "../../components/layout/PageHeader";
import StatusCard from "../../components/shared/StatusCard";
import StubSearchBar from "../../components/stubs/StubSearchBar";
import StubResultsTable from "../../components/stubs/StubResultsTable";
import StubVerificationResult from "../../components/stubs/StubVerificationResult";
import { useAuth } from "../../context/AuthContext";
import { useBarangayDashboard } from "../../features/barangay-dashboard/useBarangayDashboard";
import { searchStubs, verifyStub } from "../../features/stubs/stubService";

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
  const { authenticatedUser } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStub, setSelectedStub] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const {
    accessMode,
    allowFallback,
    eventScope,
    selectedDisasterEventId,
    overrideBarangayId,
    assignedBarangay,
    availableEvents,
    selectedEvent,
    summaryCards,
    devBarangayOptions,
    isLoading,
    errorMessage,
    errorCode,
    hasData,
    hasAssignedBarangay,
    hasSelectedEvent,
    hasEvents,
    isDevOverride,
    setEventScope,
    setSelectedDisasterEventId,
    setOverrideBarangayId,
  } = useBarangayDashboard({
    userId: authenticatedUser?.id || "",
  });

  useEffect(() => {
    setSearchResults([]);
    setSelectedStub(null);
    setVerificationResult(null);
    setHasSearched(false);
    setSearchError("");
  }, [assignedBarangay?.id, selectedEvent?.id]);

  const handleSearch = async (value) => {
    const currentQuery = value || searchTerm;
    if (!currentQuery.trim()) return;
    if (!selectedEvent?.id || !assignedBarangay?.id) {
      setSearchError("Select a disaster event to search available stubs.");
      setHasSearched(true);
      return;
    }

    setIsSearching(true);
    setSearchError("");
    try {
      const response = await searchStubs({
        query: currentQuery,
        disasterEventId: selectedEvent?.id || "",
        barangayId: assignedBarangay?.id || "",
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

  return (
    <>
      <PageHeader title="STUB DISTRIBUTION" />

      <BarangayDashboardOverview
        accessMode={accessMode}
        allowFallback={allowFallback}
        eventScope={eventScope}
        selectedDisasterEventId={selectedDisasterEventId}
        overrideBarangayId={overrideBarangayId}
        assignedBarangay={assignedBarangay}
        availableEvents={availableEvents}
        selectedEvent={selectedEvent}
        summaryCards={summaryCards}
        devBarangayOptions={devBarangayOptions}
        isLoading={isLoading}
        errorMessage={errorMessage}
        errorCode={errorCode}
        hasSelectedEvent={hasSelectedEvent}
        hasEvents={hasEvents}
        hasData={hasData}
        hasAssignedBarangay={hasAssignedBarangay}
        isDevOverride={isDevOverride}
        setEventScope={setEventScope}
        setSelectedDisasterEventId={setSelectedDisasterEventId}
        setOverrideBarangayId={setOverrideBarangayId}
      />

      <section style={shellStyles.statGrid}>
        <StatusCard label="Stub Status" value={selectedStatus} helperText="Current status of the selected stub." />
        <StatusCard label="Household Summary" value={getHouseholdSummaryText(selectedStub)} helperText="Family head and number of members." />
        <StatusCard label="Next Action" value={getNextActionText(verificationResult, selectedStub)} helperText="Next step for this stub." />
      </section>

      <section style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <StubSearchBar
            searchValue={searchTerm}
            onSearchChange={(value) => {
              setSearchTerm(value);
              handleSearch(value);
            }}
            placeholder="Search stub number, serial, or family head"
          />
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
            <button onClick={handleProceedToDistribution} style={{ ...pageHeaderStyles.primaryButton }}>Proceed to Distribution</button>
          </div>
        </section>
      )}
    </>
  );
};

export default StubDistributionPage;
