import React from "react";
import RegisterFamilyModal from "../../components/household-registration/RegisterFamilyModal";
import PageHeader from "../../components/layout/PageHeader";
import { shellStyles } from "../../components/layout/BarangayLayout";
import HouseholdArchiveConfirmModal from "../../components/masterlist/HouseholdArchiveConfirmModal";
import HouseholdDetailModal from "../../components/masterlist/HouseholdDetailModal";
import MasterlistDepartureConfirmModal from "../../components/masterlist/MasterlistDepartureConfirmModal";
import MasterlistSelectionBar from "../../components/masterlist/MasterlistSelectionBar";
import MasterlistTable from "../../components/masterlist/MasterlistTable";
import MswdoMasterlistControls from "../../components/mswdo-masterlist/MswdoMasterlistControls";
import MswdoMasterlistEventSummary from "../../components/mswdo-masterlist/MswdoMasterlistEventSummary";
import MswdoMasterlistScopeSection from "../../components/mswdo-masterlist/MswdoMasterlistScopeSection";
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
    selectedRecordStatus,
    displayedRows,
    summaryMetrics,
    isLoadingFilters,
    isLoadingMasterlist,
    isLoadingDashboard,
    errorMessage,
    dashboardErrorMessage,
    activeTab,
    selectedHouseholds,
    pendingDepartureFamilyHeadName,
    pendingDepartureFamilyHeadPhotoUrl,
    pendingBulkDepartureHouseholds,
    isLoadingDepartureHouseholdDetails,
    isFilterOpen,
    filterPanelPosition,
    isExportModalOpen,
    exportingFormat,
    selectedExportFormat,
    isRegisterModalOpen,
    registrationSuccessMessage,
    attendanceActionMessage,
    viewingHouseholdId,
    editingHouseholdId,
    isLoadingHouseholdDetails,
    householdDetailsErrorMessage,
    editHouseholdErrorMessage,
    pendingRestoreHouseholdId,
    pendingRestoreHouseholdDetails,
    isLoadingRestoreHouseholdDetails,
    isRestoringHousehold,
    exportFeedback,
    filterButtonRef,
    filterPanelRef,
    selectedSectorIds,
    selectedSortOrder,
    activeEventLabel,
    reliefPeriodText,
    canRegisterFamily,
    isEndedView,
    endedEventDateTimeText,
    hasActiveSectorFilters,
    hasNonDefaultSort,
    scopedDisasterEvents,
    selectableBarangays,
    registrationForm,
    editHouseholdForm,
    setSelectedDisasterEventId,
    setSelectedBarangayId,
    setSearchTerm,
    setSelectedExportFormat,
    setExportFeedback,
    setIsExportModalOpen,
    setIsFilterOpen,
    handleEventScopeChange,
    handleRecordStatusChange,
    handleToggleSelect,
    handleSelectAll,
    handleOpenBulkDepartureConfirmation,
    handleOpenDepartureConfirmation,
    handleCloseDepartureConfirmation,
    handleConfirmDeparture,
    handleOpenRegisterModal,
    handleCloseRegisterModal,
    handleOpenHouseholdDetails,
    handleCloseHouseholdDetails,
    handleOpenEditHousehold,
    handleEditHouseholdFromDetails,
    handleCloseEditHousehold,
    handleOpenRestoreHousehold,
    handleCancelRestoreHousehold,
    handleConfirmRestoreHousehold,
    handleExport,
    toggleSectorFilter,
    clearSectorFilters,
    setTabSortOrder,
    householdDetails,
    pendingDepartureHouseholdId,
    isBulkDepartureConfirmOpen,
    isRecordingDeparture,
  } = useMswdoMasterlistPage({ authenticatedUser });
  const pendingRestoreFamilyHeadName = pendingRestoreHouseholdDetails?.household
    ? [
        pendingRestoreHouseholdDetails.household.family_head_first_name,
        pendingRestoreHouseholdDetails.household.family_head_middle_name,
        pendingRestoreHouseholdDetails.household.family_head_last_name,
        pendingRestoreHouseholdDetails.household.family_head_suffix,
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const pendingRestoreFamilyHeadPhotoUrl =
    pendingRestoreHouseholdDetails?.household?.family_head_photo_url || "";
  const pendingRestoreRow = displayedRows.find(
    (row) => row.household_id === pendingRestoreHouseholdId,
  );
  const pendingRestoreVariant = pendingRestoreRow?.is_non_admitted_resident
    ? "admit"
    : "readmit";

  return (
    <>
      <PageHeader title="EVACUEE MASTERLIST MANAGEMENT" actions={[]} />

      <MswdoMasterlistScopeSection
        activeTab={activeTab}
        isLoadingFilters={isLoadingFilters}
        scopedDisasterEvents={scopedDisasterEvents}
        selectedDisasterEventId={selectedDisasterEventId}
        selectedBarangayId={selectedBarangayId}
        barangays={selectableBarangays}
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

      <MasterlistSelectionBar
        selectedCount={selectedHouseholds.length}
        isSubmitting={isRecordingDeparture}
        onConfirmDeparture={handleOpenBulkDepartureConfirmation}
      />

      <MswdoMasterlistControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        recordStatus={selectedRecordStatus}
        onRecordStatusChange={handleRecordStatusChange}
        filterButtonRef={filterButtonRef}
        filterPanelRef={filterPanelRef}
        isFilterOpen={isFilterOpen}
        filterPanelPosition={filterPanelPosition}
        hasActiveSectorFilters={hasActiveSectorFilters}
        hasNonDefaultSort={hasNonDefaultSort}
        selectedSectorIds={selectedSectorIds}
        selectedSortOrder={selectedSortOrder}
        sectors={sectors}
        onToggleFilterOpen={() => setIsFilterOpen((currentValue) => !currentValue)}
        onToggleSectorFilter={toggleSectorFilter}
        onSortOrderChange={setTabSortOrder}
        onClearSectorFilters={clearSectorFilters}
        canRegisterFamily={canRegisterFamily}
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
        onRestoreHousehold={handleOpenRestoreHousehold}
        isDepartureReadOnly={isEndedView}
        departureReadOnlyText={endedEventDateTimeText}
        selectedHouseholds={selectedHouseholds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
      />

      <MasterlistDepartureConfirmModal
        isOpen={Boolean(pendingDepartureHouseholdId) || isBulkDepartureConfirmOpen}
        isSubmitting={isRecordingDeparture}
        isLoadingHouseholdDetails={isLoadingDepartureHouseholdDetails}
        onCancel={handleCloseDepartureConfirmation}
        onConfirm={handleConfirmDeparture}
        selectedCount={isBulkDepartureConfirmOpen ? selectedHouseholds.length : 1}
        familyHeadName={pendingDepartureFamilyHeadName}
        familyHeadPhotoUrl={pendingDepartureFamilyHeadPhotoUrl}
        selectedHouseholdsPreview={pendingBulkDepartureHouseholds}
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
        onClose={handleCloseRegisterModal}
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
        isOpen={Boolean(pendingRestoreHouseholdId)}
        isSubmitting={isRestoringHousehold}
        isLoadingHouseholdDetails={isLoadingRestoreHouseholdDetails}
        familyHeadName={pendingRestoreFamilyHeadName}
        familyHeadPhotoUrl={pendingRestoreFamilyHeadPhotoUrl}
        onCancel={handleCancelRestoreHousehold}
        onConfirm={handleConfirmRestoreHousehold}
        mode="restore"
        restoreVariant={pendingRestoreVariant}
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
