import React from "react";
import { resolveFamilyHeadPhoto } from "../../features/masterlist/familyHeadPhoto";
import DetailsModalShell from "../shared/DetailsModalShell";
import EmptyState from "../shared/EmptyState";
import ErrorState from "../shared/ErrorState";
import LoadingState from "../shared/LoadingState";
import StatusPill from "../shared/StatusPill";
import { shellStyles } from "../layout/BarangayLayout";
import QrCodePanel from "../stubs/QrCodePanel";
import { formatStayTypeLabel } from "../../utils/stayType";
import {
  getReliefPackReadinessForTemplates,
  RELIEF_PACK_READINESS_STATUS,
} from "../../features/relief-pack-templates/reliefPackReadiness";

const styles = {
  shellPanel: {
    backgroundColor: "#eef5fb",
    border: "1px solid #d7e2ef",
    boxShadow: "0 24px 60px rgba(23, 50, 77, 0.18)",
  },
  sectionCard: {
    ...shellStyles.card,
    backgroundColor: "#ffffff",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    alignItems: "start",
  },
  visualGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "28px",
    alignItems: "start",
  },
  qrVisualGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 280px) minmax(0, 1fr)",
    gap: "28px",
    alignItems: "start",
  },
  qrInfoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "16px",
    alignItems: "start",
  },
  label: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#66809c",
  },
  value: {
    margin: "8px 0 0",
    color: "#21405f",
    fontSize: "15px",
    lineHeight: 1.55,
    wordBreak: "break-word",
  },
  photo: {
    width: "100%",
    maxWidth: "280px",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "16px",
    border: "1px solid #d7e2ef",
    backgroundColor: "#eaf2f8",
  },
  placeholder: {
    width: "100%",
    maxWidth: "280px",
    aspectRatio: "4 / 3",
    borderRadius: "16px",
    border: "1px dashed #cbd9e7",
    backgroundColor: "#f3f8fc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#698099",
    fontSize: "13px",
    fontWeight: 600,
    textAlign: "center",
    padding: "14px",
    boxSizing: "border-box",
  },
  list: {
    display: "grid",
    gap: "12px",
    marginTop: "14px",
  },
  listItem: {
    border: "1px solid #dbe5ef",
    borderRadius: "16px",
    backgroundColor: "#ffffff",
    padding: "14px 16px",
  },
  tableWrap: {
    overflowX: "auto",
    maxWidth: "100%",
    marginTop: "12px",
  },
  packCardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  packCardName: {
    margin: 0,
    color: "#17324d",
    fontWeight: 800,
    lineHeight: 1.35,
    minWidth: 0,
    flex: "1 1 auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "680px",
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
  mutedText: {
    margin: "6px 0 0",
    color: "#69839c",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  itemAttribution: {
    display: "block",
    marginTop: "3px",
    color: "#69839c",
    fontSize: "13px",
    lineHeight: 1.4,
  },
  readinessStatus: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    flex: "0 0 auto",
    marginLeft: "auto",
  },
  readinessReadyPill: {
    backgroundColor: "#e6f5ec",
    color: "#2d7a4f",
    border: "1px solid #d4ead9",
  },
  readinessNeedsReplenishmentPill: {
    backgroundColor: "#fff4db",
    color: "#9a6700",
    border: "1px solid #f2dfb2",
  },
};

