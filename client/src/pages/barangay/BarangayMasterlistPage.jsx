import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import MasterlistTable from "../../components/masterlist/MasterlistTable";
import MasterlistToolbar from "../../components/masterlist/MasterlistToolbar";
import StatusCard from "../../components/shared/StatusCard";
import { useMasterlist } from "../../features/masterlist/masterlistHooks";
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
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  const disasterEventId = searchParams.get("disaster_event_id");
  const barangayId = searchParams.get("barangay_id");

  const { data, isLoading, errorMessage, reloadMasterlist } = useMasterlist({
    disasterEventId,
    barangayId,
  });

  const registrationForm = useHouseholdRegistrationForm({
    isOpen: isRegisterModalOpen,
    defaultBarangayId: barangayId,
    defaultDisasterEventId: disasterEventId,
    onSuccess: () => {
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

  return (
    <>
      <PageHeader
        eyebrow="Barangay Workspace"
        title="EVACUEE MASTERLIST"
        description="Review registered families, household sectors, and attendance summaries for the selected disaster event."
        actions={[
          {
            label: "Register Family",
            onClick: () => setIsRegisterModalOpen(true),
          },
        ]}
      />

      <section style={shellStyles.card}>
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
              Active Disaster Event
            </p>
            <h3
              style={{
                margin: "10px 0 0",
                color: "#17324d",
                fontSize: "24px",
              }}
            >
              {activeEventLabel}
            </h3>
          </div>
          <div
            style={{
              border: "1px solid #d6e2ef",
              borderRadius: "14px",
              padding: "12px 14px",
              backgroundColor: "#f8fbfe",
              color: "#64809a",
              fontSize: "14px",
              minWidth: "220px",
            }}
          >
            {barangayId
              ? `Barangay filter applied: ${barangayId}`
              : "No barangay filter applied"}
          </div>
        </div>
      </section>

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
