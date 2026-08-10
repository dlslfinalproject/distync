import React, { useCallback, useEffect, useRef, useMemo, useState } from "react";
import PageHeader, {
  pageHeaderStyles,
} from "../../components/layout/PageHeader";
import {
  pageSpacingStyles,
  shellStyles,
} from "../../components/layout/BarangayLayout";
import SearchBar from "../../components/shared/SearchBar";
import ReliefPackTemplateFormModal from "../../components/relief-pack-templates/ReliefPackTemplateFormModal";
import TableActionsMenu from "../../components/shared/TableActionsMenu";
import StatusPill from "../../components/shared/StatusPill";
import DetailsModalShell from "../../components/shared/DetailsModalShell";
import {
  createReliefPackTemplate,
  fetchInventoryItems,
  fetchReliefPackTemplateById,
  fetchReliefPackTemplates,
  updateReliefPackTemplate,
} from "../../features/relief-pack-templates/reliefPackTemplateService";
import {
  fetchActiveDisasterEvents,
  fetchBarangays,
} from "../../features/disaster-events/disasterEventService";
import { fetchInventoryBatches } from "../../features/inventory-batches/inventoryBatchService";
import { fetchSectors } from "../../features/household-registration/householdRegistrationService";
import { fetchConsolidatedMasterlist } from "../../features/mswdo-masterlist/mswdoMasterlistService";
import { DISASTER_TYPE_OPTIONS } from "../../features/disaster-events/disasterTypeOptions";
import { useAuth } from "../../context/AuthContext";
import {
  FiChevronDown,
  FiEdit2,
  FiEye,
  FiFilter,
  FiPlus,
  FiShoppingBag,
} from "react-icons/fi";

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

const FILTER_PANEL_GAP = 12;
const FILTER_PANEL_VIEWPORT_PADDING = 16;
const MIN_FILTER_PANEL_HEIGHT = 220;