const formatDateTime = (value) => {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatQuantity = (quantity, unitOfMeasure) => {
  const normalizedQuantity =
    quantity !== null && quantity !== undefined && quantity !== ""
      ? quantity
      : "--";
  const normalizedUnit = unitOfMeasure || "unit(s)";

  return `${normalizedQuantity} ${normalizedUnit}`;
};

const getDisplayStubNumber = (stubDetails, row) => {
  return (
    stubDetails?.display_stub_no ||
    row?.display_stub_no ||
    stubDetails?.stub_no ||
    "--"
  );
};

const formatStatus = (status, label = "") => {
  if (label) {
    return label;
  }

  if (status === "ISSUED") {
    return "For Claim";
  }

  if (status === "CLAIMED") {
    return "Claimed";
  }

  return status || "--";
};

const formatContactNumber = (value) => {
  if (!value) {
    return "--";
  }

  const digitsOnly = String(value).replace(/\D/g, "");

  if (digitsOnly.length === 12 && digitsOnly.startsWith("63")) {
    const localNumber = digitsOnly.slice(2);
    return `+63 ${localNumber.slice(0, 3)} ${localNumber.slice(3, 6)} ${localNumber.slice(6)}`;
  }

  return value;
};

const buildFullName = (person) => {
  if (!person) {
    return "--";
  }

  return [
    person.first_name,
    person.middle_name,
    person.last_name,
    person.suffix,
  ]
    .filter(Boolean)
    .join(" ") || person.full_name || "--";
};

const getSectorNames = (sectors) => {
  if (!Array.isArray(sectors) || sectors.length === 0) {
    return "No sector indicated.";
  }

  return sectors
    .map((sector) => sector?.display_name || sector?.name)
    .filter(Boolean)
    .join(", ") || "No sector indicated.";
};

const getHousehold = (stubDetails, row) => {
  return (
    stubDetails?.household ||
    row?.masterlist_household ||
    {
      family_head_name: row?.family_head_name,
      household_size: row?.family_members_count,
      contact_number: row?.masterlist_household?.contact_number,
      current_stay_type: row?.masterlist_household?.current_stay_type,
      current_address_details: row?.masterlist_household?.current_address_details,
      registered_at: row?.masterlist_household?.registered_at,
    }
  );
};

const getMembers = (stubDetails, row) => {
  const stubMembers = Array.isArray(stubDetails?.household?.members)
    ? stubDetails.household.members
    : [];
  const rowMembers = Array.isArray(row?.household_members)
    ? row.household_members
    : [];

  if (stubMembers.length > 0) {
    return stubMembers;
  }

  return rowMembers;
};

const getReliefPackTemplates = ({ row, stubDetails, templateDetails }) => {
  const templateDetailsById = new Map(
    (Array.isArray(templateDetails) ? templateDetails : [])
      .filter((template) => template?.id)
      .map((template) => [template.id, template]),
  );
  const templates = [
    ...(Array.isArray(stubDetails?.assigned_relief_packs)
      ? stubDetails.assigned_relief_packs
      : []),
    ...(Array.isArray(row?.relief_pack_templates)
      ? row.relief_pack_templates
      : []),
  ];
  const uniqueTemplates = new Map();

  templates.forEach((template) => {
    const key = template?.id || template?.name;

    if (!key || uniqueTemplates.has(key)) {
      return;
    }

    const currentTemplateDetails = templateDetailsById.get(template.id) || null;
    uniqueTemplates.set(key, {
      ...(template?.assignment_snapshot
        ? template
        : {
            ...template,
            ...(currentTemplateDetails || null),
          }),
    });
  });

  return [...uniqueTemplates.values()];
};

const getDonatedReliefPacks = (row, stubDetails) => {
  return [
    ...(Array.isArray(stubDetails?.available_donated_relief_packs)
      ? stubDetails.available_donated_relief_packs
      : []),
    ...(Array.isArray(row?.donated_relief_packs)
      ? row.donated_relief_packs
      : []),
  ];
};

const getDonatedLooseItems = (row, stubDetails) => {
  return [
    ...(Array.isArray(stubDetails?.available_donated_loose_items)
      ? stubDetails.available_donated_loose_items
      : []),
    ...(Array.isArray(row?.donated_loose_items)
      ? row.donated_loose_items
      : []),
  ];
};

const getItemSourceType = (item) => {
  const sourceReliefType = String(item?.source_relief_type || "")
    .trim()
    .toUpperCase();

  return {
    sourceReliefType,
    sourceType: String(item?.source_type || "")
      .trim()
      .toUpperCase(),
  };
};

const isDonatedReliefPackItem = (item) =>
  getItemSourceType(item).sourceReliefType === "DONATED_RELIEF_PACK" ||
  getItemReliefPackType(item) === "DONATED_RELIEF_PACK";

const isDonatedLooseItem = (item) => {
  const { sourceReliefType, sourceType } = getItemSourceType(item);

  return (
    sourceReliefType === "DONATED_LOOSE_ITEM" ||
    (sourceType === "DONATED" && sourceReliefType !== "DONATED_RELIEF_PACK")
  );
};

const getPackItemDisplayData = (item) => {
  const inventoryItem = item?.inventory_item || {};

  return {
    key:
      item?.id ||
      `${
        item?.inventory_item_id ||
        inventoryItem.id ||
        item?.item_name ||
        inventoryItem.item_name ||
        "item"
      }-${item?.donor_name || "lgu"}`,
    inventoryItemId: item?.inventory_item_id || inventoryItem.id || null,
    itemName: item?.item_name || inventoryItem.item_name || "--",
    category: item?.category || inventoryItem.category || "--",
    quantity:
      item?.quantity_released ??
      item?.quantity_required ??
      item?.quantity ??
      null,
    unitOfMeasure:
      item?.unit_of_measure || inventoryItem.unit_of_measure || "unit(s)",
    donorName: item?.donor_name || null,
    isDonatedLoose: isDonatedLooseItem(item),
  };
};

const aggregatePackItems = (items) => {
  const itemMap = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    const displayData = getPackItemDisplayData(item);
    const key = [
      displayData.inventoryItemId || displayData.itemName,
      displayData.donorName || "LGU",
    ].join("|");
    const existingItem = itemMap.get(key);

    if (!existingItem) {
      itemMap.set(key, displayData);
      return;
    }

    const existingQuantity = Number(existingItem.quantity);
    const nextQuantity = Number(displayData.quantity);

    if (Number.isFinite(existingQuantity) && Number.isFinite(nextQuantity)) {
      existingItem.quantity = existingQuantity + nextQuantity;
    }
  });

  return [...itemMap.values()];
};

