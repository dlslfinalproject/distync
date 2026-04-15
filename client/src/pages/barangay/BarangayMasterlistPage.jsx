import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import MasterlistTable from "../../components/masterlist/MasterlistTable";
import MasterlistToolbar from "../../components/masterlist/MasterlistToolbar";
import StatusCard from "../../components/shared/StatusCard";
import { useMasterlist } from "../../features/masterlist/masterlistHooks";
import {
  fetchActiveDisasterEvents,
  fetchEndedDisasterEvents,
  fetchBarangays,
} from "../../features/masterlist/masterlistService";
import RegisterFamilyModal from "../../components/household-registration/RegisterFamilyModal";
import { useHouseholdRegistrationForm } from "../../features/household-registration/useHouseholdRegistrationForm";

const getFilteredRows = (rows, searchTerm) => {
  if (!searchTerm.trim()) {
    return rows;
  }

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  return rows.filter((row) => {
    const searchableValues = [
      row.family_head_name,
      row.address,
      row.sectors_text,
      row.arrival_time_text,
      row.departure_time_text,
    ];

    return searchableValues.some((value) =>
      value.toLowerCase().includes(normalizedSearchTerm),
    );
  });
};

const formatSummaryValue = (value) => {
  return String(value).padStart(2, "0");
};

const BarangayMasterlistPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [activeDisasterEvents, setActiveDisasterEvents] = useState([]);
  const [endedDisasterEvents, setEndedDisasterEvents] = useState([]);
  const [activeTab, setActiveTab] = useState("active");
  const [barangays, setBarangays] = useState([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [filterErrorMessage, setFilterErrorMessage] = useState("");
  const [registrationSuccessMessage, setRegistrationSuccessMessage] =
    useState("");

  const disasterEventId = searchParams.get("disaster_event_id");
  const barangayId = searchParams.get("barangay_id");

  useEffect(() => {
    let isMounted = true;

    const loadFilterOptions = async () => {
      setIsLoadingFilters(true);
      setFilterErrorMessage("");

      try {
        const [activePayload, endedPayload, barangaysPayload] =
          await Promise.all([
            fetchActiveDisasterEvents(),
            fetchEndedDisasterEvents(),
            fetchBarangays(),
          ]);

        if (!isMounted) {
          return;
        }

        const activeEvents = Array.isArray(activePayload) ? activePayload : [];
        const endedEvents = Array.isArray(endedPayload) ? endedPayload : [];
        const availableBarangays = Array.isArray(barangaysPayload)
          ? barangaysPayload
          : [];

        setActiveDisasterEvents(activeEvents);
        setEndedDisasterEvents(endedEvents);
        setBarangays(availableBarangays);

        // Auto-select the first active event if none is selected
        if (!searchParams.get("disaster_event_id") && activeEvents.length > 0) {
          const nextParams = new URLSearchParams(searchParams);
          nextParams.set("disaster_event_id", activeEvents[0].id);
          setSearchParams(nextParams, { replace: true });
        }
      } catch (error) {
        if (isMounted) {
          setFilterErrorMessage(
            error.message || "Failed to load barangay masterlist filters",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingFilters(false);
        }
      }
    };

    loadFilterOptions();

    return () => {
      isMounted = false;
    };
  }, [searchParams, setSearchParams]);

  const { data, isLoading, errorMessage, reloadMasterlist } = useMasterlist({
    disasterEventId,
    barangayId,
  });

  const registrationForm = useHouseholdRegistrationForm({
    isOpen: isRegisterModalOpen,
    defaultBarangayId: barangayId,
    defaultDisasterEventId: disasterEventId,
    onSuccess: (response) => {
      setRegistrationSuccessMessage(
        response?.message || "Household registered successfully",
      );
      reloadMasterlist();
    },
  });

  const filteredRows = useMemo(() => {
    return getFilteredRows(data.rows, searchTerm);
  }, [data.rows, searchTerm]);

  const activeEventLabel = data.disasterEvent
    ? `${data.disasterEvent.event_code} - ${data.disasterEvent.title}`
    : "No disaster event selected";

  const summaryCards = [
    {
      label: "Registered Families",
      value: formatSummaryValue(data.summary.registeredFamilies),
      helperText: "Total household records returned by the selected event.",
    },
    {
      label: "Total Members",
      value: formatSummaryValue(data.summary.totalMembers),
      helperText: "Combined evacuee count from all listed households.",
    },
    {
      label: "With Attendance",
      value: formatSummaryValue(data.summary.withAttendance),
      helperText: "Households that already have latest attendance data.",
    },
  ];

  const handleDisasterEventChange = (value) => {
    const nextParams = new URLSearchParams(searchParams);

    if (value) {
      nextParams.set("disaster_event_id", value);
    } else {
      nextParams.delete("disaster_event_id");
    }

    setSearchParams(nextParams, { replace: true });
  };

  const handleBarangayChange = (value) => {
    const nextParams = new URLSearchParams(searchParams);

    if (value) {
      nextParams.set("barangay_id", value);
    } else {
      nextParams.delete("barangay_id");
    }

    setSearchParams(nextParams, { replace: true });
  };

  return (
    <>
      <PageHeader
        eyebrow="Barangay Workspace"
        title="EVACUEE MASTERLIST"
        description="Review registered families, household sectors, and attendance summaries for the selected disaster event."
        actions={
          activeTab === "active"
            ? [
                {
                  label: "Register Family",
                  onClick: () => setIsRegisterModalOpen(true),
                },
              ]
            : []
        }
      />

      <section style={shellStyles.card}>
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #d6e2ef",
            marginBottom: "24px",
            gap: "8px",
          }}
        >
          <button
            onClick={() => setActiveTab("active")}
            style={{
              padding: "12px 24px",
              border: "none",
              background: "none",
              fontSize: "14px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: activeTab === "active" ? "#17324d" : "#6b8298",
              borderBottom:
                activeTab === "active"
                  ? "3px solid #17324d"
                  : "3px solid transparent",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Active Event
          </button>
          <button
            onClick={() => setActiveTab("ended")}
            style={{
              padding: "12px 24px",
              border: "none",
              background: "none",
              fontSize: "14px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: activeTab === "ended" ? "#17324d" : "#6b8298",
              borderBottom:
                activeTab === "ended"
                  ? "3px solid #17324d"
                  : "3px solid transparent",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Ended Event
          </button>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                color: "#6b8298",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {activeTab === "active" ? "Active" : "Completed"} Disaster Event
            </p>
            <h3
              style={{
                margin: "10px 0 0",
                color: "#17324d",
                fontSize: "24px",
              }}
            >
              {activeEventLabel}
              {activeTab === "active" && data.disasterEvent && (
                <span
                  style={{
                    marginLeft: "12px",
                    fontSize: "12px",
                    backgroundColor: "#e3f9e5",
                    color: "#2f6c47",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    verticalAlign: "middle",
                  }}
                >
                  ACTIVE
                </span>
              )}
            </h3>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
              minWidth: "320px",
            }}
          >
            <select
              value={disasterEventId || ""}
              onChange={(event) =>
                handleDisasterEventChange(event.target.value)
              }
              disabled={isLoadingFilters}
              style={{
                minHeight: "46px",
                borderRadius: "12px",
                border: "1px solid #d6e2ef",
                padding: "10px 12px",
                backgroundColor: "#f8fbfe",
                color: "#21405f",
                fontSize: "14px",
              }}
            >
              <option value="">Select {activeTab} disaster event</option>
              {(activeTab === "active"
                ? activeDisasterEvents
                : endedDisasterEvents
              ).map((eventItem) => (
                <option key={eventItem.id} value={eventItem.id}>
                  {eventItem.event_code} - {eventItem.title}
                </option>
              ))}
            </select>

            <select
              value={barangayId || ""}
              onChange={(event) => handleBarangayChange(event.target.value)}
              disabled={isLoadingFilters}
              style={{
                minHeight: "46px",
                borderRadius: "12px",
                border: "1px solid #d6e2ef",
                padding: "10px 12px",
                backgroundColor: "#f8fbfe",
                color: "#21405f",
                fontSize: "14px",
              }}
            >
              <option value="">All barangays</option>
              {barangays.map((barangayItem) => (
                <option key={barangayItem.id} value={barangayItem.id}>
                  {barangayItem.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filterErrorMessage ? (
          <p
            style={{
              ...shellStyles.mutedText,
              marginTop: "16px",
              color: "#a14d58",
            }}
          >
            {filterErrorMessage}
          </p>
        ) : null}
      </section>

      {registrationSuccessMessage ? (
        <section style={shellStyles.card}>
          <p
            style={{
              margin: 0,
              color: "#2f6c47",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            {registrationSuccessMessage}
          </p>
        </section>
      ) : null}

      <section style={shellStyles.statGrid}>
        {summaryCards.map((card) => (
          <StatusCard
            key={card.label}
            label={card.label}
            value={card.value}
            helperText={card.helperText}
          />
        ))}
      </section>

      <MasterlistToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        onOpenRegisterFamily={() => setIsRegisterModalOpen(true)}
        hideRegisterButton={activeTab === "ended"}
      />

      <MasterlistTable
        rows={filteredRows}
        isLoading={isLoading}
        errorMessage={errorMessage}
        hasSelectedEvent={Boolean(disasterEventId)}
      />

      <RegisterFamilyModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        form={registrationForm}
      />
    </>
  );
};

export default BarangayMasterlistPage;