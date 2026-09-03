import React, { useEffect, useMemo, useState } from "react";
import PageHeader, {
  pageHeaderStyles,
} from "../../components/layout/PageHeader";
import {
  pageSpacingStyles,
  shellStyles,
} from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import ResponsiveFilterPopover from "../../components/shared/ResponsiveFilterPopover";
import ReliefPackTemplateFormModal from "../../components/relief-pack-templates/ReliefPackTemplateFormModal";
import ReliefPackTemplateStatusConfirmModal from "../../components/relief-pack-templates/ReliefPackTemplateStatusConfirmModal";
import ReliefPackTemplateDeactivationBlockedModal from "../../components/relief-pack-templates/ReliefPackTemplateDeactivationBlockedModal";
import TableActionsMenu from "../../components/shared/TableActionsMenu";
import StatusPill from "../../components/shared/StatusPill";
import DetailsModalShell from "../../components/shared/DetailsModalShell";
import {
  createReliefPackTemplate,
  fetchInventoryItems,
  fetchReliefPackTemplateById,
  fetchReliefPackTemplates,
  updateReliefPackTemplate,
  updateReliefPackTemplateStatus,
} from "../../features/relief-pack-templates/reliefPackTemplateService";
import {
  fetchAllDisasterEvents,
  fetchBarangays,
} from "../../features/disaster-events/disasterEventService";
import { fetchInventoryBatches } from "../../features/inventory-batches/inventoryBatchService";
import { fetchSectors } from "../../features/household-registration/householdRegistrationService";
import { fetchConsolidatedMasterlist } from "../../features/mswdo-masterlist/mswdoMasterlistService";
import { DISASTER_TYPE_OPTIONS } from "../../features/disaster-events/disasterTypeOptions";
import { isHouseholdEligibleForReliefPackDemand } from "../../features/relief-pack-templates/reliefPackDemand";
import { allocateSharedReliefPackInventory } from "../../features/relief-pack-templates/reliefPackAvailability";
import {
  isReliefPackInventoryBatchEligible,
  sortDisasterEventsForReliefPackRollover,
} from "../../features/relief-pack-templates/reliefPackInventory";
import { useAuth } from "../../context/AuthContext";
import {
  FiChevronDown,
  FiEdit2,
  FiEye,
  FiFilter,
  FiPlus,
  FiPower,
  FiShoppingBag,
} from "react-icons/fi";

const RELIEF_PACK_TEMPLATE_DEACTIVATION_BLOCKED_CODE =
  "RELIEF_PACK_TEMPLATE_DEACTIVATION_BLOCKED";
const RELIEF_PACK_TEMPLATE_DEACTIVATION_BLOCKED_MESSAGE =
  "This relief pack cannot be deactivated while an event is active or a distribution is ongoing.";

const getTabStyle = (isActive) => ({
  padding: "12px 24px",
  border: "none",
  borderBottom: isActive ? "3px solid #17324d" : "3px solid transparent",
  background: "none",
  color: isActive ? "#17324d" : "#6b8298",
  fontSize: "14px",
  fontWeight: 700,
  whiteSpace: "nowrap",
  cursor: "pointer",
});

const filterStyles = {
  field: {
    width: "100%",
    padding: "12px 14px",
    paddingRight: "42px",
    borderRadius: "12px",
    border: "1px solid #cfddeb",
    backgroundColor: "#f8fbfe",
    color: "#1f3b57",
    fontSize: "14px",
    boxSizing: "border-box",
    outline: "none",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#5f7892",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  selectWrap: {
    position: "relative",
    width: "100%",
  },
  selectIcon: {
    position: "absolute",
    right: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    color: "#5f7892",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

const summaryBoxStyle = {
  backgroundColor: "#e5f1fb",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "15px",
  color: "#17324d",
  border: "1px solid #c8ddef",
};

const cardTitleStyle = {
  margin: 0,
  fontSize: "18px",
  fontWeight: 800,
  color: "#17324d",
};

const helperTextStyle = {
  margin: 0,
  color: "#6b8298",
  fontSize: "14px",
};

const packTypeFilterOptions = ["All", "Standard Pack", "Additional Pack"];
const statusFilterOptions = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];
const availabilityFilterOptions = [
  "Available",
  "No available packs",
  "Has item shortage",
];
const disasterTypeFilterOptions = DISASTER_TYPE_OPTIONS;
const sortOptions = [
  { value: "oldest", label: "Oldest-Newest" },
  { value: "newest", label: "Newest-Oldest" },
  { value: "az", label: "A-Z" },
  { value: "za", label: "Z-A" },
];

const reliefPackPageStyles = {
  pageStack: {
    ...pageSpacingStyles.pageStack,
    gap: "24px",
  },
  tabCard: {
    ...shellStyles.card,
    boxSizing: "border-box",
  },
  tabList: {
    borderBottom: "1px solid #d6e2ef",
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    overflowX: "auto",
    maxWidth: "100%",
    WebkitOverflowScrolling: "touch",
  },
  reliefPackSection: {
    ...shellStyles.card,
    padding: "22px",
    boxSizing: "border-box",
  },
  reliefPackGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "18px",
    alignItems: "stretch",
    width: "100%",
  },
  reliefPackCard: {
    ...shellStyles.card,
    padding: "20px",
    boxShadow: "0 8px 20px rgba(47, 100, 153, 0.10)",
    overflow: "hidden",
  },
  reliefPackCardInactive: {
    backgroundColor: "#f7f9fb",
    borderColor: "#dfe6ed",
    boxShadow: "0 5px 14px rgba(47, 100, 153, 0.05)",
  },
  inactiveCardTitle: {
    color: "#6e8193",
  },
  inactiveCardPackTypePill: {
    backgroundColor: "#eef1f4",
    color: "#6e8193",
    border: "1px solid #dfe6ed",
  },
  reliefPackCardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "20px",
  },
  reliefPackCardIdentity: {
    flex: "1 1 auto",
    minWidth: 0,
  },
  reliefPackCardPackType: {
    display: "flex",
    justifyContent: "flex-start",
    marginTop: "10px",
  },
  reliefPackCardActions: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "10px",
    flexShrink: 0,
  },
  viewDetailsIconButton: {
    border: "1px solid #c6d8ea",
    borderRadius: "12px",
    width: "38px",
    height: "38px",
    padding: 0,
    backgroundColor: "#f8fbfe",
    color: "#24496e",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  inactiveSummaryBox: {
    backgroundColor: "#f0f3f6",
    borderColor: "#dfe6ed",
  },
  inactiveMetricLabel: {
    color: "#657789",
  },
  inactiveMetricValue: {
    margin: 0,
    color: "#6b8298",
    fontSize: "19px",
    fontWeight: 800,
    lineHeight: 1.2,
    textAlign: "right",
  },
  metricHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
  },
  metricLabel: {
    margin: 0,
    color: "#17324d",
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: 1.35,
  },
  metricValue: {
    margin: 0,
    color: "#2f6499",
    fontSize: "36px",
    fontWeight: 800,
    lineHeight: 1,
    textAlign: "right",
    letterSpacing: "0",
  },
  barangayDemandList: {
    marginTop: "14px",
    paddingTop: "12px",
    borderTop: "1px solid #c8ddef",
    display: "grid",
    gap: "6px",
    color: "#17324d",
    fontSize: "12px",
    fontWeight: 600,
  },
  shortageHeader: {
    marginBottom: "12px",
  },
  shortageTitle: {
    margin: 0,
    color: "#17324d",
    fontSize: "15px",
    fontWeight: 800,
  },
  shortageList: {
    paddingTop: "12px",
    borderTop: "1px solid rgba(157, 52, 66, 0.22)",
    display: "grid",
    gap: "6px",
  },
  shortageRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "12px",
  },
  shortageItemName: {
    minWidth: 0,
    color: "#17324d",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.35,
  },
  shortageQuantity: {
    flex: "0 0 auto",
    color: "#9d3442",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  customizationToolbar: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "nowrap",
    minWidth: 0,
  },
  customizationSearchWrap: {
    flex: 1,
    minWidth: 0,
  },
  toolbarControlsGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flex: "1 1 520px",
    flexWrap: "wrap",
    minWidth: 0,
  },
  filterPanel: {
    position: "fixed",
    width: "min(360px, calc(100vw - 32px))",
    backgroundColor: "#ffffff",
    border: "1px solid #d6e2ef",
    borderRadius: "18px",
    boxShadow: "0 18px 36px rgba(31, 64, 95, 0.16)",
    padding: "18px",
    zIndex: 1200,
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  filterTitle: {
    margin: 0,
    color: "#17324d",
    fontSize: "16px",
    fontWeight: 800,
  },
  filterField: {
    display: "grid",
    gap: "8px",
  },
  filterLabel: {
    color: "#55718b",
    fontSize: "13px",
    fontWeight: 700,
  },
  filterSelect: {
    minHeight: "44px",
    borderRadius: "14px",
    border: "1px solid #d0ddeb",
    backgroundColor: "#ffffff",
    color: "#17324d",
    padding: "10px 12px",
    fontSize: "14px",
    fontWeight: 600,
  },
  filterList: {
    display: "grid",
    gap: "10px",
    overflowY: "auto",
    flex: "1 1 auto",
    minHeight: 0,
    paddingRight: "4px",
  },
  filterOption: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#1f405f",
    fontSize: "14px",
  },
  filterActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "auto",
  },
  clearAction: {
    border: "none",
    background: "transparent",
    color: "#55718b",
    padding: "2px 0",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  },
  customizationActionGroup: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "12px",
    flex: "0 0 auto",
    minWidth: 0,
  },
  createReliefPackIconWrap: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "18px",
    height: "18px",
    flexShrink: 0,
  },
  createReliefPackPlus: {
    position: "absolute",
    right: "-5px",
    bottom: "-4px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  },
  customizationTableSection: {
    ...shellStyles.card,
    padding: "24px",
    boxSizing: "border-box",
    overflow: "visible",
  },
  customizationTableScroll: {
    overflowX: "auto",
    maxWidth: "100%",
    WebkitOverflowScrolling: "touch",
    overscrollBehaviorX: "contain",
  },
};

const staticCardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
  alignItems: "stretch",
  width: "100%",
};

const staticCardStyle = {
  border: "1px solid #b7c7d8",
  borderRadius: "10px",
  backgroundColor: "#f8fbfe",
  padding: "16px",
  boxShadow: "0 2px 6px rgba(23, 50, 77, 0.10)",
  display: "flex",
  flexDirection: "column",
  minHeight: "100%",
  boxSizing: "border-box",
  width: "100%",
};

const tableStyles = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    background: "transparent",
    tableLayout: "fixed",
    minWidth: "1280px",
  },
  headerCell: {
    padding: "14px 10px",
    textAlign: "center",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
    fontWeight: 700,
    borderBottom: "1px solid #e0eaf4",
    whiteSpace: "nowrap",
  },
  bodyCell: {
    padding: "16px 10px",
    color: "#21405f",
    borderBottom: "1px solid #edf3f8",
    fontSize: "14px",
    verticalAlign: "middle",
    lineHeight: 1.5,
    wordBreak: "break-word",
    textAlign: "center",
    fontWeight: 400,
  },
  countBadge: {
    display: "inline-block",
    minWidth: "36px",
    textAlign: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    backgroundColor: "#e5f1fb",
    color: "#356592",
    fontSize: "12px",
    fontWeight: 700,
  },
  pillWrap: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
  },
  infoPill: {
    display: "inline-block",
    minWidth: "36px",
    textAlign: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    backgroundColor: "#e5f1fb",
    color: "#356592",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },
  helperText: {
    display: "block",
    marginTop: "4px",
    color: "#6b8298",
    fontSize: "12px",
  },
  centeredHeaderCell: {
    textAlign: "center",
  },
  centeredBodyCell: {
    textAlign: "center",
    verticalAlign: "middle",
  },
  itemList: {
    display: "grid",
    gap: "6px",
  },
  itemRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "flex-start",
    gap: "8px",
    color: "#21405f",
  },
  itemName: {
    fontWeight: 400,
  },
  itemQuantity: {
    color: "#6b8298",
    fontSize: "14px",
    fontWeight: 400,
  },
  stackedList: {
    display: "grid",
    gap: "10px",
  },
  leftCell: {
    textAlign: "left",
  },
  actionCell: {
    width: "8%",
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  nameCell: {
    width: "15%",
  },
  packTypeCell: {
    width: "11%",
  },
  itemsCell: {
    width: "20%",
  },
  quantityCell: {
    width: "12%",
  },
  ruleCell: {
    width: "130px",
  },
  applicabilityCell: {
    width: "140px",
  },
  statusCell: {
    width: "88px",
    whiteSpace: "nowrap",
  },
};