const STANDARD_RELIEF_PACK = "STANDARD_RELIEF_PACK";
const ADDITIONAL_RELIEF_PACK = "ADDITIONAL_RELIEF_PACK";
const MIXED_RELIEF_PACK = "MIXED_RELIEF_PACK";
const DONATED_RELIEF_PACK = "DONATED_RELIEF_PACK";
const DONATED_LOOSE_ITEM = "DONATED_LOOSE_ITEM";

const getItemReliefPackType = (item) => {
  const snapshotType = String(
    item?.relief_pack_type_snapshot || item?.relief_pack_type || "",
  )
    .trim()
    .toUpperCase();

  if (
    [
      STANDARD_RELIEF_PACK,
      ADDITIONAL_RELIEF_PACK,
      MIXED_RELIEF_PACK,
      DONATED_RELIEF_PACK,
      DONATED_LOOSE_ITEM,
    ].includes(snapshotType)
  ) {
    return snapshotType;
  }

  const sourceType = String(item?.source_relief_type || "")
    .trim()
    .toUpperCase();

  return [
    STANDARD_RELIEF_PACK,
    ADDITIONAL_RELIEF_PACK,
    MIXED_RELIEF_PACK,
    DONATED_RELIEF_PACK,
    DONATED_LOOSE_ITEM,
  ].includes(sourceType)
    ? sourceType
    : "";
};

const getTransactionReliefPackSnapshots = (transaction) => {
  const snapshots = transaction?.relief_pack_template_snapshots;

  if (Array.isArray(snapshots)) {
    return snapshots.filter((snapshot) => snapshot?.name);
  }

  if (typeof snapshots === "string") {
    try {
      const parsedSnapshots = JSON.parse(snapshots);
      return Array.isArray(parsedSnapshots)
        ? parsedSnapshots.filter((snapshot) => snapshot?.name)
        : [];
    } catch {
      return [];
    }
  }

  return [];
};

const getTransactionReliefPackNames = (transaction, reliefPackType = "") => {
  const snapshots = getTransactionReliefPackSnapshots(transaction);
  const normalizedType = String(reliefPackType || "")
    .trim()
    .toUpperCase();
  const typedNames = snapshots
    .filter((snapshot) => {
      if (!normalizedType) {
        return true;
      }

      const snapshotType = snapshot?.is_additional_pack
        ? ADDITIONAL_RELIEF_PACK
        : STANDARD_RELIEF_PACK;
      return snapshotType === normalizedType;
    })
    .map((snapshot) => snapshot.name)
    .filter(Boolean);

  if (typedNames.length > 0) {
    return [...new Set(typedNames)];
  }

  if (normalizedType && snapshots.length > 0) {
    return [];
  }

  const snapshotNames = Array.isArray(
    transaction?.relief_pack_template_name_list,
  )
    ? transaction.relief_pack_template_name_list.filter(Boolean)
    : [];

  if (snapshotNames.length > 0) {
    return snapshotNames;
  }

  const fallbackName =
    transaction?.relief_pack_template_names ||
    transaction?.relief_pack_template_name ||
    "";

  return fallbackName ? [fallbackName] : [];
};

const getSingleTransactionReliefPackType = (transaction) => {
  const snapshots = getTransactionReliefPackSnapshots(transaction);

  if (snapshots.length !== 1) {
    return "";
  }

  return snapshots[0]?.is_additional_pack
    ? ADDITIONAL_RELIEF_PACK
    : STANDARD_RELIEF_PACK;
};