const getFilterPanelPosition = ({ triggerRect, panelHeight }) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const constrainedPanelWidth = Math.min(
    360,
    viewportWidth - FILTER_PANEL_VIEWPORT_PADDING * 2,
  );
  const safePanelHeight = Math.max(panelHeight || 0, MIN_FILTER_PANEL_HEIGHT);
  const spaceBelow =
    viewportHeight - triggerRect.bottom - FILTER_PANEL_VIEWPORT_PADDING;
  const spaceAbove = triggerRect.top - FILTER_PANEL_VIEWPORT_PADDING;
  const shouldOpenBelow =
    spaceBelow >= MIN_FILTER_PANEL_HEIGHT || spaceBelow >= spaceAbove;

  let left = triggerRect.right - constrainedPanelWidth;
  left = Math.min(
    Math.max(left, FILTER_PANEL_VIEWPORT_PADDING),
    viewportWidth - constrainedPanelWidth - FILTER_PANEL_VIEWPORT_PADDING,
  );

  if (shouldOpenBelow) {
    const top = Math.max(
      FILTER_PANEL_VIEWPORT_PADDING,
      triggerRect.bottom + FILTER_PANEL_GAP,
    );
    const availableHeight =
      viewportHeight - top - FILTER_PANEL_VIEWPORT_PADDING;

    return {
      top,
      left,
      maxHeight: Math.max(availableHeight, 0),
    };
  }

  const maxHeight = Math.max(
    triggerRect.top - FILTER_PANEL_GAP - FILTER_PANEL_VIEWPORT_PADDING,
    0,
  );
  const top = Math.max(
    FILTER_PANEL_VIEWPORT_PADDING,
    triggerRect.top - FILTER_PANEL_GAP - Math.min(safePanelHeight, maxHeight),
  );

  return {
    top,
    left,
    maxHeight,
  };
};

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
  },
  reliefPackCardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "20px",
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
  inlineSelectWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: "0 0 auto",
  },
  inlineSelectLabel: {
    color: "#17324d",
    fontSize: "14px",
    fontWeight: 700,
  },
  inlineSelect: {
    minWidth: "150px",
    border: "1px solid #c7d6e5",
    borderRadius: "12px",
    padding: "10px 12px",
    background: "#ffffff",
    color: "#17324d",
    fontSize: "14px",
    fontWeight: 600,
    outline: "none",
    boxSizing: "border-box",
    appearance: "auto",
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
    width: "16%",
  },
  applicabilityCell: {
    width: "14%",
  },
  availableCell: {
    width: "7%",
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

const isHouseholdStillNeedingReliefPack = (household) => {
  const stubStatus = String(household?.stub?.status || "").toUpperCase();
  const stayType = String(household?.current_stay_type || "").toUpperCase();
  const latestAttendanceStatus = String(
    household?.latest_attendance?.status || "",
  ).toUpperCase();

  if (stubStatus === "CLAIMED") {
    return false;
  }

  if (stayType !== "EVAC_CENTER") {
    return false;
  }

  if (household?.is_active === false || household?.latest_attendance?.time_out) {
    return false;
  }

  return (
    latestAttendanceStatus === "PRESENT" ||
    latestAttendanceStatus === "ARRIVED" ||
    Boolean(household?.latest_attendance?.time_in)
  );
};

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

const NEAR_EXPIRY_DAYS = 30;

const isBatchNearExpiry = (expirationDate) => {
  if (!expirationDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thresholdDate = new Date(today);
  thresholdDate.setDate(thresholdDate.getDate() + NEAR_EXPIRY_DAYS);

  const parsedExpirationDate = new Date(expirationDate);
  parsedExpirationDate.setHours(0, 0, 0, 0);

  return (
    !Number.isNaN(parsedExpirationDate.getTime()) &&
    parsedExpirationDate >= today &&
    parsedExpirationDate <= thresholdDate
  );
};

const buildAvailabilityByItemId = (inventoryBatches) => {
  const availabilityByItemId = new Map();

  (inventoryBatches || []).forEach((batch) => {
    if (
      !batch?.inventory_item_id ||
      !["AVAILABLE", "LOW_STOCK"].includes(batch.status) ||
      isBatchNearExpiry(batch.expiration_date) ||
      Number(batch.quantity_available || 0) <= 0
    ) {
      return;
    }

    const totalAvailableQuantity = Number(batch.quantity_available || 0);

    availabilityByItemId.set(
      batch.inventory_item_id,
      (availabilityByItemId.get(batch.inventory_item_id) || 0) +
        totalAvailableQuantity,
    );
  });

  return availabilityByItemId;
};

const computeTemplateMetrics = ({
  template,
  availabilityByItemId,
  households,
}) => {
  const items = template.items || [];
  const applicableHouseholds = getTemplateApplicableHouseholds(template, households);
  const demand = buildTemplateDemand(template, applicableHouseholds);

  const packsWeCanCreate = items.length
    ? Math.min(
        ...items.map((item) => {
          const availableQuantity =
            availabilityByItemId.get(item.inventory_item_id) || 0;
          const requiredQuantity = getTemplateItemRequiredQuantity(item);

          if (!requiredQuantity) {
            return 0;
          }

          return Math.floor(availableQuantity / requiredQuantity);
        }),
      )
    : 0;

  const shortageItems = items
    .map((item) => {
      const availableQuantity = availabilityByItemId.get(item.inventory_item_id) || 0;
      const requiredQuantity = getTemplateItemRequiredQuantity(item);
      const totalRequired = demand.neededPacks * requiredQuantity;
      const shortageQuantity = Math.max(totalRequired - availableQuantity, 0);

      return {
        inventory_item_id: item.inventory_item_id,
        item_name: item.inventory_item?.item_name || "Unknown item",
        shortage_quantity: shortageQuantity,
      };
    })
    .filter((item) => item.shortage_quantity > 0)
    .sort((leftItem, rightItem) => rightItem.shortage_quantity - leftItem.shortage_quantity);

  return {
    packsWeCanCreate: Number.isFinite(packsWeCanCreate) ? packsWeCanCreate : 0,
    neededPacks: demand.neededPacks,
    perBarangayDemand: demand.perBarangayDemand.slice(0, 6),
    perEventDemand: demand.perEventDemand.slice(0, 6),
    shortageItems,
  };
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

const getTemplateDisasterApplicabilityLabels = (template) => {
  if (template?.applies_to_all_disasters !== false) {
    return ["All disaster types"];
  }

  const disasterTypes = Array.isArray(template?.disaster_types)
    ? template.disaster_types
    : [];

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

const getTemplateSortableTimestamp = (template) => {
  const timestamp = new Date(
    template?.created_at || template?.updated_at || 0,
  ).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
};

const sortTemplateCards = (templateList, sortOrder) => {
  const sortedTemplates = [...(templateList || [])];

  if (sortOrder === "newest") {
    return sortedTemplates.sort(
      (leftTemplate, rightTemplate) =>
        getTemplateSortableTimestamp(rightTemplate) -
        getTemplateSortableTimestamp(leftTemplate),
    );
  }

  if (sortOrder === "az") {
    return sortedTemplates.sort((leftTemplate, rightTemplate) =>
      String(leftTemplate?.name || "").localeCompare(
        String(rightTemplate?.name || ""),
      ),
    );
  }

  if (sortOrder === "za") {
    return sortedTemplates.sort((leftTemplate, rightTemplate) =>
      String(rightTemplate?.name || "").localeCompare(
        String(leftTemplate?.name || ""),
      ),
    );
  }

  return sortedTemplates.sort(
    (leftTemplate, rightTemplate) =>
      getTemplateSortableTimestamp(leftTemplate) -
      getTemplateSortableTimestamp(rightTemplate),
  );
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

const matchesTemplateAvailabilityFilter = (template, availabilityFilters) => {
  if (!Array.isArray(availabilityFilters) || availabilityFilters.length === 0) {
    return true;
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

const getTemplateSourceTypes = (template, inventoryBatches) => {
  const templateItemIds = new Set(
    (template?.items || [])
      .map((item) => item.inventory_item_id)
      .filter(Boolean),
  );

  if (templateItemIds.size === 0) {
    return [];
  }

  return Array.from(
    new Set(
      (inventoryBatches || [])
        .filter((batch) => templateItemIds.has(batch.inventory_item_id))
        .map((batch) => String(batch.source_type || "").toUpperCase())
        .filter(Boolean),
    ),
  );
};

const isDonatedReliefPackTemplate = (template, inventoryBatches) => {
  const sourceTypes = getTemplateSourceTypes(template, inventoryBatches);

  return sourceTypes.length > 0 && sourceTypes.every((sourceType) => sourceType === "DONATED");
};

const ReliefPackTemplateDetailModal = ({
  isOpen,
  template,
  availabilityByItemId,
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
  };
  const items = Array.isArray(template?.items) ? template.items : [];
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

  return (
    <DetailsModalShell
      isOpen={isOpen}
      title="View Details"
      onClose={onClose}
      maxWidth="980px"
      closeMode="icon"
      titleStyle={{ fontSize: "30px", fontWeight: 700 }}
      panelStyle={reliefPackDetailModalStyles.shellPanel}
    >
      {!template ? (
        <section style={reliefPackDetailModalStyles.sectionCard}>
          <p style={{ ...shellStyles.mutedText, margin: 0 }}>
            Relief pack details are unavailable.
          </p>
        </section>
      ) : (
        <div style={{ display: "grid", gap: "20px" }}>
          <section style={reliefPackDetailModalStyles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Pack Information</h3>
            <div
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
                <p style={reliefPackDetailModalStyles.label}>Packs Available</p>
                <p style={reliefPackDetailModalStyles.metricValue}>
                  {metrics.packsWeCanCreate.toLocaleString()}
                </p>
              </div>
              {isCustomizationView ? null : (
                <div>
                  <p style={reliefPackDetailModalStyles.label}>Packs Needed</p>
                  <p style={reliefPackDetailModalStyles.metricValue}>
                    {metrics.neededPacks.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </section>

          {isCustomizationView ? (
            <section style={reliefPackDetailModalStyles.sectionCard}>
              <h3 style={{ margin: 0, color: "#17324d" }}>
                Rules & Applicability
              </h3>
              <div
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

          <section style={reliefPackDetailModalStyles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>Items Included</h3>

            {items.length === 0 ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                No items are recorded in this relief pack.
              </p>
            ) : (
              <div style={reliefPackDetailModalStyles.tableWrap}>
                <table style={reliefPackDetailModalStyles.table}>
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
                        availabilityByItemId.get(item.inventory_item_id) || 0;
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
                                {neededQuantity.toLocaleString()} pcs
                              </td>
                              <td style={reliefPackDetailModalStyles.td}>
                                <span
                                  style={
                                    shortageQuantity > 0
                                      ? reliefPackDetailModalStyles.shortageText
                                      : reliefPackDetailModalStyles.healthyText
                                  }
                                >
                                  {shortageQuantity > 0
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
            <section style={reliefPackDetailModalStyles.sectionCard}>
            <h3 style={{ margin: 0, color: "#17324d" }}>
              Packs Needed per Barangay
            </h3>

            {isLoadingDemand ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                Loading demand...
              </p>
            ) : metrics.perBarangayDemand.length === 0 ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                No active event demand found.
              </p>
            ) : (
              <div style={reliefPackDetailModalStyles.tableWrap}>
                <table style={reliefPackDetailModalStyles.table}>
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
    availability: [],
    disasterTypes: [],
    sortOrder: "oldest",
  });
  const [templates, setTemplates] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryBatches, setInventoryBatches] = useState([]);
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
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [modalErrorMessage, setModalErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailTemplateId, setDetailTemplateId] = useState(null);
  const [detailViewContext, setDetailViewContext] = useState("relief-packs");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterPanelPosition, setFilterPanelPosition] = useState({
    top: 0,
    left: 0,
    maxHeight: 320,
  });
  const filterButtonRef = useRef(null);
  const filterPanelRef = useRef(null);
  const selectedAvailabilityFilters = Array.isArray(filters.availability)
    ? filters.availability
    : [];
  const selectedDisasterTypeFilters = Array.isArray(filters.disasterTypes)
    ? filters.disasterTypes
    : [];
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
        activeDisasterEventResponse,
        barangayResponse,
        sectorResponse,
      ] = await Promise.all([
        fetchReliefPackTemplates({ is_active: "true" }),
        fetchInventoryItems(),
        fetchInventoryBatches(),
        fetchActiveDisasterEvents(),
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
      setActiveDisasterEvents(
        sortDisasterEventsNewestFirst(activeDisasterEventResponse),
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

  const updateFilterPanelPosition = useCallback(() => {
    if (!filterButtonRef.current) {
      return;
    }

    const triggerRect = filterButtonRef.current.getBoundingClientRect();
    const panelHeight =
      filterPanelRef.current?.getBoundingClientRect().height || 0;

    setFilterPanelPosition(
      getFilterPanelPosition({ triggerRect, panelHeight }),
    );
  }, []);

  useEffect(() => {
    if (!isFilterOpen) {
      return undefined;
    }

    updateFilterPanelPosition();

    const handleWindowChange = () => {
      updateFilterPanelPosition();
    };

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [activeFilterCount, isFilterOpen, updateFilterPanelPosition]);

  useEffect(() => {
    if (!isFilterOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (
        filterPanelRef.current?.contains(event.target) ||
        filterButtonRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsFilterOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isFilterOpen]);

  useEffect(() => {
    if (!isFilterOpen) {
      return undefined;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      updateFilterPanelPosition();
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [activeFilterCount, isFilterOpen, updateFilterPanelPosition]);

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
        const [templateResponse, inventoryItemResponse, inventoryBatchResponse] =
          await Promise.all([
            fetchReliefPackTemplates({ is_active: "true" }),
            fetchInventoryItems(),
            fetchInventoryBatches(),
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
            .filter(isHouseholdStillNeedingReliefPack)
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

  const availabilityByItemId = useMemo(
    () => buildAvailabilityByItemId(inventoryBatches),
    [inventoryBatches],
  );

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

  const fullDemandTemplateCards = useMemo(() => {
    return templates.map((template) => ({
      ...template,
      metrics: computeTemplateMetrics({
        template,
        availabilityByItemId,
        households: aggregatedDemand.households,
      }),
    }));
  }, [aggregatedDemand.households, availabilityByItemId, templates]);

  const templateCards = useMemo(() => {
    return templates.map((template) => ({
      ...template,
      metrics: computeTemplateMetrics({
        template,
        availabilityByItemId,
        households: scopedDemandHouseholds,
      }),
    }));
  }, [availabilityByItemId, scopedDemandHouseholds, templates]);

  const filteredTemplateCards = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();

    const filteredTemplates = templateCards.filter((template) => {
      if (!matchesTemplatePackTypeFilter(template, filters.packType)) {
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

    return sortTemplateCards(filteredTemplates, selectedSortOrder);
  }, [
    activeTab,
    filters.packType,
    filters.search,
    sectorOptions,
    selectedAvailabilityFilters,
    selectedDisasterTypeFilters,
    selectedSortOrder,
    templateCards,
  ]);

  const templateAccessMap = useMemo(() => {
    return new Map(
      templates.map((template) => [
        template.id,
        {
          isDonatedTemplate: isDonatedReliefPackTemplate(template, inventoryBatches),
        },
      ]),
    );
  }, [templates, inventoryBatches]);

  const detailTemplate = useMemo(() => {
    if (!detailTemplateId) {
      return null;
    }

    return (
      fullDemandTemplateCards.find((template) => template.id === detailTemplateId) ||
      null
    );
  }, [detailTemplateId, fullDemandTemplateCards]);

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
    handleFilterChange("sortOrder", "oldest");
    handleFilterChange(
      activeTab === "customization" ? "disasterTypes" : "availability",
      [],
    );
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
    <div style={reliefPackPageStyles.pageStack}>
      <PageHeader title="RELIEF PACK TEMPLATES MANAGEMENT" actions={[]} />

      {activeTab === "relief-packs" ? (
        <section style={{ ...shellStyles.card, boxSizing: "border-box" }}>
          <div style={pageSpacingStyles.filterGrid}>
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
                  onChange={(event) => setSelectedDisasterEventId(event.target.value)}
                  disabled={isLoading}
                  style={filterStyles.field}
                >
                  <option value="">All active disaster events</option>
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
          </div>
        </section>
      ) : null}

      <div style={reliefPackPageStyles.customizationToolbar}>
        <div style={reliefPackPageStyles.toolbarControlsGroup}>
          <div style={reliefPackPageStyles.customizationSearchWrap}>
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

          <div style={reliefPackPageStyles.inlineSelectWrap}>
            <label
              htmlFor="relief-pack-type-filter"
              style={reliefPackPageStyles.inlineSelectLabel}
            >
              Pack
            </label>
            <select
              id="relief-pack-type-filter"
              value={filters.packType}
              onChange={(event) =>
                handleFilterChange("packType", event.target.value)
              }
              style={reliefPackPageStyles.inlineSelect}
            >
              {packTypeFilterOptions.map((packType) => (
                <option key={packType} value={packType}>
                  {packType}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              ref={filterButtonRef}
              type="button"
              onClick={() => setIsFilterOpen((currentValue) => !currentValue)}
              style={{
                ...pageHeaderStyles.secondaryButton,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FiFilter size={16} />
              {activeFilterCount > 0 ? `Filter (${activeFilterCount})` : "Filter"}
            </button>

            {isFilterOpen ? (
              <div
                ref={filterPanelRef}
                style={{
                  ...reliefPackPageStyles.filterPanel,
                  top: filterPanelPosition.top,
                  left: filterPanelPosition.left,
                  maxHeight: filterPanelPosition.maxHeight,
                }}
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
              </div>
            ) : null}
          </div>
        </div>

        <div style={reliefPackPageStyles.customizationActionGroup}>
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

      <section style={reliefPackPageStyles.tabCard}>
        <div style={reliefPackPageStyles.tabList}>
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
        <section style={reliefPackPageStyles.reliefPackSection}>
          {isLoading ? (
            <p style={helperTextStyle}>Loading relief packs...</p>
          ) : filteredTemplateCards.length === 0 ? (
            <p style={helperTextStyle}>No active relief packs are available yet.</p>
          ) : (
            <div style={reliefPackPageStyles.reliefPackGrid}>
              {filteredTemplateCards.map((template) => {
                const shortageItems = template.metrics.shortageItems;
                const packTypeStatus = template.is_additional_pack
                  ? "ACTIVE"
                  : "ENDED";
                const demandBreakdown = selectedDisasterEventId
                  ? template.metrics.perBarangayDemand
                  : template.metrics.perEventDemand;

                return (
                  <div
                    key={template.id}
                    style={reliefPackPageStyles.reliefPackCard}
                  >
                    <div style={reliefPackPageStyles.reliefPackCardHeader}>
                      <h2 style={cardTitleStyle}>{template.name.toUpperCase()}</h2>
                      <div style={reliefPackPageStyles.reliefPackCardActions}>
                        <StatusPill
                          status={packTypeStatus}
                          label={getTemplatePackTypeLabel(template)}
                        />
                        <button
                          type="button"
                          style={reliefPackPageStyles.viewDetailsIconButton}
                          onClick={() => handleOpenDetailModal(template)}
                          title="View Details"
                          aria-label={`View details for ${template.name}`}
                        >
                          <FiEye size={18} />
                        </button>
                      </div>
                    </div>

                    <div style={summaryBoxStyle}>
                      <div style={reliefPackPageStyles.metricHeader}>
                        <p style={reliefPackPageStyles.metricLabel}>
                          Packs Available
                        </p>
                        <p style={reliefPackPageStyles.metricValue}>
                          {template.metrics.packsWeCanCreate.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div style={summaryBoxStyle}>
                      <div style={reliefPackPageStyles.metricHeader}>
                        <p style={reliefPackPageStyles.metricLabel}>
                          Packs Needed
                        </p>
                        <p style={reliefPackPageStyles.metricValue}>
                          {template.metrics.neededPacks.toLocaleString()}
                        </p>
                      </div>

                      {isLoadingDemand ? (
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
                              <span style={reliefPackPageStyles.shortageItemName}>
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
          <section style={reliefPackPageStyles.customizationTableSection}>
            <div style={{ marginBottom: "18px" }}>
              <h3 style={{ margin: 0, color: "#17324d" }}>
                Relief Pack Templates
              </h3>
            </div>

            {isLoading ? (
              <p style={helperTextStyle}>Loading pack customization...</p>
            ) : filteredTemplateCards.length === 0 ? (
              <p style={helperTextStyle}>No active relief packs are available yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyles.table}>
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
                        style={{
                          ...tableStyles.headerCell,
                          ...tableStyles.ruleCell,
                        }}
                      >
                        Rule
                      </th>
                      <th
                        style={{
                          ...tableStyles.headerCell,
                          ...tableStyles.applicabilityCell,
                        }}
                      >
                        Applies To
                      </th>
                      <th
                        style={{
                          ...tableStyles.headerCell,
                          ...tableStyles.availableCell,
                        }}
                      >
                        Available
                      </th>
                      <th
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
                      const templateAccess = templateAccessMap.get(template.id) || {
                        isDonatedTemplate: false,
                      };

                      return (
                        <tr key={template.id}>
                        <td
                          style={{
                            ...tableStyles.bodyCell,
                            ...tableStyles.leftCell,
                            ...tableStyles.nameCell,
                          }}
                        >
                          <div>{template.name}</div>
                          {templateAccess.isDonatedTemplate ? (
                            <span style={tableStyles.helperText}>Donated relief pack</span>
                          ) : null}
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
                                  <span style={tableStyles.itemName}>
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
                          style={{
                            ...tableStyles.bodyCell,
                            ...tableStyles.ruleCell,
                          }}
                        >
                          <div style={tableStyles.pillWrap}>
                            {getTemplateRuleLabels(template, sectorOptions).map((label) => (
                              <span
                                key={`${template.id}-rule-${label}`}
                                style={tableStyles.infoPill}
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td
                          style={{
                            ...tableStyles.bodyCell,
                            ...tableStyles.applicabilityCell,
                          }}
                        >
                          <div style={tableStyles.pillWrap}>
                            {getTemplateDisasterApplicabilityLabels(template).map(
                              (label) => (
                                <span
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
                          style={{
                            ...tableStyles.bodyCell,
                            ...tableStyles.availableCell,
                          }}
                        >
                          {template.metrics.packsWeCanCreate.toLocaleString()}
                        </td>
                        <td
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
                            menuWidth={112}
                            variant="icon-grid"
                            items={[
                              {
                                key: "view",
                                label: "View Relief Pack",
                                icon: <FiEye size={18} />,
                                onClick: (selectedRow) =>
                                  handleOpenDetailModal(selectedRow, "customization"),
                              },
                              ...(!templateAccess.isDonatedTemplate
                                ? [
                                    {
                                      key: "edit",
                                      label: "Edit Relief Pack",
                                      icon: <FiEdit2 size={18} />,
                                      onClick: (selectedRow) =>
                                        handleOpenEditModal(selectedRow.id),
                                    },
                                  ]
                                : []),
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
        availabilityByItemId={availabilityByItemId}
        isLoadingDemand={isLoadingDemand}
        sectorOptions={sectorOptions}
        viewContext={detailViewContext}
        onClose={handleCloseDetailModal}
      />

      <ReliefPackTemplateFormModal
        isOpen={isModalOpen}
        mode={modalMode}
        templateData={selectedTemplate}
        inventoryItems={inventoryItems}
        sectorOptions={sectorOptions}
        errorMessage={modalErrorMessage}
        onClose={handleCloseModal}
        onSubmit={handleSubmitModal}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default ReliefPackTemplatesPage;
