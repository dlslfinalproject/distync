import React from "react";
import RegisterFamilyModal from "../../components/household-registration/RegisterFamilyModal";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import HouseholdArchiveConfirmModal from "../../components/masterlist/HouseholdArchiveConfirmModal";
import HouseholdDetailModal from "../../components/masterlist/HouseholdDetailModal";
import MasterlistDepartureConfirmModal from "../../components/masterlist/MasterlistDepartureConfirmModal";
import MasterlistTable from "../../components/masterlist/MasterlistTable";
import MswdoMasterlistControls from "../../components/mswdo-masterlist/MswdoMasterlistControls";
import MswdoMasterlistEventSummary from "../../components/mswdo-masterlist/MswdoMasterlistEventSummary";
import MswdoMasterlistScopeSection from "../../components/mswdo-masterlist/MswdoMasterlistScopeSection";
import MswdoMasterlistSelectionBar from "../../components/mswdo-masterlist/MswdoMasterlistSelectionBar";
import MswdoSummaryCards from "../../components/mswdo-masterlist/MswdoSummaryCards";
import ExportModal from "../../components/shared/ExportModal";
import FeedbackToast from "../../components/shared/FeedbackToast";
import { useAuth } from "../../context/AuthContext";
import { useMswdoMasterlistPage } from "../../features/mswdo-masterlist/useMswdoMasterlistPage";
import { COMMON_EXPORT_FORMAT_OPTIONS } from "../../utils/exportHelpers";