const getTransactionReliefPackTemplateId = (item) =>
  item?.relief_pack_template_id_snapshot || item?.relief_pack_template_id || "";

const buildReceivedPackSections = (transaction, items) => {
  const standardPackGroups = new Map();
  const additionalPackGroups = new Map();
  const unclassifiedItems = [];
  const donatedPackGroups = new Map();
  const donatedLooseItemGroups = new Map();
  const transactionPackSnapshots = getTransactionReliefPackSnapshots(transaction);
  const templateSnapshotsById = new Map(
    transactionPackSnapshots
      .filter((snapshot) => snapshot?.relief_pack_template_id)
      .map((snapshot) => [
        String(snapshot.relief_pack_template_id),
        snapshot,
      ]),
  );
  const templateOrderById = new Map(
    transactionPackSnapshots
      .filter((snapshot) => snapshot?.relief_pack_template_id)
      .map((snapshot, index) => [
        String(snapshot.relief_pack_template_id),
        index,
      ]),
  );
  const singleTransactionPackType = getSingleTransactionReliefPackType(
    transaction,
  );

  const getPackGroups = (packType) =>
    packType === ADDITIONAL_RELIEF_PACK
      ? additionalPackGroups
      : standardPackGroups;

  const getTemplateSnapshotsForPackType = (packType) =>
    transactionPackSnapshots.filter((snapshot) =>
      snapshot?.is_additional_pack
        ? packType === ADDITIONAL_RELIEF_PACK
        : packType === STANDARD_RELIEF_PACK,
    );

  const getFallbackPackName = (packType) => {
    const packNames = getTransactionReliefPackNames(transaction, packType);

    if (packNames.length === 1) {
      return packNames[0];
    }

    return packType === ADDITIONAL_RELIEF_PACK
      ? "Additional Relief Pack Items (Pack Not Recorded)"
      : "Standard Relief Pack Items (Pack Not Recorded)";
  };

  const addTemplateItemToPackGroup = (
    packType,
    item,
    templateSnapshot = null,
  ) => {
    const templateId = getTransactionReliefPackTemplateId(item);
    const packTypeSnapshots = getTemplateSnapshotsForPackType(packType);
    const resolvedTemplateSnapshot =
      templateSnapshot ||
      (!templateId && packTypeSnapshots.length === 1
        ? packTypeSnapshots[0]
        : null);
    const resolvedTemplateId =
      templateId || resolvedTemplateSnapshot?.relief_pack_template_id || "";
    const groupKey = resolvedTemplateId
      ? String(resolvedTemplateId)
      : "UNASSIGNED";
    const groups = getPackGroups(packType);
    const group = groups.get(groupKey) || {
      key: `received-${packType.toLowerCase()}-${groupKey}`,
      name: resolvedTemplateSnapshot?.name || getFallbackPackName(packType),
      source: "Malvar LGU",
      items: [],
      packType,
      showItemDonorAttribution: true,
      templateOrder: templateOrderById.get(groupKey) ?? Number.MAX_SAFE_INTEGER,
    };

    group.items.push(item);
    groups.set(groupKey, group);
  };

  [
    [STANDARD_RELIEF_PACK, standardPackGroups],
    [ADDITIONAL_RELIEF_PACK, additionalPackGroups],
  ].forEach(([packType, groups]) => {
    getTemplateSnapshotsForPackType(packType).forEach((snapshot, index) => {
      const templateId = snapshot?.relief_pack_template_id;

      if (!templateId || groups.has(String(templateId))) {
        return;
      }

      groups.set(String(templateId), {
        key: `received-${packType.toLowerCase()}-${templateId}`,
        name: snapshot.name,
        source: "Malvar LGU",
        items: [],
        packType,
        showItemDonorAttribution: true,
        templateOrder:
          templateOrderById.get(String(templateId)) ?? index,
      });
    });
  });

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (isDonatedReliefPackItem(item)) {
      const packName = item.donated_relief_pack_name || "Donated Relief Pack";
      const groupKey = `${packName}|${item.donor_name || "Donor"}`;
      const group = donatedPackGroups.get(groupKey) || {
        key: `donated-pack-${groupKey}`,
        name: packName,
        source: item.donor_name || "Donor",
        items: [],
      };

      group.items.push(item);
      donatedPackGroups.set(groupKey, group);
      return;
    }

    const itemTemplateId = getTransactionReliefPackTemplateId(item);
    const itemTemplateSnapshot = itemTemplateId
      ? templateSnapshotsById.get(String(itemTemplateId)) || null
      : null;
    const itemReliefPackType = itemTemplateSnapshot
      ? itemTemplateSnapshot.is_additional_pack
        ? ADDITIONAL_RELIEF_PACK
        : STANDARD_RELIEF_PACK
      : getItemReliefPackType(item) || singleTransactionPackType;

    if (
      itemReliefPackType === STANDARD_RELIEF_PACK ||
      itemReliefPackType === ADDITIONAL_RELIEF_PACK
    ) {
      addTemplateItemToPackGroup(
        itemReliefPackType,
        item,
        itemTemplateSnapshot,
      );
      return;
    }

    if (
      itemReliefPackType === DONATED_LOOSE_ITEM ||
      isDonatedLooseItem(item)
    ) {
      const donorName = item.donor_name || "Donor";
      const group = donatedLooseItemGroups.get(donorName) || {
        key: `donated-items-${donorName}`,
        name: "Donated Items",
        source: donorName,
        items: [],
      };

      group.items.push(item);
      donatedLooseItemGroups.set(donorName, group);
      return;
    }

    unclassifiedItems.push(item);
  });

  const sections = [
    ...[...standardPackGroups.values(), ...additionalPackGroups.values()].sort(
      (left, right) => {
        const leftTypeOrder =
          left.packType === STANDARD_RELIEF_PACK ? 0 : 1;
        const rightTypeOrder =
          right.packType === STANDARD_RELIEF_PACK ? 0 : 1;

        if (leftTypeOrder !== rightTypeOrder) {
          return leftTypeOrder - rightTypeOrder;
        }

        return left.templateOrder - right.templateOrder;
      },
    ),
  ];

  if (unclassifiedItems.length > 0) {
    sections.push({
      key: "unclassified-relief-pack-items",
      name: "Relief Pack Items (Pack Not Recorded)",
      source: "Malvar LGU",
      items: unclassifiedItems,
      showItemDonorAttribution: true,
    });
  }

  donatedPackGroups.forEach((group) => {
    sections.push({
      ...group,
    });
  });

  donatedLooseItemGroups.forEach((group) => {
    sections.push({
      ...group,
    });
  });

  return sections;
};

