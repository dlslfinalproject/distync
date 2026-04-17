import React, { useState } from "react";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import MswdoHouseholdDetailModal from "../../components/mswdo-masterlist/MswdoHouseholdDetailModal";
import MswdoMasterlistTable from "../../components/mswdo-masterlist/MswdoMasterlistTable";
import MswdoMasterlistToolbar from "../../components/mswdo-masterlist/MswdoMasterlistToolbar";
import MswdoSummaryCards from "../../components/mswdo-masterlist/MswdoSummaryCards";
import { useMswdoMasterlist } from "../../features/mswdo-masterlist/useMswdoMasterlist";

const ConsolidatedEvacueeMasterlist = () => {
  const {
    disasterEvents,
    barangays,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedDisasterEvent,
    searchTerm,
    displayedRows,
    summary,
    selectedHousehold,
    isDetailOpen,
    isLoadingFilters,
    isLoadingMasterlist,
    errorMessage,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSearchTerm,
    openHouseholdDetail,
    closeHouseholdDetail,
  } = useMswdoMasterlist();

  const [activeTab, setActiveTab] = useState("active"); // 'active' | 'ended'

  const activeEventLabel = selectedDisasterEvent
    ? `${selectedDisasterEvent.event_code} - ${selectedDisasterEvent.title}`
    : "No disaster event selected";

  return (
    <>
      {/* Header */}
      <PageHeader title="EVACUEE MASTERLIST" />

      {/* Tabs Section */}
      <div style={{ display: "flex", gap: "24px", margin: "20px 0", borderBottom: "1px solid #d3dce6" }}>
        {["active", "ended"].map((tab) => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 0",
              cursor: "pointer",
              fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? "#17324d" : "#8a9eb1",
              borderBottom: activeTab === tab ? "3px solid #17324d" : "3px solid transparent",
            }}
          >
            {tab === "active" ? "ACTIVE EVENTS" : "ENDED EVENTS"}
          </div>
        ))}
      </div>

      {/* Top Control Panel */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
        {/* Active Disaster Event Dropdown */}
        <select
          value={selectedDisasterEventId || ""}
          onChange={(e) => setSelectedDisasterEventId(e.target.value)}
          style={{
            flex: 1,
            minWidth: "220px",
            padding: "10px 12px",
            borderRadius: "10px",
            border: "1px solid #d3dfec",
            fontSize: "14px",
          }}
        >
          <option value="">-- Select Active Disaster Event --</option>
          {disasterEvents.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title}
            </option>
          ))}
        </select>

        {/* Effective Barangay Card */}
        <div
          style={{
            flex: 1,
            minWidth: "200px",
            backgroundColor: "#f8fbfe",
            borderRadius: "12px",
            padding: "12px 16px",
            fontSize: "14px",
            color: "#334155",
          }}
        >
          {selectedBarangayId
            ? barangays.find((b) => b.id === selectedBarangayId)?.name
            : "All Barangays"}
        </div>

        {/* Development Fallback Barangay Dropdown */}
        <select
          value={selectedBarangayId || ""}
          onChange={(e) => setSelectedBarangayId(e.target.value)}
          style={{
            flex: 1,
            minWidth: "220px",
            padding: "10px 12px",
            borderRadius: "10px",
            border: "1px solid #d3dfec",
            fontSize: "14px",
          }}
        >
          <option value="">-- Select Fallback Barangay --</option>
          {barangays.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Event Information Card */}
      {selectedDisasterEvent && (
        <div
          style={{
            borderRadius: "16px",
            background: "#f8fafc",
            padding: "16px 20px",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ margin: "0 0 8px", fontWeight: 700 }}>{activeEventLabel}</h3>
          <div style={{ display: "flex", gap: "16px", fontSize: "14px", color: "#334155" }}>
            <span>{selectedDisasterEvent.start_date} - {selectedDisasterEvent.end_date}</span>
            <span>Status: {selectedDisasterEvent.status}</span>
          </div>
        </div>
      )}

      {/* Analytics Cards Section */}
      <MswdoSummaryCards summary={summary} />

      {/* Search and Actions Row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "20px 0",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="Search family head, address, or sectors"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            minWidth: "220px",
            padding: "10px 12px",
            borderRadius: "10px",
            border: "1px solid #d3dfec",
            fontSize: "14px",
          }}
        />
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            style={{
              border: "1px solid #d3dfec",
              background: "#f8fbfe",
              padding: "10px 14px",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            Filter
          </button>
          <button
            style={{
              background: "#0c4a6e",
              color: "#fff",
              fontWeight: 600,
              padding: "10px 16px",
              borderRadius: "10px",
              cursor: "pointer",
            }}
          >
            Register Family
          </button>
        </div>
      </div>

      {/* Table Section */}
      <section style={{ ...shellStyles.card, overflow: "hidden" }}>
        <h4 style={{ marginBottom: "12px", fontWeight: 700 }}>Registered Family</h4>
        <div style={{ width: "100%", overflowX: "auto" }}>
          <MswdoMasterlistTable
            rows={displayedRows}
            hasSelectedEvent={Boolean(selectedDisasterEventId)}
            isLoading={isLoadingFilters || isLoadingMasterlist}
            errorMessage={errorMessage}
            onViewHousehold={openHouseholdDetail}
          />
        </div>
      </section>

      {/* Household Detail Modal */}
      <MswdoHouseholdDetailModal
        isOpen={isDetailOpen}
        household={selectedHousehold}
        onClose={closeHouseholdDetail}
      />
    </>
  );
};

export default ConsolidatedEvacueeMasterlist;