const ConsolidatedEvacueeMasterlist = () => {
  const { authenticatedUser } = useAuth();
  const {
    disasterEvents,
    barangays,
    sectors,
    selectedDisasterEventId,
    selectedBarangayId,
    selectedDisasterEvent,
    searchTerm,
    displayedRows,
    summaryMetrics,
    isLoadingFilters,
    isLoadingMasterlist,
    isLoadingDashboard,
    errorMessage,
    dashboardErrorMessage,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSearchTerm,
  } = useMswdoMasterlistPage({ authenticatedUser });

  return (
    <>
      <PageHeader title="EVACUEE MASTERLIST MANAGEMENT" actions={[]} />

      <MswdoMasterlistScopeSection
        activeTab={activeTab}
        isLoadingFilters={isLoadingFilters}
        scopedDisasterEvents={scopedDisasterEvents}
        selectedDisasterEventId={selectedDisasterEventId}
        selectedBarangayId={selectedBarangayId}
        barangays={barangays}
        onEventScopeChange={handleEventScopeChange}
        onDisasterEventChange={setSelectedDisasterEventId}
        onBarangayChange={setSelectedBarangayId}
      />

      <MswdoMasterlistEventSummary
        activeEventLabel={activeEventLabel}
        selectedDisasterEvent={selectedDisasterEvent}
        isLoadingFilters={isLoadingFilters}
        reliefPeriodText={reliefPeriodText}
      />

      {selectedDisasterEvent && !isLoadingDashboard && !dashboardErrorMessage ? (
        <MswdoSummaryCards summary={summaryMetrics} />
      ) : null}

      {registrationSuccessMessage ? (
        <section style={shellStyles.card}>
          <p style={{ margin: 0, color: "#2f6c47", fontWeight: 700 }}>
            {registrationSuccessMessage}
          </p>
        </section>
      ) : null}

      {attendanceActionMessage ? (
        <section style={shellStyles.card}>
          <p style={{ margin: 0, color: "#24496e", fontWeight: 700 }}>
            {attendanceActionMessage}
          </p>
        </section>
      ) : null}

      {editHouseholdErrorMessage ? (
        <section style={shellStyles.card}>
          <p style={{ margin: 0, color: "#a14d58", fontWeight: 700 }}>
            {editHouseholdErrorMessage}
          </p>
        </section>
      ) : null}

      <MswdoMasterlistSelectionBar
        selectedCount={selectedHouseholds.length}
        isSubmitting={isRecordingDeparture}
        onConfirmDeparture={handleOpenBulkDepartureConfirmation}
      />

      <MswdoMasterlistControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterButtonRef={filterButtonRef}
        filterPanelRef={filterPanelRef}
        isFilterOpen={isFilterOpen}
        filterPanelPosition={filterPanelPosition}
        hasActiveSectorFilters={hasActiveSectorFilters}
        selectedSectorIds={selectedSectorIds}
        sectors={sectors}
        onToggleFilterOpen={() => setIsFilterOpen((currentValue) => !currentValue)}
        onToggleSectorFilter={toggleSectorFilter}
        onClearSectorFilters={clearSectorFilters}
        onApplySectorFilters={() => setIsFilterOpen(false)}
        canRegisterFamily={canRegisterFamily}
        selectedBarangayId={selectedBarangayId}
        onOpenRegisterModal={handleOpenRegisterModal}
        selectedDisasterEventId={selectedDisasterEventId}
        exportingFormat={exportingFormat}
        onOpenExportModal={() => {
          setSelectedExportFormat("csv");
          setExportFeedback({ type: "", message: "" });
          setIsExportModalOpen(true);
        }}
      />

      <MasterlistTable
        rows={displayedRows}
        hasSelectedEvent={Boolean(selectedDisasterEventId)}
        isLoading={isLoadingFilters || isLoadingMasterlist}
        errorMessage={errorMessage}
        onMarkDeparted={handleOpenDepartureConfirmation}
        onViewHousehold={handleOpenHouseholdDetails}
        onEditHousehold={handleOpenEditHousehold}
        onArchiveHousehold={handleOpenArchiveHousehold}
        isDepartureReadOnly={isEndedView}
        departureReadOnlyText={endedEventDateTimeText}
        selectedHouseholds={selectedHouseholds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
      />

      <MasterlistDepartureConfirmModal
        isOpen={Boolean(pendingDepartureHouseholdId) || isBulkDepartureConfirmOpen}
        isSubmitting={isRecordingDeparture}
        onCancel={handleCloseDepartureConfirmation}
        onConfirm={handleConfirmDeparture}
        selectedCount={isBulkDepartureConfirmOpen ? selectedHouseholds.length : 1}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        title="Export MSWDO Report"
        description="Choose the masterlist report format to generate."
        reportOptions={[
          {
            value: "MSWDO_MASTERLIST",
            label: "Consolidated Evacuee Masterlist",
          },
        ]}
        formatOptions={COMMON_EXPORT_FORMAT_OPTIONS}
        selectedReportType="MSWDO_MASTERLIST"
        selectedFormat={selectedExportFormat}
        isSubmitting={Boolean(exportingFormat)}
        onReportTypeChange={() => {}}
        onFormatChange={setSelectedExportFormat}
        onClose={() => {
          if (!exportingFormat) {
            setIsExportModalOpen(false);
          }
        }}
        onSubmit={() => handleExport(selectedExportFormat)}
      />

      <RegisterFamilyModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        form={registrationForm}
      />

      <RegisterFamilyModal
        isOpen={Boolean(editingHouseholdId)}
        onClose={handleCloseEditHousehold}
        form={editHouseholdForm}
      />

      <HouseholdDetailModal
        isOpen={Boolean(viewingHouseholdId)}
        isLoading={isLoadingHouseholdDetails}
        errorMessage={householdDetailsErrorMessage}
        householdDetails={householdDetails}
        onClose={handleCloseHouseholdDetails}
        onEditHousehold={handleEditHouseholdFromDetails}
      />

      <HouseholdArchiveConfirmModal
        isOpen={Boolean(pendingArchiveHouseholdId)}
        isSubmitting={isArchivingHousehold}
        archiveRemarks={archiveRemarks}
        onChangeArchiveRemarks={setArchiveRemarks}
        onCancel={handleCancelArchiveHousehold}
        onConfirm={handleConfirmArchiveHousehold}
      />

      <FeedbackToast
        type={exportFeedback.type}
        message={exportFeedback.message}
        onClose={() => setExportFeedback({ type: "", message: "" })}
      />
    </>
  );
};

export default ConsolidatedEvacueeMasterlist;