const buildAssignedPackSections = (
  reliefPackTemplates,
  donatedReliefPacks,
  donatedLooseItems,
  readinessByTemplateId = new Map(),
  showReadinessStatus = false,
) => {
  const templates = Array.isArray(reliefPackTemplates)
    ? reliefPackTemplates
    : [];
  const templateSections = (isAdditionalPack) =>
    templates
      .filter(
        (template) =>
          Boolean(template?.is_additional_pack) === isAdditionalPack,
      )
      .map((template, index) => ({
        key: `assigned-${isAdditionalPack ? "additional" : "standard"}-pack-${template?.id || template?.name || index}`,
        name: template?.name || "Relief Pack",
        source: "Malvar LGU",
        items: template?.items || [],
        readiness: showReadinessStatus
          ? readinessByTemplateId.get(template?.id) || null
          : null,
      }));
  const sections = [
    ...templateSections(false),
    ...templateSections(true),
  ];

  (Array.isArray(donatedReliefPacks) ? donatedReliefPacks : []).forEach(
    (pack, index) => {
      sections.push({
        key: `assigned-donated-pack-${pack?.donation_id || pack?.name || index}`,
        name: pack?.name || "Donated Relief Pack",
        source: pack?.donor_name || "Donor",
        items: pack?.items || [],
      });
    },
  );

  const looseItemsByDonor = new Map();

  (Array.isArray(donatedLooseItems) ? donatedLooseItems : []).forEach(
    (item) => {
      const donorName = item?.donor_name || "Donor";
      const group = looseItemsByDonor.get(donorName) || {
        key: `assigned-donated-items-${donorName}`,
        name: "Donated Items",
        source: donorName,
        items: [],
      };

      group.items.push(item);
      looseItemsByDonor.set(donorName, group);
    },
  );

  looseItemsByDonor.forEach((group) => sections.push(group));

  return sections;
};