const staticInnerBoxStyle = {
  backgroundColor: "#eef2f6",
  borderRadius: "10px",
  padding: "14px 16px",
  marginBottom: "8px",
  minHeight: "270px",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
};

const secondaryCardButtonStyle = {
  flex: 1,
  minHeight: "42px",
  borderRadius: "12px",
  border: "1px solid #c6d8ea",
  backgroundColor: "#f8fbfe",
  color: "#2a4c6f",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const alertBoxStyle = {
  ...summaryBoxStyle,
  backgroundColor: "#f8d7da",
  color: "#721c24",
};

const emptyDashboardState = {
  households: [],
};

const reliefPackDetailModalStyles = {
  shellPanel: {
    backgroundColor: "#eef5fb",
    border: "1px solid #d7e2ef",
    boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  },
  sectionCard: {
    ...shellStyles.card,
    backgroundColor: "#ffffff",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
  },
  label: {
    margin: 0,
    color: "#66809c",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  value: {
    margin: "8px 0 0",
    color: "#21405f",
    fontSize: "15px",
    lineHeight: 1.55,
  },
  metricValue: {
    margin: "8px 0 0",
    color: "#21405f",
    fontSize: "15px",
    lineHeight: 1.55,
    fontWeight: 400,
    letterSpacing: "0",
  },
  tableWrap: {
    overflowX: "auto",
    marginTop: "12px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "720px",
  },
  th: {
    padding: "10px 12px",
    textAlign: "left",
    fontSize: "12px",
    color: "#66809c",
    borderBottom: "1px solid #dfe8f2",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #edf3f8",
    color: "#21405f",
    fontSize: "14px",
    verticalAlign: "top",
  },
  shortageText: {
    color: "#21405f",
    fontWeight: 800,
  },
  healthyText: {
    color: "#21405f",
    fontWeight: 400,
  },
};

const STANDARD_DISASTER_TYPES = DISASTER_TYPE_OPTIONS.filter(
  (disasterType) => disasterType !== "Other",
);

const isOtherDisasterType = (disasterType) => {
  const normalizedDisasterType = String(disasterType || "").trim();
  return (
    normalizedDisasterType &&
    !STANDARD_DISASTER_TYPES.includes(normalizedDisasterType)
  );
};

const isTemplateApplicableToDisasterType = (template, disasterType) => {
  const normalizedDisasterType = String(disasterType || "").trim();

  if (!normalizedDisasterType) {
    return false;
  }

  if (template?.applies_to_all_disasters !== false) {
    return true;
  }

  const templateDisasterTypes = Array.isArray(template?.disaster_types)
    ? template.disaster_types
    : [];

  return templateDisasterTypes.some((templateDisasterType) => {
    const normalizedTemplateType = String(templateDisasterType || "").trim();
    return (
      normalizedTemplateType === normalizedDisasterType ||
      (normalizedTemplateType === "Other" &&
        isOtherDisasterType(normalizedDisasterType))
    );
  });
};

const getTemplateApplicableHouseholds = (template, households) => {
  return (households || []).filter((household) =>
    isTemplateApplicableToDisasterType(
      template,
      household?.__reliefPackDemandDisasterType,
    ) && isHouseholdApplicableToTemplateSector(template, household),
  );
};

const getHouseholdSectorIds = (household) => {
  return [
    ...(household?.household_sectors || []).map((sector) => sector.id),
    ...(household?.members || []).flatMap((member) =>
      (member?.sectors || []).map((sector) => sector.id),
    ),
  ].filter(Boolean);
};

const isHouseholdApplicableToTemplateSector = (template, household) => {
  if (!template?.is_additional_pack) {
    return true;
  }

  const templateSectorIds = Array.isArray(template?.sector_ids)
    ? template.sector_ids
    : [];
  const sectorIdSet = new Set(
    [...templateSectorIds, template?.sector_id].filter(Boolean),
  );

  if (sectorIdSet.size === 0) {
    return false;
  }

  return getHouseholdSectorIds(household).some((sectorId) =>
    sectorIdSet.has(sectorId),
  );
};

const getHouseholdSize = (household) => {
  const householdSize = Number(
    household?.household_size ??
      household?.members_count ??
      (Array.isArray(household?.members) ? household.members.length : 0),
  );

  return Number.isFinite(householdSize) && householdSize > 0 ? householdSize : 1;
};

const getTemplateFamilySizeCoverage = (template) => {
  const parsedCoverage = Number.parseInt(String(template?.description || "").trim(), 10);
  return Number.isInteger(parsedCoverage) && parsedCoverage > 0 ? parsedCoverage : 0;
};

const getReliefPackQuantityMultiplier = (template, householdSize) => {
  if (!template?.based_on_family_size) {
    return 1;
  }

  const normalizedHouseholdSize = Number.parseInt(String(householdSize || 0), 10);
  const familySizeCoverage = getTemplateFamilySizeCoverage(template);

  if (
    !Number.isInteger(normalizedHouseholdSize) ||
    normalizedHouseholdSize <= 0 ||
    familySizeCoverage <= 0
  ) {
    return 1;
  }

  return Math.max(1, Math.ceil(normalizedHouseholdSize / familySizeCoverage));
};

const buildTemplateDemand = (template, households) => {
  const barangayDemandMap = new Map();
  const eventDemandMap = new Map();
  let neededPacks = 0;

  (households || []).forEach((household) => {
    const packMultiplier = getReliefPackQuantityMultiplier(
      template,
      getHouseholdSize(household),
    );
    const barangayId = household?.barangay?.id || household?.household_id;
    const barangayName = household?.barangay?.name || "Unknown barangay";
    const eventId =
      household?.__reliefPackDemandDisasterEventId || "unknown-disaster-event";
    const eventName =
      household?.__reliefPackDemandDisasterEventLabel ||
      household?.__reliefPackDemandDisasterType ||
      "Unknown disaster event";
    const key = `${eventId}::${barangayId || barangayName}`;
    const existingBarangay = barangayDemandMap.get(key);
    const existingEvent = eventDemandMap.get(eventId);

    neededPacks += packMultiplier;

    if (existingBarangay) {
      existingBarangay.families_count += 1;
      existingBarangay.packs_needed += packMultiplier;
    } else {
      barangayDemandMap.set(key, {
        barangay_id: barangayId || key,
        barangay_name: barangayName,
        disaster_event_id: eventId,
        disaster_event_name: eventName,
        families_count: 1,
        packs_needed: packMultiplier,
      });
    }

    if (existingEvent) {
      existingEvent.families_count += 1;
      existingEvent.packs_needed += packMultiplier;
    } else {
      eventDemandMap.set(eventId, {
        disaster_event_id: eventId,
        disaster_event_name: eventName,
        families_count: 1,
        packs_needed: packMultiplier,
      });
    }
  });

  return {
    neededPacks,
    perBarangayDemand: Array.from(barangayDemandMap.values()).sort(
      (leftBarangay, rightBarangay) =>
        rightBarangay.packs_needed - leftBarangay.packs_needed,
    ),
    perEventDemand: Array.from(eventDemandMap.values()).sort(
      (leftEvent, rightEvent) => rightEvent.packs_needed - leftEvent.packs_needed,
    ),
  };
};

const getTemplateItemRequiredQuantity = (templateItem) => {
  const quantityRequired = Number(templateItem?.quantity_required || 0);
  return Number.isFinite(quantityRequired) && quantityRequired > 0
    ? quantityRequired
    : 0;
};

const normalizeReliefPackInventoryIdentifier = (value) =>
  String(value || "").trim();

const getRemainingBatchQuantity = (batch, remainingQuantityByBatchId) => {
  const rawQuantity =
    remainingQuantityByBatchId instanceof Map &&
    remainingQuantityByBatchId.has(batch?.id)
      ? remainingQuantityByBatchId.get(batch.id)
      : batch?.quantity_available;
  const quantity = Number(rawQuantity || 0);

  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
};

const getEligibleBatchesForEvent = ({
  inventoryBatches = [],
  targetDisasterEventId,
  disasterEvents = [],
  remainingQuantityByBatchId,
} = {}) => {
  const targetEventId = normalizeReliefPackInventoryIdentifier(
    targetDisasterEventId,
  );
  const targetEvent = (disasterEvents || []).find(
    (event) =>
      normalizeReliefPackInventoryIdentifier(event?.id) === targetEventId,
  );

  if (
    !targetEventId ||
    !targetEvent ||
    String(targetEvent.status || "").trim().toUpperCase() !== "ACTIVE"
  ) {
    return [];
  }

  return (inventoryBatches || []).filter((batch) => {
    if (getRemainingBatchQuantity(batch, remainingQuantityByBatchId) <= 0) {
      return false;
    }

    return isReliefPackInventoryBatchEligible(batch, new Date(), {
      targetDisasterEventId: targetEventId,
      disasterEvents,
    });
  });
};

const buildAvailabilityByItemId = ({
  inventoryBatches = [],
  targetDisasterEventId,
  disasterEvents = [],
  remainingQuantityByBatchId,
} = {}) => {
  const availabilityByItemId = new Map();

  getEligibleBatchesForEvent({
    inventoryBatches,
    targetDisasterEventId,
    disasterEvents,
    remainingQuantityByBatchId,
  }).forEach((batch) => {
    const totalAvailableQuantity = getRemainingBatchQuantity(
      batch,
      remainingQuantityByBatchId,
    );

    availabilityByItemId.set(
      batch.inventory_item_id,
      (availabilityByItemId.get(batch.inventory_item_id) || 0) +
        totalAvailableQuantity,
    );
  });

  return availabilityByItemId;
};

const getReliefPackBatchSourceRank = (batch) =>
  String(batch?.source_type || "").trim().toUpperCase() === "DONATED" ? 0 : 1;

const getReliefPackBatchSortTime = (batch) => {
  const sourceRank = getReliefPackBatchSourceRank(batch);
  const rawTimestamp =
    sourceRank === 0
      ? batch?.source_donation_received_at ||
        batch?.source_donation_created_at ||
        batch?.received_at ||
        batch?.created_at
      : batch?.received_at || batch?.created_at;
  const timestamp = new Date(rawTimestamp || 0).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
};

const compareReliefPackBatchesForAllocation = (leftBatch, rightBatch) => {
  const sourceDifference =
    getReliefPackBatchSourceRank(leftBatch) -
    getReliefPackBatchSourceRank(rightBatch);

  if (sourceDifference !== 0) {
    return sourceDifference;
  }

  const timeDifference =
    getReliefPackBatchSortTime(leftBatch) -
    getReliefPackBatchSortTime(rightBatch);

  if (timeDifference !== 0) {
    return timeDifference;
  }

  const batchNumberDifference = String(leftBatch?.batch_no || "").localeCompare(
    String(rightBatch?.batch_no || ""),
  );

  if (batchNumberDifference !== 0) {
    return batchNumberDifference;
  }

  return String(leftBatch?.id || "").localeCompare(String(rightBatch?.id || ""));
};

const consumeBatchQuantities = ({
  inventoryBatches = [],
  targetDisasterEventId,
  disasterEvents = [],
  itemId,
  quantity,
  remainingQuantityByBatchId,
} = {}) => {
  let remainingQuantity = Math.max(0, Number(quantity || 0));

  if (
    remainingQuantity <= 0 ||
    !(remainingQuantityByBatchId instanceof Map)
  ) {
    return;
  }

  getEligibleBatchesForEvent({
    inventoryBatches,
    targetDisasterEventId,
    disasterEvents,
    remainingQuantityByBatchId,
  })
    .filter(
      (batch) =>
        normalizeReliefPackInventoryIdentifier(batch?.inventory_item_id) ===
        normalizeReliefPackInventoryIdentifier(itemId),
    )
    .sort(compareReliefPackBatchesForAllocation)
    .forEach((batch) => {
      if (remainingQuantity <= 0) {
        return;
      }

      const availableQuantity = getRemainingBatchQuantity(
        batch,
        remainingQuantityByBatchId,
      );
      const consumedQuantity = Math.min(availableQuantity, remainingQuantity);

      remainingQuantityByBatchId.set(
        batch.id,
        Math.max(0, availableQuantity - consumedQuantity),
      );
      remainingQuantity -= consumedQuantity;
    });
};

const buildTemplateMetrics = ({ template, demand, allocation }) => {
  if (template?.is_active === false) {
    return {
      packsWeCanCreate: 0,
      neededPacks: 0,
      perBarangayDemand: [],
      perEventDemand: [],
      shortageItems: [],
      availableStockByItemId: new Map(),
    };
  }

  return {
    packsWeCanCreate: Number.isFinite(allocation?.packsWeCanCreate)
      ? allocation.packsWeCanCreate
      : 0,
    neededPacks: demand?.neededPacks || 0,
    perBarangayDemand: (demand?.perBarangayDemand || []).slice(0, 6),
    perEventDemand: (demand?.perEventDemand || []).slice(0, 6),
    shortageItems: allocation?.shortageItems || [],
    availableStockByItemId:
      allocation?.availableStockByItemId || new Map(),
  };
};

const mergeReliefPackDemandEntries = (targetMap, entries, keyBuilder) => {
  (entries || []).forEach((entry) => {
    const key = keyBuilder(entry);
    const existingEntry = targetMap.get(key);

    if (existingEntry) {
      existingEntry.families_count += Number(entry.families_count || 0);
      existingEntry.packs_needed += Number(entry.packs_needed || 0);
      return;
    }

    targetMap.set(key, {
      ...entry,
      families_count: Number(entry.families_count || 0),
      packs_needed: Number(entry.packs_needed || 0),
    });
  });
};

const mergeReliefPackShortageItems = (targetMap, shortageItems) => {
  (shortageItems || []).forEach((item) => {
    const itemId = item?.inventory_item_id;
    const shortageQuantity = Number(item?.shortage_quantity || 0);

    if (!itemId || !Number.isFinite(shortageQuantity) || shortageQuantity <= 0) {
      return;
    }

    const existingItem = targetMap.get(itemId);

    if (existingItem) {
      existingItem.shortage_quantity += shortageQuantity;
      return;
    }

    targetMap.set(itemId, {
      ...item,
      shortage_quantity: shortageQuantity,
    });
  });
};

const buildEventAwareTemplateCards = ({
  templates = [],
  inventoryBatches = [],
  disasterEvents = [],
  activeDisasterEvents = [],
  households = [],
  targetDisasterEventId = "",
} = {}) => {
  const normalizedTargetEventId = normalizeReliefPackInventoryIdentifier(
    targetDisasterEventId,
  );
  const eventsToProcess = sortDisasterEventsForReliefPackRollover(
    (activeDisasterEvents || []).filter((event) => {
      if (String(event?.status || "").trim().toUpperCase() !== "ACTIVE") {
        return false;
      }

      return (
        !normalizedTargetEventId ||
        normalizeReliefPackInventoryIdentifier(event?.id) ===
          normalizedTargetEventId
      );
    }),
  );
  const remainingQuantityByBatchId = new Map(
    (inventoryBatches || []).map((batch) => [
      batch.id,
      Math.max(0, Number(batch.quantity_available || 0)),
    ]),
  );
  const startingAvailabilityByItemId = new Map();
  const startingEligibleBatchIds = new Set();

  eventsToProcess.forEach((disasterEvent) => {
    getEligibleBatchesForEvent({
      inventoryBatches,
      targetDisasterEventId: disasterEvent?.id,
      disasterEvents,
      remainingQuantityByBatchId,
    }).forEach((batch) => {
      startingEligibleBatchIds.add(batch.id);
    });
  });

  (inventoryBatches || []).forEach((batch) => {
    if (!startingEligibleBatchIds.has(batch.id)) {
      return;
    }

    const quantity = getRemainingBatchQuantity(
      batch,
      remainingQuantityByBatchId,
    );

    startingAvailabilityByItemId.set(
      batch.inventory_item_id,
      (startingAvailabilityByItemId.get(batch.inventory_item_id) || 0) +
        quantity,
    );
  });
  const aggregateByTemplateId = new Map(
    (templates || []).map((template) => [
      template.id,
      {
        demand: {
          neededPacks: 0,
          perBarangayDemand: new Map(),
          perEventDemand: new Map(),
        },
        allocation: {
          packsWeCanCreate: 0,
          shortageItems: new Map(),
        },
      },
    ]),
  );

  eventsToProcess.forEach((disasterEvent) => {
    const disasterEventId = normalizeReliefPackInventoryIdentifier(
      disasterEvent?.id,
    );
    const eventHouseholds = (households || []).filter(
      (household) =>
        normalizeReliefPackInventoryIdentifier(
          household?.__reliefPackDemandDisasterEventId,
        ) === disasterEventId,
    );
    const demandByTemplateId = new Map(
      (templates || []).map((template) => [
        template.id,
        buildTemplateDemand(
          template,
          getTemplateApplicableHouseholds(template, eventHouseholds),
        ),
      ]),
    );
    const eventAvailabilityByItemId = buildAvailabilityByItemId({
      inventoryBatches,
      targetDisasterEventId: disasterEventId,
      disasterEvents,
      remainingQuantityByBatchId,
    });
    const { allocationByTemplateId } = allocateSharedReliefPackInventory({
      templates,
      availabilityByItemId: eventAvailabilityByItemId,
      demandByTemplateId,
      getItemRequiredQuantity: getTemplateItemRequiredQuantity,
    });
    const allocatedByItemId = new Map();

    (templates || []).forEach((template) => {
      const aggregate = aggregateByTemplateId.get(template.id);
      const demand = demandByTemplateId.get(template.id);
      const allocation = allocationByTemplateId.get(template.id);

      if (!aggregate || !demand || !allocation) {
        return;
      }

      aggregate.demand.neededPacks += Number(demand.neededPacks || 0);
      mergeReliefPackDemandEntries(
        aggregate.demand.perBarangayDemand,
        demand.perBarangayDemand,
        (entry) =>
          `${disasterEventId}::${normalizeReliefPackInventoryIdentifier(
            entry?.barangay_id || entry?.barangay_name,
          )}`,
      );
      mergeReliefPackDemandEntries(
        aggregate.demand.perEventDemand,
        demand.perEventDemand,
        (entry) =>
          normalizeReliefPackInventoryIdentifier(
            entry?.disaster_event_id || disasterEventId,
          ),
      );
      aggregate.allocation.packsWeCanCreate += Number(
        allocation.packsWeCanCreate || 0,
      );
      mergeReliefPackShortageItems(
        aggregate.allocation.shortageItems,
        allocation.shortageItems,
      );

      allocation.allocatedStockByItemId.forEach((quantity, itemId) => {
        allocatedByItemId.set(
          itemId,
          (allocatedByItemId.get(itemId) || 0) + Number(quantity || 0),
        );
      });
    });

    allocatedByItemId.forEach((quantity, itemId) => {
      consumeBatchQuantities({
        inventoryBatches,
        targetDisasterEventId: disasterEventId,
        disasterEvents,
        itemId,
        quantity,
        remainingQuantityByBatchId,
      });
    });
  });

  return (templates || []).map((template) => {
    const aggregate = aggregateByTemplateId.get(template.id);

    if (!aggregate) {
      return {
        ...template,
        metrics: buildTemplateMetrics({ template }),
      };
    }

    const demand = {
      neededPacks: aggregate.demand.neededPacks,
      perBarangayDemand: [...aggregate.demand.perBarangayDemand.values()].sort(
        (leftEntry, rightEntry) =>
          rightEntry.packs_needed - leftEntry.packs_needed,
      ),
      perEventDemand: [...aggregate.demand.perEventDemand.values()].sort(
        (leftEntry, rightEntry) =>
          rightEntry.packs_needed - leftEntry.packs_needed,
      ),
    };
    const allocation = {
      packsWeCanCreate: aggregate.allocation.packsWeCanCreate,
      availableStockByItemId: new Map(startingAvailabilityByItemId),
      shortageItems: [...aggregate.allocation.shortageItems.values()].sort(
        (leftItem, rightItem) =>
          rightItem.shortage_quantity - leftItem.shortage_quantity,
      ),
    };

    return {
      ...template,
      metrics: buildTemplateMetrics({ template, demand, allocation }),
    };
  });
};

const getDemandHouseholdBarangayId = (household) =>
  household?.barangay?.id || household?.barangay_id || null;

const matchesReliefPackDemandScope = ({
  household,
  selectedDisasterEventId,
  selectedBarangayId,
}) => {
  if (
    selectedDisasterEventId &&
    household?.__reliefPackDemandDisasterEventId !== selectedDisasterEventId
  ) {
    return false;
  }

  if (
    selectedBarangayId &&
    getDemandHouseholdBarangayId(household) !== selectedBarangayId
  ) {
    return false;
  }

  return true;
};

const formatTemplateItemQuantity = (item) => {
  const quantityRequired = Number(item?.quantity_required || 0);

  if (!Number.isFinite(quantityRequired) || quantityRequired <= 0) {
    return "--";
  }

  return `${quantityRequired} pc${quantityRequired === 1 ? "" : "s"}`;
};

const hasAllDisasterTypesSelected = (template) => {
  const disasterTypes = new Set(
    (Array.isArray(template?.disaster_types) ? template.disaster_types : [])
      .map((disasterType) => String(disasterType || "").trim()),
  );

  return DISASTER_TYPE_OPTIONS.every((disasterType) =>
    disasterTypes.has(disasterType),
  );
};

const getTemplateDisasterApplicabilityLabels = (template) => {
  if (template?.applies_to_all_disasters !== false) {
    return ["All disaster types"];
  }

  const disasterTypes = Array.isArray(template?.disaster_types)
    ? template.disaster_types
    : [];

  if (hasAllDisasterTypesSelected(template)) {
    return ["All disaster types"];
  }

  return disasterTypes.length > 0 ? disasterTypes : ["--"];
};

const getTemplateDisasterApplicabilityDetailLabels = (template) => {
  if (template?.applies_to_all_disasters !== false) {
    return DISASTER_TYPE_OPTIONS;
  }

  const disasterTypes = Array.isArray(template?.disaster_types)
    ? template.disaster_types
    : [];

  if (disasterTypes.length === 0) {
    return ["--"];
  }

  return disasterTypes.map((disasterType) => {
    const normalizedDisasterType = String(disasterType || "").trim();

    if (!normalizedDisasterType) {
      return "--";
    }

    return isOtherDisasterType(normalizedDisasterType)
      ? `Other: ${normalizedDisasterType}`
      : normalizedDisasterType;
  });
};

const getTemplatePackTypeLabel = (template) => {
  return template?.is_additional_pack ? "Additional" : "Standard";
};

const getSectorLabelById = (sectorOptions) => {
  return new Map(
    (sectorOptions || []).map((sector) => [
      sector.id,
      getSectorDisplayLabel(sector) || "--",
    ]),
  );
};

const getTemplateRuleLabels = (template, sectorOptions) => {
  if (!template?.is_additional_pack) {
    return template?.description ? [`${template.description} family size`] : ["--"];
  }

  const sectorLabelById = getSectorLabelById(sectorOptions);
  const sectorIds = [
    ...new Set(
      [
        ...(Array.isArray(template?.sector_ids) ? template.sector_ids : []),
        template?.sector_id,
      ].filter(Boolean),
    ),
  ];

  if (sectorIds.length === 0) {
    return ["--"];
  }

  return sectorIds.map((sectorId) => sectorLabelById.get(sectorId) || "Unknown sector");
};

const getEventSortTimestamp = (event) => {
  const timestamp = new Date(
    event?.start_date || event?.created_at || event?.updated_at || 0,
  ).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
};

const sortDisasterEventsNewestFirst = (events) => {
  return [...(events || [])].sort(
    (leftEvent, rightEvent) =>
      getEventSortTimestamp(rightEvent) - getEventSortTimestamp(leftEvent),
  );
};

const sortTemplatesOldestFirst = (templateList) => {
  return [...(templateList || [])].sort((leftTemplate, rightTemplate) => {
    const leftTime = new Date(
      leftTemplate?.created_at || leftTemplate?.updated_at || 0,
    ).getTime();
    const rightTime = new Date(
      rightTemplate?.created_at || rightTemplate?.updated_at || 0,
    ).getTime();

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return String(leftTemplate?.name || "").localeCompare(
      String(rightTemplate?.name || ""),
    );
  });
};

const compareTemplateNames = (leftTemplate, rightTemplate) => {
  const nameComparison = String(leftTemplate?.name || "").localeCompare(
    String(rightTemplate?.name || ""),
  );

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return String(leftTemplate?.id || "").localeCompare(
    String(rightTemplate?.id || ""),
  );
};

const getTemplateSortableTimestamp = (template) => {
  const timestamp = new Date(
    template?.created_at || template?.updated_at || 0,
  ).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getTemplateNeededPacks = (template) => {
  const neededPacks = Number(template?.metrics?.neededPacks);

  return Number.isFinite(neededPacks) && neededPacks > 0 ? neededPacks : 0;
};

const sortTemplateCards = (
  templateList,
  sortOrder,
  { prioritizeDemand = false } = {},
) => {
  const sortedTemplates = [...(templateList || [])];

  return sortedTemplates.sort((leftTemplate, rightTemplate) => {
    const leftIsInactive = leftTemplate?.is_active === false;
    const rightIsInactive = rightTemplate?.is_active === false;

    if (prioritizeDemand) {
      if (leftIsInactive !== rightIsInactive) {
        return leftIsInactive ? 1 : -1;
      }

      const leftIsAdditional = Boolean(leftTemplate?.is_additional_pack);
      const rightIsAdditional = Boolean(rightTemplate?.is_additional_pack);

      if (leftIsAdditional !== rightIsAdditional) {
        return leftIsAdditional ? 1 : -1;
      }

      if (!leftIsInactive && !rightIsInactive) {
        const neededPacksDifference =
          getTemplateNeededPacks(rightTemplate) -
          getTemplateNeededPacks(leftTemplate);

        if (neededPacksDifference !== 0) {
          return neededPacksDifference;
        }
      }
    }

    if (sortOrder === "newest") {
      const timestampDifference =
        getTemplateSortableTimestamp(rightTemplate) -
        getTemplateSortableTimestamp(leftTemplate);

      if (timestampDifference !== 0) {
        return timestampDifference;
      }
    } else if (sortOrder === "az" || sortOrder === "za") {
      const nameComparison = compareTemplateNames(leftTemplate, rightTemplate);

      if (nameComparison !== 0) {
        return sortOrder === "za" ? -nameComparison : nameComparison;
      }
    } else {
      const timestampDifference =
        getTemplateSortableTimestamp(leftTemplate) -
        getTemplateSortableTimestamp(rightTemplate);

      if (timestampDifference !== 0) {
        return timestampDifference;
      }
    }

    return compareTemplateNames(leftTemplate, rightTemplate);
  });
};

const matchesTemplatePackTypeFilter = (template, packTypeFilter) => {
  if (!packTypeFilter || packTypeFilter === "All") {
    return true;
  }

  if (packTypeFilter === "Standard Pack") {
    return !template?.is_additional_pack;
  }

  if (packTypeFilter === "Additional Pack") {
    return Boolean(template?.is_additional_pack);
  }

  return true;
};

const matchesTemplateStatusFilter = (template, statusFilter) => {
  if (!statusFilter || statusFilter === "all") {
    return true;
  }

  if (statusFilter === "active") {
    return template?.is_active !== false;
  }

  if (statusFilter === "inactive") {
    return template?.is_active === false;
  }

  return true;
};

const matchesTemplateDisasterEventScope = (
  template,
  selectedEventId,
  activeEvents,
) => {
  const disasterEvents = Array.isArray(activeEvents) ? activeEvents : [];

  if (!selectedEventId || disasterEvents.length === 0) {
    return true;
  }

  const scopedEvents = disasterEvents.filter(
    (event) => event?.id === selectedEventId,
  );

  return scopedEvents.some((event) =>
    isTemplateApplicableToDisasterType(template, event?.disaster_type),
  );
};

const matchesTemplateAvailabilityFilter = (template, availabilityFilters) => {
  if (!Array.isArray(availabilityFilters) || availabilityFilters.length === 0) {
    return true;
  }

  if (template?.is_active === false) {
    return false;
  }

  return availabilityFilters.some((filterValue) => {
    if (filterValue === "Available") {
      return Number(template?.metrics?.packsWeCanCreate || 0) > 0;
    }

    if (filterValue === "No available packs") {
      return Number(template?.metrics?.packsWeCanCreate || 0) === 0;
    }

    if (filterValue === "Has item shortage") {
      return (template?.metrics?.shortageItems || []).length > 0;
    }

    return false;
  });
};

const matchesTemplateDisasterTypeFilter = (template, disasterTypeFilters) => {
  if (!Array.isArray(disasterTypeFilters) || disasterTypeFilters.length === 0) {
    return true;
  }

  if (template?.applies_to_all_disasters !== false) {
    return true;
  }

  const templateDisasterTypes = Array.isArray(template?.disaster_types)
    ? template.disaster_types
    : [];

  return disasterTypeFilters.some((filterValue) => {
    if (filterValue === "Other") {
      return templateDisasterTypes.some(isOtherDisasterType);
    }

    return templateDisasterTypes.some(
      (templateDisasterType) =>
        String(templateDisasterType || "").trim() === filterValue,
    );
  });
};

const normalizeApiList = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  return Array.isArray(payload?.data) ? payload.data : [];
};

const sectorMatchOrder = [
  "Infant",
  "Toddler",
  "Pre-schooler",
  "School Age",
  "Teenage",
  "Adult",
  "Senior Citizen",
  "Pregnant",
  "Lactating Mother",
  "Persons with Disabilities",
  "Indigenous",
  "4Ps Beneficiaries",
  "Child-Headed Family",
  "Single-Headed Family",
  "Solo Parents",
];

const sectorMatchCodeAliases = {
  INFANT: "Infant",
  TODDLER: "Toddler",
  PRE_SCHOOLER: "Pre-schooler",
  SCHOOL_AGE: "School Age",
  TEENAGE: "Teenage",
  ADULT: "Adult",
  SENIOR_CITIZEN: "Senior Citizen",
  PREGNANT: "Pregnant",
  LACTATING: "Lactating Mother",
  LACTATING_MOTHER: "Lactating Mother",
  PWD: "Persons with Disabilities",
  INDIGENOUS: "Indigenous",
  FOUR_PS: "4Ps Beneficiaries",
  CHILD_HEADED: "Child-Headed Family",
  SINGLE_HEADED: "Single-Headed Family",
  SOLO_PARENT: "Solo Parents",
};

const getSectorSortLabel = (sector) => {
  const sectorCode = String(sector?.code || "").trim().toUpperCase();
  return (
    sectorMatchCodeAliases[sectorCode] ||
    String(sector?.display_name || sector?.name || "").trim()
  );
};

const getSectorDisplayLabel = (sector) => {
  const sectorCode = String(sector?.code || "").trim().toUpperCase();
  const fallbackLabel = String(sector?.display_name || sector?.name || "").trim();
  return (
    sectorMatchCodeAliases[sectorCode] ||
    fallbackLabel.replace(/\s*\([^)]*\)\s*/g, "").trim()
  );
};

const sortSectorOptionsForReliefPacks = (sectors) => {
  const orderByLabel = new Map(
    sectorMatchOrder.map((label, index) => [label.toLowerCase(), index]),
  );

  return [...(sectors || [])].sort((leftSector, rightSector) => {
    const leftLabel = getSectorSortLabel(leftSector);
    const rightLabel = getSectorSortLabel(rightSector);
    const leftOrder = orderByLabel.get(leftLabel.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = orderByLabel.get(rightLabel.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return leftLabel.localeCompare(rightLabel);
  });
};

const formatDisasterEventOptionLabel = (event) => {
  const title = String(event?.title || "").trim();
  const eventCode = String(event?.event_code || "").trim();
  const codePrefixPattern = /^DE-\d{4}-\d{4}\s*[-:]\s*/i;
  const titleWithoutCode = title.replace(codePrefixPattern, "").trim();

  if (
    eventCode &&
    titleWithoutCode.toLowerCase().startsWith(eventCode.toLowerCase())
  ) {
    return titleWithoutCode.slice(eventCode.length).replace(/^[-:\s]+/, "").trim();
  }

  return titleWithoutCode || title || "Untitled disaster event";
};

const getAffectedBarangayIds = (event) => {
  const affectedBarangays = Array.isArray(event?.affected_barangays)
    ? event.affected_barangays
    : [];

  return affectedBarangays
    .map((barangay) => barangay?.id || barangay?.barangay_id || "")
    .filter(Boolean);
};

const ReliefPackTemplateDetailModal = ({
  isOpen,
  template,
  isLoadingDemand,
  sectorOptions,
  viewContext = "relief-packs",
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  const metrics = template?.metrics || {
    packsWeCanCreate: 0,
    neededPacks: 0,
    perBarangayDemand: [],
    shortageItems: [],
    availableStockByItemId: new Map(),
  };
  const items = Array.isArray(template?.items) ? template.items : [];
  const availableStockByItemId =
    metrics.availableStockByItemId instanceof Map
      ? metrics.availableStockByItemId
      : new Map();
  const shortageByItemId = new Map(
    (metrics.shortageItems || []).map((item) => [
      item.inventory_item_id,
      item.shortage_quantity,
    ]),
  );
  const isCustomizationView = viewContext === "customization";
  const sectorRuleLabels = getTemplateRuleLabels(template, sectorOptions);
  const disasterApplicabilityLabels =
    getTemplateDisasterApplicabilityDetailLabels(template);
  const familySizeCoverage = getTemplateFamilySizeCoverage(template);
  const isTemplateInactive = template?.is_active === false;

  return (
    <DetailsModalShell
      isOpen={isOpen}
      title="Relief Pack Details"
      onClose={onClose}
      maxWidth="980px"
      closeMode="icon"
      titleStyle={{ fontSize: "30px", fontWeight: 700 }}
      panelStyle={reliefPackDetailModalStyles.shellPanel}
      panelClassName="mayor-relief-pack-detail-modal"
    >
      {!template ? (
        <section
          className="mayor-relief-pack-detail-section"
          style={reliefPackDetailModalStyles.sectionCard}
        >
          <p style={{ ...shellStyles.mutedText, margin: 0 }}>
            Relief pack details are unavailable.
          </p>
        </section>
      ) : (
        <div style={{ display: "grid", gap: "20px" }}>
          <section
            className="mayor-relief-pack-detail-section"
            style={reliefPackDetailModalStyles.sectionCard}
          >
            <h3 style={{ margin: 0, color: "#17324d" }}>Pack Information</h3>
            <div
              className="mayor-relief-pack-detail-grid"
              style={{
                ...reliefPackDetailModalStyles.summaryGrid,
                marginTop: "16px",
              }}
            >
              <div>
                <p style={reliefPackDetailModalStyles.label}>Pack Name</p>
                <p style={reliefPackDetailModalStyles.value}>
                  {template.name || "--"}
                </p>
              </div>
              <div>
                <p style={reliefPackDetailModalStyles.label}>Pack Type</p>
                <p style={reliefPackDetailModalStyles.value}>
                  {getTemplatePackTypeLabel(template)}
                </p>
              </div>
              <div>
                <p style={reliefPackDetailModalStyles.label}>Status</p>
                <p style={reliefPackDetailModalStyles.value}>
                  {isTemplateInactive ? "Inactive" : "Active"}
                </p>
              </div>
              {isCustomizationView ? null : (
                <div>
                  <p style={reliefPackDetailModalStyles.label}>Packs Needed</p>
                  <p style={reliefPackDetailModalStyles.metricValue}>
                    {isTemplateInactive
                      ? "—"
                      : metrics.neededPacks.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
            {isTemplateInactive ? (
              <p
                style={{
                  ...shellStyles.mutedText,
                  margin: "16px 0 0",
                  lineHeight: 1.5,
                }}
              >
                This pack is inactive. Availability, demand, and distribution
                calculations are paused until it is activated.
              </p>
            ) : null}
          </section>

          {isCustomizationView ? (
            <section
              className="mayor-relief-pack-detail-section"
              style={reliefPackDetailModalStyles.sectionCard}
            >
              <h3 style={{ margin: 0, color: "#17324d" }}>
                Rules & Applicability
              </h3>
              <div
                className="mayor-relief-pack-detail-grid"
                style={{
                  ...reliefPackDetailModalStyles.summaryGrid,
                  marginTop: "16px",
                }}
              >
                <div>
                  <p style={reliefPackDetailModalStyles.label}>
                    Family Size Covered
                  </p>
                  <p style={reliefPackDetailModalStyles.value}>
                    {template.is_additional_pack
                      ? "Not applicable"
                      : familySizeCoverage > 0
                        ? `${familySizeCoverage} family member${
                            familySizeCoverage === 1 ? "" : "s"
                          } per pack`
                        : "--"}
                  </p>
                </div>
                <div>
                  <p style={reliefPackDetailModalStyles.label}>Sector Match</p>
                  <p style={reliefPackDetailModalStyles.value}>
                    {template.is_additional_pack
                      ? sectorRuleLabels.join(", ")
                      : "Not applicable"}
                  </p>
                </div>
                <div>
                  <p style={reliefPackDetailModalStyles.label}>
                    Disaster Applicability
                  </p>
                  <p style={reliefPackDetailModalStyles.value}>
                    {disasterApplicabilityLabels.join(", ")}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section
            className="mayor-relief-pack-detail-section"
            style={reliefPackDetailModalStyles.sectionCard}
          >
            <h3 style={{ margin: 0, color: "#17324d" }}>Items Included</h3>

            {items.length === 0 ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                No items are recorded in this relief pack.
              </p>
            ) : (
              <div
                className="mayor-relief-pack-detail-table-scroll"
                style={reliefPackDetailModalStyles.tableWrap}
              >
                <table
                  className="mayor-relief-pack-detail-table"
                  style={reliefPackDetailModalStyles.table}
                >
                  <thead>
                    <tr>
                      <th style={reliefPackDetailModalStyles.th}>Item</th>
                      <th style={reliefPackDetailModalStyles.th}>Quantity per Pack</th>
                      {isCustomizationView ? null : (
                        <>
                          <th style={reliefPackDetailModalStyles.th}>
                            Available Stock
                          </th>
                          <th style={reliefPackDetailModalStyles.th}>
                            Needed Stock
                          </th>
                          <th style={reliefPackDetailModalStyles.th}>
                            Item Still Needed
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const quantityPerPack = getTemplateItemRequiredQuantity(item);
                      const availableQuantity =
                        availableStockByItemId.get(item.inventory_item_id) || 0;
                      const neededQuantity = metrics.neededPacks * quantityPerPack;
                      const shortageQuantity =
                        shortageByItemId.get(item.inventory_item_id) || 0;

                      return (
                        <tr key={item.id || item.inventory_item_id}>
                          <td style={reliefPackDetailModalStyles.td}>
                            {item.inventory_item?.item_name || "Unknown item"}
                          </td>
                          <td style={reliefPackDetailModalStyles.td}>
                            {formatTemplateItemQuantity(item)}
                          </td>
                          {isCustomizationView ? null : (
                            <>
                              <td style={reliefPackDetailModalStyles.td}>
                                {availableQuantity.toLocaleString()} pcs
                              </td>
                              <td style={reliefPackDetailModalStyles.td}>
                                {isTemplateInactive
                                  ? "Not calculated"
                                  : `${neededQuantity.toLocaleString()} pcs`}
                              </td>
                              <td style={reliefPackDetailModalStyles.td}>
                                <span
                                  style={
                                    shortageQuantity > 0
                                      ? reliefPackDetailModalStyles.shortageText
                                      : reliefPackDetailModalStyles.healthyText
                                  }
                                >
                                  {isTemplateInactive
                                    ? "Not calculated"
                                    : shortageQuantity > 0
                                    ? `${shortageQuantity.toLocaleString()} pcs`
                                    : "None"}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {isCustomizationView ? null : (
            <section
              className="mayor-relief-pack-detail-section"
              style={reliefPackDetailModalStyles.sectionCard}
            >
            <h3 style={{ margin: 0, color: "#17324d" }}>
              Packs Needed per Barangay
            </h3>

            {isTemplateInactive ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                Demand is paused while this pack is inactive.
              </p>
            ) : isLoadingDemand ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                Loading demand...
              </p>
            ) : metrics.perBarangayDemand.length === 0 ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                No active event demand found.
              </p>
            ) : (
              <div
                className="mayor-relief-pack-detail-table-scroll"
                style={reliefPackDetailModalStyles.tableWrap}
              >
                <table
                  className="mayor-relief-pack-detail-table"
                  style={reliefPackDetailModalStyles.table}
                >
                  <thead>
                    <tr>
                      <th style={reliefPackDetailModalStyles.th}>
                        Disaster Event
                      </th>
                      <th style={reliefPackDetailModalStyles.th}>Barangay</th>
                      <th style={reliefPackDetailModalStyles.th}>Families Count</th>
                      <th style={reliefPackDetailModalStyles.th}>Packs Needed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.perBarangayDemand.map((barangay) => (
                      <tr
                        key={`${template.id}-${barangay.disaster_event_id}-${barangay.barangay_id}`}
                      >
                        <td style={reliefPackDetailModalStyles.td}>
                          {barangay.disaster_event_name || "--"}
                        </td>
                        <td style={reliefPackDetailModalStyles.td}>
                          {barangay.barangay_name}
                        </td>
                        <td style={reliefPackDetailModalStyles.td}>
                          {barangay.families_count.toLocaleString()}
                        </td>
                        <td style={reliefPackDetailModalStyles.td}>
                          {barangay.packs_needed.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </section>
          )}
        </div>
      )}
    </DetailsModalShell>
  );
};

const ReliefPackTemplatesPage = () => {
  const { authenticatedUser } = useAuth();
  const [activeTab, setActiveTab] = useState("relief-packs");
  const [filters, setFilters] = useState({
    search: "",
    packType: "All",
    status: "all",
    availability: [],
    disasterTypes: [],
    sortOrder: "oldest",
  });
  const [templates, setTemplates] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
  const [allDisasterEvents, setAllDisasterEvents] = useState([]);
  const [activeDisasterEvents, setActiveDisasterEvents] = useState([]);
  const [barangayOptions, setBarangayOptions] = useState([]);
  const [selectedDisasterEventId, setSelectedDisasterEventId] = useState("");
  const [selectedBarangayId, setSelectedBarangayId] = useState("");
  const [sectorOptions, setSectorOptions] = useState([]);
  const [aggregatedDemand, setAggregatedDemand] = useState(emptyDashboardState);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDemand, setIsLoadingDemand] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusErrorMessage, setStatusErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [modalErrorMessage, setModalErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailTemplateId, setDetailTemplateId] = useState(null);
  const [detailViewContext, setDetailViewContext] = useState("relief-packs");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [statusTemplate, setStatusTemplate] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [deactivationBlockedMessage, setDeactivationBlockedMessage] =
    useState("");
  const selectedAvailabilityFilters = Array.isArray(filters.availability)
    ? filters.availability
    : [];
  const selectedDisasterTypeFilters = Array.isArray(filters.disasterTypes)
    ? filters.disasterTypes
    : [];
  const selectedStatusFilter = filters.status || "all";
  const selectedSortOrder = filters.sortOrder || "oldest";
  const selectedAdvancedFilters =
    activeTab === "customization"
      ? selectedDisasterTypeFilters
      : selectedAvailabilityFilters;
  const activeFilterCount =
    selectedAdvancedFilters.length +
    (selectedSortOrder !== "oldest" ? 1 : 0);

  const loadReliefPackPage = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const [
        templateResponse,
        inventoryItemResponse,
        inventoryBatchResponse,
        disasterEventResponse,
        barangayResponse,
        sectorResponse,
      ] = await Promise.all([
        fetchReliefPackTemplates({ is_active: "" }),
        fetchInventoryItems(),
        fetchInventoryBatches(),
        fetchAllDisasterEvents(),
        fetchBarangays(),
        fetchSectors(),
      ]);

      const templateDetails = await Promise.all(
        (templateResponse || []).map((template) =>
          fetchReliefPackTemplateById(template.id),
        ),
      );

      setTemplates(sortTemplatesOldestFirst(templateDetails));
      setInventoryItems(inventoryItemResponse || []);
      setInventoryBatches(inventoryBatchResponse || []);
      const normalizedDisasterEvents = Array.isArray(disasterEventResponse)
        ? disasterEventResponse
        : [];
      setAllDisasterEvents(normalizedDisasterEvents);
      setActiveDisasterEvents(
        sortDisasterEventsNewestFirst(
          normalizedDisasterEvents.filter(
            (event) => String(event?.status || "").toUpperCase() === "ACTIVE",
          ),
        ),
      );
      setBarangayOptions(barangayResponse || []);
      setSectorOptions(
        sortSectorOptionsForReliefPacks(normalizeApiList(sectorResponse)),
      );
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplateDetail = async (templateId) => {
    const response = await fetchReliefPackTemplateById(templateId);

    setSelectedTemplate(response);
    setSelectedTemplateId(templateId);
    setTemplates((currentTemplates) =>
      sortTemplatesOldestFirst(
        currentTemplates.map((template) =>
          template.id === templateId ? response : template,
        ),
      ),
    );

    return response;
  };

  useEffect(() => {
    loadReliefPackPage();
  }, []);

  const scopedDisasterEvents = useMemo(
    () => activeDisasterEvents,
    [activeDisasterEvents],
  );

  useEffect(() => {
    if (!selectedDisasterEventId) {
      return;
    }

    if (scopedDisasterEvents.some((event) => event.id === selectedDisasterEventId)) {
      return;
    }

    setSelectedDisasterEventId("");
  }, [scopedDisasterEvents, selectedDisasterEventId]);

  const selectedDisasterEvent = useMemo(
    () =>
      scopedDisasterEvents.find((event) => event.id === selectedDisasterEventId) ||
      null,
    [scopedDisasterEvents, selectedDisasterEventId],
  );

  const selectableBarangayOptions = useMemo(() => {
    if (!selectedDisasterEvent) {
      return barangayOptions;
    }

    const affectedBarangayIds = getAffectedBarangayIds(selectedDisasterEvent);
    const affectedBarangayIdSet = new Set(affectedBarangayIds);

    return barangayOptions.filter((barangay) =>
      affectedBarangayIdSet.has(barangay.id),
    );
  }, [barangayOptions, selectedDisasterEvent]);

  useEffect(() => {
    if (!selectedBarangayId) {
      return;
    }

    if (
      selectableBarangayOptions.some(
        (barangay) => barangay.id === selectedBarangayId,
      )
    ) {
      return;
    }

    setSelectedBarangayId("");
  }, [selectableBarangayOptions, selectedBarangayId]);

  useEffect(() => {
    let isMounted = true;

    const refreshInventoryDrivenMetrics = async () => {
      try {
        const [
          templateResponse,
          inventoryItemResponse,
          inventoryBatchResponse,
          disasterEventResponse,
        ] =
          await Promise.all([
            fetchReliefPackTemplates({ is_active: "" }),
            fetchInventoryItems(),
            fetchInventoryBatches(),
            fetchAllDisasterEvents(),
          ]);

        const templateDetails = await Promise.all(
          (templateResponse || []).map((template) =>
            fetchReliefPackTemplateById(template.id),
          ),
        );

        if (!isMounted) {
          return;
        }

        setTemplates(sortTemplatesOldestFirst(templateDetails));
        setInventoryItems(inventoryItemResponse || []);
        setInventoryBatches(inventoryBatchResponse || []);
        const normalizedDisasterEvents = Array.isArray(disasterEventResponse)
          ? disasterEventResponse
          : [];
        setAllDisasterEvents(normalizedDisasterEvents);
        setActiveDisasterEvents(
          sortDisasterEventsNewestFirst(
            normalizedDisasterEvents.filter(
              (event) => String(event?.status || "").toUpperCase() === "ACTIVE",
            ),
          ),
        );
      } catch (_error) {
        // Keep the current view stable during background refresh attempts.
      }
    };

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        void refreshInventoryDrivenMetrics();
      }
    };

    const refreshInterval = window.setInterval(refreshInventoryDrivenMetrics, 30000);

    window.addEventListener("focus", refreshInventoryDrivenMetrics);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);

    return () => {
      isMounted = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshInventoryDrivenMetrics);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, []);

  useEffect(() => {
    if (scopedDisasterEvents.length === 0) {
      setAggregatedDemand(emptyDashboardState);
      return;
    }

    let isMounted = true;

    const loadAggregatedDemand = async () => {
      setIsLoadingDemand(true);

      try {
        const masterlistResults = await Promise.all(
          scopedDisasterEvents.map((disasterEvent) =>
            fetchConsolidatedMasterlist({
              disasterEventId: disasterEvent.id,
              barangayId: null,
              recordStatus: "active",
            })
              .then((masterlist) => ({
                disasterEvent,
                masterlist,
              }))
              .catch(() => null),
          ),
        );

        if (!isMounted) {
          return;
        }

        const householdsNeedingReliefPacks = [];

        masterlistResults.filter(Boolean).forEach(({ disasterEvent, masterlist }) => {
          const disasterType =
            String(
              masterlist?.disaster_event?.disaster_type ||
                disasterEvent?.disaster_type ||
                "",
            ).trim() || null;
          const activeHouseholds = (Array.isArray(masterlist?.data)
            ? masterlist.data
            : [])
            .filter(isHouseholdEligibleForReliefPackDemand)
            .map((household) => ({
              ...household,
              __reliefPackDemandDisasterEventId:
                masterlist?.disaster_event?.id || disasterEvent?.id || null,
              __reliefPackDemandDisasterEventLabel:
                formatDisasterEventOptionLabel(masterlist?.disaster_event || disasterEvent),
              __reliefPackDemandDisasterType: disasterType,
            }));

          householdsNeedingReliefPacks.push(...activeHouseholds);
        });

        setAggregatedDemand({
          households: householdsNeedingReliefPacks,
        });
      } finally {
        if (isMounted) {
          setIsLoadingDemand(false);
        }
      }
    };

    loadAggregatedDemand();
    const refreshInterval = window.setInterval(loadAggregatedDemand, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(refreshInterval);
    };
  }, [scopedDisasterEvents]);

  const scopedDemandHouseholds = useMemo(
    () =>
      aggregatedDemand.households.filter((household) =>
        matchesReliefPackDemandScope({
          household,
          selectedDisasterEventId,
          selectedBarangayId,
        }),
      ),
    [aggregatedDemand.households, selectedBarangayId, selectedDisasterEventId],
  );

  const fullDemandTemplateCards = useMemo(
    () =>
      buildEventAwareTemplateCards({
        templates,
        inventoryBatches,
        disasterEvents: allDisasterEvents,
        activeDisasterEvents,
        households: aggregatedDemand.households,
      }),
    [
      activeDisasterEvents,
      aggregatedDemand.households,
      allDisasterEvents,
      inventoryBatches,
      templates,
    ],
  );

  const templateCards = useMemo(
    () =>
      buildEventAwareTemplateCards({
        templates,
        inventoryBatches,
        disasterEvents: allDisasterEvents,
        activeDisasterEvents,
        targetDisasterEventId: selectedDisasterEventId,
        households: scopedDemandHouseholds,
      }),
    [
      activeDisasterEvents,
      allDisasterEvents,
      inventoryBatches,
      scopedDemandHouseholds,
      selectedDisasterEventId,
      templates,
    ],
  );

  const filteredTemplateCards = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();

    const filteredTemplates = templateCards.filter((template) => {
      if (
        activeTab === "relief-packs" &&
        !matchesTemplateDisasterEventScope(
          template,
          selectedDisasterEventId,
          scopedDisasterEvents,
        )
      ) {
        return false;
      }

      if (!matchesTemplatePackTypeFilter(template, filters.packType)) {
        return false;
      }

      if (!matchesTemplateStatusFilter(template, selectedStatusFilter)) {
        return false;
      }

      if (
        activeTab === "relief-packs" &&
        !matchesTemplateAvailabilityFilter(template, selectedAvailabilityFilters)
      ) {
        return false;
      }

      if (
        activeTab === "customization" &&
        !matchesTemplateDisasterTypeFilter(template, selectedDisasterTypeFilters)
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const templateName = template.name.toLowerCase();
      const itemNames = (template.items || [])
        .map((item) => item.inventory_item?.item_name || "")
        .join(" ")
        .toLowerCase();
      const disasterTypes = (template.applies_to_all_disasters !== false
        ? ["All disaster types"]
        : template.disaster_types || []
      )
        .join(" ")
        .toLowerCase();
      const packType = getTemplatePackTypeLabel(template).toLowerCase();
      const ruleLabels = getTemplateRuleLabels(template, sectorOptions)
        .join(" ")
        .toLowerCase();

      return (
        templateName.includes(normalizedSearch) ||
        itemNames.includes(normalizedSearch) ||
        disasterTypes.includes(normalizedSearch) ||
        packType.includes(normalizedSearch) ||
        ruleLabels.includes(normalizedSearch)
      );
    });

    return sortTemplateCards(filteredTemplates, selectedSortOrder, {
      prioritizeDemand: activeTab === "relief-packs",
    });
  }, [
    activeTab,
    filters.packType,
    filters.search,
    sectorOptions,
    selectedAvailabilityFilters,
    selectedDisasterEventId,
    selectedDisasterTypeFilters,
    selectedStatusFilter,
    selectedSortOrder,
    scopedDisasterEvents,
    templateCards,
  ]);

  const detailTemplate = useMemo(() => {
    if (!detailTemplateId) {
      return null;
    }

    const detailCards =
      detailViewContext === "customization"
        ? fullDemandTemplateCards
        : templateCards;

    return (
      detailCards.find((template) => template.id === detailTemplateId) ||
      null
    );
  }, [detailTemplateId, detailViewContext, fullDemandTemplateCards, templateCards]);

  const handleOpenCreateModal = () => {
    setModalMode("create");
    setSelectedTemplateId(null);
    setSelectedTemplate(null);
    setModalErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (templateId) => {
    setModalMode("edit");
    setModalErrorMessage("");
    setSuccessMessage("");

    try {
      await loadTemplateDetail(templateId);
      setIsModalOpen(true);
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const handleOpenStatusConfirmation = (template) => {
    setStatusTemplate(template || null);
    setStatusErrorMessage("");
    setDeactivationBlockedMessage("");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleCloseStatusConfirmation = () => {
    if (!isUpdatingStatus) {
      setStatusTemplate(null);
      setStatusErrorMessage("");
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!statusTemplate?.id || isUpdatingStatus) {
      return;
    }

    const nextIsActive = statusTemplate.is_active === false;
    setIsUpdatingStatus(true);
    setStatusErrorMessage("");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await updateReliefPackTemplateStatus(
        statusTemplate.id,
        nextIsActive,
      );

      setStatusTemplate(null);
      setSuccessMessage(
        response?.message ||
          `Relief pack ${nextIsActive ? "activated" : "deactivated"} successfully.`,
      );
      await loadReliefPackPage();
    } catch (error) {
      if (
        !nextIsActive &&
        (error?.code === RELIEF_PACK_TEMPLATE_DEACTIVATION_BLOCKED_CODE ||
          error?.statusCode === 409)
      ) {
        setStatusTemplate(null);
        setStatusErrorMessage("");
        setDeactivationBlockedMessage(
          error.message || RELIEF_PACK_TEMPLATE_DEACTIVATION_BLOCKED_MESSAGE,
        );
      } else {
        setStatusErrorMessage(error.message);
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCloseDeactivationBlockedModal = () => {
    setDeactivationBlockedMessage("");
  };

  const handleCloseModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
    }
  };

  const handleFilterChange = (fieldName, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: value,
    }));
  };

  const handleToggleAvailabilityFilter = (availabilityFilter) => {
    const nextAvailabilityFilters = selectedAvailabilityFilters.includes(
      availabilityFilter,
    )
      ? selectedAvailabilityFilters.filter((entry) => entry !== availabilityFilter)
      : [...selectedAvailabilityFilters, availabilityFilter];

    handleFilterChange("availability", nextAvailabilityFilters);
  };

  const handleToggleDisasterTypeFilter = (disasterTypeFilter) => {
    const nextDisasterTypeFilters = selectedDisasterTypeFilters.includes(
      disasterTypeFilter,
    )
      ? selectedDisasterTypeFilters.filter((entry) => entry !== disasterTypeFilter)
      : [...selectedDisasterTypeFilters, disasterTypeFilter];

    handleFilterChange("disasterTypes", nextDisasterTypeFilters);
  };

  const handleClearAdvancedFilters = () => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      availability: [],
      disasterTypes: [],
      sortOrder: "oldest",
    }));
  };

  const handleOpenDetailModal = (template, viewContext = "relief-packs") => {
    setDetailTemplateId(template?.id || null);
    setDetailViewContext(viewContext);
    setSuccessMessage("");
  };

  const handleCloseDetailModal = () => {
    setDetailTemplateId(null);
    setDetailViewContext("relief-packs");
  };

  const handleSubmitModal = async (payload) => {
    setIsSubmitting(true);
    setModalErrorMessage("");

    try {
      if (modalMode === "edit" && selectedTemplateId) {
        await updateReliefPackTemplate(selectedTemplateId, {
          name: payload.name,
          description: payload.description,
          based_on_family_size: payload.based_on_family_size,
          based_on_sector: payload.based_on_sector,
          is_additional_pack: payload.is_additional_pack,
          sector_id: payload.sector_id,
          sector_ids: payload.sector_ids,
          applies_to_all_disasters: payload.applies_to_all_disasters,
          is_active: payload.is_active,
          disaster_types: payload.disaster_types,
          items: payload.items,
        });

        setSuccessMessage("Relief pack updated successfully.");
      } else {
        await createReliefPackTemplate({
          name: payload.name,
          description: payload.description,
          based_on_family_size: payload.based_on_family_size,
          based_on_sector: payload.based_on_sector,
          is_additional_pack: payload.is_additional_pack,
          sector_id: payload.sector_id,
          sector_ids: payload.sector_ids,
          applies_to_all_disasters: payload.applies_to_all_disasters,
          created_by: authenticatedUser?.id || null,
          is_active: payload.is_active,
          disaster_types: payload.disaster_types,
          items: payload.items,
        });

        setSuccessMessage("Relief pack created successfully.");
      }

      setIsModalOpen(false);
      await loadReliefPackPage();
    } catch (error) {
      setModalErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mayor-relief-pack-templates-page" style={reliefPackPageStyles.pageStack}>
      <PageHeader title="RELIEF PACK TEMPLATES MANAGEMENT" actions={[]} />

      <section
        className="mayor-relief-pack-scope-card"
        style={{ ...shellStyles.card, boxSizing: "border-box" }}
      >
        <div
          className="mayor-relief-pack-scope-grid"
          style={{
            ...pageSpacingStyles.filterGrid,
            gridTemplateColumns:
              activeTab === "relief-packs"
                ? "repeat(4, minmax(0, 1fr))"
                : "repeat(2, minmax(0, 1fr))",
          }}
        >
          {activeTab === "relief-packs" ? (
            <>
              <div>
                <label
                  htmlFor="relief-pack-management-event"
                  style={filterStyles.label}
                >
                  Disaster Event
                </label>
                <div style={filterStyles.selectWrap}>
                  <select
                    id="relief-pack-management-event"
                    value={selectedDisasterEventId}
                    onChange={(event) =>
                      setSelectedDisasterEventId(event.target.value)
                    }
                    disabled={isLoading}
                    style={filterStyles.field}
                  >
                    <option value="">All relief packs</option>
                    {scopedDisasterEvents.map((event) => (
                      <option key={event.id} value={event.id}>
                        {formatDisasterEventOptionLabel(event)}
                      </option>
                    ))}
                  </select>
                  <span style={filterStyles.selectIcon}>
                    <FiChevronDown size={16} />
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="relief-pack-management-barangay"
                  style={filterStyles.label}
                >
                  Barangay
                </label>
                <div style={filterStyles.selectWrap}>
                  <select
                    id="relief-pack-management-barangay"
                    value={selectedBarangayId}
                    onChange={(event) => setSelectedBarangayId(event.target.value)}
                    disabled={isLoading}
                    style={filterStyles.field}
                  >
                    <option value="">All barangays</option>
                    {selectableBarangayOptions.map((barangay) => (
                      <option key={barangay.id} value={barangay.id}>
                        {barangay.name}
                      </option>
                    ))}
                  </select>
                  <span style={filterStyles.selectIcon}>
                    <FiChevronDown size={16} />
                  </span>
                </div>
              </div>
            </>
          ) : null}

          <div>
            <label
              htmlFor="relief-pack-management-pack-type"
              style={filterStyles.label}
            >
              Pack Type
            </label>
            <div style={filterStyles.selectWrap}>
              <select
                id="relief-pack-management-pack-type"
                value={filters.packType}
                onChange={(event) =>
                  handleFilterChange("packType", event.target.value)
                }
                disabled={isLoading}
                style={filterStyles.field}
              >
                <option value="All">All pack types</option>
                {packTypeFilterOptions
                  .filter((packType) => packType !== "All")
                  .map((packType) => (
                    <option key={packType} value={packType}>
                      {packType}
                    </option>
                  ))}
              </select>
              <span style={filterStyles.selectIcon}>
                <FiChevronDown size={16} />
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="relief-pack-management-status"
              style={filterStyles.label}
            >
              Status
            </label>
            <div style={filterStyles.selectWrap}>
              <select
                id="relief-pack-management-status"
                value={selectedStatusFilter}
                onChange={(event) =>
                  handleFilterChange("status", event.target.value)
                }
                disabled={isLoading}
                style={filterStyles.field}
              >
                {statusFilterOptions.map((statusOption) => (
                  <option key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
                  </option>
                ))}
              </select>
              <span style={filterStyles.selectIcon}>
                <FiChevronDown size={16} />
              </span>
            </div>
          </div>
        </div>
      </section>

      <div
        className="mayor-relief-pack-toolbar"
        style={reliefPackPageStyles.customizationToolbar}
      >
        <div
          className="mayor-relief-pack-toolbar-controls"
          style={reliefPackPageStyles.toolbarControlsGroup}
        >
          <div
            className="mayor-relief-pack-search-wrap"
            style={reliefPackPageStyles.customizationSearchWrap}
          >
            <SearchBar
              value={filters.search}
              onChange={(value) => handleFilterChange("search", value)}
              placeholder={
                activeTab === "relief-packs"
                  ? "Search relief packs by name, item, or disaster applicability"
                  : "Search templates by name, item, or disaster applicability"
              }
            />
          </div>

          {activeTab === "customization" ? (
            <div className="mayor-relief-pack-filter-button-wrap">
              <ResponsiveFilterPopover
                isOpen={isFilterOpen}
                onOpenChange={setIsFilterOpen}
                title="Filter Records"
                scopeKey={activeTab}
                trigger={({ ref, ...triggerProps }) => (
                  <button
                    ref={ref}
                    type="button"
                    style={{
                      ...pageHeaderStyles.secondaryButton,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                    {...triggerProps}
                  >
                    <FiFilter size={16} />
                    {activeFilterCount > 0
                      ? `Filter (${activeFilterCount})`
                      : "Filter"}
                  </button>
                )}
              >
                <h3 style={reliefPackPageStyles.filterTitle}>Filter Records</h3>

                <label style={reliefPackPageStyles.filterField}>
                  <span style={reliefPackPageStyles.filterLabel}>Order List</span>
                  <select
                    value={selectedSortOrder}
                    onChange={(event) =>
                      handleFilterChange("sortOrder", event.target.value)
                    }
                    style={reliefPackPageStyles.filterSelect}
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <h3 style={reliefPackPageStyles.filterTitle}>
                  {activeTab === "customization" ? "Disaster Types" : "Availability"}
                </h3>

                {activeTab === "customization" ? (
                  <div style={reliefPackPageStyles.filterList}>
                    {disasterTypeFilterOptions.map((disasterTypeFilter) => (
                      <label
                        key={disasterTypeFilter}
                        style={reliefPackPageStyles.filterOption}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDisasterTypeFilters.includes(
                            disasterTypeFilter,
                          )}
                          onChange={() =>
                            handleToggleDisasterTypeFilter(disasterTypeFilter)
                          }
                          style={{ accentColor: "#2f6499" }}
                        />
                        <span>{disasterTypeFilter}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div style={reliefPackPageStyles.filterList}>
                    {availabilityFilterOptions.map((availabilityFilter) => (
                      <label
                        key={availabilityFilter}
                        style={reliefPackPageStyles.filterOption}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAvailabilityFilters.includes(
                            availabilityFilter,
                          )}
                          onChange={() =>
                            handleToggleAvailabilityFilter(availabilityFilter)
                          }
                          style={{ accentColor: "#2f6499" }}
                        />
                        <span>{availabilityFilter}</span>
                      </label>
                    ))}
                  </div>
                )}

                <div style={reliefPackPageStyles.filterActions}>
                  <button
                    type="button"
                    onClick={handleClearAdvancedFilters}
                    style={reliefPackPageStyles.clearAction}
                  >
                    Clear
                  </button>
                </div>
              </ResponsiveFilterPopover>
            </div>
          ) : null}
        </div>

        <div
          className="mayor-relief-pack-action-group"
          style={reliefPackPageStyles.customizationActionGroup}
        >
          <button
            type="button"
            style={pageHeaderStyles.primaryButton}
            onClick={handleOpenCreateModal}
          >
            <span style={reliefPackPageStyles.createReliefPackIconWrap}>
              <FiShoppingBag size={16} />
              <span style={reliefPackPageStyles.createReliefPackPlus}>
                <FiPlus size={10} strokeWidth={3} />
              </span>
            </span>
            Create Relief Pack
          </button>
        </div>
      </div>

      <section className="mayor-relief-pack-tabs-card" style={reliefPackPageStyles.tabCard}>
        <div className="mayor-relief-pack-tabs" style={reliefPackPageStyles.tabList}>
          <button
            type="button"
            style={getTabStyle(activeTab === "relief-packs")}
            onClick={() => setActiveTab("relief-packs")}
          >
            Relief Packs
          </button>
          <button
            type="button"
            style={getTabStyle(activeTab === "customization")}
            onClick={() => setActiveTab("customization")}
          >
            Pack Customization
          </button>
        </div>
      </section>

      {activeTab === "relief-packs" ? (
        <section
          className="mayor-relief-pack-results-card"
          style={reliefPackPageStyles.reliefPackSection}
        >
          {isLoading ? (
            <p style={helperTextStyle}>Loading relief packs...</p>
          ) : filteredTemplateCards.length === 0 ? (
            <p style={helperTextStyle}>No relief packs match the current filters.</p>
          ) : (
            <div
              className="mayor-relief-pack-card-grid"
              style={reliefPackPageStyles.reliefPackGrid}
            >
              {filteredTemplateCards.map((template) => {
                const shortageItems = template.metrics.shortageItems;
                const isTemplateInactive = template.is_active === false;
                const packTypeStatus = template.is_additional_pack
                  ? "ACTIVE"
                  : "ENDED";
                const demandBreakdown = selectedDisasterEventId
                  ? template.metrics.perBarangayDemand
                  : template.metrics.perEventDemand;

                return (
                  <div
                    key={template.id}
                    style={{
                      ...reliefPackPageStyles.reliefPackCard,
                      ...(isTemplateInactive
                        ? reliefPackPageStyles.reliefPackCardInactive
                        : null),
                    }}
                  >
                    <div style={reliefPackPageStyles.reliefPackCardHeader}>
                      <div style={reliefPackPageStyles.reliefPackCardIdentity}>
                        <h2
                          className="mayor-relief-pack-card-title"
                          style={{
                            ...cardTitleStyle,
                            ...(isTemplateInactive
                              ? reliefPackPageStyles.inactiveCardTitle
                              : null),
                          }}
                        >
                          {template.name.toUpperCase()}
                        </h2>
                        <div
                          style={reliefPackPageStyles.reliefPackCardPackType}
                        >
                          <StatusPill
                            status={packTypeStatus}
                            label={getTemplatePackTypeLabel(template)}
                            style={
                              isTemplateInactive
                                ? reliefPackPageStyles.inactiveCardPackTypePill
                                : undefined
                            }
                          />
                        </div>
                      </div>
                      <div style={reliefPackPageStyles.reliefPackCardActions}>
                        <button
                          type="button"
                          style={reliefPackPageStyles.viewDetailsIconButton}
                          onClick={() => handleOpenDetailModal(template)}
                          title="View Relief Pack Details"
                          aria-label={`View details for ${template.name}`}
                        >
                          <FiEye size={18} />
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        ...summaryBoxStyle,
                        ...(isTemplateInactive
                          ? reliefPackPageStyles.inactiveSummaryBox
                          : null),
                      }}
                    >
                      <div style={reliefPackPageStyles.metricHeader}>
                        <p
                          style={{
                            ...reliefPackPageStyles.metricLabel,
                            ...(isTemplateInactive
                              ? reliefPackPageStyles.inactiveMetricLabel
                              : null),
                          }}
                        >
                          Packs Needed
                        </p>
                        <p
                          style={
                            isTemplateInactive
                              ? reliefPackPageStyles.inactiveMetricValue
                              : reliefPackPageStyles.metricValue
                          }
                        >
                          {isTemplateInactive
                            ? "—"
                            : template.metrics.neededPacks.toLocaleString()}
                        </p>
                      </div>

                      {isTemplateInactive ? null : isLoadingDemand ? (
                        <p style={{ fontSize: "12px", margin: "12px 0 0" }}>
                          Loading demand...
                        </p>
                      ) : demandBreakdown.length > 0 ? (
                        <div style={reliefPackPageStyles.barangayDemandList}>
                          {demandBreakdown.map((demandEntry) => (
                            <span
                              key={
                                selectedDisasterEventId
                                  ? `${template.id}-${demandEntry.barangay_id}`
                                  : `${template.id}-${demandEntry.disaster_event_id}`
                              }
                            >
                              {selectedDisasterEventId
                                ? demandEntry.barangay_name
                                : demandEntry.disaster_event_name}
                              : {demandEntry.packs_needed}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: "12px", margin: "12px 0 0" }}>
                          No active event demand found.
                        </p>
                      )}
                    </div>

                    {shortageItems.length > 0 ? (
                      <div style={alertBoxStyle}>
                        <div style={reliefPackPageStyles.shortageHeader}>
                          <p style={reliefPackPageStyles.shortageTitle}>
                            Items Still Needed
                          </p>
                        </div>
                        <div style={reliefPackPageStyles.shortageList}>
                          {shortageItems.slice(0, 3).map((item) => (
                            <div
                              key={`${template.id}-${item.inventory_item_id}`}
                              style={reliefPackPageStyles.shortageRow}
                            >
                              <span
                                className="mayor-relief-pack-long-text"
                                style={reliefPackPageStyles.shortageItemName}
                              >
                                {item.item_name}
                              </span>
                              <span style={reliefPackPageStyles.shortageQuantity}>
                                {item.shortage_quantity} pcs
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <>
          <section
            className="mayor-relief-pack-customization-card"
            style={reliefPackPageStyles.customizationTableSection}
          >
            <div style={{ marginBottom: "18px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>
                Relief Pack Templates
              </h3>
            </div>

            {isLoading ? (
              <p style={helperTextStyle}>Loading pack customization...</p>
            ) : filteredTemplateCards.length === 0 ? (
            <p style={helperTextStyle}>No relief packs match the current filters.</p>
            ) : (
              <div
                className="mayor-relief-pack-template-table-scroll"
                style={reliefPackPageStyles.customizationTableScroll}
              >
                <table
                  className="mayor-relief-pack-template-table"
                  style={tableStyles.table}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          ...tableStyles.headerCell,
                          ...tableStyles.leftCell,
                          ...tableStyles.nameCell,
                        }}
                      >
                        Name
                      </th>
                      <th
                        style={{
                          ...tableStyles.headerCell,
                          ...tableStyles.packTypeCell,
                        }}
                      >
                        Pack Type
                      </th>
                      <th
                        style={{
                          ...tableStyles.headerCell,
                          ...tableStyles.leftCell,
                          ...tableStyles.itemsCell,
                        }}
                      >
                        Items
                      </th>
                      <th
                        style={{
                          ...tableStyles.headerCell,
                          ...tableStyles.quantityCell,
                        }}
                      >
                        Qty / Item
                      </th>
                      <th
                        className="mayor-relief-pack-template-rule-cell"
                        style={{
                          ...tableStyles.headerCell,
                          ...tableStyles.ruleCell,
                        }}
                      >
                        Rule
                      </th>
                      <th
                        className="mayor-relief-pack-template-applies-cell"
                        style={{
                          ...tableStyles.headerCell,
                          ...tableStyles.applicabilityCell,
                        }}
                      >
                        Applies To
                      </th>
                      <th
                        className="mayor-relief-pack-template-status-cell"
                        style={{
                          ...tableStyles.headerCell,
                          ...tableStyles.statusCell,
                        }}
                      >
                        Status
                      </th>
                      <th
                        className="mayor-relief-pack-template-actions-cell"
                        style={{
                          ...tableStyles.headerCell,
                          ...tableStyles.actionCell,
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTemplateCards.map((template) => {
                      const isTemplateInactive = template.is_active === false;

                      return (
                        <tr key={template.id}>
                        <td
                          style={{
                            ...tableStyles.bodyCell,
                            ...tableStyles.leftCell,
                            ...tableStyles.nameCell,
                          }}
                        >
                          <div className="mayor-relief-pack-template-name">
                            {template.name}
                          </div>
                        </td>
                        <td
                          style={{
                            ...tableStyles.bodyCell,
                            ...tableStyles.packTypeCell,
                          }}
                        >
                          <StatusPill
                            status={template.is_additional_pack ? "ACTIVE" : "ENDED"}
                            label={getTemplatePackTypeLabel(template)}
                          />
                        </td>
                        <td
                          style={{
                            ...tableStyles.bodyCell,
                            ...tableStyles.leftCell,
                            ...tableStyles.itemsCell,
                          }}
                        >
                          {(template.items || []).length > 0 ? (
                            <div style={tableStyles.stackedList}>
                              {(template.items || []).map((item, index) => (
                                <div
                                  key={item.id || `${template.id}-${item.inventory_item_id}`}
                                  style={tableStyles.itemRow}
                                >
                                  <span
                                    className="mayor-relief-pack-template-item-name"
                                    style={tableStyles.itemName}
                                  >
                                    {item.inventory_item?.item_name || "--"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={tableStyles.helperText}>No items</span>
                          )}
                        </td>
                        <td
                          style={{
                            ...tableStyles.bodyCell,
                            ...tableStyles.quantityCell,
                          }}
                        >
                          {(template.items || []).length > 0 ? (
                            <div style={tableStyles.stackedList}>
                              {(template.items || []).map((item, index) => (
                                <div
                                  key={`qty-${item.id || `${template.id}-${item.inventory_item_id}`}`}
                                  style={{
                                    ...tableStyles.itemRow,
                                    justifyContent: "center",
                                  }}
                                >
                                  <span style={tableStyles.itemQuantity}>
                                    {formatTemplateItemQuantity(item)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={tableStyles.helperText}>--</span>
                          )}
                        </td>
                        <td
                          className="mayor-relief-pack-template-rule-cell"
                          style={{
                            ...tableStyles.bodyCell,
                            ...tableStyles.ruleCell,
                          }}
                        >
                          <div style={tableStyles.pillWrap}>
                            {getTemplateRuleLabels(template, sectorOptions).map((label) => (
                              <span
                                className="mayor-relief-pack-template-rule-chip"
                                key={`${template.id}-rule-${label}`}
                                style={tableStyles.infoPill}
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td
                          className="mayor-relief-pack-template-applies-cell"
                          style={{
                            ...tableStyles.bodyCell,
                            ...tableStyles.applicabilityCell,
                          }}
                        >
                          <div style={tableStyles.pillWrap}>
                            {getTemplateDisasterApplicabilityLabels(template).map(
                              (label) => (
                                <span
                                  className="mayor-relief-pack-template-applies-chip"
                                  key={`${template.id}-${label}`}
                                  style={tableStyles.infoPill}
                                >
                                  {label}
                                </span>
                              ),
                            )}
                          </div>
                        </td>
                        <td
                          className="mayor-relief-pack-template-status-cell"
                          style={{
                            ...tableStyles.bodyCell,
                            ...tableStyles.statusCell,
                          }}
                        >
                          <span>
                            {isTemplateInactive ? "Inactive" : "Active"}
                          </span>
                        </td>
                        <td
                          className="mayor-relief-pack-template-actions-cell"
                          style={{
                            ...tableStyles.bodyCell,
                            ...tableStyles.actionCell,
                          }}
                        >
                          <TableActionsMenu
                            row={template}
                            menuId={`relief-pack-template-${template.id}`}
                            buttonTitle="Actions"
                            buttonAriaLabel="Actions"
                            dataPrefix="relief-pack-template-action"
                            menuWidth={168}
                            variant="icon-grid"
                            items={[
                              {
                                key: "view",
                                label: "View Relief Pack Template",
                                icon: <FiEye size={18} />,
                                onClick: (selectedRow) =>
                                  handleOpenDetailModal(selectedRow, "customization"),
                              },
                              {
                                key: "edit",
                                label: "Edit Relief Pack Template",
                                icon: <FiEdit2 size={18} />,
                                onClick: (selectedRow) =>
                                  handleOpenEditModal(selectedRow.id),
                              },
                              {
                                key: "status",
                                label: isTemplateInactive
                                  ? "Activate Relief Pack"
                                  : "Deactivate Relief Pack",
                                icon: <FiPower size={18} />,
                                onClick: (selectedRow) =>
                                  handleOpenStatusConfirmation(selectedRow),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {errorMessage ? (
        <section style={shellStyles.card}>
          <p style={{ ...helperTextStyle, color: "#9d4d58" }}>{errorMessage}</p>
        </section>
      ) : null}

      {successMessage ? (
        <section style={shellStyles.card}>
          <p style={{ ...helperTextStyle, color: "#17663a" }}>
            {successMessage}
          </p>
        </section>
      ) : null}

      <ReliefPackTemplateDetailModal
        isOpen={Boolean(detailTemplateId)}
        template={detailTemplate}
        isLoadingDemand={isLoadingDemand}
        sectorOptions={sectorOptions}
        viewContext={detailViewContext}
        onClose={handleCloseDetailModal}
      />

      <ReliefPackTemplateStatusConfirmModal
        isOpen={Boolean(statusTemplate)}
        template={statusTemplate}
        isSubmitting={isUpdatingStatus}
        applicabilityLabels={getTemplateDisasterApplicabilityLabels(statusTemplate)}
        errorMessage={statusErrorMessage}
        onCancel={handleCloseStatusConfirmation}
        onConfirm={handleConfirmStatusChange}
      />

      <ReliefPackTemplateDeactivationBlockedModal
        isOpen={Boolean(deactivationBlockedMessage)}
        message={deactivationBlockedMessage}
        onClose={handleCloseDeactivationBlockedModal}
      />

      <ReliefPackTemplateFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        templateData={selectedTemplate}
        inventoryItems={inventoryItems}
        sectorOptions={sectorOptions}
        existingTemplates={templates}
        errorMessage={modalErrorMessage}
        onClose={handleCloseModal}
        onSubmit={handleSubmitModal}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default ReliefPackTemplatesPage;
