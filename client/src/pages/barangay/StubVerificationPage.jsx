import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import StubSearchBar from "../../components/stubs/StubSearchBar";
import StubResultsTable from "../../components/stubs/StubResultsTable";
import StubVerificationResult from "../../components/stubs/StubVerificationResult";
import { searchStubs, verifyStub } from "../../features/stubs/stubService";

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
  if (!selectedStub) {
    return "No stub selected";
  }

  return `${selectedStub.household.family_head_name} (${selectedStub.household.members_count} members)`;
};

const getNextActionText = (verificationResult, selectedStub) => {
  if (verificationResult?.is_claimable) {
    return "Ready to proceed";
  }

  if (verificationResult && !verificationResult.is_claimable) {
    return "Review verification result";
  }

  if (selectedStub) {
    return "Ready for verification";
  }

  return "Select a stub";
};

const StubVerificationPage = () => {
  const [searchParams] = useSearchParams();
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

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchError("Enter a stub number, serial number, or family head to search.");
      setSearchResults([]);
      setSelectedStub(null);
      setVerificationResult(null);
      setHasSearched(false);
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
      setSearchResults([]);
      setSelectedStub(null);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleVerifySelected = async () => {
    if (!selectedStub) {
      return;
    }

    setIsVerifying(true);
    setSearchError("");

    try {
      const response = await verifyStub({
        stubNo: selectedStub.stub_no,
        serialNo: null,
      });

      setVerificationResult({
        message: response.message,
        ...response.data,
      });
    } catch (error) {
      setVerificationResult({
        is_valid: false,
        is_claimable: false,
        message: error.message,
        reason: error.message,
        stub: null,
        household: null,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const selectedStatus = selectedStub?.status || "Waiting for input";
  const householdSummary = getHouseholdSummaryText(selectedStub);
  const nextAction = getNextActionText(verificationResult, selectedStub);

  return (
    <>
      <PageHeader
        eyebrow="Barangay Workspace"
        title="STUB VERIFICATION"
        description="Search issued stubs, select one result, and verify whether it is valid and claimable before release."
      />

      <StubSearchBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        onSearchSubmit={handleSearch}
        isSearching={isSearching}
      />

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "18px",
        }}
      >
        <div style={shellStyles.card}>
          <p style={infoCardStyles.label}>Stub Status</p>
          <p style={infoCardStyles.value}>{selectedStatus}</p>
          <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
            Current stub state from the search result list.
          </p>
        </div>

        <div style={shellStyles.card}>
          <p style={infoCardStyles.label}>Household Summary</p>
          <p style={infoCardStyles.value}>{householdSummary}</p>
          <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
            Family head and member count for the selected stub.
          </p>
        </div>

        <div style={shellStyles.card}>
          <p style={infoCardStyles.label}>Next Action</p>
          <p style={infoCardStyles.value}>{nextAction}</p>
          <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
            Use Verify Selected Stub to check if the claim can proceed.
          </p>
        </div>
      </section>

      <StubResultsTable
        rows={searchResults}
        isLoading={isSearching}
        errorMessage={searchError}
        hasSearched={hasSearched}
        selectedStubId={selectedStub?.id || null}
        onSelectStub={(stub) => {
          setSelectedStub(stub);
          setVerificationResult(null);
        }}
        onVerifySelected={handleVerifySelected}
        isVerifying={isVerifying}
      />

      <StubVerificationResult
        result={verificationResult}
        selectedStub={selectedStub}
      />
    </>
  );
};

export default StubVerificationPage;