const ReliefPackCard = ({
  name,
  source,
  items,
  showItemDonorAttribution = false,
  readiness = null,
}) => {
  const displayItems = aggregatePackItems(items);

  return (
    <div style={styles.listItem}>
      <div style={styles.packCardHeader}>
        <p style={styles.packCardName}>{name || "Relief Pack"}</p>
        {readiness ? (
          <div style={styles.readinessStatus}>
            <StatusPill
              status={readiness.status}
              label={readiness.label}
              style={
                readiness.status === RELIEF_PACK_READINESS_STATUS.NEEDS_REPLENISHMENT
                  ? styles.readinessNeedsReplenishmentPill
                  : styles.readinessReadyPill
              }
            />
          </div>
        ) : null}
      </div>
      <p style={{ ...styles.value, marginTop: "8px" }}>{source || "--"}</p>
      <div
        className="inventory-distribution-detail-table-scroll"
        style={styles.tableWrap}
      >
        <table
          className="inventory-distribution-detail-table"
          style={{ ...styles.table, minWidth: "600px" }}
        >
          <thead>
            <tr>
              <th style={styles.th}>Item Name</th>
              <th style={styles.th}>Category</th>
              <th style={styles.th}>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {displayItems.length === 0 ? (
              <tr>
                <td style={styles.td} colSpan={3}>
                  <span style={styles.mutedText}>
                    No item breakdown available.
                  </span>
                </td>
              </tr>
            ) : (
              displayItems.map((item) => (
                <tr key={item.key}>
                  <td style={styles.td}>
                    {item.itemName}
                    {showItemDonorAttribution &&
                    item.isDonatedLoose &&
                    item.donorName ? (
                      <span style={styles.itemAttribution}>
                        ({item.donorName})
                      </span>
                    ) : null}
                  </td>
                  <td style={styles.td}>{item.category}</td>
                  <td style={styles.td}>
                    {formatQuantity(item.quantity, item.unitOfMeasure)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const InfoField = ({ label, value }) => (
  <div>
    <p style={styles.label}>{label}</p>
    <p style={styles.value}>{value || "--"}</p>
  </div>
);

const formatInfoValue = (value) => {
  if (value === null || value === undefined) {
    return "--";
  }

  const normalizedValue = String(value).trim();

  return normalizedValue || "--";
};

const getDisasterEventTitle = (stubDetails, row, household) => {
  return (
    stubDetails?.disaster_event?.title ||
    row?.masterlist_disaster_event?.title ||
    household?.disaster_event_title ||
    "--"
  );
};

const InventoryDistributionDetailModal = ({
  isOpen,
  isLoading,
  errorMessage,
  row,
  stubDetails,
  templateDetails = [],
  inventoryBatches = [],
  isReadinessLoading = false,
  readinessErrorMessage = "",
  disasterEvents = [],
  disasterEventId = "",
  showReadinessStatus = false,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  const household = getHousehold(stubDetails, row);
  const familyHeadPhotoUrl = resolveFamilyHeadPhoto(household);
  const members = getMembers(stubDetails, row);
  const latestAttendance =
    stubDetails?.latest_attendance ||
    row?.latest_attendance ||
    null;
  const barangay =
    stubDetails?.barangay?.name ||
    household?.barangay?.name ||
    household?.barangay_name ||
    row?.barangay_name ||
    row?.address ||
    "--";
  const familyHeadName =
    household?.family_head_name ||
    [
      household?.family_head_first_name,
      household?.family_head_middle_name,
      household?.family_head_last_name,
      household?.family_head_suffix,
    ]
      .filter(Boolean)
      .join(" ") ||
    row?.family_head_name ||
    "--";
  const householdSectors = [
    ...(Array.isArray(stubDetails?.household_sectors)
      ? stubDetails.household_sectors
      : []),
    ...(Array.isArray(row?.household_sectors)
      ? row.household_sectors
      : []),
  ];
  const memberSectors = members.flatMap((member) =>
    Array.isArray(member?.sectors) ? member.sectors : [],
  );
  const sectorsText =
    row?.sectors_text && row.sectors_text !== "-"
      ? row.sectors_text
      : getSectorNames([...householdSectors, ...memberSectors]);
  const distributionTransaction = stubDetails?.distribution_transaction || null;
  const isClaimed =
    distributionTransaction?.distribution_status === "CLAIMED" ||
    stubDetails?.status === "CLAIMED" ||
    row?.distribution_status === "CLAIMED" ||
    row?.raw_stub_status === "CLAIMED";
  const receivedTransactionItems = Array.isArray(
    stubDetails?.distribution_transaction_items,
  )
    ? stubDetails.distribution_transaction_items
    : [];
  const authorizedByName =
    distributionTransaction?.verified_by_name ||
    row?.authorized_by_name ||
    row?.verified_by_name ||
    "";
  const reliefPackTemplates = getReliefPackTemplates({
    row,
    stubDetails,
    templateDetails,
  });
  const donatedReliefPacks = getDonatedReliefPacks(row, stubDetails);
  const donatedLooseItems = getDonatedLooseItems(row, stubDetails);
  const receivedPackSections = buildReceivedPackSections(
    distributionTransaction,
    receivedTransactionItems,
  );
  const readinessDisasterEventId =
    disasterEventId ||
    stubDetails?.disaster_event?.id ||
    row?.masterlist_disaster_event?.id ||
    row?.disaster_event_id ||
    "";
  const assignedPackReadiness =
    showReadinessStatus && !isReadinessLoading && !readinessErrorMessage
    ? getReliefPackReadinessForTemplates({
        templates: reliefPackTemplates,
        inventoryBatches,
        targetDisasterEventId: readinessDisasterEventId,
        disasterEvents,
        householdSize:
          household?.household_size ??
          household?.members_count ??
          row?.family_members_count ??
          members.length,
      })
    : null;
  const assignedPackSections = buildAssignedPackSections(
    reliefPackTemplates,
    donatedReliefPacks,
    donatedLooseItems,
    assignedPackReadiness?.byTemplateId,
    showReadinessStatus,
  );
  const recordedBy =
    household?.registered_by_name ||
    household?.recorded_by_name ||
    household?.registered_by ||
    "--";

  return (
    <DetailsModalShell
      isOpen={isOpen}
      title="Household Distribution Details"
      onClose={onClose}
      maxWidth="980px"
      closeMode="icon"
      titleStyle={{ fontSize: "30px", fontWeight: 700 }}
      panelStyle={styles.shellPanel}
      overlayClassName="inventory-distribution-detail-modal-backdrop"
      panelClassName="inventory-distribution-detail-modal"
    >
      {isLoading ? (
        <LoadingState message="Loading distribution details..." />
      ) : errorMessage ? (
        <ErrorState compact message={errorMessage} />
      ) : !row ? (
        <EmptyState compact message="Distribution detail is unavailable." />
      ) : (
        <div className="inventory-distribution-detail-stack" style={{ display: "grid", gap: "20px" }}>
          <section
            className="inventory-distribution-detail-section"
            style={styles.sectionCard}
          >
            <h3 style={{ margin: 0, color: "#17324d" }}>Household Information</h3>
            <div
              className="inventory-distribution-detail-grid"
              style={{ ...styles.grid, marginTop: "16px" }}
            >
              <InfoField
                label="Disaster Event"
                value={getDisasterEventTitle(stubDetails, row, household)}
              />
              <InfoField label="Barangay" value={barangay} />
              <InfoField
                label="Stay Type"
                value={formatStayTypeLabel(household?.current_stay_type)}
              />
              <InfoField label="Family Head" value={familyHeadName} />
              <InfoField
                label="Contact Number"
                value={formatContactNumber(household?.contact_number)}
              />
              <InfoField
                label="Household Size"
                value={
                  household?.household_size ??
                  household?.members_count ??
                  row?.family_members_count ??
                  members.length
                }
              />
              <InfoField
                label="Registered At"
                value={formatDateTime(household?.registered_at)}
              />
              <InfoField label="Recorded By" value={recordedBy} />
            </div>
          </section>

          <section
            className="inventory-distribution-detail-section"
            style={styles.sectionCard}
          >
            <div
              className="inventory-distribution-detail-visual-grid"
              style={styles.visualGrid}
            >
              <div>
                <p style={styles.label}>Family Head Photo</p>
                <div style={{ marginTop: "12px" }}>
                  {familyHeadPhotoUrl ? (
                    <img
                      src={familyHeadPhotoUrl}
                      alt="Registered family head"
                      style={styles.photo}
                    />
                  ) : (
                    <div style={styles.placeholder}>No photo available</div>
                  )}
                </div>
              </div>
              <div>
                <p style={styles.label}>Household Sectors / Vulnerabilities</p>
                <p style={styles.value}>{sectorsText}</p>

                <p style={{ ...styles.label, marginTop: "18px" }}>
                  Evacuation Status
                </p>
                <p style={styles.value}>
                  {latestAttendance?.status || "No attendance record yet"}
                </p>

                <p style={{ ...styles.label, marginTop: "18px" }}>
                  Arrival Time
                </p>
                <p style={styles.value}>
                  {formatDateTime(latestAttendance?.time_in)}
                </p>

                <p style={{ ...styles.label, marginTop: "18px" }}>
                  Departure Time
                </p>
                <p style={styles.value}>
                  {formatDateTime(latestAttendance?.time_out)}
                </p>
              </div>
            </div>
          </section>

          <section
            className="inventory-distribution-detail-section"
            style={styles.sectionCard}
          >
            <h3 style={{ margin: 0, color: "#17324d" }}>Family Members</h3>
            {members.length === 0 ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                No family members are recorded yet.
              </p>
            ) : (
              <div style={styles.list}>
                {members.map((member) => (
                  <div
                    key={member.id || member.evacuee_id || member.full_name}
                    style={styles.listItem}
                  >
                    <p style={{ margin: 0, color: "#17324d", fontWeight: 700 }}>
                      {buildFullName(member)}
                    </p>
                    <p style={{ ...shellStyles.mutedText, marginTop: "6px" }}>
                      {member.relationship_to_head || "--"} | {member.sex || "--"} |{" "}
                      {member.age_value ?? member.age ?? "--"} {member.age_unit || ""}
                    </p>
                    <p style={{ ...shellStyles.mutedText, marginTop: "6px" }}>
                      Sectors: {getSectorNames(member.sectors)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            className="inventory-distribution-detail-section"
            style={styles.sectionCard}
          >
            <h3 style={{ margin: 0, color: "#17324d" }}>QR Stub</h3>
            <div
              className="inventory-distribution-detail-qr-grid"
              style={{ ...styles.qrVisualGrid, marginTop: "16px" }}
            >
              <div
                className="inventory-distribution-detail-qr-panel"
                style={{ maxWidth: "280px" }}
              >
                <QrCodePanel
                  value={stubDetails?.qr_code_value || row?.qr_code_value || ""}
                  emptyLabel="No QR available"
                  valueStyle={{ overflowWrap: "anywhere" }}
                />
              </div>
              <div
                className="inventory-distribution-detail-qr-info-grid"
                style={styles.qrInfoGrid}
              >
                <InfoField
                  label="Stub Number"
                  value={getDisplayStubNumber(stubDetails, row)}
                />
                <InfoField
                  label="Stub Status"
                  value={formatStatus(
                    stubDetails?.status || row?.raw_stub_status,
                    row?.distribution_status_label,
                  )}
                />
                <InfoField
                  label="Issued At"
                  value={formatDateTime(
                    stubDetails?.issued_at || row?.latest_arrival_time,
                  )}
                />
                <InfoField
                  label="Claimed At"
                  value={formatDateTime(stubDetails?.claimed_at || row?.claimed_at)}
                />
                <InfoField
                  label="Receipt Number"
                  value={formatInfoValue(
                    distributionTransaction?.receipt_no || row?.receipt_no,
                  )}
                />
                <InfoField
                  label="Authorized By"
                  value={formatInfoValue(authorizedByName)}
                />
              </div>
            </div>
          </section>

          <section
            className="inventory-distribution-detail-section"
            style={styles.sectionCard}
          >
            <h3 style={{ margin: 0, color: "#17324d" }}>
              {isClaimed
                ? "Relief Packs / Items Received"
                : "Relief Packs / Items Assigned"}
            </h3>

            {showReadinessStatus && !isClaimed && isReadinessLoading ? (
              <LoadingState message="Loading inventory readiness..." />
            ) : showReadinessStatus && !isClaimed && readinessErrorMessage ? (
              <ErrorState
                compact
                message={`Readiness is unavailable: ${readinessErrorMessage}`}
              />
            ) : isClaimed ? (
              receivedPackSections.length === 0 ? (
                <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                  No received items are recorded for this claim.
                </p>
              ) : (
                <div style={styles.list}>
                  {receivedPackSections.map((section) => (
                    <ReliefPackCard key={section.key} {...section} />
                  ))}
                </div>
              )
            ) : assignedPackSections.length === 0 ? (
              <p style={{ ...shellStyles.mutedText, marginTop: "12px" }}>
                Current assignment details are not available for this household yet.
              </p>
            ) : (
              <div style={styles.list}>
                {assignedPackSections.map((section) => (
                  <ReliefPackCard key={section.key} {...section} />
                ))}
              </div>
            )}
          </section>

        </div>
      )}
    </DetailsModalShell>
  );
};

export default InventoryDistributionDetailModal;
